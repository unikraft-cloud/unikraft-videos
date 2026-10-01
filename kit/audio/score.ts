/**
 * The score: beat grid, arrangement sections and harmony, all derived from
 * the video's timeline so picture and sound share one clock.
 */
import type { MusicSection } from '../timeline/define.ts';
import { CUES, MUSIC, SECONDS_PER_BEAT, TOTAL_BEATS, VIDEO } from './video.ts';
import { SR } from './dsp.ts';

/** Whole samples per beat at any grid-exact tempo (`makeGrid` rejects the rest). */
export const SAMPLES_PER_BEAT = VIDEO.grid.samplesPerBeat;
if (!Number.isInteger(SAMPLES_PER_BEAT) || SAMPLES_PER_BEAT !== SR * SECONDS_PER_BEAT) {
  throw new Error(`Beat grid must be sample-exact: ${SAMPLES_PER_BEAT} samples/beat at ${VIDEO.grid.bpm} BPM`);
}
export const TOTAL_SAMPLES = Math.round(TOTAL_BEATS * SAMPLES_PER_BEAT);

/** Absolute beat → sample index. Every cue/note start goes through here, so onsets are sample-accurate. */
export const at = (beat: number): number => Math.round(beat * SAMPLES_PER_BEAT);

/** Beats → seconds (for envelope times expressed musically). */
export const bs = (beats: number): number => beats * SECONDS_PER_BEAT;

export const sectionAt = (beat: number): MusicSection =>
  MUSIC.find((s) => beat >= s.from && beat < s.to) ?? MUSIC[MUSIC.length - 1];

export type Chord = {
  name: string;
  /** Bass root (MIDI, octave 1–2). */
  root: number;
  /** Pad / arp voicing (MIDI, ascending). */
  voicing: readonly number[];
};

// A minor. Common-tone voicings so the pad barely moves: A C E B → F A E G → G C E B → G B D A.
const AM: Chord = { name: 'Am(add9)', root: 33, voicing: [57, 60, 64, 71] };
const FMAJ7: Chord = { name: 'Fmaj9', root: 29, voicing: [53, 57, 64, 67] };
const CMAJ7: Chord = { name: 'Cmaj7', root: 36, voicing: [55, 60, 64, 71] };
const GADD9: Chord = { name: 'Gadd9', root: 31, voicing: [55, 59, 62, 69] };
/** Before the progression starts: open fifths on A. */
export const DRONE: Chord = { name: 'A5', root: 33, voicing: [45, 52, 57, 64] };
/** The big logo / end-card chord: wide A minor add9. */
export const AM_WIDE: Chord = { name: 'Am(add9) wide', root: 33, voicing: [45, 52, 57, 60, 64, 71, 76] };
/** Break cadence stabs (bVI – bVII – V → i): top voice climbs A4 → B4 → E5, then resolves to Am. */
const CADENCE: readonly Chord[] = [
  { name: 'F', root: 29, voicing: [53, 57, 60, 65, 69] },
  { name: 'G', root: 31, voicing: [55, 59, 62, 67, 71] },
  { name: 'E', root: 28, voicing: [56, 59, 64, 68, 76] },
];

/** One chord per bar, Am – F – C – G, over the bars of every progression section (not intro / sting / finale / silent). */
const PROGRESSION: readonly Chord[] = [AM, FMAJ7, CMAJ7, GADD9];
const OFF_PROGRESSION: readonly MusicSection['name'][] = ['intro', 'sting', 'finale', 'silent'];

/**
 * Progression bar index at each section's first beat: bars (a partial last bar counts as one)
 * of the progression sections before it, so chord changes always land on a section's own bar lines.
 */
const BAR_OFFSET = new Map<MusicSection, number>();
{
  let bars = 0;
  for (const s of MUSIC) {
    BAR_OFFSET.set(s, bars);
    if (!OFF_PROGRESSION.includes(s.name)) {
      bars += Math.ceil((s.to - s.from) / 4);
    }
  }
}

/** The `hit` cues inside break section `s`: its cadence stabs double them. */
export const breakHits = (s: MusicSection): number[] =>
  CUES.filter((c) => c.kind === 'hit' && c.beat >= s.from && c.beat < s.to).map((c) => c.beat);
const BREAK_HITS = new Map(MUSIC.filter((s) => s.name === 'break').map((s) => [s, breakHits(s)]));

export const cadenceChord = (index: number): Chord => CADENCE[Math.min(index, CADENCE.length - 1)];

/** Harmony at an absolute beat — also used to tune melodic SFX so every ping sits in the chord. */
export const chordAt = (beat: number): Chord => {
  const s = sectionAt(beat);
  if (s.name === 'intro' || s.name === 'silent') {
    return DRONE;
  }
  if (s.name === 'sting' || s.name === 'finale') {
    return AM_WIDE;
  }
  if (s.name === 'break') {
    const passed = (BREAK_HITS.get(s) ?? []).filter((b) => b <= beat).length;
    if (passed > 0) {
      return cadenceChord(passed - 1);
    }
  }
  const bar = (BAR_OFFSET.get(s) ?? 0) + Math.floor((beat - s.from) / 4);
  return PROGRESSION[bar % 4];
};

/** Chord tones of `chord` transposed into the octave starting at `lowMidi`, ascending (for bells/blips). */
export const chordTones = (chord: Chord, lowMidi: number, count: number): number[] => {
  const classes = [...new Set(chord.voicing.map((m) => m % 12))];
  const tones: number[] = [];
  for (let m = lowMidi; tones.length < count; m++) {
    if (classes.includes(m % 12)) {
      tones.push(m);
    }
  }
  return tones;
};
