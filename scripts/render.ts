/**
 * Final render: `npm run render -- <id> [--silent]` → out/<id>.mp4.
 * Runs the pacing check (errors stop enforced videos), regenerates the
 * soundtrack from the timeline, then renders with remotion.config.ts settings.
 */
import { execFileSync } from 'node:child_process';
import { loadVideo, REPO_ROOT } from '../kit/timeline/load.ts';
import { checkVideo, formatReport } from '../kit/timeline/pacing.ts';

const [id, ...rest] = process.argv.slice(2);
const silent = rest.includes('--silent');
const video = await loadVideo(id);

const report = checkVideo(video);
console.log(formatReport(report));
if (report.enforced && report.issues.some((i) => i.severity === 'error')) {
  console.error('\nPacing errors — fix them (or lengthen scenes) before rendering.');
  process.exit(1);
}

const run = (cmd: string, argv: string[]) => execFileSync(cmd, argv, { cwd: REPO_ROOT, stdio: 'inherit' });
if (!silent) {
  run(process.execPath, ['kit/audio/generate.ts', video.id]);
}
const out = `out/${video.id}${silent ? '-silent' : ''}.mp4`;
run('npx', [
  'remotion',
  'render',
  video.id,
  out,
  ...(silent ? ['--props={"soundtrack":false,"hud":true}'] : []),
]);
console.log(`\nRendered ${out}`);
