import type React from 'react';
import { ICONS, type IconName } from './icons-data';

/** Iconify icon from the extracted set (`npm run icons` to add more). Inherits `color`. */
export const Icon: React.FC<{ name: IconName; size: number; color?: string; style?: React.CSSProperties }> = ({
  name,
  size,
  color,
  style,
}) => {
  const icon = ICONS[name];
  return (
    <svg
      viewBox={`0 0 ${icon.w} ${icon.h}`}
      width={size}
      height={size}
      style={{ color, display: 'block', flexShrink: 0, ...style }}
      // Iconify bodies are static, trusted SVG markup extracted at build time.
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
};
