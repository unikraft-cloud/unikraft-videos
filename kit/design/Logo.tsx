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
import { C, FONT } from './tokens';

const WORDMARK_TEXT = 'Unikraft';
/**
 * `font="display"` lockup, in wordmark viewBox units: matched to the outline wordmark's cap
 * height (87 units, U top 15.5 → baseline 102.7) and its left edge (x 145.4).
 */
const DISPLAY = { x: 140, baseline: 102.7, size: 124, weight: 600, tracking: '-0.02em' } as const;
/** The display lockup's viewBox: narrower than the outline wordmark, so the lockup stays centred. */
const DISPLAY_VIEWBOX = { w: 572, h: WORDMARK_VIEWBOX.h } as const;

/** `trace` outline width, in mark units. */
const TRACE_STROKE = 0.9;

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
  /** Assembly speed divisor: 1 = as designed, 1.5 = every step takes 1.5× as long (`lettersDelay` included). */
  pace?: number;
  /** How the "U" body builds: `spring` (default) springs up from its base; `trace` draws its outline, then fades its fill in, no transform. */
  body?: 'spring' | 'trace';
  /** Wordmark letterforms: `svg` (default) the brand outlines; `display` live "Unikraft" text in Inter Display (InterVariable at `opsz` 32). */
  font?: 'svg' | 'display';
  /** How the letters arrive: `rise` (default) fade in while rising; `fade` opacity only, no transform. */
  letters?: 'rise' | 'fade';
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
  pace = 1,
  body: build = 'spring',
  font = 'svg',
  letters = 'rise',
  style,
}) => {
  const frame = useCurrentFrame();
  const id = useId().replace(/:/g, '');
  // A static logo is just an assembly that finished long ago.
  const t = at === undefined ? 1e6 : (frame - at) / pace;

  const vb = wordmark ? (font === 'display' ? DISPLAY_VIEWBOX : WORDMARK_VIEWBOX) : MARK_VIEWBOX;
  const width = (height * vb.w) / vb.h;
  const markScale = wordmark ? MARK_IN_WORDMARK_SCALE : 1;

  // spring: the U springs up from its base. trace: its outline draws on, then the fill fades in.
  const body = progress(t, 5, 18, EASE.back);
  const bodyFade = build === 'spring' ? progress(t, 5, 4, EASE.linear) : progress(t, 22, 12, EASE.out);
  const trim = progress(t, 5, 22, EASE.inOut);
  const letterIn = (i: number) =>
    letters === 'rise' ? progress(t, lettersDelay + i * 2, 16, EASE.out) : progress(t, lettersDelay + i * 3, 18, EASE.standard);
  const outline = build === 'trace' && at !== undefined ? 1 - progress(t, 30, 12, EASE.inOut) : 0;

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
            transform={
              build === 'spring'
                ? `translate(0 ${MARK_VIEWBOX.h}) scale(1 ${Math.max(0.001, body)}) translate(0 ${-MARK_VIEWBOX.h})`
                : undefined
            }
          />
          {outline > 0 && trim > 0 && (
            <path
              d={MARK_BODY.d}
              fill="none"
              stroke={`url(#${id}-body)`}
              strokeWidth={TRACE_STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - trim}
              opacity={outline}
            />
          )}
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
          font === 'svg' &&
          WORDMARK_LETTERS.map((letter, i) => {
            const p = letterIn(i);
            return (
              <path
                key={letter.x}
                d={letter.d}
                fill={letterColor}
                opacity={p}
                transform={letters === 'rise' ? `translate(0 ${lerp(38, 0, p)})` : undefined}
              />
            );
          })}
        {wordmark && font === 'display' && (
          <text
            x={DISPLAY.x}
            y={DISPLAY.baseline}
            fill={letterColor}
            // `rise` moves the whole word: tspans can't be translated one by one.
            transform={letters === 'rise' ? `translate(0 ${lerp(38, 0, letterIn(0))})` : undefined}
            style={{
              fontFamily: FONT.sans,
              fontSize: DISPLAY.size,
              fontWeight: DISPLAY.weight,
              fontVariationSettings: "'opsz' 32",
              letterSpacing: DISPLAY.tracking,
            }}
          >
            {WORDMARK_TEXT.split('').map((ch, i) => {
              const p = letterIn(i);
              return (
                // Opacity on a tspan is ignored by Chrome; fill-opacity is not.
                <tspan key={i} fillOpacity={p}>
                  {ch}
                </tspan>
              );
            })}
          </text>
        )}
      </svg>
    </div>
  );
};
