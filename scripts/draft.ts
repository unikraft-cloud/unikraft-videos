/**
 * Draft render for a feedback round:
 *
 *   npm run draft -- <id>                 → out/drafts/<id>/v<N>.mp4
 *   npm run draft -- <id> --scene hook    → out/drafts/<id>/v<N>-hook.mp4 (one scene, master timecodes)
 *   npm run draft -- <id> --scale 1       … full resolution (default 0.5)
 *
 * Fast and rough: half resolution, light encoding, soundtrack included, and a
 * slate bar under the frame (draft version, timecode, frame, scene, beat) so
 * feedback can point at an exact moment. N is the next version in
 * videos/<id>/feedback.md, which gets a `## vN` entry for that round's notes
 * (AGENTS.md → Feedback rounds). Pacing errors stop it, as they stop `render`.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { loadVideo, REPO_ROOT, VIDEOS_DIR } from '../kit/timeline/load.ts';
import { checkVideo, formatReport } from '../kit/timeline/pacing.ts';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const video = await loadVideo(args[0]);
const sceneId = flag('--scene');
const scale = Number(flag('--scale') ?? 0.5);
if (!(scale > 0 && scale <= 1)) {
  throw new Error('--scale must be in (0, 1]');
}
const scene = sceneId === undefined ? undefined : video.scenes.find((s) => s.id === sceneId);
if (sceneId !== undefined && !scene) {
  throw new Error(`Unknown scene "${sceneId}". Scenes: ${video.scenes.map((s) => s.id).join(', ')}`);
}

const report = checkVideo(video);
console.log(formatReport(report));
if (report.enforced && report.issues.some((i) => i.severity === 'error')) {
  console.error('\nPacing errors — fix them before drafting.');
  process.exit(1);
}

const log = `${VIDEOS_DIR}${video.id}/feedback.md`;
const versions = existsSync(log)
  ? [...readFileSync(log, 'utf8').matchAll(/^## v(\d+)\b/gm)].map((m) => Number(m[1]))
  : [];
const version = `v${Math.max(0, ...versions) + 1}`;
const out = `out/drafts/${video.id}/${version}${scene ? `-${scene.id}` : ''}.mp4`;
mkdirSync(`${REPO_ROOT}out/drafts/${video.id}`, { recursive: true });

const run = (cmd: string, argv: string[]) => execFileSync(cmd, argv, { cwd: REPO_ROOT, stdio: 'inherit' });
run(process.execPath, ['kit/audio/generate.ts', video.id]);
const started = Date.now();
run('npx', [
  'remotion',
  'render',
  scene ? `${video.id}-${String(scene.index + 1).padStart(2, '0')}-${scene.id}` : video.id,
  out,
  `--props=${JSON.stringify({ soundtrack: true, hud: true, slate: version })}`,
  `--scale=${scale}`,
  '--crf=26',
  '--jpeg-quality=80',
  '--log=error',
]);

if (!existsSync(log)) {
  appendFileSync(
    log,
    `# ${video.title}: feedback\n\n` +
      'One `## vN` per draft, added by `npm run draft`. Under it: the notes on that draft (verbatim,\n' +
      'with the slate timecodes they point at), then `Changed:` what the next draft did about them.\n',
  );
}
const date = new Date().toISOString().slice(0, 10);
appendFileSync(log, `\n## ${version} · ${date} · ${scene ? `scene ${scene.id}` : 'full cut'} · ${out}\n`);

const mb = (statSync(`${REPO_ROOT}${out}`).size / 1e6).toFixed(1);
console.log(`\nDraft ${version}  ${out}  (${mb} MB, ${((Date.now() - started) / 1000).toFixed(0)} s)`);
console.log(`Notes go under "## ${version}" in videos/${video.id}/feedback.md`);
