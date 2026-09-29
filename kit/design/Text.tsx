import type React from 'react';
import { useCurrentFrame } from 'remotion';
import { EASE, type EasingFn, lerp, progress, scramble } from './motion';
import { C, FONT, TYPE } from './tokens';

/** A pose that `Move` animates between. Omitted keys fall back to the rest pose. */
export type Pose = {
  x?: number;
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  blur?: number;
  opacity?: number;
};

const REST: Required<Pose> = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, blur: 0, opacity: 1 };

type MoveProps = {
  /** Frame (scene-local) the entrance starts. */
  at: number;
  duration?: number;
  /** Pose the element enters from. Default: fade + 0.35em rise + blur, like the site's rotator. */
  from?: Pose;
  easing?: EasingFn;
  /** Optional exit start frame. */
  exitAt?: number;
  exitDuration?: number;
  /** Pose the element exits to. */
  to?: Pose;
  exitEasing?: EasingFn;
  /** Units for x/y: px (default) or em. */
  unit?: 'px' | 'em';
  origin?: string;
  inline?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

const DEFAULT_FROM: Pose = { opacity: 0, y: 0.35, blur: 6 };

/**
 * Enter/exit animation between poses. The workhorse for kinetic type and
 * cards: everything is frame-derived, so it scrubs perfectly in the Studio.
 */
export const Move: React.FC<MoveProps> = ({
  at,
  duration = 14,
  from = DEFAULT_FROM,
  easing = EASE.out,
  exitAt,
  exitDuration = 10,
  to,
  exitEasing = EASE.in,
  unit,
  origin = '50% 50%',
  inline = false,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, duration, easing);
  const q = exitAt === undefined ? 0 : progress(frame, exitAt, exitDuration, exitEasing);
  const u = unit ?? (from === DEFAULT_FROM ? 'em' : 'px');
  const pose = (key: keyof Pose) => {
    const entered = lerp(from[key] ?? REST[key], REST[key], p);
    return to ? lerp(entered, to[key] ?? REST[key], q) : entered;
  };
  const blur = pose('blur');
  const scale = pose('scale');
  return (
    <div
      style={{
        display: inline ? 'inline-block' : 'block',
        transform: `translate(${pose('x')}${u}, ${pose('y')}${u}) scale(${scale * pose('scaleX')}, ${scale * pose('scaleY')}) rotate(${pose('rotate')}deg)`,
        transformOrigin: origin,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        opacity: pose('opacity'),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

type SplitProps = {
  text: string;
  at: number;
  /** Frames between consecutive units. */
  stagger?: number;
  by?: 'char' | 'word';
  duration?: number;
  from?: Pose;
  easing?: EasingFn;
  exitAt?: number;
  exitStagger?: number;
  to?: Pose;
  style?: React.CSSProperties;
  /** Per-unit style override (e.g. accent a single word). */
  unitStyle?: (unit: string, index: number) => React.CSSProperties | undefined;
};

/** Staggered per-word / per-character entrance (and optional exit). */
export const SplitText: React.FC<SplitProps> = ({
  text,
  at,
  stagger = 2,
  by = 'char',
  duration = 16,
  from = DEFAULT_FROM,
  easing,
  exitAt,
  exitStagger = 1,
  to,
  style,
  unitStyle,
}) => {
  const units = by === 'word' ? text.split(/(\s+)/) : Array.from(text);
  let visibleIndex = 0;
  return (
    <span style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {units.map((u, i) => {
        if (/^\s+$/.test(u)) {
          return <span key={i}>{u}</span>;
        }
        const idx = visibleIndex++;
        return (
          <Move
            key={i}
            inline
            at={at + idx * stagger}
            duration={duration}
            from={from}
            easing={easing}
            exitAt={exitAt === undefined ? undefined : exitAt + idx * exitStagger}
            to={to}
            style={unitStyle?.(u, idx)}
          >
            {u}
          </Move>
        );
      })}
    </span>
  );
};

/** Mono decode/type-on (see `scramble`). */
export const Scramble: React.FC<{
  text: string;
  at: number;
  duration?: number;
  seed?: string;
  style?: React.CSSProperties;
}> = ({ text, at, duration = 18, seed, style }) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, duration, EASE.linear);
  return <span style={{ whiteSpace: 'pre', ...style }}>{scramble(text, p, frame, seed ?? text)}</span>;
};

/** Site display headline: InterVariable 700, -0.05em tracking, leading ~0.95. */
export const Display: React.FC<{ size: number; color?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({
  size,
  color = C.slate300,
  style,
  children,
}) => (
  <div style={{ ...TYPE.display, fontSize: size, color, ...style }}>{children}</div>
);

/** Mono uppercase label (eyebrows, captions, stat labels). */
export const Mono: React.FC<{
  size?: number;
  color?: string;
  tracking?: string;
  weight?: number;
  upper?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ size = 20, color = C.blue100, tracking = '0.05em', weight = 500, upper = true, style, children }) => (
  <span
    style={{
      fontFamily: FONT.mono,
      fontSize: size,
      color,
      letterSpacing: tracking,
      fontWeight: weight,
      textTransform: upper ? 'uppercase' : 'none',
      ...style,
    }}
  >
    {children}
  </span>
);

/** Brand-blue highlight inside a headline (`text-blue-400`). */
export const Accent: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.blue400 }) => (
  <span style={{ color }}>{children}</span>
);

/**
 * Copy with `[bracketed]` runs in the brand accent: `Build [AI agents] fast.`
 * The recipe convention for "one accent phrase per headline".
 */
export const AccentText: React.FC<{ text: string; color?: string }> = ({ text, color = C.blue400 }) => (
  <>
    {text.split(/(\[[^\]]*\])/).map((part, i) =>
      part.startsWith('[') ? (
        <span key={i} style={{ color }}>
          {part.slice(1, -1)}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )}
  </>
);
