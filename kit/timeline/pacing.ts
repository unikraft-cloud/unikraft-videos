/**
 * Readability budget and the pacing checker behind `npm run check`.
 *
 * Budget for one piece of copy: `react` seconds to find it + its words at `wpm`
 * (tokens containing a digit count double: numbers are parsed, not skimmed).
 * Reads that share a scene also have to fit in it back to back — a viewer
 * reads one thing at a time.
 */
import { ACCENT_KINDS, type PlanContext, type Video } from './define.ts';
import type { Preset } from './presets.ts';

/** Reading weight of `text` in words. */
export const words = (text: string): number =>
  text
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t))
    .reduce((n, t) => n + (/\d/.test(t) ? 2 : 1), 0);

/** Seconds a viewer needs to find and read `text` under `preset`. */
export const readSeconds = (text: string, preset: Preset): number =>
  preset.react + (words(text) * 60) / preset.wpm;

/** `readSeconds` in beats, for planners. */
export const readBeats = (text: string, { preset, grid }: PlanContext): number =>
  readSeconds(text, preset) / grid.secondsPerBeat;

/** Round a planned scene length up to the preset's snap, never below the preset's minimum shot. */
export const snapBeats = (beats: number, { preset, grid }: PlanContext): number => {
  const min = preset.shot.min / grid.secondsPerBeat;
  return Math.ceil(Math.max(beats, min) / preset.snap - 1e-9) * preset.snap;
};

export type Severity = 'error' | 'warn';
export type Issue = { severity: Severity; scene: string | null; message: string };

export type SceneReport = {
  id: string;
  start: number;
  seconds: number;
  words: number;
  /** Seconds of reading the scene's copy needs, back to back. */
  need: number;
  accents: number;
};

export type PacingReport = {
  video: string;
  preset: string;
  /** Whether errors should fail the check (`video.pacing`). */
  enforced: boolean;
  seconds: number;
  scenes: SceneReport[];
  issues: Issue[];
};

const fmt = (n: number): string => n.toFixed(1);

/** Check a video against its preset (or `override`, to see how a cut would fare at another pace). */
export const checkVideo = (video: Video, override?: Preset): PacingReport => {
  const preset = override ?? video.preset;
  const { secondsPerBeat } = video.grid;
  const issues: Issue[] = [];
  const add = (severity: Severity, scene: string | null, message: string) =>
    issues.push({ severity, scene, message });

  const scenes = video.scenes.map((s): SceneReport => {
    const seconds = s.beats * secondsPerBeat;
    if (seconds < preset.shot.min - 1e-6) {
      add('error', s.id, `shot is ${fmt(seconds)} s, under the ${preset.shot.min} s minimum`);
    } else if (seconds > preset.shot.max + 1e-6) {
      add('warn', s.id, `shot is ${fmt(seconds)} s, over the ${preset.shot.max} s maximum — split it?`);
    }
    for (const r of s.reads) {
      const have = (r.until - r.at) * secondsPerBeat;
      const need = readSeconds(r.text, preset);
      if (have + 1e-6 < need) {
        add('error', s.id, `"${r.text}" is readable for ${fmt(have)} s, needs ${fmt(need)} s`);
      }
    }
    const need = s.reads.reduce((t, r) => t + readSeconds(r.text, preset), 0);
    if (need > seconds + 1e-6) {
      add('error', s.id, `copy needs ${fmt(need)} s of reading, the shot is ${fmt(seconds)} s`);
    }
    return {
      id: s.id,
      start: s.start * secondsPerBeat,
      seconds,
      words: s.reads.reduce((t, r) => t + words(r.text), 0),
      need,
      accents: s.cues.filter((c) => ACCENT_KINDS.includes(c.kind)).length,
    };
  });

  const mean = scenes.reduce((t, s) => t + s.seconds, 0) / scenes.length;
  const [lo, hi] = preset.shot.mean;
  if (mean < lo - 1e-6 || mean > hi + 1e-6) {
    add('warn', null, `average shot is ${fmt(mean)} s, outside ${lo}–${hi} s`);
  }

  // Accent spacing. Several accents on the same beat are one hit.
  const accentBeats = [
    ...new Set(video.cues.filter((c) => ACCENT_KINDS.includes(c.kind)).map((c) => c.beat)),
  ].sort((a, b) => a - b);
  for (let i = 1; i < accentBeats.length; i++) {
    const gap = accentBeats[i] - accentBeats[i - 1];
    if (gap + 1e-6 < preset.accentGap) {
      const scene = video.scenes.find((s) => accentBeats[i] >= s.start && accentBeats[i] < s.start + s.beats);
      add(
        'error',
        scene?.id ?? null,
        `accents ${gap} beats apart at beat ${accentBeats[i]} (min ${preset.accentGap}) — drop one or make it a blip`,
      );
    }
  }

  for (const m of video.music) {
    if (m.from % 4 !== 0) {
      add('error', null, `music "${m.name}" starts on beat ${m.from}, not on a bar line (multiple of 4)`);
    }
  }
  if (video.totalBeats % 4 !== 0) {
    add(
      'warn',
      null,
      `video is ${video.totalBeats} beats, not a whole number of bars — the ending won't land on a downbeat`,
    );
  }

  return {
    video: video.id,
    preset: preset.name,
    enforced: video.pacing === 'enforce',
    seconds: video.totalBeats * secondsPerBeat,
    scenes,
    issues,
  };
};
