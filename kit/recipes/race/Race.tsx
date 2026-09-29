import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../design/Backdrop';
import { Chip } from '../../design/Chip';
import { clamp, EASE, lerp, pop, progress, shake } from '../../design/motion';
import { hatchBorder } from '../../design/patterns';
import { SplitText } from '../../design/Text';
import { alpha, C, FONT, TYPE } from '../../design/tokens';
import { useScene } from '../../video/SceneContext';
import { finishOrder, laneDisplay, type RaceProps } from './plan';

const PANEL_W = 1620;
const PAD = 56;
const LANE_Y0 = 176;

const Spinner: React.FC<{ size: number; frame: number; color: string }> = ({ size, frame, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{ transform: `rotate(${frame * 14}deg)`, flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="9" fill="none" stroke={alpha(color, 0.25)} strokeWidth="3" />
    <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** Expanding ring + vertical finish flash at a bar's end. */
const FinishBurst: React.FC<{
  frame: number;
  at: number;
  x: number;
  barH: number;
  color: string;
  strength: number;
}> = ({ frame, at, x, barH, color, strength }) => {
  if (frame < at) {
    return null;
  }
  const p = progress(frame, at, 24, EASE.out);
  const r = lerp(10, 110 * strength, p);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - r,
          top: barH / 2 - r,
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
          height: barH + 60,
          borderRadius: 2,
          background: color,
          boxShadow: `0 0 24px ${color}`,
          opacity: 1 - progress(frame, at, 14, EASE.out),
        }}
      />
    </>
  );
};

/** `[100×]` → the accent runs, glowing. */
const Headline: React.FC<{ text: string; glow: number }> = ({ text, glow }) => (
  <>
    {text.split(/(\[[^\]]*\])/).map((part, i) =>
      part.startsWith('[') ? (
        <span
          key={i}
          style={{
            color: C.blue400,
            textShadow: `0 0 ${40 * glow}px ${alpha(C.blue400, 0.7)}, 0 0 ${120 * glow}px ${alpha(C.blue400, 0.35)}`,
          }}
        >
          {part.slice(1, -1)}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )}
  </>
);

export const Race: React.FC = () => {
  const frame = useCurrentFrame();
  const { props, at, dur, frames, video } = useScene<RaceProps>();
  const { lanes } = props;
  const unit = props.unit ?? 'ms';
  const amp = video.preset.shake;

  // --- Simulated clock ----------------------------------------------------
  const order = finishOrder(lanes);
  const finishAt = lanes.map((l, i) => (l.pending ? Infinity : at(`finish${i}`)));
  const legs = order.map((i) => ({ at: finishAt[i], v: lanes[i].value }));
  const pendingMax = Math.max(0, ...lanes.filter((l) => l.pending).map((l) => l.value));
  const startAt = at('start');
  const slamAt = at('slam');
  const exitAt = at('exit');
  const last = legs[legs.length - 1];
  let t: number;
  if (frame <= legs[0].at) {
    t = legs[0].v * clamp((frame - startAt) / (legs[0].at - startAt));
  } else if (frame <= last.at) {
    const k = legs.findIndex((l) => frame <= l.at);
    const a = legs[k - 1];
    const b = legs[k];
    t = a.v * (b.v / a.v) ** ((frame - a.at) / (b.at - a.at));
  } else {
    t = pendingMax ? last.v * (pendingMax / last.v) ** clamp((frame - last.at) / (frames - last.at)) : last.v;
  }
  const running = frame >= startAt && (pendingMax > 0 || frame < last.at);
  const seconds = unit === 'ms' && t >= 1000;
  const clockLabel = seconds ? (t / 1000).toFixed(t < 10000 ? 2 : 1) : `${Math.floor(t)}`;
  const clockUnit = seconds ? 's' : unit;

  // --- Geometry -----------------------------------------------------------
  const n = lanes.length;
  const laneH = n <= 3 ? 124 : 104;
  const barH = n <= 3 ? 64 : 56;
  const panelH = LANE_Y0 + (n - 1) * laneH + barH + 90;
  const panelY = (1080 - panelH) / 2 + 6;
  const labelW = clamp(Math.max(...lanes.map((l) => l.label.length)) * 38 * 0.5 + 48, 300, 520);
  const trackX = PAD + labelW;
  const trackW = PANEL_W - trackX - PAD;
  const base = legs[0].v;
  const vmax = Math.max(last.v, pendingMax);
  const frac = (v: number) => Math.log10(1 + v / base) / Math.log10(1 + vmax / base);
  const reach = pendingMax ? 0.9 : 0.6;
  const target = (v: number) => trackW * clamp(reach * frac(v), 0.05, 0.6);

  // --- Camera -------------------------------------------------------------
  const whip = progress(frame, 0, dur(13), EASE.out);
  const exit = progress(frame, exitAt, dur('exit'), EASE.in);
  const slamShake = shake(frame, slamAt, 22, 22 * amp, 'race-slam');
  const winShakes = order
    .filter((i) => lanes[i].highlight)
    .map((i) => shake(frame, finishAt[i], 10, 5 * amp, `race-win-${i}`));
  const camX =
    lerp(300, 0, whip) + slamShake.x + winShakes.reduce((a, s) => a + s.x, 0) + lerp(0, -760, exit);
  const camY = slamShake.y + winShakes.reduce((a, s) => a + s.y, 0);
  const camBlur = (1 - whip) * 7 + exit * 26;
  const push = lerp(1, 1.04, frame / frames);

  const back = progress(frame, slamAt - 3, 16, EASE.out);
  const panelScale = lerp(1, 0.86, back);
  const panelOpacity = lerp(1, 0.3, back);

  const winFlash = Math.max(
    0,
    ...order
      .filter((i) => lanes[i].highlight)
      .map((i) => (frame >= finishAt[i] ? 1 - progress(frame, finishAt[i], 16, EASE.out) : 0)),
  );
  const clockFlash = Math.max(
    0,
    ...order.map((i) =>
      frame >= finishAt[i]
        ? (lanes[i].highlight ? 1 : 0.6) * (1 - progress(frame, finishAt[i], 14, EASE.out))
        : 0,
    ),
  );

  const approach = progress(frame, slamAt - 4, 4, EASE.in);
  const slam = pop(frame, slamAt, { damping: 11, stiffness: 320 });
  const slamIn = frame >= slamAt ? 1 : approach;
  const settle = lerp(1, 1.035, progress(frame, slamAt, frames - slamAt, EASE.linear));
  const headScale = (frame < slamAt ? lerp(2.6, 1, approach) : lerp(0.93, 1, slam)) * settle;
  const slamFlash = frame >= slamAt ? 1 - progress(frame, slamAt, 12, EASE.out) : 0;
  const glow = 0.6 + 1.4 * slamFlash + 0.15 * Math.sin(frame * 0.2);
  const headSize = Math.min(168, Math.round(1680 / (props.headline.replace(/[[\]]/g, '').length * 0.52)));
  const rule = 150 * progress(frame, slamAt + 6, 20, EASE.out);
  const note = props.note ?? 'illustrative · not to scale';

  return (
    <AbsoluteFill style={{ backgroundColor: C.black, overflow: 'hidden' }}>
      <Backdrop
        variant="tintB"
        aura={1.1 + 1.2 * slamFlash + 0.6 * winFlash}
        auraX={50}
        auraY={52}
        grid={0.045}
        gridSize={64}
        gridOffset={{ x: camX * 0.3 - frame * 0.8, y: 0 }}
        vignette={0.6}
      />

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
        <div
          style={{
            position: 'absolute',
            left: (1920 - PANEL_W) / 2,
            top: panelY,
            width: PANEL_W,
            height: panelH,
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
          <div
            style={{
              ...TYPE.eyebrow,
              position: 'absolute',
              left: PAD,
              top: 54,
              fontSize: 26,
              letterSpacing: '0.1em',
              color: C.slate500,
              whiteSpace: 'nowrap',
            }}
          >
            {props.title ?? 'Cold start — time to a running environment'}
          </div>
          <div
            style={{
              position: 'absolute',
              right: PAD,
              top: 30,
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              fontFamily: FONT.mono,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 24, letterSpacing: '0.12em', color: running ? C.slate500 : C.slate600 }}>
              SIM T+
            </span>
            <span
              style={{
                fontSize: 60,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                color: clockFlash > 0.05 ? C.blue100 : C.slate200,
                textShadow:
                  clockFlash > 0.05 ? `0 0 ${30 * clockFlash}px ${alpha(C.blue400, 0.9)}` : undefined,
                minWidth: 150,
                textAlign: 'right',
              }}
            >
              {clockLabel}
            </span>
            <span style={{ fontSize: 30, color: C.slate400, minWidth: 44 }}>{clockUnit}</span>
          </div>
          <div
            style={{
              position: 'absolute',
              left: PAD,
              right: PAD,
              top: 122,
              height: 1.5,
              background: C.slate800,
            }}
          />

          {lanes.map((lane, i) => {
            const enter = progress(frame, -4 + i * 2, 14, EASE.out);
            const done = frame >= finishAt[i];
            const hit = done
              ? pop(frame, finishAt[i], {
                  damping: lane.highlight ? 10 : 12,
                  stiffness: lane.highlight ? 300 : 260,
                })
              : 0;
            const chipHit = done ? pop(frame, finishAt[i] + 8, { damping: 12, stiffness: 280 }) : 0;
            const flashL = lane.highlight && done ? 1 - progress(frame, finishAt[i], 16, EASE.out) : 0;
            // Pending lanes crawl on their own log curve, visibly behind every finisher.
            const w = lane.pending
              ? Math.max(
                  4,
                  trackW *
                    0.49 *
                    (Math.log(1 + t / (last.v * 0.4)) / Math.log(1 + lane.value / (last.v * 0.4))),
                )
              : target(lane.value) * clamp(t / lane.value);
            const display = laneDisplay(lane, unit);
            return (
              <div
                key={lane.label}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: LANE_Y0 + i * laneH,
                  width: PANEL_W,
                  height: barH,
                  opacity: enter,
                  transform: `translateX(${lerp(80, 0, enter)}px)`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: PAD,
                    top: 0,
                    height: barH,
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: FONT.sans,
                    fontSize: 38,
                    letterSpacing: '-0.02em',
                    fontWeight: lane.highlight ? 600 : 400,
                    color: lane.highlight ? C.blue50 : C.slate300,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lane.label}
                </div>
                <div style={{ position: 'absolute', left: trackX, top: 0, width: trackW, height: barH }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 10,
                      background: alpha(C.slate800, 0.35),
                      border: `1px solid ${alpha(C.slate700, 0.4)}`,
                    }}
                  />
                  {lane.pending ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: w,
                        height: barH,
                        borderRadius: 10,
                        boxSizing: 'border-box',
                        border: `2px dashed ${C.slate500}`,
                        backgroundColor: alpha(C.slate700, 0.5),
                        backgroundImage: `repeating-linear-gradient(45deg, ${C.slate600} 0px, ${C.slate600} 8px, transparent 8px, transparent 16px)`,
                        backgroundPosition: `${frame * 1.2}px 0`,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: w,
                        height: barH,
                        borderRadius: 10,
                        background: lane.highlight
                          ? flashL > 0
                            ? `linear-gradient(90deg, ${C.blue400}, ${alpha('#cfe3ff', 0.4 + 0.6 * flashL)})`
                            : C.blue400
                          : C.slate600,
                        boxShadow: lane.highlight
                          ? `0 0 ${24 + 50 * flashL}px ${alpha(C.blue400, 0.55 + 0.4 * flashL)}`
                          : undefined,
                        transform: done ? `scaleY(${lerp(lane.highlight ? 1.35 : 1.2, 1, hit)})` : undefined,
                      }}
                    />
                  )}
                  {!lane.pending && (
                    <FinishBurst
                      frame={frame}
                      at={finishAt[i]}
                      x={target(lane.value)}
                      barH={barH}
                      color={lane.highlight ? C.blue400 : C.slate400}
                      strength={lane.highlight ? 1 : 0.6}
                    />
                  )}
                  {!lane.pending && done && (
                    <div
                      style={{
                        position: 'absolute',
                        left: w + 24,
                        top: 0,
                        height: barH,
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
                          fontWeight: lane.highlight ? 700 : 400,
                          color: lane.highlight ? C.blue200 : C.slate300,
                          textShadow: lane.highlight
                            ? `0 0 ${16 + 30 * flashL}px ${alpha(C.blue400, 0.8)}`
                            : undefined,
                          display: 'inline-block',
                          transform: `scale(${lerp(1.5, 1, hit)})`,
                          transformOrigin: '0% 50%',
                        }}
                      >
                        {display}
                      </span>
                      {/* The chip lands once the readout has settled back, so they never overlap. */}
                      <div
                        style={{
                          transform: `scale(${lerp(0.6, 1, chipHit)})`,
                          transformOrigin: '0% 50%',
                          opacity: clamp(chipHit * 2),
                        }}
                      >
                        <Chip
                          label="running"
                          icon="solar:check-circle-bold"
                          tone={lane.highlight ? 'green' : 'slate'}
                          size={24}
                          mono
                          glow={lane.highlight ? 0.4 + flashL : 0}
                        />
                      </div>
                    </div>
                  )}
                  {lane.pending && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          left: w + 22,
                          top: 0,
                          height: barH,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          fontFamily: FONT.mono,
                          fontSize: 26,
                          letterSpacing: '0.06em',
                          color: C.slate400,
                          whiteSpace: 'nowrap',
                          opacity: frame >= startAt ? 1 : 0,
                        }}
                      >
                        <Spinner size={30} frame={frame} color={C.slate400} />
                        {`booting${'.'.repeat(1 + (Math.floor(frame / 8) % 3))}`}
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          height: barH,
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
                        {display}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {note && (
            <div
              style={{
                ...TYPE.eyebrow,
                position: 'absolute',
                right: PAD,
                bottom: 30,
                fontSize: 22,
                letterSpacing: '0.1em',
                textTransform: 'none',
                color: C.slate600,
                opacity: progress(frame, 10, 12),
              }}
            >
              {note}
            </div>
          )}
        </div>

        {frame >= slamAt - 4 && (
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
              <div style={{ ...TYPE.display, fontSize: headSize, color: C.slate300, whiteSpace: 'nowrap' }}>
                <Headline text={props.headline} glow={glow} />
              </div>
              {props.subline && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  <div
                    style={{
                      width: rule,
                      height: 2,
                      background: `linear-gradient(90deg, transparent, ${C.blue400})`,
                    }}
                  />
                  <div
                    style={{
                      ...TYPE.eyebrow,
                      fontSize: 30,
                      letterSpacing: '0.14em',
                      color: C.blue100,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <SplitText text={props.subline} by="word" at={slamAt + 8} stagger={2} duration={12} />
                  </div>
                  <div
                    style={{
                      width: rule,
                      height: 2,
                      background: `linear-gradient(270deg, transparent, ${C.blue400})`,
                    }}
                  />
                </div>
              )}
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
