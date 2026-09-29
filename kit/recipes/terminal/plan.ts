import type { IconName } from '../../design/icons-data.ts';
import type { PlanContext, Read, SceneCue, SceneInput } from '../../timeline/define.ts';
import { readBeats } from '../../timeline/pacing.ts';
import { recipeScene, sceneBeats, type RecipeOptions } from '../common.ts';
import { statText } from '../stat/plan.ts';
import { plainText } from '../statement/plan.ts';

/**
 * An output line. A plain string prints as-is; the object form picks the
 * hero terminal's glyphs: `comment` (dim `→`), `success` (green `✓`), `output`
 * (plain), with an optional right-hand `value` (`replied in` · `8.4 ms`).
 */
export type TerminalOutput =
  | string
  | { text: string; kind?: 'output' | 'comment' | 'success'; value?: string };

export type TerminalCommand = {
  /** The command, typed after the `$` prompt. */
  cmd: string;
  /** Lines printed after it, one per half beat. */
  output?: readonly TerminalOutput[];
  /**
   * Stepper entry left of the terminal (the promo's `01 · Package` column): lights up while
   * the command types, ticks when its output lands. Give every command a step or none.
   */
  step?: { label: string; caption?: string; icon?: IconName };
};

export type TerminalResult = {
  /** Mono eyebrow over the readout (`idle → first byte`). */
  label: string;
  value: number;
  /** Unit after the number (`ms`). */
  unit: string;
  decimals?: number;
  /** Count start (default 0). */
  from?: number;
  /** Draw a 0 → max instrument ruler with a limit marker at `max`. */
  max?: number;
  /** Ruler limit label (default `limit`). */
  limitLabel?: string;
  /** Display line under the readout; `[brackets]` accent. */
  caption?: string;
};

export type TerminalProps = {
  /** Headline over the terminal; `[brackets]` accent words, `\n` breaks lines (max 2). */
  title?: string;
  /** Window title in the terminal chrome (default `~/sandbox — unikraft`). */
  window?: string;
  commands: readonly TerminalCommand[];
  /**
   * Optional dive: the camera punches into the last output line of the last command
   * and a giant readout counts up to `value`. That line is transient — the readout
   * carries its read — so keep it one short line with a `value` badge.
   */
  result?: TerminalResult;
};

/** Frames per typed character — a fast, legible typist at every tempo. */
export const TYPE_FRAMES_PER_CHAR = 1;
/** Beats from a command finishing to its first output line, and between output lines. */
const OUT_LAG = 0.5;
const OUT_STEP = 0.5;
/** Beats from the cut to the headline landing. */
const LEAD = 0.5;
/** Beats of count-up in the result readout. */
export const COUNT_BEATS = 1.5;

// ── Layout (shared with the component so the planner can refuse what won't fit) ─
export const TERM_FS = 26;
export const CH = TERM_FS * 0.6;
export const ROW = TERM_FS * 1.6;
const S = TERM_FS / 13;
/** Window chrome: border + title bar + body padding (see kit/design/Terminal.tsx). */
export const TERM_CHROME = {
  border: 1.5,
  bar: 79.4,
  padTop: 16 * S,
  padBottom: 20 * S,
  padX: 18 * S,
  gap: 8 * S,
};
export const TITLE_SIZE = 120;
export const TITLE_TOP = 150;
const BOTTOM = 990;

export type TerminalLine = {
  kind: 'command' | 'output' | 'comment' | 'success';
  text: string;
  value?: string;
};

export const outputLine = (o: TerminalOutput): TerminalLine =>
  typeof o === 'string'
    ? { kind: 'output', text: o }
    : { kind: o.kind ?? 'output', text: o.text, value: o.value };

/** All terminal lines in print order, with the command index each belongs to. */
export const terminalLines = (props: TerminalProps): (TerminalLine & { cmd: number; out: number })[] =>
  props.commands.flatMap((c, i) => [
    { kind: 'command' as const, text: c.cmd, cmd: i, out: -1 },
    ...(c.output ?? []).map((o, j) => ({ ...outputLine(o), cmd: i, out: j })),
  ]);

export type TerminalLayout = {
  x: number;
  y: number;
  w: number;
  /** Wrapped rows over all lines, and the window height they need. */
  rows: number;
  height: number;
  steps: boolean;
  titleLines: string[];
  titleSize: number;
};

/** Where the terminal sits: right of a stepper, under the headline, or centred alone. */
export const terminalLayout = (props: TerminalProps): TerminalLayout => {
  const steps = props.commands.some((c) => c.step);
  const titleLines = props.title ? props.title.split('\n') : [];
  const longest = Math.max(1, ...titleLines.map((l) => plainText(l).length));
  const titleSize = Math.round(Math.min(TITLE_SIZE, 1680 / (longest * 0.53)));
  // Right edge stays inside the safe area after the push-in and the 3D tilt.
  const w = steps ? 1000 : 1380;
  const x = steps ? 730 : (1920 - w) / 2;
  const rows = terminalLines(props).reduce((t, l) => t + lineRows(l, w), 0);
  const height =
    2 * TERM_CHROME.border +
    TERM_CHROME.bar +
    TERM_CHROME.padTop +
    TERM_CHROME.padBottom +
    rows * (ROW + 4) +
    8;
  const y = titleLines.length
    ? TITLE_TOP + titleLines.length * titleSize * 0.98 + 56
    : Math.max(TITLE_TOP, (1080 - height) / 2);
  return { x, y, w, rows, height, steps, titleLines, titleSize };
};

/** Rows a line wraps to in a terminal `w` px wide (pre-wrap breaks at spaces). */
export const lineRows = (line: TerminalLine, w: number): number => {
  const glyph = line.kind === 'output' ? 0 : CH + TERM_CHROME.gap;
  const cols = Math.floor((w - 2 * TERM_CHROME.border - 2 * TERM_CHROME.padX - glyph) / CH);
  const text = line.value ? `${line.text}  ${line.value}` : line.text;
  let rows = 1;
  let col = 0;
  for (const word of text.split(' ')) {
    const len = word.length + (col > 0 ? 1 : 0);
    if (col + len > cols && col > 0) {
      rows += Math.ceil(word.length / cols);
      col = word.length % cols;
    } else {
      col += len;
    }
  }
  return rows;
};

/**
 * The hero terminal demo (the promo's ColdStart): a headline beside a tilted
 * terminal that types each command and prints its output, optionally diving
 * into the last line's value for a giant count-up readout.
 *
 * Pacing: each command types while the viewer finishes reading the previous
 * output, so every output group (and the headline) gets its reading budget
 * before the next one lands. Typing is `TYPE_FRAMES_PER_CHAR` frames per char.
 *
 * Marks: `title`, `cmd{i}` (typing starts), `typed{i}`, `out{i}_{j}` (line lands),
 * `dive`, `count`, `lock` (with `result`), `exit`.
 * Cues: `type` over each command, `blip` per output line; with `result`: `whoosh`
 * on the dive, `countUp` under the count, `hit` on the lock.
 */
export const terminal =
  (id: string, props: TerminalProps, options: RecipeOptions = {}): SceneInput =>
  (ctx: PlanContext) => {
    const where = `terminal "${id}"`;
    if (!props.commands.length) {
      throw new Error(`${where}: needs at least one command`);
    }
    const stepped = props.commands.filter((c) => c.step).length;
    if (stepped && stepped !== props.commands.length) {
      throw new Error(`${where}: give every command a \`step\`, or none`);
    }
    if (stepped > 4) {
      throw new Error(`${where}: the stepper holds at most 4 steps`);
    }
    for (const c of props.commands) {
      if (c.step && (c.step.caption ?? '').length > 30) {
        throw new Error(`${where}: step caption "${c.step.caption}" is over 30 characters`);
      }
    }
    const titleLines = props.title ? props.title.split('\n') : [];
    if (titleLines.length > 2) {
      throw new Error(`${where}: title has ${titleLines.length} lines; keep it to 2`);
    }
    const layout = terminalLayout(props);
    if (layout.y + layout.height > BOTTOM) {
      throw new Error(
        `${where}: ${layout.rows} terminal rows don't fit under the headline; shorten or split the scene`,
      );
    }
    const last = props.commands[props.commands.length - 1];
    const diveLine = last.output?.length ? outputLine(last.output[last.output.length - 1]) : null;
    if (props.result) {
      if (!diveLine?.value) {
        throw new Error(
          `${where}: with \`result\`, the last command's last output line needs a \`value\` to dive into`,
        );
      }
      if (lineRows(diveLine, layout.w) > 1) {
        throw new Error(`${where}: the dive line "${diveLine.text}" must fit on one row`);
      }
    }

    const { framesPerBeat } = ctx.grid;
    const marks: Record<string, number> = {};
    const cues: SceneCue[] = [];
    const reads: (Read & { at: number })[] = [];
    // `free`: when the viewer has read everything so far.
    let free = LEAD;
    if (props.title) {
      marks.title = LEAD;
      const text = plainText(props.title.replace(/\n/g, ' '));
      reads.push({ text, at: LEAD, until: props.result ? 'dive' : undefined });
      free = LEAD + readBeats(text, ctx);
    }
    let prev = LEAD;
    props.commands.forEach((c, i) => {
      const typing =
        Math.ceil((Math.max(12, c.cmd.length * TYPE_FRAMES_PER_CHAR) / framesPerBeat) * 4 - 1e-9) / 4;
      const outs = c.output ?? [];
      // Type while the previous copy is being read; print once it has been.
      const start =
        Math.ceil(Math.max(prev + (i === 0 ? 0.5 : OUT_STEP), free - typing - OUT_LAG) * 4 - 1e-9) / 4;
      marks[`cmd${i}`] = start;
      marks[`typed${i}`] = start + typing;
      cues.push({ at: `cmd${i}`, kind: 'type', len: typing });
      prev = start + typing;
      outs.forEach((_, j) => {
        const at = start + typing + OUT_LAG + j * OUT_STEP;
        marks[`out${i}_${j}`] = at;
        cues.push({ at: `out${i}_${j}`, kind: 'blip' });
        prev = at;
      });
      const isDive = props.result && i === props.commands.length - 1;
      if (outs.length && !isDive) {
        const text = outs
          .map((o) => (typeof o === 'string' ? o : [o.text, o.value].filter(Boolean).join(' ')))
          .join(' ');
        reads.push({ text, at: prev, until: props.result ? 'dive' : undefined });
        free = Math.max(free, prev) + readBeats(text, ctx);
      }
    });

    let content = Math.max(free, prev + 1);
    if (props.result) {
      const r = props.result;
      // Hold on the value badge long enough to find it, then dive (every earlier read is done by then).
      marks.dive =
        Math.ceil(Math.max(prev + 0.5 + ctx.preset.react / ctx.grid.secondsPerBeat, free) * 2 - 1e-9) / 2;
      marks.count = marks.dive + 0.5;
      marks.lock = marks.count + COUNT_BEATS;
      cues.push({ at: 'dive', kind: 'whoosh' });
      if ((r.from ?? 0) !== r.value) {
        cues.push({ at: 'count', kind: 'countUp', len: COUNT_BEATS });
      }
      cues.push({ at: 'lock', kind: 'hit' });
      const text = [
        r.label,
        statText({ value: r.value, suffix: r.unit, decimals: r.decimals }),
        r.caption && plainText(r.caption),
      ]
        .filter(Boolean)
        .join(' ');
      reads.push({ text, at: marks.lock });
      content = marks.lock + readBeats(text, ctx);
    }
    const budget = reads.reduce((t, r) => t + readBeats(r.text, ctx), 0);
    content = Math.max(content, LEAD + budget);
    return recipeScene(
      'terminal',
      id,
      props,
      { beats: sceneBeats(content, ctx, options), marks, cues, reads },
      options,
    );
  };
