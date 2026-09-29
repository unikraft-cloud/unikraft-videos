import { noise2D } from '@remotion/noise';
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Chip } from '../../../kit/design/Chip';
import { clamp, EASE, lerp, pop, progress, shake, tween } from '../../../kit/design/motion';
import { Display, Mono, SplitText } from '../../../kit/design/Text';
import { alpha, C } from '../../../kit/design/tokens';

/**
 * Chapter 4 “CHEAP”, part 2 — economics.
 *
 * “Never pay for idle.” over a cost-over-time chart that draws left → right
 * (f0–f60): spiky traffic with long idle gaps; Always-on is a flat rose-hatched
 * band (billed while idle), Unikraft Cloud is a blue area that tracks traffic
 * and drops to zero in the gaps. b42 (f60): “$0” lands in the big idle gap.
 * b43 (f90): “10–100× better unit economics” slams, the chart pushes back.
 */

// ── Timing (scene-local frames) ─────────────────────────────────────────────
const DRAW_END = 60;
const ZERO = 60;
const SLAM = 90;
const EXIT = 113;

// ── Chart geometry (px) ─────────────────────────────────────────────────────
const CH = { x: 200, y: 400, w: 1540, h: 450 };
const ALWAYS_ON = 0.78; // band height, fraction of chart height
const PEAK = 0.62; // Unikraft cost at max traffic
const GAP = { from: 0.335, to: 0.665 };

type Burst = { c: number; w: number; a: number; seed: string };
const BURSTS: readonly Burst[] = [
  { c: 0.1, w: 0.075, a: 0.62, seed: 'b0' },
  { c: 0.25, w: 0.07, a: 1, seed: 'b1' },
  { c: 0.745, w: 0.075, a: 0.78, seed: 'b2' },
  { c: 0.905, w: 0.05, a: 0.5, seed: 'b3' },
];

/** Traffic 0..1 at t ∈ [0, 1]: bell-shaped bursts with noisy spikes, exactly 0 between them. */
const traffic = (t: number): number => {
  let v = 0;
  for (const b of BURSTS) {
    const u = (t - b.c) / b.w;
    if (Math.abs(u) < 1) {
      const env = (Math.cos(Math.PI * u) + 1) / 2;
      const spikes = 0.55 + 0.45 * Math.abs(noise2D(b.seed, t * 90, 0)) + 0.25 * noise2D(`${b.seed}-f`, t * 260, 0);
      v += b.a * env ** 0.7 * clamp(spikes, 0.2, 1.15);
    }
  }
  return clamp(v);
};

const SAMPLES = 420;
const POINTS = Array.from({ length: SAMPLES + 1 }, (_, k) => {
  const t = k / SAMPLES;
  return { x: t * CH.w, y: CH.h - traffic(t) * PEAK * CH.h };
});
const LINE_D = POINTS.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
const AREA_D = `${LINE_D} L${CH.w},${CH.h} L0,${CH.h} Z`;
const BAND_Y = CH.h * (1 - ALWAYS_ON);

const TICKS = ['00:00', '06:00', '12:00', '18:00', '24:00'];

export const Economics: React.FC = () => {
  const frame = useCurrentFrame();

  // Draw head (0..1) sweeps across the chart f0 → f60.
  const head = progress(frame, -2, DRAW_END + 2, EASE.standard);
  const headX = head * CH.w;
  const headSample = POINTS[Math.round(head * SAMPLES)];
  const inGap = head > GAP.from && head < GAP.to;

  // Beats.
  // Pops pre-roll 3 frames so the spring's impact lands on the cue frame.
  const zeroPop = pop(frame, ZERO - 3, { damping: 12, stiffness: 260 });
  const zeroOn = frame >= ZERO - 3;
  const slamOn = frame >= SLAM - 3;
  const slamPop = pop(frame, SLAM - 3, { damping: 13, stiffness: 240 });
  const pushBack = progress(frame, SLAM - 2, 16, EASE.out);
  const exitP = progress(frame, EXIT, 7, EASE.standard) ** 2;

  // Camera: slow push, shakes on the hits.
  const push = lerp(1, 1.035, frame / 120);
  const s1 = shake(frame, ZERO, 14, 9, 'eco-zero');
  const s2 = shake(frame, SLAM, 18, 16, 'eco-slam');
  const shx = s1.x + s2.x;
  const shy = s1.y + s2.y;

  const flash =
    (frame >= ZERO ? 0.28 * (1 - progress(frame, ZERO, 12, EASE.out)) : 0) +
    (frame >= SLAM ? 0.4 * (1 - progress(frame, SLAM, 14, EASE.out)) : 0);

  // Chart frame wipe-in (already half drawn on f0: the cut must read immediately).
  const frameIn = progress(frame, -8, 16, EASE.out);
  const legendIn = progress(frame, 4, 14, EASE.out);
  const idleNote = progress(frame, 22, 12, EASE.out);
  const resumeNote = progress(frame, 42, 10, EASE.out);
  const zeroLine = progress(frame, ZERO, 14, EASE.out);

  const gapCx = ((GAP.from + GAP.to) / 2) * CH.w;
  const hatchShift = (frame * 0.5) % 12;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: C.black }}>
      <AbsoluteFill
        style={{
          transform: `translate(${shx}px, ${shy}px) scale(${push * (1 + 0.7 * exitP)})`,
          transformOrigin: '50% 55%',
          filter: exitP > 0.01 ? `blur(${14 * exitP}px)` : undefined,
          opacity: 1 - 0.6 * exitP,
        }}
      >
        <Backdrop
          variant="tintC"
          aura={1.2 + (zeroOn ? 0.5 * (1 - pushBack * 0.4) : 0) + (slamOn ? 0.8 : 0)}
          auraX={50}
          auraY={slamOn ? 52 : 62}
          grid={0.045}
          gridSize={64}
          gridOffset={{ x: -frame * 0.4, y: 0 }}
          vignette={0.6}
        />

        {/* Everything that pushes back on the slam. */}
        <AbsoluteFill
          style={{
            opacity: lerp(1, 0.2, pushBack),
            transform: `translateY(${lerp(0, 36, pushBack)}px) scale(${lerp(1, 0.9, pushBack)})`,
            transformOrigin: '50% 60%',
          }}
        >
          {/* Headline + legend. */}
          <div style={{ position: 'absolute', left: CH.x - 40, top: 176 }}>
            <Display size={112} color={C.slate300} style={{ whiteSpace: 'nowrap' }}>
              <SplitText
                text="Never pay for idle."
                by="word"
                at={-4}
                stagger={2}
                duration={14}
                from={{ opacity: 0, x: 220, blur: 18, scaleX: 1.25 }}
                unitStyle={(u) => (u === 'idle.' ? { color: C.blue400 } : undefined)}
              />
            </Display>
            <div style={{ marginTop: 22, opacity: progress(frame, 6, 12, EASE.out) }}>
              <Mono size={20} color={C.slate500} tracking="0.12em">
                Cost over time · same traffic
              </Mono>
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              right: 1920 - (CH.x + CH.w),
              top: 232,
              display: 'flex',
              gap: 16,
              opacity: legendIn,
              transform: `translateX(${lerp(60, 0, legendIn)}px)`,
            }}
          >
            <Chip label="Always-on" tone="red" mono size={18} icon="solar:power-bold" />
            <Chip label="Unikraft Cloud" tone="blue" mono size={18} icon="solar:bolt-bold" glow={zeroOn ? 1 - pushBack : 0} />
          </div>

          {/* Chart. */}
          <div style={{ position: 'absolute', left: CH.x, top: CH.y, width: CH.w, height: CH.h }}>
            <svg width={CH.w} height={CH.h + 60} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <defs>
                <pattern
                  id="eco-rose-hatch"
                  width={12}
                  height={12}
                  patternUnits="userSpaceOnUse"
                  patternTransform={`rotate(45) translate(${hatchShift} 0)`}
                >
                  <rect width={3} height={12} fill={C.rose} opacity={0.42} />
                </pattern>
                <pattern id="eco-blue-hatch" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                  <rect width={2} height={10} fill={C.blue100} opacity={0.22} />
                </pattern>
                <linearGradient id="eco-blue-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={C.blue400} stopOpacity={0.75} />
                  <stop offset="1" stopColor={C.blue400} stopOpacity={0.18} />
                </linearGradient>
                <clipPath id="eco-reveal">
                  <rect x={-4} y={-40} width={headX + 4} height={CH.h + 44} />
                </clipPath>
              </defs>

              {/* Grid + axes. */}
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

              <g clipPath="url(#eco-reveal)">
                {/* Always-on: flat, billed whether or not anything runs. */}
                <rect x={0} y={BAND_Y} width={CH.w} height={CH.h - BAND_Y} fill={alpha(C.rose, 0.08)} />
                <rect x={0} y={BAND_Y} width={CH.w} height={CH.h - BAND_Y} fill="url(#eco-rose-hatch)" />
                <line x1={0} x2={CH.w} y1={BAND_Y} y2={BAND_Y} stroke={C.rose} strokeWidth={3} />

                {/* Unikraft Cloud: tracks traffic, zero while idle. */}
                <path d={AREA_D} fill="url(#eco-blue-fill)" />
                <path d={AREA_D} fill="url(#eco-blue-hatch)" />
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

              {/* The zero line in the idle gap lights up on the $0 hit. */}
              {zeroOn && (
                <g opacity={1 - pushBack * 0.3}>
                  <line
                    x1={gapCx - ((GAP.to - GAP.from) * CH.w * zeroLine) / 2}
                    x2={gapCx + ((GAP.to - GAP.from) * CH.w * zeroLine) / 2}
                    y1={CH.h}
                    y2={CH.h}
                    stroke={C.blue400}
                    strokeWidth={14}
                    opacity={0.35}
                    style={{ filter: 'blur(8px)' }}
                  />
                  <line
                    x1={gapCx - ((GAP.to - GAP.from) * CH.w * zeroLine) / 2}
                    x2={gapCx + ((GAP.to - GAP.from) * CH.w * zeroLine) / 2}
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

              {/* Draw head. */}
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

            {/* Axis labels. */}
            <div style={{ position: 'absolute', left: -2, top: -44, opacity: frameIn }}>
              <Mono size={18} color={C.slate500} tracking="0.14em">
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
                <Mono size={16} color={C.slate600} tracking="0.1em">
                  {t}
                </Mono>
              </div>
            ))}
            <div style={{ position: 'absolute', right: 0, top: CH.h + 52, opacity: frameIn }}>
              <Mono size={18} color={C.slate500} tracking="0.14em">
                Time →
              </Mono>
            </div>

            {/* Annotations. */}
            <div
              style={{
                position: 'absolute',
                left: GAP.from * CH.w + 16,
                top: BAND_Y - 34,
                opacity: idleNote,
                transform: `translateY(${lerp(10, 0, idleNote)}px)`,
              }}
            >
              <Mono size={17} color={C.red} tracking="0.12em">
                Always-on · billed while idle
              </Mono>
            </div>
            <div
              style={{
                position: 'absolute',
                left: GAP.to * CH.w - 16,
                top: CH.h - 38,
                opacity: resumeNote,
                transform: `translate(-100%, ${lerp(10, 0, resumeNote)}px)`,
              }}
            >
              <Mono size={16} color={C.blue100} tracking="0.12em">
                resume &lt; 10 ms ▸
              </Mono>
            </div>

            {/* $0 in the idle gap (site pricing stat: IDLE COST / $0 / scale to zero). */}
            {zeroOn && (
              <div
                style={{
                  position: 'absolute',
                  left: gapCx,
                  top: BAND_Y + (CH.h - BAND_Y) / 2 - 18,
                  transform: `translate(-50%, -50%) scale(${lerp(1.9, 1, zeroPop)})`,
                  opacity: clamp(zeroPop * 3) * (1 - pushBack),
                  filter: zeroPop < 0.6 ? `blur(${(0.6 - zeroPop) * 20}px)` : undefined,
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
                <Mono size={18} color={C.blue100} tracking="0.14em" style={{ position: 'relative' }}>
                  Idle cost
                </Mono>
                <Display
                  size={210}
                  color={C.blue50}
                  style={{
                    position: 'relative',
                    marginTop: 6,
                    textShadow: `0 0 ${50 + 70 * (1 - progress(frame, ZERO, 20, EASE.out))}px ${alpha(C.blue400, 0.75)}`,
                  }}
                >
                  $0
                </Display>
                <Mono size={18} color={C.slate400} tracking="0.14em" style={{ position: 'relative', marginTop: 10 }}>
                  scale to zero
                </Mono>
              </div>
            )}
          </div>
        </AbsoluteFill>

        {/* 10–100× slam. */}
        {slamOn && (
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
            <AbsoluteFill
              style={{
                background: `radial-gradient(50% 45% at 50% 52%, ${alpha(C.black, 0.9)}, transparent)`,
                opacity: pushBack,
              }}
            />
            <div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: 40,
                transform: `scale(${lerp(1.02, 1.05, progress(frame, SLAM, 30, EASE.linear))})`,
              }}
            >
              <div style={{ opacity: tween(frame, [SLAM + 4, SLAM + 14], [0, 1]) }}>
                <Mono size={22} color={C.blue100} tracking="0.16em">
                  Savings · vs. legacy clouds
                </Mono>
              </div>
              <div
                style={{
                  transform: `scale(${lerp(2.4, 1, slamPop)})`,
                  opacity: clamp(slamPop * 2.5),
                  filter: slamPop < 0.7 ? `blur(${(0.7 - slamPop) * 26}px)` : undefined,
                  marginTop: 8,
                }}
              >
                <Display
                  size={290}
                  color={C.blue400}
                  style={{
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    textShadow: `0 0 ${60 + 80 * (1 - pushBack)}px ${alpha(C.blue400, 0.5)}`,
                  }}
                >
                  10–100×
                </Display>
              </div>
              <Display size={92} color={C.slate300} style={{ whiteSpace: 'nowrap', marginTop: 6 }}>
                <SplitText
                  text="better unit economics"
                  by="word"
                  at={SLAM + 5}
                  stagger={3}
                  duration={12}
                  from={{ opacity: 0, y: 40, blur: 12 }}
                />
              </Display>
            </div>
          </AbsoluteFill>
        )}

        {/* Flash frames. */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 60% at 50% 55%, ${C.blue100}, ${alpha(C.blue400, 0.35)} 60%, transparent)`,
            opacity: flash,
            mixBlendMode: 'screen',
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
