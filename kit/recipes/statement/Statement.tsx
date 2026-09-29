import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../design/Backdrop';
import { Checkbox } from '../../design/Checkbox';
import { EASE, lerp, progress, scramble, shake } from '../../design/motion';
import { AccentText, Move, Scramble } from '../../design/Text';
import { alpha, C, FONT, mix, SAFE, TYPE } from '../../design/tokens';
import { useScene } from '../../video/SceneContext';
import { KICKER_FRAMES_PER_CHAR, plainText, type StatementProps } from './plan';

/** Light sweep across a word as it lands (the site's CTA shine, on type). */
const Sweep: React.FC<{ text: string; p: number }> = ({ text, p }) =>
  p <= 0 || p >= 1 ? null : (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        color: 'transparent',
        background: `linear-gradient(100deg, transparent ${lerp(-30, 100, p)}%, rgba(255,255,255,0.95) ${lerp(-15, 115, p)}%, transparent ${lerp(0, 130, p)}%)`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
      }}
    >
      {text}
    </span>
  );

const CHECK = 64;
const CHECK_GAP = 52;

export const Statement: React.FC = () => {
  const frame = useCurrentFrame();
  const { props, at, dur, frames, video } = useScene<StatementProps>();
  const { lines, eyebrow, kicker, checks } = props;

  const indent = checks ? CHECK + CHECK_GAP : 0;
  const longest = Math.max(...lines.map((l) => plainText(l).length));
  const width = 1920 - 2 * SAFE.x - indent;
  const size = props.size ?? Math.round(Math.min(200, width / (longest * 0.53), 640 / lines.length / 0.93));
  const lineH = size * 0.93;
  const blockH = lines.length * lineH + (kicker ? 26 + 56 : 0) + (eyebrow ? 64 : 0);
  const top = (1080 - blockH) / 2 + 20;

  const landAt = lines.map((_, i) => at(`line${i}`));
  const exitAt = at('exit');
  const exit = progress(frame, exitAt, dur('exit'), EASE.in);
  const amp = 9 * video.preset.shake;
  const hits = landAt.map((f, i) => shake(frame, f, 16, amp, `statement-${i}`));
  const push = lerp(1, 1.035, progress(frame, 0, frames, EASE.linear));

  const kickerAt = kicker ? at('kicker') : 0;
  const kickerP = kicker ? progress(frame, kickerAt, kicker.length * KICKER_FRAMES_PER_CHAR, EASE.linear) : 0;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Backdrop
        variant="tintC"
        aura={1.1 + 0.5 * progress(frame, landAt[landAt.length - 1], dur('draw'), EASE.out)}
        auraX={70}
        auraY={52}
        grid={0.05 * progress(frame, -8, 16, EASE.standard)}
        gridOffset={{ x: -frame * 0.25, y: 0 }}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${hits.reduce((a, h) => a + h.x, 0) + lerp(0, -220, exit)}px, ${hits.reduce((a, h) => a + h.y, 0)}px) scale(${push})`,
          transformOrigin: '30% 50%',
          opacity: 1 - exit,
          filter: exit > 0.02 ? `blur(${exit * 14}px)` : undefined,
        }}
      >
        <div style={{ position: 'absolute', left: SAFE.x, top }}>
          {eyebrow && (
            <div
              style={{ ...TYPE.eyebrow, fontSize: 26, letterSpacing: '0.14em', color: C.blue100, height: 64 }}
            >
              <Scramble text={eyebrow} at={0} duration={dur('decode')} />
            </div>
          )}
          {lines.map((line, i) => {
            const land = landAt[i];
            const flash =
              progress(frame, land + 2, 6, EASE.out) * (1 - progress(frame, land + 10, 18, EASE.standard));
            return (
              <div
                key={i}
                style={{ position: 'relative', height: lineH, display: 'flex', alignItems: 'center' }}
              >
                {checks && (
                  <Move at={land - 2} duration={dur(6)} from={{ opacity: 0, scale: 0.4 }} easing={EASE.back}>
                    <Checkbox checked={progress(frame, land + 2, 8, EASE.out)} size={CHECK} />
                  </Move>
                )}
                <Move
                  at={land}
                  duration={dur('enter')}
                  from={{ opacity: 0, scale: 1.45, blur: 22, x: -40 }}
                  origin="0% 60%"
                  style={{ position: 'absolute', left: indent }}
                >
                  <div
                    style={{
                      ...TYPE.display,
                      fontSize: size,
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      color: flash > 0.01 ? mix(C.slate300, C.blue50, flash) : C.slate300,
                    }}
                  >
                    <AccentText text={line} />
                    <Sweep text={plainText(line)} p={progress(frame, land + 3, 16, EASE.standard)} />
                  </div>
                </Move>
              </div>
            );
          })}
          {kicker && (
            <div
              style={{
                marginTop: 26,
                marginLeft: indent + 4,
                fontFamily: FONT.mono,
                fontSize: 46,
                letterSpacing: '0.02em',
                color: C.blue100,
                whiteSpace: 'pre',
                height: 56,
                textShadow: kickerP >= 1 ? `0 0 28px ${alpha(C.blue400, 0.7)}` : undefined,
              }}
            >
              {scramble(kicker, kickerP, frame, kicker, 3)}
              {frame >= kickerAt && Math.floor(frame / 16) % 2 === 0 && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 26,
                    height: 50,
                    marginLeft: 4,
                    verticalAlign: -8,
                    background: C.slate400,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
