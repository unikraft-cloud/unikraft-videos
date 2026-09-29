import { logoSting } from './plan.ts';

export const demo = logoSting(
  'logoStingDemo',
  { tagline: 'The [millisecond] compute layer.', caption: 'Unikraft Cloud · Linux-based microVMs' },
  { chapter: 1, cues: [{ at: 'exit-1', kind: 'riser', len: 1 }] },
);
