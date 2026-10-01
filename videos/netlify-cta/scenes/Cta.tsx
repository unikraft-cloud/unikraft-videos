import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { EASE, lerp, progress, scramble } from '../../../kit/design/motion';
import { SplitText } from '../../../kit/design/Text';
import { alpha, C, FONT, TYPE } from '../../../kit/design/tokens';
import { useScene } from '../../../kit/video/SceneContext';

/**
 * Blog CTA before the collab outro, on the outro's two-tone gradient.
 *
 *   lead   "Check it out in detail here:" rises in word by word   (low whoosh)
 *   url    the URL decodes left → right, host white, path blue    (soft keys)
 *   rule   a gradient hairline draws under the URL
 *   exit   fades to black, so the outro can fade up from black
 */

export type CtaProps = { lead: string; host: string; path: string };

const NETLIFY_TEAL = '#32e6e2';
const URL_SIZE = 50;

export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { at, dur, frames, props } = useScene<CtaProps>();
  const url = `${props.host}${props.path}`;

  const glow = progress(frame, 0, dur(40), EASE.out);
  const drift = progress(frame, 0, frames, EASE.linear);
  const decoded = scramble(url, progress(frame, at('url'), dur(30), EASE.linear), frame, 'cta-url');
  const rule = progress(frame, at('rule'), dur('draw'), EASE.inOut);
  const exit = progress(frame, at('exit'), dur('exit'), EASE.in);
  const push = lerp(1, 1.03, progress(frame, 0, frames, EASE.inOut));

  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: 1 - exit }}>
      <Backdrop variant="black" aura={0} vignette={0.7}>
        <AbsoluteFill
          style={{
            opacity: glow,
            background: [
              `radial-gradient(55% 70% at ${lerp(26, 32, drift)}% ${lerp(58, 50, drift)}%, ${alpha(NETLIFY_TEAL, 0.13)} 0%, transparent 70%)`,
              `radial-gradient(55% 70% at ${lerp(76, 69, drift)}% ${lerp(44, 52, drift)}%, ${alpha(C.blue400, 0.2)} 0%, transparent 70%)`,
            ].join(', '),
          }}
        />
      </Backdrop>
      <AbsoluteFill
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 44,
          transform: `scale(${push})`,
          filter: exit > 0.02 ? `blur(${exit * 10}px)` : undefined,
        }}
      >
        <SplitText
          text={props.lead}
          by="word"
          at={at('lead')}
          stagger={dur(3)}
          duration={dur('enter')}
          from={{ opacity: 0, y: 28, blur: 10 }}
          style={{ ...TYPE.title, fontSize: 64, color: C.slate300 }}
        />
        <div style={{ position: 'relative', fontFamily: FONT.mono, fontSize: URL_SIZE, fontWeight: 500 }}>
          {/* Full-width ghost keeps the line centred while the decode grows. */}
          <span style={{ visibility: 'hidden', whiteSpace: 'pre' }}>{url}</span>
          <span style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'pre' }}>
            <span style={{ color: C.white }}>{decoded.slice(0, props.host.length)}</span>
            <span style={{ color: C.blue100 }}>{decoded.slice(props.host.length)}</span>
          </span>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -18,
              height: 2,
              background: `linear-gradient(90deg, ${NETLIFY_TEAL}, ${C.blue400})`,
              transform: `scaleX(${rule})`,
              transformOrigin: '0% 50%',
              opacity: 0.8,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
