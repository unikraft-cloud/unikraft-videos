import type React from 'react';
import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { WORDMARK_VIEWBOX } from '../../../kit/brand/logo-data';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Logo } from '../../../kit/design/Logo';
import { clamp, EASE, lerp, progress, shake } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { Accent, SplitText } from '../../../kit/design/Text';
import { alpha, C, FONT, TYPE } from '../../../kit/design/tokens';

/**
 * 02 · Logo sting (4 beats). Picks up the hook's checker field on the boom:
 * the cells dissolve outward from the centre while the mark assembles, a
 * shockwave rolls out, then the mark slides left as the wordmark rises in
 * (b9), the tagline lands (b10), a light sweep crosses the lockup and the
 * frame leans into the stripe wipe that opens the FAST chapter.
 */

const CELL = 44;
const MARK_H = 220;
const LOCKUP_W = (MARK_H * WORDMARK_VIEWBOX.w) / WORDMARK_VIEWBOX.h;
const LOCKUP_LEFT = (1920 - LOCKUP_W) / 2;
const LOCKUP_TOP = 360;
/** Offset that puts the mark (alone) dead centre before the wordmark arrives. */
const MARK_CENTER_OFFSET = 960 - (LOCKUP_LEFT + (103.4 / 2 / WORDMARK_VIEWBOX.w) * LOCKUP_W);

const SLIDE_AT = beats(1);
const TAGLINE_AT = beats(2);
const SWEEP_AT = beats(2) + 8;

/** Checkerboard cells shrinking away from the centre, drawn on a canvas (≈550 live cells). */
const CheckerDissolve: React.FC<{ frame: number }> = ({ frame }) => {
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
        const d = Math.hypot(x + CELL / 2 - 960, y + CELL / 2 - 540) / maxD;
        const p = clamp((frame - 1 - d * 18) / 9);
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
  }, [frame]);
  return <canvas ref={ref} width={1920} height={1080} style={{ position: 'absolute', inset: 0 }} />;
};

export const LogoSting: React.FC = () => {
  const frame = useCurrentFrame();

  const boom = shake(frame, 0, 22, 16, 'logo-boom');
  const slide = progress(frame, SLIDE_AT, 16, EASE.inOut);
  const markScale = lerp(1.35, 1, slide);
  const push = lerp(1, 1.07, progress(frame, TAGLINE_AT, beats(2), EASE.in));
  const ring = progress(frame, 0, 26, EASE.out);
  const sweep = progress(frame, SWEEP_AT, 26, EASE.balanced);
  const glow = 0.9 + 0.5 * progress(frame, beats(3), beats(1), EASE.in);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Backdrop variant="black" aura={1.6} auraY={46} grid={0.045} gridOffset={{ x: 0, y: frame * 0.35 }} vignette={0.7} />
      <CheckerDissolve frame={frame} />

      {/* shockwave */}
      {ring < 1 && (
        <div
          style={{
            position: 'absolute',
            left: 960 - 700,
            top: 470 - 700,
            width: 1400,
            height: 1400,
            borderRadius: '50%',
            border: `${lerp(10, 1, ring)}px solid ${alpha(C.blue100, 1 - ring)}`,
            boxShadow: `0 0 60px ${alpha(C.blue400, 0.6 * (1 - ring))}`,
            transform: `scale(${lerp(0.05, 1.4, ring)})`,
          }}
        />
      )}

      <AbsoluteFill style={{ transform: `translate(${boom.x}px, ${boom.y}px) scale(${push})`, transformOrigin: '50% 45%' }}>
        {/* lockup */}
        <div
          style={{
            position: 'absolute',
            left: LOCKUP_LEFT,
            top: LOCKUP_TOP,
            transform: `translateX(${lerp(MARK_CENTER_OFFSET, 0, slide)}px)`,
          }}
        >
          <div style={{ transform: `scale(${markScale})`, transformOrigin: `${(51.7 / WORDMARK_VIEWBOX.w) * 100}% 50%` }}>
            <Logo height={MARK_H} at={0} wordmark lettersDelay={SLIDE_AT + 2} glow={glow} />
            {/* light sweep across the lockup, clipped to its shapes (reads on the mark; letters are already white) */}
            {sweep > 0 && sweep < 1 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  filter: 'brightness(0) invert(1)',
                  maskImage: `linear-gradient(110deg, transparent ${lerp(-40, 100, sweep)}%, black ${lerp(-25, 115, sweep)}%, transparent ${lerp(-10, 130, sweep)}%)`,
                  WebkitMaskImage: `linear-gradient(110deg, transparent ${lerp(-40, 100, sweep)}%, black ${lerp(-25, 115, sweep)}%, transparent ${lerp(-10, 130, sweep)}%)`,
                  opacity: 0.85,
                }}
              >
                <Logo height={MARK_H} wordmark />
              </div>
            )}
          </div>
        </div>

        {/* tagline */}
        <div
          style={{
            position: 'absolute',
            top: LOCKUP_TOP + MARK_H + 96,
            left: 0,
            right: 0,
            textAlign: 'center',
          }}
        >
          <div style={{ ...TYPE.title, fontSize: 64, color: C.slate300, letterSpacing: '-0.03em' }}>
            <SplitText
              text="The millisecond compute layer."
              by="word"
              at={TAGLINE_AT}
              stagger={3}
              duration={14}
              unitStyle={(word) => (word === 'millisecond' ? { color: C.blue400, fontWeight: 600 } : undefined)}
            />
          </div>
          <div
            style={{
              marginTop: 30,
              fontFamily: FONT.mono,
              fontSize: 24,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: C.slate500,
              opacity: progress(frame, TAGLINE_AT + 10, 12, EASE.standard),
            }}
          >
            <Accent color={C.blue100}>[</Accent> Unikraft Cloud · Linux-based microVMs <Accent color={C.blue100}>]</Accent>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
