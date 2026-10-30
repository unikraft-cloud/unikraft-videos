import type React from 'react';
import { Composition, Folder } from 'remotion';
import { FPS, WIDTH } from '../timeline/grid';
import { ContactSheet, sheetHeight } from './ContactSheet';
import { DEFAULT_VIDEO_PROPS, SceneWindow, VideoTimeline, type VideoEntry, type VideoProps } from './Video';

type Bound = {
  Full: React.FC<VideoProps>;
  Window: React.FC<VideoProps & { scene: string }>;
  Sheet: React.FC;
};

// Composition props are serialised to JSON, so the entry (components, functions)
// is bound into stable per-entry components instead of being passed as a prop.
const bound = new WeakMap<VideoEntry, Bound>();
const bind = (entry: VideoEntry): Bound => {
  let b = bound.get(entry);
  if (!b) {
    b = {
      Full: (props) => <VideoTimeline entry={entry} {...props} />,
      Window: (props) => <SceneWindow entry={entry} {...props} />,
      Sheet: () => <ContactSheet entry={entry} />,
    };
    bound.set(entry, b);
  }
  return b;
};

/**
 * Studio/render registrations for one video: the full cut (`<id>`), one window
 * per scene (`<id>-NN-<scene>`) for focused previews and stills, and the review
 * contact sheet (`<id>-sheet`, one frame) — the last two under `<id>-scenes`.
 */
export const VideoCompositions: React.FC<{ entry: VideoEntry }> = ({ entry }) => {
  const { video } = entry;
  const { Full, Window, Sheet } = bind(entry);
  return (
    <>
      <Composition
        id={video.id}
        component={Full}
        durationInFrames={video.durationInFrames}
        fps={FPS}
        width={video.canvas.width}
        height={video.canvas.height}
        defaultProps={DEFAULT_VIDEO_PROPS}
      />
      <Folder name={`${video.id}-scenes`}>
        {video.scenes.map((scene) => (
          <Composition
            key={scene.id}
            id={`${video.id}-${String(scene.index + 1).padStart(2, '0')}-${scene.id}`}
            component={Window}
            durationInFrames={video.beats(scene.beats)}
            fps={FPS}
            width={video.canvas.width}
            height={video.canvas.height}
            defaultProps={{ ...DEFAULT_VIDEO_PROPS, scene: scene.id }}
          />
        ))}
        <Composition
          id={`${video.id}-sheet`}
          component={Sheet}
          // Full length: Sequences clamp to the composition, so frozen thumbnails need the whole timeline.
          durationInFrames={video.durationInFrames}
          fps={FPS}
          width={WIDTH}
          height={sheetHeight(entry)}
        />
      </Folder>
    </>
  );
};
