import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Icon } from '../../../kit/design/Icon';
import { clamp, EASE, lerp, pop, progress, shake } from '../../../kit/design/motion';
import { Accent, Display, Mono, Move } from '../../../kit/design/Text';
import { alpha, C, FONT, mix } from '../../../kit/design/tokens';
import { manhattanPath, pointOnPath, Wire } from '../../../kit/design/Wire';

/*
 * Fork (2 beats, absolute b26–b28). Impact on f0, `ticks` for the whole scene.
 * One generation per 8th: f0 → 2, f15 → 4, f30 → 8, f45 → 16, plus a 16th-note
 * burst to 32 on f51. The camera pulls out on every fork so the tree always
 * fills the frame; ends on the densest frame (hard cut into chapter 3).
 */

const FORKS = [0, 15, 30, 45, 51];
const GENS = FORKS.length + 1;
/** World layout (≈ screen at the final camera). */
const COL_X = [240, 540, 830, 1110, 1380, 1575];
const PITCH = [0, 180, 110, 62, 34, 17.5];
const SIZE = [84, 72, 60, 44, 26, 13.5];
const WIRE_W = [0, 2.5, 2.5, 2.2, 1.8, 1.3];
const CY = 640;
const GAP = 8;
const LABEL_SIZE = 14;
const WIRE_DRAW = 7;
const POP_DELAY = 4;
const EXIT_AT = 56;
/** Frame each generation's children pop (the last, tiny generation pops sooner). */
const POP_AT = FORKS.map((t, i) => t + (i === FORKS.length - 1 ? 3 : POP_DELAY));
const REGION = { x: 150, y: 322, w: 1620, h: 628 };

type Node = { g: number; j: number; x: number; y: number; size: number; parent: number; wire?: string };

const NODES: Node[] = [];
const GEN_START: number[] = [];
for (let g = 0; g < GENS; g++) {
  const n = 2 ** g;
  GEN_START.push(NODES.length);
  for (let j = 0; j < n; j++) {
    const x = COL_X[g];
    const y = CY + (j - (n - 1) / 2) * PITCH[g];
    const parent = g === 0 ? -1 : GEN_START[g - 1] + Math.floor(j / 2);
    const node: Node = { g, j, x, y, size: SIZE[g], parent };
    if (parent >= 0) {
      const p = NODES[parent];
      node.wire = manhattanPath(p.x + p.size / 2 + GAP, p.y, x - SIZE[g] / 2 - GAP, y, 12);
    }
    NODES.push(node);
  }
}

const PARENT_LABEL_Y = CY - SIZE[0] / 2 - 22;
const CHILD_LABEL_Y = CY - PITCH[1] / 2 - SIZE[1] / 2 - 22;

/** Camera framing (zoom + world centre) that fits generations 0..k into REGION. */
const STAGES = Array.from({ length: GENS }, (_, k) => {
  let x0 = COL_X[0] - SIZE[0] / 2 - 36;
  let x1 = COL_X[k] + SIZE[k] / 2 + 36;
  let y0 = PARENT_LABEL_Y - LABEL_SIZE - 16;
  let y1 = CY + SIZE[0] / 2 + 36;
  if (k >= 1) {
    y0 = Math.min(y0, CHILD_LABEL_Y - LABEL_SIZE - 16);
    x1 = Math.max(x1, COL_X[1] + 90);
  }
  for (let g = 1; g <= k; g++) {
    const half = ((2 ** g - 1) / 2) * PITCH[g] + SIZE[g] / 2;
    y0 = Math.min(y0, CY - half - 20);
    y1 = Math.max(y1, CY + half + 36);
  }
  x0 = Math.min(x0, COL_X[0] - 80);
  const z = Math.min(REGION.w / (x1 - x0), REGION.h / (y1 - y0), 2.2);
  return { z, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
});


export const Fork: React.FC = () => {
  const frame = useCurrentFrame();

  // ——— Camera ———
  let cam = { z: STAGES[1].z * 1.9, cx: COL_X[0] + 40, cy: CY };
  const intro = progress(frame, 0, 16, EASE.out);
  cam = {
    z: lerp(cam.z, STAGES[1].z, intro),
    cx: lerp(cam.cx, STAGES[1].cx, intro),
    cy: lerp(cam.cy, STAGES[1].cy, intro),
  };
  for (let k = 2; k < GENS; k++) {
    const q = progress(frame, FORKS[k - 1], 14, EASE.out);
    cam = { z: lerp(cam.z, STAGES[k].z, q), cx: lerp(cam.cx, STAGES[k].cx, q), cy: lerp(cam.cy, STAGES[k].cy, q) };
  }
  let punch = 1;
  let flash = 0;
  for (const t of FORKS) {
    if (frame >= t) {
      const d = 1 - progress(frame, t, 10, EASE.out);
      punch += t === 0 ? 0 : 0.03 * d;
      flash = Math.max(flash, (t === 0 ? 0.4 : 0.14) * (1 - progress(frame, t, 8, EASE.out)));
    }
  }
  const exit = progress(frame, EXIT_AT, 60 - EXIT_AT, EASE.in);
  const z = cam.z * punch * (1 + 0.07 * exit);
  const impact = shake(frame, 0, 16, 22, 'fork-impact');
  const tick = FORKS.slice(1).reduce(
    (acc, t, i) => {
      const s = shake(frame, t, 8, 7, `fork-tick-${i}`);
      return { x: acc.x + s.x, y: acc.y + s.y };
    },
    { x: 0, y: 0 },
  );
  const scx = REGION.x + REGION.w / 2 + impact.x + tick.x;
  const scy = REGION.y + REGION.h / 2 + impact.y + tick.y;
  const tx = scx - cam.cx * z;
  const ty = scy - cam.cy * z;

  // Parents keep running after a fork, so the live count is 2^(k+1) − 1.
  const landed = POP_AT.filter((t) => frame >= t).length;
  const leafPop = landed === 0 ? 1 : pop(frame, POP_AT[landed - 1], { damping: 11, stiffness: 300 });
  const countUp = landed === 0 ? 1 : progress(frame, POP_AT[landed - 1], 5, EASE.out);
  const liveVms = Math.round(lerp(2 ** landed - 1, 2 ** (landed + 1) - 1, countUp));

  // ——— Wires ———
  const wires: React.ReactNode[] = [];
  const sparks: React.ReactNode[] = [];
  for (let i = 1; i < NODES.length; i++) {
    const node = NODES[i];
    const at = FORKS[node.g - 1];
    const p = progress(frame, at, node.g === GENS - 1 ? 4 : WIRE_DRAW, EASE.out);
    if (p <= 0 || !node.wire) {
      continue;
    }
    const drawing = p < 1;
    wires.push(
      <Wire
        key={i}
        d={node.wire}
        progress={p}
        color={C.blue400}
        width={WIRE_W[node.g]}
        glow={drawing && node.g < 5 ? 1.4 : 0}
      />,
    );
    if (drawing) {
      const head = pointOnPath(node.wire, p);
      sparks.push(
        <circle key={i} cx={head.x} cy={head.y} r={WIRE_W[node.g] * 2.2} fill={C.blue50} opacity={0.95} />,
      );
    }
  }

  // ——— Fork-point bursts ———
  const bursts: React.ReactNode[] = [];
  for (let k = 1; k < GENS; k++) {
    const t = frame - FORKS[k - 1];
    if (t < 0 || t > 14) {
      continue;
    }
    const e = t / 14;
    for (let i = GEN_START[k - 1]; i < GEN_START[k - 1] + 2 ** (k - 1); i++) {
      const par = NODES[i];
      const r = (par.size * 0.35 + 30) * (0.4 + EASE.out(e) * 1.2);
      bursts.push(
        <div
          key={`${k}-${i}`}
          style={{
            position: 'absolute',
            left: par.x + par.size / 2 + GAP - r,
            top: par.y - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(C.blue50, 0.95)} 0%, ${alpha(C.blue400, 0.55)} 30%, ${alpha(C.blue400, 0)} 70%)`,
            opacity: (1 - e) ** 1.5,
          }}
        />,
      );
    }
  }

  // ——— Nodes ———
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < NODES.length; i++) {
    const node = NODES[i];
    const born = node.g === 0 ? -8 : POP_AT[node.g - 1];
    const s =
      node.g === 0
        ? pop(frame, -8, { damping: 12 })
        : pop(frame, born, node.g === 5 ? { damping: 13, stiffness: 420, mass: 0.5 } : { damping: 11, stiffness: 300 });
    if (s <= 0.001) {
      continue;
    }
    const age = frame - born;
    const fresh = node.g === 0 ? 0 : 1 - clamp(age / 14);
    // Parent pulses when it forks.
    const forkAge = node.g < FORKS.length ? frame - FORKS[node.g] : -1;
    const forking = forkAge >= 0 && forkAge < 10 ? 1 - forkAge / 10 : 0;
    const scale = s * (1 + 0.14 * forking);
    if (node.g === 5) {
      nodes.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: node.x - node.size / 2,
            top: node.y - node.size / 2,
            width: node.size,
            height: node.size,
            borderRadius: 3,
            background: mix(C.blue400, C.blue50, fresh * 0.8),
            boxShadow: `0 0 ${6 + 10 * fresh}px ${alpha(C.blue400, 0.8)}`,
            transform: `scale(${scale})`,
          }}
        />,
      );
      continue;
    }
    const isParent = node.g === 0;
    const glow = isParent ? 0.6 + 0.4 * forking : 0.35 * fresh + 0.25 * forking;
    nodes.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: node.x - node.size / 2,
          top: node.y - node.size / 2,
          width: node.size,
          height: node.size,
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: node.size * 0.1,
            borderRadius: node.size * 0.18,
            background: C.black,
            boxShadow: `0 0 ${node.size * 0.6 * glow}px ${alpha(C.blue400, 0.7 * glow)}`,
          }}
        />
        <Icon
          name={isParent ? 'solar:compass-square-bold-duotone' : 'solar:compass-square-line-duotone'}
          size={node.size}
          color={isParent ? C.blue400 : mix(C.blue50, C.blue400, fresh)}
          style={{ position: 'absolute', inset: 0 }}
        />
      </div>,
    );
  }

  const gridSize = 60 * z;

  return (
    <AbsoluteFill>
      <Backdrop
        variant="tintC"
        grid={0.05}
        gridSize={gridSize}
        gridOffset={{ x: tx % gridSize, y: ty % gridSize }}
        aura={1.2 + flash * 2}
        auraX={55}
        auraY={60}
      />

      {/* World */}
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${z})`, transformOrigin: '0 0' }}>
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {wires}
          {sparks}
        </svg>
        {bursts}
        {nodes}
        <div
          style={{
            position: 'absolute',
            left: COL_X[0] - 150,
            width: 300,
            top: PARENT_LABEL_Y - LABEL_SIZE,
            textAlign: 'center',
            opacity: progress(frame, -6, 10),
          }}
        >
          <Mono size={LABEL_SIZE} color={C.slate300} tracking="0.1em">
            Parent microVM
          </Mono>
        </div>
        <div
          style={{
            position: 'absolute',
            left: COL_X[1] - 150,
            width: 300,
            top: CHILD_LABEL_Y - LABEL_SIZE,
            textAlign: 'center',
            opacity: progress(frame, POP_AT[0] + 2, 10),
          }}
        >
          <Mono size={LABEL_SIZE} color={C.blue100} tracking="0.1em">
            Children microVMs
          </Mono>
        </div>
      </AbsoluteFill>

      {/* Headline */}
      <div style={{ position: 'absolute', left: 120, top: 158, transform: `translate(${impact.x * 0.4}px, ${impact.y * 0.4}px)` }}>
        <Move at={-5} duration={11} from={{ opacity: 0, scale: 1.25, blur: 10 }} origin="0% 50%">
          <Display size={92} color={C.slate300}>
            Fork a live VM in <Accent>~10 ms.</Accent>
          </Display>
        </Move>
      </div>

      {/* Counter */}
      <div
        style={{
          position: 'absolute',
          right: 120,
          top: 150,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 6,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Mono size={18} color={C.slate500} tracking="0.14em">
          Live microVMs
        </Mono>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 76,
              lineHeight: 1,
              color: C.blue400,
              letterSpacing: '-0.03em',
              display: 'inline-block',
              transform: `scale(${lerp(1.25, 1, leafPop)})`,
              transformOrigin: '100% 100%',
              textShadow: `0 0 ${24 + 30 * (1 - leafPop)}px ${alpha(C.blue400, 0.5)}`,
            }}
          >
            {String(liveVms).padStart(2, '0')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {FORKS.map((t, i) => {
            const on = frame >= POP_AT[i];
            const current = on && landed === i + 1;
            return (
              <Mono
                key={t}
                size={20}
                color={current ? C.blue50 : on ? C.blue100 : C.slate700}
                weight={current ? 700 : 500}
                upper={false}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: current ? alpha(C.blue400, 0.35) : 'transparent',
                }}
              >
                ×{2 ** (i + 1)}
              </Mono>
            );
          })}
        </div>
      </div>

      {flash > 0.005 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(70% 70% at 30% 58%, ${alpha(C.blue100, flash)} 0%, ${alpha(C.blue400, flash * 0.4)} 50%, transparent 100%)`,
            mixBlendMode: 'screen',
          }}
        />
      )}
    </AbsoluteFill>
  );
};
