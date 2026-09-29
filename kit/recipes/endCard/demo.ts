import { endCard, SITE_STATS } from './plan.ts';

export const demo = endCard(
  'endCardDemo',
  { recap: ['Fast.', 'Safe.', 'Cheap.'], stats: SITE_STATS },
  { chapter: 1 },
);
