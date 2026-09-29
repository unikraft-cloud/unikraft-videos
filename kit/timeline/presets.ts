/**
 * Pacing presets. A preset fixes the tempo and the readability budget every
 * scene is checked against (`npm run check`). Recipes plan their timing from it,
 * so switching a video from `promo` to `explainer` re-times every recipe scene.
 *
 * Principle: motion stays snappy (entrances/exits are in milliseconds and only
 * mildly scaled by `motion`); what grows with a slower preset is the dwell —
 * how long a settled frame stays on screen before the next thing happens.
 */

/** Music density for a section: 0 pads/drone only · 1 half-time, sparse · 2 full groove (the promo) · 3 lifted. */
export type Energy = 0 | 1 | 2 | 3;

export type PresetName = 'promo' | 'explainer' | 'walkthrough';

export type Preset = {
  name: PresetName;
  bpm: number;
  /** Scene length in seconds: under `min` fails, over `max` warns, the average should sit inside `mean`. */
  shot: { min: number; max: number; mean: readonly [number, number] };
  /** Reading speed for on-screen copy (words per minute; numbers count double). */
  wpm: number;
  /** Seconds a viewer needs to find a newly landed element before reading starts. */
  react: number;
  /** Minimum gap, in beats, between accent cues (impact · boom · hit · clang · glitch). */
  accentGap: number;
  /** Recipe-planned scene lengths round up to a multiple of this many beats. */
  snap: number;
  /** Scale on recipe entrance/exit durations (1 = the promo's snap). */
  motion: number;
  /** Scale on camera shake / punch-in amplitudes (1 = the promo's). */
  shake: number;
  /** Default music energy for every section that doesn't set its own. */
  energy: Energy;
};

export const PRESETS: Record<PresetName, Preset> = {
  /** The 30 s promo's pace: a cut every ~2 s, hits on every half-beat. Social cut-downs only. */
  promo: {
    name: 'promo',
    bpm: 120,
    shot: { min: 1, max: 5, mean: [1.5, 3] },
    wpm: 300,
    react: 0.25,
    accentGap: 0.5,
    snap: 1,
    motion: 1,
    shake: 1,
    energy: 2,
  },
  /** Default for new videos: 60–90 s, every line readable, one idea per shot. */
  explainer: {
    name: 'explainer',
    bpm: 100,
    shot: { min: 3, max: 10, mean: [4, 6.5] },
    wpm: 170,
    react: 0.7,
    accentGap: 1,
    snap: 4,
    motion: 1.25,
    shake: 0.5,
    energy: 1,
  },
  /** Product walkthroughs / tutorials: terminal demos and diagrams get room to breathe. */
  walkthrough: {
    name: 'walkthrough',
    bpm: 90,
    shot: { min: 4, max: 16, mean: [6, 10] },
    wpm: 150,
    react: 0.9,
    accentGap: 2,
    snap: 4,
    motion: 1.4,
    shake: 0.3,
    energy: 1,
  },
};
