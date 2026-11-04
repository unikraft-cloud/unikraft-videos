/**
 * Outro card: 8 beats (2 bars) at 100 BPM = 4.8 s, 1440×1440 square, tacked onto the end of a video.
 *
 * | scene | recipe          | message                                                       |
 * |-------|-----------------|---------------------------------------------------------------|
 * | outro | custom (Outro)  | Unikraft lockup on the edge halftone field, tagline |
 *
 * The halftone squares pop in staggered from the frame edges, the lockup assembles (traced U, letters
 * fade in), the tagline rises in under it, then the card holds still to the last frame (no exit).
 * Not `logoSting`: that recipe booms, plays cues, has no edge field and exits into a next scene.
 * No sound at all: no cues, `silent` music.
 */
import { defineVideo } from '../../kit/timeline/define.ts';

const OUTRO = {
  /** Lockup tagline: sentence case, no full stop (a lockup line, not a headline). */
  tagline: 'The millisecond compute platform',
};

export const video = defineVideo({
  id: 'outro-ms-compute-platform',
  title: 'Outro: millisecond compute platform',
  preset: 'explainer',
  canvas: { width: 1440, height: 1440 },
  chapters: [],
  scenes: [
    {
      id: 'outro',
      beats: 8,
      // Beats from the scene start (1 beat = 0.6 s). Outro.tsx animates on these and ignores `exit`.
      marks: { field: 0, logo: 0.5, tagline: 1.5 },
      cues: [],
      reads: [
        { text: 'Unikraft', at: 'logo+2' },
        { text: OUTRO.tagline, at: 'tagline+1' },
      ],
      props: OUTRO,
    },
  ],
  music: [{ name: 'silent' }],
});
