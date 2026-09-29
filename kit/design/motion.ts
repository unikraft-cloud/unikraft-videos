import { noise2D } from '@remotion/noise';
import { Easing, interpolate, random, spring } from 'remotion';
import { FPS } from '../timeline/grid';

/** Easing curves. `standard`/`balanced` are the site's; the rest are motion-graphics staples. */
export const EASE = {
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  balanced: Easing.bezier(0.45, 0, 0.55, 1),
  /** Expo-like out: fast attack, long settle. The default for entrances. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Quint in: slow start, violent finish. For exits / whips. */
  in: Easing.bezier(0.64, 0, 0.78, 0),
  inOut: Easing.bezier(0.83, 0, 0.17, 1),
  /** Overshoots ~10% then settles. */
  back: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: (t: number) => t,
} as const;

export type EasingFn = (t: number) => number;

/**
 * Motion durations in frames (60 fps) — the promo's vocabulary. Tempo-independent:
 * a slower preset holds longer, it does not animate slower. Recipes read them
 * through `useScene().dur(...)`, which applies `preset.motion`.
 */
export const DUR = {
  /** Cut flash / hit flash decay. */
  flash: 8,
  /** Word swaps, chip pops. */
  snap: 7,
  /** Default entrance (Move, SplitText, pop settle). */
  enter: 12,
  /** Default exit: the last frames of a scene. */
  exit: 8,
  /** Scramble / decode of a label. */
  decode: 14,
  /** Rules, wires and rings drawing on. */
  draw: 26,
} as const;

export type DurName = keyof typeof DUR;

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Eased 0→1 progress of `frame` across [start, start + duration], clamped both ends. */
export const progress = (frame: number, start: number, duration: number, easing: EasingFn = EASE.out): number => {
  if (duration <= 0) {
    return frame >= start ? 1 : 0;
  }
  return interpolate(frame, [start, start + duration], [0, 1], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};

/** Clamped, eased interpolate over two keyframes. */
export const tween = (
  frame: number,
  input: readonly [number, number],
  output: readonly [number, number],
  easing: EasingFn = EASE.out,
): number =>
  interpolate(frame, [input[0], input[1]], [output[0], output[1]], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** Spring that starts at `at`. Defaults are tuned to feel snappy at 60 fps. */
export const pop = (
  frame: number,
  at: number,
  config: Partial<{ damping: number; stiffness: number; mass: number; overshootClamping: boolean }> = {},
): number =>
  spring({
    frame: frame - at,
    fps: FPS,
    config: { damping: 14, stiffness: 220, mass: 0.7, ...config },
  });

/**
 * Decaying camera shake starting at `at`. Returns pixel offsets + degrees.
 * Deterministic (simplex noise), so every render is identical.
 */
export const shake = (
  frame: number,
  at: number,
  duration: number,
  amplitude: number,
  seed = 'shake',
): { x: number; y: number; r: number } => {
  const t = (frame - at) / duration;
  if (t < 0 || t > 1) {
    return { x: 0, y: 0, r: 0 };
  }
  const decay = (1 - t) * (1 - t);
  const f = frame * 0.9;
  return {
    x: noise2D(`${seed}-x`, f, 0) * amplitude * decay,
    y: noise2D(`${seed}-y`, 0, f) * amplitude * decay,
    r: noise2D(`${seed}-r`, f, f) * amplitude * 0.04 * decay,
  };
};

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>[]_-+=*$';

/**
 * Mono "decode" effect. A write head sweeps left → right as `p` goes 0 → 1:
 * characters behind it are final, the `trail` characters at the head flicker
 * through random glyphs (re-rolled every 2 frames), and nothing is shown past
 * the head. Spaces are never scrambled.
 */
export const scramble = (text: string, p: number, frame: number, seed = 'scramble', trail = 4): string => {
  const head = clamp(p) * (text.length + trail);
  const tick = Math.floor(frame / 2);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (i >= head) {
      break;
    }
    const ch = text[i];
    out +=
      i < head - trail || ch === ' ' ? ch : GLYPHS[Math.floor(random(`${seed}-${i}-${tick}`) * GLYPHS.length)];
  }
  return out;
};

/** Number of characters revealed by a typewriter at `charsPerFrame`, starting at `at`. */
export const typed = (frame: number, at: number, length: number, charsPerFrame: number): number =>
  Math.round(clamp((frame - at) * charsPerFrame, 0, length));

/** en-US grouping: 100000 → "100,000". */
export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');
