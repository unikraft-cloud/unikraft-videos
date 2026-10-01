import type React from 'react';
import { useId } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import {
  LOGO_GRADIENTS,
  MARK_BODY,
  MARK_IN_WORDMARK_SCALE,
  MARK_STRIPES,
  MARK_VIEWBOX,
  WORDMARK_LETTERS,
  WORDMARK_VIEWBOX,
} from '../../../kit/brand/logo-data';
import { Backdrop } from '../../../kit/design/Backdrop';
import { EASE, lerp, progress } from '../../../kit/design/motion';
import { Move } from '../../../kit/design/Text';
import { alpha, C } from '../../../kit/design/tokens';
import { useScene } from '../../../kit/video/SceneContext';

/**
 * Collab outro: Netlify and Unikraft logos side by side on a slow two-tone gradient.
 *
 *   0         gradient breathes in from black
 *   netlify   Netlify logo slides in from the left            (whoosh)
 *   divider   hairline draws between the two
 *   unikraft  Unikraft mark draws on as strokes (the U, then the stripes top → bottom),
 *             fills in, and the letters rise                  (shimmer, then chime)
 *   exit      everything fades to black
 */

/** Official Netlify full logo, large, full colour on dark (netlify.com/about brand assets). */
const NETLIFY = { src: 'logos/netlify.svg', w: 512, h: 209, teal: '#32e6e2' };
const NETLIFY_H = 190;
const UNIKRAFT_H = 92;
const GAP = 96;
/** Trim stroke width, in mark units (~1.5 px at UNIKRAFT_H). */
const STROKE = 0.9;

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { at, dur, frames } = useScene();
  const exitAt = at('exit');

  const glow = progress(frame, 0, dur(40), EASE.out);
  const drift = progress(frame, 0, frames, EASE.linear);
  const line = progress(frame, at('divider'), dur('draw'), EASE.inOut);
  const exit = progress(frame, exitAt, dur('exit'), EASE.in);
  const push = lerp(1, 1.035, progress(frame, 0, frames, EASE.inOut));

  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: 1 - exit }}>
      <Backdrop variant="black" aura={0} vignette={0.7}>
        <AbsoluteFill
          style={{
            opacity: glow,
            background: [
              `radial-gradient(55% 70% at ${lerp(26, 32, drift)}% ${lerp(58, 50, drift)}%, ${alpha(NETLIFY.teal, 0.13)} 0%, transparent 70%)`,
              `radial-gradient(55% 70% at ${lerp(76, 69, drift)}% ${lerp(44, 52, drift)}%, ${alpha(C.blue400, 0.2)} 0%, transparent 70%)`,
            ].join(', '),
          }}
        />
      </Backdrop>
      <AbsoluteFill
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: GAP,
          transform: `scale(${push})`,
          filter: exit > 0.02 ? `blur(${exit * 10}px)` : undefined,
        }}
      >
        <Move at={at('netlify')} duration={dur('enter')} from={{ opacity: 0, x: -60, blur: 14 }}>
          <Img
            src={staticFile(NETLIFY.src)}
            style={{ display: 'block', height: NETLIFY_H, width: (NETLIFY_H * NETLIFY.w) / NETLIFY.h }}
          />
        </Move>
        <div
          style={{
            width: 2,
            height: 140,
            background: `linear-gradient(180deg, transparent, ${C.slate500}, transparent)`,
            transform: `scaleY(${line})`,
            opacity: line,
          }}
        />
        <UnikraftTrim at={at('unikraft')} height={UNIKRAFT_H} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * The Unikraft wordmark with a stroke-trim build: the U body's outline draws on, the stripes'
 * outlines draw on top → bottom right behind it, then both fill in and the letters rise.
 */
const UnikraftTrim: React.FC<{ at: number; height: number }> = ({ at, height }) => {
  const frame = useCurrentFrame();
  const { dur } = useScene();
  const id = useId().replace(/:/g, '');
  const t = frame - at;
  const vb = WORDMARK_VIEWBOX;
  const width = (height * vb.w) / vb.h;

  const bodyTrim = progress(t, 0, dur(44), EASE.inOut);
  const bodyFill = progress(t, dur(34), dur(16), EASE.out);
  const strokeFade = 1 - progress(t, dur(56), dur(18), EASE.inOut);
  const lettersAt = dur(40);

  return (
    <div style={{ position: 'relative', width, height }}>
      <div
        style={{
          position: 'absolute',
          left: (height * MARK_VIEWBOX.w * MARK_IN_WORDMARK_SCALE) / vb.h / 2 - height * 1.1,
          top: -height * 0.6,
          width: height * 2.2,
          height: height * 2.2,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 112, 240, 0.3) 0%, rgba(0, 112, 240, 0) 62%)',
          opacity: bodyFill,
        }}
      />
      <svg
        viewBox={`0 0 ${vb.w} ${vb.h}`}
        width={width}
        height={height}
        style={{ position: 'relative', display: 'block', overflow: 'visible' }}
      >
        <defs>
          <radialGradient
            id={`${id}-body`}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(16.0718,20.5709,-35.9993,28.1257,14.8241,23.4977)"
          >
            <stop offset="0" stopColor={LOGO_GRADIENTS.body.from} />
            <stop offset="1" stopColor={LOGO_GRADIENTS.body.to} />
          </radialGradient>
          <linearGradient
            id={`${id}-stripes`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="userSpaceOnUse"
            gradientTransform="matrix(-0.676277,-37.9208,37.9208,-0.676277,36.1334,38.0657)"
          >
            {LOGO_GRADIENTS.stripes.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>

        <g transform={`scale(${MARK_IN_WORDMARK_SCALE})`}>
          <TrimPath
            d={MARK_BODY.d}
            paint={`url(#${id}-body)`}
            trim={bodyTrim}
            fill={bodyFill}
            stroke={strokeFade}
          />
          {MARK_STRIPES.map((stripe, i) => (
            <TrimPath
              key={stripe.y}
              d={stripe.d}
              paint={`url(#${id}-stripes)`}
              trim={progress(t, dur(8 + i * 2.5), dur(20), EASE.out)}
              fill={progress(t, dur(26 + i * 2), dur(12), EASE.out)}
              stroke={strokeFade}
            />
          ))}
        </g>

        {WORDMARK_LETTERS.map((letter, i) => {
          const p = progress(t, lettersAt + dur(i * 2), dur(16), EASE.out);
          return (
            <path
              key={letter.x}
              d={letter.d}
              fill={C.white}
              opacity={p}
              transform={`translate(0 ${lerp(38, 0, p)})`}
            />
          );
        })}
      </svg>
    </div>
  );
};

/** One logo part: its outline trimmed on to `trim` (0…1), its fill faded to `fill`, the outline faded by `stroke`. */
const TrimPath: React.FC<{ d: string; paint: string; trim: number; fill: number; stroke: number }> = ({
  d,
  paint,
  trim,
  fill,
  stroke,
}) => (
  <>
    {fill > 0 && <path d={d} fill={paint} opacity={fill} />}
    {trim > 0 && stroke > 0 && (
      <path
        d={d}
        fill="none"
        stroke={paint}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - trim}
        opacity={stroke}
      />
    )}
  </>
);
