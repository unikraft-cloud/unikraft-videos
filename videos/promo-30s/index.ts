import type { VideoEntry } from '../../kit/video/Video';
import { SCENE_COMPONENTS } from './scenes';
import { video } from './timeline';
import { Transitions } from './Transitions';

export const entry: VideoEntry = { video, scenes: SCENE_COMPONENTS, Overlay: Transitions };
