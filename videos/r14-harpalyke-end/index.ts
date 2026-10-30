import type { VideoEntry } from '../../kit/video/Video';
import { End } from './scenes/End';
import { video } from './timeline';

export const entry: VideoEntry = { video, scenes: { end: End } };
