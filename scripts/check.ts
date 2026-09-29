/**
 * Pacing report + checks: `npm run check [-- <id>...] [--preset explainer]`.
 * Exits 1 if any video has errors. `--preset` judges a cut against another
 * preset's budget (tempo stays the video's own).
 */
import { loadVideo, videoIds } from '../kit/timeline/load.ts';
import { checkVideo, type PacingReport } from '../kit/timeline/pacing.ts';
import { PRESETS, type PresetName } from '../kit/timeline/presets.ts';

const args = process.argv.slice(2);
const presetIdx = args.indexOf('--preset');
const presetName = presetIdx >= 0 ? (args[presetIdx + 1] as PresetName) : undefined;
if (presetName !== undefined && !PRESETS[presetName]) {
  throw new Error(`Unknown preset "${presetName}". Presets: ${Object.keys(PRESETS).join(', ')}`);
}
const ids = args.filter((a, i) => !a.startsWith('--') && i !== presetIdx + 1);

const print = (r: PacingReport): void => {
  console.log(
    `\n${r.video} · ${r.seconds.toFixed(1)} s · checked as "${r.preset}"${r.enforced ? '' : ' (report only)'}`,
  );
  console.log('  #   scene              start    len  words  read  accents');
  r.scenes.forEach((s, i) => {
    const tight = s.need > s.seconds ? ' ◀' : '';
    console.log(
      `  ${String(i + 1).padStart(2)}  ${s.id.padEnd(17)} ${s.start.toFixed(1).padStart(6)} ${s.seconds.toFixed(1).padStart(6)} ${String(s.words).padStart(6)} ${s.need.toFixed(1).padStart(5)} ${String(s.accents).padStart(8)}${tight}`,
    );
  });
  const mean = r.scenes.reduce((t, s) => t + s.seconds, 0) / r.scenes.length;
  console.log(`  average shot ${mean.toFixed(1)} s over ${r.scenes.length} scenes`);
  for (const issue of r.issues) {
    console.log(
      `  ${issue.severity === 'error' ? 'ERROR' : 'warn '} ${issue.scene ? `${issue.scene}: ` : ''}${issue.message}`,
    );
  }
  if (!r.issues.length) {
    console.log('  ✓ within budget');
  }
};

let failed = false;
for (const id of ids.length ? ids : videoIds()) {
  const video = await loadVideo(id);
  const report = checkVideo(video, presetName && PRESETS[presetName]);
  print(report);
  failed ||= report.enforced && report.issues.some((i) => i.severity === 'error');
}
process.exitCode = failed ? 1 : 0;
