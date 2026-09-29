import { createContext, useContext } from 'react';
import { resolveAt, type At, type Scene, type Video } from '../timeline/define';
import { DUR, type DurName } from '../timeline/durations';

export type SceneApi<P> = {
  video: Video;
  scene: Scene;
  /** The scene's recipe props (typed by the caller: `useScene<StatementProps>()`). */
  props: P;
  /** Scene length in frames. */
  frames: number;
  /** Frames in `n` beats on the video's grid. */
  beats: (n: number) => number;
  /** Scene-local frame of a mark / `At` (`'land'`, `'land+0.5'`, `2`). Throws on unknown marks. */
  at: (at: At) => number;
  /** A motion duration in frames, scaled by the preset's `motion` factor. */
  dur: (d: DurName | number) => number;
};

export const SceneContext = createContext<{ video: Video; scene: Scene } | null>(null);

/** Timing and props for the scene being rendered. Use inside any scene component. */
export const useScene = <P = unknown,>(): SceneApi<P> => {
  const ctx = useContext(SceneContext);
  if (!ctx) {
    throw new Error('useScene() must be used inside a scene rendered by <VideoTimeline>');
  }
  const { video, scene } = ctx;
  const { beats } = video.grid;
  return {
    video,
    scene,
    props: scene.props as P,
    frames: beats(scene.beats),
    beats,
    at: (at) => beats(resolveAt(at, scene.marks, `${video.id}/${scene.id}`)),
    dur: (d) => Math.round((typeof d === 'number' ? d : DUR[d]) * video.preset.motion),
  };
};
