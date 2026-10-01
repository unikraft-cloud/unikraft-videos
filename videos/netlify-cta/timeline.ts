/**
 * Netlify × Unikraft blog CTA: 8 beats (2 bars) at 100 BPM = 4.8 s. Plays right before `netlify-outro`.
 *
 * | scene | recipe       | message                                     |
 * |-------|--------------|---------------------------------------------|
 * | cta   | custom (Cta) | "Check it out in detail here:" + the blog URL |
 *
 * Sound matches the outro: a low whoosh on the line, soft keys under the URL decode; no music.
 */
import { defineVideo } from '../../kit/timeline/define.ts';

const CTA = {
  lead: 'Check it out in detail here:',
  /** Rendered as host (white) + path (blue). */
  host: 'www.unikraft.com',
  path: '/blog/netlify-edge-functions',
};

export const video = defineVideo({
  id: 'netlify-cta',
  title: 'Netlify × Unikraft blog CTA',
  preset: 'explainer',
  chapters: [],
  scenes: [
    {
      id: 'cta',
      beats: 8,
      // Beats from the scene start. Cta.tsx animates on these.
      marks: { lead: 0.5, url: 1.5, rule: 2.5 },
      cues: [
        { at: 'lead', kind: 'whoosh', gain: 0.6, pitch: 0.4 },
        { at: 'url', kind: 'type', len: 1, gain: 0.4 },
      ],
      reads: [
        { text: CTA.lead, at: 'lead+1' },
        { text: `${CTA.host}${CTA.path}`, at: 'rule+1' },
      ],
      props: CTA,
    },
  ],
  music: [{ name: 'silent' }],
});
