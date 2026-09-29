import type { IconName } from '../../design/icons-data.ts';
import type { PlanContext, SceneCue, SceneInput } from '../../timeline/define.ts';
import { readBeats, words } from '../../timeline/pacing.ts';
import { recipeScene, sceneBeats, type RecipeOptions } from '../common.ts';

export type RotatorNoun = { text: string; icon: IconName };

export type RotatorProps = {
  /** Line above the noun (`'Build'`). */
  before: string;
  /** 2–8 nouns swapped in on the noun line, each with a use-case icon; the last one holds. */
  nouns: readonly RotatorNoun[];
  /** 1–2 lines after the noun (`['that cold-start in', '10 milliseconds.']`). */
  after: readonly string[];
  /** Mono line decoded under the sentence once the last noun holds (`'Any Dockerfile · No porting'`). */
  tag?: string;
};

/** Beats from the cut to the sentence (with the first noun) landing. */
const LEAD = 0.5;
export const MIN_NOUNS = 2;
export const MAX_NOUNS = 8;
/** Frames the tag decode takes (unscaled; the component scales it by `preset.motion`). */
export const TAG_DECODE = 18;

/**
 * The homepage hero rotator: `before / [noun] / after…` in big type, the noun swapping
 * on the beat grid with a matching icon tile and a `01 / 06` counter, the last noun
 * locking in (punch + underline) and holding so the whole sentence can be read; an
 * optional mono tag decodes under it. Each intermediate noun stays up long enough to
 * read the word itself (its words at `preset.wpm`, in half beats, ≥ ½ beat) — the
 * sentence around it is read once, with the final noun — so slower presets swap slower
 * while every swap stays a snappy ~7-frame move. The first noun also waits a beat for
 * the sentence to land.
 *
 * Marks: `noun0…nounN` (noun `i` swaps in; `noun0` lands with the sentence), `tag`
 * (decode starts; only with a tag), `exit`.
 * Cues: blip on every intermediate swap, hit on the final noun, ticks under the tag.
 */
export const rotator =
  (id: string, props: RotatorProps, options: RecipeOptions = {}): SceneInput =>
  (ctx: PlanContext) => {
    const { before, nouns, after, tag } = props;
    if (!before.trim()) {
      throw new Error(`rotator "${id}": before is empty`);
    }
    if (nouns.length < MIN_NOUNS || nouns.length > MAX_NOUNS) {
      throw new Error(`rotator "${id}": needs ${MIN_NOUNS}–${MAX_NOUNS} nouns (got ${nouns.length})`);
    }
    if (after.length < 1 || after.length > 2 || after.some((l) => !l.trim())) {
      throw new Error(`rotator "${id}": after needs 1–2 non-empty lines`);
    }
    if (tag !== undefined && !tag.trim()) {
      throw new Error(`rotator "${id}": tag is empty (omit it instead)`);
    }
    const { secondsPerBeat, framesPerBeat } = ctx.grid;
    const marks: Record<string, number> = {};
    const cues: SceneCue[] = [];
    let beat = LEAD;
    nouns.forEach((n, i) => {
      marks[`noun${i}`] = beat;
      if (i > 0) {
        cues.push({ at: `noun${i}`, kind: i === nouns.length - 1 ? 'hit' : 'blip' });
      }
      const glance = (words(n.text) * 60) / ctx.preset.wpm / secondsPerBeat;
      beat += Math.max(0.5, Math.ceil(glance * 2) / 2) + (i === 0 ? 1 : 0);
    });
    const final = marks[`noun${nouns.length - 1}`];
    const reads = [{ text: [before, nouns[nouns.length - 1].text, ...after].join(' '), at: final }];
    if (tag) {
      marks.tag = final + 1;
      const decode = Math.ceil(((TAG_DECODE * ctx.preset.motion) / framesPerBeat) * 4) / 4;
      cues.push({ at: 'tag', kind: 'ticks', len: decode });
      reads.push({ text: tag, at: marks.tag + decode });
    }
    // Reads one after another: each starts once it is legible and the previous one has been read.
    const content = reads.reduce((t, r) => Math.max(t, r.at) + readBeats(r.text, ctx), 0);
    return recipeScene(
      'rotator',
      id,
      props,
      { beats: sceneBeats(content, ctx, options), marks, cues, reads },
      options,
    );
  };
