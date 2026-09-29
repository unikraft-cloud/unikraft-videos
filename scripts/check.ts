/**
 * Pacing report + checks: `npm run check [-- <id>...] [--preset explainer]`.
 * Exits 1 if any enforced video has errors. `--preset` judges a cut against
 * another preset's budget (tempo stays the video's own).
 */
import { loadVideo, videoIds } from '../kit/timeline/load.ts';
import { checkVideo, formatReport } from '../kit/timeline/pacing.ts';
import { PRESETS, type PresetName } from '../kit/timeline/presets.ts';

const args = process.argv.slice(2);
const presetIdx = args.indexOf('--preset');
const presetName = presetIdx >= 0 ? (args[presetIdx + 1] as PresetName) : undefined;
if (presetName !== undefined && !PRESETS[presetName]) {
  throw new Error(`Unknown preset "${presetName}". Presets: ${Object.keys(PRESETS).join(', ')}`);
}
const ids = args.filter((a, i) => !a.startsWith('--') && (presetIdx < 0 || i !== presetIdx + 1));

let failed = false;
for (const id of ids.length ? ids : videoIds()) {
  const report = checkVideo(await loadVideo(id), presetName && PRESETS[presetName]);
  console.log(`\n${formatReport(report)}`);
  failed ||= report.enforced && report.issues.some((i) => i.severity === 'error');
}
process.exitCode = failed ? 1 : 0;
