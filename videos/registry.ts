import type { VideoEntry } from '../kit/video/Video';
import { entry as gallery } from './gallery';
import { entry as promo30s } from './promo-30s';
import { entry as template } from './template';
import { entry as netlifyOutro } from './netlify-outro';
import { entry as netlifyCta } from './netlify-cta';
import { entry as r14HarpalykeEnd } from './r14-harpalyke-end';
import { entry as outroNextGenCloud } from './outro-next-gen-cloud';
import { entry as outroMsComputePlatform } from './outro-ms-compute-platform';
import { entry as outroMsComputeLayer } from './outro-ms-compute-layer';
import { entry as r15IsonoeEnd } from './r15-isonoe-end';

/** Every video in the Studio, in display order. `npm run new-video` appends here. */
export const VIDEOS: readonly VideoEntry[] = [
  promo30s,
  template,
  gallery,
  netlifyOutro,
  netlifyCta,
  r14HarpalykeEnd,
  outroNextGenCloud,
  outroMsComputePlatform,
  outroMsComputeLayer,
  r15IsonoeEnd,
];
