import type React from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../design/Backdrop';
import { Icon } from '../../design/Icon';
import { clamp, EASE, lerp, pop, progress, shake, tween } from '../../design/motion';
import { Terminal as TerminalWindow, type TermLine } from '../../design/Terminal';
import { Display, Mono } from '../../design/Text';
import { alpha, C, FONT, TERM } from '../../design/tokens';
import { useScene } from '../../video/SceneContext';
import { AccentLine, flash, LockFlash, Readout } from '../stat/Readout';
import {
  CH,
  lineRows,
  ROW,
  TERM_CHROME,
  TERM_FS,
  terminalLayout,
  terminalLines,
  TITLE_TOP,
  TYPE_FRAMES_PER_CHAR,
  type TerminalProps,
} from './plan';

const STEP_BOX = 76;
const STEP_GAP = 132;
const STEP_ICONS = [
  'solar:box-bold',
  'solar:global-bold',
  'solar:bolt-bold',
  'solar:check-circle-bold',
] as const;

type Step = {
  label: string;
  caption?: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  activeAt: number;
  doneAt: number;
};

/** The promo's deploy stepper: icon boxes on a rail that fills blue as each step ticks. */
const Stepper: React.FC<{ frame: number; steps: Step[]; top: number }> = ({ frame, steps, top }) => (
  <div style={{ position: 'absolute', left: 120, top, width: 580 }}>
    <div
      style={{
        position: 'absolute',
        left: STEP_BOX / 2 - 1.5,
        top: STEP_BOX,
        width: 3,
        height: STEP_GAP * (steps.length - 1) - STEP_BOX,
        background: C.slate800,
        borderRadius: 2,
        opacity: progress(frame, 10, 14),
      }}
    />
    {steps.slice(0, -1).map((st, i) => (
      <div
        key={`rail${i}`}
        style={{
          position: 'absolute',
          left: STEP_BOX / 2 - 1.5,
          top: STEP_BOX + i * STEP_GAP,
          width: 3,
          height: (STEP_GAP - STEP_BOX) * progress(frame, st.doneAt, 10, EASE.out),
          background: C.blue400,
          boxShadow: `0 0 12px ${alpha(C.blue400, 0.8)}`,
          borderRadius: 2,
        }}
      />
    ))}
    {steps.map((st, i) => {
      const enter = progress(frame, 12 + i * 3, 14);
      const active = progress(frame, st.activeAt, 6);
      const done = frame >= st.doneAt;
      const hit = pop(frame, st.doneAt, { damping: 11 });
      const scale = done ? lerp(1.18, 1, hit) : 1;
      const pulse = active * (done ? 0 : 1) * (0.5 + 0.5 * Math.sin((frame - st.activeAt) * 0.6));
      const border = done ? C.blue400 : active > 0 ? alpha(C.blue400, 0.5 + 0.4 * pulse) : C.slate700;
      const burst = flash(frame, st.doneAt, 0, 18);
      return (
        <div
          key={st.label}
          style={{
            position: 'absolute',
            left: 0,
            top: i * STEP_GAP,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            opacity: enter,
            transform: `translateX(${lerp(-40, 0, enter)}px)`,
          }}
        >
          <div
            style={{
              width: STEP_BOX,
              height: STEP_BOX,
              borderRadius: 14,
              border: `2px solid ${border}`,
              background: done ? alpha(C.blue400, 0.12 + 0.3 * burst) : alpha(C.slate900, 0.7),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${scale})`,
              boxShadow: done
                ? `0 0 ${24 + 50 * burst}px ${alpha(C.blue400, 0.35 + 0.5 * burst)}`
                : active > 0
                  ? `0 0 ${18 * pulse}px ${alpha(C.blue400, 0.4)}`
                  : undefined,
              flexShrink: 0,
            }}
          >
            <Icon name={st.icon} size={38} color={done ? C.blue100 : active > 0 ? C.blue200 : C.slate600} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Mono
                size={26}
                color={done ? C.blue100 : active > 0 ? C.slate300 : C.slate500}
                tracking="0.1em"
              >
                {`${String(i + 1).padStart(2, '0')} · ${st.label}`}
              </Mono>
              {done && (
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 26,
                    color: TERM.success,
                    transform: `scale(${lerp(1.6, 1, hit)})`,
                    display: 'inline-block',
                  }}
                >
                  ✓
                </span>
              )}
            </div>
            {st.caption && (
              <span
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 30,
                  letterSpacing: '-0.01em',
                  color: done ? C.slate300 : C.slate500,
                  whiteSpace: 'nowrap',
                }}
              >
                {st.caption}
              </span>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

export const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { props, at, dur, frames, video } = useScene<TerminalProps>();
  const { result } = props;
  const amp = video.preset.shake;
  const all = terminalLines(props);
  const layout = terminalLayout(props);
  const { x: termX, y: termY, w: termW } = layout;

  // --- Lines, stepper, dive target ----------------------------------------
  const lines: TermLine[] = all.map((l) =>
    l.kind === 'command'
      ? { kind: 'command', text: l.text, at: at(`cmd${l.cmd}`), cpf: 1 / TYPE_FRAMES_PER_CHAR }
      : { kind: l.kind, text: l.text, value: l.value, at: at(`out${l.cmd}_${l.out}`) - 3 },
  );
  const landAt = all.map((l) => (l.kind === 'command' ? at(`typed${l.cmd}`) : at(`out${l.cmd}_${l.out}`)));
  const steps: Step[] = layout.steps
    ? props.commands.map((c, i) => {
        const outs = c.output?.length ?? 0;
        return {
          label: c.step?.label ?? '',
          caption: c.step?.caption,
          icon: c.step?.icon ?? STEP_ICONS[Math.min(i, STEP_ICONS.length - 1)],
          activeAt: at(`cmd${i}`),
          doneAt: outs ? at(`out${i}_${outs - 1}`) : at(`typed${i}`),
        };
      })
    : [];
  // Body height = every row, so the window doesn't grow as lines print.
  let y = 0;
  const rowTop = all.map((l, i) => {
    const prev = all[i - 1];
    y +=
      i === 0 ? 0 : prev.kind === 'command' && l.kind !== 'command' ? 4 * (TERM_FS / 13) : 2 * (TERM_FS / 13);
    const top = y;
    y += lineRows(l, termW) * ROW;
    return top;
  });
  const bodyH = y;
  const diveIdx = all.length - 1;
  const dive = all[diveIdx];
  const badge = {
    x:
      TERM_CHROME.border +
      TERM_CHROME.padX +
      CH +
      2 * TERM_CHROME.gap +
      dive.text.length * CH +
      12 * (TERM_FS / 13),
    y: TERM_CHROME.border + TERM_CHROME.bar + TERM_CHROME.padTop + rowTop[diveIdx],
    w: (dive.value ?? '').length * CH,
  };

  // --- Timing -------------------------------------------------------------
  const exitAt = at('exit');
  // Without a result the dive never comes (a finite frame past the end: interpolate rejects Infinity).
  const never = frames * 4;
  const diveAt = result ? at('dive') : never;
  const countAt = result ? at('count') : never;
  const lockAt = result ? at('lock') : never;
  const repliedAt = landAt[diveIdx];
  const titleAt = props.title ? at('title') : 0;

  // --- Camera -------------------------------------------------------------
  const shakes = [
    shake(frame, 0, 14, 12 * amp, 'term-in'),
    ...landAt.map((f, i) =>
      all[i].kind === 'success' ? shake(frame, f, 10, 4 * amp, `term-ok-${i}`) : { x: 0, y: 0, r: 0 },
    ),
    shake(frame, lockAt, 22, 18 * amp, 'term-lock'),
  ];
  const cam = shakes.reduce((a, s) => ({ x: a.x + s.x, y: a.y + s.y, r: a.r + s.r }), { x: 0, y: 0, r: 0 });

  // The badge on screen at the dive, after the push-in (origin 120px 45%, ×1.035).
  const diveOrigin = {
    x: 120 + (termX + badge.x + badge.w / 2 - 120) * 1.035,
    y: 486 + (termY + badge.y + ROW / 2 + 20 - 486) * 1.035,
  };
  const anticip = progress(frame, diveAt - 8, 8, EASE.out) * (1 - progress(frame, diveAt, 4, EASE.in));
  const diveP = progress(frame, diveAt, 12, Easing.bezier(0.55, 0, 0.9, 0.3));
  const settle = Math.min(diveAt, exitAt);
  const stageScale = (1 - 0.03 * anticip) * lerp(1, 16, diveP);
  // Slow push-in, anchored on the safe-area edge so the headline never leaves it.
  const drift = clamp(frame / settle);
  const push = lerp(1, 1.035, drift);
  const stageBlur = tween(frame, [diveAt + 3, diveAt + 11], [0, 16], EASE.in);
  const stageOpacity = 1 - progress(frame, diveAt + 8, 5, EASE.linear);
  const headlineFade = 1 - progress(frame, diveAt, 6, EASE.in);
  const showStage = frame < diveAt + 14;
  const showReadout = frame >= diveAt + 6;
  const blueFlash = flash(frame, diveAt + 9, 3, 9) * 0.9;
  const exit = progress(frame, exitAt, dur('exit'), EASE.in);

  // --- Terminal -----------------------------------------------------------
  const enter = progress(frame, 0, dur(14), EASE.out);
  const rx = lerp(25, 8, enter) - 2 * drift;
  const ry = lerp(-20, layout.steps ? -10 : -6, enter) + 3 * drift;
  const valueIn = progress(frame, repliedAt, 10, EASE.out);
  const valueGlow = flash(frame, repliedAt, 0, 24) + (frame >= repliedAt ? 0.45 : 0);
  const sweep = progress(frame, 2, 22, EASE.inOut);
  const highlight = (i: number) => (all[i].kind === 'success' ? flash(frame, landAt[i], 0, 20) * 0.8 : 0);

  return (
    <AbsoluteFill style={{ backgroundColor: C.black, overflow: 'hidden' }}>
      <Backdrop
        variant="tintC"
        aura={showReadout ? 1.4 + 1.6 * flash(frame, lockAt, 0, 40) : 1.2}
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
              transform: `translate(${(960 - diveOrigin.x) * diveP}px, ${(540 - diveOrigin.y) * diveP}px) scale(${stageScale})`,
              transformOrigin: `${diveOrigin.x}px ${diveOrigin.y}px`,
              filter: stageBlur > 0.1 ? `blur(${stageBlur}px)` : undefined,
              opacity: stageOpacity,
            }}
          >
            <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '120px 45%' }}>
              <div style={{ opacity: headlineFade }}>
                {layout.titleLines.length > 0 && (
                  <div style={{ position: 'absolute', left: 120, top: TITLE_TOP }}>
                    <Display
                      size={layout.titleSize}
                      color={C.slate300}
                      style={{ lineHeight: 0.98, whiteSpace: 'nowrap' }}
                    >
                      {layout.titleLines.map((line, i) => (
                        <div key={i}>
                          <AccentLine line={line} at={titleAt - 5 + i * 9} />
                        </div>
                      ))}
                    </Display>
                  </div>
                )}
                {steps.length > 0 && <Stepper frame={frame} steps={steps} top={termY + 46} />}
              </div>
              <AbsoluteFill style={{ perspective: 2000, perspectiveOrigin: '60% 45%' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: termX,
                    top: termY,
                    width: termW,
                    transformStyle: 'preserve-3d',
                    transform: `translateY(${lerp(120, 0, enter)}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${lerp(-3, 0, enter)}deg) scale(${lerp(0.85, 1, enter)})`,
                    transformOrigin: '50% 40%',
                    opacity: clamp(0.75 + enter * 3),
                  }}
                >
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
                  <TerminalWindow
                    lines={lines}
                    title={props.window}
                    width={termW}
                    fontSize={TERM_FS}
                    minBodyHeight={bodyH}
                    highlight={highlight}
                    style={{
                      boxShadow: `0 2px 0 0 rgba(255,255,255,0.06) inset, 0 60px 120px -40px rgba(0,0,0,0.9), 0 0 140px -30px ${alpha(C.blue400, 0.4)}`,
                    }}
                  />
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
                        left: lerp(-400, termW + 200, sweep),
                        transform: 'rotate(18deg)',
                        background: `linear-gradient(90deg, transparent, ${alpha(C.white, 0.07)}, transparent)`,
                        opacity: sweep < 1 ? 1 : 0,
                      }}
                    />
                  </div>
                  {result && frame >= repliedAt && (
                    <div
                      style={{
                        position: 'absolute',
                        left: badge.x - 11,
                        top: badge.y,
                        height: ROW,
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
                      {dive.value}
                    </div>
                  )}
                </div>
              </AbsoluteFill>
            </AbsoluteFill>
          </AbsoluteFill>
        )}
        {result && showReadout && (
          <Readout
            enterAt={diveAt + 7}
            enterDur={16}
            countAt={countAt}
            lockAt={lockAt}
            value={result.value}
            from={result.from ?? 0}
            decimals={result.decimals ?? 0}
            suffix={result.unit}
            eyebrow={result.label}
            headline={result.caption ? [result.caption] : undefined}
            headlineAt={lockAt}
            scale={
              result.max
                ? { max: result.max, unit: result.unit, limit: result.limitLabel ?? 'limit' }
                : undefined
            }
            holdFrames={frames - lockAt}
          />
        )}
      </AbsoluteFill>
      {result && <LockFlash at={lockAt} />}
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
