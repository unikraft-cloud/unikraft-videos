/**
 * Which frames `npm run review` puts on the contact sheet: for every scene, the
 * moment each read should have been read (landed + `react`), and the last
 * settled frame before the exit. Pure (the review script prints the legend).
 */
import type { Video } from './define.ts';
import { FPS } from './grid.ts';

export type ReviewFrame = { frame: number; scene: string; index: number; label: string };

export const reviewFrames = (video: Video): ReviewFrame[] => {
  const { beats } = video.grid;
  const out: ReviewFrame[] = [];
  for (const s of video.scenes) {
    const start = beats(s.start);
    const end = start + beats(s.beats) - 1;
    const frames: { frame: number; label: string }[] = s.reads.map((r) => ({
      frame: Math.min(start + beats(r.until) - 1, start + beats(r.at) + Math.round(video.preset.react * FPS)),
      label: r.text,
    }));
    const settled = 'exit' in s.marks ? start + beats(s.marks.exit) - 1 : end;
    frames.push({ frame: Math.min(settled, end), label: 'settled (before exit)' });
    for (const f of frames.sort((a, b) => a.frame - b.frame)) {
      // Frames closer than 1/10 s show the same picture.
      if (out.length && f.frame - out[out.length - 1].frame < 6) {
        continue;
      }
      out.push({ frame: f.frame, scene: s.id, index: s.index, label: f.label });
    }
  }
  return out;
};
