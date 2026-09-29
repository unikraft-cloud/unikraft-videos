import type React from 'react';
import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { WORDMARK_VIEWBOX } from '../../brand/logo-data';
import { Backdrop } from '../../design/Backdrop';
import { Logo } from '../../design/Logo';
import { clamp, EASE, lerp, progress, shake } from '../../design/motion';
import { Accent, SplitText } from '../../design/Text';
import { alpha, C, FONT, SAFE, TYPE } from '../../design/tokens';
import { useScene } from '../../video/SceneContext';
import {
  CAPTION_DELAY,
  CAPTION_FADE,
  LETTERS_DELAY,
  TAGLINE_ENTER,
  TAGLINE_STAGGER,
  taglineWords,
  type LogoStingProps,
} from './plan';

const CELL = 44;
const MARK_H = 220;
const LOCKUP_W = (MARK_H * WORDMARK_VIEWBOX.w) / WORDMARK_VIEWBOX.h;
const LOCKUP_LEFT = (1920 - LOCKUP_W) / 2;
/** Offset that puts the mark (alone) dead centre before the wordmark arrives. */
const MARK_CENTER_OFFSET = 960 - (LOCKUP_LEFT + (103.4 / 2 / WORDMARK_VIEWBOX.w) * LOCKUP_W);
const TAGLINE_SIZE = 64;

/** Checkerboard cells shrinking away from the centre (`t` frames after the boom), drawn on a canvas. */
const CheckerDissolve: React.FC<{ t: number; cy: number; slow: number }> = ({ t, cy, slow }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, 1920, 1080);
    const cols = Math.ceil(1920 / CELL) + 1;
    const rows = Math.ceil(1080 / CELL) + 1;
    const ox = 960 - Math.floor(cols / 2) * CELL;
    const oy = 540 - Math.floor(rows / 2) * CELL;
    const maxD = Math.hypot(960, 540);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 !== 0) {
          continue;
        }
        const x = ox + c * CELL;
        const y = oy + r * CELL;
        const d = Math.hypot(x + CELL / 2 - 960, y + CELL / 2 - cy) / maxD;
        const p = clamp((t - 1 - d * 18 * slow) / (9 * slow));
        if (p >= 1) {
          continue;
        }
        const size = CELL * (1 - EASE.in(p));
        // The dissolve front glows brighter than the field behind it.
        const front = Math.max(0, 1 - Math.abs(p - 0.25) * 4);
        ctx.fillStyle = front > 0 ? alpha(C.blue100, 0.35 + 0.5 * front) : alpha(C.blue400, 0.55);
        ctx.fillRect(x + (CELL - size) / 2, y + (CELL - size) / 2, size, size);
      }
    }
  }, [t, cy, slow]);
  return <canvas ref={ref} width={1920} height={1080} style={{ position: 'absolute', inset: 0 }} />;
};

/** Light sweep across the lockup, clipped to its shapes (reads on the mark; the letters are already white). */
const LockupSweep: React.FC<{ p: number }> = ({ p }) => {
  if (p <= 0 || p >= 1) {
    return null;
  }
  const mask = `linear-gradient(110deg, transparent ${lerp(-40, 100, p)}%, black ${lerp(-25, 115, p)}%, transparent ${lerp(-10, 130, p)}%)`;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        filter: 'brightness(0) invert(1)',
        maskImage: mask,
        WebkitMaskImage: mask,
        opacity: 0.85,
      }}
    >
      <Logo height={MARK_H} wordmark />
    </div>
  );
};

export const LogoSting: React.FC = () => {
  const frame = useCurrentFrame();
  const { props, at, dur, beats, video } = useScene<LogoStingProps>();
  const { tagline, caption, checker = true } = props;
  const hasCopy = Boolean(tagline || caption);

  // With copy the lockup sits high (the promo's layout); alone it sits dead centre.
  const lockupTop = hasCopy ? 360 : (1080 - MARK_H) / 2;
  const lockupCy = lockupTop + MARK_H / 2;

  const assembleAt = at('assemble');
  const wordmarkAt = at('wordmark');
  const taglineAt = hasCopy ? at('tagline') : 0;
  const exitAt = at('exit');
  const t = frame - assembleAt;

  const boom = shake(frame, assembleAt, 22, 16 * video.preset.shake, 'logo-boom');
  const slide = progress(frame, wordmarkAt, dur(16), EASE.inOut);
  const markScale = lerp(1.35, 1, slide);
  const ring = progress(frame, assembleAt, dur('draw'), EASE.out);
  const sweep = progress(frame, at('sweep'), dur('draw'), EASE.balanced);
  // Slow drift while the copy is read, then lean into the next scene.
  const settleFrom = hasCopy ? taglineAt : wordmarkAt;
  const drift = lerp(1, 1.035, progress(frame, settleFrom, exitAt - settleFrom, EASE.linear));
  const exit = progress(frame, exitAt, dur('exit'), EASE.in);
  const push = drift * lerp(1, 1.06, exit);
  const glow = 0.9 + 0.5 * progress(frame, exitAt - beats(1), beats(1), EASE.in);
  // Cold open (no checker field): a short blue flash sells the boom.
  const flash = checker ? 0 : 0.5 * (1 - progress(frame, assembleAt, dur('flash') + 4, EASE.out));

  const words = tagline ? taglineWords(tagline) : [];

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Backdrop
        variant="black"
        aura={1.6}
        auraY={(lockupCy / 1080) * 100 - 4}
        grid={0.045}
        gridOffset={{ x: 0, y: frame * 0.35 }}
        vignette={0.7}
      />
      {checker && t < 60 * video.preset.motion && (
        <CheckerDissolve t={t} cy={lockupCy} slow={video.preset.motion} />
      )}

      {/* shockwave */}
      {ring > 0 && ring < 1 && (
        <div
          style={{
            position: 'absolute',
            left: 960 - 700,
            top: lockupCy - 700,
            width: 1400,
            height: 1400,
            borderRadius: '50%',
            border: `${lerp(10, 1, ring)}px solid ${alpha(C.blue100, 1 - ring)}`,
            boxShadow: `0 0 60px ${alpha(C.blue400, 0.6 * (1 - ring))}`,
            transform: `scale(${lerp(0.05, 1.4, ring)})`,
          }}
        />
      )}

      <AbsoluteFill
        style={{
          transform: `translate(${boom.x}px, ${boom.y}px) scale(${push})`,
          transformOrigin: `50% ${(lockupCy / 1080) * 100}%`,
          opacity: 1 - exit,
          filter: exit > 0.02 ? `blur(${exit * 12}px)` : undefined,
        }}
      >
        {/* lockup */}
        <div
          style={{
            position: 'absolute',
            left: LOCKUP_LEFT,
            top: lockupTop,
            transform: `translateX(${lerp(MARK_CENTER_OFFSET, 0, slide)}px)`,
          }}
        >
          <div
            style={{
              transform: `scale(${markScale})`,
              transformOrigin: `${(51.7 / WORDMARK_VIEWBOX.w) * 100}% 50%`,
            }}
          >
            <Logo
              height={MARK_H}
              at={assembleAt}
              wordmark
              lettersDelay={wordmarkAt - assembleAt + LETTERS_DELAY}
              glow={glow}
            />
            <LockupSweep p={sweep} />
          </div>
        </div>

        {hasCopy && (
          <div
            style={{
              position: 'absolute',
              top: lockupTop + MARK_H + 96,
              left: SAFE.x,
              right: SAFE.x,
              textAlign: 'center',
            }}
          >
            {tagline && (
              <div
                style={{ ...TYPE.title, fontSize: TAGLINE_SIZE, color: C.slate300, letterSpacing: '-0.03em' }}
              >
                <SplitText
                  text={words.map((w) => w.word).join(' ')}
                  by="word"
                  at={taglineAt}
                  stagger={TAGLINE_STAGGER}
                  duration={dur(TAGLINE_ENTER)}
                  unitStyle={(_, i) => (words[i]?.accent ? { color: C.blue400, fontWeight: 600 } : undefined)}
                />
              </div>
            )}
            {caption && (
              <div
                style={{
                  marginTop: tagline ? 30 : 0,
                  fontFamily: FONT.mono,
                  fontSize: 26,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: C.slate500,
                  opacity: progress(
                    frame,
                    taglineAt + (tagline ? CAPTION_DELAY : 0),
                    dur(CAPTION_FADE),
                    EASE.standard,
                  ),
                }}
              >
                <Accent color={C.blue100}>[</Accent> {caption} <Accent color={C.blue100}>]</Accent>
              </div>
            )}
          </div>
        )}
      </AbsoluteFill>

      {flash > 0.01 && <AbsoluteFill style={{ background: alpha(C.blue100, flash) }} />}
    </AbsoluteFill>
  );
};
