import { noise2D } from '@remotion/noise';
import type React from 'react';
import { useMemo } from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Icon } from '../../../kit/design/Icon';
import type { IconName } from '../../../kit/design/icons-data';
import { clamp, EASE, lerp, pop, progress, scramble, shake, tween } from '../../../kit/design/motion';
import { checker } from '../../../kit/design/patterns';
import { Display, Mono, SplitText } from '../../../kit/design/Text';
import { alpha, C, FONT, mix } from '../../../kit/design/tokens';
import { pointOnPath, Wire } from '../../../kit/design/Wire';

/*
 * Scale to zero (4 beats, absolute b22–b26).
 *   f0   whoosh — whip in, headline, the how-it-works request flow
 *        User → Proxy → Controller → VMM → Instance; the pulse wakes the Instance at f24.
 *   f30  camera pulls back, the instance multiplies into a 20×6 "UKC host" grid;
 *        requests wake tiles on every 8th (f45, f60, f75, f90, f105).
 *   f60  hit — "$0.00 IDLE COST" knocks a window out of the grid (pop + flash + shake).
 *   f114 whip out.
 */

// ——— Request flow (phase A, world = screen at camera p = 0) ———
const ROW_Y = 650;
const NODE_D = 120;
const NODE_X = [360, 660, 960, 1260, 1560];
const FLOW: { label: string; sub?: string; icon: IconName }[] = [
  { label: 'User', icon: 'solar:user-rounded-bold' },
  { label: 'Proxy', icon: 'solar:transfer-horizontal-bold' },
  { label: 'Controller', icon: 'solar:gamepad-bold' },
  { label: 'VMM', sub: 'Firecracker', icon: 'solar:server-square-bold' },
  { label: 'Instance', icon: 'solar:monitor-bold' },
];
const FWD_WORDS = ['req', 'buffer', 'id', 'resume'];
const PULSE_AT = 6;
const PULSE_DUR = 18; // reaches Controller on f15, Instance on f24
const WAKE_AT = PULSE_AT + PULSE_DUR;
const RETURN_AT = 26;
const RETURN_DUR = 12;
const TRACK = `M${NODE_X[0]},${ROW_Y} L${NODE_X[4]},${ROW_Y}`;
const RETURN_TRACK = `M${NODE_X[4]},${ROW_Y + 7} L${NODE_X[0]},${ROW_Y + 7}`;

// ——— Host grid (phase B) ———
const COLS = 20;
const ROWS = 6;
const TILE = 64;
const PITCH = 80;
const GRID_X = 160;
const GRID_Y = 410;
const INST_COL = 15;
const INST_ROW = 3;
const INST_INDEX = INST_ROW * COLS + INST_COL;
const S_END = TILE / NODE_D;
const PULL_AT = 30;
const PULL_DUR = 18;
const ANCHOR = { x: NODE_X[4], y: ROW_Y };
const tileCenter = (c: number, r: number) => ({ x: GRID_X + c * PITCH + TILE / 2, y: GRID_Y + r * PITCH + TILE / 2 });
const TARGET = tileCenter(INST_COL, INST_ROW);

// ——— $0 window (knocks out cols 5–14 × rows 1–4) ———
const LAND_AT = 60;
/** The window/number start a few frames early so they are mid-slam when the hit sounds on f60. */
const SLAM_AT = LAND_AT - 3;
const WIN = { c0: 5, c1: 14, r0: 1, r1: 4 };
const WIN_RECT = {
  x: GRID_X + WIN.c0 * PITCH,
  y: GRID_Y + WIN.r0 * PITCH,
  w: (WIN.c1 - WIN.c0) * PITCH + TILE,
  h: (WIN.r1 - WIN.r0) * PITCH + TILE,
};
const WIN_CX = WIN_RECT.x + WIN_RECT.w / 2;
const WIN_CY = WIN_RECT.y + WIN_RECT.h / 2;
const inWindow = (c: number, r: number) => c >= WIN.c0 && c <= WIN.c1 && r >= WIN.r0 && r <= WIN.r1;

const HITS = [45, 60, 75, 90, 105];
const HITS_PER_8TH = 11;
const AWAKE_HOLD = 12;
const AWAKE_FADE = 10;
const RING_DUR = 14;
const STREAK = 6;

const EXIT_AT = 114;

/** Tile index → frames it receives a request. Deterministic. */
const buildSchedule = (): number[][] => {
  const schedule: number[][] = Array.from({ length: COLS * ROWS }, () => []);
  schedule[INST_INDEX].push(WAKE_AT);
  for (const h of HITS) {
    const picked = new Set<number>();
    let n = 0;
    while (picked.size < HITS_PER_8TH && n < 400) {
      const idx = Math.floor(random(`s2z-hit-${h}-${n++}`) * COLS * ROWS);
      const c = idx % COLS;
      const r = Math.floor(idx / COLS);
      const last = schedule[idx][schedule[idx].length - 1] ?? -99;
      if ((h >= LAND_AT && inWindow(c, r)) || h - last < 30 || picked.has(idx)) {
        continue;
      }
      picked.add(idx);
      schedule[idx].push(h);
    }
  }
  return schedule;
};

/** 0 = asleep, 1 = running; `age` = frames since the latest request (or -1). */
const tileState = (hits: number[], frame: number): { level: number; age: number } => {
  let level = 0;
  let age = -1;
  for (const h of hits) {
    if (frame < h) {
      continue;
    }
    const dt = frame - h;
    age = dt;
    level = Math.max(level, dt < AWAKE_HOLD ? 1 : 1 - EASE.standard(clamp((dt - AWAKE_HOLD) / AWAKE_FADE)));
  }
  return { level, age };
};

const Tile: React.FC<{
  x: number;
  y: number;
  size: number;
  radius: number;
  level: number;
  age: number;
  breath: number;
  scale?: number;
  opacity?: number;
}> = ({ x, y, size, radius, level, age, breath, scale = 1, opacity = 1 }) => {
  const hitPop = age >= 0 && age < 12 ? 1 + 0.22 * (1 - EASE.out(age / 12)) : 1;
  const ringT = age >= 0 && age < RING_DUR ? age / RING_DUR : -1;
  const sleepFill = alpha(C.slate400, 0.07 + 0.09 * breath);
  const fill = level > 0 ? alpha(mix(C.slate600, C.blue400, level), lerp(0.14, 0.92, level)) : sleepFill;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        transform: `scale(${scale * hitPop})`,
        opacity,
      }}
    >
      {ringT >= 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: radius * 1.4,
            border: `1.5px solid ${C.blue100}`,
            transform: `scale(${1 + 0.7 * EASE.out(ringT)})`,
            opacity: 0.8 * (1 - ringT) ** 2,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          border: `1.5px solid ${level > 0 ? mix(C.slate700, C.blue200, level) : C.slate700}`,
          background: fill,
          boxShadow:
            level > 0.02
              ? `0 0 ${size * 0.55 * level}px ${alpha(C.blue400, 0.65 * level)}, inset 0 0 ${size * 0.25}px ${alpha(C.blue50, 0.25 * level)}`
              : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {level > 0.04 && (
          <Icon name="solar:monitor-bold" size={size * 0.42} color={alpha(C.blue50, 0.95 * level)} />
        )}
      </div>
    </div>
  );
};

const FlowNode: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const node = FLOW[i];
  const enter = pop(frame, -6 + i * 2, { damping: 13 });
  const lit = progress(frame, PULSE_AT + (PULSE_DUR * i) / 4 - 1, 5, EASE.out);
  const ringAge = frame - (PULSE_AT + (PULSE_DUR * i) / 4);
  const ringT = ringAge >= 0 && ringAge < 16 ? ringAge / 16 : -1;
  return (
    <div
      style={{
        position: 'absolute',
        left: NODE_X[i] - NODE_D / 2,
        top: ROW_Y - NODE_D / 2,
        width: NODE_D,
        height: NODE_D,
        transform: `scale(${enter})`,
      }}
    >
      {ringT >= 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${C.blue400}`,
            transform: `scale(${1 + 0.6 * EASE.out(ringT)})`,
            opacity: 1 - ringT,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2.5px solid ${mix(C.slate700, C.blue400, lit)}`,
          background: C.slate950,
          boxShadow: `0 0 ${36 * lit}px ${alpha(C.blue400, 0.45 * lit)}, inset 0 0 ${24 * lit}px ${alpha(C.blue400, 0.18 * lit)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={node.icon} size={52} color={mix(C.slate400, C.blue50, lit)} />
      </div>
    </div>
  );
};

const NodeLabel: React.FC<{ i: number; frame: number; status?: React.ReactNode }> = ({ i, frame, status }) => {
  const node = FLOW[i];
  const p = progress(frame, -3 + i * 2, 12);
  return (
    <div
      style={{
        position: 'absolute',
        left: NODE_X[i] - 150,
        width: 300,
        top: ROW_Y + NODE_D / 2 + 22,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        opacity: p,
        transform: `translateY(${(1 - p) * 14}px)`,
      }}
    >
      <Mono size={24} color={C.slate300} weight={600} tracking="0.06em">
        {node.label}
      </Mono>
      {node.sub && (
        <Mono size={15} color={C.slate600} tracking="0.12em">
          {node.sub}
        </Mono>
      )}
      {status}
    </div>
  );
};

export const ScaleToZero: React.FC = () => {
  const frame = useCurrentFrame();
  const schedule = useMemo(buildSchedule, []);

  // ——— Camera ———
  const p = progress(frame, PULL_AT, PULL_DUR, EASE.out);
  const s = lerp(1, S_END, p);
  const camX = lerp(ANCHOR.x, TARGET.x, p) - ANCHOR.x * s;
  const camY = lerp(ANCHOR.y, TARGET.y, p) - ANCHOR.y * s;
  const push = 1 + 0.035 * progress(frame, 40, 80, EASE.linear);
  const hitShake = shake(frame, LAND_AT, 18, 16, 's2z-land');
  const whipIn = 1 - progress(frame, 0, 10, EASE.out);
  const whipOut = progress(frame, EXIT_AT, 120 - EXIT_AT, EASE.in);
  const contentX = whipIn * 240 - whipOut * 520 + hitShake.x;
  const contentBlur = whipIn * 4 + whipOut * 22;
  const flowFade = 1 - progress(frame, PULL_AT, 9, EASE.standard);

  // ——— Pulse ———
  const pulseT = progress(frame, PULSE_AT, PULSE_DUR, EASE.linear);
  const pulse = pointOnPath(TRACK, pulseT);
  const retT = progress(frame, RETURN_AT, RETURN_DUR, EASE.inOut);
  const ret = pointOnPath(RETURN_TRACK, retT);

  // ——— Grid ———
  const land = progress(frame, SLAM_AT - 1, 10, EASE.out);
  let running = 0;
  let spawned = 0;
  const tiles: React.ReactNode[] = [];
  const streaks: React.ReactNode[] = [];
  const instScreen = { x: lerp(ANCHOR.x, TARGET.x, p), y: lerp(ANCHOR.y, TARGET.y, p) };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const { level, age } = tileState(schedule[idx], frame);
      if (level > 0.5) {
        running++;
      }
      if (idx === INST_INDEX) {
        spawned++;
        continue;
      }
      const dist = Math.hypot(c - INST_COL, r - INST_ROW);
      const bornAt = PULL_AT + 1 + dist * 1.05;
      const born = progress(frame, bornAt, 13, EASE.out);
      if (born <= 0) {
        continue;
      }
      spawned++;
      const slot = tileCenter(c, r);
      // Shockwave from the $0 window when it lands.
      const dx = slot.x - WIN_CX;
      const dy = slot.y - WIN_CY;
      const d = Math.hypot(dx, dy);
      const knocked = inWindow(c, r);
      let x = lerp(instScreen.x, slot.x, born);
      let y = lerp(instScreen.y, slot.y, born);
      let scale = lerp(0.25, 1, born);
      let opacity = clamp(born * 1.6);
      if (knocked) {
        x += (dx / d) * 70 * land;
        y += (dy / d) * 70 * land;
        scale *= 1 - land;
        opacity *= 1 - land;
      } else {
        const arrive = SLAM_AT + (d - 380) / 90;
        const wave = frame >= arrive ? (1 - clamp((frame - arrive) / 14)) ** 2 : 0;
        x += (dx / d) * 22 * wave;
        y += (dy / d) * 22 * wave;
        scale *= 1 + 0.12 * wave;
      }
      if (opacity <= 0.01) {
        continue;
      }
      const breath = (noise2D('s2z-breath', c * 0.35 + frame * 0.018, r * 0.35) + 1) / 2;
      tiles.push(
        <Tile
          key={idx}
          x={x}
          y={y}
          size={TILE}
          radius={8}
          level={level}
          age={age}
          breath={breath}
          scale={scale}
          opacity={opacity}
        />,
      );
      // Incoming request streak, arriving exactly on the 8th.
      for (const h of schedule[idx]) {
        const t = (frame - (h - STREAK)) / STREAK;
        if (t >= 0 && t <= 1.4) {
          const head = y - TILE / 2 - (1 - Math.min(1, t)) * 130;
          const tail = head - 70 * (1 - clamp((t - 1) / 0.4));
          streaks.push(
            <div
              key={`${idx}-${h}`}
              style={{
                position: 'absolute',
                left: x - 1.5,
                top: tail,
                width: 3,
                height: Math.max(0, head - tail),
                borderRadius: 2,
                background: `linear-gradient(180deg, ${alpha(C.blue400, 0)} 0%, ${C.blue100} 100%)`,
                boxShadow: `0 0 10px ${alpha(C.blue400, 0.8)}`,
              }}
            />,
          );
        }
      }
    }
  }

  // Instance: flow node → tile morph.
  const inst = tileState(schedule[INST_INDEX], frame);
  const instEnter = pop(frame, 2, { damping: 13 });
  const instSize = NODE_D * s;
  const instRadius = lerp(NODE_D / 2, 15, p) * s;
  const instAwake = inst.level;
  const asleepPreWake = frame < WAKE_AT;
  const instRingT = inst.age >= 0 && inst.age < 20 ? inst.age / 20 : -1;
  const instPop = inst.age >= 0 && inst.age < 14 ? 1 + 0.18 * (1 - EASE.out(inst.age / 14)) : 1;

  // Counters
  const counterIn = progress(frame, 35, 14, EASE.linear);
  const standby = spawned - running;
  const idleFlash = frame >= LAND_AT ? 1 - progress(frame, LAND_AT, 20, EASE.out) : 0;

  // $0 window
  const winIn = pop(frame, SLAM_AT, { damping: 15, stiffness: 260 });
  const numIn = pop(frame, SLAM_AT, { damping: 11, stiffness: 240 });
  const flash = frame >= LAND_AT ? 1 - progress(frame, LAND_AT, 12, EASE.out) : 0;
  const sweep = progress(frame, 72, 26, EASE.inOut);

  const headlineX = 120;
  const statusLabel = asleepPreWake ? 'STANDBY' : 'RUNNING';

  return (
    <AbsoluteFill>
      <Backdrop
        variant="tintC"
        grid={0.045}
        gridSize={80}
        gridOffset={{ x: -frame * 0.8 + contentX * 0.3, y: 10 }}
        aura={1.2 + 0.8 * flash}
        auraY={60}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${contentX}px, ${hitShake.y}px)`,
          filter: contentBlur > 0.1 ? `blur(${contentBlur}px)` : undefined,
          opacity: 1 - whipOut * 0.7,
        }}
      >
        {/* Headline */}
        <div style={{ position: 'absolute', left: headlineX, top: 158 }}>
          <Display size={104} color={C.slate300}>
            <SplitText text="Scale to zero." at={-8} by="word" stagger={3} duration={14} />
          </Display>
          <Display size={104} color={C.blue400} style={{ marginTop: 6 }}>
            <SplitText text="Resume in <10 ms." at={-2} by="word" stagger={3} duration={14} />
          </Display>
        </div>

        {/* Phase A tag (site copy), handed over to the live counters */}
        {frame < 40 && (
          <div
            style={{
              position: 'absolute',
              right: 120,
              top: 190,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 12,
              opacity: 1 - progress(frame, 29, 5, EASE.standard),
            }}
          >
            <Mono size={20} color={C.blue100} tracking="0.12em">
              {scramble('[02.10] Request path', progress(frame, 2, 14, EASE.linear), frame, 's2z-tag')}
            </Mono>
            <Mono size={26} color={C.slate400} tracking="0.08em">
              {scramble('Idle to first byte —', progress(frame, 6, 14, EASE.linear), frame, 's2z-tag2')}
            </Mono>
            <Mono size={26} color={C.slate300} tracking="0.08em">
              {scramble('inside one RTT.', progress(frame, 12, 12, EASE.linear), frame, 's2z-tag3')}
            </Mono>
          </div>
        )}

        {/* Live counters */}
        <div
          style={{
            position: 'absolute',
            right: 120,
            top: 186,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 14,
            opacity: clamp(counterIn * 3),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: C.blue400,
                boxShadow: `0 0 ${10 + 14 * (running / 14)}px ${C.blue400}`,
              }}
            />
            <Mono size={28} color={C.slate400} tracking="0.08em">
              {scramble('RUNNING', counterIn, frame, 's2z-run')}{' '}
              <span style={{ color: C.blue100, fontWeight: 600 }}>{String(running).padStart(3, '0')}</span>
              <span style={{ color: C.slate700 }}> · </span>
              {scramble('STANDBY', counterIn, frame, 's2z-sb')}{' '}
              <span style={{ color: C.slate300, fontWeight: 600 }}>{String(standby).padStart(3, '0')}</span>
            </Mono>
          </div>
          <Mono size={20} color={C.slate500} tracking="0.12em">
            {scramble('COLD START ', counterIn, frame, 's2z-cs')}
            <span style={{ color: C.slate300 }}>{scramble('< 10 MS', counterIn, frame, 's2z-cs2')}</span>
            <span style={{ color: C.slate700 }}> · </span>
            {scramble('IDLE COST ', counterIn, frame, 's2z-ic')}
            <span
              style={{
                color: mix(C.slate300, C.blue100, idleFlash),
                textShadow: idleFlash > 0 ? `0 0 ${18 * idleFlash}px ${C.blue400}` : undefined,
              }}
            >
              {scramble('$0', counterIn, frame, 's2z-ic2')}
            </span>
          </Mono>
        </div>

        {/* Stage (flow row + grid) with slow push */}
        <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: `${WIN_CX}px ${WIN_CY}px` }}>
          {/* Flow row in world space */}
          {flowFade > 0 && (
            <AbsoluteFill
              style={{
                transform: `translate(${camX}px, ${camY}px) scale(${s})`,
                transformOrigin: '0 0',
                opacity: flowFade,
              }}
            >
              <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                <Wire d={TRACK} progress={progress(frame, -2, 12)} color={C.slate800} width={3} />
                <Wire d={TRACK} progress={pulseT} color={C.blue400} width={3} glow={1.2} />
                {retT > 0 && retT < 1 && (
                  <Wire d={RETURN_TRACK} progress={retT} color={C.green} width={2} opacity={0.8} />
                )}
              </svg>
              {pulseT > 0 && pulseT < 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: pulse.x - 120,
                    top: pulse.y - 3,
                    width: 120,
                    height: 6,
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${alpha(C.blue100, 0)} 0%, ${C.blue50} 100%)`,
                    boxShadow: `0 0 18px ${C.blue400}, 0 0 40px ${alpha(C.blue400, 0.6)}`,
                  }}
                />
              )}
              {retT > 0 && retT < 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: ret.x - 8,
                    top: ret.y - 8,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: C.green,
                    boxShadow: `0 0 20px ${C.green}`,
                  }}
                />
              )}
              {FWD_WORDS.map((w, i) => {
                const at = PULSE_AT + (PULSE_DUR * (i + 0.5)) / 4 - 2;
                const q = progress(frame, at, 8);
                return (
                  <div
                    key={w}
                    style={{
                      position: 'absolute',
                      left: (NODE_X[i] + NODE_X[i + 1]) / 2 - 80,
                      width: 160,
                      top: ROW_Y - 50,
                      textAlign: 'center',
                      opacity: q,
                      transform: `translateY(${(1 - q) * 10}px)`,
                    }}
                  >
                    <Mono size={22} color={C.blue100} weight={600} upper={false} style={{ fontStyle: 'italic' }}>
                      {w}
                    </Mono>
                  </div>
                );
              })}
              {FLOW.slice(0, 4).map((_, i) => (
                <FlowNode key={i} i={i} frame={frame} />
              ))}
              {FLOW.map((_, i) => (
                <NodeLabel
                  key={i}
                  i={i}
                  frame={frame}
                  status={
                    i === 4 ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: `1px solid ${asleepPreWake ? C.slate700 : alpha(C.blue400, 0.7)}`,
                          background: asleepPreWake ? 'transparent' : alpha(C.blue400, 0.14),
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            background: asleepPreWake ? C.slate600 : C.blue400,
                            boxShadow: asleepPreWake ? undefined : `0 0 10px ${C.blue400}`,
                          }}
                        />
                        <Mono size={15} color={asleepPreWake ? C.slate500 : C.blue100} tracking="0.12em">
                          {statusLabel}
                        </Mono>
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </AbsoluteFill>
          )}

          {/* Request streaks + grid */}
          {streaks}
          {tiles}

          {/* Instance (flow node → host tile) */}
          <div
            style={{
              position: 'absolute',
              left: instScreen.x - instSize / 2,
              top: instScreen.y - instSize / 2,
              width: instSize,
              height: instSize,
              transform: `scale(${instEnter * instPop})`,
            }}
          >
            {instRingT >= 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: instRadius * 1.3,
                  border: `3px solid ${C.blue100}`,
                  transform: `scale(${1 + 0.9 * EASE.out(instRingT)})`,
                  opacity: 1 - instRingT,
                }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: instRadius,
                border: `${lerp(2.5, 1.5, p)}px ${asleepPreWake ? 'dashed' : 'solid'} ${
                  instAwake > 0 ? mix(C.slate700, C.blue200, instAwake) : C.slate600
                }`,
                background:
                  instAwake > 0
                    ? alpha(mix(C.slate600, C.blue400, instAwake), lerp(0.12, 0.92, instAwake))
                    : lerp(1, 0, p) > 0.5
                      ? C.slate950
                      : alpha(C.slate400, 0.12),
                boxShadow:
                  instAwake > 0.02
                    ? `0 0 ${instSize * 0.6 * instAwake}px ${alpha(C.blue400, 0.7 * instAwake)}`
                    : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {asleepPreWake ? (
                <Icon name="solar:moon-sleep-bold" size={instSize * 0.42} color={C.slate500} />
              ) : (
                instAwake > 0.04 && (
                  <Icon name="solar:monitor-bold" size={instSize * 0.42} color={alpha(C.blue50, 0.95 * instAwake)} />
                )
              )}
            </div>
          </div>

          {/* $0 window */}
          {frame >= SLAM_AT && (
            <div
              style={{
                position: 'absolute',
                left: WIN_RECT.x,
                top: WIN_RECT.y,
                width: WIN_RECT.w,
                height: WIN_RECT.h,
                transform: `scale(${lerp(0.6, 1, winIn)}, ${lerp(0.2, 1, winIn)})`,
                opacity: clamp(winIn * 2),
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 18,
                  background: alpha(C.black, 0.82),
                  border: `1.5px solid ${mix(C.slate700, C.blue400, flash)}`,
                  boxShadow: `0 0 ${60 + 80 * flash}px ${alpha(C.blue400, 0.18 + 0.4 * flash)}, inset 0 0 60px ${alpha(C.blue400, 0.08)}`,
                  overflow: 'hidden',
                }}
              >
                <AbsoluteFill style={{ ...checker(alpha(C.blue400, 0.07), 12) }} />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: 220,
                    left: lerp(-260, WIN_RECT.w + 40, sweep),
                    background: `linear-gradient(90deg, transparent, ${alpha(C.blue100, 0.12)}, transparent)`,
                    transform: 'skewX(-18deg)',
                    opacity: sweep > 0 && sweep < 1 ? 1 : 0,
                  }}
                />
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 18,
                  border: `1.5px dashed ${alpha(C.slate500, 0.5)}`,
                  margin: 10,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transform: `scale(${lerp(1.7, 1, numIn)})`,
                  filter: numIn < 0.9 ? `blur(${(1 - numIn) * 10}px)` : undefined,
                  opacity: clamp(numIn * 2.5),
                }}
              >
                <Mono size={20} color={C.slate500} tracking="0.16em">
                  Idle cost
                </Mono>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 176,
                    lineHeight: 1,
                    color: C.blue400,
                    letterSpacing: '-0.03em',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    textShadow: `0 0 ${30 + 60 * flash}px ${alpha(C.blue400, 0.45 + 0.4 * flash)}`,
                  }}
                >
                  $0<span style={{ color: C.slate500 }}>.00</span>
                </div>
                <Display size={46} color={C.slate300} style={{ letterSpacing: '-0.03em' }}>
                  while idle.
                </Display>
              </div>
            </div>
          )}
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Flash frame on the hit */}
      {flash > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 55% at ${(WIN_CX / 1920) * 100}% ${(WIN_CY / 1080) * 100}%, ${alpha(C.blue100, 0.55 * flash)} 0%, ${alpha(C.blue400, 0.18 * flash)} 60%, transparent 100%)`,
            mixBlendMode: 'screen',
          }}
        />
      )}
      {/* Whip-in flash */}
      {frame < 6 && (
        <AbsoluteFill style={{ background: alpha(C.blue100, 0.1 * (1 - tween(frame, [0, 6], [0, 1]))), mixBlendMode: 'screen' }} />
      )}
    </AbsoluteFill>
  );
};
