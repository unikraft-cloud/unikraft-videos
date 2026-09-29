import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Chip } from '../../../kit/design/Chip';
import { clamp, EASE, lerp, pop, progress, scramble, shake, typed } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { hatch } from '../../../kit/design/patterns';
import { Mono } from '../../../kit/design/Text';
import { alpha, C, FONT, mix, TERM, TYPE } from '../../../kit/design/tokens';
import { manhattanPath, pointOnPath, Wire } from '../../../kit/design/Wire';

/**
 * 05 · ANY WORKLOAD — "A standard Dockerfile. A radically different runtime."
 * (4 beats, after the site's how-it-works BuildAnimation.)
 * b0 headline slams in · b0.5–b1.5 a Dockerfile types itself · b2 the lines
 * stream through a fan of connectors into a microVM image (APP / LIBS / KERNEL)
 * while its size collapses · b2.5 the microVM boots (flash, ● RUNNING).
 * Last 7 frames: dive into the running microVM.
 */

const TYPE_AT = beats(0.5);
const LINE_GAP = 6;
const WIRE_AT = beats(1.6);
const WHOOSH_AT = beats(2);
const BOOT_AT = beats(2.5);
const END = beats(4);
const EXIT_AT = END - 7;

const LINES = [
  { kw: 'FROM', arg: 'node:20-slim' },
  { kw: 'WORKDIR', arg: '/app' },
  { kw: 'COPY', arg: '. .' },
  { kw: 'RUN', arg: 'npm ci --omit=dev' },
  { kw: 'CMD', arg: '["node","server.js"]' },
] as const;

// Stage geometry (frame coordinates).
const CODE = { x: 120, y: 430, w: 700, h: 400 };
const IMG = { x: 1120, y: 430, w: 680, h: 400 };
const HEADER_H = 64;
const LINE_H = 56;
const lineY = (i: number) => CODE.y + HEADER_H + 54 + LINE_H * i;
const STACK = { x: IMG.x + 28, w: IMG.w - 56 };
const BLOCKS = [
  { label: 'APP', y: 510, h: 90, solid: true, at: WHOOSH_AT + 13 },
  { label: 'LIBS', y: 606, h: 56, solid: false, at: WHOOSH_AT + 10 },
  { label: 'KERNEL', y: 668, h: 52, solid: false, at: WHOOSH_AT + 7 },
] as const;
const MERGE = { x: IMG.x, y: 615 };
const WIRES = LINES.map((_, i) => manhattanPath(CODE.x + CODE.w, lineY(i), MERGE.x, MERGE.y, 18));

const SIZE_FROM = 278;
const SIZE_TO = 25;

const Dots: React.FC = () => (
  <div style={{ display: 'flex', gap: 10 }}>
    {[C.red, C.orange, '#34d399'].map((c) => (
      <span key={c} style={{ width: 14, height: 14, borderRadius: '50%', background: c }} />
    ))}
  </div>
);

const Status: React.FC<{ frame: number }> = ({ frame }) => {
  const running = frame >= BOOT_AT;
  const building = frame >= WHOOSH_AT && !running;
  const color = running ? C.green : building ? C.blue100 : C.slate500;
  const label = running ? 'RUNNING' : building ? 'BUILDING' : 'IDLE';
  const blink = building ? (Math.floor(frame / 4) % 2 === 0 ? 1 : 0.35) : 1;
  const burst = running ? 1 - progress(frame, BOOT_AT, 18, EASE.out) : 0;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: color,
          opacity: blink,
          boxShadow: running ? `0 0 ${10 + 30 * burst}px ${C.green}` : undefined,
        }}
      />
      <Mono size={18} color={color} tracking="0.1em" weight={600}>
        {running ? scramble(label, progress(frame, BOOT_AT, 8, EASE.linear), frame, 'run', 2) : label}
      </Mono>
    </span>
  );
};

export const Dockerfile: React.FC = () => {
  const frame = useCurrentFrame();

  // Camera: slow push + drift toward the image as the build happens, dive at the end.
  const exit = progress(frame, EXIT_AT, END - EXIT_AT, EASE.in);
  const push = lerp(1, 1.045, frame / END) + exit * 0.9;
  const panX = lerp(18, -22, progress(frame, WHOOSH_AT - 6, 30, EASE.inOut));
  const tilt = lerp(3.5, -3, progress(frame, 0, END, EASE.balanced));
  const hitA = shake(frame, 0, 16, 12, 'df-a');
  const hitB = shake(frame, BOOT_AT, 16, 10, 'df-b');
  const camX = panX + hitA.x + hitB.x;
  const camY = hitA.y + hitB.y;

  // Headline.
  const h1 = progress(frame, -4, 14, EASE.out);
  const h2 = progress(frame, -1, 14, EASE.out);
  const sweep = progress(frame, BOOT_AT, 22, EASE.inOut);

  // Cards.
  const codeIn = progress(frame, -2, 16, EASE.out);
  const imgIn = progress(frame, -2, 16, EASE.out);
  const codeGlow =
    progress(frame, beats(1.5), 8, EASE.out) * (1 - progress(frame, WHOOSH_AT + 4, 14, EASE.standard));
  const boot = progress(frame, BOOT_AT, 6, EASE.out);
  const bootFlash = frame >= BOOT_AT ? 1 - progress(frame, BOOT_AT, 16, EASE.out) : 0;
  const ring = progress(frame, BOOT_AT, 26, EASE.out);

  // Size readout.
  const shrink = progress(frame, WHOOSH_AT + 2, BOOT_AT - WHOOSH_AT - 2, EASE.inOut);
  const size = lerp(SIZE_FROM, SIZE_TO, shrink);
  const sizeOn = progress(frame, WHOOSH_AT, 5, EASE.out);

  // Build axis (LOCAL → REMOTE · UKC).
  const axis = progress(frame, beats(1.5), BOOT_AT - beats(1.5), EASE.inOut);

  const activeLine = LINES.findIndex((l, i) => {
    const len = l.kw.length + 1 + l.arg.length;
    return typed(frame, TYPE_AT + i * LINE_GAP, len, len / 5) < len;
  });
  const cursorLine = activeLine === -1 ? LINES.length - 1 : activeLine;
  const blinkOn = Math.floor(frame / 12) % 2 === 0;

  const badge = pop(frame, BOOT_AT, { damping: 11, stiffness: 260 });

  return (
    <AbsoluteFill>
      <Backdrop
        variant="tintC"
        aura={1.1 + boot * 0.6}
        auraX={lerp(30, 72, shrink)}
        auraY={60}
        grid={0.05}
        gridOffset={{ x: -frame * 0.6, y: 0 }}
      />

      <AbsoluteFill
        style={{
          transform: `translate(${camX}px, ${camY}px) scale(${push}) rotate(${hitA.r + hitB.r}deg)`,
          transformOrigin: '1460px 630px',
          filter: exit > 0.02 ? `blur(${exit * 10}px)` : undefined,
          opacity: 1 - progress(frame, END - 4, 4, EASE.linear),
        }}
      >
        {/* Headline */}
        <div
          style={{
            position: 'absolute',
            left: 120,
            top: 164,
            ...TYPE.display,
            fontSize: 98,
            transform: `translateX(${-panX * 0.4}px)`,
          }}
        >
          <div
            style={{
              color: C.slate300,
              opacity: h1,
              transform: `translateY(${(1 - h1) * 34}px) scale(${lerp(1.08, 1, h1)})`,
              transformOrigin: '0 50%',
              filter: h1 < 0.98 ? `blur(${(1 - h1) * 10}px)` : undefined,
            }}
          >
            A standard Dockerfile.
          </div>
          <div
            style={{
              color: C.blue400,
              opacity: h2,
              transform: `translateY(${(1 - h2) * 34}px) scale(${lerp(1.08, 1, h2)})`,
              transformOrigin: '0 50%',
              filter: h2 < 0.98 ? `blur(${(1 - h2) * 10}px)` : undefined,
              backgroundImage:
                sweep > 0 && sweep < 1
                  ? `linear-gradient(100deg, ${C.blue400} ${sweep * 130 - 30}%, ${C.blue50} ${sweep * 130 - 12}%, ${C.blue400} ${sweep * 130}%)`
                  : undefined,
              WebkitBackgroundClip: sweep > 0 && sweep < 1 ? 'text' : undefined,
              WebkitTextFillColor: sweep > 0 && sweep < 1 ? 'transparent' : undefined,
              paddingBottom: 8,
            }}
          >
            A radically different runtime.
          </div>
        </div>

        <div style={{ position: 'absolute', inset: 0, perspective: 2400 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `rotateY(${tilt}deg)`,
              transformOrigin: '960px 630px',
            }}
          >
            {/* Dockerfile card */}
            <div
              style={{
                position: 'absolute',
                left: CODE.x,
                top: CODE.y,
                width: CODE.w,
                height: CODE.h,
                borderRadius: 22,
                background: `linear-gradient(160deg, ${alpha(C.blue400, 0.04 + codeGlow * 0.06)} 0%, ${TERM.bg} 55%)`,
                border: `2px solid ${mix(C.slate800, C.blue400, codeGlow)}`,
                boxShadow: `0 40px 80px -40px rgba(0,0,0,0.9), 0 0 ${50 * codeGlow}px ${alpha(C.blue400, 0.3 * codeGlow)}`,
                opacity: codeIn,
                transform: `translate(${(1 - codeIn) * -80}px, ${(1 - codeIn) * 40}px)`,
                fontFamily: FONT.mono,
              }}
            >
              <div
                style={{
                  height: HEADER_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 28px',
                  borderBottom: `1px solid ${C.slate800}`,
                }}
              >
                <Dots />
                <Mono size={18} color={C.slate500} tracking="0.12em" weight={600}>
                  Dockerfile
                </Mono>
              </div>
            </div>
            {LINES.map((l, i) => {
              const text = `${l.kw} ${l.arg}`;
              const at = TYPE_AT + i * LINE_GAP;
              const shown = typed(frame, at, text.length, text.length / 5);
              const consumed = progress(frame, WHOOSH_AT + i * 1.5, 5, EASE.out);
              const flare = consumed * (1 - progress(frame, WHOOSH_AT + i * 1.5 + 5, 10, EASE.standard));
              const kwShown = text.slice(0, Math.min(shown, l.kw.length));
              const argShown = text.slice(l.kw.length, shown);
              return (
                <div
                  key={l.kw}
                  style={{
                    position: 'absolute',
                    left: CODE.x + 36,
                    top: lineY(i) - LINE_H / 2,
                    height: LINE_H,
                    display: 'flex',
                    alignItems: 'center',
                    whiteSpace: 'pre',
                    fontFamily: FONT.mono,
                    fontSize: 31,
                    opacity:
                      codeIn * lerp(1, 0.4, progress(frame, WHOOSH_AT + i * 1.5 + 4, 10, EASE.standard)),
                    transform: `translateX(${flare * 10}px)`,
                    textShadow: flare > 0 ? `0 0 ${24 * flare}px ${alpha(C.blue400, flare)}` : undefined,
                  }}
                >
                  <span style={{ color: mix(C.blue200, C.blue50, flare), fontWeight: 700 }}>{kwShown}</span>
                  <span style={{ color: mix(C.slate400, C.blue50, flare) }}>{argShown}</span>
                  {i === cursorLine &&
                    frame >= TYPE_AT - 6 &&
                    frame < WHOOSH_AT &&
                    (activeLine !== -1 || blinkOn) && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: '0.55ch',
                          height: '1.1em',
                          marginLeft: 2,
                          background: C.slate300,
                        }}
                      />
                    )}
                </div>
              );
            })}

            {/* Connectors */}
            <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              {WIRES.map((d, i) => (
                <Wire
                  key={d}
                  d={d}
                  progress={progress(frame, WIRE_AT + i * 1.5, 10, EASE.inOut)}
                  color={alpha(C.blue400, 0.75)}
                  width={2.5}
                />
              ))}
              {WIRES.map((d, i) =>
                frame >= BOOT_AT ? (
                  <path
                    key={`flow-${d}`}
                    d={d}
                    fill="none"
                    stroke={C.blue100}
                    strokeWidth={2.5}
                    strokeDasharray="8 14"
                    strokeDashoffset={-(frame - BOOT_AT) * 2.2 - i * 5}
                    opacity={0.7 * progress(frame, BOOT_AT, 10, EASE.out)}
                  />
                ) : null,
              )}
              {WIRES.map((_, i) => (
                <circle
                  key={`port-${i}`}
                  cx={CODE.x + CODE.w}
                  cy={lineY(i)}
                  r={5}
                  fill={TERM.bg}
                  stroke={C.blue400}
                  strokeWidth={2}
                  opacity={progress(frame, WIRE_AT + i * 1.5, 4, EASE.out)}
                />
              ))}
              {/* Comets: each line streams into the image. */}
              {WIRES.map((d, i) => {
                const start = WHOOSH_AT + i * 1.5;
                const t = progress(frame, start, 9, EASE.in);
                if (frame < start || t >= 1) {
                  return null;
                }
                return (
                  <g key={`comet-${d}`}>
                    <circle
                      cx={pointOnPath(d, t).x}
                      cy={pointOnPath(d, t).y}
                      r={24}
                      fill={C.blue400}
                      opacity={0.28}
                    />
                    {Array.from({ length: 9 }).map((__, k) => {
                      const tt = t - k * 0.04;
                      if (tt <= 0) {
                        return null;
                      }
                      const p = pointOnPath(d, tt);
                      return (
                        <circle
                          key={k}
                          cx={p.x}
                          cy={p.y}
                          r={(k === 0 ? 9 : 7) * (1 - k / 10)}
                          fill={k === 0 ? C.blue50 : C.blue400}
                          opacity={(1 - k / 9) * 0.9}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>
            <div
              style={{
                position: 'absolute',
                left: 850,
                width: 240,
                top: 492,
                textAlign: 'center',
                opacity: progress(frame, beats(1.5), 6, EASE.out),
              }}
            >
              <Mono size={19} color={C.slate400} tracking="0.04em" upper={false}>
                <span style={{ color: C.blue300, fontWeight: 700 }}>$ </span>
                {scramble('unikraft build', progress(frame, beats(1.5), 10, EASE.linear), frame, 'ukb', 3)}
              </Mono>
            </div>

            {/* microVM image card */}
            <div
              style={{
                position: 'absolute',
                left: IMG.x,
                top: IMG.y,
                width: IMG.w,
                height: IMG.h,
                borderRadius: 22,
                background: `linear-gradient(160deg, ${alpha(C.blue400, 0.03 + boot * 0.08)} 0%, ${TERM.bg} 60%)`,
                border: `2px ${frame < WHOOSH_AT ? 'dashed' : 'solid'} ${mix(C.slate700, C.blue400, boot)}`,
                boxShadow: `0 40px 80px -40px rgba(0,0,0,0.9), 0 0 ${70 * boot}px ${alpha(C.blue400, 0.35 * boot)}`,
                opacity: imgIn,
                transform: `translate(${(1 - imgIn) * 80}px, ${(1 - imgIn) * 40}px) scale(${1 + bootFlash * 0.03})`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: HEADER_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 28px',
                  borderBottom: `1px solid ${C.slate800}`,
                }}
              >
                <Mono
                  size={18}
                  color={frame >= BOOT_AT ? C.blue100 : C.slate500}
                  tracking="0.12em"
                  weight={600}
                >
                  microVM image
                </Mono>
                <Status frame={frame} />
              </div>
              {/* footer rule */}
              <div
                style={{
                  position: 'absolute',
                  left: 28,
                  right: 28,
                  top: 736 - IMG.y,
                  height: 1,
                  background: C.slate800,
                }}
              />
              {/* size meter */}
              <div
                style={{
                  position: 'absolute',
                  left: 28,
                  right: 28,
                  top: 750 - IMG.y,
                  height: 10,
                  borderRadius: 5,
                  background: alpha(C.slate700, 0.45),
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(size / SIZE_FROM) * 100 * sizeOn}%`,
                    height: '100%',
                    borderRadius: 5,
                    background: mix(C.slate500, C.blue400, clamp(shrink * 1.4)),
                    boxShadow: `0 0 16px ${alpha(C.blue400, 0.6 * shrink)}`,
                  }}
                />
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 28,
                  right: 28,
                  top: 772 - IMG.y,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <Mono
                  size={19}
                  color={frame >= BOOT_AT ? C.blue100 : C.slate500}
                  tracking="0.1em"
                  weight={600}
                >
                  {frame >= BOOT_AT
                    ? scramble(
                        'OCI · FIRECRACKER',
                        progress(frame, BOOT_AT, 12, EASE.linear),
                        frame,
                        'oci',
                        3,
                      )
                    : 'microvm'}
                </Mono>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 24,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span style={{ color: sizeOn > 0 ? C.blue100 : C.slate600 }}>
                    {sizeOn > 0 ? `${Math.round(size)} MB` : '— MB'}
                  </span>
                  <span
                    style={{
                      color: C.green,
                      marginLeft: 12,
                      opacity: progress(frame, BOOT_AT - 2, 6, EASE.out),
                    }}
                  >
                    ↓91%
                  </span>
                </span>
              </div>
              {/* boot flash */}
              {bootFlash > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(90% 90% at 50% 50%, ${alpha(C.blue50, 0.5 * bootFlash)} 0%, ${alpha(C.blue400, 0.35 * bootFlash)} 60%, transparent 100%)`,
                  }}
                />
              )}
            </div>

            {/* Stacked blocks (in frame coordinates, above the card body) */}
            {BLOCKS.map((b, bi) => {
              const land = pop(frame, b.at, { damping: 12, stiffness: 320, mass: 0.6 });
              const on = frame >= b.at;
              const light = progress(frame, BOOT_AT + (BLOCKS.length - 1 - bi) * 2, 7, EASE.out);
              const tone = mix(C.slate500, C.blue400, light);
              const fill = b.solid
                ? { backgroundColor: alpha(tone, lerp(0.1, 0.2, light)) }
                : hatch(tone, { line: lerp(38, 58, light), tint: lerp(6, 12, light), stripe: 3, gap: 6 });
              return (
                <div
                  key={b.label}
                  style={{ position: 'absolute', left: STACK.x, top: b.y, width: STACK.w, height: b.h }}
                >
                  {/* empty slot */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 8,
                      border: `2px dashed ${alpha(C.slate600, 0.6)}`,
                      opacity: imgIn * (1 - clamp(land * 2)),
                    }}
                  />
                  {on && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 8,
                        border: `2px solid ${alpha(tone, lerp(0.45, 0.8, light))}`,
                        ...fill,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: clamp(land * 3),
                        transform: `translateY(${(1 - land) * -70}px) scaleY(${lerp(1.25, 1, clamp(land))})`,
                        transformOrigin: '50% 100%',
                        boxShadow:
                          light > 0 ? `0 0 ${24 * light}px ${alpha(C.blue400, 0.35 * light)}` : undefined,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontWeight: 700,
                          fontSize: b.solid ? 26 : 22,
                          letterSpacing: '0.12em',
                          color: mix(C.slate300, C.blue50, light),
                          paintOrder: 'stroke fill',
                          WebkitTextStroke: `6px ${TERM.bg}`,
                        }}
                      >
                        {b.label}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Boot ripple */}
            {frame >= BOOT_AT && ring < 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: IMG.x,
                  top: IMG.y,
                  width: IMG.w,
                  height: IMG.h,
                  borderRadius: 22,
                  border: `3px solid ${C.blue400}`,
                  opacity: (1 - ring) * 0.8,
                  transform: `scale(${1 + ring * 0.12})`,
                }}
              />
            )}

            {/* ~10× smaller badge */}
            {frame >= BOOT_AT && (
              <div
                style={{
                  position: 'absolute',
                  left: IMG.x + IMG.w - 262,
                  top: IMG.y - 80,
                  transform: `scale(${badge}) rotate(${lerp(-8, -3, badge)}deg)`,
                  transformOrigin: '50% 50%',
                }}
              >
                <Chip
                  label="~10× smaller"
                  tone="green"
                  size={28}
                  mono
                  glow={1 - progress(frame, BOOT_AT, 30, EASE.standard) * 0.6}
                  style={{ background: mix(TERM.bg, '#0f2a1a', 0.8) }}
                />
              </div>
            )}
          </div>
        </div>
        {/* Build axis */}
        <div
          style={{
            position: 'absolute',
            left: 120,
            top: 884,
            width: 1680,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            opacity: progress(frame, 6, 12, EASE.out),
          }}
        >
          <Mono size={17} color={C.slate500} tracking="0.12em" weight={600}>
            Local
          </Mono>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: C.slate800, overflow: 'hidden' }}>
            <div
              style={{
                width: `${axis * 100}%`,
                height: '100%',
                background: C.blue400,
                boxShadow: `0 0 12px ${C.blue400}`,
              }}
            />
          </div>
          <Mono size={17} color={axis >= 1 ? C.blue100 : C.slate500} tracking="0.12em" weight={600}>
            Remote · UKC
          </Mono>
        </div>
      </AbsoluteFill>

      {/* Screen flashes: impact at b0, boot at b2.5 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: C.blue400,
          mixBlendMode: 'screen',
          opacity: Math.max(0.12 * (1 - progress(frame, 0, 4, EASE.linear)), 0.2 * bootFlash),
        }}
      />
    </AbsoluteFill>
  );
};
