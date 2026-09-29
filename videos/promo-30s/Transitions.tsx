import type React from 'react';
import { useCurrentFrame } from 'remotion';
import { StripeWipe } from '../../kit/overlays/StripeWipe';
import { beats } from './timeline';

/** Cut-point effects that span two scenes: the stripe wipe from the logo sting into FAST. */
export const Transitions: React.FC = () => {
  const frame = useCurrentFrame();
  return <StripeWipe frame={frame} at={beats(12)} />;
};
