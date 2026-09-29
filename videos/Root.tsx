import '../kit/design/fonts';
import type React from 'react';
import { VideoCompositions } from '../kit/video/Compositions';
import { VIDEOS } from './registry';

export const Root: React.FC = () => (
  <>
    {VIDEOS.map((entry) => (
      <VideoCompositions key={entry.video.id} entry={entry} />
    ))}
  </>
);
