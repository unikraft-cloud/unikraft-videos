import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { C } from './tokens';

/** Dark-theme frame backgrounds from Container.astro (`.frame-variant-*`). */
const VARIANTS = {
  plain: `linear-gradient(180deg, ${C.slate950} 0%, ${C.black} 100%)`,
  tintA: `linear-gradient(180deg, ${C.black} 0%, ${C.slate950} 100%)`,
  tintB: `linear-gradient(180deg, ${C.navyDeep} 0%, ${C.black} 60%, ${C.slate950} 100%)`,
  tintC: `radial-gradient(120% 60% at 50% 0%, ${C.navy} 0%, ${C.black} 55%, ${C.slate950} 100%)`,
  black: C.black,
} as const;

export type BackdropVariant = keyof typeof VARIANTS;

type Props = {
  variant?: BackdropVariant;
  /** Strength of the site's `radial-aura-surface` blue glow (0 = off, 1 = site value, >1 = hotter). */
  aura?: number;
  /** Aura centre, in % of the frame. */
  auraX?: number;
  auraY?: number;
  /** Opacity of a faint engineering grid (0 = off). */
  grid?: number;
  gridSize?: number;
  /** Grid offset in px — animate for parallax drift. */
  gridOffset?: { x: number; y: number };
  /** Edge darkening (0 = off). */
  vignette?: number;
  children?: React.ReactNode;
};

export const Backdrop: React.FC<Props> = ({
  variant = 'tintC',
  aura = 1,
  auraX = 50,
  auraY = 52,
  grid = 0,
  gridSize = 64,
  gridOffset = { x: 0, y: 0 },
  vignette = 0.5,
  children,
}) => {
  return (
    <AbsoluteFill style={{ background: VARIANTS[variant], overflow: 'hidden' }}>
      {aura > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(70.6% 51.49% at ${auraX}% ${auraY}%, rgba(0, 98, 183, ${0.16 * aura}) 7.24%, rgba(0, 98, 183, 0) 90.71%)`,
          }}
        />
      )}
      {grid > 0 && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(to right, rgba(148, 163, 184, ${grid}) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, ${grid}) 1px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${gridOffset.x}px ${gridOffset.y}px`,
            maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, black 20%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, black 20%, transparent 100%)',
          }}
        />
      )}
      {children}
      {vignette > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 80% 75% at 50% 50%, transparent 55%, rgba(0, 0, 0, ${vignette}) 100%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
