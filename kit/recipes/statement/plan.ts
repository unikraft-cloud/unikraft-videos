import type { PlanContext, Read, SceneCue, SceneInput } from '../../timeline/define.ts';
import { readBeats } from '../../timeline/pacing.ts';
import { recipeScene, sceneBeats, type RecipeOptions } from '../common.ts';

export type StatementProps = {
  /** Mono eyebrow above the headline (`[01] The tension` style). */
  eyebrow?: string;
  /** Headline lines, one landing per beat. Wrap words in `[brackets]` for the brand-blue accent. */
  lines: readonly string[];
  /** Mono `// comment` typed on a beat after the last line. */
  kicker?: string;
  /** Tick a brand checkbox next to each line as it lands (end-card payoff). */
  checks?: boolean;
  /** Headline size in px; default fits the longest line (max 200). */
  size?: number;
};

/** Beats from the cut to the first line landing. */
const LEAD = 0.5;
/** Frames per kicker character while typing. */
export const KICKER_FRAMES_PER_CHAR = 1.6;

export const plainText = (line: string): string => line.replace(/[[\]]/g, '');

/**
 * Kinetic headline (the promo's Hook / EndCard type): lines slam in one per
 * beat with a light sweep, an optional mono kicker types underneath, then the
 * frame holds until everything has been read.
 *
 * Marks: `line0…lineN`, `kicker` (typing starts), `kickerDone`, `exit`.
 * Cues: impact on the first line, hit on the rest, type under the kicker.
 */
export const statement =
  (id: string, props: StatementProps, options: RecipeOptions = {}): SceneInput =>
  (ctx: PlanContext) => {
    if (!props.lines.length) {
      throw new Error(`statement "${id}": needs at least one line`);
    }
    const marks: Record<string, number> = {};
    const cues: SceneCue[] = [];
    const reads: Read[] = [];
    props.lines.forEach((_, i) => {
      marks[`line${i}`] = LEAD + i;
      cues.push({ at: `line${i}`, kind: i === 0 ? 'impact' : 'hit' });
    });
    let last = LEAD + props.lines.length - 1;
    // One read for the headline, budgeted from its last line (the eyebrow is chrome, not copy).
    reads.push({ text: props.lines.map(plainText).join(' '), at: `line${props.lines.length - 1}` });
    if (props.kicker) {
      const typing =
        Math.ceil(((props.kicker.length * KICKER_FRAMES_PER_CHAR) / ctx.grid.framesPerBeat) * 4) / 4;
      marks.kicker = last + 1;
      marks.kickerDone = last + 1 + typing;
      cues.push({ at: 'kicker', kind: 'type', len: typing });
      reads.push({ text: props.kicker, at: 'kickerDone' });
      last = marks.kickerDone;
    }
    // Long enough for the last read's budget and for every read back to back.
    const budget = reads.reduce((t, r) => t + readBeats(r.text, ctx), 0);
    const content = Math.max(last + readBeats(reads[reads.length - 1].text, ctx), LEAD + budget);
    return recipeScene(
      'statement',
      id,
      props,
      { beats: sceneBeats(content, ctx, options), marks, cues, reads },
      options,
    );
  };
