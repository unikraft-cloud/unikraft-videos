import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { WORDMARK_VIEWBOX } from '../../brand/logo-data';
import { Backdrop } from '../../design/Backdrop';
import { CtaButton } from '../../design/Button';
import { Checkbox } from '../../design/Checkbox';
import { Logo } from '../../design/Logo';
import { EASE, lerp, pop, progress, scramble, shake } from '../../design/motion';
import { Move } from '../../design/Text';
import { alpha, C, FONT, mix, SAFE, TYPE } from '../../design/tokens';
import { useScene } from '../../video/SceneContext';
import {
  CTA_ENTER,
  CTA_STAGGER,
  DEFAULT_CTAS,
  DEFAULT_URL,
  kickerFrames,
  RECAP_ENTER,
  STAT_STAGGER,
  URL_DELAY,
  URL_FADE,
  type EndCardProps,
  type EndCardStat,
} from './plan';

const CHECK = 64;
const TEXT_INDENT = 116;

const MARK_H = 150;
const LOCKUP_W = (MARK_H * WORDMARK_VIEWBOX.w) / WORDMARK_VIEWBOX.h;
const ROW = { left: 250, width: 1420, height: 236 };
const CTA_SIZE = 34;
/** Rendered CTA height at `CTA_SIZE` (padding 12 + line + padding 12, in site units × size/16). */
const CTA_H = 96;
const URL_H = 32;

/** Vertical stack of the card (the promo's spacing), centred a little below the middle like the promo. */
const layout = (hasStats: boolean, hasCtas: boolean, hasUrl: boolean) => {
  let y = 0;
  const lockup = y;
  y += MARK_H;
  const stats = y + 106;
  if (hasStats) y = stats + ROW.height;
  const ctas = y + (hasStats ? 70 : 110);
  if (hasCtas) y = ctas + CTA_H;
  const url = y + (hasCtas ? 98 : 110);
  if (hasUrl) y = url + URL_H;
  const top = Math.max(SAFE.top + 120, 590 - y / 2);
  return { lockup: top + lockup, stats: top + stats, ctas: top + ctas, url: top + url };
};

const Recap: React.FC<{ words: readonly string[]; kicker?: string }> = ({ words, kicker }) => {
  const frame = useCurrentFrame();
  const { at, dur, video } = useScene<EndCardProps>();
  const implodeAt = at('implode');
  const lockupAt = at('lockup');
  const implode = progress(frame, implodeAt, lockupAt - implodeAt, EASE.in);
  if (implode >= 1) {
    return null;
  }
  const landAt = words.map((_, i) => at(`recap${i}`));
  const longest = Math.max(...words.map((w) => w.length));
  const size = Math.round(
    Math.min(204, (1920 - 2 * SAFE.x - TEXT_INDENT) / (longest * 0.53), 640 / words.length / 0.93),
  );
  const line = size * 0.93;
  const blockH = words.length * line + (kicker ? 26 + 56 : 0);
  const top = (1080 - blockH) / 2;
  const amp = 10 * video.preset.shake;
  const hits = landAt.map((f, i) => shake(frame, f, 14, amp, `end-${i}`));
  const kickerAt = kicker ? at('kicker') : 0;
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${hits.reduce((a, h) => a + h.x, 0)}px, ${hits.reduce((a, h) => a + h.y, 0)}px) scale(${lerp(1, 0.02, implode)})`,
        transformOrigin: '50% 50%',
        filter: implode > 0.02 ? `blur(${implode * 18}px) brightness(${1 + implode * 2})` : undefined,
        opacity: 1 - progress(frame, lockupAt - 4, 4, EASE.linear),
      }}
    >
      {words.map((word, i) => {
        const land = landAt[i];
        const checked = progress(frame, land + 2, 8, EASE.out);
        const flash =
          progress(frame, land + 2, 5, EASE.out) * (1 - progress(frame, land + 8, 16, EASE.standard));
        // The first word lands on the cut itself, so it starts half-formed rather than invisible.
        const first = i === 0 && land === 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: SAFE.x,
              top: top + i * line,
              height: line,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Move at={land - 3} duration={first ? 3 : 6} from={{ opacity: 0, scale: 0.4 }} easing={EASE.back}>
              <Checkbox checked={checked} size={CHECK} />
            </Move>
            <Move
              at={land}
              duration={dur(first ? 7 : RECAP_ENTER)}
              from={
                first
                  ? { opacity: 0.55, scale: 1.3, blur: 14, x: -30 }
                  : { opacity: 0, scale: 1.4, blur: 20, x: -40 }
              }
              origin="0% 60%"
              style={{ position: 'absolute', left: TEXT_INDENT }}
            >
              <div
                style={{
                  ...TYPE.display,
                  fontSize: size,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  color: mix(C.slate300, C.blue400, flash),
                }}
              >
                {word}
              </div>
            </Move>
          </div>
        );
      })}
      {kicker && (
        <div
          style={{
            position: 'absolute',
            left: SAFE.x + 4,
            top: top + words.length * line + 26,
            fontFamily: FONT.mono,
            fontSize: 46,
            letterSpacing: '0.02em',
            color: C.blue100,
            whiteSpace: 'pre',
            textShadow: `0 0 28px ${alpha(C.blue400, 0.7)}`,
          }}
        >
          {scramble(
            kicker,
            progress(frame, kickerAt, kickerFrames(kicker), EASE.linear),
            frame,
            'end-kicker',
            3,
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};

const StatsRow: React.FC<{ stats: readonly EndCardStat[]; top: number }> = ({ stats, top }) => {
  const frame = useCurrentFrame();
  const { at } = useScene<EndCardProps>();
  const statsAt = at('stats');
  const draw = progress(frame, statsAt - 6, 16, EASE.inOut);
  const colW = ROW.width / stats.length;
  const tick = 18;
  const rule = alpha(C.slate700, 0.9);
  return (
    <div style={{ position: 'absolute', left: ROW.left, top, width: ROW.width, height: ROW.height }}>
      {/* bracketed grid rules (BracketedGrid.astro) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 1,
          width: `${draw * 100}%`,
          background: rule,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          height: 1,
          width: `${draw * 100}%`,
          background: rule,
        }}
      />
      {Array.from({ length: stats.length + 1 }, (_, i) => (
        <div key={i} style={{ opacity: draw }}>
          <div
            style={{ position: 'absolute', left: i * colW, top: 0, width: 1, height: tick, background: rule }}
          />
          <div
            style={{
              position: 'absolute',
              left: i * colW,
              bottom: 0,
              width: 1,
              height: tick,
              background: rule,
            }}
          />
        </div>
      ))}
      {stats.map((stat, i) => {
        const landAt = statsAt + i * STAT_STAGGER;
        const p = pop(frame, landAt, { damping: 13 });
        // Fit long values to the column (the promo's 104 px suits ~7 characters in a third of the row).
        const valueSize = Math.min(104, Math.floor((colW * 0.86) / (stat.value.length * 0.56)));
        return (
          <div
            key={i}
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
              opacity: progress(frame, landAt, 5, EASE.linear),
              transform: `translateY(${lerp(30, 0, p)}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 26,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: C.slate500,
              }}
            >
              {scramble(stat.label, progress(frame, landAt, 12, EASE.linear), frame, stat.label)}
            </span>
            <span
              style={{
                fontFamily: FONT.sans,
                fontSize: valueSize,
                lineHeight: 1,
                height: 104,
                display: 'flex',
                alignItems: 'center',
                letterSpacing: '-0.05em',
                color: C.blue50,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                transform: `scale(${lerp(1.25, 1, p)})`,
              }}
            >
              {stat.value}
            </span>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 26,
                letterSpacing: '-0.01em',
                color: C.slate300,
                whiteSpace: 'nowrap',
              }}
            >
              {stat.caption}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { props, at, dur, beats, video } = useScene<EndCardProps>();
  const { recap = [], kicker, stats = [], ctas = DEFAULT_CTAS, url = DEFAULT_URL, final = true } = props;

  const lockupAt = at('lockup');
  const ctasAt = at('ctas');
  const y = layout(stats.length > 0, ctas.length > 0, Boolean(url));

  const boom = shake(frame, lockupAt, 24, 18 * video.preset.shake, 'end-boom');
  const ring = progress(frame, lockupAt, dur(28), EASE.out);
  const preFlash = recap.length ? progress(frame, lockupAt - 3, 3, EASE.in) : 0;
  const flash =
    preFlash * (1 - progress(frame, lockupAt, 12, EASE.out)) +
    (recap.length ? 0.45 : 0.6) * (1 - progress(frame, recap.length ? 0 : lockupAt, 8, EASE.out));
  const card = frame >= lockupAt;
  const push = lerp(1.04, 1, progress(frame, lockupAt, beats(4), EASE.out));
  const hover = progress(frame, ctasAt + 26, 20, EASE.inOut);
  // Last scene: hold still to the final frame. Otherwise a gentle fade over the recipe exit.
  const exit = final ? 0 : progress(frame, at('exit'), dur('exit'), EASE.inOut);
  const urlAt = ctasAt + (ctas.length ? (ctas.length - 1) * CTA_STAGGER + URL_DELAY : 0);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: 1 - exit }}>
        <Backdrop
          variant={card ? 'tintC' : 'tintB'}
          aura={card ? 1.5 + 0.8 * (1 - ring) : 1.1}
          auraY={card ? ((y.lockup + MARK_H / 2) / 1080) * 100 + 13 : 50}
          grid={0.045}
          gridOffset={{ x: 0, y: -frame * 0.3 }}
          vignette={0.6}
        />

        {recap.length > 0 && <Recap words={recap} kicker={kicker} />}

        {card && (
          <AbsoluteFill style={{ transform: `translate(${boom.x}px, ${boom.y}px) scale(${push})` }}>
            {ring < 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: 960 - 800,
                  top: y.lockup + MARK_H / 2 - 800,
                  width: 1600,
                  height: 1600,
                  borderRadius: '50%',
                  border: `${lerp(12, 1, ring)}px solid ${alpha(C.blue100, 1 - ring)}`,
                  transform: `scale(${lerp(0.04, 1.3, ring)})`,
                }}
              />
            )}
            <div style={{ position: 'absolute', left: (1920 - LOCKUP_W) / 2, top: y.lockup }}>
              <Logo height={MARK_H} at={lockupAt} wordmark lettersDelay={10} glow={1.1} />
            </div>

            {stats.length > 0 && <StatsRow stats={stats} top={y.stats} />}

            {ctas.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: y.ctas,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 28,
                }}
              >
                {ctas.map((cta, i) => {
                  const variant = cta.variant ?? (i === 0 ? 'primary' : 'secondary');
                  const ctaAt = ctasAt + i * CTA_STAGGER;
                  return (
                    <Move
                      key={i}
                      at={ctaAt}
                      duration={dur(CTA_ENTER)}
                      from={{ opacity: 0, y: 30, scale: 0.9 }}
                      easing={EASE.back}
                    >
                      <CtaButton
                        label={cta.label}
                        size={CTA_SIZE}
                        variant={variant}
                        shineAt={ctaAt + 6}
                        shinePeriod={70}
                        hover={variant === 'primary' ? hover : 0}
                      />
                    </Move>
                  );
                })}
              </div>
            )}

            {url && (
              <div
                style={{
                  position: 'absolute',
                  top: y.url,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontFamily: FONT.mono,
                  fontSize: 26,
                  letterSpacing: '0.1em',
                  color: C.slate400,
                  opacity: progress(frame, urlAt, dur(URL_FADE), EASE.standard),
                }}
              >
                <span style={{ color: C.blue100 }}>[</span> {url} <span style={{ color: C.blue100 }}>]</span>
              </div>
            )}
          </AbsoluteFill>
        )}

        {flash > 0.01 && <AbsoluteFill style={{ background: alpha(C.blue100, flash * 0.8) }} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
