import type React from 'react';
import { AbsoluteFill, Freeze } from 'remotion';
import { alpha, C, FONT } from '../design/tokens';
import { FPS, HEIGHT, WIDTH } from '../timeline/grid';
import { reviewFrames } from '../timeline/review';
import { VideoTimeline, type VideoEntry } from './Video';

export const SHEET = { columns: 4, thumbW: WIDTH / 4, thumbH: HEIGHT / 4, label: 58, header: 96 } as const;

export const sheetHeight = (entry: VideoEntry): number => {
  const rows = Math.ceil(reviewFrames(entry.video).length / SHEET.columns);
  return SHEET.header + rows * (SHEET.thumbH + SHEET.label);
};

/**
 * Every review frame of the video, frozen and tiled 4-up with scene, time and
 * the copy that should be readable there. Rendered as one still by `npm run review`.
 */
export const ContactSheet: React.FC<{ entry: VideoEntry }> = ({ entry }) => {
  const frames = reviewFrames(entry.video);
  const { video } = entry;
  return (
    <AbsoluteFill style={{ background: C.slate950, fontFamily: FONT.mono, color: C.slate400 }}>
      <div
        style={{
          height: SHEET.header,
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 30,
          color: C.blue100,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <span>
          {video.id} · {video.preset.name} · {video.grid.bpm} bpm
        </span>
        <span style={{ color: C.slate500 }}>
          {(video.durationInFrames / FPS).toFixed(1)} s · {video.scenes.length} scenes
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {frames.map((f) => (
          <div key={f.frame} style={{ width: SHEET.thumbW, height: SHEET.thumbH + SHEET.label }}>
            <div
              style={{
                width: SHEET.thumbW,
                height: SHEET.thumbH,
                overflow: 'hidden',
                position: 'relative',
                outline: `1px solid ${alpha(C.slate700, 0.8)}`,
              }}
            >
              <div style={{ width: WIDTH, height: HEIGHT, transform: 'scale(0.25)', transformOrigin: '0 0' }}>
                <Freeze frame={f.frame}>
                  <VideoTimeline entry={entry} soundtrack={false} hud />
                </Freeze>
              </div>
            </div>
            <div
              style={{
                padding: '6px 10px',
                fontSize: 15,
                lineHeight: 1.35,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <div style={{ color: C.blue100 }}>
                {String(f.index + 1).padStart(2, '0')} {f.scene} · f{f.frame} · {(f.frame / FPS).toFixed(2)} s
              </div>
              <div>{f.label.length > 52 ? `${f.label.slice(0, 51)}…` : f.label}</div>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
