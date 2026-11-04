import type React from 'react';
import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Logo } from '../../../kit/design/Logo';
import { clamp, EASE, lerp, progress } from '../../../kit/design/motion';
import { Move } from '../../../kit/design/Text';
import { alpha, C, FONT, mix } from '../../../kit/design/tokens';
import { useScene } from '../../../kit/video/SceneContext';

/**
 * Outro card: the Unikraft lockup and a one-line tagline, centred on a halftone field of blue
 * squares that are large at the frame edges and shrink to dots toward the clear centre. Last
 * frame of the video, so it holds still to the end (no exit). Sized for a 1440×1440 square.
 *
 *   field    backdrop fades up from black, the squares pop in staggered, ring by ring from the
 *            frame edges to the clear centre
 *   logo     lockup assembles: stripes slide in, the U outline draws and fills, then the
 *            "Unikraft" letters (Inter Display) fade in one by one, no transform
 *   tagline  `props.tagline` rises in under it, light slate
 */

export type OutroProps = { tagline: string };

/** Halftone grid pitch and the largest square, as a share of the pitch (at the frame edge). */
const PITCH = 24;
const MAX_FILL = 0.64;
/** Superellipse exponent of the field's distance metric: 2 = ellipse, higher = squarer. */
const SHAPE = 3;
/** Normalised distance where the dots start (inside it the centre is clear), and the edge. */
const CLEAR = 0.5;
const EDGE = 1.02;
const COLOR = mix(C.blue400, C.blue200, 0.45);
/** Stagger: rings from the edge inward, frames between rings, per-square jitter, pop length. */
const RINGS = 14;
const RING_STEP = 3.5;
const JITTER = 5;
const POP = 12;

const LOGO_H = 140;
const TAGLINE_SIZE = 60;
/** Logo assembly speed (Logo `pace`): 0.6 = every step takes 0.6× the kit default, ~0.5 s in all. */
const LOGO_PACE = 0.6;

/** The edge halftone, drawn on a canvas. `grow` maps a cell's ring (0 = frame edge) and seed to its 0…1 entrance. */
const HalftoneField: React.FC<{
  W: number;
  H: number;
  frame: number;
  grow: (ring: number, seed: string) => number;
}> = ({ W, H, frame, grow }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, W, H);
    const cols = Math.ceil(W / PITCH) + 1;
    const rows = Math.ceil(H / PITCH) + 1;
    // Grid centred on the frame, so the field is symmetric left/right and top/bottom.
    const ox = W / 2 - (cols / 2) * PITCH;
    const oy = H / 2 - (rows / 2) * PITCH;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = ox + (c + 0.5) * PITCH;
        const cy = oy + (r + 0.5) * PITCH;
        const dx = Math.abs(cx - W / 2) / (W / 2);
        const dy = Math.abs(cy - H / 2) / (H / 2);
        const d = (dx ** SHAPE + dy ** SHAPE) ** (1 / SHAPE);
        const ramp = clamp((d - CLEAR) / (EDGE - CLEAR));
        if (ramp <= 0) {
          continue;
        }
        const ring = Math.min(RINGS - 1, Math.floor((1 - ramp) * RINGS));
        const size = PITCH * MAX_FILL * ramp ** 1.35 * grow(ring, `${r}-${c}`);
        if (size < 1.2) {
          continue;
        }
        ctx.fillStyle = alpha(COLOR, 0.4 + 0.6 * ramp);
        ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      }
    }
  }, [W, H, frame, grow]);
  return <canvas ref={ref} width={W} height={H} style={{ position: 'absolute', inset: 0 }} />;
};

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { at, dur, frames, props, video } = useScene<OutroProps>();
  const fieldAt = at('field');
  const logoAt = at('logo');

  const fadeUp = progress(frame, fieldAt, at('logo') + dur(12), EASE.inOut);
  // Staggered: ring by ring from the frame edge inward, each square popping in a few frames
  // off its neighbours (deterministic jitter) so the field sparkles in rather than sweeping.
  const grow = (ring: number, seed: string) =>
    progress(frame, fieldAt + ring * RING_STEP + random(`outro-${seed}`) * JITTER, dur(POP), EASE.back);
  const settle = progress(frame, fieldAt, frames, EASE.out);
  const fieldScale = lerp(1.04, 1, settle);
  const push = lerp(1.03, 1, progress(frame, logoAt, frames - logoAt, EASE.out));

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: C.black }}>
      <AbsoluteFill style={{ opacity: fadeUp }}>
        <Backdrop variant="plain" aura={0.9} auraY={46} vignette={0} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${fieldScale})` }}>
        <HalftoneField W={video.canvas.width} H={video.canvas.height} frame={frame} grow={grow} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${push})`,
        }}
      >
        <Logo
          height={LOGO_H}
          at={logoAt}
          wordmark
          lettersDelay={14}
          pace={LOGO_PACE}
          glow={0.35}
          body="trace"
          font="display"
          letters="fade"
        />
        <Move
          at={at('tagline')}
          duration={dur(24)}
          from={{ opacity: 0, y: 32, blur: 12 }}
          style={{
            marginTop: 72,
            fontFamily: FONT.sans,
            fontWeight: 400,
            fontSize: TAGLINE_SIZE,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            color: C.slate300,
            whiteSpace: 'nowrap',
          }}
        >
          {props.tagline}
        </Move>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
