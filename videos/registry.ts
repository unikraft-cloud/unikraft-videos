import type { VideoEntry } from '../kit/video/Video';
import { entry as gallery } from './gallery';
import { entry as promo30s } from './promo-30s';
import { entry as template } from './template';
import { entry as netlifyOutro } from './netlify-outro';
import { entry as netlifyCta } from './netlify-cta';

/** Every video in the Studio, in display order. `npm run new-video` appends here. */
export const VIDEOS: readonly VideoEntry[] = [promo30s, template, gallery, netlifyOutro, netlifyCta];
