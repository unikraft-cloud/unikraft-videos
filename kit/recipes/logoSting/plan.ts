import { WORDMARK_LETTERS } from '../../brand/logo-data.ts';
import type { PlanContext, SceneCue, SceneInput } from '../../timeline/define.ts';
import { readBeats } from '../../timeline/pacing.ts';
import { recipeScene, sceneBeats, type RecipeOptions } from '../common.ts';

export type LogoStingProps = {
  /**
   * Title line under the lockup, words landing one after another. Wrap words in
   * `[brackets]` for the brand-blue accent (`'The [millisecond] compute layer.'`).
   * Omit for a lockup-only sting (the lockup then sits dead centre).
   */
  tagline?: string;
  /** Mono line under the tagline, drawn as `[ caption ]` (`'Unikraft Cloud · Linux-based microVMs'`). */
  caption?: string;
  /**
   * Open on the brand checker field dissolving outward from the mark (default `true`). Picks up a
   * previous scene that ends on a checker (the promo's hook); from anything else it reads as a hard
   * cut flash. `false`: open on black, the boom lands with a short blue flash instead.
   */
  checker?: boolean;
};

/** Longest tagline, in characters, that still sits on one line at a readable size. */
export const TAGLINE_MAX = 52;
/** Frames between tagline words landing (unscaled, like the promo's stagger). */
export const TAGLINE_STAGGER = 3;
/** Frames one tagline word takes to land (scaled by `preset.motion`). */
export const TAGLINE_ENTER = 14;
/** Frames after `tagline` the caption starts fading in (when there is a tagline) and how long it fades. */
export const CAPTION_DELAY = 10;
export const CAPTION_FADE = 12;
/** Frames after `wordmark` the letters start rising (Logo `lettersDelay`, relative to the slide). */
export const LETTERS_DELAY = 2;
/** Frames from `wordmark` until the last letter has risen (Logo: 2 frames per letter + 16). */
export const LETTERS_LAND = LETTERS_DELAY + (WORDMARK_LETTERS.length - 1) * 2 + 16;

export type TaglineWord = { word: string; accent: boolean };

/** `'The [millisecond] compute layer.'` → words with their accent flag (brackets may span words). */
export const taglineWords = (tagline: string): TaglineWord[] => {
  let open = false;
  return tagline
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const starts = raw.startsWith('[');
      const accent = open || starts;
      if (starts) open = true;
      if (raw.endsWith(']')) open = false;
      return { word: raw.replace(/[[\]]/g, ''), accent };
    });
};

/**
 * Logo sting (the promo's scene 02): the checker field dissolves outward while the
 * mark assembles stripe by stripe under a shockwave, the mark slides left as the
 * "Unikraft" wordmark rises in, the optional tagline lands word by word with a mono
 * caption under it, and a light sweep crosses the lockup. The frame then drifts in
 * until everything has been read and leans forward into the next scene (exit: push
 * in + blur + fade). Starts cold from any previous scene.
 *
 * Marks: `assemble` (0, the boom), `wordmark` (1), `tagline` (2, copy lands; only with a
 * tagline or caption), `sweep`, `exit`.
 * Cues: boom + ticks (½ beat) on `assemble`, shimmer on `wordmark`. Add a riser into
 * the next scene with `options.cues: [{ at: 'exit-1', kind: 'riser', len: 1 }]`.
 */
export const logoSting =
  (id: string, props: LogoStingProps, options: RecipeOptions = {}): SceneInput =>
  (ctx: PlanContext) => {
    const { tagline, caption } = props;
    if (tagline !== undefined && !tagline.trim()) {
      throw new Error(`logoSting "${id}": tagline is empty (omit it for a lockup-only sting)`);
    }
    if (tagline && tagline.replace(/[[\]]/g, '').length > TAGLINE_MAX) {
      throw new Error(
        `logoSting "${id}": tagline is over ${TAGLINE_MAX} characters — keep a sting to one short line`,
      );
    }
    if (caption !== undefined && !caption.trim()) {
      throw new Error(`logoSting "${id}": caption is empty (omit it instead)`);
    }
    const fpb = ctx.grid.framesPerBeat;
    const marks: Record<string, number> = { assemble: 0, wordmark: 1, sweep: 2.25 };
    const cues: SceneCue[] = [
      { at: 'assemble', kind: 'boom' },
      { at: 'assemble', kind: 'ticks', len: 0.5 },
      { at: 'wordmark', kind: 'shimmer' },
    ];
    // The brand itself is the first read: the viewer registers the lockup before the copy.
    const reads: { text: string; at: number }[] = [
      { text: 'Unikraft', at: marks.wordmark + LETTERS_LAND / fpb },
    ];
    if (tagline || caption) {
      marks.tagline = 2;
    }
    if (tagline) {
      const n = taglineWords(tagline).length;
      const land = (n - 1) * TAGLINE_STAGGER + Math.round(TAGLINE_ENTER * ctx.preset.motion);
      reads.push({ text: tagline.replace(/[[\]]/g, ''), at: marks.tagline + land / fpb });
    }
    if (caption) {
      const land = (tagline ? CAPTION_DELAY : 0) + Math.round(CAPTION_FADE * ctx.preset.motion);
      reads.push({ text: caption, at: marks.tagline + land / fpb });
    }
    // Reads one after another: each starts once it is legible and the previous one has been read.
    const content = reads.reduce((t, r) => Math.max(t, r.at) + readBeats(r.text, ctx), 0);
    return recipeScene(
      'logoSting',
      id,
      props,
      { beats: sceneBeats(content, ctx, options), marks, cues, reads },
      options,
    );
  };
