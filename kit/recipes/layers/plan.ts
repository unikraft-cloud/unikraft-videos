import type { PlanContext, Read, SceneCue, SceneInput } from '../../timeline/define.ts';
import { readBeats } from '../../timeline/pacing.ts';
import { recipeScene, sceneBeats, type RecipeOptions } from '../common.ts';

/** Layer fill: `warn` rose hatch (the weak spot), `neutral` slate, `safe` brand-blue hatch. */
export type LayerTone = 'warn' | 'neutral' | 'safe';

export type StackLayer = { label: string; tone?: LayerTone };

export type LayersStack = {
  /** Card title (`'Containers'`, `'Unikraft Cloud'`). */
  title: string;
  /** Mono size line under the title, `label: value` (`{ label: 'TCB (KVM)', value: '~250K LoC' }`). */
  stat?: { label: string; value: string };
  /** Workload boxes on top of the stack, 1–4 short labels (default `app1…app4`). */
  apps?: readonly string[];
  /** Shared layers inside the trusted-computing-base envelope, top → bottom, 1–3. */
  layers: readonly StackLayer[];
  /** Card colour: `risk` rose, `safe` brand blue. Default: left `risk`, right `safe`. */
  tone?: 'risk' | 'safe';
  /** Short chip popped onto the card's top border when the threat plays on it (`'CVE-2024-21626 · escape'`). */
  badge?: string;
};

export type LayersProps = {
  /**
   * Headline over the two stacks. Wrap words in `[brackets]` to accent them: rose and
   * glitching when the threat escapes, brand blue otherwise (`"Containers [don't contain.]"`).
   */
  headline: string;
  /** Payoff line that replaces the headline once the threat has played. `[brackets]` = brand blue. */
  verdict?: string;
  left: LayersStack;
  right: LayersStack;
  /**
   * The bug: `escape` breaks out of a left workload through the shared layers into every
   * neighbour; `contained` hits its own right-hand boundary and bounces; `both` (default)
   * plays one then the other; `none` keeps the diagram static.
   */
  threat?: 'escape' | 'contained' | 'both' | 'none';
  /** Envelope label (default `'Trusted computing base'`). */
  zone?: string;
  /** Bottom layer under the envelope (default `'Hardware'`). */
  base?: string;
};

/** Beats from the cut to the headline slam. */
const LEAD = 0.5;
export const MAX_APPS = 4;
export const MAX_LAYERS = 3;

export const plainText = (text: string): string => text.replace(/[[\]]/g, '');

export type Word = { word: string; accent: boolean };

/** `"Containers [don't contain.]"` → words with their accent flag (brackets may span words). */
export const accentWords = (text: string): Word[] => {
  let open = false;
  return text
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

const checkStack = (id: string, side: string, s: LayersStack) => {
  if (!s.title.trim()) {
    throw new Error(`layers "${id}": ${side}.title is empty`);
  }
  if (s.layers.length < 1 || s.layers.length > MAX_LAYERS) {
    throw new Error(`layers "${id}": ${side} needs 1–${MAX_LAYERS} layers (got ${s.layers.length})`);
  }
  if (s.apps && (s.apps.length < 1 || s.apps.length > MAX_APPS)) {
    throw new Error(`layers "${id}": ${side}.apps needs 1–${MAX_APPS} labels (got ${s.apps.length})`);
  }
};

/**
 * Side-by-side stack comparison (the promo's Isolation / TCB diagram): the headline
 * slams in, two stack cards rise and draw layer by layer (workloads on top, the
 * trusted-computing-base envelope, the hardware), then a bug breaks out of a left
 * workload through the shared layers into every neighbour (glitch) and a bug on the
 * right hits its own boundary and bounces off (clang, every right workload lights
 * up guarded). The verdict then replaces the headline and the frame holds until read.
 *
 * Marks: `head`, `stacks` (cards rise), `escape` / `contain` (the hits; per `threat`),
 * `verdict` (only with a verdict), `exit`.
 * Cues: impact on `head`, glitch on `escape`, clang on `contain`, whoosh + hit on `verdict`.
 * Accents are spaced ≥ `preset.accentGap`.
 */
export const layers =
  (id: string, props: LayersProps, options: RecipeOptions = {}): SceneInput =>
  (ctx: PlanContext) => {
    if (!props.headline.trim()) {
      throw new Error(`layers "${id}": headline is empty`);
    }
    if (props.verdict !== undefined && !props.verdict.trim()) {
      throw new Error(`layers "${id}": verdict is empty (omit it instead)`);
    }
    checkStack(id, 'left', props.left);
    checkStack(id, 'right', props.right);
    const threat = props.threat ?? 'both';
    // Accent spacing, and never under 2 beats: the cards settle and the bug winds up in between.
    const gap = Math.max(2, ctx.preset.accentGap);

    const marks: Record<string, number> = { head: LEAD, stacks: LEAD + 0.5 };
    const cues: SceneCue[] = [{ at: 'head', kind: 'impact' }];
    let next = marks.stacks + gap;
    let lastHit = marks.head;
    if (threat === 'escape' || threat === 'both') {
      marks.escape = next;
      cues.push({ at: 'escape', kind: 'glitch' });
      lastHit = next;
      next += gap;
    }
    if (threat === 'contained' || threat === 'both') {
      marks.contain = next;
      cues.push({ at: 'contain', kind: 'clang' });
      lastHit = next;
    }

    const headline = plainText(props.headline);
    const stackAt = marks.stacks + 1;
    const reads: (Read & { at: number })[] = [];
    if (props.verdict) {
      // After the last hit has rung out, and never before the headline has been read.
      marks.verdict = Math.ceil(Math.max(lastHit + gap, marks.head + readBeats(headline, ctx)) * 2) / 2;
      cues.push({ at: 'verdict-0.5', kind: 'whoosh' }, { at: 'verdict', kind: 'hit' });
      reads.push({ text: headline, at: marks.head, until: 'verdict' });
    } else {
      reads.push({ text: headline, at: marks.head });
    }
    reads.push({ text: props.left.title, at: stackAt }, { text: props.right.title, at: stackAt });
    if (props.verdict) {
      reads.push({ text: plainText(props.verdict), at: marks.verdict + 0.5 });
    }

    // Reads one after another (each once legible and the previous one read), and the
    // last hit gets a beat and a half to play out before the exit.
    const content = Math.max(
      reads.reduce((t, r) => Math.max(t, r.at) + readBeats(r.text, ctx), 0),
      lastHit + 1.5,
    );
    return recipeScene(
      'layers',
      id,
      props,
      { beats: sceneBeats(content, ctx, options), marks, cues, reads },
      options,
    );
  };
