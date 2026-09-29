import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../design/Backdrop';
import { Chip } from '../../design/Chip';
import { Icon } from '../../design/Icon';
import { Logo } from '../../design/Logo';
import { clamp, EASE, lerp, pop, progress, scramble, shake } from '../../design/motion';
import { checker } from '../../design/patterns';
import { AccentText, Mono, Move } from '../../design/Text';
import { alpha, C, FONT, mix, SAFE, TERM, TYPE } from '../../design/tokens';
import { pointOnPath, Wire } from '../../design/Wire';
import { useScene } from '../../video/SceneContext';
import {
  badgeRow,
  badgeTitleSize,
  chipSize,
  FOOTER_DECODE,
  GROUP,
  type ChipItem,
  type ChipsProps,
} from './plan';

const HEAD_TOP = 172;
const HEAD_MAX = 124;

/* Badge layout (the promo's Trust). */
const BADGE_H = 336;
const ROW_Y = 392;
const SHINE_MASK =
  'linear-gradient(115deg, transparent 0%, transparent 38%, rgba(0,0,0,0.9) 50%, transparent 62%, transparent 100%)';
const GLOW_MASK = 'radial-gradient(ellipse 50% 50% at center, rgba(0,0,0,0.9) 0%, transparent 100%)';
const TOP_MASK = 'radial-gradient(ellipse 72% 42% at 50% 0%, rgba(0,0,0,0.7) 0%, transparent 68%)';

/* Hub layout (the promo's Deploy). */
const BOX = { cx: 960, y: 356, h: 132 };
const BUS_Y = 574;
const CHIP_Y = 672;
const GROUP_Y = 612;
const R = 16;
/** Frames a connector takes to draw into its chip; the chip pops `CHIP_LEAD` frames before its mark. */
const WIRE_LEAD = 7;
const CHIP_LEAD = 3;

const branch = (x: number): string => {
  const dir = x < BOX.cx ? -1 : 1;
  if (Math.abs(x - BOX.cx) < 2 * R) {
    return `M${BOX.cx},${BUS_Y - R} L${x},${CHIP_Y - 4}`;
  }
  return [
    `M${BOX.cx},${BUS_Y - R}`,
    `Q${BOX.cx},${BUS_Y} ${BOX.cx + dir * R},${BUS_Y}`,
    `L${x - dir * R},${BUS_Y}`,
    `Q${x},${BUS_Y} ${x},${BUS_Y + R}`,
    `L${x},${CHIP_Y - 4}`,
  ].join(' ');
};

const Badge: React.FC<{
  item: ChipItem;
  index: number;
  land: number;
  x: number;
  w: number;
  title: number;
}> = ({ item, index, land, x, w, title }) => {
  const f = useCurrentFrame();
  const { dur } = useScene();
  const lead = dur(5);
  const pre = progress(f, land - lead, lead, EASE.in);
  const impact = pop(f, land, { damping: 9, stiffness: 320, mass: 0.6 });
  const landed = f >= land;
  const scale = landed ? lerp(0.88, 1, impact) : lerp(1.9, 1, pre);
  const flash = landed ? 1 - progress(f, land, 18, EASE.out) : 0;
  const float = Math.sin((f - land) * 0.075 + index * 1.7) * 7 * progress(f, land + 8, 24);
  const ring = progress(f, land, 20, EASE.out);
  // Checker shine on landing, then every 2.5 s through the hold.
  const since = f - land;
  const shineAt = since < 40 ? land : land + 40 + Math.floor((since - 40) / 150) * 150;
  const sweep = progress(f, shineAt, 26, EASE.balanced);
  const maskPos = 200 - 300 * sweep;
  const line = mix(C.blue400, C.blue50, flash);
  if (f < land - lead) {
    return null;
  }
  const eyebrow = `${String(index + 1).padStart(2, '0')}${item.tag ? ` · ${item.tag}` : ''}`;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: ROW_Y,
        width: w,
        height: BADGE_H,
        transform: `translateY(${float + (landed ? 0 : lerp(-60, 0, pre))}px) scale(${scale})`,
        opacity: landed ? 1 : pre,
        filter: !landed && pre < 0.95 ? `blur(${(1 - pre) * 10}px)` : undefined,
      }}
    >
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
      <div
        style={{
          position: 'absolute',
          inset: -34,
          ...checker(alpha(C.blue400, 0.28 + 0.4 * flash), 8),
          maskImage: GLOW_MASK,
          WebkitMaskImage: GLOW_MASK,
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
        <div
          style={{
            position: 'absolute',
            inset: 0,
            ...checker(alpha(C.blue400, 0.3), 8),
            maskImage: TOP_MASK,
            WebkitMaskImage: TOP_MASK,
          }}
        />
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
            transform: `scale(${landed ? lerp(0.6, 1, clamp(pop(f, land + 2, { damping: 10, stiffness: 260 }), 0, 1.3)) : 0.6})`,
          }}
        >
          <Icon name={item.icon} size={62} color={mix(C.blue100, C.white, flash)} />
        </div>
        <Mono size={22} tracking="0.12em" style={{ position: 'relative', marginTop: 24 }}>
          {eyebrow}
        </Mono>
        <div
          style={{
            position: 'relative',
            ...TYPE.display,
            fontSize: title,
            color: C.blue50,
            marginTop: 12,
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </div>
        {item.detail && (
          <Mono
            size={26}
            color={C.slate400}
            tracking="0.06em"
            style={{ position: 'relative', marginTop: 14, whiteSpace: 'nowrap' }}
          >
            {item.detail}
          </Mono>
        )}
      </div>
    </div>
  );
};

export const Chips: React.FC = () => {
  const f = useCurrentFrame();
  const { props, at, dur, frames, video, scene } = useScene<ChipsProps>();
  const { headline, items, hub, group, footer } = props;
  const n = items.length;
  const head = at('head');
  const lands = items.map((_, i) => at(`item${i}`));
  const exit = progress(f, at('exit'), dur('exit'), EASE.in);
  const amp = video.preset.shake;
  const longest = Math.max(...items.map((it) => it.label.length));

  /* ---------- Camera ---------- */
  let sx = 0;
  let sy = 0;
  let sr = 0;
  // Chips land lightly on the hub layout; badges slam (the promo's Trust).
  for (const s of [
    shake(f, head, 16, 14 * amp, 'chips-head'),
    ...lands.map((l, i) => shake(f, l, hub ? 8 : 16, (hub ? 4 : 12) * amp, `chips-${i}`)),
  ]) {
    sx += s.x;
    sy += s.y;
    sr += s.r;
  }
  const push = lerp(1, 1.04, f / frames);
  const lastHit = [...lands].reverse().find((l) => f >= l) ?? head;
  const hitFlash = f >= head ? 1 - progress(f, lastHit, 8, EASE.out) : 0;

  const headSize = Math.round(
    Math.min(HEAD_MAX, (1920 - 2 * SAFE.x) / (headline.replace(/[[\]]/g, '').length * 0.5)),
  );

  /* ---------- Footer ---------- */
  const footAt = footer ? at('footer') : 0;
  const footP = footer ? progress(f, footAt, dur(FOOTER_DECODE), EASE.linear) : 0;
  const [footLit, ...footRest] = (footer ?? '').split(' · ');
  const footTail = footRest.length ? ` · ${footRest.join(' · ')}` : '';

  /* ---------- Hub geometry ---------- */
  const withDetail = items.some((it) => it.detail);
  const groupH = withDetail ? 216 : 188;
  const footerTop = hub ? GROUP_Y + groupH + 44 : ROW_Y + BADGE_H + 72;
  const chipPx = chipSize(n, longest);
  const chipX = items.map((_, i) => GROUP.x + (GROUP.w * (i + 0.5)) / n);
  const hubLogo = hub?.logo ?? true;
  const hubW = hub ? Math.max(480, hub.label.length * 32.5 + (hubLogo ? 88 : 0) + 120) : 0;
  const wires = chipX.map(branch);
  const trunk = `M${BOX.cx},${BOX.y + BOX.h} L${BOX.cx},${BUS_Y - R}`;

  const camOrigin = hub ? `${BOX.cx}px ${BOX.y + BOX.h / 2}px` : '50% 52%';
  const camScale = push * (hub ? 1 + 1.4 * exit : lerp(1, 3.6, exit * exit));

  const headlineEl = (
    <div style={{ position: 'absolute', left: 0, right: 0, top: HEAD_TOP, textAlign: 'center' }}>
      <Move at={head - 4} duration={dur(14)} from={{ scale: 1.12, opacity: 0, blur: 12, y: 40 }} unit="px">
        <div style={{ ...TYPE.display, fontSize: headSize, color: C.slate300, whiteSpace: 'pre' }}>
          <AccentText text={headline} />
        </div>
      </Move>
    </div>
  );

  const badges = () => {
    const { w, gap } = badgeRow(n);
    const x0 = (1920 - (n * w + (n - 1) * gap)) / 2;
    const title = badgeTitleSize(w, longest);
    return items.map((it, i) => (
      <Badge key={i} item={it} index={i} land={lands[i]} x={x0 + i * (w + gap)} w={w} title={title} />
    ));
  };

  const hubRow = () => {
    const boxPop = pop(f, head - 2, { damping: 12, stiffness: 260 });
    const boxFlash = 1 - progress(f, head, 12, EASE.out);
    const trunkP = progress(f, head + 4, dur(8), EASE.inOut);
    const groupP = progress(f, head + 8, dur(8), EASE.out);
    const tilt = lerp(16, 3, progress(f, head - 2, 34, EASE.out));
    return (
      <div style={{ position: 'absolute', inset: 0, perspective: 1800 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `rotateX(${tilt}deg)`,
            transformOrigin: `${BOX.cx}px ${BOX.y}px`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: GROUP.x,
              top: GROUP_Y,
              width: GROUP.w,
              height: groupH,
              borderRadius: 24,
              border: `2px dashed ${alpha(C.slate500, 0.55)}`,
              opacity: groupP,
              transform: `scale(${lerp(0.96, 1, groupP)})`,
            }}
          >
            {group && (
              <span
                style={{
                  position: 'absolute',
                  left: 28,
                  top: 16,
                  fontFamily: FONT.mono,
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: C.slate400,
                }}
              >
                {group}
              </span>
            )}
          </div>

          <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            {wires.map((d, i) => {
              const land = lands[i] - CHIP_LEAD;
              const p = progress(f, land - WIRE_LEAD, WIRE_LEAD, EASE.inOut);
              const landed = f >= land;
              const tip = pointOnPath(d, p);
              return (
                <g key={i}>
                  <Wire d={d} progress={p} color={C.blue400} width={3} glow={landed ? 1 : 0.5} />
                  {landed && (
                    <path
                      d={d}
                      fill="none"
                      stroke={C.blue100}
                      strokeWidth={3}
                      strokeDasharray="8 12"
                      strokeDashoffset={-(f - lands[i]) * 1.8}
                      opacity={0.8 * progress(f, lands[i], 8, EASE.out)}
                    />
                  )}
                  {!landed && p > 0 && (
                    <circle
                      cx={tip.x}
                      cy={tip.y}
                      r={8}
                      fill={C.blue50}
                      style={{ filter: `drop-shadow(0 0 10px ${C.blue400})` }}
                    />
                  )}
                </g>
              );
            })}
            <Wire d={trunk} progress={trunkP} color={C.blue400} width={3} glow={1} />
            <path
              d={trunk}
              fill="none"
              stroke={C.blue100}
              strokeWidth={3}
              strokeDasharray="8 12"
              strokeDashoffset={-f * 1.8}
              opacity={0.8 * progress(f, lands[0], 8, EASE.out)}
            />
          </svg>

          {items.map((it, i) => {
            const land = lands[i] - CHIP_LEAD;
            if (f < land) {
              return null;
            }
            const s = pop(f, land, { damping: 12, stiffness: 380, mass: 0.5 });
            const burst = 1 - progress(f, land, 16, EASE.out);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: chipX[i],
                  top: CHIP_Y,
                  transform: `translate(-50%, ${(1 - s) * 26}px) scale(${lerp(0.55, 1, s)})`,
                  transformOrigin: '50% 0%',
                  opacity: clamp(s * 3),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <Chip
                  label={it.label}
                  icon={it.icon}
                  tone="blue"
                  size={chipPx}
                  glow={0.35 + burst}
                  style={{
                    background: mix(TERM.bg, C.blue400, 0.55 * burst),
                    color: mix(C.blue100, C.white, burst),
                    border: `2px solid ${mix(C.blue400, C.blue100, burst)}`,
                  }}
                />
                {it.detail && (
                  <Mono
                    size={26}
                    color={C.slate400}
                    tracking="0.04em"
                    upper={false}
                    style={{ marginTop: 16, whiteSpace: 'nowrap' }}
                  >
                    {it.detail}
                  </Mono>
                )}
              </div>
            );
          })}

          {hub && (
            <div
              style={{
                position: 'absolute',
                left: BOX.cx - hubW / 2,
                top: BOX.y,
                width: hubW,
                height: BOX.h,
                borderRadius: 24,
                border: `3px solid ${C.blue400}`,
                background: TERM.bg,
                boxShadow: `0 0 ${60 + 80 * boxFlash + 60 * exit}px ${alpha(C.blue400, 0.35 + 0.3 * boxFlash + 0.3 * exit)}`,
                transform: `scale(${lerp(1.3, 1, boxPop)})`,
                opacity: clamp(boxPop * 2.5),
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, ...checker(alpha(C.blue400, 0.3), 10) }} />
              <div
                style={{
                  position: 'relative',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 26,
                }}
              >
                {hubLogo && <Logo height={62} glow={0.8} />}
                <span
                  style={{
                    fontFamily: FONT.sans,
                    fontWeight: 700,
                    fontSize: 58,
                    letterSpacing: '-0.035em',
                    color: C.blue400,
                    textShadow: `0 0 30px ${alpha(C.blue400, 0.5)}`,
                    paintOrder: 'stroke fill',
                    WebkitTextStroke: `8px ${TERM.bg}`,
                    whiteSpace: 'pre',
                  }}
                >
                  {hub.label}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill>
      <Backdrop
        variant="tintC"
        aura={(hub ? 1.3 : 1.4) + 0.4 * hitFlash}
        auraX={50}
        auraY={hub ? 44 : 58}
        grid={0.05}
        gridOffset={hub ? { x: 0, y: f * 0.6 } : { x: f * 0.3, y: -f * 0.2 }}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${sx}px, ${sy}px) rotate(${sr}deg) scale(${camScale})`,
          transformOrigin: camOrigin,
          filter: exit > 0.05 ? `blur(${exit * 14}px)` : undefined,
          opacity: 1 - exit,
        }}
      >
        {headlineEl}
        {hub ? hubRow() : badges()}
        {footer && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: footerTop,
              display: 'flex',
              justifyContent: 'center',
              opacity: f >= footAt ? 1 : 0,
            }}
          >
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: '0.14em',
                color: C.slate400,
                whiteSpace: 'pre',
                padding: '12px 26px',
                borderRadius: 12,
                border: `2px dashed ${alpha(C.slate500, 0.5 * footP)}`,
              }}
            >
              <span style={{ color: C.blue100 }}>
                {scramble(footLit, footP * 2.2, f, `${scene.id}-fa`, 2)}
              </span>
              {scramble(footTail, footP, f, `${scene.id}-fb`)}
            </span>
          </div>
        )}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 70% 55% at 50% 56%, ${alpha(C.blue400, 0.22 * hitFlash)} 0%, transparent 80%)`,
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};
