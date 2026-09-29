import type React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Icon } from '../../../kit/design/Icon';
import type { IconName } from '../../../kit/design/icons-data';
import { clamp, EASE, lerp, progress, scramble } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { alpha, C, FONT, mix, TERM } from '../../../kit/design/tokens';

/**
 * 05 · ANY WORKLOAD — the homepage hero rotator, turned up to 11 (4 beats).
 * "Build / [noun] / that cold-start in / 10 milliseconds." The noun swaps on
 * every 8th (b0 → b2.5, site rotator motion compressed to ~7 f) and flashes a
 * matching use-case icon tile. From b2 a riser: accelerating push, warp
 * streaks, a rushing floor grid and a glow ramp that flashes out into Deploy.
 */

const NOUNS: readonly { noun: string; icon: IconName; width: number }[] = [
  // `width`: measured InterVariable 600 / -0.05em advance at 100px (scaled by FONT_SIZE).
  { noun: 'databases', icon: 'solar:database-bold', width: 428 },
  { noun: 'sandboxes', icon: 'solar:shield-check-bold', width: 444 },
  { noun: 'headless browsers', icon: 'solar:monitor-bold', width: 764 },
  { noun: 'CI/CD builds', icon: 'solar:test-tube-bold', width: 509 },
  { noun: 'serverless functions', icon: 'solar:bolt-bold', width: 814 },
  { noun: 'AI agents', icon: 'solar:cpu-bolt-bold', width: 382 },
];
const SWAP_AT = NOUNS.map((_, i) => beats(i * 0.5));
const ENTER = 7;
const EXIT = 5;
// The incoming noun starts this many frames early so it already reads on the blip.
const LEAD = 2;
const RISER_AT = beats(2);
const END = beats(4);
const FLASH_AT = END - 12;

const FONT_SIZE = 160;
const LINE = FONT_SIZE * 0.9;
const TEXT_X = 120;
const TEXT_Y = 246;
const NOUN_Y = TEXT_Y + LINE;
const TILE = { x: 1500, y: NOUN_Y + LINE / 2 - 130, size: 250 };
// Streak vanishing point, and the camera push origin (centre of the final noun).
const VP = { x: 900, y: NOUN_Y + LINE / 2 };
const CAM = { x: TEXT_X + 310, y: NOUN_Y + LINE * 0.55 };

const STREAKS = Array.from({ length: 110 }, (_, i) => ({
  angle: random(`st-a-${i}`) * Math.PI * 2,
  r0: 60 + random(`st-r-${i}`) * 1300,
  speed: 0.6 + random(`st-s-${i}`) * 0.9,
  width: 1 + random(`st-w-${i}`) * 2.2,
  hot: random(`st-h-${i}`) > 0.8,
}));

export const Rotator: React.FC = () => {
  const frame = useCurrentFrame();

  // Which noun is on stage, and how far into its swap we are.
  const idx = Math.max(0, SWAP_AT.filter((s) => frame >= s).length - 1);
  const sinceSwap = frame - SWAP_AT[idx];
  const swapFlash = 1 - progress(frame, SWAP_AT[idx], 14, EASE.out);

  // Riser.
  const u = progress(frame, RISER_AT, END - RISER_AT, EASE.linear);
  const ramp = Math.pow(u, 2.2);
  const flash = progress(frame, FLASH_AT, END - 1 - FLASH_AT, EASE.in);
  const push = lerp(1, 1.03, frame / RISER_AT) + ramp * 0.42 + Math.pow(flash, 2) * 1.6;
  const jitter = u > 0 ? Math.sin(frame * 2.3) * ramp * 3 : 0;
  const travel = 2600 * Math.pow(u, 2.6);

  const headIn = progress(frame, -6, 14, EASE.out);
  const tagIn = progress(frame, 4, 18, EASE.linear);

  const nounStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    whiteSpace: 'pre',
    fontWeight: 600,
    color: C.blue400,
    transformOrigin: '0% 60%',
  };

  return (
    <AbsoluteFill>
      <Backdrop
        variant="tintC"
        aura={1 + ramp * 2.6 + swapFlash * 0.4}
        auraX={34}
        auraY={46}
        grid={0.05 * (1 - u)}
        gridOffset={{ x: -frame * 0.8, y: 0 }}
      >
        {/* Rushing floor grid */}
        {u > 0 && (
          <div
            style={{
              position: 'absolute',
              left: -1200,
              width: 4320,
              top: 700,
              height: 1400,
              transform: 'perspective(700px) rotateX(78deg)',
              transformOrigin: '50% 0%',
              backgroundImage: `linear-gradient(to right, ${alpha(C.blue400, 0.55)} 2px, transparent 2px), linear-gradient(to bottom, ${alpha(C.blue400, 0.55)} 2px, transparent 2px)`,
              backgroundSize: '120px 120px',
              backgroundPosition: `0px ${travel * 0.9}px`,
              opacity: clamp(u * 3) * 0.9,
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 100%)',
            }}
          />
        )}
      </Backdrop>

      {/* Warp streaks */}
      {u > 0 && (
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          {STREAKS.map((s, i) => {
            const r = 60 + ((s.r0 + travel * s.speed) % 1500);
            const len = 10 + 520 * ramp * s.speed;
            const cos = Math.cos(s.angle);
            const sin = Math.sin(s.angle);
            const fade = clamp((r - 60) / 260) * clamp(u * 4);
            return (
              <line
                key={i}
                x1={VP.x + cos * r}
                y1={VP.y + sin * r}
                x2={VP.x + cos * (r + len)}
                y2={VP.y + sin * (r + len)}
                stroke={s.hot ? C.blue50 : i % 2 ? C.blue100 : C.blue400}
                strokeWidth={s.width * (0.6 + ramp)}
                strokeLinecap="round"
                opacity={fade * (s.hot ? 0.8 : 0.5) * (0.35 + ramp)}
              />
            );
          })}
        </svg>
      )}

      <AbsoluteFill
        style={{
          transform: `translate(${jitter}px, ${-jitter * 0.6}px) scale(${push})`,
          transformOrigin: `${CAM.x}px ${CAM.y}px`,
          filter: flash > 0.15 ? `blur(${flash * 12}px)` : undefined,
        }}
      >
        {/* Headline */}
        <div
          style={{
            position: 'absolute',
            left: TEXT_X,
            top: TEXT_Y,
            fontFamily: FONT.sans,
            fontSize: FONT_SIZE,
            letterSpacing: '-0.05em',
            lineHeight: 0.9,
            color: C.blue50,
            fontWeight: 500,
          }}
        >
          <div
            style={{
              height: LINE,
              opacity: headIn,
              transform: `translateY(${(1 - headIn) * 0.3}em)`,
              filter: headIn < 0.98 ? `blur(${(1 - headIn) * 8}px)` : undefined,
            }}
          >
            Build
          </div>
          <div style={{ position: 'relative', height: LINE }}>
            {NOUNS.map((n, i) => {
              const enterAt = i === 0 ? -3 : SWAP_AT[i] - LEAD;
              const exitAt = i < NOUNS.length - 1 ? SWAP_AT[i + 1] - EXIT : END * 2;
              if (frame < enterAt || frame >= exitAt + EXIT) {
                return null;
              }
              const p = progress(frame, enterAt, ENTER, EASE.out);
              const q = progress(frame, exitAt, EXIT, EASE.in);
              const y = lerp(0.35, 0, p) - 0.35 * q;
              const blur = lerp(6, 0, p) + 8 * q;
              const glow = i === idx ? swapFlash : 0;
              return (
                <div
                  key={n.noun}
                  style={{
                    ...nounStyle,
                    opacity: p * (1 - q),
                    transform: `translateY(${y}em) scale(${lerp(1.06, 1, p)})`,
                    filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
                    color: mix(C.blue400, C.blue100, glow * 0.5 + ramp * 0.35),
                    textShadow: `0 0 ${40 + 60 * ramp}px ${alpha(C.blue400, 0.55 * glow + 0.8 * ramp)}`,
                  }}
                >
                  {n.noun}
                </div>
              );
            })}
            {/* swap underline */}
            <div
              style={{
                position: 'absolute',
                left: 4,
                top: LINE * 0.98,
                height: 6,
                borderRadius: 3,
                width: (NOUNS[idx].width / 100) * FONT_SIZE * progress(sinceSwap, 0, 8, EASE.out),
                background: C.blue400,
                boxShadow: `0 0 18px ${C.blue400}`,
                opacity: idx === NOUNS.length - 1 ? 0.35 + 0.65 * Math.max(swapFlash, ramp) : swapFlash,
              }}
            />
          </div>
          {['that cold-start in', '10 milliseconds.'].map((line, i) => {
            const p = progress(frame, -4 + i * 2, 14, EASE.out);
            return (
              <div
                key={line}
                style={{
                  height: LINE,
                  whiteSpace: 'pre',
                  opacity: p,
                  transform: `translateY(${(1 - p) * 0.3}em)`,
                  filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>

        <div style={{ position: 'absolute', left: TEXT_X + 6, top: TEXT_Y + LINE * 4 + 34 }}>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 24,
              letterSpacing: '0.12em',
              color: C.blue100,
              textTransform: 'uppercase',
              whiteSpace: 'pre',
            }}
          >
            {scramble('Any Dockerfile · No porting', tagIn, frame, 'rot-tag')}
          </span>
        </div>

        {/* Use-case icon tile */}
        <div
          style={{
            position: 'absolute',
            left: TILE.x,
            top: TILE.y,
            width: TILE.size,
            height: TILE.size,
            borderRadius: 36,
            border: `3px solid ${mix(C.slate700, C.blue400, Math.max(swapFlash, ramp))}`,
            background: `linear-gradient(160deg, ${alpha(C.blue400, 0.06 + 0.14 * swapFlash)} 0%, ${TERM.bg} 70%)`,
            boxShadow: `0 0 ${60 * Math.max(swapFlash, ramp)}px ${alpha(C.blue400, 0.45 * Math.max(swapFlash, ramp))}, 0 40px 80px -40px rgba(0,0,0,0.9)`,
            overflow: 'hidden',
            opacity: headIn,
            transform: `scale(${1 + 0.06 * swapFlash * swapFlash})`,
          }}
        >
          {NOUNS.map((n, i) => {
            const enterAt = i === 0 ? -3 : SWAP_AT[i] - LEAD;
            const exitAt = i < NOUNS.length - 1 ? SWAP_AT[i + 1] - EXIT : END * 2;
            if (frame < enterAt || frame >= exitAt + EXIT) {
              return null;
            }
            const p = progress(frame, enterAt, ENTER + 2, EASE.back);
            const q = progress(frame, exitAt, EXIT, EASE.in);
            return (
              <div
                key={n.icon}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: clamp(p * 2) * (1 - q),
                  transform: `translateY(${(1 - p) * 70 - q * 70}px) scale(${lerp(0.6, 1, p)})`,
                }}
              >
                <Icon name={n.icon} size={116} color={mix(C.blue400, C.blue100, i === idx ? swapFlash : 0)} />
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: 'absolute',
            left: TILE.x,
            width: TILE.size,
            top: TILE.y + TILE.size + 22,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: headIn,
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 20,
              letterSpacing: '0.1em',
              color: C.slate500,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'pre',
            }}
          >
            <span style={{ color: C.blue100 }}>{String(idx + 1).padStart(2, '0')}</span> / 06
          </span>
          <span style={{ display: 'flex', gap: 6 }}>
            {NOUNS.map((n, i) => (
              <span
                key={n.noun}
                style={{
                  width: 18,
                  height: 4,
                  borderRadius: 2,
                  background: i <= idx ? C.blue400 : C.slate700,
                }}
              />
            ))}
          </span>
        </div>
      </AbsoluteFill>

      {/* Flash-out into Deploy */}
      {flash > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 60% at ${(VP.x / 1920) * 100}% ${(VP.y / 1080) * 100}%, ${C.white} 0%, ${C.blue100} 45%, ${C.blue400} 100%)`,
            opacity: flash,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
