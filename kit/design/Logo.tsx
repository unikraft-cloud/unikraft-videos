import type React from 'react';
import { useId } from 'react';
import { useCurrentFrame } from 'remotion';
import {
  LOGO_GRADIENTS,
  MARK_BODY,
  MARK_IN_WORDMARK_SCALE,
  MARK_STRIPES,
  MARK_VIEWBOX,
  WORDMARK_LETTERS,
  WORDMARK_VIEWBOX,
} from '../brand/logo-data';
import { EASE, lerp, progress } from './motion';
import { C } from './tokens';

type LogoProps = {
  /** Rendered height in px. */
  height: number;
  /** Scene-local frame the assembly starts. Omit for a static, fully-built logo. */
  at?: number;
  /** Render the "Unikraft" wordmark next to the mark. */
  wordmark?: boolean;
  letterColor?: string;
  /** Frame (relative to `at`) the letters start rising in. Default 14 (right behind the mark). */
  lettersDelay?: number;
  /** Blue bloom behind the mark (0 = off). */
  glow?: number;
  style?: React.CSSProperties;
};

/**
 * The Unikraft mark (and optional wordmark), assembled stripe by stripe:
 * the 11 stripes shoot in from the right top → bottom, the "U" body springs up
 * from its base, then the letters rise in.
 */
export const Logo: React.FC<LogoProps> = ({
  height,
  at,
  wordmark = false,
  letterColor = C.white,
  lettersDelay = 14,
  glow = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const id = useId().replace(/:/g, '');
  // A static logo is just an assembly that finished long ago.
  const t = at === undefined ? 1e6 : frame - at;

  const vb = wordmark ? WORDMARK_VIEWBOX : MARK_VIEWBOX;
  const width = (height * vb.w) / vb.h;
  const markScale = wordmark ? MARK_IN_WORDMARK_SCALE : 1;

  const body = progress(t, 5, 18, EASE.back);
  const bodyFade = progress(t, 5, 4, EASE.linear);

  return (
    <div style={{ position: 'relative', width, height, ...style }}>
      {glow > 0 && (
        <div
          style={{
            position: 'absolute',
            left: (height * MARK_VIEWBOX.w * markScale) / vb.h / 2 - height * 1.1,
            top: -height * 0.6,
            width: height * 2.2,
            height: height * 2.2,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(0, 112, 240, ${0.5 * glow}) 0%, rgba(0, 112, 240, 0) 62%)`,
            opacity: bodyFade,
          }}
        />
      )}
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

        <g transform={`scale(${markScale})`}>
          <path
            d={MARK_BODY.d}
            fill={`url(#${id}-body)`}
            opacity={bodyFade}
            transform={`translate(0 ${MARK_VIEWBOX.h}) scale(1 ${Math.max(0.001, body)}) translate(0 ${-MARK_VIEWBOX.h})`}
          />
          {MARK_STRIPES.map((stripe, i) => {
            const p = progress(t, i * 1.5, 12, EASE.out);
            const flash = 1 - progress(t, i * 1.5 + 6, 10, EASE.standard);
            return (
              <g key={stripe.y} transform={`translate(${lerp(24, 0, p)} 0)`} opacity={progress(t, i * 1.5, 3, EASE.linear)}>
                <path d={stripe.d} fill={`url(#${id}-stripes)`} />
                {flash > 0.01 && at !== undefined && <path d={stripe.d} fill={C.white} opacity={flash * 0.9} />}
              </g>
            );
          })}
        </g>

        {wordmark &&
          WORDMARK_LETTERS.map((letter, i) => {
            const p = progress(t, lettersDelay + i * 2, 16, EASE.out);
            return (
              <path
                key={letter.x}
                d={letter.d}
                fill={letterColor}
                opacity={p}
                transform={`translate(0 ${lerp(38, 0, p)})`}
              />
            );
          })}
      </svg>
    </div>
  );
};
