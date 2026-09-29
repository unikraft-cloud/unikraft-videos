import type React from 'react';
import { useCurrentFrame } from 'remotion';
import { Icon } from './Icon';
import { EASE, progress } from './motion';
import { checker } from './patterns';
import { alpha, C, FONT } from './tokens';

type Props = {
  label: string;
  /** Text size in px; everything else scales with it (site: 16px). */
  size?: number;
  /** Frame the checker shine starts sweeping. Repeats every `shinePeriod` frames. */
  shineAt?: number;
  shinePeriod?: number;
  /** 0..1 — grows the outer checker glow (the site's hover state). */
  hover?: number;
  variant?: 'primary' | 'secondary';
  arrow?: boolean;
  style?: React.CSSProperties;
};

/**
 * Site CTA (`.cta-btn-primary` + `.cta-btn-primary-glow`): blue-300 fill,
 * blue-200 border, white semibold label, an animated checkerboard shine
 * sweeping across, and a blue checker glow that bleeds out on hover.
 */
export const CtaButton: React.FC<Props> = ({
  label,
  size = 32,
  shineAt = 0,
  shinePeriod = 90,
  hover = 0,
  variant = 'primary',
  arrow = variant === 'primary',
  style,
}) => {
  const frame = useCurrentFrame();
  const s = size / 16;
  const local = frame - shineAt;
  const cycle = local < 0 ? -1 : local % shinePeriod;
  // Keyframes from cta-btn-shine: mask 200% → -100% over the first 60% of the cycle.
  const sweep = cycle < 0 ? 0 : progress(cycle, 0, shinePeriod * 0.6, EASE.balanced);
  const maskPos = 200 - 300 * sweep;
  const glowRadius = 35 + 20 * hover;
  const primary = variant === 'primary';

  return (
    <div style={{ position: 'relative', display: 'inline-flex', isolation: 'isolate', ...style }}>
      {primary && (
        <div
          style={{
            position: 'absolute',
            inset: `${-12 * s}px ${-16 * s}px ${-16 * s}px ${-16 * s}px`,
            zIndex: 0,
            ...checker(alpha(C.blue400, 0.5), 5 * s),
            maskImage: `radial-gradient(ellipse ${glowRadius}% ${glowRadius}% at center, rgba(0,0,0,0.9) 0%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse ${glowRadius}% ${glowRadius}% at center, rgba(0,0,0,0.9) 0%, transparent 100%)`,
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8 * s,
          padding: `${12 * s}px ${24 * s}px`,
          borderRadius: 6 * s,
          overflow: 'hidden',
          fontFamily: FONT.sans,
          fontWeight: 600,
          fontSize: size,
          letterSpacing: '-0.01em',
          color: primary ? C.white : C.slate300,
          background: primary ? C.blue300 : 'transparent',
          border: `${Math.max(1, s)}px solid ${primary ? C.blue200 : alpha(C.slate300, 0.22)}`,
          boxShadow: primary ? `0 ${8 * s}px ${24 * s}px ${-8 * s}px rgba(59,130,246,${0.6 + 0.1 * hover})` : undefined,
          whiteSpace: 'nowrap',
        }}
      >
        {primary && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              ...checker(alpha(C.white, 0.55), 5 * s),
              maskImage:
                'linear-gradient(115deg, transparent 0%, transparent 35%, rgba(0,0,0,0.85) 50%, transparent 65%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(115deg, transparent 0%, transparent 35%, rgba(0,0,0,0.85) 50%, transparent 65%, transparent 100%)',
              maskSize: '250% 250%',
              WebkitMaskSize: '250% 250%',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: `${maskPos}% 0`,
              WebkitMaskPosition: `${maskPos}% 0`,
              opacity: 0.9,
            }}
          />
        )}
        <span style={{ position: 'relative' }}>{label}</span>
        {arrow && (
          <Icon
            name="solar:arrow-right-linear"
            size={24 * s}
            color={C.white}
            style={{ position: 'relative', transform: `translateX(${3 * s * hover}px)` }}
          />
        )}
      </div>
    </div>
  );
};
