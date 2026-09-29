import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Chip } from '../../../kit/design/Chip';
import { clamp, EASE, lerp, pop, progress, shake } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { hatchBorder } from '../../../kit/design/patterns';
import { SplitText } from '../../../kit/design/Text';
import { alpha, C, FONT, TYPE } from '../../../kit/design/tokens';

/**
 * 02 · FAST — the race (4 beats, absolute b18–b22).
 * Whip in to the site's ColdStartComparisonDiagram, run as a race against a
 * simulated clock: Unikraft Cloud finishes at 10 ms (b0.5, chime), the
 * container at 150 ms (b1.5, blip), the traditional VM is still booting when
 * "Up to 100× faster" slams in on b2 and pushes the lanes back.
 */

const UK_DONE = beats(0.5); // 15
const CT_DONE = beats(1.5); // 45
const SLAM_AT = beats(2); // 60
const END = beats(4); // 120
const EXIT_AT = END - 7;

// Panel geometry (frame px).
const PANEL = { x: 150, y: 246, w: 1620, h: 600 };
const PAD = 56;
const LABEL_W = 400;
const TRACK_X = PAD + LABEL_W;
const TRACK_W = PANEL.w - TRACK_X - PAD;
const LANE_Y0 = 176;
const LANE_H = 124;
const BAR_H = 64;

// Target bar lengths (site: 8% / 38% / 78%, illustrative).
const UK_W = TRACK_W * 0.085;
const CT_W = TRACK_W * 0.38;
const VM_MAX = TRACK_W * 0.44;

/**
 * Simulated clock (ms) for a scene-local frame: linear to 10 ms at b0.5,
 * geometric to 150 ms at b1.5, then geometric into tens of seconds.
 */
const simMs = (frame: number): number => {
  if (frame <= UK_DONE) {
    return (10 * Math.max(0, frame)) / UK_DONE;
  }
  if (frame <= CT_DONE) {
    return 10 * 15 ** ((frame - UK_DONE) / (CT_DONE - UK_DONE));
  }
  return 150 * 300 ** ((frame - CT_DONE) / (END - CT_DONE));
};

const Spinner: React.FC<{ size: number; frame: number; color: string }> = ({ size, frame, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${frame * 14}deg)`, flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" fill="none" stroke={alpha(color, 0.25)} strokeWidth="3" />
    <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** Expanding ring + vertical finish flash at a bar's end. */
const FinishBurst: React.FC<{ frame: number; at: number; x: number; color: string; strength: number }> = ({
  frame,
  at,
  x,
  color,
  strength,
}) => {
  if (frame < at) {
    return null;
  }
  const p = progress(frame, at, 24, EASE.out);
  const r = lerp(10, 110 * strength, p);
  const line = 1 - progress(frame, at, 14, EASE.out);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - r,
          top: BAR_H / 2 - r,
          width: r * 2,
          height: r * 2,
          borderRadius: '50%',
          border: `${lerp(5, 1, p)}px solid ${alpha(color, (1 - p) * 0.9)}`,
          boxShadow: `0 0 30px ${alpha(color, (1 - p) * 0.6)}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - 2,
          top: -30,
          width: 4,
          height: BAR_H + 60,
          borderRadius: 2,
          background: color,
          boxShadow: `0 0 24px ${color}`,
          opacity: line,
        }}
      />
    </>
  );
};

export const Race: React.FC = () => {
  const frame = useCurrentFrame();
  const t = simMs(frame);

  // --- Camera -------------------------------------------------------------
  const whip = progress(frame, 0, 13, EASE.out);
  const exit = progress(frame, EXIT_AT, END - EXIT_AT, EASE.in);
  const slamShake = shake(frame, SLAM_AT, 22, 22, 'race-slam');
  const ukShake = shake(frame, UK_DONE, 10, 5, 'race-uk');
  const camX = lerp(300, 0, whip) + slamShake.x + ukShake.x + lerp(0, -760, exit);
  const camY = slamShake.y + ukShake.y;
  const camBlur = (1 - whip) * 7 + exit * 26;
  const push = lerp(1, 1.04, frame / END);

  // Push-back of the lanes on the slam.
  const back = progress(frame, SLAM_AT - 3, 16, EASE.out);
  const panelScale = lerp(1, 0.86, back);
  const panelOpacity = lerp(1, 0.3, back);

  // --- Bars ---------------------------------------------------------------
  const ukW = UK_W * clamp(t / 10);
  const ctW = CT_W * clamp(t / 150);
  const vmW = VM_MAX * clamp(Math.log(1 + t / 60) / Math.log(1 + 45000 / 60));
  const ukDone = frame >= UK_DONE;
  const ctDone = frame >= CT_DONE;
  const ukHit = pop(frame, UK_DONE, { damping: 10, stiffness: 300 });
  const ctHit = pop(frame, CT_DONE, { damping: 12, stiffness: 260 });
  const ukFlash = ukDone ? 1 - progress(frame, UK_DONE, 16, EASE.out) : 0;

  const clockLabel = t < 1000 ? `${Math.floor(t)}` : (t / 1000).toFixed(t < 10000 ? 2 : 1);
  const clockUnit = t < 1000 ? 'ms' : 's';
  const clockFlash =
    (ukDone ? 1 - progress(frame, UK_DONE, 14, EASE.out) : 0) + (ctDone ? 0.6 * (1 - progress(frame, CT_DONE, 12)) : 0);

  // Headline slam.
  // Approach on the 3 frames before the beat, land on it, then recoil.
  const approach = progress(frame, SLAM_AT - 4, 4, EASE.in);
  const slam = pop(frame, SLAM_AT, { damping: 11, stiffness: 320 });
  const slamIn = frame >= SLAM_AT ? 1 : approach;
  const settle = lerp(1, 1.035, progress(frame, SLAM_AT, END - SLAM_AT, EASE.linear));
  const headScale = (frame < SLAM_AT ? lerp(2.6, 1, approach) : lerp(0.93, 1, slam)) * settle;
  const slamFlash = frame >= SLAM_AT ? 1 - progress(frame, SLAM_AT, 12, EASE.out) : 0;
  const glow = 0.6 + 1.4 * slamFlash + 0.15 * Math.sin(frame * 0.2);

  const lanes = [
    {
      label: 'Unikraft Cloud',
      good: true,
      value: '~10 ms',
      bar: (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: ukW,
            height: BAR_H,
            borderRadius: 10,
            background: ukFlash > 0 ? `linear-gradient(90deg, ${C.blue400}, ${alpha('#cfe3ff', 0.4 + 0.6 * ukFlash)})` : C.blue400,
            boxShadow: `0 0 ${24 + 50 * ukFlash}px ${alpha(C.blue400, 0.55 + 0.4 * ukFlash)}`,
            transform: ukDone ? `scaleY(${lerp(1.35, 1, ukHit)})` : undefined,
          }}
        />
      ),
      end: ukW,
      done: ukDone,
      hit: ukHit,
    },
    {
      label: 'Container cold start',
      good: false,
      value: '~150 ms',
      bar: (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: ctW,
            height: BAR_H,
            borderRadius: 10,
            background: C.slate600,
            transform: ctDone ? `scaleY(${lerp(1.2, 1, ctHit)})` : undefined,
          }}
        />
      ),
      end: ctW,
      done: ctDone,
      hit: ctHit,
    },
    {
      label: 'Traditional VM',
      good: false,
      value: 'seconds → minutes',
      bar: (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: Math.max(vmW, 4),
            height: BAR_H,
            borderRadius: 10,
            boxSizing: 'border-box',
            border: `2px dashed ${C.slate500}`,
            backgroundColor: alpha(C.slate700, 0.5),
            backgroundImage: `repeating-linear-gradient(45deg, ${C.slate600} 0px, ${C.slate600} 8px, transparent 8px, transparent 16px)`,
            backgroundPosition: `${frame * 1.2}px 0`,
          }}
        />
      ),
      end: vmW,
      done: false,
      hit: 0,
    },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: C.black, overflow: 'hidden' }}>
      <Backdrop
        variant="tintB"
        aura={1.1 + 1.2 * slamFlash + 0.6 * ukFlash}
        auraX={50}
        auraY={52}
        grid={0.045}
        gridSize={64}
        gridOffset={{ x: camX * 0.3 - frame * 0.8, y: 0 }}
        vignette={0.6}
      />

      {/* Speed lines during the whip in / out. */}
      {(whip < 1 || exit > 0) &&
        [120, 260, 410, 530, 660, 790, 930].map((y, i) => {
          const k = whip < 1 ? 1 - whip : exit;
          const len = 300 + ((i * 137) % 5) * 90;
          const x = whip < 1 ? lerp(1920 - i * 90, -len, whip) : lerp(1920, -len - i * 120, exit);
          return (
            <div
              key={y}
              style={{
                position: 'absolute',
                top: y,
                left: x,
                width: len,
                height: i % 3 === 0 ? 3 : 2,
                background: `linear-gradient(90deg, transparent, ${alpha(i % 2 ? C.blue400 : C.slate300, 0.6 * k)}, transparent)`,
              }}
            />
          );
        })}

      <AbsoluteFill
        style={{
          transform: `translate(${camX}px, ${camY}px) rotate(${slamShake.r}deg) scale(${push})`,
          filter: camBlur > 0.2 ? `blur(${camBlur}px)` : undefined,
          opacity: 1 - exit * 0.85,
        }}
      >
        {/* Lanes panel */}
        <div
          style={{
            position: 'absolute',
            left: PANEL.x,
            top: PANEL.y,
            width: PANEL.w,
            height: PANEL.h,
            transform: `scale(${panelScale})`,
            opacity: panelOpacity,
            filter: back > 0.02 ? `blur(${back * 3}px)` : undefined,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 28,
              border: `1.5px solid ${C.slate800}`,
              background: `linear-gradient(180deg, ${alpha(C.slate900, 0.55)} 0%, ${alpha(C.slate950, 0.5)} 100%)`,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.02) inset, 0 60px 120px -40px rgba(0,0,0,0.85)`,
            }}
          />

          {/* Title + simulated clock */}
          <div
            style={{
              ...TYPE.eyebrow,
              position: 'absolute',
              left: PAD,
              top: 58,
              fontSize: 24,
              letterSpacing: '0.1em',
              color: C.slate500,
              whiteSpace: 'nowrap',
            }}
          >
            Cold start — time to a running environment
          </div>
          <div
            style={{
              position: 'absolute',
              right: PAD,
              top: 34,
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              fontFamily: FONT.mono,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 20, letterSpacing: '0.12em', color: C.slate600 }}>SIM T+</span>
            <span
              style={{
                fontSize: 60,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                color: clockFlash > 0.05 ? C.blue100 : C.slate200,
                textShadow: clockFlash > 0.05 ? `0 0 ${30 * clockFlash}px ${alpha(C.blue400, 0.9)}` : undefined,
                minWidth: 150,
                textAlign: 'right',
              }}
            >
              {clockLabel}
            </span>
            <span style={{ fontSize: 30, color: C.slate400, width: 44 }}>{clockUnit}</span>
          </div>
          <div style={{ position: 'absolute', left: PAD, right: PAD, top: 122, height: 1.5, background: C.slate800 }} />

          {lanes.map((lane, i) => {
            const enter = progress(frame, -4 + i * 2, 14, EASE.out);
            const top = LANE_Y0 + i * LANE_H;
            const valueIn = lane.done ? lerp(1.5, 1, lane.hit) : 1;
            const showValue = lane.good ? lane.done : i === 1 ? lane.done : true;
            return (
              <div
                key={lane.label}
                style={{
                  position: 'absolute',
                  left: 0,
                  top,
                  width: PANEL.w,
                  height: BAR_H,
                  opacity: enter,
                  transform: `translateX(${lerp(80, 0, enter)}px)`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: PAD,
                    top: 0,
                    height: BAR_H,
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: FONT.sans,
                    fontSize: 38,
                    letterSpacing: '-0.02em',
                    fontWeight: lane.good ? 600 : 400,
                    color: lane.good ? C.blue50 : C.slate300,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lane.label}
                </div>
                <div style={{ position: 'absolute', left: TRACK_X, top: 0, width: TRACK_W, height: BAR_H }}>
                  {/* Track */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 10,
                      background: alpha(C.slate800, 0.35),
                      border: `1px solid ${alpha(C.slate700, 0.4)}`,
                    }}
                  />
                  {lane.bar}
                  {lane.good && <FinishBurst frame={frame} at={UK_DONE} x={UK_W} color={C.blue400} strength={1} />}
                  {i === 1 && <FinishBurst frame={frame} at={CT_DONE} x={CT_W} color={C.slate400} strength={0.6} />}

                  {/* Values */}
                  {i < 2 && showValue && (
                    <div
                      style={{
                        position: 'absolute',
                        left: lane.end + 24,
                        top: 0,
                        height: BAR_H,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 36,
                          fontWeight: lane.good ? 700 : 400,
                          color: lane.good ? C.blue200 : C.slate300,
                          textShadow: lane.good ? `0 0 ${16 + 30 * ukFlash}px ${alpha(C.blue400, 0.8)}` : undefined,
                          display: 'inline-block',
                          transform: `scale(${valueIn})`,
                          transformOrigin: '0% 50%',
                        }}
                      >
                        {lane.value}
                      </span>
                      <div style={{ transform: `scale(${lerp(0.6, 1, lane.hit)})`, transformOrigin: '0% 50%', opacity: clamp(0.5 + lane.hit * 2) }}>
                        <Chip
                          label="running"
                          icon="solar:check-circle-bold"
                          tone={lane.good ? 'green' : 'slate'}
                          size={22}
                          mono
                          glow={lane.good ? 0.4 + ukFlash : 0}
                        />
                      </div>
                    </div>
                  )}
                  {i === 2 && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          left: vmW + 22,
                          top: 0,
                          height: BAR_H,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          fontFamily: FONT.mono,
                          fontSize: 24,
                          letterSpacing: '0.06em',
                          color: C.slate400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Spinner size={28} frame={frame} color={C.slate400} />
                        {`booting${'.'.repeat(1 + (Math.floor(frame / 8) % 3))}`}
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          height: BAR_H,
                          display: 'flex',
                          alignItems: 'center',
                          fontFamily: FONT.mono,
                          fontSize: 32,
                          color: C.slate400,
                          whiteSpace: 'nowrap',
                          paddingLeft: 18,
                          borderLeft: `2px dashed ${hatchBorder(C.slate500, 60)}`,
                        }}
                      >
                        {lane.value}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <div
            style={{
              ...TYPE.eyebrow,
              position: 'absolute',
              right: PAD,
              bottom: 34,
              fontSize: 18,
              letterSpacing: '0.1em',
              textTransform: 'none',
              color: C.slate600,
              opacity: progress(frame, 10, 12),
            }}
          >
            illustrative · not to scale
          </div>
        </div>

        {/* Headline slam */}
        {frame >= SLAM_AT - 4 && (
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(45% 38% at 50% 50%, ${alpha(C.black, 0.75 * back)} 0%, transparent 100%)`,
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 34,
                transform: `scale(${headScale})`,
                filter: slamIn < 0.95 ? `blur(${(1 - slamIn) * 18}px)` : undefined,
                opacity: slamIn,
              }}
            >
              <div style={{ ...TYPE.display, fontSize: 168, color: C.slate300, whiteSpace: 'nowrap' }}>
                Up to{' '}
                <span
                  style={{
                    color: C.blue400,
                    textShadow: `0 0 ${40 * glow}px ${alpha(C.blue400, 0.7)}, 0 0 ${120 * glow}px ${alpha(C.blue400, 0.35)}`,
                  }}
                >
                  100×
                </span>{' '}
                faster
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                <div
                  style={{
                    width: 150 * progress(frame, SLAM_AT + 6, 20, EASE.out),
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${C.blue400})`,
                  }}
                />
                <div style={{ ...TYPE.eyebrow, fontSize: 26, letterSpacing: '0.14em', color: C.blue100 }}>
                  <SplitText text="cold starts vs. containers & traditional VMs" by="word" at={SLAM_AT + 8} stagger={2} duration={12} />
                </div>
                <div
                  style={{
                    width: 150 * progress(frame, SLAM_AT + 6, 20, EASE.out),
                    height: 2,
                    background: `linear-gradient(270deg, transparent, ${C.blue400})`,
                  }}
                />
              </div>
            </div>
          </AbsoluteFill>
        )}
      </AbsoluteFill>

      {slamFlash > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(55% 45% at 50% 50%, ${alpha('#9cc6ff', 0.8)} 0%, ${alpha(C.blue400, 0.45)} 45%, transparent 100%)`,
            opacity: slamFlash * 0.8,
            mixBlendMode: 'screen',
          }}
        />
      )}
    </AbsoluteFill>
  );
};
