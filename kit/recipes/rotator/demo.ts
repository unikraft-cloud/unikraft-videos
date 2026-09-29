import { rotator } from './plan.ts';

/** The homepage hero line, at a readable pace. */
export const demo = rotator(
  'rotatorDemo',
  {
    before: 'Build',
    nouns: [
      { text: 'databases', icon: 'solar:database-bold' },
      { text: 'sandboxes', icon: 'solar:shield-check-bold' },
      { text: 'headless browsers', icon: 'solar:monitor-bold' },
      { text: 'AI agents', icon: 'solar:cpu-bolt-bold' },
    ],
    after: ['that cold-start in', '10 milliseconds.'],
    tag: 'Any Dockerfile · No porting',
  },
  { chapter: 1 },
);
