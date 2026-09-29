import type { VideoEntry } from '../../kit/video/Video';
import { Flow } from './scenes/Flow';
import { video } from './timeline';

/** Custom scene components by scene id; recipe scenes (statement, endCard, …) need no entry. */
export const entry: VideoEntry = { video, scenes: { flow: Flow } };
