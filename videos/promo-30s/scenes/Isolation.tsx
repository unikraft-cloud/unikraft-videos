import { noise2D } from '@remotion/noise';
import type React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Chip } from '../../../kit/design/Chip';
import { Icon } from '../../../kit/design/Icon';
import { clamp, EASE, lerp, pop, progress, scramble, shake, tween } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { Move, SplitText } from '../../../kit/design/Text';
import { alpha, C, TYPE } from '../../../kit/design/tokens';
import { GlitchBox, glitchEnvelope, GlitchText } from './isolation/Glitch';
import { Bug, tcbLayout, TcbCard } from './isolation/TcbCard';

/*
 * Chapter 3 "SAFE" — Isolation (beats 28–33, 150 frames).
 *  f0   impact  "Containers don't contain." slams, "don't contain." glitches.
 *  f30  glitch  a bug breaks out of c2 through the container runtime into the
 *               host OS and hops into every neighbouring container.
 *  f75  clang   a bug in VM2 hits its VM boundary and bounces off: CONTAINED.
 *  f90+         the VM card takes over: "Every instance is its own microVM."
 */

const HIT_GLITCH = beats(1);
const HIT_CLANG = beats(2.5);
const SWAP = beats(3);
const EXIT = beats(5) - 6;

const CARD_W = 760;
const CARD_H = 630;
const CARD_Y = 310;
const LEFT_X = 160;
const RIGHT_X = 1000;

const WIDE_W = 1560;
const WIDE_H = 580;
const WIDE_X = (1920 - WIDE_W) / 2;
const WIDE_Y = 350;

const CONT = tcbLayout('container', CARD_W, CARD_H, 4);
const CONT_X = CONT.apps.map((r) => r.x + r.w / 2);
/** Bug rest height inside an app box: over the glyph, below the c1…c4 label. */
const CONT_Y = CONT.apps[0].y + CONT.apps[0].h / 2 + 22;
const RUNTIME_Y = CONT.layers[0].y + CONT.layers[0].h / 2;
const HOST_Y = CONT.layers[1].y + CONT.layers[1].h / 2;
/** Frames the escaped bug lands in c1…c4 (c2 is where it came from). */
const LAND = [48, 52, 46, 50];
const SPLIT_AT = 38;

const jitter = (seed: string, frame: number, amp: number) => ({
  x: noise2D(`${seed}-x`, frame * 0.35, 0) * amp,
  y: noise2D(`${seed}-y`, 0, frame * 0.35) * amp,
});

/** Zig-zag crack across the container-runtime layer (and down into the host OS), in card px. */
const CRACK = (() => {
  const cx = CONT_X[1];
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 1; i <= 9; i++) {
    const dy = (random(`crack-l-${i}`) - 0.5) * 36;
    left.push(`${cx - i * 26} ${RUNTIME_Y + dy}`);
    const dy2 = (random(`crack-r-${i}`) - 0.5) * 36;
    right.push(`${cx + i * 26} ${RUNTIME_Y + dy2}`);
  }
  const down = [0, 1, 2, 3].map((i) => `${cx + (random(`crack-d-${i}`) - 0.5) * 30} ${RUNTIME_Y + 18 + i * 22}`);
  return [
    `M ${cx} ${RUNTIME_Y} L ${left.join(' L ')}`,
    `M ${cx} ${RUNTIME_Y} L ${right.join(' L ')}`,
    `M ${cx} ${RUNTIME_Y} L ${down.join(' L ')}`,
  ];
})();

const SHARDS = Array.from({ length: 16 }, (_, i) => ({
  vx: (random(`shard-vx-${i}`) - 0.5) * 22,
  vy: -4 - random(`shard-vy-${i}`) * 14,
  size: 5 + random(`shard-s-${i}`) * 9,
  spin: (random(`shard-r-${i}`) - 0.5) * 40,
  color: [C.rose, C.red, C.white][i % 3],
}));

export const Isolation: React.FC = () => {
  const f = useCurrentFrame();

  /* ---------- Camera ---------- */
  const s0 = shake(f, 0, 16, 12, 'iso-impact');
  const s30 = shake(f, HIT_GLITCH, 22, 20, 'iso-glitch');
  const s75 = shake(f, HIT_CLANG, 16, 12, 'iso-clang');
  const exitQ = progress(f, EXIT, 6, EASE.in);
  const panX = tween(f, [48, 74], [0, -40], EASE.inOut) + tween(f, [SWAP - 2, SWAP + 22], [0, 40], EASE.inOut);
  const camScale = lerp(1, 1.045, f / 150) * lerp(1, 1.16, exitQ);
  const camX = panX + s0.x * 0.6 + s30.x * 0.35 + s75.x * 0.4;
  const camY = s0.y * 0.6 + s30.y * 0.35 + s75.y * 0.4;

  /* ---------- Headline A: "Containers don't contain." ---------- */
  const slam = progress(f, 0, 12, EASE.out);
  const glitchA = Math.max(glitchEnvelope(f, 0, 18, 'hA0'), glitchEnvelope(f, HIT_GLITCH, 12, 'hA30', 0.9));
  const exitA = progress(f, SWAP - 4, 10, EASE.in);

  /* ---------- Containers card ---------- */
  const inC = progress(f, -4, 20, EASE.out);
  const dimC = progress(f, 56, 16, EASE.standard);
  const outC = progress(f, SWAP - 4, 14, EASE.in);
  const cardGlitch = Math.max(glitchEnvelope(f, HIT_GLITCH, 16, 'card30'), glitchEnvelope(f, SPLIT_AT + 8, 8, 'card46', 0.5));
  const runtimeHeat = f < HIT_GLITCH ? 0 : Math.max(1 - progress(f, HIT_GLITCH, 18), 0.6 + 0.15 * Math.sin(f * 0.5));
  const hostHeat = f < 34 ? 0 : Math.max(1 - progress(f, 34, 18), 0.55 + 0.15 * Math.sin(f * 0.5 + 1));
  const zoneHeat = progress(f, HIT_GLITCH, 8);
  const redAlarm = zoneHeat * (1 - dimC * 0.5) * (1 - outC);

  const contApps = CONT_X.map((_, i) => {
    const land = i === 1 ? 22 : LAND[i];
    return {
      pop: clamp(pop(f, 1 + i * 2), 0, 1.2),
      infected: progress(f, land, i === 1 ? 8 : 4),
      flash: i === 1 ? (f >= HIT_GLITCH ? 1 - progress(f, HIT_GLITCH, 12) : 0) : f >= LAND[i] ? 1 - progress(f, LAND[i], 14) : 0,
    };
  });

  // Main bug in c2: appear → charge → smash down through the runtime → host OS.
  let mainY = CONT_Y;
  let mainSX = 1;
  let mainSY = 1;
  if (f < 24) {
    mainY = CONT_Y;
  } else if (f < 27) {
    const t = progress(f, 24, 3, EASE.out);
    mainY = CONT_Y - 20 * t;
    mainSX = 1 + 0.15 * t;
    mainSY = 1 - 0.18 * t;
  } else if (f < HIT_GLITCH) {
    const t = progress(f, 27, 3, EASE.in);
    mainY = lerp(CONT_Y - 20, RUNTIME_Y, t);
    mainSX = 0.82;
    mainSY = 1.3;
  } else {
    const t = progress(f, HIT_GLITCH, 6, EASE.out);
    mainY = lerp(RUNTIME_Y, HOST_Y, t);
    const squash = 1 - progress(f, HIT_GLITCH, 8);
    mainSX = 1 + 0.35 * squash;
    mainSY = 1 - 0.3 * squash;
  }
  const mainJ = jitter('bug-main', f, f < 22 ? 3 : 6);
  const bugsC =
    f < SPLIT_AT
      ? [
          {
            x: CONT_X[1] + mainJ.x,
            y: mainY + (f < 27 ? mainJ.y : 0),
            scale: clamp(pop(f, 12), 0, 1.3),
            sx: mainSX,
            sy: mainSY,
            rot: f < 27 ? 0 : noise2D('bug-rot', f * 0.4, 0) * 18,
          },
        ]
      : CONT_X.map((tx, j) => {
          const t = progress(f, SPLIT_AT, LAND[j] - SPLIT_AT, EASE.inOut);
          const landed = f >= LAND[j];
          const settle = landed ? 1 - progress(f, LAND[j], 10) : 0;
          const jj = jitter(`bug-c${j}`, f, landed ? 5 : 0);
          return {
            x: lerp(CONT_X[1], tx, t) + jj.x,
            y: lerp(HOST_Y, CONT_Y, t) - 150 * Math.sin(Math.PI * t) + jj.y,
            scale: j === 1 ? 1 : lerp(0.5, 1, progress(f, SPLIT_AT, 5)),
            sx: 1 + 0.3 * settle,
            sy: 1 - 0.25 * settle,
            rot: landed ? noise2D(`bug-r${j}`, f * 0.3, 0) * 14 : (tx - CONT_X[1]) * 0.08 * Math.sin(Math.PI * t),
          };
        });

  const crackDraw = progress(f, HIT_GLITCH, 7, EASE.out);
  const crackFade = f < HIT_GLITCH ? 0 : lerp(1, 0.55, progress(f, HIT_GLITCH + 10, 20));

  /* ---------- VM card ---------- */
  const inV = progress(f, -1, 20, EASE.out);
  const take = progress(f, SWAP - 4, 26, EASE.inOut);
  const vx = lerp(RIGHT_X, WIDE_X, take);
  const vy = lerp(CARD_Y, WIDE_Y, take);
  const vw = lerp(CARD_W, WIDE_W, take);
  const vh = lerp(CARD_H, WIDE_H, take);
  const vmL = tcbLayout('vm', vw, vh, 8, take);
  const clangFlash = f >= HIT_CLANG ? 1 - progress(f, HIT_CLANG, 20) : 0;
  const vmApps = vmL.apps.map((_, i) => {
    const wave = progress(f, SWAP + 20 + i * 2.5, 10);
    const clang = i === 1 ? progress(f, HIT_CLANG, 2) : 0;
    return {
      pop: i < 4 ? clamp(pop(f, 4 + i * 2), 0, 1.2) : clamp(pop(f, SWAP + 12 + (i - 4) * 3), 0, 1.2),
      guard: Math.max(wave, clang),
      flash: (i === 1 ? clangFlash : 0) + (f >= SWAP + 20 + i * 2.5 ? 0.6 * (1 - progress(f, SWAP + 20 + i * 2.5, 12)) : 0),
    };
  });
  // Decode "Unikraft Cloud" over the old label, left → right.
  const labelP = progress(f, SWAP + 8, 16, EASE.linear);
  const decoded = scramble('Unikraft Cloud', labelP, f, 'vm-label');
  const vmLabel = labelP <= 0 ? 'Virtual machine' : decoded + 'Virtual machine'.slice(decoded.length, 14);

  // VM2 bug: appears, winds up, charges its own VM wall, gets bounced.
  const box = vmL.apps[1];
  const bcx = box.x + box.w / 2;
  const bcy = box.y + box.h / 2;
  const contact = box.w / 2 - 30;
  let vdx = 0;
  let vsx = 1;
  let vsy = 1;
  let vrot = 0;
  if (f < 62) {
    vdx = 0;
  } else if (f < 67) {
    const t = progress(f, 62, 5, EASE.out);
    vdx = -28 * t;
    vsx = 1 - 0.12 * t;
    vsy = 1 + 0.1 * t;
  } else if (f < HIT_CLANG) {
    const t = progress(f, 67, HIT_CLANG - 67, EASE.in);
    vdx = lerp(-28, contact, t);
    vsx = 1 + 0.25 * t;
    vsy = 1 - 0.15 * t;
  } else {
    const back = pop(f, HIT_CLANG, { damping: 9, stiffness: 160 });
    vdx = lerp(contact, 0, back);
    const squash = 1 - progress(f, HIT_CLANG, 8);
    vsx = 1 - 0.35 * squash;
    vsy = 1 + 0.25 * squash;
    const decay = 1 - progress(f, HIT_CLANG, 40);
    vrot = Math.sin((f - HIT_CLANG) * 0.55) * 28 * decay;
  }
  const vj = jitter('bug-vm', f, f < HIT_CLANG ? 3 : 4);
  const wallX = box.x + box.w;
  const contactY = bcy + 22 + vj.y;

  /* ---------- Render ---------- */
  const headlineA = (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 166,
        textAlign: 'center',
        ...TYPE.display,
        fontSize: 108,
        color: C.slate300,
        transform: `translateY(${-50 * exitA}px) scale(${1 + 0.18 * (1 - slam)})`,
        filter: exitA > 0.02 ? `blur(${8 * exitA}px)` : undefined,
        opacity: 1 - exitA,
        whiteSpace: 'pre',
      }}
    >
      Containers <GlitchText text="don't contain." intensity={glitchA} seed="hA" color={C.red} />
    </div>
  );

  const headlineB = f >= SWAP - 6 && (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 158, textAlign: 'center' }}>
      <div style={{ ...TYPE.display, fontSize: 92, color: C.slate300 }}>
        <SplitText
          text="Every instance is its own microVM."
          by="word"
          at={SWAP + 4}
          stagger={3}
          duration={16}
          from={{ opacity: 0, y: 0.45, blur: 8 }}
          unitStyle={(u) => (u.startsWith('microVM') ? { color: C.blue400 } : undefined)}
        />
      </div>
      <Move at={SWAP + 16} duration={16} from={{ opacity: 0, y: 0.5, blur: 6 }}>
        <div style={{ ...TYPE.title, fontSize: 46, marginTop: 18, color: C.blue400, textShadow: `0 0 30px ${alpha(C.blue400, 0.45)}` }}>
          Hardware-level isolation.
        </div>
      </Move>
    </div>
  );

  const containersCard = outC < 1 && (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: CARD_W,
        height: CARD_H,
        transform: `translate(${LEFT_X + s30.x + s0.x * 0.4 - 620 * outC}px, ${CARD_Y + lerp(90, 0, inC) + s30.y}px) rotateX(${lerp(26, 0, inC)}deg) rotateY(${-38 * outC}deg) rotate(${s30.r}deg) scale(${lerp(0.94, 1, inC) * (1 - 0.03 * dimC)})`,
        transformOrigin: '50% 100%',
        opacity: inC * lerp(1, 0.5, dimC) * (1 - outC),
        filter: outC > 0.02 ? `blur(${12 * outC}px)` : undefined,
      }}
    >
      <GlitchBox intensity={cardGlitch} seed="cont" width={CARD_W} height={CARD_H}>
        <TcbCard
          kind="container"
          width={CARD_W}
          height={CARD_H}
          label="Containers"
          tcb="TCB (Linux kernel)"
          loc="~40M LoC"
          tone={C.rose}
          locColor={C.red}
          locGlow={progress(f, 34, 10) * (0.7 + 0.3 * Math.sin(f * 0.4))}
          apps={contApps}
          appLabel={(i) => `c${i + 1}`}
          layers={[
            { label: 'container runtime', tone: 'warn', heat: runtimeHeat, enter: progress(f, 3, 12) },
            { label: 'host OS', tone: 'neutral', heat: hostHeat, enter: progress(f, 5, 12) },
          ]}
          hardwareEnter={progress(f, 1, 12)}
          zoneEnter={progress(f, 6, 10)}
          zoneHeat={zoneHeat}
          glow={zoneHeat * 0.6}
        >
          <svg width={CARD_W} height={CARD_H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            {CRACK.map((d, i) => (
              <path
                key={i}
                d={d}
                pathLength={1}
                fill="none"
                stroke={i === 2 ? C.red : C.white}
                strokeWidth={i === 2 ? 3 : 2.5}
                strokeLinejoin="round"
                strokeDasharray="1 1"
                strokeDashoffset={1 - crackDraw}
                opacity={crackFade}
                style={{ filter: `drop-shadow(0 0 6px ${C.rose})` }}
              />
            ))}
          </svg>
          {bugsC.map((b, i) => (
            <Bug key={i} x={b.x} y={b.y} scale={b.scale} scaleX={b.sx} scaleY={b.sy} rotate={b.rot} />
          ))}
        </TcbCard>
      </GlitchBox>
      {/* Unclipped overlay: shards + CVE tag straddling the top border. */}
      {f >= HIT_GLITCH &&
        f < HIT_GLITCH + 30 &&
        SHARDS.map((s, i) => {
          const t = f - HIT_GLITCH;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: CONT_X[1] + s.vx * t,
                top: RUNTIME_Y + s.vy * t + 0.55 * t * t,
                width: s.size,
                height: s.size,
                background: s.color,
                transform: `rotate(${s.spin * t}deg)`,
                opacity: 1 - t / 30,
                boxShadow: `0 0 10px ${alpha(C.rose, 0.8)}`,
              }}
            />
          );
        })}
      {f >= HIT_GLITCH + 2 && (
        <div
          style={{
            position: 'absolute',
            left: CARD_W / 2,
            top: 0,
            transform: `translate(-50%, -50%) scale(${pop(f, HIT_GLITCH + 2, { damping: 11 })})`,
          }}
        >
          <Chip
            label={scramble('CVE-2024-21626 · container escape', progress(f, HIT_GLITCH + 2, 16, EASE.linear), f, 'cve')}
            icon="solar:bug-bold"
            tone="red"
            mono
            size={20}
            glow={0.6 + 0.4 * (1 - progress(f, HIT_GLITCH + 2, 20))}
            style={{ background: alpha(C.slate950, 0.92), minWidth: 470, justifyContent: 'flex-start' }}
          />
        </div>
      )}
    </div>
  );

  const vmCard = (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: vw,
        height: vh,
        transform: `translate(${vx + s75.x}px, ${vy + lerp(90, 0, inV) + s75.y}px) rotateX(${lerp(26, 0, inV)}deg) rotate(${s75.r}deg) scale(${lerp(0.94, 1, inV)})`,
        transformOrigin: '50% 100%',
        opacity: inV,
      }}
    >
      <TcbCard
        kind="vm"
        width={vw}
        height={vh}
        label={vmLabel}
        tcb="TCB (KVM)"
        loc="~200–250K LoC"
        tone={C.blue400}
        locColor={C.blue200}
        locGlow={take}
        apps={vmApps}
        appLabel={(i) => `VM${i + 1}`}
        spread={take}
        layers={[{ label: 'hypervisor', tone: 'tint', enter: progress(f, 7, 12) }]}
        hardwareEnter={progress(f, 4, 12)}
        zoneEnter={progress(f, 9, 10)}
        glow={clangFlash * 0.9 + take * 0.5}
      >
        {/* Shield ripple from VM2's boundary. */}
        {[0, 5, 10].map((d) => {
          const t = progress(f, HIT_CLANG + d, 24, EASE.out);
          return (
            f >= HIT_CLANG + d &&
            t < 1 && (
              <div
                key={d}
                style={{
                  position: 'absolute',
                  left: box.x,
                  top: box.y,
                  width: box.w,
                  height: box.h,
                  borderRadius: 14,
                  border: `3px solid ${C.blue200}`,
                  boxShadow: `0 0 24px ${alpha(C.blue400, 0.7)}`,
                  transform: `scale(${1 + 0.55 * t}, ${1 + 0.35 * t})`,
                  opacity: (1 - t) * 0.9,
                }}
              />
            )
          );
        })}
        {/* Wall flash where the bug hits. */}
        {clangFlash > 0 && (
          <div
            style={{
              position: 'absolute',
              left: wallX - 3,
              top: box.y + 8,
              width: 6,
              height: box.h - 16,
              borderRadius: 3,
              background: C.blue50,
              boxShadow: `0 0 18px ${C.blue200}, 0 0 60px ${C.blue400}`,
              opacity: clangFlash,
            }}
          />
        )}
        {/* Sparks radiating from the contact point. */}
        {f >= HIT_CLANG &&
          f < HIT_CLANG + 14 &&
          Array.from({ length: 9 }, (_, i) => {
            const t = progress(f, HIT_CLANG, 14, EASE.out);
            const ang = (-80 + i * 20) * (Math.PI / 180) + Math.PI;
            const r0 = 10 + 50 * t;
            const len = 34 * (1 - t) + 6;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: wallX + Math.cos(ang) * r0,
                  top: contactY + Math.sin(ang) * r0,
                  width: len,
                  height: 3,
                  borderRadius: 2,
                  background: C.blue100,
                  boxShadow: `0 0 10px ${C.blue400}`,
                  transform: `rotate(${(ang * 180) / Math.PI}deg)`,
                  transformOrigin: '0 50%',
                  opacity: 1 - t,
                }}
              />
            );
          })}
        <Bug
          x={bcx + vdx + (f < HIT_CLANG && f >= 67 ? 0 : vj.x)}
          y={contactY}
          scale={clamp(pop(f, 54), 0, 1.3)}
          scaleX={vsx}
          scaleY={vsy}
          rotate={vrot}
        />
        {/* Shield glyph at the impact point. */}
        {f >= HIT_CLANG && (
          <div
            style={{
              position: 'absolute',
              left: wallX - 34,
              top: box.y - 12,
              transform: `scale(${clamp(pop(f, HIT_CLANG, { damping: 10, stiffness: 260 }), 0, 1.4) * (1 - progress(f, HIT_CLANG + 24, 10, EASE.in))})`,
              filter: `drop-shadow(0 0 16px ${C.blue400})`,
            }}
          >
            <Icon name="solar:shield-check-bold" size={68} color={C.blue100} />
          </div>
        )}
      </TcbCard>
      {f >= HIT_CLANG + 1 && (
        <div
          style={{
            position: 'absolute',
            left: vw / 2,
            top: 0,
            transform: `translate(-50%, -50%) scale(${pop(f, HIT_CLANG + 1, { damping: 11, stiffness: 340 })})`,
          }}
        >
          <Chip
            label="Contained ✓"
            icon="solar:shield-check-bold"
            tone="blue"
            mono
            size={20}
            glow={0.5 + 0.5 * clangFlash}
            style={{ background: alpha(C.slate950, 0.92) }}
          />
        </div>
      )}
    </div>
  );

  return (
    <Backdrop variant="tintC" aura={1 + 0.7 * take} auraY={60} grid={0.05} gridOffset={{ x: -f * 0.4, y: f * 0.25 }}>
      {/* Rose danger glow behind the containers card. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 34% 44% at 28% 62%, ${alpha(C.rose, 0.28 * redAlarm)} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${camX}px, ${camY}px) scale(${camScale})`,
          filter: exitQ > 0.02 ? `blur(${10 * exitQ}px)` : undefined,
          opacity: 1 - 0.85 * exitQ,
        }}
      >
        <AbsoluteFill style={{ perspective: 1800 }}>
          {containersCard}
          {vmCard}
        </AbsoluteFill>
        {headlineA}
        {headlineB}
      </AbsoluteFill>
      {/* Flash frames on the three cues. */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background:
            f < 8
              ? `radial-gradient(ellipse 60% 30% at 50% 20%, ${alpha(C.rose, 0.3 * (1 - progress(f, 0, 8)))} 0%, transparent 100%)`
              : f < HIT_CLANG
                ? alpha(C.rose, 0.26 * (f >= HIT_GLITCH ? 1 - progress(f, HIT_GLITCH, 10) : 0))
                : alpha(C.blue400, 0.2 * (1 - progress(f, HIT_CLANG, 10))),
          mixBlendMode: 'screen',
        }}
      />
    </Backdrop>
  );
};
