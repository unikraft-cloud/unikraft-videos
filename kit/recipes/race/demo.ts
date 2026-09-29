import { race } from './plan.ts';

/** The promo's cold-start race: microVM vs. container vs. a VM still booting. */
export const demo = race(
  'raceDemo',
  {
    headline: 'Up to [100×] faster',
    subline: 'vs. containers & VMs',
    lanes: [
      { label: 'Unikraft Cloud', value: 10, display: '~10 ms', highlight: true },
      { label: 'Container cold start', value: 150, display: '~150 ms' },
      { label: 'Traditional VM', value: 45000, display: 'seconds → minutes', pending: true },
    ],
  },
  { chapter: 1 },
);
