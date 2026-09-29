/**
 * The original 30 s promo — the reference cut the kit was extracted from.
 *
 * 120 BPM: 1 beat = 0.5 s = 30 frames, 60 beats. Every scene here is bespoke
 * (`scenes/`), and its choreography constants live in the scene file; the cues
 * below mirror them. New videos should use recipes and `marks` instead (see
 * videos/template), where a scene's cues and animation read the same numbers.
 *
 * Over budget even for its own preset — `npm run check -- promo-30s` shows why it
 * reads too fast — so its pacing is report-only.
 */
import { defineVideo } from '../../kit/timeline/define.ts';

export const video = defineVideo({
  id: 'promo-30s',
  title: 'Unikraft Cloud — 30 s promo',
  preset: 'promo',
  pacing: 'report',
  chapters: ['The tension', 'Fast', 'Safe', 'Cheap', 'Any workload', 'Get started'],
  scenes: [
    {
      // "Fast." "Safe." "Cheap." slam on b1/b2/b3, "// pick two." types at b4.5,
      // gets struck and rewritten to "pick all three." at b6.
      id: 'hook',
      beats: 8,
      chapter: 1,
      cues: [
        { at: 0, kind: 'reverse', len: 1 },
        { at: 1, kind: 'impact' },
        { at: 2, kind: 'impact' },
        { at: 3, kind: 'impact' },
        { at: 4.5, kind: 'type', len: 1 },
        { at: 6, kind: 'glitch' },
        { at: 6, kind: 'hit' },
        { at: 6.5, kind: 'riser', len: 1.5 },
      ],
      reads: [
        { text: 'Fast. Safe. Cheap.', at: 3, until: 6 },
        { text: '// pick two.', at: 5.5, until: 6 },
        { text: '// pick all three.', at: 6.5 },
      ],
    },
    {
      // Stripes assemble b0–b0.5, wordmark b1, tagline b2.
      id: 'logo',
      beats: 4,
      cues: [
        { at: 0, kind: 'boom' },
        { at: 0, kind: 'ticks', len: 0.5 },
        { at: 1, kind: 'shimmer' },
        { at: 3, kind: 'riser', len: 1 },
      ],
      reads: [{ text: 'The millisecond compute layer.', at: 2 }],
    },
    {
      // Terminal types b0.25–b1.75, "✓ deployed" b2, curl b2.5, "replied in 8.4 ms" b3,
      // dive into the number b3.5, count-up b4, lock b5.
      id: 'coldStart',
      beats: 6,
      chapter: 2,
      cues: [
        { at: 0, kind: 'impact' },
        { at: 0.25, kind: 'type', len: 1.5 },
        { at: 2, kind: 'blip' },
        { at: 2.5, kind: 'type', len: 0.5 },
        { at: 3, kind: 'blip' },
        { at: 3.5, kind: 'whoosh' },
        { at: 4, kind: 'countUp', len: 1 },
        { at: 5, kind: 'hit' },
      ],
      reads: [
        { text: 'Built for milliseconds, not minutes.', at: 0.5, until: 3.5 },
        { text: 'replied in 8.4 ms', at: 3, until: 3.5 },
        { text: 'Idle to first byte 8.4 ms', at: 5 },
      ],
    },
    {
      // Bars launch b0, Unikraft finishes b0.5, container b1.5, "up to 100× faster" slams b2.
      id: 'race',
      beats: 4,
      chapter: 2,
      cues: [
        { at: 0, kind: 'whoosh' },
        { at: 0.5, kind: 'chime' },
        { at: 1.5, kind: 'blip' },
        { at: 2, kind: 'impact' },
      ],
      reads: [{ text: 'Up to 100× faster', at: 2 }],
    },
    {
      // Requests wake instances on the 8ths, "$0 while idle" b2.
      id: 'scaleToZero',
      beats: 4,
      chapter: 2,
      cues: [
        { at: 0, kind: 'whoosh' },
        { at: 2, kind: 'hit' },
      ],
      reads: [{ text: '$0.00 idle cost', at: 2, until: 3.8 }],
    },
    {
      // One generation per 8th note, b0 → b1.5.
      id: 'fork',
      beats: 2,
      chapter: 2,
      cues: [
        { at: 0, kind: 'impact' },
        { at: 0, kind: 'ticks', len: 2 },
      ],
      reads: [{ text: 'Fork a live VM in ~10 ms', at: 0.5 }],
    },
    {
      // Bug escapes the container b1, bug blocked by the VM b2.5.
      id: 'isolation',
      beats: 5,
      chapter: 3,
      cues: [
        { at: 0, kind: 'impact' },
        { at: 1, kind: 'glitch' },
        { at: 2.5, kind: 'clang' },
      ],
      reads: [
        { text: "Containers don't contain.", at: 0, until: 3 },
        { text: 'Every instance is its own microVM.', at: 3 },
      ],
    },
    {
      // Three chips land b0 / b0.5 / b1.
      id: 'trust',
      beats: 3,
      chapter: 3,
      cues: [
        { at: 0, kind: 'hit' },
        { at: 0.5, kind: 'hit' },
        { at: 1, kind: 'hit' },
        { at: 2.5, kind: 'whoosh' },
      ],
      reads: [{ text: 'SOC 2 Type II · HIPAA-compliant · Independent pen-test', at: 1, until: 2.5 }],
    },
    {
      // Grid subdivides + counter b0.5–b3, "100,000+" locks b3.
      id: 'density',
      beats: 4,
      chapter: 4,
      cues: [
        { at: 0, kind: 'impact' },
        { at: 0.5, kind: 'countUp', len: 2.5 },
        { at: 3, kind: 'hit' },
      ],
      reads: [{ text: '100,000+ microVMs on one server', at: 3 }],
    },
    {
      // "$0" lands b2, "10–100×" lands b3.
      id: 'economics',
      beats: 4,
      chapter: 4,
      cues: [
        { at: 0, kind: 'whoosh' },
        { at: 2, kind: 'hit' },
        { at: 3, kind: 'hit' },
      ],
      reads: [
        { text: 'Never pay for idle.', at: 0.5, until: 3 },
        { text: '10–100× better unit economics', at: 3 },
      ],
    },
    {
      // Dockerfile types b0.5, morphs into a microVM b2, lands b2.5.
      id: 'dockerfile',
      beats: 4,
      chapter: 5,
      cues: [
        { at: 0, kind: 'impact' },
        { at: 0.5, kind: 'type', len: 1 },
        { at: 2, kind: 'whoosh' },
        { at: 2.5, kind: 'hit' },
      ],
      reads: [{ text: 'A standard Dockerfile. A radically different runtime.', at: 0.25 }],
    },
    {
      // The noun swaps on every 8th, b0 → b2.5.
      id: 'rotator',
      beats: 4,
      chapter: 5,
      cues: [
        { at: 0, kind: 'blip' },
        { at: 0.5, kind: 'blip' },
        { at: 1, kind: 'blip' },
        { at: 1.5, kind: 'blip' },
        { at: 2, kind: 'blip' },
        { at: 2.5, kind: 'blip' },
        { at: 2, kind: 'riser', len: 2 },
      ],
      reads: [{ text: 'Build AI agents that cold-start in 10 milliseconds.', at: 2.5 }],
    },
    {
      // Four deployment chips land b0.5 / b0.75 / b1 / b1.25.
      id: 'deploy',
      beats: 2,
      chapter: 6,
      cues: [
        { at: 0, kind: 'impact' },
        { at: 0.5, kind: 'blip' },
        { at: 0.75, kind: 'blip' },
        { at: 1, kind: 'blip' },
        { at: 1.25, kind: 'blip' },
      ],
      reads: [
        { text: 'Your cloud, your way.', at: 0.25, until: 1.25 },
        { text: 'Hosted On-Prem BYOC Dedicated hosts', at: 1.25 },
      ],
    },
    {
      // ✓ Fast / ✓ Safe / ✓ Cheap on b0 / b0.5 / b1, logo boom b2, wordmark b3, CTA b3.5.
      id: 'end',
      beats: 6,
      cues: [
        { at: 0, kind: 'hit' },
        { at: 0.5, kind: 'hit' },
        { at: 1, kind: 'hit' },
        { at: 1.5, kind: 'reverse', len: 0.5 },
        { at: 2, kind: 'boom' },
        { at: 2, kind: 'ticks', len: 0.5 },
        { at: 3, kind: 'shimmer' },
        { at: 3.5, kind: 'blip' },
      ],
      reads: [
        { text: 'Fast. Safe. Cheap.', at: 1, until: 1.5 },
        { text: '<10ms cold start · 100K+ VMs/server · 10-100× better unit economics', at: 3.25 },
        { text: 'Get started for free · Talk to an engineer', at: 3.75 },
      ],
    },
  ],
  music: [
    { name: 'intro', until: 'logo' },
    { name: 'sting', until: 'coldStart' },
    { name: 'groove', until: 'isolation' },
    { name: 'dark', until: 'density' },
    { name: 'groove', until: 'dockerfile' },
    { name: 'build', until: 'deploy' },
    { name: 'break', until: 'end+2' },
    { name: 'finale' },
  ],
});

export const { beats } = video;
