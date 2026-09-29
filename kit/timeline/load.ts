/**
 * Node-side loader for scripts (soundtrack, check, review): imports
 * `videos/<id>/timeline.ts` and returns its `video` export.
 */
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Video } from './define.ts';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const VIDEOS_DIR = `${REPO_ROOT}videos/`;

/** Ids of every video folder that has a timeline. */
export const videoIds = (): string[] =>
  readdirSync(VIDEOS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`${VIDEOS_DIR}${d.name}/timeline.ts`))
    .map((d) => d.name)
    .sort();

export const loadVideo = async (id: string | undefined): Promise<Video> => {
  const ids = videoIds();
  if (!id || !ids.includes(id)) {
    throw new Error(`${id ? `Unknown video "${id}"` : 'No video given'}. Available: ${ids.join(', ')}`);
  }
  // Runtime-selected module: the video id comes from the command line.
  const mod: { video?: Video } = await import(pathToFileURL(`${VIDEOS_DIR}${id}/timeline.ts`).href);
  if (!mod.video) {
    throw new Error(`videos/${id}/timeline.ts must export \`video\` (from defineVideo)`);
  }
  if (mod.video.id !== id) {
    throw new Error(`videos/${id}/timeline.ts defines id "${mod.video.id}" — folder and id must match`);
  }
  return mod.video;
};
