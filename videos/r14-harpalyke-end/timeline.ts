/**
 * Release 14 (Harpalyke) end screen: 8 beats (2 bars) at 120 BPM = 4.0 s, 1440×1440 square.
 *
 * | scene | recipe       | message                                                 |
 * |-------|--------------|---------------------------------------------------------|
 * | end   | custom (End) | Unikraft lockup, "Release 14 — Harpalyke", the docs URL |
 *
 * 0.5 s lead-in (the backdrop fades up from black, nothing else moves) and at least 0.5 s of
 * settled hold at the tail, so the card can be cut in and out without clipping an animation.
 * `promo` preset: the only one whose minimum shot and reading speed fit a short card.
 * No sound at all: no cues, `silent` music; render with `--silent` for an mp4 without an audio track.
 */
import { defineVideo } from '../../kit/timeline/define.ts';

const END = {
  /** `[brackets]` mark the accent phrase. */
  title: 'Release 14 — [Harpalyke]',
  lead: 'check out more at',
  /** Rendered as host (white) + path (blue). */
  host: 'unikraft.com',
  path: '/docs/r14-harpalyke',
};

export const video = defineVideo({
  id: 'r14-harpalyke-end',
  title: 'Release 14 — Harpalyke end screen',
  preset: 'promo',
  canvas: { width: 1440, height: 1440 },
  chapters: [],
  scenes: [
    {
      id: 'end',
      beats: 8,
      // Beats from the scene start (1 beat = 0.5 s). End.tsx animates on these.
      marks: { logo: 1, title: 2.5, url: 3.5 },
      cues: [],
      reads: [
        { text: END.title.replace(/[[\]]/g, ''), at: 'title+1' },
        { text: `${END.lead} ${END.host}${END.path}`, at: 'url+1.5' },
      ],
      props: END,
    },
  ],
  music: [{ name: 'silent' }],
});
