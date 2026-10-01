import type { VideoEntry } from '../../kit/video/Video';
import { Cta } from './scenes/Cta';
import { video } from './timeline';

export const entry: VideoEntry = { video, scenes: { cta: Cta } };
