/**
 * Shared planner plumbing for recipes. Pure (plain Node loads timelines).
 *
 * A recipe is two files:
 *   <name>/plan.ts   `<name>(id, props, options?)` → a `SceneInput` planner: sizes the
 *                    scene for the preset and returns its marks, cues and reads.
 *   <Name>.tsx       the component; reads its props and marks via `useScene()`.
 * and one line in kit/recipes/index.ts.
 */
import type { PlanContext, SceneCue, SceneSpec } from '../timeline/define.ts';
import { DUR } from '../timeline/durations.ts';
import { snapBeats } from '../timeline/pacing.ts';

export type RecipeOptions = {
  /** HUD chapter (1-based); omit to hide the HUD. */
  chapter?: number | null;
  /** Extra beats of dwell before the exit (added before snapping). */
  hold?: number;
  /** Fixed length in beats instead of the planned one (the pacing check still applies). */
  beats?: number;
  /** Cues on top of the recipe's own, e.g. `{ at: 'exit-1', kind: 'riser', len: 1 }`. */
  cues?: readonly SceneCue[];
};

/** Beats the exit (`DUR.exit`, scaled by the preset) takes; `defineVideo` puts the `exit` mark this far before the end. */
export const exitBeats = ({ preset, grid }: PlanContext): number =>
  (DUR.exit * preset.motion) / grid.framesPerBeat;

/**
 * Final scene length: the content length (last read's budget included) plus
 * `hold`, snapped up to the preset — unless `options.beats` fixes it. The exit
 * plays inside the last `exitBeats` of that; copy is still legible while it starts.
 */
export const sceneBeats = (content: number, ctx: PlanContext, options: RecipeOptions): number =>
  options.beats ?? snapBeats(content + (options.hold ?? 0), ctx);

/** Assemble the spec: chapter from options, `options.cues` appended (they may reference any mark, incl. `exit`). */
export const recipeScene = <P>(
  recipe: string,
  id: string,
  props: P,
  plan: Omit<SceneSpec, 'id' | 'recipe' | 'props' | 'chapter'>,
  options: RecipeOptions,
): SceneSpec => ({
  id,
  recipe,
  props,
  chapter: options.chapter ?? null,
  ...plan,
  cues: [...(plan.cues ?? []), ...(options.cues ?? [])],
});
