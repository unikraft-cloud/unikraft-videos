/**
 * Review a cut without rendering the video:
 *
 *   npm run review -- <id>                    pacing report + out/review/<id>/sheet.png
 *   npm run review -- <id> --frames 120,300   … plus full-size stills of those frames
 *   npm run review -- <id> --scene hook       … plus full-size stills of that scene's review frames
 *
 * The sheet tiles every review frame (each read's "should be read by now"
 * moment and each scene's last settled frame) with scene, time and copy.
 * Look at it: if a line isn't legible in its tile, the scene is too fast.
 */
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import { loadVideo, REPO_ROOT } from '../kit/timeline/load.ts';
import { checkVideo, formatReport } from '../kit/timeline/pacing.ts';
import { reviewFrames } from '../kit/timeline/review.ts';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const video = await loadVideo(args[0]);
const frames = reviewFrames(video);

console.log(formatReport(checkVideo(video)));

const stills = [
  ...(flag('--frames')?.split(',').map(Number) ?? []),
  ...(flag('--scene') ? frames.filter((f) => f.scene === flag('--scene')).map((f) => f.frame) : []),
];
if (stills.some((f) => !Number.isInteger(f) || f < 0 || f >= video.durationInFrames)) {
  throw new Error(`--frames must be integers in 0…${video.durationInFrames - 1}`);
}
if (flag('--scene') && !video.scenes.some((s) => s.id === flag('--scene'))) {
  throw new Error(`Unknown scene "${flag('--scene')}"`);
}

const outDir = `${REPO_ROOT}out/review/${video.id}/`;
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: `${REPO_ROOT}videos/index.ts`, onProgress: () => {} });
const browser = await openBrowser('chrome');
try {
  const sheet = await selectComposition({
    serveUrl,
    id: `${video.id}-sheet`,
    puppeteerInstance: browser,
    inputProps: {},
  });
  await renderStill({
    composition: sheet,
    serveUrl,
    output: `${outDir}sheet.png`,
    puppeteerInstance: browser,
  });
  console.log(`\nSheet  ${outDir}sheet.png`);
  frames.forEach((f, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}  f${String(f.frame).padEnd(5)} ${f.scene.padEnd(16)} ${f.label}`,
    );
  });
  if (stills.length) {
    const full = await selectComposition({
      serveUrl,
      id: video.id,
      puppeteerInstance: browser,
      inputProps: {},
    });
    for (const frame of stills) {
      const output = `${outDir}f${String(frame).padStart(5, '0')}.png`;
      await renderStill({ composition: full, serveUrl, output, frame, puppeteerInstance: browser });
      console.log(`Still  ${output}`);
    }
  }
} finally {
  await browser.close({ silent: true });
}
