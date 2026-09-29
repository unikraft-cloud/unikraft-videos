/**
 * The video being scored, loaded from the command line before any other audio
 * module evaluates (top-level await): `node kit/audio/generate.ts <video-id>`.
 * Everything musical — tempo, length, cues, sections — comes from its timeline.
 */
import { loadVideo } from '../timeline/load.ts';

export const VIDEO = await loadVideo(process.argv[2]);

export const BPM = VIDEO.grid.bpm;
export const SECONDS_PER_BEAT = VIDEO.grid.secondsPerBeat;
export const TOTAL_BEATS = VIDEO.totalBeats;
export const CUES = VIDEO.cues;
export const MUSIC = VIDEO.music;
