/**
 * Netlify × Unikraft collab outro: 8 beats (2 bars) at 100 BPM = 4.8 s.
 *
 * | scene | recipe          | message                                   |
 * |-------|-----------------|-------------------------------------------|
 * | outro | custom (Outro)  | both logos side by side on a soft gradient |
 *
 * No copy: the logos are the message. Sound is a low whoosh per logo and a chime; no music (`silent`).
 */
import { defineVideo } from '../../kit/timeline/define.ts';

export const video = defineVideo({
  id: 'netlify-outro',
  title: 'Netlify × Unikraft outro',
  preset: 'explainer',
  chapters: [],
  scenes: [
    {
      id: 'outro',
      beats: 8,
      // Beats from the scene start. Outro.tsx animates on these.
      marks: { netlify: 0.5, divider: 1, unikraft: 1.25 },
      cues: [
        { at: 'netlify', kind: 'whoosh', gain: 0.6, pitch: 0.4 },
        { at: 'unikraft', kind: 'whoosh', gain: 0.6, pitch: 0.4 },
        { at: 'unikraft+2', kind: 'chime', gain: 0.5 },
      ],
    },
  ],
  music: [{ name: 'silent' }],
});
