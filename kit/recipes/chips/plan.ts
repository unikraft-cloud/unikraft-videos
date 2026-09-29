import type { IconName } from '../../design/icons-data.ts';
import type { PlanContext, SceneCue, SceneInput } from '../../timeline/define.ts';
import { readBeats } from '../../timeline/pacing.ts';
import { recipeScene, sceneBeats, type RecipeOptions } from '../common.ts';

export type ChipItem = {
  /** The chip / badge title (`'SOC 2 Type II'`, `'On-Prem'`). */
  label: string;
  icon: IconName;
  /** Mono caption under it (`'audited yearly'`). */
  detail?: string;
  /** Badges only: mono eyebrow after the index (`'Audit'` → `01 · Audit`). */
  tag?: string;
};

export type ChipsProps = {
  /** Headline over the row. Wrap words in `[brackets]` for the brand-blue accent. */
  headline: string;
  /** 2–5 items, landing left to right. */
  items: readonly ChipItem[];
  /**
   * Central box the items hang off (the promo's Deploy: Manhattan connectors from the
   * hub down a bus to each chip, which then land as outlined pills). Omit for the
   * promo's Trust layout: the items land as large glowing badges.
   */
  hub?: { label: string; /** Unikraft mark before the label (default true). */ logo?: boolean };
  /** Hub layout only: mono label on the dashed outline around the chips (`'DEPLOY IT'`). */
  group?: string;
  /** Mono line decoded under the row; text before the first ` · ` is lit (`'RUNS ON · BARE METAL'`). */
  footer?: string;
};

/** Beats from the cut to the headline landing. */
const LEAD = 0.5;
export const MIN_ITEMS = 2;
export const MAX_ITEMS = 5;
/** Frames the footer decode takes (unscaled; the component scales it by `preset.motion`). */
export const FOOTER_DECODE = 22;

/** Hub layout: the dashed group the chips sit in (the chips are centred in equal columns). */
export const GROUP = { x: 130, w: 1660 } as const;
/** Smallest chip label size (px) before a label is too long for its column. */
export const CHIP_MIN = 26;
const CHIP_MAX = 34;

/**
 * Chip font size for `n` columns whose longest label is `chars` long. A chip is about
 * `chars × 0.56 + 3.4` font sizes wide (label, icon, gap and padding).
 */
export const chipSize = (n: number, chars: number): number =>
  Math.min(CHIP_MAX, Math.floor((GROUP.w / n - 40) / (chars * 0.56 + 3.4)));

/** Badge layout: badge width and the gap between badges for `n` items. */
export const badgeRow = (n: number): { w: number; gap: number } => {
  const gap = n <= 3 ? 40 : 28;
  return { w: Math.min(500, Math.floor((1920 - 240 - (n - 1) * gap) / n)), gap };
};
/** Badge title size for a badge `w` wide whose title is `chars` long (the planner rejects under 30). */
export const badgeTitleSize = (w: number, chars: number): number =>
  Math.min(58, Math.floor((w - 48) / (chars * 0.55)));

/**
 * Headline + 2–5 items landing one after another: the promo's Trust (compliance
 * badges slamming in with a shockwave, a checker glow and a shine) or, with a `hub`,
 * its Deploy (a hub box with connectors that draw into each chip as it lands). The
 * footer decodes after the last item, then the frame floats until everything has
 * been read and pushes in on the exit.
 *
 * Marks: `head`, `item0…itemN` (each item lands), `footer` (decode starts; only with a
 * footer), `exit`.
 * Cues: impact on `head`; per item a hit when it is ≥ `preset.accentGap` after the
 * previous accent, else a blip (items land every max(½, accentGap/2) beats, so hits and
 * blips alternate); ticks under the footer decode.
 */
export const chips =
  (id: string, props: ChipsProps, options: RecipeOptions = {}): SceneInput =>
  (ctx: PlanContext) => {
    const { items, hub, footer } = props;
    if (!props.headline.trim()) {
      throw new Error(`chips "${id}": headline is empty`);
    }
    if (items.length < MIN_ITEMS || items.length > MAX_ITEMS) {
      throw new Error(`chips "${id}": needs ${MIN_ITEMS}–${MAX_ITEMS} items (got ${items.length})`);
    }
    const longest = Math.max(...items.map((it) => it.label.length));
    if (hub && chipSize(items.length, longest) < CHIP_MIN) {
      throw new Error(
        `chips "${id}": labels up to ${longest} characters don't fit ${items.length} chips — shorten them`,
      );
    }
    if (!hub && badgeTitleSize(badgeRow(items.length).w, longest) < 30) {
      throw new Error(
        `chips "${id}": labels up to ${longest} characters don't fit ${items.length} badges — shorten them`,
      );
    }
    if (footer !== undefined && !footer.trim()) {
      throw new Error(`chips "${id}": footer is empty (omit it instead)`);
    }
    const { accentGap } = ctx.preset;
    const step = Math.max(0.5, accentGap / 2);
    const marks: Record<string, number> = { head: LEAD };
    const cues: SceneCue[] = [{ at: 'head', kind: 'impact' }];
    let lastAccent = LEAD;
    items.forEach((_, i) => {
      const beat = LEAD + 1 + i * step;
      marks[`item${i}`] = beat;
      const hit = beat - lastAccent >= accentGap - 1e-9;
      cues.push({ at: `item${i}`, kind: hit ? 'hit' : 'blip' });
      if (hit) lastAccent = beat;
    });
    const lastItem = marks[`item${items.length - 1}`];
    const reads = [
      { text: props.headline.replace(/[[\]]/g, ''), at: marks.head },
      // The row lands as one group: one read for every label and caption, from the last landing.
      { text: items.map((it) => [it.label, it.detail].filter(Boolean).join(' ')).join(' '), at: lastItem },
    ];
    if (footer) {
      marks.footer = lastItem + 1;
      const decode = Math.ceil(((FOOTER_DECODE * ctx.preset.motion) / ctx.grid.framesPerBeat) * 4) / 4;
      cues.push({ at: 'footer', kind: 'ticks', len: decode });
      reads.push({ text: footer, at: marks.footer + decode });
    }
    // Reads one after another: each starts once it is legible and the previous one has been read.
    const content = reads.reduce((t, r) => Math.max(t, r.at) + readBeats(r.text, ctx), 0);
    return recipeScene(
      'chips',
      id,
      props,
      { beats: sceneBeats(content, ctx, options), marks, cues, reads },
      options,
    );
  };
