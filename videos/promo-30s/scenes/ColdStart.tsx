import type React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Icon } from '../../../kit/design/Icon';
import type { IconName } from '../../../kit/design/icons-data';
import { clamp, EASE, lerp, pop, progress, shake, tween } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { Terminal, type TermLine } from '../../../kit/design/Terminal';
import { Display, Mono, SplitText } from '../../../kit/design/Text';
import { alpha, C, FONT, mix, TERM, TYPE } from '../../../kit/design/tokens';

/**
 * 02 · FAST — cold start (6 beats, absolute b12–b18).
 * b0 hard cut: the hero terminal swings in in 3D next to "Built for
 * milliseconds, not minutes." The CLI deploys `openclaw` to fra0 (✓ on b2),
 * curls it and gets "replied in 8.4 ms" (b3). On b3.5 the camera dives into
 * the 8.4 ms, punches through a flash into a giant IDLE → FIRST BYTE readout
 * that counts 0.0 → 8.4 across b4 and locks with a hit on b5.
 */

const IMPACT_AT = 0;
const DEPLOYED_AT = beats(2); // 60
const CURL_AT = beats(2.5); // 75
const REPLIED_AT = beats(3); // 90
const DIVE_AT = beats(3.5); // 105
const COUNT_AT = beats(4); // 120
const LOCK_AT = beats(5); // 150
const END = beats(6); // 180
const EXIT_AT = END - 7;

const CMD_DEPLOY =
  'unikraft instance create --set scale-to-zero.policy=on --set name=openclaw --metro fra0 --memory 8G';
const CMD_CURL = 'curl https://openclaw.fra0.unikraft.host';

const LINES: TermLine[] = [
  { kind: 'command', text: CMD_DEPLOY, at: 7, cpf: CMD_DEPLOY.length / 45 },
  { kind: 'comment', text: 'packaging Dockerfile → microVM image', at: 54 },
  { kind: 'comment', text: 'deploying to fra0 region', at: 57 },
  { kind: 'success', text: 'deployed openclaw.fra0.unikraft.host', at: DEPLOYED_AT - 3 },
  { kind: 'command', text: CMD_CURL, at: CURL_AT, cpf: CMD_CURL.length / 13 },
  { kind: 'success', text: 'replied in', value: '8.4 ms', at: REPLIED_AT - 3 },
];

// Terminal geometry (fontSize 26 → chrome scale s = 2; IBM Plex Mono advance = 0.6em).
const TERM_W = 1060;
const TERM_FS = 26;
const TERM_X = 742;
const TERM_Y = 446;
const CH = TERM_FS * 0.6;
const ROW = TERM_FS * 1.6;
// "8.4 ms" value box, in terminal-local px (see Terminal.tsx paddings/margins).
const VALUE_BOX = { x: 1.5 + 36 + CH + 16 + CH * 10 + 24, y: 1.5 + 79.4 + 32 + 277.6, w: CH * 6, h: ROW };
// Where that value box lands on screen at the dive (measured from the tilted terminal).
const DIVE_ORIGIN = { x: 1034, y: 856 };

// Readout geometry.
const RULER_W = 1180;
const RULER_MAX = 10;
const TARGET_MS = 8.4;

const STEPS: { icon: IconName; label: string; caption: string; doneAt: number; activeAt: number }[] = [
  { icon: 'solar:box-bold', label: '01 · Package', caption: 'Dockerfile → microVM image', activeAt: 54, doneAt: 57 },
  { icon: 'solar:global-bold', label: '02 · Deploy', caption: 'fra0 · 8 GB · scale-to-zero', activeAt: 57, doneAt: DEPLOYED_AT },
  { icon: 'solar:bolt-bold', label: '03 · Serve', caption: 'first byte, from idle', activeAt: CURL_AT, doneAt: REPLIED_AT },
];

const flash = (frame: number, at: number, attack: number, decay: number): number => {
  if (frame < at - attack || frame > at + decay) {
    return 0;
  }
  return frame < at ? progress(frame, at - attack, attack, EASE.in) : 1 - progress(frame, at, decay, EASE.out);
};

const Stepper: React.FC<{ frame: number }> = ({ frame }) => {
  const BOX = 76;
  const GAP = 132;
  return (
    <div style={{ position: 'absolute', left: 120, top: 486, width: 560 }}>
      {/* Connector rail + blue fill. */}
      <div
        style={{
          position: 'absolute',
          left: BOX / 2 - 1.5,
          top: BOX,
          width: 3,
          height: GAP * 2 - BOX,
          background: C.slate800,
          borderRadius: 2,
          opacity: progress(frame, 10, 14),
        }}
      />
      {STEPS.slice(0, 2).map((st, i) => {
        const fill = progress(frame, st.doneAt, 10, EASE.out) * (i === 0 ? 1 : progress(frame, STEPS[1].doneAt, 1));
        return (
          <div
            key={st.label}
            style={{
              position: 'absolute',
              left: BOX / 2 - 1.5,
              top: BOX + i * GAP,
              width: 3,
              height: (GAP - BOX) * fill,
              background: C.blue400,
              boxShadow: `0 0 12px ${alpha(C.blue400, 0.8)}`,
              borderRadius: 2,
            }}
          />
        );
      })}
      {STEPS.map((st, i) => {
        const enter = progress(frame, 12 + i * 3, 14);
        const active = progress(frame, st.activeAt, 6);
        const done = frame >= st.doneAt ? 1 : 0;
        const hit = pop(frame, st.doneAt, { damping: 11 });
        const scale = frame >= st.doneAt ? lerp(1.18, 1, hit) : 1;
        const pulse = active * (1 - done) * (0.5 + 0.5 * Math.sin((frame - st.activeAt) * 0.6));
        const border = done > 0 ? C.blue400 : active > 0 ? alpha(C.blue400, 0.5 + 0.4 * pulse) : C.slate700;
        const iconColor = done > 0.5 ? C.blue100 : active > 0 ? C.blue200 : C.slate600;
        const burst = flash(frame, st.doneAt, 0, 18);
        return (
          <div
            key={st.label}
            style={{
              position: 'absolute',
              left: 0,
              top: i * GAP,
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              opacity: enter,
              transform: `translateX(${lerp(-40, 0, enter)}px)`,
            }}
          >
            <div
              style={{
                width: BOX,
                height: BOX,
                borderRadius: 14,
                border: `2px solid ${border}`,
                background: done > 0 ? alpha(C.blue400, 0.12 + 0.3 * burst) : alpha(C.slate900, 0.7),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${scale})`,
                boxShadow:
                  done > 0
                    ? `0 0 ${24 + 50 * burst}px ${alpha(C.blue400, 0.35 + 0.5 * burst)}`
                    : active > 0
                      ? `0 0 ${18 * pulse}px ${alpha(C.blue400, 0.4)}`
                      : undefined,
                flexShrink: 0,
              }}
            >
              <Icon name={st.icon} size={38} color={iconColor} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Mono size={21} color={done > 0 ? C.blue100 : active > 0 ? C.slate300 : C.slate500} tracking="0.1em">
                  {st.label}
                </Mono>
                {done > 0 && (
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 21,
                      color: TERM.success,
                      opacity: done,
                      transform: `scale(${lerp(1.6, 1, hit)})`,
                      display: 'inline-block',
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 28,
                  letterSpacing: '-0.01em',
                  color: done > 0 ? C.slate300 : C.slate500,
                  whiteSpace: 'nowrap',
                }}
              >
                {st.caption}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Hero terminal with the 8.4 ms value badge riding on top of it. */
const HeroTerminal: React.FC<{ frame: number }> = ({ frame }) => {
  const enter = progress(frame, IMPACT_AT, 14, EASE.out);
  const drift = frame / DIVE_AT;
  const rx = lerp(25, 8, enter) - 2 * drift;
  const ry = lerp(-20, -10, enter) + 3 * drift;
  const rz = lerp(-3, 0, enter);
  const scale = lerp(0.85, 1, enter);
  const valueIn = progress(frame, REPLIED_AT, 10, EASE.out);
  const valueGlow = flash(frame, REPLIED_AT, 0, 24) + (frame >= REPLIED_AT ? 0.45 : 0);
  const lineHighlight = (i: number) => {
    if (i === 3) {
      return flash(frame, DEPLOYED_AT, 0, 20) * 0.9;
    }
    if (i === 5) {
      return flash(frame, REPLIED_AT, 0, 20) * 0.6;
    }
    return 0;
  };
  // Light sweep across the glass on the impact.
  const sweep = progress(frame, 2, 22, EASE.inOut);
  return (
    <div
      style={{
        position: 'absolute',
        left: TERM_X,
        top: TERM_Y,
        width: TERM_W,
        transformStyle: 'preserve-3d',
        transform: `translateY(${lerp(120, 0, enter)}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`,
        transformOrigin: '50% 40%',
        opacity: clamp(0.75 + enter * 3),
      }}
    >
      {/* Floor glow under the terminal. */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          bottom: -60,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${alpha(C.blue400, 0.35)}, transparent)`,
          filter: 'blur(20px)',
        }}
      />
      <Terminal
        lines={LINES}
        width={TERM_W}
        fontSize={TERM_FS}
        minBodyHeight={392}
        highlight={lineHighlight}
        style={{
          boxShadow: `0 2px 0 0 rgba(255,255,255,0.06) inset, 0 60px 120px -40px rgba(0,0,0,0.9), 0 0 140px -30px ${alpha(C.blue400, 0.4)}`,
        }}
      />
      {/* Glass sweep. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 28,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -200,
            bottom: -200,
            width: 260,
            left: lerp(-400, TERM_W + 200, sweep),
            transform: 'rotate(18deg)',
            background: `linear-gradient(90deg, transparent, ${alpha(C.white, 0.07)}, transparent)`,
            opacity: sweep < 1 ? 1 : 0,
          }}
        />
      </div>
      {frame >= REPLIED_AT && (
        <div
          style={{
            position: 'absolute',
            left: VALUE_BOX.x - 11,
            top: VALUE_BOX.y,
            height: VALUE_BOX.h,
            padding: '0 18px 0 11px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 8,
            background: `linear-gradient(180deg, ${alpha(C.blue400, 0.35 + 0.35 * valueGlow)}, ${alpha(C.blue300, 0.25 + 0.3 * valueGlow)}), ${TERM.bg}`,
            border: `1.5px solid ${alpha(C.blue400, 0.6 + 0.4 * valueGlow)}`,
            boxShadow: `0 0 ${20 + 60 * valueGlow}px ${alpha(C.blue400, 0.3 + 0.5 * valueGlow)}`,
            fontFamily: FONT.mono,
            fontSize: TERM_FS,
            fontWeight: 700,
            color: C.white,
            textShadow: `0 0 ${14 + 20 * valueGlow}px ${alpha(C.blue400, 1)}`,
            transform: `scale(${lerp(1.5, 1, valueIn)})`,
            transformOrigin: '30% 50%',
            whiteSpace: 'nowrap',
          }}
        >
          8.4 ms
        </div>
      )}
    </div>
  );
};

const Headline: React.FC = () => (
  <div style={{ position: 'absolute', left: 120, top: 166 }}>
    <Display size={128} color={C.slate300} style={{ lineHeight: 0.98 }}>
      <SplitText text="Built for milliseconds," by="word" at={-5} stagger={3} duration={12} from={{ opacity: 0, y: 0.45, blur: 10 }} />
      <br />
      <SplitText
        text="not minutes."
        by="word"
        at={4}
        stagger={3}
        duration={12}
        from={{ opacity: 0, y: 0.45, blur: 10 }}
        style={{ color: C.blue400 }}
      />
    </Display>
  </div>
);

/** 0 → 10 ms instrument ruler under the readout. */
const Ruler: React.FC<{ value: number; lock: number; enter: number; frame: number }> = ({ value, lock, enter, frame }) => {
  const ticks = Array.from({ length: RULER_MAX * 4 + 1 }, (_, i) => i / 4);
  const x = (v: number) => (v / RULER_MAX) * RULER_W;
  const draw = progress(frame, COUNT_AT - 6, 18, EASE.out);
  return (
    <div style={{ position: 'relative', width: RULER_W, height: 110, opacity: enter }}>
      {/* Track */}
      <div style={{ position: 'absolute', left: 0, top: 40, width: RULER_W * draw, height: 10, borderRadius: 5, background: C.slate800 }} />
      {/* Fill */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 40,
          width: x(value),
          height: 10,
          borderRadius: 5,
          background: `linear-gradient(90deg, ${C.blueDeep}, ${C.blue400})`,
          boxShadow: `0 0 ${16 + 40 * lock}px ${alpha(C.blue400, 0.6 + 0.4 * lock)}`,
        }}
      />
      {/* Ticks */}
      {ticks.map((t) => {
        const major = t % 1 === 0;
        const shown = draw >= t / RULER_MAX;
        return (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: x(t) - 1,
              top: major ? 60 : 60,
              width: 2,
              height: major ? 18 : 9,
              background: t <= value ? C.blue200 : C.slate700,
              opacity: shown ? 1 : 0,
            }}
          />
        );
      })}
      {ticks
        .filter((t) => t % 2 === 0)
        .map((t) => (
          <span
            key={`l${t}`}
            style={{
              position: 'absolute',
              left: x(t),
              top: 84,
              transform: 'translateX(-50%)',
              fontFamily: FONT.mono,
              fontSize: 18,
              letterSpacing: '0.06em',
              color: t === RULER_MAX ? C.blue100 : C.slate500,
              opacity: draw >= t / RULER_MAX ? 1 : 0,
              whiteSpace: 'nowrap',
            }}
          >
            {t === RULER_MAX ? '10 MS' : t}
          </span>
        ))}
      {/* 10 ms limit marker */}
      <div
        style={{
          position: 'absolute',
          left: x(RULER_MAX) - 1,
          top: 4,
          width: 2,
          height: 56,
          backgroundImage: `repeating-linear-gradient(180deg, ${C.blue100} 0 6px, transparent 6px 11px)`,
          opacity: draw,
        }}
      />
      <span
        style={{
          ...TYPE.eyebrow,
          position: 'absolute',
          right: 0,
          top: -22,
          transform: 'translateX(50%)',
          fontSize: 16,
          letterSpacing: '0.12em',
          color: C.blue100,
          opacity: draw,
          whiteSpace: 'nowrap',
        }}
      >
        limit
      </span>
      {/* Marker */}
      <div
        style={{
          position: 'absolute',
          left: x(value),
          top: 45,
          width: 26 + 10 * lock,
          height: 26 + 10 * lock,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: C.white,
          border: `5px solid ${C.blue400}`,
          boxShadow: `0 0 ${20 + 50 * lock}px ${alpha(C.blue400, 0.9)}`,
          opacity: draw,
        }}
      />
    </div>
  );
};

const Readout: React.FC<{ frame: number }> = ({ frame }) => {
  const enter = progress(frame, DIVE_AT + 7, 16, EASE.out);
  const count = interpolate(frame, [COUNT_AT, LOCK_AT], [0, TARGET_MS], {
    easing: Easing.bezier(0.3, 0.1, 0.25, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const locked = frame >= LOCK_AT;
  const value = locked ? TARGET_MS : Math.floor(count * 10) / 10;
  const hit = pop(frame, LOCK_AT, { damping: 9, stiffness: 240 });
  const numScale = locked ? lerp(1.14, 1, hit) : 1;
  const lock = flash(frame, LOCK_AT, 0, 30);
  const counting = frame >= COUNT_AT && !locked ? 1 : 0;
  const push = lerp(1, 1.05, progress(frame, LOCK_AT, END - LOCK_AT, EASE.linear));
  const glow = 0.5 + 0.2 * counting * Math.abs(Math.sin(frame * 0.9)) + 1.2 * lock + (locked ? 0.3 : 0);

  return (
    <AbsoluteFill
      style={{
        opacity: enter,
        transform: `scale(${lerp(1.5, 1, enter) * push})`,
        filter: enter < 0.98 ? `blur(${(1 - enter) * 18}px)` : undefined,
      }}
    >
      {/* Shock ring on lock. */}
      {locked && (
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 520,
            width: 2,
            height: 2,
          }}
        >
          {[0, 6].map((d) => {
            const p = progress(frame, LOCK_AT + d, 34, EASE.out);
            const r = lerp(560, 1400, p);
            return (
              <div
                key={d}
                style={{
                  position: 'absolute',
                  left: -r,
                  top: -r * 0.62,
                  width: r * 2,
                  height: r * 1.24,
                  borderRadius: '50%',
                  border: `${lerp(6, 1, p)}px solid ${alpha(C.blue400, (1 - p) * (d === 0 ? 0.9 : 0.5))}`,
                  boxShadow: `0 0 40px ${alpha(C.blue400, (1 - p) * 0.5)}`,
                }}
              />
            );
          })}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 236,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: locked ? TERM.success : C.blue400,
            boxShadow: `0 0 12px ${locked ? TERM.success : C.blue400}`,
            opacity: locked ? 1 : 0.4 + 0.6 * (Math.floor(frame / 6) % 2),
          }}
        />
        <Mono size={30} color={C.blue100} tracking="0.16em">
          idle → first byte
        </Mono>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 280,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'baseline',
          transform: `scale(${numScale})`,
          transformOrigin: '50% 60%',
        }}
      >
        <span
          style={{
            ...TYPE.display,
            fontSize: 420,
            lineHeight: 1,
            letterSpacing: '-0.06em',
            fontVariantNumeric: 'tabular-nums',
            color: mix(C.blue400, '#cfe3ff', lock * 0.8),
            textShadow: `0 0 ${40 * glow}px ${alpha(C.blue400, 0.8)}, 0 0 ${140 * glow}px ${alpha(C.blue400, 0.45)}`,
          }}
        >
          {value.toFixed(1)}
        </span>
        <span
          style={{
            ...TYPE.display,
            fontSize: 170,
            marginLeft: 28,
            color: C.slate300,
          }}
        >
          ms
        </span>
      </div>

      <div style={{ position: 'absolute', left: (1920 - RULER_W) / 2, top: 716 }}>
        <Ruler value={locked ? TARGET_MS : count} lock={lock} enter={enter} frame={frame} />
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 862, display: 'flex', justifyContent: 'center' }}>
        <Display size={60} color={C.slate300} style={{ letterSpacing: '-0.04em' }}>
          <SplitText
            text="Cold starts < 10 ms."
            by="word"
            at={LOCK_AT}
            stagger={2}
            duration={12}
            from={{ opacity: 0, y: 0.5, blur: 8 }}
            unitStyle={(_, i) => (i >= 2 ? { color: C.blue400 } : undefined)}
          />{' '}
          <SplitText text="Any workload." by="word" at={LOCK_AT + 6} stagger={2} duration={12} from={{ opacity: 0, y: 0.5, blur: 8 }} />
        </Display>
      </div>
    </AbsoluteFill>
  );
};

export const ColdStart: React.FC = () => {
  const frame = useCurrentFrame();

  // --- Camera -------------------------------------------------------------
  const impactShake = shake(frame, IMPACT_AT, 14, 16, 'cs-impact');
  const deployShake = shake(frame, DEPLOYED_AT, 10, 4, 'cs-deploy');
  const repliedShake = shake(frame, REPLIED_AT, 12, 6, 'cs-replied');
  const lockShake = shake(frame, LOCK_AT, 22, 18, 'cs-lock');

  // Anticipation pull-back, then the dive into the 8.4 ms.
  const anticip = progress(frame, DIVE_AT - 8, 8, EASE.out) * (1 - progress(frame, DIVE_AT, 4, EASE.in));
  const dive = progress(frame, DIVE_AT, 12, Easing.bezier(0.55, 0, 0.9, 0.3));
  const stageScale = lerp(1, 1.035, clamp(frame / DIVE_AT)) * (1 - 0.03 * anticip) * lerp(1, 16, dive);
  const stageBlur = tween(frame, [DIVE_AT + 3, DIVE_AT + 11], [0, 16], EASE.in);
  const stageOpacity = 1 - progress(frame, DIVE_AT + 8, 5, EASE.linear);
  const headlineFade = 1 - progress(frame, DIVE_AT, 6, EASE.in);

  const showStage = frame < DIVE_AT + 14;
  const showReadout = frame >= DIVE_AT + 6;

  // Flashes.
  const lockFlash = flash(frame, LOCK_AT, 0, 12) * 0.75;
  const blueFlash = flash(frame, DIVE_AT + 9, 3, 9) * 0.9;

  // Exit whip.
  const exit = progress(frame, EXIT_AT, END - EXIT_AT, EASE.in);

  const cam = {
    x: impactShake.x + deployShake.x + repliedShake.x + lockShake.x,
    y: impactShake.y + deployShake.y + repliedShake.y + lockShake.y,
    r: impactShake.r + deployShake.r + repliedShake.r + lockShake.r,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: C.black, overflow: 'hidden' }}>
      <Backdrop
        variant="tintC"
        aura={showReadout ? 1.4 + 1.6 * flash(frame, LOCK_AT, 0, 40) : 1.2}
        auraX={showReadout ? 50 : 62}
        auraY={showReadout ? 50 : 70}
        grid={0.05}
        gridSize={64}
        gridOffset={{ x: -frame * 0.6, y: showReadout ? frame * 1.2 : -frame * 0.3 }}
        vignette={0.6}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${cam.x + lerp(0, -520, exit)}px, ${cam.y}px) rotate(${cam.r}deg) scale(${lerp(1, 1.25, exit)}, ${lerp(1, 1.1, exit)})`,
          filter: exit > 0.01 ? `blur(${exit * 24}px)` : undefined,
          opacity: 1 - exit * 0.9,
        }}
      >
        {showStage && (
          <AbsoluteFill
            style={{
              transform: `translate(${(960 - DIVE_ORIGIN.x) * dive}px, ${(540 - DIVE_ORIGIN.y) * dive}px) scale(${stageScale})`,
              transformOrigin: `${DIVE_ORIGIN.x}px ${DIVE_ORIGIN.y}px`,
              filter: stageBlur > 0.1 ? `blur(${stageBlur}px)` : undefined,
              opacity: stageOpacity,
            }}
          >
            <div style={{ opacity: headlineFade }}>
              <Headline />
              <Stepper frame={frame} />
            </div>
            <AbsoluteFill style={{ perspective: 2000, perspectiveOrigin: '60% 45%' }}>
              <HeroTerminal frame={frame} />
            </AbsoluteFill>
          </AbsoluteFill>
        )}
        {showReadout && <Readout frame={frame} />}
      </AbsoluteFill>

      {lockFlash > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(50% 45% at 50% 46%, ${alpha('#9cc6ff', 0.9)} 0%, ${alpha(C.blue400, 0.5)} 45%, transparent 100%)`,
            opacity: lockFlash,
            mixBlendMode: 'screen',
          }}
        />
      )}
      {blueFlash > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(55% 55% at 50% 50%, ${C.white} 0%, #9cc6ff 30%, ${C.blue400} 70%, ${C.blueDeep} 100%)`,
            opacity: blueFlash,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
