import { evolvePath, getLength, getPointAtLength } from '@remotion/paths';
import type React from 'react';
import { C } from './tokens';

/**
 * The site's diagram connector (AdvancedFeatures/diagrams/primitives.tsx
 * `manhattanPath`): horizontal → rounded bend → vertical → rounded bend →
 * horizontal, turning at the x midpoint.
 */
export const manhattanPath = (x1: number, y1: number, x2: number, y2: number, r = 12): string => {
  const midX = (x1 + x2) / 2;
  const dy = y2 - y1;
  if (Math.abs(dy) < 1) {
    return `M${x1},${y1} L${x2},${y2}`;
  }
  const dir = dy > 0 ? 1 : -1;
  const hDir = x2 >= x1 ? 1 : -1;
  const cr = Math.min(r, Math.abs(dy) / 2, Math.abs(midX - x1));
  return [
    `M${x1},${y1}`,
    `L${midX - hDir * cr},${y1}`,
    `Q${midX},${y1} ${midX},${y1 + dir * cr}`,
    `L${midX},${y2 - dir * cr}`,
    `Q${midX},${y2} ${midX + hDir * cr},${y2}`,
    `L${x2},${y2}`,
  ].join(' ');
};

/**
 * An SVG path that draws itself as `progress` goes 0 → 1 (use inside an <svg>).
 * `glow` adds a soft blue under-stroke.
 */
export const Wire: React.FC<{
  d: string;
  progress: number;
  color?: string;
  width?: number;
  glow?: number;
  dashed?: boolean;
  opacity?: number;
}> = ({ d, progress, color = C.blue400, width = 2, glow = 0, dashed = false, opacity = 1 }) => {
  if (progress <= 0) {
    return null;
  }
  const evolved = evolvePath(Math.min(1, progress), d);
  const dash = dashed
    ? { strokeDasharray: `${width * 3} ${width * 2.5}`, opacity: opacity * Math.min(1, progress * 3) }
    : { strokeDasharray: evolved.strokeDasharray, strokeDashoffset: evolved.strokeDashoffset, opacity };
  return (
    <g>
      {glow > 0 && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width * 5}
          strokeLinecap="round"
          opacity={0.18 * glow}
          style={{ filter: `blur(${width * 3}px)` }}
          strokeDasharray={dashed ? undefined : evolved.strokeDasharray}
          strokeDashoffset={dashed ? undefined : evolved.strokeDashoffset}
        />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" {...dash} />
    </g>
  );
};

/** Point at `t` ∈ [0, 1] along `d` — for pulses/comets travelling on a wire. */
export const pointOnPath = (d: string, t: number): { x: number; y: number } => {
  const point = getPointAtLength(d, Math.max(0, Math.min(1, t)) * getLength(d));
  if (!point) {
    throw new Error(`pointOnPath: path has no length: ${d}`);
  }
  return point;
};
