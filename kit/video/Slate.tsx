import type React from 'react';
import { useCurrentFrame } from 'remotion';
import { alpha, C, FONT } from '../design/tokens';
import type { Video } from '../timeline/define';
import { FPS } from '../timeline/grid';

/** Height of the draft slate bar, px, added under the frame (`VideoProps.slate`). Even, so scaled renders stay even. */
export const SLATE_HEIGHT = 72;

/** `mm:ss.cc` for a master-timeline frame. */
const timecode = (frame: number): string => {
  const cs = Math.floor((frame / FPS) * 100);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(cs / 6000))}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
};

/**
 * Draft slate: a bar under the frame naming the exact moment on screen (draft
 * label, timecode, frame, scene, beat in scene) so feedback can point at it.
 * Reads the master-timeline frame, so scene windows show master time too.
 */
export const Slate: React.FC<{ video: Video; label: string }> = ({ video, label }) => {
  const frame = useCurrentFrame();
  const beat = frame / video.grid.framesPerBeat;
  const scene = video.scenes.find((s) => beat < s.start + s.beats) ?? video.scenes[video.scenes.length - 1];
  const cell = (text: string, color: string = C.slate400): React.ReactNode => (
    <span style={{ color, whiteSpace: 'nowrap' }}>{text}</span>
  );
  return (
    <div
      style={{
        height: SLATE_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 36,
        padding: '0 28px',
        overflow: 'hidden',
        background: C.slate950,
        borderTop: `2px solid ${alpha(C.blue400, 0.7)}`,
        fontFamily: FONT.mono,
        fontSize: 30,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {cell(label, C.blue100)}
      {cell(`${timecode(frame)} / ${timecode(video.durationInFrames)}`, C.white)}
      {cell(`f${frame}`)}
      {cell(
        `${String(scene.index + 1).padStart(2, '0')}/${String(video.scenes.length).padStart(2, '0')} ${scene.id}`,
        C.white,
      )}
      {cell(`beat ${(beat - scene.start).toFixed(2)}/${scene.beats}`)}
    </div>
  );
};
