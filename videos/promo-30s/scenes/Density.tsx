import type React from 'react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { ICONS } from '../../../kit/design/icons-data';
import { clamp, EASE, fmtInt, lerp, pop, progress, shake, tween } from '../../../kit/design/motion';
import { Display, Mono, SplitText } from '../../../kit/design/Text';
import { alpha, C, FONT, mix } from '../../../kit/design/tokens';

/**
 * Chapter 4 “CHEAP”, part 1 — density.
 *
 * One dashed server box holds a single glowing microVM. On every 8th note the
 * tiles split into four (1 → 4 → 16 → 64 → 256 → 1,024), then cascade through
 * 4K / 16K / 65K into a 320×320 shimmering pixel field (102,400 instances) that
 * locks into the site's checker texture on b39 (f90) while the headline slams.
 */

// ── Layout ──────────────────────────────────────────────────────────────────
const BOX_CX = 520;
const BOX_CY = 560;
/** Tile field, CSS px (square). */
const FIELD = 640;
const PAD = 24;
const OUTER = FIELD + PAD * 2;
/** Canvas backing resolution (2× so the camera push stays crisp). */
const DPR = 2;
const A = FIELD * DPR;

const COL_X = 960;

// ── Timing (scene-local frames) ─────────────────────────────────────────────
const LOCK = 90;
const EXIT = 112;

type Split = { at: number; n: number; dur: number };
/** Grid side per split. 8th-note splits f15…f75, then a cascade into the lock. */
const SPLITS: readonly Split[] = [
  { at: 0, n: 1, dur: 0 },
  { at: 15, n: 2, dur: 11 },
  { at: 30, n: 4, dur: 11 },
  { at: 45, n: 8, dur: 11 },
  { at: 60, n: 16, dur: 10 },
  { at: 75, n: 32, dur: 8 },
  { at: 79, n: 64, dur: 5 },
  { at: 83, n: 128, dur: 4 },
  { at: 87, n: 256, dur: 3 },
  { at: LOCK, n: 320, dur: 0 },
];
/** 8th-note hits (flash + camera kick + counter bump). */
const HITS = [15, 30, 45, 60, 75];

const splitIndexAt = (frame: number): number => {
  let k = 0;
  for (let i = 0; i < SPLITS.length; i++) {
    if (frame >= SPLITS[i].at) {
      k = i;
    }
  }
  return k;
};

/** Counter value: rolls (log-interpolated) from the previous count to the new one after each split. */
const counterAt = (frame: number): number => {
  const k = splitIndexAt(frame);
  const cur = SPLITS[k].n ** 2;
  if (k === SPLITS.length - 1) {
    return 100000;
  }
  if (k === 0) {
    return 1;
  }
  const prev = SPLITS[k - 1].n ** 2;
  const next = SPLITS[k + 1];
  const roll = Math.min(12, next.at - SPLITS[k].at);
  const p = progress(frame, SPLITS[k].at, roll, EASE.out);
  return Math.round(Math.exp(lerp(Math.log(prev), Math.log(cur), p)));
};

// ── Deterministic hash (per-tile brightness / flicker) ──────────────────────
const hash = (a: number, b: number, c: number): number => {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

// ── Palette (brightness buckets) ────────────────────────────────────────────
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

const ICON_PATHS = (() => {
  const body = ICONS['solar:compass-square-bold-duotone'].body;
  return Array.from(body.matchAll(/<path d="([^"]+)"( opacity="([^"]+)")?/g)).map((m) => ({
    d: m[1],
    opacity: m[3] ? Number(m[3]) : 1,
  }));
})();

type Rect = { x: number; y: number; w: number; r: number };

const gapFor = (pitch: number): number => {
  if (pitch >= 16) {
    return Math.min(64, Math.max(3, pitch * 0.1));
  }
  // Sub-6px tiles go gapless: a 1px gutter at this pitch aliases into moiré once downsampled.
  return pitch >= 6 ? 2 : 0;
};

const tileRect = (n: number, i: number, j: number): Rect & { y: number } => {
  const pitch = A / n;
  const g = gapFor(pitch);
  return {
    x: i * pitch + g / 2,
    y: j * pitch + g / 2,
    w: pitch - g,
    r: pitch >= 16 ? Math.min(pitch * 0.16, 40) : 0,
  };
};

/** Brightness 0..~1.6 for tile (i, j) of grid n at `frame`. */
const brightness = (frame: number, split: Split, i: number, j: number): number => {
  const { n, at } = split;
  const h1 = hash(i, j, n);
  const h2 = hash(j + 7, i + 3, n * 13);
  let v = 0.3 + 0.42 * h1;
  // Activity: tiles light up in short bursts (requests landing).
  const slot = Math.floor((frame + h2 * 40) / 6);
  const act = hash(i * 31 + slot, j * 17, n + 5);
  if (act > 0.9) {
    v += 0.55 * (act - 0.9) * 10;
  }
  // Ripple: a bright wavefront rings out from the centre on every split.
  const cx = (i + 0.5) / n - 0.5;
  const cy = (j + 0.5) / n - 0.5;
  const d = Math.sqrt(cx * cx + cy * cy) * 1.41;
  const travel = at >= LOCK ? 14 : at > 75 ? 9 : 11;
  const width = n >= 64 ? 2.5 : 4;
  const since = frame - at - d * travel;
  if (since >= 0 && since < width) {
    const k = 1 - since / width;
    v += (n >= 64 ? 0.5 : 0.75) * k * k;
  }
  if (at >= LOCK) {
    // Lock: the field resolves into the site's checker texture (4×4-tile cells) + a light sweep.
    if (((i >> 2) + (j >> 2)) & 1) {
      v *= 1 - 0.5 * progress(frame, LOCK, 10, EASE.out);
    }
    const u = (i + (n - j)) / (2 * n);
    const sweep = lerp(-0.25, 1.25, progress(frame, LOCK + 4, 24, EASE.inOut));
    const ds = Math.abs(u - sweep);
    if (ds < 0.08) {
      v += 0.55 * (1 - ds / 0.08);
    }
  }
  return v;
};

const Field: React.FC<{ frame: number }> = ({ frame }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const icon = useMemo(
    () => ICON_PATHS.map((p) => ({ path: new Path2D(p.d), opacity: p.opacity })),
    [],
  );

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, A, A);
    const k = splitIndexAt(frame);
    const split = SPLITS[k];
    const parent = k > 0 ? SPLITS[k - 1] : null;
    const e = split.dur > 0 ? progress(frame, split.at, split.dur, EASE.out) : 1;
    const { n } = split;
    const ratio = parent ? n / parent.n : 1;
    const animating = parent !== null && e < 1 && Number.isInteger(ratio);

    const rectOf = (i: number, j: number): Rect & { y: number } => {
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
          const v = clamp(brightness(frame, split, i, j), 0, 1.6);
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
          ctx.strokeStyle = alpha(mix(C.blue400, C.blue100, clamp(v - 0.5, 0, 1)), clamp(0.45 + 0.45 * v, 0, 1));
          ctx.beginPath();
          ctx.roundRect(rc.x, rc.y, rc.w, rc.w, rc.r);
          ctx.stroke();
          // Icon.
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
          const v = brightness(frame, split, i, j);
          const b = Math.min(BUCKETS - 1, Math.max(0, Math.round(v * (BUCKETS - 1))));
          if (rc.r > 0.5) {
            paths[b].roundRect(rc.x, rc.y, rc.w, rc.w, rc.r);
          } else {
            paths[b].rect(Math.round(rc.x), Math.round(rc.y), Math.max(1, Math.round(rc.w)), Math.max(1, Math.round(rc.w)));
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
      ctx.fillStyle = alpha(C.blue100, (split.at >= LOCK ? 0.45 : 0.22) * f * f);
      ctx.fillRect(0, 0, A, A);
      ctx.restore();
    }
  }, [frame, icon]);

  return <canvas ref={ref} width={A} height={A} style={{ position: 'absolute', left: PAD, top: PAD, width: FIELD, height: FIELD }} />;
};

// ── Log-scale meter (1 → 100K) ──────────────────────────────────────────────
const METER_W = 760;
const SEGMENTS = 40;
const TICKS = ['1', '10', '100', '1K', '10K', '100K'];

const Meter: React.FC<{ value: number; lock: number }> = ({ value, lock }) => {
  const fill = clamp(Math.log10(Math.max(1, value)) / 5);
  const lit = fill * SEGMENTS;
  const segW = METER_W / SEGMENTS;
  return (
    <div style={{ position: 'relative', width: METER_W, height: 58 }}>
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
              background: on ? mix(C.blue400, C.blue100, lock * (s / SEGMENTS)) : head ? alpha(C.blue100, 0.4 + 0.6 * (lit % 1)) : C.slate800,
              boxShadow: on && lock > 0 ? `0 0 ${14 * lock}px ${alpha(C.blue400, 0.6 * lock)}` : undefined,
            }}
          />
        );
      })}
      {TICKS.map((t, i) => (
        <div
          key={t}
          style={{
            position: 'absolute',
            left: (i / 5) * (METER_W - 4),
            top: 32,
            transform: `translateX(${i === 0 ? 0 : i === 5 ? -100 : -50}%)`,
          }}
        >
          <Mono size={16} color={fill >= i / 5 - 0.001 ? C.slate400 : C.slate600} tracking="0.1em">
            {t}
          </Mono>
        </div>
      ))}
    </div>
  );
};

// ── Scene ───────────────────────────────────────────────────────────────────
export const Density: React.FC = () => {
  const frame = useCurrentFrame();
  const k = splitIndexAt(frame);
  const n = SPLITS[k].n;
  const count = counterAt(frame);
  const locked = frame >= LOCK;

  // Camera: impact settle → push in (with tilt) during the splits → pull back flat on the lock.
  const impact = pop(frame, 0, { damping: 16, stiffness: 260 });
  const pushIn = progress(frame, 12, 66, EASE.inOut);
  const pullBack = progress(frame, 78, 16, EASE.out);
  const kick = HITS.reduce((acc, h) => acc + 0.022 * (1 - progress(frame, h, 9, EASE.out)) * (frame >= h ? 1 : 0), 0);
  const worldScale =
    lerp(1.1, 0.9, impact) + 0.17 * pushIn - 0.17 * pullBack + 0.07 * pullBack + kick + 0.025 * progress(frame, LOCK, 30, EASE.linear);
  const tiltY = -11 * pushIn * (1 - pullBack);
  const tiltX = 7 * pushIn * (1 - pullBack);
  const panX = 36 * pushIn * (1 - pullBack);

  // Global shakes on the impact and the lock, small kicks on the 8ths.
  const sImpact = shake(frame, 0, 16, 14, 'density-impact');
  const sLock = shake(frame, LOCK, 18, 16, 'density-lock');
  const sHits = HITS.reduce(
    (acc, h, i) => {
      const s = shake(frame, h, 8, 4, `density-hit-${i}`);
      return { x: acc.x + s.x, y: acc.y + s.y };
    },
    { x: 0, y: 0 },
  );
  const shx = sImpact.x + sLock.x + sHits.x;
  const shy = sImpact.y + sLock.y + sHits.y;

  // Border brightens on every split.
  const sinceSplit = frame - SPLITS[k].at;
  const splitGlow = k > 0 ? Math.max(0, 1 - sinceSplit / 10) : Math.max(0, 1 - frame / 14);
  const density = clamp(Math.log(n) / Math.log(320));

  // Counter group: centred until the lock, then drops below the headline and pops.
  const lockP = progress(frame, LOCK - 2, 14, EASE.out);
  const counterPop = pop(frame, LOCK, { damping: 11, stiffness: 240 });
  const bump = HITS.reduce((acc, h) => acc + 0.06 * (frame >= h ? 1 - progress(frame, h, 10, EASE.out) : 0), 0);
  const counterScale = lerp(1, 0.72, lockP) * (locked ? lerp(1.1, 1, counterPop) : 1 + bump);
  const counterY = lerp(392, 572, lockP);

  const flashImpact = 0.22 * (1 - progress(frame, 0, 10, EASE.out));
  const flashLock = locked ? 0.42 * (1 - progress(frame, LOCK, 14, EASE.out)) : 0;

  // Exit: dive into the pixel field.
  const exitP = progress(frame, EXIT, 8, EASE.standard) ** 2;

  const readout = `GRID ${n} × ${n}`;

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

        {/* World: the server box. */}
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
            {/* Soft bloom behind the field, grows with density. */}
            <div
              style={{
                position: 'absolute',
                inset: -120,
                borderRadius: 200,
                background: `radial-gradient(closest-side, ${alpha(C.blue400, 0.12 + 0.2 * density + 0.18 * splitGlow)}, transparent)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 22,
                background: alpha(C.slate950, 0.7),
              }}
            />
            <Field frame={frame} />
            {/* ServerBox: dashed rounded outline (site diagram primitive), marching slowly. */}
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
            {/* Labels on the box edge. */}
            <div
              style={{
                position: 'absolute',
                left: 4,
                top: -46,
                width: OUTER - 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Mono size={22} color={C.slate300} tracking="0.12em">
                1 server
              </Mono>
              <Mono size={18} color={splitGlow > 0.3 ? C.blue100 : C.slate500} tracking="0.1em" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {readout}
              </Mono>
            </div>
            <div style={{ position: 'absolute', left: 4, top: OUTER + 22, opacity: 1 - pushIn * (1 - pullBack) }}>
              <Mono size={16} color={C.slate500} tracking="0.12em">
                ■ = 1 microVM · hardware-isolated
              </Mono>
            </div>
          </div>
        </AbsoluteFill>

        {/* Right column: headline (on the lock) + counter. */}
        <div style={{ position: 'absolute', left: COL_X, top: 238, width: 860 }}>
          {frame >= LOCK - 3 && (
            <>
              <Display size={104} color={C.slate300} style={{ whiteSpace: 'nowrap' }}>
                <SplitText
                  text="100K+ microVMs."
                  by="word"
                  at={LOCK - 3}
                  stagger={3}
                  duration={9}
                  from={{ opacity: 0, scale: 1.7, blur: 14, y: -10 }}
                  unitStyle={(_, i) => (i === 0 ? { color: C.blue400, transformOrigin: '0% 70%' } : { transformOrigin: '0% 70%' })}
                />
              </Display>
              <Display size={104} color={C.slate300} style={{ whiteSpace: 'nowrap', marginTop: 6 }}>
                <SplitText
                  text="One server."
                  by="word"
                  at={LOCK + 2}
                  stagger={3}
                  duration={9}
                  from={{ opacity: 0, scale: 1.7, blur: 14, y: -10 }}
                  unitStyle={() => ({ transformOrigin: '0% 70%' })}
                />
              </Display>
            </>
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            left: COL_X,
            top: counterY,
            transform: `scale(${counterScale})`,
            transformOrigin: '0% 0%',
          }}
        >
          <Mono size={22} color={C.slate500} tracking="0.12em">
            Strongly isolated microVMs / server
          </Mono>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 168,
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
            {locked ? '100,000' : fmtInt(count)}
            {locked && <span style={{ color: C.blue100 }}>+</span>}
          </div>
          <div style={{ marginTop: 34, opacity: tween(frame, [LOCK, LOCK + 10], [1, 0.9]) }}>
            <Meter value={locked ? 100000 : count} lock={lockP} />
          </div>
        </div>

        {/* Flash frames. */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 60% at ${(BOX_CX / 1920) * 100}% 52%, ${C.blue100}, ${alpha(C.blue400, 0.4)} 60%, transparent)`,
            opacity: flashImpact + flashLock,
            mixBlendMode: 'screen',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
