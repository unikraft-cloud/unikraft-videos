import type { PlanContext, Read, SceneCue, SceneInput } from '../../timeline/define.ts';
import { readBeats } from '../../timeline/pacing.ts';
import { recipeScene, sceneBeats, type RecipeOptions } from '../common.ts';
import { formatValue } from '../stat/plan.ts';
import { plainText } from '../statement/plan.ts';

export type RaceLane = {
  /** Lane label, left of the track (≤ 24 characters). */
  label: string;
  /** Finish time in `unit`; lanes finish in ascending order. */
  value: number;
  /** Readout at the bar's end (default `<value> <unit>`, e.g. `~10 ms`). */
  display?: string;
  /** The winner: brand-blue bar, burst, `chime` (others get a slate bar and a `blip`). */
  highlight?: boolean;
  /**
   * Still running when the headline slams (the promo's "Traditional VM"): a hatched
   * bar that keeps growing with a spinner, `display` pinned at the track's end.
   */
  pending?: boolean;
};

export type RaceProps = {
  /** Panel eyebrow (default `Cold start — time to a running environment`). */
  title?: string;
  /** Slams in after the finish; `[brackets]` accent (glowing). */
  headline: string;
  /** Mono line under the headline, between two rules. */
  subline?: string;
  /** Unit of the lane values and the clock (default `ms`; `ms` rolls over to seconds). */
  unit?: string;
  /** 2–5 lanes, top to bottom. */
  lanes: readonly RaceLane[];
  /** Small print in the panel corner (default `illustrative · not to scale`; `''` hides it). */
  note?: string;
};

/** Beats from the cut until the lanes have landed. */
const READY = 0.5;
/** Beats the fastest lane runs. */
const FIRST_RUN = 1;

/** A lane's readout text. */
export const laneDisplay = (lane: RaceLane, unit: string): string =>
  lane.display ?? `${formatValue(lane.value)} ${unit}`;

/** Finishing lanes (lane indices) in finishing order. */
export const finishOrder = (lanes: readonly RaceLane[]): number[] =>
  lanes
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => !l.pending)
    .sort((a, b) => a.l.value - b.l.value)
    .map(({ i }) => i);

/**
 * Cold-start race (the promo's Race): lanes run against a simulated clock and
 * finish in order, then the headline slams in over them and holds until read.
 *
 * Pacing: the race starts once the lanes have landed; finishes are spaced so a
 * viewer can follow each one (wider on slower presets); the headline lands only
 * after the lane labels (read while the bars run) and the finish readouts have been read.
 *
 * Marks: `ready` (lanes in), `start` (clock starts), `finish{i}` per finishing lane
 * (i = lane index), `slam`, `exit`.
 * Cues: `whoosh` on the cut, `chime` on a highlighted finish, `blip` on the others,
 * `impact` on the slam.
 */
export const race =
  (id: string, props: RaceProps, options: RecipeOptions = {}): SceneInput =>
  (ctx: PlanContext) => {
    const where = `race "${id}"`;
    const { lanes } = props;
    if (lanes.length < 2 || lanes.length > 5) {
      throw new Error(`${where}: needs 2–5 lanes, got ${lanes.length}`);
    }
    const order = finishOrder(lanes);
    if (!order.length) {
      throw new Error(`${where}: at least one lane must finish (not \`pending\`)`);
    }
    for (const l of lanes) {
      if (!(l.value > 0)) {
        throw new Error(`${where}: lane "${l.label}" needs a value > 0`);
      }
      if (l.label.length > 24) {
        throw new Error(`${where}: lane label "${l.label}" is over 24 characters`);
      }
      if (l.pending && l.value <= lanes[order[order.length - 1]].value) {
        throw new Error(`${where}: pending lane "${l.label}" must be slower than every finishing lane`);
      }
    }
    const unit = props.unit ?? 'ms';
    const { secondsPerBeat } = ctx.grid;
    // Wide enough to see each finish land and glance at its readout.
    const gap = Math.ceil(Math.max(1, (ctx.preset.react + 0.4) / secondsPerBeat) * 2 - 1e-9) / 2;

    const marks: Record<string, number> = { ready: READY, start: READY + 0.5 };
    const cues: SceneCue[] = [{ at: 0, kind: 'whoosh' }];
    const reads: (Read & { at: number })[] = [];
    const labels = [
      ...lanes.map((l) => l.label),
      ...lanes.filter((l) => l.pending).map((l) => laneDisplay(l, unit)),
    ].join(' ');
    reads.push({ text: labels, at: READY, until: 'slam' });

    order.forEach((lane, k) => {
      marks[`finish${lane}`] = marks.start + FIRST_RUN + k * gap;
      cues.push({ at: `finish${lane}`, kind: lanes[lane].highlight ? 'chime' : 'blip' });
    });
    const lastFinish = marks[`finish${order[order.length - 1]}`];
    const values = order.map((i) => laneDisplay(lanes[i], unit)).join(' ');
    reads.push({ text: values, at: lastFinish, until: 'slam' });

    // Labels are read while the bars run; the slam waits for both reads, then the headline holds.
    const slam = Math.max(READY + readBeats(labels, ctx), lastFinish + Math.max(1, readBeats(values, ctx)));
    marks.slam = Math.ceil(slam * 2 - 1e-9) / 2;
    cues.push({ at: 'slam', kind: 'impact' });
    const headline = [plainText(props.headline), props.subline].filter(Boolean).join(' ');
    reads.push({ text: headline, at: marks.slam });

    const budget = reads.reduce((t, r) => t + readBeats(r.text, ctx), 0);
    const content = Math.max(marks.slam + readBeats(headline, ctx), READY + budget);
    return recipeScene(
      'race',
      id,
      props,
      { beats: sceneBeats(content, ctx, options), marks, cues, reads },
      options,
    );
  };
