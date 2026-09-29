import type { PlanContext, Read, SceneCue, SceneInput } from '../../timeline/define.ts';
import { readBeats } from '../../timeline/pacing.ts';
import { recipeScene, sceneBeats, type RecipeOptions } from '../common.ts';
import { plainText } from '../statement/plan.ts';

/**
 * - `none`: the promo's cold-start readout — a giant centred number with shock rings.
 * - `grid`: the Density field — one server box subdividing into ever more tiles while it counts.
 * - `chart`: the Economics cost-over-time chart — drawn left → right, the number lands in its idle gap.
 */
export type StatVisual = 'grid' | 'chart' | 'none';

export type StatProps = {
  /** Mono label for the number (`Idle cost`, `microVMs / server`). */
  eyebrow?: string;
  /** The number it locks on. */
  value: number;
  /** Where the count starts (default 0; `grid` counts log-scale from 1). Equal to `value` = no count, the number pops in. */
  from?: number;
  /** Glyph before the number (`$`). */
  prefix?: string;
  /** Unit / glyph after the number (`ms`, `+`, `×`, `%`). */
  suffix?: string;
  /** Decimal places (default 0). */
  decimals?: number;
  /**
   * The claim, as a display headline. `[brackets]` accent words, `\n` breaks lines.
   * `none`/`grid`: slams in when the number locks. `chart`: the scene's headline, from the start.
   */
  label: string;
  /** Mono line that lands a beat after the lock (`chart`: under the number, in the idle gap). */
  caption?: string;
  /** Supporting visual (default `none`). */
  visual?: StatVisual;
  /** `chart` legend: [the always-on series, the scale-to-zero series]. Default `['Always-on', 'Unikraft Cloud']`. */
  legend?: readonly [string, string];
  /** `grid` box labels: `box` above the field (default `1 server`), `tile` for one tile (default `1 microVM`). */
  grid?: { box?: string; tile?: string };
};

/** Beats from the cut to the count starting (`chart`: to the headline landing). */
const LEAD = 0.5;
/** Count-up length in beats per visual — a musical moment, sized to the bar, not to the copy. */
export const COUNT_BEATS: Record<StatVisual, number> = { none: 2, grid: 3, chart: 3 };

/** `1234.5` → `1,234.5` (en-US grouping, fixed decimals). */
export const formatValue = (value: number, decimals = 0): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** The number as read on screen, prefix and suffix included (`$0`, `100,000+`, `8.4 ms`). */
export const statText = (p: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}): string => {
  const suffix = p.suffix ? (/^\p{L}/u.test(p.suffix) ? ` ${p.suffix}` : p.suffix) : '';
  return `${p.prefix ?? ''}${formatValue(p.value, p.decimals)}${suffix}`;
};

/**
 * Hero number: counts up (with a `countUp` under it) and locks with a `hit`,
 * then the claim slams in and holds until read. `visual` picks the promo scene
 * it is drawn over (see `StatVisual`).
 *
 * Marks: `count` (count starts), `lock` (number locks), `label` (headline in),
 * `caption` (if any), `exit`.
 * Cues: `countUp` over count → lock (only when `from !== value`), `hit` on the lock.
 */
export const stat =
  (id: string, props: StatProps, options: RecipeOptions = {}): SceneInput =>
  (ctx: PlanContext) => {
    const visual = props.visual ?? 'none';
    if (!Number.isFinite(props.value)) {
      throw new Error(`stat "${id}": value must be a finite number`);
    }
    if (!props.label.trim()) {
      throw new Error(`stat "${id}": needs a label`);
    }
    const lines = props.label.split('\n');
    if (lines.length > 2) {
      throw new Error(`stat "${id}": label has ${lines.length} lines; keep it to 2`);
    }
    if (visual === 'chart' && lines.length > 1) {
      throw new Error(`stat "${id}": the chart visual takes a one-line label`);
    }
    if (visual === 'grid' && !(props.value >= 1)) {
      throw new Error(`stat "${id}": the grid visual needs value ≥ 1 (tiles)`);
    }
    const from = props.from ?? (visual === 'grid' ? 1 : 0);
    const counts = from !== props.value;
    const label = plainText(props.label.replace(/\n/g, ' '));
    const number = [props.eyebrow, statText(props)].filter(Boolean).join(' ');

    const marks: Record<string, number> = {};
    const cues: SceneCue[] = [];
    const reads: Read[] = [];
    if (visual === 'chart') {
      // Headline first; the chart draws while it is read; the number lands in the idle gap.
      marks.label = LEAD;
      reads.push({ text: label, at: 'label' });
      // On a half beat, once the headline has been read.
      marks.lock = Math.ceil(Math.max(COUNT_BEATS.chart, readBeats(label, ctx)) * 2 - 1e-9) / 2 + LEAD;
      marks.count = counts ? marks.lock - COUNT_BEATS.chart / 2 : marks.lock;
      reads.push({ text: [number, props.caption].filter(Boolean).join(' '), at: 'lock' });
      if (props.caption) {
        marks.caption = marks.lock;
      }
    } else {
      marks.count = LEAD;
      marks.lock = LEAD + COUNT_BEATS[visual];
      marks.label = marks.lock;
      reads.push({ text: `${number} ${label}`, at: 'label' });
      if (props.caption) {
        marks.caption = marks.lock + 1;
        reads.push({ text: props.caption, at: 'caption' });
      }
    }
    if (counts) {
      cues.push({ at: 'count', kind: 'countUp', len: marks.lock - marks.count });
    }
    cues.push({ at: 'lock', kind: 'hit' });

    // Long enough for every read's budget from where it lands, and for all reads back to back.
    const budget = reads.reduce((t, r) => t + readBeats(r.text, ctx), 0);
    const content = Math.max(
      LEAD + budget,
      ...reads.map((r) => marks[r.at as string] + readBeats(r.text, ctx)),
    );
    return recipeScene(
      'stat',
      id,
      props,
      { beats: sceneBeats(content, ctx, options), marks, cues, reads },
      options,
    );
  };
