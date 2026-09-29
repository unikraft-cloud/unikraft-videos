import type React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { EASE, lerp, pop, progress } from '../../design/motion';
import { Mono, SplitText, type Pose } from '../../design/Text';
import { alpha, C, FONT, mix, TERM, TYPE } from '../../design/tokens';
import { formatValue } from './plan';

/** One `[accent]` headline line as staggered words (accent words in brand blue). */
export const AccentLine: React.FC<{
  line: string;
  at: number;
  stagger?: number;
  duration?: number;
  from?: Pose;
  origin?: string;
}> = ({ line, at, stagger = 3, duration = 12, from = { opacity: 0, y: 0.45, blur: 10 }, origin }) => {
  const accents: boolean[] = [];
  line.split(/(\[[^\]]*\])/).forEach((part) => {
    const accent = part.startsWith('[');
    const words = (accent ? part.slice(1, -1) : part).split(/\s+/).filter(Boolean);
    words.forEach(() => accents.push(accent));
  });
  return (
    <SplitText
      text={line.replace(/[[\]]/g, '')}
      by="word"
      at={at}
      stagger={stagger}
      duration={duration}
      from={from}
      unitStyle={(_, i) => ({
        ...(accents[i] ? { color: C.blue400 } : {}),
        ...(origin ? { transformOrigin: origin } : {}),
      })}
    />
  );
};

/** Attack/decay envelope around `at` (the promo's flash curve). */
export const flash = (frame: number, at: number, attack: number, decay: number): number => {
  if (frame < at - attack || frame > at + decay) {
    return 0;
  }
  return frame < at
    ? progress(frame, at - attack, attack, EASE.in)
    : 1 - progress(frame, at, decay, EASE.out);
};

/** Rolling value of a count-up: eased `from` → `value` over [countAt, lockAt]; exact once locked. */
export const countValue = (
  frame: number,
  from: number,
  value: number,
  countAt: number,
  lockAt: number,
): number => {
  if (frame >= lockAt || countAt >= lockAt) {
    return frame >= lockAt ? value : from;
  }
  return interpolate(frame, [countAt, lockAt], [from, value], {
    easing: Easing.bezier(0.3, 0.1, 0.25, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};

/** A number rounded toward `from` at `decimals` (so a count never shows the target early). */
export const shownValue = (v: number, from: number, value: number, decimals: number): number => {
  const k = 10 ** decimals;
  return value >= from ? Math.floor(v * k) / k : Math.ceil(v * k) / k;
};

const RULER_W = 1180;

const niceStep = (raw: number): number => {
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};

/** 0 → `max` instrument ruler with a limit marker (the cold-start readout's). */
const Ruler: React.FC<{
  value: number;
  max: number;
  unit: string;
  limit: string;
  lock: number;
  draw: number;
}> = ({ value, max, unit, limit, lock, draw }) => {
  const major = niceStep(max / 10);
  const minor = major / 4;
  const ticks = Array.from({ length: Math.floor(max / minor + 1e-9) + 1 }, (_, i) => i * minor);
  const majors = ticks.filter((_, i) => i % 4 === 0);
  const labelEvery = majors.length > 6 ? 2 : 1;
  const x = (v: number) => (Math.min(v, max) / max) * RULER_W;
  return (
    <div style={{ position: 'relative', width: RULER_W, height: 118 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 40,
          width: RULER_W * draw,
          height: 10,
          borderRadius: 5,
          background: C.slate800,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 40,
          width: x(value),
          height: 10,
          borderRadius: 5,
          background: `linear-gradient(90deg, ${C.blueDeep}, ${C.blue400})`,
          boxShadow: `0 0 ${16 + 40 * lock}px ${alpha(C.blue400, 0.6 + 0.4 * lock)}`,
        }}
      />
      {ticks.map((t, i) => (
        <div
          key={t}
          style={{
            position: 'absolute',
            left: x(t) - 1,
            top: 60,
            width: 2,
            height: i % 4 === 0 ? 18 : 9,
            background: t <= value ? C.blue200 : C.slate700,
            opacity: draw >= t / max ? 1 : 0,
          }}
        />
      ))}
      {majors
        .filter((_, i) => i % labelEvery === 0 || i === majors.length - 1)
        .map((t) => {
          const last = Math.abs(t - max) < 1e-9;
          return (
            <span
              key={`l${t}`}
              style={{
                position: 'absolute',
                left: x(t),
                top: 84,
                transform: 'translateX(-50%)',
                fontFamily: FONT.mono,
                fontSize: 24,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: last ? C.blue100 : C.slate500,
                opacity: draw >= t / max ? 1 : 0,
                whiteSpace: 'nowrap',
              }}
            >
              {last ? `${formatValue(t)} ${unit}` : formatValue(t)}
            </span>
          );
        })}
      <div
        style={{
          position: 'absolute',
          left: RULER_W - 1,
          top: 4,
          width: 2,
          height: 56,
          backgroundImage: `repeating-linear-gradient(180deg, ${C.blue100} 0 6px, transparent 6px 11px)`,
          opacity: draw,
        }}
      />
      <span
        style={{
          ...TYPE.eyebrow,
          position: 'absolute',
          right: 0,
          top: -30,
          transform: 'translateX(50%)',
          fontSize: 22,
          letterSpacing: '0.12em',
          color: C.blue100,
          opacity: draw,
          whiteSpace: 'nowrap',
        }}
      >
        {limit}
      </span>
      <div
        style={{
          position: 'absolute',
          left: x(value),
          top: 45,
          width: 26 + 10 * lock,
          height: 26 + 10 * lock,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: C.white,
          border: `5px solid ${C.blue400}`,
          boxShadow: `0 0 ${20 + 50 * lock}px ${alpha(C.blue400, 0.9)}`,
          opacity: draw,
        }}
      />
    </div>
  );
};

export type ReadoutProps = {
  /** Frames (scene-local): entrance start, count start, lock. */
  enterAt: number;
  enterDur: number;
  countAt: number;
  lockAt: number;
  value: number;
  from: number;
  decimals: number;
  prefix?: string;
  suffix?: string;
  eyebrow?: string;
  /** Display headline lines (`[accent]`), landing at `headlineAt`. */
  headline?: readonly string[];
  headlineAt?: number;
  caption?: string;
  captionAt?: number;
  /** Instrument ruler 0 → max under the number. */
  scale?: { max: number; unit: string; limit: string };
  /** Push-in length after the lock, frames. */
  holdFrames: number;
};

const TOP = 150;
const BOTTOM = 960;
const EYEBROW_H = 44;
const HEADLINE = 104;

/**
 * The cold-start readout: `IDLE → FIRST BYTE` eyebrow with a status dot, a
 * giant counting number with a glow that pulses while it counts, a white-hot
 * lock with a double shock ring, and optional ruler / headline / caption.
 * Full-frame; renders its own lock flash.
 */
export const Readout: React.FC<ReadoutProps> = (p) => {
  const frame = useCurrentFrame();
  const enter = progress(frame, p.enterAt, p.enterDur, EASE.out);
  const count = countValue(frame, p.from, p.value, p.countAt, p.lockAt);
  const locked = frame >= p.lockAt;
  const value = locked ? p.value : shownValue(count, p.from, p.value, p.decimals);
  const hit = pop(frame, p.lockAt, { damping: 9, stiffness: 240 });
  const numScale = locked ? lerp(1.14, 1, hit) : 1;
  const lock = flash(frame, p.lockAt, 0, 30);
  const counting = frame >= p.countAt && !locked ? 1 : 0;
  const push = lerp(1, 1.05, progress(frame, p.lockAt, p.holdFrames, EASE.linear));
  const glow = 0.5 + 0.2 * counting * Math.abs(Math.sin(frame * 0.9)) + 1.2 * lock + (locked ? 0.3 : 0);

  // Stack geometry: shrink the number until everything fits between the HUD rails.
  const text = formatValue(
    Math.max(Math.abs(p.value), Math.abs(p.from)) * Math.sign(p.value || 1),
    p.decimals,
  );
  const suffixIsUnit = !!p.suffix && /^\p{L}/u.test(p.suffix);
  const suffixK = p.suffix ? (suffixIsUnit ? 0.42 : 0.7) : 0;
  const widthEm =
    text.length * 0.56 + (p.prefix ? 0.45 : 0) + (p.suffix ? p.suffix.length * 0.6 * suffixK + 0.07 : 0);
  const lines = p.headline ?? [];
  const rest =
    EYEBROW_H +
    24 +
    (p.scale ? 36 + 118 : 0) +
    (lines.length ? 40 + lines.length * HEADLINE * 0.95 : 0) +
    (p.caption ? 28 + 40 : 0);
  const size = Math.round(Math.min(420, 1640 / widthEm, BOTTOM - TOP - rest));
  const total = rest + size;
  const top = Math.max(TOP, (1080 - total) / 2 + 10);
  const numTop = top + EYEBROW_H + 24;
  let y = numTop + size;
  const rulerTop = p.scale ? y + 36 : 0;
  y += p.scale ? 36 + 118 : 0;
  const headlineTop = y + 40;
  y += lines.length ? 40 + lines.length * HEADLINE * 0.95 : 0;
  const captionTop = y + 28;
  const ringY = numTop + size * 0.55;

  return (
    <AbsoluteFill
      style={{
        opacity: enter,
        transform: `scale(${lerp(1.5, 1, enter) * push})`,
        filter: enter < 0.98 ? `blur(${(1 - enter) * 18}px)` : undefined,
      }}
    >
      {locked && (
        <div style={{ position: 'absolute', left: 960, top: ringY, width: 2, height: 2 }}>
          {[0, 6].map((d) => {
            const q = progress(frame, p.lockAt + d, 34, EASE.out);
            const r = lerp(560, 1400, q);
            return (
              <div
                key={d}
                style={{
                  position: 'absolute',
                  left: -r,
                  top: -r * 0.62,
                  width: r * 2,
                  height: r * 1.24,
                  borderRadius: '50%',
                  border: `${lerp(6, 1, q)}px solid ${alpha(C.blue400, (1 - q) * (d === 0 ? 0.9 : 0.5))}`,
                  boxShadow: `0 0 40px ${alpha(C.blue400, (1 - q) * 0.5)}`,
                }}
              />
            );
          })}
        </div>
      )}

      {p.eyebrow && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top,
            height: EYEBROW_H,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: locked ? TERM.success : C.blue400,
              boxShadow: `0 0 12px ${locked ? TERM.success : C.blue400}`,
              opacity: locked ? 1 : 0.4 + 0.6 * (Math.floor(frame / 6) % 2),
            }}
          />
          <Mono size={32} color={C.blue100} tracking="0.16em">
            {p.eyebrow}
          </Mono>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: numTop,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'baseline',
          transform: `scale(${numScale})`,
          transformOrigin: '50% 60%',
          whiteSpace: 'nowrap',
        }}
      >
        {p.prefix && (
          <span
            style={{ ...TYPE.display, fontSize: size * 0.62, color: C.slate300, marginRight: size * 0.04 }}
          >
            {p.prefix}
          </span>
        )}
        <span
          style={{
            ...TYPE.display,
            fontSize: size,
            lineHeight: 1,
            letterSpacing: '-0.06em',
            fontVariantNumeric: 'tabular-nums',
            color: mix(C.blue400, '#cfe3ff', lock * 0.8),
            textShadow: `0 0 ${40 * glow}px ${alpha(C.blue400, 0.8)}, 0 0 ${140 * glow}px ${alpha(C.blue400, 0.45)}`,
          }}
        >
          {formatValue(value, p.decimals)}
        </span>
        {p.suffix && (
          <span
            style={{
              ...TYPE.display,
              fontSize: size * suffixK,
              marginLeft: size * (suffixIsUnit ? 0.07 : 0.02),
              color: suffixIsUnit ? C.slate300 : C.blue100,
            }}
          >
            {p.suffix}
          </span>
        )}
      </div>

      {p.scale && (
        <div style={{ position: 'absolute', left: (1920 - RULER_W) / 2, top: rulerTop }}>
          <Ruler
            value={locked ? p.value : count}
            max={p.scale.max}
            unit={p.scale.unit}
            limit={p.scale.limit}
            lock={lock}
            draw={progress(frame, p.countAt - 6, 18, EASE.out)}
          />
        </div>
      )}

      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: headlineTop + i * HEADLINE * 0.95,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ ...TYPE.display, fontSize: HEADLINE, color: C.slate300, whiteSpace: 'nowrap' }}>
            <AccentLine
              line={line}
              at={(p.headlineAt ?? p.lockAt) + i * 4}
              stagger={2}
              from={{ opacity: 0, y: 0.5, blur: 8 }}
            />
          </div>
        </div>
      ))}

      {p.caption && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: captionTop,
            display: 'flex',
            justifyContent: 'center',
            opacity: progress(frame, p.captionAt ?? p.lockAt, 12, EASE.out),
            transform: `translateY(${lerp(14, 0, progress(frame, p.captionAt ?? p.lockAt, 12, EASE.out))}px)`,
          }}
        >
          <Mono size={32} color={C.slate400} tracking="0.12em">
            {p.caption}
          </Mono>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Full-frame additive flash on a lock (radial, screen blend). */
export const LockFlash: React.FC<{ at: number; strength?: number; x?: number; y?: number }> = ({
  at,
  strength = 0.75,
  x = 50,
  y = 46,
}) => {
  const frame = useCurrentFrame();
  const f = flash(frame, at, 0, 12) * strength;
  return f > 0 ? (
    <AbsoluteFill
      style={{
        background: `radial-gradient(50% 45% at ${x}% ${y}%, ${alpha('#9cc6ff', 0.9)} 0%, ${alpha(C.blue400, 0.5)} 45%, transparent 100%)`,
        opacity: f,
        mixBlendMode: 'screen',
      }}
    />
  ) : null;
};
