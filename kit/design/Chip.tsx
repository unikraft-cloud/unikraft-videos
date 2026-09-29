import type React from 'react';
import { Icon } from './Icon';
import type { IconName } from './icons-data';
import { alpha, C, FONT } from './tokens';

const TONES = {
  blue: { line: C.blue400, text: C.blue100 },
  green: { line: C.green, text: C.green },
  orange: { line: C.orange, text: C.orange },
  red: { line: C.rose, text: C.red },
  slate: { line: C.slate500, text: C.slate300 },
} as const;

export type ChipTone = keyof typeof TONES;

/**
 * Outlined pill from the site's deployment / Kraftlet diagrams
 * (`Instances` / `Services` / `Volumes`, `RUNS ON` badges).
 */
export const Chip: React.FC<{
  label: string;
  icon?: IconName;
  tone?: ChipTone;
  size?: number;
  mono?: boolean;
  /** 0..1 extra glow (e.g. on landing). */
  glow?: number;
  style?: React.CSSProperties;
}> = ({ label, icon, tone = 'blue', size = 28, mono = false, glow = 0, style }) => {
  const t = TONES[tone];
  const s = size / 14;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8 * s,
        padding: `${6 * s}px ${12 * s}px`,
        borderRadius: 6 * s,
        border: `${Math.max(1, s * 0.75)}px solid ${alpha(t.line, 0.55)}`,
        background: alpha(t.line, 0.1),
        color: t.text,
        fontFamily: mono ? FONT.mono : FONT.sans,
        fontWeight: 500,
        fontSize: size,
        letterSpacing: mono ? '0.06em' : '-0.01em',
        textTransform: mono ? 'uppercase' : 'none',
        whiteSpace: 'nowrap',
        boxShadow: glow > 0 ? `0 0 ${30 * s * glow}px ${alpha(t.line, 0.45 * glow)}` : undefined,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size * 1.1} color={t.text} />}
      {label}
    </div>
  );
};
