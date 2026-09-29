import type { CueKind, PlanContext, Read, SceneCue, SceneInput } from '../../timeline/define.ts';
import { readBeats } from '../../timeline/pacing.ts';
import { recipeScene, sceneBeats, type RecipeOptions } from '../common.ts';

export type EndCardStat = {
  /** Mono label above the number (`'01 · Cold start'`); chrome, not budgeted as copy. */
  label: string;
  /** The big number (`'<10ms'`). */
  value: string;
  /** Mono line under it (`'all workloads'`). */
  caption: string;
};

export type EndCardCta = {
  label: string;
  /** Default: `'primary'` for the first button, `'secondary'` for the rest. */
  variant?: 'primary' | 'secondary';
};

export type EndCardProps = {
  /**
   * Words that return ticked and implode into the lockup (the promo's `['Fast.', 'Safe.', 'Cheap.']`),
   * one per ½ beat. Omit to open straight on the lockup boom.
   */
  recap?: readonly string[];
  /** Mono `// comment` decoded under the recap (`'// pick all three.'`). Needs `recap`. */
  kicker?: string;
  /** Bracketed stats row under the lockup (1–4 columns), e.g. `SITE_STATS`. Omit for none. */
  stats?: readonly EndCardStat[];
  /** CTA pair (0–3 buttons). Default `DEFAULT_CTAS`; `[]` hides the row. */
  ctas?: readonly EndCardCta[];
  /** Mono URL at the bottom, drawn as `[ url ]`. Default `DEFAULT_URL`; `''` hides it. */
  url?: string;
  /**
   * The video's last scene (default `true`): the card holds still to the final frame and
   * the `exit` mark is ignored, plus one extra beat of hold so the ending breathes. `false`:
   * the card fades out gently over the recipe exit, for a card followed by more scenes.
   */
  final?: boolean;
};

/** The site's CTA pair. */
export const DEFAULT_CTAS: readonly EndCardCta[] = [
  { label: 'Get started for free', variant: 'primary' },
  { label: 'Talk to an engineer', variant: 'secondary' },
];
export const DEFAULT_URL = 'unikraft.com';
/** The site's hero stats (home.yaml `hero.stats`), as used by the promo. */
export const SITE_STATS: readonly EndCardStat[] = [
  { label: '01 · Cold start', value: '<10ms', caption: 'all workloads' },
  { label: '02 · Density', value: '100K+', caption: 'VMs/server' },
  { label: '03 · Cost', value: '10-100×', caption: 'better unit economics' },
];

/** Beats between recap words landing. */
export const RECAP_STEP = 0.5;
/** Frames a recap word takes to land (scaled by `preset.motion`). */
export const RECAP_ENTER = 10;
/** Beats after the last recap word the kicker starts decoding. */
export const KICKER_LEAD = 0.25;
/** Frames per kicker character while decoding (min 12 frames). */
export const KICKER_FRAMES_PER_CHAR = 0.7;
/** Beats the recap takes to implode into the lockup (the reverse swell). */
export const IMPLODE = 0.5;
/** Frames between stats landing, and until one has settled. */
export const STAT_STAGGER = 4;
export const STAT_SETTLE = 14;
/** Frames between CTAs landing, and how long one takes (scaled by `preset.motion`). */
export const CTA_STAGGER = 4;
export const CTA_ENTER = 12;
/** Frames after the last CTA starts that the URL fades in, and how long it fades. */
export const URL_DELAY = 8;
export const URL_FADE = 10;

export const kickerFrames = (kicker: string): number => Math.max(12, kicker.length * KICKER_FRAMES_PER_CHAR);

/**
 * End card (the promo's scene 14): optional recap words land ticked one per ½ beat
 * (with an optional mono kicker), implode on a reverse swell, and the Unikraft
 * lockup booms in under a shockwave; the stats row draws its bracketed grid and the
 * numbers pop, the CTA pair lands with the checker shine, the URL fades in, and the
 * card holds until everything has been read (plus a beat when `final`).
 *
 * Marks: `recap0…recapN` (with `recap`), `kicker`/`kickerDone` (with `kicker`),
 * `implode` (with `recap`), `lockup` (the boom), `wordmark`, `stats` (with stats),
 * `ctas`, `exit` (fade, only when `final: false`).
 * Cues: hit on the first recap word, hit or blip on the rest (hit only when ½ beat
 * clears `preset.accentGap`), type under the kicker, reverse swell into the lockup,
 * boom + ticks on `lockup`, shimmer on `wordmark`, blip on `ctas`.
 */
export const endCard =
  (id: string, props: EndCardProps, options: RecipeOptions = {}): SceneInput =>
  (ctx: PlanContext) => {
    const { recap = [], kicker, stats = [], ctas = DEFAULT_CTAS, url = DEFAULT_URL, final = true } = props;
    if (kicker && !recap.length) {
      throw new Error(`endCard "${id}": a kicker needs recap words to sit under`);
    }
    if (recap.some((w) => !w.trim())) {
      throw new Error(`endCard "${id}": empty recap word`);
    }
    if (recap.length > 4) {
      throw new Error(`endCard "${id}": recap takes at most 4 words (got ${recap.length})`);
    }
    if (stats.length > 4) {
      throw new Error(`endCard "${id}": stats row takes at most 4 columns (got ${stats.length})`);
    }
    if (ctas.length > 3) {
      throw new Error(`endCard "${id}": at most 3 CTAs (got ${ctas.length})`);
    }
    if (ctas.some((c) => !c.label.trim())) {
      throw new Error(`endCard "${id}": CTA with an empty label`);
    }
    const fpb = ctx.grid.framesPerBeat;
    const motion = ctx.preset.motion;
    const marks: Record<string, number> = {};
    const cues: SceneCue[] = [];
    const reads: Read[] = [];
    // Reads one after another: each starts once it is legible and the previous one has been read.
    let readEnd = 0;
    const read = (text: string, at: number, until?: string) => {
      reads.push(until ? { text, at, until } : { text, at });
      readEnd = Math.max(readEnd, at) + readBeats(text, ctx);
    };

    let lastAccent = -Infinity;
    if (recap.length) {
      const soft: CueKind = RECAP_STEP >= ctx.preset.accentGap ? 'hit' : 'blip';
      recap.forEach((_, i) => {
        marks[`recap${i}`] = i * RECAP_STEP;
        cues.push({ at: `recap${i}`, kind: i === 0 ? 'hit' : soft });
      });
      const last = (recap.length - 1) * RECAP_STEP;
      lastAccent = soft === 'hit' ? last : 0;
      read(recap.join(' '), last + Math.round(RECAP_ENTER * motion) / fpb, 'implode');
      if (kicker) {
        marks.kicker = last + KICKER_LEAD;
        marks.kickerDone = marks.kicker + kickerFrames(kicker) / fpb;
        cues.push({ at: 'kicker', kind: 'type', len: Math.ceil((marks.kickerDone - marks.kicker) * 4) / 4 });
        read(kicker, marks.kickerDone, 'implode');
      }
    }
    // The boom lands on a downbeat once the recap has been read and the accent gap after its last hit is clear.
    const lockup = recap.length
      ? Math.ceil(Math.max(readEnd + IMPLODE, lastAccent + ctx.preset.accentGap) - 1e-9)
      : 0;
    if (recap.length) {
      marks.implode = lockup - IMPLODE;
      cues.push({ at: 'implode', kind: 'reverse', len: IMPLODE });
    }
    marks.lockup = lockup;
    marks.wordmark = lockup + 1;
    cues.push(
      { at: 'lockup', kind: 'boom' },
      { at: 'lockup', kind: 'ticks', len: 0.5 },
      { at: 'wordmark', kind: 'shimmer' },
    );
    // The lockup is chrome here (the sting already sold the brand); the copy is stats, CTAs, URL.
    let next = lockup + 1;
    if (stats.length) {
      marks.stats = next;
      read(
        stats.map((s) => `${s.value} ${s.caption}`).join(' · '),
        next + ((stats.length - 1) * STAT_STAGGER + STAT_SETTLE) / fpb,
      );
      next += 0.5;
    }
    marks.ctas = next;
    if (ctas.length) {
      cues.push({ at: 'ctas', kind: 'blip' });
      read(
        ctas.map((c) => c.label).join(' · '),
        next + ((ctas.length - 1) * CTA_STAGGER + Math.round(CTA_ENTER * motion)) / fpb,
      );
    }
    if (url) {
      const delay = ctas.length ? (ctas.length - 1) * CTA_STAGGER + URL_DELAY : 0;
      read(url, next + (delay + Math.round(URL_FADE * motion)) / fpb);
    }
    const content = readEnd + (final ? 1 : 0);
    return recipeScene(
      'endCard',
      id,
      props,
      { beats: sceneBeats(content, ctx, options), marks, cues, reads },
      options,
    );
  };
