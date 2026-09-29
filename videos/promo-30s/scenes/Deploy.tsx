import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Chip } from '../../../kit/design/Chip';
import type { IconName } from '../../../kit/design/icons-data';
import { Logo } from '../../../kit/design/Logo';
import { clamp, EASE, lerp, pop, progress, scramble, shake } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { checker } from '../../../kit/design/patterns';
import { alpha, C, FONT, mix, TERM, TYPE } from '../../../kit/design/tokens';
import { pointOnPath, Wire } from '../../../kit/design/Wire';

/**
 * 06 · GET STARTED — "Your cloud, your way." (2 beats, after the site's
 * DeployAnywhereDiagram). b0 the headline and the Unikraft Cloud box slam in
 * out of the Rotator's flash; four deployment chips land on b0.5 / b0.75 / b1
 * / b1.25, each at the end of a self-drawing connector; the `RUNS ON` line
 * decodes. From b1.5 the camera pushes into the Unikraft Cloud box.
 */

const END = beats(2);
const PUSH_AT = beats(1.5);
const EXIT_AT = END - 8;

const BOX = { cx: 960, y: 356, w: 640, h: 132 };
const BUS_Y = 574;
const CHIP_Y = 672;
const CHIPS: readonly { label: string; icon: IconName; x: number; at: number }[] = [
  { label: 'Hosted', icon: 'solar:cloud-bold', x: 320, at: beats(0.5) },
  { label: 'On-Prem', icon: 'solar:server-bold', x: 740, at: beats(0.75) },
  { label: 'BYOC', icon: 'solar:cloud-storage-bold', x: 1140, at: beats(1) },
  { label: 'Dedicated hosts', icon: 'solar:server-2-bold', x: 1540, at: beats(1.25) },
];
const WIRE_LEAD = 7;
// Chips start popping this many frames early so they already read on the blip.
const CHIP_LEAD = 3;
const R = 16;
const TRUNK_TOP = BOX.y + BOX.h;
const branch = (x: number): string => {
  const dir = x < BOX.cx ? -1 : 1;
  return [
    `M${BOX.cx},${BUS_Y - R}`,
    `Q${BOX.cx},${BUS_Y} ${BOX.cx + dir * R},${BUS_Y}`,
    `L${x - dir * R},${BUS_Y}`,
    `Q${x},${BUS_Y} ${x},${BUS_Y + R}`,
    `L${x},${CHIP_Y - 4}`,
  ].join(' ');
};
const WIRES = CHIPS.map((c) => branch(c.x));
const TRUNK = `M${BOX.cx},${TRUNK_TOP} L${BOX.cx},${BUS_Y - R}`;
const GROUP = { x: 130, y: 612, w: 1660, h: 188 };

export const Deploy: React.FC = () => {
  const frame = useCurrentFrame();

  // Camera.
  const pushIn = progress(frame, PUSH_AT, END - PUSH_AT, EASE.in);
  const exit = progress(frame, EXIT_AT, END - EXIT_AT, EASE.in);
  const scale = lerp(1, 1.035, frame / PUSH_AT) + pushIn * 0.18 + exit * 1.4;
  const tilt = lerp(16, 3, progress(frame, -2, 34, EASE.out));
  let sx = shake(frame, 0, 16, 14, 'dp-0').x;
  let sy = shake(frame, 0, 16, 14, 'dp-0').y;
  for (const c of CHIPS) {
    const s = shake(frame, c.at, 8, 4, `dp-${c.label}`);
    sx += s.x;
    sy += s.y;
  }

  const head = progress(frame, -4, 14, EASE.out);
  const boxPop = pop(frame, -2, { damping: 12, stiffness: 260 });
  const trunk = progress(frame, 4, 8, EASE.inOut);
  const group = progress(frame, 8, 8, EASE.out);
  const runsOn = progress(frame, beats(1.1), 12, EASE.linear);
  const cutFlash = 1 - progress(frame, 0, 12, EASE.out);

  return (
    <AbsoluteFill>
      <Backdrop
        variant="tintC"
        aura={1.3 + pushIn}
        auraX={50}
        auraY={44}
        grid={0.05}
        gridOffset={{ x: 0, y: frame * 0.6 }}
      />

      <AbsoluteFill
        style={{
          transform: `translate(${sx}px, ${sy}px) scale(${scale})`,
          transformOrigin: `${BOX.cx}px ${BOX.y + BOX.h / 2}px`,
          filter: exit > 0.05 ? `blur(${exit * 12}px)` : undefined,
          opacity: 1 - progress(frame, END - 4, 4, EASE.linear),
        }}
      >
        {/* Headline */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 168,
            textAlign: 'center',
            ...TYPE.display,
            fontSize: 124,
            whiteSpace: 'pre',
            color: C.slate300,
            opacity: head,
            transform: `translateY(${(1 - head) * 40}px) scale(${lerp(1.12, 1, head)})`,
            filter: head < 0.98 ? `blur(${(1 - head) * 12}px)` : undefined,
          }}
        >
          Your cloud, <span style={{ color: C.blue400 }}>your way.</span>
        </div>

        <div style={{ position: 'absolute', inset: 0, perspective: 1800 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `rotateX(${tilt}deg)`,
              transformOrigin: `${BOX.cx}px ${BOX.y}px`,
            }}
          >
            {/* DEPLOY IT group outline */}
            <div
              style={{
                position: 'absolute',
                left: GROUP.x,
                top: GROUP.y,
                width: GROUP.w,
                height: GROUP.h,
                borderRadius: 24,
                border: `2px dashed ${alpha(C.slate500, 0.55)}`,
                opacity: group,
                transform: `scale(${lerp(0.96, 1, group)})`,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 28,
                  top: 18,
                  fontFamily: FONT.mono,
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  color: C.slate400,
                }}
              >
                DEPLOY IT
              </span>
            </div>

            {/* Connectors */}
            <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              {WIRES.map((d, i) => {
                const c = CHIPS[i];
                // Each branch finishes drawing exactly as its chip lands.
                const p = progress(frame, c.at - CHIP_LEAD - WIRE_LEAD, WIRE_LEAD, EASE.inOut);
                const landed = frame >= c.at - CHIP_LEAD;
                return (
                  <g key={d}>
                    <Wire d={d} progress={p} color={C.blue400} width={3} glow={landed ? 1 : 0.5} />
                    {landed && (
                      <path
                        d={d}
                        fill="none"
                        stroke={C.blue100}
                        strokeWidth={3}
                        strokeDasharray="8 12"
                        strokeDashoffset={-(frame - c.at) * 1.8}
                        opacity={0.8 * progress(frame, c.at, 8, EASE.out)}
                      />
                    )}
                    {!landed && p > 0 && (
                      <circle
                        cx={pointOnPath(d, p).x}
                        cy={pointOnPath(d, p).y}
                        r={8}
                        fill={C.blue50}
                        style={{ filter: `drop-shadow(0 0 10px ${C.blue400})` }}
                      />
                    )}
                  </g>
                );
              })}
              <Wire d={TRUNK} progress={trunk} color={C.blue400} width={3} glow={1} />
              <path
                d={TRUNK}
                fill="none"
                stroke={C.blue100}
                strokeWidth={3}
                strokeDasharray="8 12"
                strokeDashoffset={-frame * 1.8}
                opacity={0.8 * progress(frame, CHIPS[0].at, 8, EASE.out)}
              />
            </svg>

            {/* Chips */}
            {CHIPS.map((c) => {
              if (frame < c.at - CHIP_LEAD) {
                return null;
              }
              const s = pop(frame, c.at - CHIP_LEAD, { damping: 12, stiffness: 380, mass: 0.5 });
              const burst = 1 - progress(frame, c.at - CHIP_LEAD, 16, EASE.out);
              return (
                <div
                  key={c.label}
                  style={{
                    position: 'absolute',
                    left: c.x,
                    top: CHIP_Y,
                    transform: `translate(-50%, ${(1 - s) * 26}px) scale(${lerp(0.55, 1, s)})`,
                    transformOrigin: '50% 0%',
                    opacity: clamp(s * 3),
                  }}
                >
                  <Chip
                    label={c.label}
                    icon={c.icon}
                    tone="blue"
                    size={34}
                    glow={0.35 + burst}
                    style={{
                      background: mix(TERM.bg, C.blue400, 0.55 * burst),
                      color: mix(C.blue100, C.white, burst),
                      border: `2px solid ${mix(C.blue400, C.blue100, burst)}`,
                    }}
                  />
                </div>
              );
            })}

            {/* Unikraft Cloud box */}
            <div
              style={{
                position: 'absolute',
                left: BOX.cx - BOX.w / 2,
                top: BOX.y,
                width: BOX.w,
                height: BOX.h,
                borderRadius: 24,
                border: `3px solid ${C.blue400}`,
                background: TERM.bg,
                boxShadow: `0 0 ${60 + 80 * cutFlash + 60 * pushIn}px ${alpha(C.blue400, 0.35 + 0.3 * cutFlash + 0.3 * pushIn)}`,
                transform: `scale(${lerp(1.3, 1, boxPop)})`,
                opacity: clamp(boxPop * 2.5),
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, ...checker(alpha(C.blue400, 0.3), 10) }} />
              <div
                style={{
                  position: 'relative',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 26,
                }}
              >
                <Logo height={62} glow={0.8} />
                <span
                  style={{
                    fontFamily: FONT.sans,
                    fontWeight: 700,
                    fontSize: 58,
                    letterSpacing: '-0.035em',
                    color: C.blue400,
                    textShadow: `0 0 30px ${alpha(C.blue400, 0.5)}`,
                    paintOrder: 'stroke fill',
                    WebkitTextStroke: `8px ${TERM.bg}`,
                  }}
                >
                  Unikraft Cloud
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RUNS ON line */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 850,
            display: 'flex',
            justifyContent: 'center',
            opacity: runsOn > 0 ? 1 : 0,
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '0.14em',
              color: C.slate400,
              whiteSpace: 'pre',
              padding: '12px 26px',
              borderRadius: 12,
              border: `2px dashed ${alpha(C.slate500, 0.5 * runsOn)}`,
            }}
          >
            <span style={{ color: C.blue100 }}>{scramble('RUNS ON', runsOn * 2.2, frame, 'ro-a', 2)}</span>
            {scramble(' · BARE METAL · VMS (E.G. EC2)', runsOn, frame, 'ro-b')}
          </span>
        </div>
      </AbsoluteFill>

      {/* The Rotator flashes out to white; the cut lands inside that flash. */}
      {cutFlash > 0.01 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 60% at 50% 40%, ${C.white} 0%, ${C.blue100} 45%, ${C.blue400} 100%)`,
            opacity: Math.pow(cutFlash, 2) * 0.7,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
