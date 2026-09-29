import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { WORDMARK_VIEWBOX } from '../../../kit/brand/logo-data';
import { Backdrop } from '../../../kit/design/Backdrop';
import { CtaButton } from '../../../kit/design/Button';
import { Checkbox } from '../../../kit/design/Checkbox';
import { Logo } from '../../../kit/design/Logo';
import { EASE, lerp, pop, progress, scramble, shake } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { Move } from '../../../kit/design/Text';
import { alpha, C, FONT, mix, TYPE } from '../../../kit/design/tokens';

/**
 * 14 · End card (6 beats). Pays off the hook: "Fast. Safe. Cheap." return
 * already ticked, one per 8th (b54 / b54.5 / b55), implode on the reverse
 * swell, and the lockup booms in on b56. The site's hero stats row and CTA
 * pair land on b57 / b57.5, then the card holds with the checker shine.
 */

const WORDS = ['Fast.', 'Safe.', 'Cheap.'] as const;
const WORD_AT = [0, beats(0.5), beats(1)];
const IMPLODE_AT = beats(1.5);
const LOGO_AT = beats(2);
const STATS_AT = beats(3);
const CTA_AT = beats(3.5);

const FONT_SIZE = 204;
const LINE = FONT_SIZE * 0.93;
const TEXT_Y = 214;

const MARK_H = 150;
const LOCKUP_W = (MARK_H * WORDMARK_VIEWBOX.w) / WORDMARK_VIEWBOX.h;
const LOCKUP_TOP = 196;

// HeroStats copy (home.yaml `hero.stats`).
const STATS = [
  { label: '01 · Cold start', value: '<10ms', caption: 'all workloads' },
  { label: '02 · Density', value: '100K+', caption: 'VMs/server' },
  { label: '03 · Cost', value: '10-100×', caption: 'better unit economics' },
] as const;
const ROW = { left: 250, width: 1420, top: 452, height: 236 };

const Payoff: React.FC<{ frame: number }> = ({ frame }) => {
  const implode = progress(frame, IMPLODE_AT, LOGO_AT - IMPLODE_AT, EASE.in);
  if (implode >= 1) {
    return null;
  }
  const hits = WORD_AT.map((at, i) => shake(frame, at, 14, 10, `end-${i}`));
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${hits.reduce((a, h) => a + h.x, 0)}px, ${hits.reduce((a, h) => a + h.y, 0)}px) scale(${lerp(1, 0.02, implode)})`,
        transformOrigin: '50% 50%',
        filter: implode > 0.02 ? `blur(${implode * 18}px) brightness(${1 + implode * 2})` : undefined,
        opacity: 1 - progress(frame, LOGO_AT - 4, 4, EASE.linear),
      }}
    >
      {WORDS.map((word, i) => {
        const checked = progress(frame, WORD_AT[i] + 2, 8, EASE.out);
        const flash = progress(frame, WORD_AT[i] + 2, 5, EASE.out) * (1 - progress(frame, WORD_AT[i] + 8, 16, EASE.standard));
        return (
          <div
            key={word}
            style={{ position: 'absolute', left: 120, top: TEXT_Y + i * LINE, height: LINE, display: 'flex', alignItems: 'center' }}
          >
            <Move at={WORD_AT[i] - 3} duration={i === 0 ? 3 : 6} from={{ opacity: 0, scale: 0.4 }} easing={EASE.back}>
              <Checkbox checked={checked} size={64} />
            </Move>
            <Move
              at={WORD_AT[i]}
              duration={i === 0 ? 7 : 10}
              // The first word lands on the cut itself, so it starts half-formed rather than invisible.
              from={i === 0 ? { opacity: 0.55, scale: 1.3, blur: 14, x: -30 } : { opacity: 0, scale: 1.4, blur: 20, x: -40 }}
              origin="0% 60%"
              style={{ position: 'absolute', left: 116 }}
            >
              <div style={{ ...TYPE.display, fontSize: FONT_SIZE, lineHeight: 1, whiteSpace: 'nowrap', color: mix(C.slate300, C.blue400, flash) }}>
                {word}
              </div>
            </Move>
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 124,
          top: TEXT_Y + 3 * LINE + 26,
          fontFamily: FONT.mono,
          fontSize: 46,
          letterSpacing: '0.02em',
          color: C.blue100,
          whiteSpace: 'pre',
          textShadow: `0 0 28px ${alpha(C.blue400, 0.7)}`,
        }}
      >
        {scramble('// pick all three.', progress(frame, WORD_AT[2] + 4, 12, EASE.linear), frame, 'end-comment', 3)}
      </div>
    </AbsoluteFill>
  );
};

const StatsRow: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = progress(frame, STATS_AT - 6, 16, EASE.inOut);
  const colW = ROW.width / STATS.length;
  const tick = 18;
  const line = alpha(C.slate700, 0.9);
  return (
    <div style={{ position: 'absolute', left: ROW.left, top: ROW.top, width: ROW.width, height: ROW.height }}>
      {/* bracketed grid rules (BracketedGrid.astro) */}
      <div style={{ position: 'absolute', top: 0, left: 0, height: 1, width: `${draw * 100}%`, background: line }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, height: 1, width: `${draw * 100}%`, background: line }} />
      {Array.from({ length: STATS.length + 1 }, (_, i) => (
        <div key={i} style={{ opacity: draw }}>
          <div style={{ position: 'absolute', left: i * colW, top: 0, width: 1, height: tick, background: line }} />
          <div style={{ position: 'absolute', left: i * colW, bottom: 0, width: 1, height: tick, background: line }} />
        </div>
      ))}
      {STATS.map((stat, i) => {
        const at = STATS_AT + i * 4;
        const p = pop(frame, at, { damping: 13 });
        return (
          <div
            key={stat.label}
            style={{
              position: 'absolute',
              left: i * colW,
              width: colW,
              top: 0,
              height: ROW.height,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              opacity: progress(frame, at, 5, EASE.linear),
              transform: `translateY(${lerp(30, 0, p)}px)`,
            }}
          >
            <span style={{ fontFamily: FONT.mono, fontSize: 24, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.slate500 }}>
              {scramble(stat.label, progress(frame, at, 12, EASE.linear), frame, stat.label)}
            </span>
            <span
              style={{
                fontFamily: FONT.sans,
                fontSize: 104,
                lineHeight: 1,
                letterSpacing: '-0.05em',
                color: C.blue50,
                fontWeight: 500,
                transform: `scale(${lerp(1.25, 1, p)})`,
              }}
            >
              {stat.value}
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 26, letterSpacing: '-0.01em', color: C.slate300 }}>{stat.caption}</span>
          </div>
        );
      })}
    </div>
  );
};

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const boom = shake(frame, LOGO_AT, 24, 18, 'end-boom');
  const ring = progress(frame, LOGO_AT, 28, EASE.out);
  const flash =
    progress(frame, LOGO_AT - 3, 3, EASE.in) * (1 - progress(frame, LOGO_AT, 12, EASE.out)) +
    0.45 * (1 - progress(frame, 0, 8, EASE.out));
  const card = frame >= LOGO_AT;
  const push = lerp(1.04, 1, progress(frame, LOGO_AT, beats(4), EASE.out));
  const hover = progress(frame, CTA_AT + 26, 20, EASE.inOut);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Backdrop
        variant={card ? 'tintC' : 'tintB'}
        aura={card ? 1.5 + 0.8 * (1 - ring) : 1.1}
        auraY={card ? 38 : 50}
        grid={0.045}
        gridOffset={{ x: 0, y: -frame * 0.3 }}
        vignette={0.6}
      />

      <Payoff frame={frame} />

      {card && (
        <AbsoluteFill style={{ transform: `translate(${boom.x}px, ${boom.y}px) scale(${push})` }}>
          {ring < 1 && (
            <div
              style={{
                position: 'absolute',
                left: 960 - 800,
                top: LOCKUP_TOP + MARK_H / 2 - 800,
                width: 1600,
                height: 1600,
                borderRadius: '50%',
                border: `${lerp(12, 1, ring)}px solid ${alpha(C.blue100, 1 - ring)}`,
                transform: `scale(${lerp(0.04, 1.3, ring)})`,
              }}
            />
          )}
          <div style={{ position: 'absolute', left: (1920 - LOCKUP_W) / 2, top: LOCKUP_TOP }}>
            <Logo height={MARK_H} at={LOGO_AT} wordmark lettersDelay={10} glow={1.1} />
          </div>

          <StatsRow frame={frame} />

          <div
            style={{
              position: 'absolute',
              top: ROW.top + ROW.height + 70,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 28,
            }}
          >
            <Move at={CTA_AT} duration={12} from={{ opacity: 0, y: 30, scale: 0.9 }} easing={EASE.back}>
              <CtaButton label="Get started for free" size={34} shineAt={CTA_AT + 6} shinePeriod={70} hover={hover} />
            </Move>
            <Move at={CTA_AT + 4} duration={12} from={{ opacity: 0, y: 30, scale: 0.9 }} easing={EASE.back}>
              <CtaButton label="Talk to an engineer" size={34} variant="secondary" />
            </Move>
          </div>

          <div
            style={{
              position: 'absolute',
              top: 952,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: FONT.mono,
              fontSize: 26,
              letterSpacing: '0.1em',
              color: C.slate400,
              opacity: progress(frame, CTA_AT + 8, 10, EASE.standard),
            }}
          >
            <span style={{ color: C.blue100 }}>[</span> unikraft.com <span style={{ color: C.blue100 }}>]</span>
          </div>
        </AbsoluteFill>
      )}

      {flash > 0 && <AbsoluteFill style={{ background: alpha(C.blue100, flash * 0.8) }} />}
    </AbsoluteFill>
  );
};
