import type { VideoEntry } from '../kit/video/Video';
import { entry as promo30s } from './promo-30s';

/** Every video in the Studio, in display order. `npm run new-video` appends here. */
export const VIDEOS: readonly VideoEntry[] = [promo30s];
