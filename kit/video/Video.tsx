import { Audio } from '@remotion/media';
import type React from 'react';
import { AbsoluteFill, getStaticFiles, Sequence, staticFile } from 'remotion';
import { Grain } from '../design/Grain';
import { Hud } from '../overlays/Hud';
import { RECIPES } from '../recipes';
import type { Video } from '../timeline/define';
import { SceneContext } from './SceneContext';
import { Slate } from './Slate';

/** What a video folder exports from its `index.ts`. */
export type VideoEntry = {
  video: Video;
  /** Custom scene components by scene id. Scenes with a `recipe` don't need one. */
  scenes?: Readonly<Record<string, React.FC>>;
  /** Full-frame layer above the scenes and HUD (cross-cut transitions). Master timeline frames. */
  Overlay?: React.FC;
};

export type VideoProps = {
  /** Mix in public/audio/<id>.wav (generate with `npm run soundtrack -- <id>`). */
  soundtrack: boolean;
  /** Persistent `[NN.00] LABEL` frame chrome. */
  hud: boolean;
  /** Draft slate label (`npm run draft` sets `v<N>`): adds a timecode bar under the frame. `null` = off. */
  slate: string | null;
};

export const DEFAULT_VIDEO_PROPS: VideoProps = { soundtrack: true, hud: true, slate: null };

const sceneComponent = (entry: VideoEntry, id: string, recipe: string | null): React.FC => {
  const component = entry.scenes?.[id] ?? (recipe ? RECIPES[recipe] : undefined);
  if (!component) {
    throw new Error(
      `${entry.video.id}/${id}: no component — add it to \`scenes\` in videos/${entry.video.id}/index.ts` +
        (recipe ? ` or register recipe "${recipe}" in kit/recipes/index.ts` : ''),
    );
  }
  return component;
};

/** The full video: scenes laid end to end on the beat grid, chrome and finishing on top. */
export const VideoTimeline: React.FC<Omit<VideoProps, 'slate'> & { entry: VideoEntry }> = ({
  entry,
  soundtrack,
  hud,
}) => {
  const { video, Overlay } = entry;
  const audio = `audio/${video.id}.wav`;
  const hasAudio = getStaticFiles().some((f) => f.name === audio);
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {video.scenes.map((scene) => {
        const Scene = sceneComponent(entry, scene.id, scene.recipe);
        return (
          <Sequence
            key={scene.id}
            name={scene.id}
            from={video.beats(scene.start)}
            durationInFrames={video.beats(scene.beats)}
          >
            <SceneContext.Provider value={{ video, scene }}>
              <Scene />
            </SceneContext.Provider>
          </Sequence>
        );
      })}
      {hud && <Hud video={video} />}
      {Overlay && <Overlay />}
      <Grain />
      {soundtrack && hasAudio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};

/** The full video, with the draft slate under the frame when `slate` is set (the composition grows to fit it). */
export const VideoFrame: React.FC<VideoProps & { entry: VideoEntry }> = ({ slate, entry, ...props }) =>
  slate === null ? (
    <VideoTimeline entry={entry} {...props} />
  ) : (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <div
        style={{ position: 'relative', width: entry.video.canvas.width, height: entry.video.canvas.height }}
      >
        <VideoTimeline entry={entry} {...props} />
      </div>
      <Slate video={entry.video} label={slate} />
    </AbsoluteFill>
  );

/** One scene's window into the master timeline (HUD, overlays, audio and slate included). */
export const SceneWindow: React.FC<VideoProps & { entry: VideoEntry; scene: string }> = ({
  scene,
  entry,
  ...props
}) => (
  <Sequence from={-entry.video.beats(entry.video.scene(scene).start)}>
    <VideoFrame entry={entry} {...props} />
  </Sequence>
);
