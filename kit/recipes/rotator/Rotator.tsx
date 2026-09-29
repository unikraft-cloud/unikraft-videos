import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../design/Backdrop';
import { Icon } from '../../design/Icon';
import { clamp, EASE, lerp, progress, scramble, shake } from '../../design/motion';
import { alpha, C, FONT, mix, SAFE, TERM } from '../../design/tokens';
import { useScene } from '../../video/SceneContext';
import { TAG_DECODE, type RotatorProps } from './plan';

/** Frames (unscaled) a noun takes to swap in / out; the incoming one starts `LEAD` early to read on the blip. */
const ENTER = 7;
const EXIT = 5;
const LEAD = 2;

const FONT_MAX = 160;
/** InterVariable 500–600 at -0.05em tracking: advance per character, in em (measured on the promo's nouns + margin). */
const CHAR_EM = 0.47;
const TEXT_X = SAFE.x;
const TILE_SIZE = 250;
const TILE_X = 1920 - SAFE.x - TILE_SIZE - 50;
const TAG_H = 60;

export const Rotator: React.FC = () => {
  const frame = useCurrentFrame();
  const { props, at, dur, frames, video } = useScene<RotatorProps>();
  const { before, nouns, after, tag } = props;
  const last = nouns.length - 1;
  const swapAt = nouns.map((_, i) => at(`noun${i}`));
  const exit = progress(frame, at('exit'), dur('exit'), EASE.in);

  // Layout: sentence fits between the left margin and the icon tile, block centred vertically.
  const longest = Math.max(...[before, ...after, ...nouns.map((n) => n.text)].map((l) => l.length));
  const size = Math.floor(Math.min(FONT_MAX, (TILE_X - TEXT_X - 60) / (longest * CHAR_EM)));
  const line = size * 0.9;
  const lines = 2 + after.length;
  const textY = Math.round((1080 - lines * line - (tag ? TAG_H : 0)) / 2 + 24);
  const nounY = textY + line;
  const tileY = nounY + line / 2 - TILE_SIZE / 2 - 10;

  // Which noun is on stage, and how far into its swap we are.
  const idx = Math.max(0, swapAt.filter((s) => frame >= s).length - 1);
  const sinceSwap = frame - swapAt[idx];
  const swapFlash = frame >= swapAt[0] ? 1 - progress(frame, swapAt[idx], 14, EASE.out) : 0;
  const lockAt = swapAt[last];
  const locked = frame >= lockAt;
  const lock = locked ? 1 - progress(frame, lockAt, 24, EASE.out) : 0;

  const hit = shake(frame, lockAt, 16, 8 * video.preset.shake, 'rotator-lock');
  const push = lerp(1, 1.035, frame / frames) * (1 + 0.025 * lock) * (1 + 0.12 * exit);
  const headIn = progress(frame, swapAt[0] - 6, dur(14), EASE.out);
  const enter = dur(ENTER);
  const out = dur(EXIT);

  const tagAt = tag ? at('tag') : 0;
  const tagP = tag ? progress(frame, tagAt, dur(TAG_DECODE), EASE.linear) : 0;

  const stage = (i: number) => ({
    from: i === 0 ? swapAt[0] - 3 : swapAt[i] - LEAD,
    to: i < last ? swapAt[i + 1] - out : frames * 2,
  });

  const staticLine = (text: string, i: number) => {
    const p = progress(frame, swapAt[0] - 4 + i * 2, dur(14), EASE.out);
    return (
      <div
        key={i}
        style={{
          height: line,
          whiteSpace: 'pre',
          opacity: p,
          transform: `translateY(${(1 - p) * 0.3}em)`,
          filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined,
        }}
      >
        {text}
      </div>
    );
  };

  return (
    <AbsoluteFill>
      <Backdrop
        variant="tintC"
        aura={1 + swapFlash * 0.4 + lock * 0.6}
        auraX={34}
        auraY={46}
        grid={0.05}
        gridOffset={{ x: -frame * 0.8, y: 0 }}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${hit.x}px, ${hit.y}px) scale(${push})`,
          transformOrigin: `${TEXT_X + 300}px ${nounY + line * 0.55}px`,
          filter: exit > 0.02 ? `blur(${exit * 12}px)` : undefined,
          opacity: 1 - exit,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: TEXT_X,
            top: textY,
            fontFamily: FONT.sans,
            fontSize: size,
            letterSpacing: '-0.05em',
            lineHeight: 0.9,
            color: C.blue50,
            fontWeight: 500,
          }}
        >
          <div
            style={{
              height: line,
              whiteSpace: 'pre',
              opacity: headIn,
              transform: `translateY(${(1 - headIn) * 0.3}em)`,
              filter: headIn < 0.98 ? `blur(${(1 - headIn) * 8}px)` : undefined,
            }}
          >
            {before}
          </div>
          <div style={{ position: 'relative', height: line }}>
            {nouns.map((n, i) => {
              const w = stage(i);
              if (frame < w.from || frame >= w.to + out) {
                return null;
              }
              const p = progress(frame, w.from, enter, EASE.out);
              const q = progress(frame, w.to, out, EASE.in);
              const y = lerp(0.35, 0, p) - 0.35 * q;
              const blur = lerp(6, 0, p) + 8 * q;
              const glow = i === idx ? swapFlash : 0;
              const underline = i === idx ? progress(sinceSwap, 0, 8, EASE.out) : 1;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    whiteSpace: 'pre',
                    fontWeight: 600,
                    transformOrigin: '0% 60%',
                    opacity: p * (1 - q),
                    transform: `translateY(${y}em) scale(${lerp(1.06, 1, p)})`,
                    filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
                    color: mix(C.blue400, C.blue100, glow * 0.5),
                    textShadow: `0 0 ${40 + 30 * lock}px ${alpha(C.blue400, 0.55 * glow + 0.3 * lock)}`,
                  }}
                >
                  <span style={{ position: 'relative', display: 'inline-block' }}>
                    {n.text}
                    <span
                      style={{
                        position: 'absolute',
                        left: 4,
                        top: line * 0.98,
                        height: 6,
                        borderRadius: 3,
                        width: `calc(${underline * 100}% - 4px)`,
                        background: C.blue400,
                        boxShadow: `0 0 18px ${C.blue400}`,
                        opacity: i === last && locked ? 0.45 + 0.55 * lock : glow,
                      }}
                    />
                  </span>
                </div>
              );
            })}
          </div>
          {after.map((l, i) => staticLine(l, i + 1))}
        </div>

        {tag && (
          <div style={{ position: 'absolute', left: TEXT_X + 6, top: textY + lines * line + 30 }}>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 28,
                letterSpacing: '0.12em',
                color: C.blue100,
                textTransform: 'uppercase',
                whiteSpace: 'pre',
                opacity: frame >= tagAt ? 1 : 0,
              }}
            >
              {scramble(tag, tagP, frame, 'rotator-tag')}
            </span>
          </div>
        )}

        {/* Use-case icon tile */}
        <div
          style={{
            position: 'absolute',
            left: TILE_X,
            top: tileY,
            width: TILE_SIZE,
            height: TILE_SIZE,
            borderRadius: 36,
            border: `3px solid ${mix(C.slate700, C.blue400, Math.max(swapFlash, locked ? 0.7 : 0))}`,
            background: `linear-gradient(160deg, ${alpha(C.blue400, 0.06 + 0.14 * swapFlash)} 0%, ${TERM.bg} 70%)`,
            boxShadow: `0 0 ${60 * Math.max(swapFlash, 0.5 * Number(locked))}px ${alpha(C.blue400, 0.45 * Math.max(swapFlash, 0.5 * Number(locked)))}, 0 40px 80px -40px rgba(0,0,0,0.9)`,
            overflow: 'hidden',
            opacity: headIn,
            transform: `scale(${1 + 0.06 * swapFlash * swapFlash})`,
          }}
        >
          {nouns.map((n, i) => {
            const w = stage(i);
            if (frame < w.from || frame >= w.to + out) {
              return null;
            }
            const p = progress(frame, w.from, enter + 2, EASE.back);
            const q = progress(frame, w.to, out, EASE.in);
            return (
              <div
                key={i}
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
            left: TILE_X,
            width: TILE_SIZE,
            top: tileY + TILE_SIZE + 22,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: headIn,
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 24,
              letterSpacing: '0.1em',
              color: C.slate500,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'pre',
            }}
          >
            <span style={{ color: C.blue100 }}>{String(idx + 1).padStart(2, '0')}</span> /{' '}
            {String(nouns.length).padStart(2, '0')}
          </span>
          <span style={{ display: 'flex', gap: 6 }}>
            {nouns.map((_, i) => (
              <span
                key={i}
                style={{
                  width: Math.min(18, 110 / nouns.length),
                  height: 4,
                  borderRadius: 2,
                  background: i <= idx ? C.blue400 : C.slate700,
                }}
              />
            ))}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
