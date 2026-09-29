import { layers } from './plan.ts';

/** The promo's Isolation beat, at a readable pace. */
export const demo = layers(
  'layersDemo',
  {
    headline: "Containers [don't contain.]",
    verdict: 'Every instance is its own [microVM.]',
    left: {
      title: 'Containers',
      stat: { label: 'TCB (Linux kernel)', value: '~40M LoC' },
      apps: ['c1', 'c2', 'c3', 'c4'],
      layers: [
        { label: 'container runtime', tone: 'warn' },
        { label: 'host OS', tone: 'neutral' },
      ],
      badge: 'CVE-2024-21626 · container escape',
    },
    right: {
      title: 'Unikraft Cloud',
      stat: { label: 'TCB (KVM)', value: '~200–250K LoC' },
      apps: ['VM1', 'VM2', 'VM3', 'VM4'],
      layers: [{ label: 'hypervisor', tone: 'safe' }],
      badge: 'Contained ✓',
    },
    threat: 'both',
  },
  { chapter: 1 },
);
