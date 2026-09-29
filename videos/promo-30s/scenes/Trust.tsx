import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Icon } from '../../../kit/design/Icon';
import type { IconName } from '../../../kit/design/icons-data';
import { clamp, EASE, lerp, pop, progress, shake } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { checker } from '../../../kit/design/patterns';
import { Mono, Move } from '../../../kit/design/Text';
import { alpha, C, FONT, mix, TYPE } from '../../../kit/design/tokens';

/*
 * Chapter 3 "SAFE" — Trust (beats 33–36, 90 frames).
 *  f0 / f15 / f30  hit     three compliance badges slam in.
 *  f30–f75                 hold: slow push, float, shine sweeps.
 *  f75             whoosh  zoom-through exit into the next chapter.
 */

const LANDINGS = [0, beats(0.5), beats(1)];
const WHOOSH = beats(2.5);

const BADGE_W = 500;
const BADGE_H = 336;
const BADGE_GAP = 40;
const ROW_X = (1920 - (3 * BADGE_W + 2 * BADGE_GAP)) / 2;
const ROW_Y = 392;

const BADGES: { icon: IconName; eyebrow: string; title: string; caption: string }[] = [
  { icon: 'solar:verified-check-bold', eyebrow: '01 · Audit', title: 'SOC 2 Type II', caption: 'certified' },
  { icon: 'solar:shield-check-bold', eyebrow: '02 · Privacy', title: 'HIPAA-compliant', caption: 'health data' },
  { icon: 'solar:shield-keyhole-bold', eyebrow: '03 · Security', title: 'Pen-tested', caption: 'independent third party' },
];

/** Zoom streaks for the whoosh exit, as [angle°, radius offset]. */
const STREAKS = Array.from({ length: 28 }, (_, i) => [i * (360 / 28) + (i % 3) * 4, (i * 53) % 140] as const);

const SHINE_MASK = 'linear-gradient(115deg, transparent 0%, transparent 38%, rgba(0,0,0,0.9) 50%, transparent 62%, transparent 100%)';

const Badge: React.FC<{ index: number; frame: number }> = ({ index, frame: f }) => {
  const b = BADGES[index];
  const at = LANDINGS[index];
  // Pre-roll slam (none for the badge landing on the scene's first frame).
  const pre = at === 0 ? 1 : progress(f, at - 5, 5, EASE.in);
  const impact = pop(f, at, { damping: 9, stiffness: 320, mass: 0.6 });
  const landed = f >= at;
  const scale = landed ? lerp(0.88, 1, impact) : lerp(1.9, 1, pre);
  const flash = landed ? 1 - progress(f, at, 18, EASE.out) : 0;
  const float = Math.sin((f - at) * 0.075 + index * 1.7) * 7 * progress(f, at + 8, 24);
  const ring = progress(f, at, 20, EASE.out);
  // Checker shine: on landing, then again during the hold.
  const shineAt = f < at + 40 ? at : at + 40;
  const sweep = progress(f, shineAt, 26, EASE.balanced);
  const maskPos = 200 - 300 * sweep;
  const line = mix(C.blue400, C.blue50, flash);

  if (f < at - 5) {
    return null;
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: ROW_X + index * (BADGE_W + BADGE_GAP),
        top: ROW_Y,
        width: BADGE_W,
        height: BADGE_H,
        transform: `translateY(${float + (landed ? 0 : lerp(-60, 0, pre))}px) scale(${scale})`,
        opacity: landed ? 1 : pre,
        filter: !landed && pre < 0.95 ? `blur(${(1 - pre) * 10}px)` : undefined,
      }}
    >
      {/* Shockwave ring. */}
      {landed && ring < 1 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 28,
            border: `2px solid ${alpha(C.blue200, 0.9 * (1 - ring))}`,
            transform: `scale(${1 + 0.28 * ring}, ${1 + 0.42 * ring})`,
            boxShadow: `0 0 40px ${alpha(C.blue400, 0.5 * (1 - ring))}`,
          }}
        />
      )}
      {/* Checker glow bleeding out behind the badge (CTA glow). */}
      <div
        style={{
          position: 'absolute',
          inset: -34,
          ...checker(alpha(C.blue400, 0.28 + 0.4 * flash), 8),
          maskImage: 'radial-gradient(ellipse 50% 50% at center, rgba(0,0,0,0.9) 0%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at center, rgba(0,0,0,0.9) 0%, transparent 100%)',
          opacity: 0.35 + 0.65 * flash,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 28,
          border: `1.5px solid ${alpha(line, 0.55 + 0.45 * flash)}`,
          backgroundColor: mix(C.slate950, C.navy, 0.5),
          backgroundImage: `radial-gradient(ellipse 72% 48% at 50% 0%, ${alpha(C.blue400, 0.22 + 0.3 * flash)} 0%, transparent 70%)`,
          boxShadow: `0 30px 80px -30px rgba(0,0,0,0.9), 0 0 ${24 + 90 * flash}px ${alpha(C.blue400, 0.25 + 0.5 * flash)}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Checker texture from the top border. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            ...checker(alpha(C.blue400, 0.3), 8),
            maskImage: 'radial-gradient(ellipse 72% 42% at 50% 0%, rgba(0,0,0,0.7) 0%, transparent 68%)',
            WebkitMaskImage: 'radial-gradient(ellipse 72% 42% at 50% 0%, rgba(0,0,0,0.7) 0%, transparent 68%)',
          }}
        />
        {/* Shine sweep. */}
        {sweep > 0 && sweep < 1 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              ...checker(alpha(C.white, 0.5), 6),
              maskImage: SHINE_MASK,
              WebkitMaskImage: SHINE_MASK,
              maskSize: '250% 250%',
              WebkitMaskSize: '250% 250%',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: `${maskPos}% 0`,
              WebkitMaskPosition: `${maskPos}% 0`,
            }}
          />
        )}
        <div
          style={{
            position: 'relative',
            width: 108,
            height: 108,
            borderRadius: 24,
            border: `1.5px solid ${alpha(C.blue400, 0.6 + 0.4 * flash)}`,
            background: alpha(C.blue400, 0.12 + 0.25 * flash),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 ${30 + 40 * flash}px ${alpha(C.blue400, 0.35 + 0.4 * flash)}`,
            transform: `scale(${landed ? lerp(0.6, 1, clamp(pop(f, at + 2, { damping: 10, stiffness: 260 }), 0, 1.3)) : 0.6})`,
          }}
        >
          <Icon name={b.icon} size={62} color={mix(C.blue100, C.white, flash)} />
        </div>
        <Mono size={18} tracking="0.12em" style={{ position: 'relative', marginTop: 26 }}>
          {b.eyebrow}
        </Mono>
        <div style={{ position: 'relative', ...TYPE.display, fontSize: 58, color: C.blue50, marginTop: 12, whiteSpace: 'nowrap' }}>
          {b.title}
        </div>
        <Mono size={18} color={C.slate500} tracking="0.08em" style={{ position: 'relative', marginTop: 14 }}>
          {b.caption}
        </Mono>
      </div>
    </div>
  );
};

export const Trust: React.FC = () => {
  const f = useCurrentFrame();

  const shakes = LANDINGS.map((at, i) => shake(f, at, 16, 12, `trust-${i}`));
  const sx = shakes.reduce((a, s) => a + s.x, 0);
  const sy = shakes.reduce((a, s) => a + s.y, 0);
  const sr = shakes.reduce((a, s) => a + s.r, 0);

  // Slow push, a small pull-back as anticipation, then zoom through.
  const push = lerp(1, 1.06, clamp(f / WHOOSH));
  const anticip = 1 - 0.035 * progress(f, WHOOSH - 6, 6, EASE.out);
  // Quadratic ramp: reads immediately on the whoosh, violent by the cut.
  const zoomT = progress(f, WHOOSH, beats(3) - WHOOSH, EASE.linear);
  const zoomQ = zoomT * zoomT;
  const scale = push * anticip * lerp(1, 3.6, zoomQ);
  const blur = 20 * zoomQ;
  const fade = 1 - progress(f, beats(3) - 7, 7, EASE.in);

  const lastHit = [...LANDINGS].reverse().find((at) => f >= at) ?? 0;
  const hitFlash = 1 - progress(f, lastHit, 8, EASE.out);

  return (
    <Backdrop variant="tintC" aura={1.4 + 0.4 * hitFlash} auraY={58} grid={0.05} gridOffset={{ x: f * 0.3, y: -f * 0.2 }}>
      <AbsoluteFill
        style={{
          transform: `translate(${sx}px, ${sy}px) rotate(${sr}deg) scale(${scale})`,
          transformOrigin: '50% 52%',
          filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
          opacity: fade,
        }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, top: 176, textAlign: 'center' }}>
          <Move at={0} duration={14} from={{ scale: 1.14, opacity: 0.55, blur: 5 }} unit="px">
            <div style={{ ...TYPE.display, fontSize: 124, color: C.slate300 }}>
              Secure by <span style={{ color: C.blue400 }}>design.</span>
            </div>
          </Move>
        </div>
        {BADGES.map((_, i) => (
          <Badge key={i} index={i} frame={f} />
        ))}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 800, display: 'flex', justifyContent: 'center' }}>
          <Move at={LANDINGS[2] + 8} duration={16} from={{ opacity: 0, y: 14, blur: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: FONT.mono }}>
              <Icon name="solar:lock-keyhole-bold" size={24} color={C.slate500} />
              <Mono size={20} color={C.slate500} tracking="0.1em">
                trust.unikraft.cloud
              </Mono>
            </div>
          </Move>
        </div>
      </AbsoluteFill>

      {/* Zoom streaks on the whoosh. */}
      {zoomQ > 0 && (
        <AbsoluteFill style={{ opacity: Math.sin(Math.PI * clamp(zoomT * 0.95)) }}>
          {STREAKS.map(([deg, off], i) => {
            const r0 = 140 + off + 1000 * zoomT;
            const len = 140 + 560 * zoomT;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 960,
                  top: 560,
                  width: len,
                  height: i % 4 === 0 ? 3 : 1.5,
                  background: `linear-gradient(90deg, transparent, ${alpha(i % 4 === 0 ? C.blue100 : C.slate300, 0.7)})`,
                  transform: `rotate(${deg}deg) translateX(${r0}px)`,
                  transformOrigin: '0 50%',
                }}
              />
            );
          })}
        </AbsoluteFill>
      )}

      {/* Hit flashes. */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 70% 55% at 50% 56%, ${alpha(C.blue400, 0.22 * hitFlash)} 0%, transparent 80%)`,
          mixBlendMode: 'screen',
        }}
      />
    </Backdrop>
  );
};
