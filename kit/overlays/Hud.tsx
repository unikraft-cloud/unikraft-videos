import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, lerp, progress } from '../design/motion';
import { Scramble } from '../design/Text';
import { alpha, C, FONT, SAFE } from '../design/tokens';
import type { Video } from '../timeline/define';
import { FPS } from '../timeline/grid';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Persistent frame chrome, straight from the site's Container.astro: a hairline
 * top border, `[NN.00] LABEL` eyebrow on the left, `SECTION NN / TT` on the
 * right. It survives the hard cuts, re-decodes on chapter changes and sends a
 * light pulse along the rule. Hidden for scenes with `chapter: null`.
 */
export const Hud: React.FC<{ video: Video }> = ({ video }) => {
  const frame = useCurrentFrame();
  const { scenes, chapters } = video;
  const { framesPerBeat } = video.grid;
  const beat = frame / framesPerBeat;
  const idx = Math.max(
    0,
    scenes.findIndex((s) => beat >= s.start && beat < s.start + s.beats),
  );
  const scene = scenes[idx];
  if (scene.chapter === null) {
    return null;
  }

  // First scene of this chapter run → when the eyebrow last changed.
  let first = idx;
  while (first > 0 && scenes[first - 1].chapter === scene.chapter) {
    first--;
  }
  const chapterStart = scenes[first].start * framesPerBeat;
  const since = frame - chapterStart;
  const sceneStart = scene.start * framesPerBeat;
  const sceneEnd = (scene.start + scene.beats) * framesPerBeat;
  const prevHidden = idx === 0 || scenes[idx - 1].chapter === null;
  const nextHidden = idx === scenes.length - 1 || scenes[idx + 1].chapter === null;
  const fadeIn = prevHidden ? progress(frame, sceneStart, 8, EASE.standard) : 1;
  const fadeOut = nextHidden ? 1 - progress(frame, sceneEnd - 6, 6, EASE.standard) : 1;
  const opacity = Math.min(fadeIn, fadeOut);

  const chapter = { index: scene.chapter, label: chapters[scene.chapter - 1] };
  const ruleDraw = idx === 0 ? progress(frame, 0, 26, EASE.inOut) : 1;
  const pulse = progress(since, 0, 26, EASE.inOut);
  const pulseX = lerp(-15, 115, pulse);
  const seconds = frame / FPS;

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
      {/* Top rule + chapter pulse */}
      <div
        style={{
          position: 'absolute',
          top: SAFE.top,
          left: 0,
          width: `${ruleDraw * 100}%`,
          height: 1,
          background: alpha(C.slate700, 0.8),
        }}
      />
      {pulse > 0 && pulse < 1 && (
        <div
          style={{
            position: 'absolute',
            top: SAFE.top - 1,
            left: 0,
            right: 0,
            height: 3,
            background: `radial-gradient(12% 100% at ${pulseX}% 50%, ${alpha(C.blue100, 0.95)} 0%, ${alpha(C.blue400, 0.5)} 35%, transparent 100%)`,
            filter: 'blur(0.5px)',
          }}
        />
      )}

      {/* Eyebrow row */}
      <div
        style={{
          position: 'absolute',
          top: SAFE.top + 30,
          left: SAFE.x,
          right: SAFE.x,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: FONT.mono,
          fontSize: 22,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ color: C.blue100, display: 'flex', gap: 14 }}>
          <span style={{ fontWeight: 500 }}>
            <Scramble text={`[${pad(chapter.index)}.00]`} at={chapterStart} duration={10} />
          </span>
          <Scramble text={chapter.label} at={chapterStart + 3} duration={14} />
        </span>
        <span style={{ color: C.slate600 }}>
          <Scramble text={`Section ${pad(chapter.index)} / ${pad(chapters.length)}`} at={chapterStart} duration={16} />
        </span>
      </div>

      {/* Bottom rail: brand + running clock, in the footer's mono voice */}
      <div
        style={{
          position: 'absolute',
          bottom: SAFE.bottom - 24,
          left: SAFE.x,
          right: SAFE.x,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: FONT.mono,
          fontSize: 17,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.slate600,
        }}
      >
        <span>unikraft.com</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', textTransform: 'none' }}>
          t+{seconds.toFixed(3)}s
        </span>
      </div>
    </AbsoluteFill>
  );
};
