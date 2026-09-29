import { noise2D } from '@remotion/noise';
import type React from 'react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../design/Backdrop';
import { Chip } from '../../design/Chip';
import { ICONS } from '../../design/icons-data';
import { clamp, EASE, lerp, pop, progress, shake } from '../../design/motion';
import { Display, Mono } from '../../design/Text';
import { alpha, C, FONT, mix, TYPE } from '../../design/tokens';
import { useScene } from '../../video/SceneContext';
import { formatValue, type StatProps } from './plan';
import { AccentLine, countValue, flash, LockFlash, Readout, shownValue } from './Readout';

type Timing = {
  frame: number;
  count: number;
  lock: number;
  exit: number;
  exitDur: number;
  frames: number;
  amp: number;
};

const useTiming = (): Timing & { props: StatProps; captionAt: number } => {
  const frame = useCurrentFrame();
  const { props, at, dur, frames, video } = useScene<StatProps>();
  return {
    props,
    frame,
    count: at('count'),
    lock: at('lock'),
    captionAt: props.caption ? at('caption') : at('lock'),
    exit: at('exit'),
    exitDur: dur('exit'),
    frames,
    amp: video.preset.shake,
  };
};

// ── none: the cold-start readout ────────────────────────────────────────────

const StatReadout: React.FC = () => {
  const { props, frame, count, lock, captionAt, exit, exitDur, frames, amp } = useTiming();
  const from = props.from ?? 0;
  const out = progress(frame, exit, exitDur, EASE.in);
  const s = shake(frame, lock, 22, 18 * amp, 'stat-lock');
  return (
    <AbsoluteFill style={{ backgroundColor: C.black, overflow: 'hidden' }}>
      <Backdrop
        variant="tintC"
        aura={1.4 + 1.6 * flash(frame, lock, 0, 40)}
        grid={0.05}
        gridSize={64}
        gridOffset={{ x: -frame * 0.6, y: frame * 1.2 }}
        vignette={0.6}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${s.x + lerp(0, -520, out)}px, ${s.y}px) rotate(${s.r}deg) scale(${lerp(1, 1.25, out)}, ${lerp(1, 1.1, out)})`,
          filter: out > 0.01 ? `blur(${out * 24}px)` : undefined,
          opacity: 1 - out * 0.9,
        }}
      >
        <Readout
          enterAt={-4}
          enterDur={16}
          countAt={count}
          lockAt={lock}
          value={props.value}
          from={from}
          decimals={props.decimals ?? 0}
          prefix={props.prefix}
          suffix={props.suffix}
          eyebrow={props.eyebrow}
          headline={props.label.split('\n')}
          headlineAt={lock}
          caption={props.caption}
          captionAt={captionAt}
          holdFrames={frames - lock}
        />
      </AbsoluteFill>
      <LockFlash at={lock} />
    </AbsoluteFill>
  );
};

// ── grid: the Density field ─────────────────────────────────────────────────

const BOX_CX = 520;
const BOX_CY = 572;
const FIELD = 600;
const PAD = 24;
const OUTER = FIELD + PAD * 2;
const DPR = 2;
const A = FIELD * DPR;
const COL_X = 960;
const COL_W = 840;
/** Densest grid the canvas draws (320² = 102,400 tiles). */
const MAX_SIDE = 320;

type Split = { at: number; n: number; dur: number };

/**
 * Split schedule over count → lock: tiles double per side on even steps while
 * they are big (≤ 32 per side), then cascade through the fine grids into the
 * final side on the lock — the promo's 8th-note splits, generalised.
 */
const makeSplits = (value: number, count: number, lock: number): { splits: Split[]; hits: number[] } => {
  const side = clamp(Math.round(Math.sqrt(value)), 1, MAX_SIDE);
  const sides: number[] = [];
  for (let n = 2; n < side; n *= 2) {
    sides.push(n);
  }
  sides.push(side);
  const big = sides.filter((n, i) => n <= 32 && i < sides.length - 1).length;
  const small = sides.length - big;
  const span = lock - count;
  const step = span / Math.max(1, big);
  const splits: Split[] = [{ at: 0, n: 1, dur: 0 }];
  sides.forEach((n, i) => {
    let at: number;
    if (i < big) {
      at = small > 0 ? count + i * step : count + (i * span) / Math.max(1, sides.length - 1);
    } else {
      const j = i - big + 1;
      at = count + (big - 1) * step + (j * (big > 0 ? step : span)) / small;
    }
    const last = i === sides.length - 1;
    const d = i < big ? Math.min(11, step * 0.75) : Math.max(3, (step / small) * 0.9);
    splits.push({ at: last ? lock : at, n, dur: last ? 0 : d });
  });
  return { splits, hits: splits.slice(1, 1 + big).map((s) => s.at) };
};

const splitIndexAt = (splits: readonly Split[], frame: number): number => {
  let k = 0;
  splits.forEach((s, i) => {
    if (frame >= s.at) {
      k = i;
    }
  });
  return k;
};

/** Tile count shown while splitting: rolls log-scale from the previous grid to the new one. */
const counterAt = (splits: readonly Split[], frame: number, value: number): number => {
  const k = splitIndexAt(splits, frame);
  if (k === splits.length - 1) {
    return value;
  }
  if (k === 0) {
    return 1;
  }
  const prev = splits[k - 1].n ** 2;
  const cur = Math.min(value, splits[k].n ** 2);
  const roll = Math.min(12, splits[k + 1].at - splits[k].at);
  return Math.round(
    Math.exp(lerp(Math.log(prev), Math.log(cur), progress(frame, splits[k].at, roll, EASE.out))),
  );
};

const hash = (a: number, b: number, c: number): number => {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const BUCKETS = 14;
const PALETTE: string[] = Array.from({ length: BUCKETS }, (_, b) => {
  const t = b / (BUCKETS - 1);
  if (t < 0.55) {
    return mix('#071a3d', C.blue400, t / 0.55);
  }
  if (t < 0.85) {
    return mix(C.blue400, C.blue100, (t - 0.55) / 0.3);
  }
  return mix(C.blue100, '#bfdbfe', (t - 0.85) / 0.15);
});

const ICON_PATHS = Array.from(
  ICONS['solar:compass-square-bold-duotone'].body.matchAll(/<path d="([^"]+)"( opacity="([^"]+)")?/g),
).map((m) => ({ d: m[1], opacity: m[3] ? Number(m[3]) : 1 }));

type Rect = { x: number; y: number; w: number; r: number };

const tileRect = (n: number, i: number, j: number): Rect => {
  const pitch = A / n;
  // Sub-6px tiles go gapless: a 1px gutter at this pitch aliases into moiré once downsampled.
  const g = pitch >= 16 ? Math.min(64, Math.max(3, pitch * 0.1)) : pitch >= 6 ? 2 : 0;
  return {
    x: i * pitch + g / 2,
    y: j * pitch + g / 2,
    w: pitch - g,
    r: pitch >= 16 ? Math.min(pitch * 0.16, 40) : 0,
  };
};

/** Brightness 0..~1.6 of tile (i, j): idle shimmer, request bursts, a ripple per split, checker lock + sweep. */
const brightness = (
  frame: number,
  split: Split,
  lock: number,
  cascadeAt: number,
  i: number,
  j: number,
): number => {
  const { n, at } = split;
  let v = 0.3 + 0.42 * hash(i, j, n);
  const slot = Math.floor((frame + hash(j + 7, i + 3, n * 13) * 40) / 6);
  const act = hash(i * 31 + slot, j * 17, n + 5);
  if (act > 0.9) {
    v += 0.55 * (act - 0.9) * 10;
  }
  const cx = (i + 0.5) / n - 0.5;
  const cy = (j + 0.5) / n - 0.5;
  const d = Math.sqrt(cx * cx + cy * cy) * 1.41;
  const travel = at >= lock ? 14 : at > cascadeAt ? 9 : 11;
  const width = n >= 64 ? 2.5 : 4;
  const since = frame - at - d * travel;
  if (since >= 0 && since < width) {
    const k = 1 - since / width;
    v += (n >= 64 ? 0.5 : 0.75) * k * k;
  }
  if (at >= lock && n >= 8) {
    if (((i >> 2) + (j >> 2)) & 1) {
      v *= 1 - 0.5 * progress(frame, lock, 10, EASE.out);
    }
    const u = (i + (n - j)) / (2 * n);
    const ds = Math.abs(u - lerp(-0.25, 1.25, progress(frame, lock + 4, 24, EASE.inOut)));
    if (ds < 0.08) {
      v += 0.55 * (1 - ds / 0.08);
    }
  }
  return v;
};

const Field: React.FC<{ frame: number; splits: readonly Split[]; lock: number; cascadeAt: number }> = ({
  frame,
  splits,
  lock,
  cascadeAt,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const icon = useMemo(() => ICON_PATHS.map((p) => ({ path: new Path2D(p.d), opacity: p.opacity })), []);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, A, A);
    const k = splitIndexAt(splits, frame);
    const split = splits[k];
    const parent = k > 0 ? splits[k - 1] : null;
    const e = split.dur > 0 ? progress(frame, split.at, split.dur, EASE.out) : 1;
    const { n } = split;
    const ratio = parent ? n / parent.n : 1;
    const animating = parent !== null && e < 1 && Number.isInteger(ratio);
    const rectOf = (i: number, j: number): Rect => {
      const own = tileRect(n, i, j);
      if (!animating || !parent) {
        return own;
      }
      const par = tileRect(parent.n, Math.floor(i / ratio), Math.floor(j / ratio));
      return {
        x: lerp(par.x, own.x, e),
        y: lerp(par.y, own.y, e),
        w: lerp(par.w, own.w, e),
        r: lerp(par.r, own.r, e),
      };
    };

    if (n <= 16) {
      // Big tiles: rounded microVM cards with the site's VM icon.
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const rc = rectOf(i, j);
          const v = clamp(brightness(frame, split, lock, cascadeAt, i, j), 0, 1.6);
          const glow = n <= 2 ? 1 : n <= 4 ? 0.6 : 0.3;
          ctx.save();
          ctx.shadowColor = alpha(C.blue400, clamp(0.35 + 0.4 * v, 0, 1));
          ctx.shadowBlur = (n === 1 ? 90 : 60 / n + 10) * glow * (0.6 + v * 0.6);
          const fill = ctx.createLinearGradient(rc.x, rc.y, rc.x, rc.y + rc.w);
          fill.addColorStop(0, alpha(C.blue400, 0.1 + 0.16 * Math.min(1, v)));
          fill.addColorStop(1, alpha(C.blue400, 0.03 + 0.08 * Math.min(1, v)));
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.roundRect(rc.x, rc.y, rc.w, rc.w, rc.r);
          ctx.fill();
          ctx.restore();
          ctx.lineWidth = Math.max(1.5, Math.min(4, rc.w / 60));
          ctx.strokeStyle = alpha(
            mix(C.blue400, C.blue100, clamp(v - 0.5, 0, 1)),
            clamp(0.45 + 0.45 * v, 0, 1),
          );
          ctx.beginPath();
          ctx.roundRect(rc.x, rc.y, rc.w, rc.w, rc.r);
          ctx.stroke();
          const size = rc.w * (n === 1 ? 0.3 : 0.46);
          if (size >= 14) {
            ctx.save();
            ctx.translate(rc.x + (rc.w - size) / 2, rc.y + (rc.w - size) / 2);
            ctx.scale(size / 24, size / 24);
            ctx.fillStyle = mix(C.blue400, C.blue100, clamp(v - 0.35, 0, 1));
            for (const p of icon) {
              ctx.globalAlpha = p.opacity;
              ctx.fill(p.path);
            }
            ctx.restore();
          }
        }
      }
    } else {
      // Dense tiles: batch by brightness bucket (one fill per bucket).
      const paths = Array.from({ length: BUCKETS }, () => new Path2D());
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const rc = rectOf(i, j);
          const v = brightness(frame, split, lock, cascadeAt, i, j);
          const b = Math.min(BUCKETS - 1, Math.max(0, Math.round(v * (BUCKETS - 1))));
          if (rc.r > 0.5) {
            paths[b].roundRect(rc.x, rc.y, rc.w, rc.w, rc.r);
          } else {
            paths[b].rect(
              Math.round(rc.x),
              Math.round(rc.y),
              Math.max(1, Math.round(rc.w)),
              Math.max(1, Math.round(rc.w)),
            );
          }
        }
      }
      for (let b = 0; b < BUCKETS; b++) {
        ctx.fillStyle = PALETTE[b];
        ctx.fill(paths[b]);
      }
    }

    // Split flash: a quick additive wash over the whole field.
    const since = frame - split.at;
    if (k > 0 && since >= 0 && since < 7) {
      const f = 1 - since / 7;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = alpha(C.blue100, (split.at >= lock ? 0.45 : 0.22) * f * f);
      ctx.fillRect(0, 0, A, A);
      ctx.restore();
    }
  }, [frame, icon, splits, lock, cascadeAt]);

  return (
    <canvas
      ref={ref}
      width={A}
      height={A}
      style={{ position: 'absolute', left: PAD, top: PAD, width: FIELD, height: FIELD }}
    />
  );
};

const METER_W = 760;
const SEGMENTS = 40;

const decadeLabel = (d: number): string =>
  d >= 6 ? `${10 ** (d - 6)}M` : d >= 3 ? `${10 ** (d - 3)}K` : `${10 ** d}`;

/** Log-scale segment meter, 1 → the value's decade. */
const Meter: React.FC<{ value: number; decades: number; lock: number }> = ({ value, decades, lock }) => {
  const fill = clamp(Math.log10(Math.max(1, value)) / decades);
  const lit = fill * SEGMENTS;
  const segW = METER_W / SEGMENTS;
  return (
    <div style={{ position: 'relative', width: METER_W, height: 66 }}>
      {Array.from({ length: SEGMENTS }, (_, s) => {
        const on = s < Math.floor(lit);
        const head = s === Math.floor(lit) && fill < 1;
        return (
          <div
            key={s}
            style={{
              position: 'absolute',
              left: s * segW,
              top: 0,
              width: segW - 4,
              height: 22,
              borderRadius: 2,
              background: on
                ? mix(C.blue400, C.blue100, lock * (s / SEGMENTS))
                : head
                  ? alpha(C.blue100, 0.4 + 0.6 * (lit % 1))
                  : C.slate800,
              boxShadow: on && lock > 0 ? `0 0 ${14 * lock}px ${alpha(C.blue400, 0.6 * lock)}` : undefined,
            }}
          />
        );
      })}
      {Array.from({ length: decades + 1 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: (i / decades) * (METER_W - 4),
            top: 34,
            transform: `translateX(${i === 0 ? 0 : i === decades ? -100 : -50}%)`,
          }}
        >
          <Mono size={24} color={fill >= i / decades - 0.001 ? C.slate400 : C.slate600} tracking="0.1em">
            {decadeLabel(i)}
          </Mono>
        </div>
      ))}
    </div>
  );
};

const StatGrid: React.FC = () => {
  const { props, frame, count, lock, captionAt, exit, exitDur, amp } = useTiming();
  const { splits, hits } = useMemo(() => makeSplits(props.value, count, lock), [props.value, count, lock]);
  const cascadeAt = hits.length ? hits[hits.length - 1] : count;
  const k = splitIndexAt(splits, frame);
  const n = splits[k].n;
  const locked = frame >= lock;
  const shown = locked ? props.value : Math.min(props.value, counterAt(splits, frame, props.value));
  const decades = Math.max(1, Math.ceil(Math.log10(props.value) - 1e-9));
  const lines = props.label.split('\n');

  // Camera: impact settle → push in (with tilt) during the splits → pull back flat on the lock.
  const impact = pop(frame, 0, { damping: 16, stiffness: 260 });
  const pushIn = progress(frame, count - 3, Math.max(1, lock - 12 - (count - 3)), EASE.inOut);
  const pullBack = progress(frame, lock - 12, 16, EASE.out);
  const kick = hits.reduce(
    (acc, h) => acc + (frame >= h ? 0.022 * (1 - progress(frame, h, 9, EASE.out)) : 0),
    0,
  );
  const worldScale =
    lerp(1.1, 0.9, impact) +
    0.17 * pushIn -
    0.1 * pullBack +
    kick +
    0.025 * progress(frame, lock, 30, EASE.linear);
  const tiltY = -11 * pushIn * (1 - pullBack);
  const tiltX = 7 * pushIn * (1 - pullBack);
  const panX = 36 * pushIn * (1 - pullBack);

  const shakes = [
    shake(frame, 0, 16, 14 * amp, 'stat-grid-impact'),
    shake(frame, lock, 18, 16 * amp, 'stat-grid-lock'),
    ...hits.map((h, i) => shake(frame, h, 8, 4 * amp, `stat-grid-hit-${i}`)),
  ];
  const shx = shakes.reduce((a, s) => a + s.x, 0);
  const shy = shakes.reduce((a, s) => a + s.y, 0);

  const sinceSplit = frame - splits[k].at;
  const splitGlow = k > 0 ? Math.max(0, 1 - sinceSplit / 10) : Math.max(0, 1 - frame / 14);
  const density = clamp(Math.log(n) / Math.log(MAX_SIDE));

  // Counter: centred in the column while counting, then drops under the headline.
  const lockP = progress(frame, lock - 2, 14, EASE.out);
  const counterPop = pop(frame, lock, { damping: 11, stiffness: 240 });
  const bump = hits.reduce(
    (acc, h) => acc + (frame >= h ? 0.06 * (1 - progress(frame, h, 10, EASE.out)) : 0),
    0,
  );
  const counterScale = lerp(1, 0.82, lockP) * (locked ? lerp(1.1, 1, counterPop) : 1 + bump);
  const headH = lines.length * 104 * 0.95;
  const counterY = lerp(392, 250 + headH + 60, lockP);
  const digits = `${props.prefix ?? ''}${formatValue(props.value, props.decimals)}${props.suffix ?? ''}`
    .length;
  const counterSize = Math.min(168, COL_W / (digits * 0.6));
  const headSize = Math.min(
    104,
    Math.round(COL_W / (Math.max(...lines.map((l) => l.replace(/[[\]]/g, '').length)) * 0.52)),
  );

  const flashAmt =
    0.22 * (1 - progress(frame, 0, 10, EASE.out)) +
    (locked ? 0.42 * (1 - progress(frame, lock, 14, EASE.out)) : 0);
  const exitP = progress(frame, exit, exitDur, EASE.standard) ** 2;
  const box = props.grid?.box ?? '1 server';
  const tile = props.grid?.tile ?? '1 microVM';

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: C.black }}>
      <AbsoluteFill
        style={{
          transform: `translate(${shx}px, ${shy}px) scale(${1 + 0.9 * exitP})`,
          transformOrigin: `${BOX_CX}px ${BOX_CY}px`,
          filter: exitP > 0.01 ? `blur(${16 * exitP}px)` : undefined,
          opacity: 1 - 0.5 * exitP,
        }}
      >
        <Backdrop
          variant="tintC"
          aura={1.2 + 1.3 * density + splitGlow * 0.6}
          auraX={(BOX_CX / 1920) * 100}
          auraY={52}
          grid={0.05}
          gridSize={64}
          gridOffset={{ x: -frame * 0.35, y: -frame * 0.2 }}
          vignette={0.6}
        />
        <AbsoluteFill style={{ perspective: 2200, perspectiveOrigin: `${BOX_CX}px ${BOX_CY}px` }}>
          <div
            style={{
              position: 'absolute',
              left: BOX_CX - OUTER / 2,
              top: BOX_CY - OUTER / 2,
              width: OUTER,
              height: OUTER,
              transform: `translateX(${panX}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${worldScale})`,
              transformOrigin: '50% 50%',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: -120,
                borderRadius: 200,
                background: `radial-gradient(closest-side, ${alpha(C.blue400, 0.12 + 0.2 * density + 0.18 * splitGlow)}, transparent)`,
              }}
            />
            <div
              style={{ position: 'absolute', inset: 0, borderRadius: 22, background: alpha(C.slate950, 0.7) }}
            />
            <Field frame={frame} splits={splits} lock={lock} cascadeAt={cascadeAt} />
            <svg width={OUTER} height={OUTER} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              <rect
                x={1.5}
                y={1.5}
                width={OUTER - 3}
                height={OUTER - 3}
                rx={22}
                fill="none"
                stroke={mix(C.slate400, C.blue100, clamp(splitGlow + (locked ? 0.4 : 0)))}
                strokeWidth={3}
                strokeDasharray="14 9"
                strokeDashoffset={-frame * 0.6}
                opacity={0.85}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: 4,
                top: -48,
                width: OUTER - 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Mono size={26} color={C.slate300} tracking="0.12em">
                {box}
              </Mono>
              <Mono
                size={26}
                color={splitGlow > 0.3 ? C.blue100 : C.slate500}
                tracking="0.1em"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {`GRID ${n} × ${n}`}
              </Mono>
            </div>
            <div
              style={{ position: 'absolute', left: 4, top: OUTER + 20, opacity: 1 - pushIn * (1 - pullBack) }}
            >
              <Mono size={26} color={C.slate500} tracking="0.12em">
                {`■ = ${tile}`}
              </Mono>
            </div>
          </div>
        </AbsoluteFill>

        {/* Right column: headline on the lock, counter + meter. */}
        {frame >= lock - 3 && (
          <div style={{ position: 'absolute', left: COL_X, top: 238, width: COL_W }}>
            {lines.map((line, i) => (
              <Display
                key={i}
                size={headSize}
                color={C.slate300}
                style={{ whiteSpace: 'nowrap', marginTop: i ? 6 : 0 }}
              >
                <AccentLine
                  line={line}
                  at={lock - 3 + i * 5}
                  stagger={3}
                  duration={9}
                  from={{ opacity: 0, scale: 1.7, blur: 14, y: -10 }}
                  origin="0% 70%"
                />
              </Display>
            ))}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            left: COL_X,
            top: counterY,
            transform: `scale(${counterScale})`,
            transformOrigin: '0% 0%',
            opacity: progress(frame, -2, 12, EASE.out),
          }}
        >
          {props.eyebrow && (
            <Mono size={32} color={C.slate400} tracking="0.12em">
              {props.eyebrow}
            </Mono>
          )}
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: counterSize,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: C.blue400,
              fontVariantNumeric: 'tabular-nums',
              marginTop: 18,
              whiteSpace: 'nowrap',
              textShadow: `0 0 ${40 + 60 * (splitGlow + (locked ? 1 - lockP : 0))}px ${alpha(C.blue400, 0.35 + 0.3 * splitGlow)}`,
            }}
          >
            {props.prefix}
            {formatValue(shown, props.decimals)}
            {locked && props.suffix && <span style={{ color: C.blue100 }}>{props.suffix}</span>}
          </div>
          <div style={{ marginTop: 34 }}>
            <Meter value={shown} decades={decades} lock={lockP} />
          </div>
          {props.caption && (
            <div
              style={{
                marginTop: 30,
                opacity: progress(frame, captionAt, 12, EASE.out),
                transform: `translateY(${lerp(12, 0, progress(frame, captionAt, 12, EASE.out))}px)`,
              }}
            >
              <Mono size={32} color={C.blue100} tracking="0.12em">
                {props.caption}
              </Mono>
            </div>
          )}
        </div>

        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 60% at ${(BOX_CX / 1920) * 100}% 52%, ${C.blue100}, ${alpha(C.blue400, 0.4)} 60%, transparent)`,
            opacity: flashAmt,
            mixBlendMode: 'screen',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── chart: the Economics cost-over-time chart ───────────────────────────────

const CH = { x: 200, y: 430, w: 1540, h: 420 };
const ALWAYS_ON = 0.78;
const PEAK = 0.62;
const GAP = { from: 0.335, to: 0.665 };
const BURSTS = [
  { c: 0.1, w: 0.075, a: 0.62, seed: 'b0' },
  { c: 0.25, w: 0.07, a: 1, seed: 'b1' },
  { c: 0.745, w: 0.075, a: 0.78, seed: 'b2' },
  { c: 0.905, w: 0.05, a: 0.5, seed: 'b3' },
] as const;

/** Traffic 0..1 at t ∈ [0, 1]: bell-shaped bursts with noisy spikes, exactly 0 in the idle gap. */
const traffic = (t: number): number => {
  let v = 0;
  for (const b of BURSTS) {
    const u = (t - b.c) / b.w;
    if (Math.abs(u) < 1) {
      const env = (Math.cos(Math.PI * u) + 1) / 2;
      const spikes =
        0.55 + 0.45 * Math.abs(noise2D(b.seed, t * 90, 0)) + 0.25 * noise2D(`${b.seed}-f`, t * 260, 0);
      v += b.a * env ** 0.7 * clamp(spikes, 0.2, 1.15);
    }
  }
  return clamp(v);
};

const SAMPLES = 420;
const POINTS = Array.from({ length: SAMPLES + 1 }, (_, k) => ({
  x: (k / SAMPLES) * CH.w,
  y: CH.h - traffic(k / SAMPLES) * PEAK * CH.h,
}));
const LINE_D = POINTS.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const AREA_D = `${LINE_D} L${CH.w},${CH.h} L0,${CH.h} Z`;
const BAND_Y = CH.h * (1 - ALWAYS_ON);
const TICKS = ['00:00', '06:00', '12:00', '18:00', '24:00'];

const StatChart: React.FC = () => {
  const { props, frame, count, lock, exit, exitDur, frames, amp } = useTiming();
  const { at } = useScene();
  const labelAt = at('label');
  const from = props.from ?? 0;
  const counts = from !== props.value;
  const [always, scaled] = props.legend ?? ['Always-on', 'Unikraft Cloud'];

  // The draw head sweeps the chart from the cut to the lock.
  const head = progress(frame, -2, lock + 2, EASE.standard);
  const headX = head * CH.w;
  const headSample = POINTS[Math.round(head * SAMPLES)];
  const inGap = head > GAP.from && head < GAP.to;

  const showAt = counts ? count : lock;
  const numPop = pop(frame, showAt - 3, { damping: 12, stiffness: 260 });
  const numOn = frame >= showAt - 3;
  const locked = frame >= lock;
  const lockPop = pop(frame, lock, { damping: 10, stiffness: 260 });
  const v = countValue(frame, from, props.value, count, lock);
  const shown = locked ? props.value : shownValue(v, from, props.value, props.decimals ?? 0);
  const exitP = progress(frame, exit, exitDur, EASE.standard) ** 2;

  const push = lerp(1, 1.035, frame / frames);
  const s1 = shake(frame, lock, 16, 12 * amp, 'stat-chart-lock');
  const flashAmt = locked ? 0.34 * (1 - progress(frame, lock, 14, EASE.out)) : 0;
  const frameIn = progress(frame, -8, 16, EASE.out);
  const legendIn = progress(frame, 4, 14, EASE.out);
  const idleNote = progress(frame, lock * 0.4, 12, EASE.out);
  const zeroLine = progress(frame, lock, 14, EASE.out);
  const gapCx = ((GAP.from + GAP.to) / 2) * CH.w;
  const gapW = (GAP.to - GAP.from) * CH.w;
  const hatchShift = (frame * 0.5) % 12;
  const text = `${props.prefix ?? ''}${formatValue(props.value, props.decimals)}${props.suffix ?? ''}`;
  const numSize = Math.min(210, (gapW + 80) / (text.length * 0.58));
  const headSize = Math.min(112, Math.round(1560 / (props.label.replace(/[[\]]/g, '').length * 0.52)));
  const glow = 50 + 70 * (1 - progress(frame, lock, 20, EASE.out));

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: C.black }}>
      <AbsoluteFill
        style={{
          transform: `translate(${s1.x}px, ${s1.y}px) scale(${push * (1 + 0.7 * exitP)})`,
          transformOrigin: '50% 55%',
          filter: exitP > 0.01 ? `blur(${14 * exitP}px)` : undefined,
          opacity: 1 - 0.6 * exitP,
        }}
      >
        <Backdrop
          variant="tintC"
          aura={1.2 + (locked ? 0.6 : 0)}
          auraX={50}
          auraY={62}
          grid={0.045}
          gridSize={64}
          gridOffset={{ x: -frame * 0.4, y: 0 }}
          vignette={0.6}
        />
        <div style={{ position: 'absolute', left: CH.x - 40, top: 170 }}>
          <Display size={headSize} color={C.slate300} style={{ whiteSpace: 'nowrap' }}>
            <AccentLine
              line={props.label}
              at={labelAt - 4}
              stagger={2}
              duration={14}
              from={{ opacity: 0, x: 220, blur: 18, scaleX: 1.25 }}
            />
          </Display>
          <div style={{ marginTop: 22, opacity: progress(frame, labelAt + 6, 12, EASE.out) }}>
            <Mono size={26} color={C.slate500} tracking="0.12em">
              Cost over time · same traffic
            </Mono>
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 1920 - (CH.x + CH.w),
            top: 300,
            display: 'flex',
            gap: 16,
            opacity: legendIn,
            transform: `translateX(${lerp(60, 0, legendIn)}px)`,
          }}
        >
          <Chip label={always} tone="red" mono size={24} icon="solar:power-bold" />
          <Chip
            label={scaled}
            tone="blue"
            mono
            size={24}
            icon="solar:bolt-bold"
            glow={locked ? 1 - progress(frame, lock, 30, EASE.out) * 0.6 : 0}
          />
        </div>

        <div style={{ position: 'absolute', left: CH.x, top: CH.y, width: CH.w, height: CH.h }}>
          <svg
            width={CH.w}
            height={CH.h + 60}
            style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
          >
            <defs>
              <pattern
                id="stat-rose-hatch"
                width={12}
                height={12}
                patternUnits="userSpaceOnUse"
                patternTransform={`rotate(45) translate(${hatchShift} 0)`}
              >
                <rect width={3} height={12} fill={C.rose} opacity={0.42} />
              </pattern>
              <pattern
                id="stat-blue-hatch"
                width={10}
                height={10}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-45)"
              >
                <rect width={2} height={10} fill={C.blue100} opacity={0.22} />
              </pattern>
              <linearGradient id="stat-blue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.blue400} stopOpacity={0.75} />
                <stop offset="1" stopColor={C.blue400} stopOpacity={0.18} />
              </linearGradient>
              <clipPath id="stat-reveal">
                <rect x={-4} y={-40} width={headX + 4} height={CH.h + 44} />
              </clipPath>
            </defs>
            {[0.25, 0.5, 0.75].map((g) => (
              <line
                key={g}
                x1={0}
                x2={CH.w * frameIn}
                y1={CH.h * (1 - g)}
                y2={CH.h * (1 - g)}
                stroke={C.slate800}
                strokeWidth={1.5}
                strokeDasharray="4 8"
              />
            ))}
            <line x1={0} x2={0} y1={CH.h} y2={CH.h - CH.h * frameIn} stroke={C.slate600} strokeWidth={2} />
            <line x1={0} x2={CH.w * frameIn} y1={CH.h} y2={CH.h} stroke={C.slate600} strokeWidth={2} />
            {TICKS.map((_, i) => (
              <line
                key={i}
                x1={(i / 4) * CH.w}
                x2={(i / 4) * CH.w}
                y1={CH.h}
                y2={CH.h + 10}
                stroke={C.slate600}
                strokeWidth={2}
                opacity={frameIn}
              />
            ))}
            <g clipPath="url(#stat-reveal)">
              <rect x={0} y={BAND_Y} width={CH.w} height={CH.h - BAND_Y} fill={alpha(C.rose, 0.08)} />
              <rect x={0} y={BAND_Y} width={CH.w} height={CH.h - BAND_Y} fill="url(#stat-rose-hatch)" />
              <line x1={0} x2={CH.w} y1={BAND_Y} y2={BAND_Y} stroke={C.rose} strokeWidth={3} />
              <path d={AREA_D} fill="url(#stat-blue-fill)" />
              <path d={AREA_D} fill="url(#stat-blue-hatch)" />
              <path
                d={LINE_D}
                fill="none"
                stroke={C.blue400}
                strokeWidth={10}
                strokeLinejoin="round"
                opacity={0.25}
                style={{ filter: 'blur(6px)' }}
              />
              <path d={LINE_D} fill="none" stroke={C.blue100} strokeWidth={3} strokeLinejoin="round" />
            </g>
            {locked && (
              <g>
                <line
                  x1={gapCx - (gapW * zeroLine) / 2}
                  x2={gapCx + (gapW * zeroLine) / 2}
                  y1={CH.h}
                  y2={CH.h}
                  stroke={C.blue400}
                  strokeWidth={14}
                  opacity={0.35}
                  style={{ filter: 'blur(8px)' }}
                />
                <line
                  x1={gapCx - (gapW * zeroLine) / 2}
                  x2={gapCx + (gapW * zeroLine) / 2}
                  y1={CH.h}
                  y2={CH.h}
                  stroke={C.blue100}
                  strokeWidth={4}
                />
                {[GAP.from, GAP.to].map((g) => (
                  <line
                    key={g}
                    x1={g * CH.w}
                    x2={g * CH.w}
                    y1={CH.h - 14}
                    y2={CH.h + 14}
                    stroke={C.blue100}
                    strokeWidth={3}
                    opacity={zeroLine}
                  />
                ))}
              </g>
            )}
            {head < 1 && (
              <g>
                <line
                  x1={headX}
                  x2={headX}
                  y1={-20}
                  y2={CH.h}
                  stroke={C.slate400}
                  strokeWidth={1.5}
                  strokeDasharray="3 5"
                  opacity={0.8}
                />
                <circle cx={headX} cy={BAND_Y} r={7} fill={C.rose} />
                <circle cx={headX} cy={BAND_Y} r={16} fill={C.rose} opacity={0.25} />
                <circle cx={headX} cy={headSample.y} r={inGap ? 9 : 7} fill={C.blue100} />
                <circle
                  cx={headX}
                  cy={headSample.y}
                  r={16 + (inGap ? 8 * Math.abs(Math.sin(frame * 0.35)) : 0)}
                  fill={C.blue400}
                  opacity={0.35}
                />
              </g>
            )}
          </svg>

          <div style={{ position: 'absolute', left: -2, top: -46, opacity: frameIn }}>
            <Mono size={24} color={C.slate500} tracking="0.14em">
              ↑ Cost
            </Mono>
          </div>
          {TICKS.map((t, i) => (
            <div
              key={t}
              style={{
                position: 'absolute',
                left: (i / 4) * CH.w,
                top: CH.h + 22,
                transform: `translateX(${i === 0 ? 0 : i === 4 ? -100 : -50}%)`,
                opacity: frameIn,
              }}
            >
              <Mono size={22} color={C.slate500} tracking="0.1em">
                {t}
              </Mono>
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              left: GAP.from * CH.w + 16,
              top: BAND_Y - 40,
              opacity: idleNote,
              transform: `translateY(${lerp(10, 0, idleNote)}px)`,
            }}
          >
            <Mono size={24} color={C.red} tracking="0.1em">
              {`${always} · billed while idle`}
            </Mono>
          </div>

          {numOn && (
            <div
              style={{
                position: 'absolute',
                left: gapCx,
                top: BAND_Y + (CH.h - BAND_Y) / 2 - 10,
                transform: `translate(-50%, -50%) scale(${lerp(1.9, 1, numPop) * (locked ? lerp(1.12, 1, lockPop) : 1)})`,
                opacity: clamp(numPop * 3),
                filter: numPop < 0.6 ? `blur(${(0.6 - numPop) * 20}px)` : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '-40px -90px',
                  background: `radial-gradient(closest-side, ${alpha(C.black, 0.92)} 40%, ${alpha(C.black, 0)} 100%)`,
                }}
              />
              {props.eyebrow && (
                <Mono size={26} color={C.blue100} tracking="0.14em" style={{ position: 'relative' }}>
                  {props.eyebrow}
                </Mono>
              )}
              <div
                style={{
                  ...TYPE.display,
                  position: 'relative',
                  fontSize: numSize,
                  marginTop: 6,
                  color: C.blue50,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: `0 0 ${glow}px ${alpha(C.blue400, 0.75)}`,
                }}
              >
                {props.prefix}
                {formatValue(shown, props.decimals)}
                {props.suffix}
              </div>
              {props.caption && (
                <div
                  style={{
                    position: 'relative',
                    marginTop: 10,
                    opacity: progress(frame, lock, 12, EASE.out),
                  }}
                >
                  <Mono size={26} color={C.slate400} tracking="0.14em">
                    {props.caption}
                  </Mono>
                </div>
              )}
            </div>
          )}
        </div>

        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 60% at 50% 55%, ${C.blue100}, ${alpha(C.blue400, 0.35)} 60%, transparent)`,
            opacity: flashAmt,
            mixBlendMode: 'screen',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Hero number over one of three promo visuals; see `stat()` in ./plan.ts. */
export const Stat: React.FC = () => {
  const { props } = useScene<StatProps>();
  const visual = props.visual ?? 'none';
  return visual === 'grid' ? <StatGrid /> : visual === 'chart' ? <StatChart /> : <StatReadout />;
};
