import type { CSSProperties } from 'react';

/**
 * The site's CTA checkerboard (styles/cta-buttons.css `.cta-btn-primary::before`),
 * parametrised by colour and tile size. The site uses a 5px tile; 8–12px reads
 * better at 1080p.
 */
export const checker = (color: string, size = 8): CSSProperties => ({
  backgroundImage: [
    `linear-gradient(45deg, ${color} 26%, transparent 26%)`,
    `linear-gradient(135deg, ${color} 26%, transparent 26%)`,
    `linear-gradient(45deg, transparent 75%, ${color} 75%)`,
    `linear-gradient(135deg, transparent 75%, ${color} 75%)`,
  ].join(', '),
  backgroundSize: `${size}px ${size}px`,
  backgroundPosition: `0 0, ${size / 2}px 0, ${size / 2}px ${-size / 2}px, 0 ${size / 2}px`,
});

/**
 * TCB-diagram hatch (Security/TcbDiagram.css, dark theme): 135° stripes over a
 * tint. Pair with `hatchBorder` for the matching outline colour.
 */
export const hatch = (
  color: string,
  { line = 42, tint = 14, stripe = 3, gap = 7 }: { line?: number; tint?: number; stripe?: number; gap?: number } = {},
): CSSProperties => ({
  backgroundColor: `color-mix(in srgb, ${color} ${tint}%, transparent)`,
  backgroundImage: `repeating-linear-gradient(135deg, color-mix(in srgb, ${color} ${line}%, transparent) 0 ${stripe}px, transparent ${stripe}px ${stripe + gap}px)`,
});

export const hatchBorder = (color: string, strength = 45): string =>
  `color-mix(in srgb, ${color} ${strength}%, transparent)`;
