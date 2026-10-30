import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Logo } from '../../../kit/design/Logo';
import { EASE, lerp, progress, scramble } from '../../../kit/design/motion';
import { AccentText, Move } from '../../../kit/design/Text';
import { C, FONT, TYPE } from '../../../kit/design/tokens';
import { useScene } from '../../../kit/video/SceneContext';

/**
 * Release end screen on a 1440×1440 canvas. Last frame of the release video, so it holds still
 * to the end (no exit fade). Motion runs ~1.7× the kit's default durations: a calm card, not a cut.
 *
 *   0      backdrop fades up from black (the lead-in buffer)
 *   logo   Unikraft lockup assembles: stripes slide in, the U outline draws on and its fill fades in, letters rise
 *   title  "Release 14 — Harpalyke" rises in, the codename in brand blue
 *   url    "check out more at" fades in, the URL decodes under it, host white, path blue
 */

export type EndProps = { title: string; lead: string; host: string; path: string };

const LOGO_H = 160;
const TITLE_SIZE = 100;
const LEAD_SIZE = 36;
const URL_SIZE = 46;
/** Logo assembly slow-down (Logo `pace`). */
const LOGO_PACE = 1.7;

export const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { at, dur, frames, props } = useScene<EndProps>();
  const url = `${props.host}${props.path}`;

  const fadeUp = progress(frame, 0, at('logo'), EASE.inOut);
  const aura = progress(frame, at('logo'), dur(50), EASE.out);
  const push = lerp(1.03, 1, progress(frame, at('logo'), frames - at('logo'), EASE.out));
  const decoded = scramble(url, progress(frame, at('url') + dur(8), dur(40), EASE.linear), frame, 'r14-url');

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: fadeUp }}>
        <Backdrop variant="tintC" aura={1.4 * aura} auraY={42} vignette={0.6} />
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
          at={at('logo')}
          wordmark
          lettersDelay={10}
          glow={1}
          pace={LOGO_PACE}
          body="trace"
        />
        <Move
          at={at('title')}
          duration={dur(22)}
          from={{ opacity: 0, y: 36, blur: 12 }}
          style={{ ...TYPE.title, fontSize: TITLE_SIZE, color: C.white, marginTop: 96 }}
        >
          <AccentText text={props.title} />
        </Move>
        <div
          style={{
            marginTop: 64,
            fontFamily: FONT.mono,
            fontWeight: 500,
            whiteSpace: 'pre',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span
            style={{
              fontSize: LEAD_SIZE,
              color: C.slate400,
              opacity: progress(frame, at('url'), dur(22), EASE.standard),
            }}
          >
            {props.lead}
          </span>
          <span style={{ position: 'relative', fontSize: URL_SIZE }}>
            {/* Full-width ghost keeps the line centred while the decode grows. */}
            <span style={{ visibility: 'hidden' }}>{url}</span>
            <span style={{ position: 'absolute', left: 0, top: 0 }}>
              <span style={{ color: C.white }}>{decoded.slice(0, props.host.length)}</span>
              <span style={{ color: C.blue100 }}>{decoded.slice(props.host.length)}</span>
            </span>
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
