import { stat } from './plan.ts';

/** The promo's density beat as a stat: one server box subdividing into 100,000+ microVMs. */
export const demo = stat(
  'statDemo',
  {
    eyebrow: 'microVMs / server',
    value: 100000,
    suffix: '+',
    label: 'One server.\n[100K+ microVMs.]',
    caption: 'Each one hardware-isolated',
    visual: 'grid',
  },
  { chapter: 1 },
);
