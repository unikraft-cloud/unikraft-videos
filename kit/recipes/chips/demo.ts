import { chips } from './plan.ts';

/** The promo's Deploy beat: four deployment targets hanging off the platform. */
export const demo = chips(
  'chipsDemo',
  {
    headline: 'Your cloud, [your way.]',
    hub: { label: 'Unikraft Cloud' },
    group: 'Deploy it',
    items: [
      { label: 'Hosted', icon: 'solar:cloud-bold' },
      { label: 'On-Prem', icon: 'solar:server-bold' },
      { label: 'BYOC', icon: 'solar:cloud-storage-bold' },
      { label: 'Dedicated hosts', icon: 'solar:server-2-bold' },
    ],
    footer: 'RUNS ON · BARE METAL · ANY VM',
  },
  { chapter: 1 },
);
