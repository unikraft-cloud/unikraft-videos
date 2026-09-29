import type React from 'react';
import { alpha, C } from './tokens';

/**
 * Rounded checkbox in the site's list-bullet style. `checked` 0..1 fills it
 * brand-blue and draws the tick; `denied` 0..1 turns the outline rose.
 */
export const Checkbox: React.FC<{ checked: number; denied?: number; size: number }> = ({ checked, denied = 0, size }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" style={{ overflow: 'visible', display: 'block' }}>
    <rect
      x={3}
      y={3}
      width={50}
      height={50}
      rx={10}
      fill={checked > 0 ? alpha(C.blue400, checked) : 'transparent'}
      stroke={denied > 0 ? alpha(C.rose, 0.4 + 0.6 * denied) : checked > 0.5 ? C.blue200 : C.slate600}
      strokeWidth={4}
    />
    {checked > 0 && (
      <path
        d="M15 29 L24.5 38 L41.5 19"
        fill="none"
        stroke={C.white}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - checked}
      />
    )}
  </svg>
);
