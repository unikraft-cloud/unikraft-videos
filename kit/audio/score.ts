/**
 * The score: beat grid, arrangement sections and harmony, all derived from
 * the video's timeline so picture and sound share one clock.
 */
import type { MusicSection } from '../timeline/define.ts';
import { BPM, CUES, MUSIC, SECONDS_PER_BEAT, TOTAL_BEATS } from './video.ts';
import { SR } from './dsp.ts';

export const SAMPLES_PER_BEAT = SR * SECONDS_PER_BEAT;
if (!Number.isInteger(SAMPLES_PER_BEAT) || BPM * SECONDS_PER_BEAT !== 60) {
  throw new Error(`Beat grid must be sample-exact: ${SAMPLES_PER_BEAT} samples/beat at ${BPM} BPM`);
}
export const TOTAL_SAMPLES = TOTAL_BEATS * SAMPLES_PER_BEAT;

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

/** One chord per bar, Am – F – C – G, from the first groove bar on. */
const PROGRESSION: readonly Chord[] = [AM, FMAJ7, CMAJ7, GADD9];
const PROGRESSION_START = MUSIC.find((s) => s.name === 'groove')?.from ?? 12;

/** The break's cadence stabs double its `hit` cues. */
export const BREAK_HITS: readonly number[] = CUES.filter(
  (c) => c.kind === 'hit' && sectionAt(c.beat).name === 'break',
).map((c) => c.beat);

export const cadenceChord = (index: number): Chord => CADENCE[Math.min(index, CADENCE.length - 1)];

/** Harmony at an absolute beat — also used to tune melodic SFX so every ping sits in the chord. */
export const chordAt = (beat: number): Chord => {
  const { name } = sectionAt(beat);
  if (name === 'intro') {
    return DRONE;
  }
  if (name === 'sting' || name === 'finale') {
    return AM_WIDE;
  }
  if (name === 'break') {
    const passed = BREAK_HITS.filter((b) => b <= beat).length;
    if (passed > 0) {
      return cadenceChord(passed - 1);
    }
  }
  const bar = Math.floor((beat - PROGRESSION_START) / 4);
  return PROGRESSION[((bar % 4) + 4) % 4];
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
