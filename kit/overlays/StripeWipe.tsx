import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { EASE, lerp, progress } from '../design/motion';
import { C, mix } from '../design/tokens';

const STRIPES = 11;
const STRIPE_STAGGER = 1.2;
const COVER = 13;
const UNCOVER = 13;

/**
 * Brand cut transition. The logo's 11 stripes, blown up to full-frame bands that shoot in from the
 * right (top band first), hold on the cut at frame `at`, then exit left. Fully
 * covers the frame on the cut, so the hard cut underneath is never seen. About
 * 13 frames either side of `at`.
 */
export const StripeWipe: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const h = 1080 / STRIPES;
  const bands = [];
  for (let i = 0; i < STRIPES; i++) {
    const coverEnd = at - (STRIPES - 1 - i) * STRIPE_STAGGER;
    const uncoverStart = at + i * STRIPE_STAGGER;
    if (frame < coverEnd - COVER || frame > uncoverStart + UNCOVER) {
      continue;
    }
    const inP = progress(frame, coverEnd - COVER, COVER, EASE.inOut);
    const outP = progress(frame, uncoverStart, UNCOVER, EASE.inOut);
    const left = lerp(1920 + h, 0, inP);
    const right = lerp(1920 + h, -h, outP);
    const color = mix(C.logoCyan, C.logoBlue, i / (STRIPES - 1));
    bands.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          top: i * h + 2,
          height: h - 4,
          left: Math.min(left, right) - h / 2,
          width: Math.max(0, right - left) + h,
          borderRadius: (h - 4) / 2,
          background: `linear-gradient(90deg, ${color} 0%, ${mix(color, C.white, 0.25)} 100%)`,
        }}
      />,
    );
  }
  return <AbsoluteFill style={{ pointerEvents: 'none' }}>{bands}</AbsoluteFill>;
};
