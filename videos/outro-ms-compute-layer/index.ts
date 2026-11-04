import type { VideoEntry } from '../../kit/video/Video';
import { Outro } from './scenes/Outro';
import { video } from './timeline';

export const entry: VideoEntry = { video, scenes: { outro: Outro } };
