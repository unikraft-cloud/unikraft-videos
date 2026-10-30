/**
 * Canvas and clock. Videos render at 60 fps, 1920×1080 unless they set `canvas`; tempo is per video.
 *
 * Pure data, `.ts`-extension imports only: this module is loaded by plain Node
 * (type stripping) from the soundtrack generator and the pacing checker.
 */

export const FPS = 60;
/** Default canvas (`VideoSpec.canvas`). */
export const WIDTH = 1920;
export const HEIGHT = 1080;
/** Soundtrack sample rate (kit/audio/dsp.ts `SR`). */
export const SAMPLE_RATE = 48_000;

export type Grid = {
  bpm: number;
  framesPerBeat: number;
  secondsPerBeat: number;
  samplesPerBeat: number;
  /** Frames in `n` beats (fractional beats allowed). */
  beats: (n: number) => number;
  /** Seconds in `n` beats. */
  seconds: (n: number) => number;
};

/**
 * The beat grid for `bpm`. Rejects tempos whose beat or 8th note is not a whole
 * number of frames, or whose beat is not a whole number of samples — cuts, cues
 * and note onsets must land exactly on both clocks.
 * Valid examples: 72, 75, 90, 100, 120, 144, 150.
 */
export const makeGrid = (bpm: number): Grid => {
  const framesPerBeat = (FPS * 60) / bpm;
  const samplesPerBeat = (SAMPLE_RATE * 60) / bpm;
  if (!Number.isInteger(framesPerBeat / 2) || !Number.isInteger(samplesPerBeat)) {
    throw new Error(
      `${bpm} BPM is not grid-exact: ${framesPerBeat} frames/beat, ${samplesPerBeat} samples/beat ` +
        '(need a whole number of frames per 8th note and samples per beat — try 72, 75, 90, 100, 120).',
    );
  }
  const secondsPerBeat = 60 / bpm;
  return {
    bpm,
    framesPerBeat,
    secondsPerBeat,
    samplesPerBeat,
    beats: (n) => n * framesPerBeat,
    seconds: (n) => n * secondsPerBeat,
  };
};

/** Frames in `n` milliseconds — for motion that must not stretch with tempo (entrances, exits, flashes). */
export const ms = (n: number): number => Math.round((n * FPS) / 1000);
