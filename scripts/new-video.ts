/**
 * Start a new video from the template: `npm run new-video -- <id> ["Title"]`.
 * Copies videos/template → videos/<id>, sets id/title, registers it in
 * videos/registry.ts. Then edit videos/<id>/timeline.ts (see AGENTS.md).
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { VIDEOS_DIR } from '../kit/timeline/load.ts';

const [id, title] = process.argv.slice(2);
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  throw new Error('Usage: npm run new-video -- <id> ["Title"]  (id: lowercase a–z, 0–9, "-")');
}
const dir = `${VIDEOS_DIR}${id}/`;
if (existsSync(dir)) {
  throw new Error(`videos/${id} already exists`);
}
cpSync(`${VIDEOS_DIR}template/`, dir, { recursive: true });

const timeline = `${dir}timeline.ts`;
const src = readFileSync(timeline, 'utf8');
const next = src
  .replace("id: 'template',", `id: '${id}',`)
  .replace(/title: '[^']*',/, `title: '${(title ?? id).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`);
if (next === src || !next.includes(`id: '${id}',`)) {
  throw new Error("videos/template/timeline.ts no longer has an `id: 'template',` line to rewrite");
}
writeFileSync(timeline, next);

// Register: import + array entry in videos/registry.ts.
const registryPath = `${VIDEOS_DIR}registry.ts`;
const registry = readFileSync(registryPath, 'utf8');
const name = id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()).replace(/^(\d)/, 'v$1');
const withImport = registry.replace(
  /(import \{ entry as \w+ \} from '\.\/[^']+';\n)(?!import \{ entry)/,
  `$1import { entry as ${name} } from './${id}';\n`,
);
const withEntry = withImport.replace(
  /\[([^\]]*)\];/,
  (_, list: string) => `[${list.trim().replace(/,$/, '')}, ${name}];`,
);
if (withEntry === registry || !withEntry.includes(`from './${id}'`)) {
  throw new Error('Could not update videos/registry.ts — add the import and entry by hand');
}
writeFileSync(registryPath, withEntry);

console.log(`Created videos/${id}/ and registered it.
Next:
  1. Edit videos/${id}/timeline.ts (scenes, copy, music) — AGENTS.md has the playbook.
  2. npm run check -- ${id}
  3. npm run review -- ${id}     (contact sheet → out/review/${id}/sheet.png)
  4. npm run dev                 (Studio: ${id}, ${id}-scenes/…)
  5. npm run render -- ${id}     (→ out/${id}.mp4)`);
