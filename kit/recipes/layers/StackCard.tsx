import type React from 'react';
import { Icon } from '../../design/Icon';
import { checker, hatch, hatchBorder } from '../../design/patterns';
import { alpha, C, FONT, mix } from '../../design/tokens';
import type { LayerTone } from './plan';

/**
 * The promo's TcbCard (a frame-driven port of the site's Security/TcbDiagram
 * column), generalised to 1–4 workloads and 1–3 shared layers: rounded card with
 * a tinted top glow + checker, workload boxes on top, the dashed trusted-computing-base
 * envelope around the shared layers, and a base (hardware) layer. Everything is
 * absolutely positioned in card-local px so bugs can be choreographed against the
 * exact rects from `stackLayout`.
 */

export type Rect = { x: number; y: number; w: number; h: number };

const PAD = 36;
const GAP = 16;
const LAYER_H = 60;
const ZONE_PAD = 14;
const LAYER_GAP = 12;
const APP_W = 160;
const APP_GAP = 16;
/** Card-top band reserved for the title + stat line. */
const META_H = 140;
const APP_MIN_H = 120;
const APP_MAX_H = 190;

export type StackLayout = { apps: Rect[]; zone: Rect; layers: Rect[]; base: Rect };

/** Bottom-anchored layout (the base lines up across cards, as on the site); workloads centred. */
export const stackLayout = (width: number, height: number, apps: number, layers: number): StackLayout => {
  const base = { x: PAD, y: height - PAD - LAYER_H, w: width - 2 * PAD, h: LAYER_H };
  const zoneH = 2 * ZONE_PAD + layers * LAYER_H + (layers - 1) * LAYER_GAP;
  const zone = { x: PAD, y: base.y - GAP - zoneH, w: width - 2 * PAD, h: zoneH };
  const layerRects = Array.from({ length: layers }, (_, i) => ({
    x: zone.x + ZONE_PAD,
    y: zone.y + ZONE_PAD + i * (LAYER_H + LAYER_GAP),
    w: zone.w - 2 * ZONE_PAD,
    h: LAYER_H,
  }));
  const appH = Math.min(APP_MAX_H, Math.max(APP_MIN_H, zone.y - GAP - META_H));
  const top = zone.y - GAP - appH;
  const x0 = (width - (apps * APP_W + (apps - 1) * APP_GAP)) / 2;
  const appRects = Array.from({ length: apps }, (_, i) => ({
    x: x0 + i * (APP_W + APP_GAP),
    y: top,
    w: APP_W,
    h: appH,
  }));
  return { apps: appRects, zone, layers: layerRects, base };
};

export type AppState = {
  label: string;
  /** 0→1 entrance (scale pop). */
  pop: number;
  /** 0→1 compromised (red). */
  infected?: number;
  /** 0→1 boundary lit (solid blue + checker + shield). */
  guard?: number;
  /** Extra flash on top of `guard`/`infected`. */
  flash?: number;
};

export type LayerState = { label: string; tone: LayerTone; enter: number; heat?: number };

type Props = {
  width: number;
  height: number;
  layout: StackLayout;
  title: React.ReactNode;
  stat?: { label: string; value: string };
  /** Rose "at risk" card (vs brand-blue "safe"). */
  risk: boolean;
  statGlow?: number;
  apps: AppState[];
  layers: LayerState[];
  base: LayerState;
  zone: string;
  zoneEnter: number;
  /** 0→1 red alarm on the envelope. */
  zoneHeat?: number;
  /** Extra glow on the card border/top (landing, hits). */
  glow?: number;
  children?: React.ReactNode;
};

const layerStyle = (tone: LayerTone, heat: number): React.CSSProperties => {
  if (tone === 'warn') {
    return {
      ...hatch(C.rose, { line: 40 + 40 * heat, tint: 14 + 30 * heat, stripe: 3, gap: 7 }),
      borderColor: hatchBorder(C.rose, 48 + 52 * heat),
    };
  }
  if (tone === 'safe') {
    return {
      ...hatch(C.blue400, { line: 42, tint: 14, stripe: 3, gap: 7 }),
      borderColor: hatchBorder(C.blue400, 45),
    };
  }
  if (heat > 0.01) {
    return {
      ...hatch(C.rose, { line: 60 * heat, tint: 8 + 30 * heat, stripe: 3, gap: 7 }),
      borderColor: mix(C.slate700, C.rose, heat),
    };
  }
  return { backgroundColor: alpha(C.slate900, 0.7), borderColor: alpha(C.slate700, 0.8) };
};

const TOP_MASK = 'radial-gradient(ellipse 72% 42% at 50% 0%, rgba(0,0,0,0.7) 0%, transparent 68%)';
const GUARD_MASK = 'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(0,0,0,0.9) 0%, transparent 80%)';

export const StackCard: React.FC<Props> = ({
  width,
  height,
  layout: L,
  title,
  stat,
  risk,
  statGlow = 0,
  apps,
  layers,
  base,
  zone,
  zoneEnter,
  zoneHeat = 0,
  glow = 0,
  children,
}) => {
  const tone = risk ? C.rose : C.blue400;
  const statColor = risk ? C.red : C.blue200;
  const zoneColor = mix(tone, C.rose, zoneHeat);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        borderRadius: 22,
        border: `1.5px solid ${alpha(tone, 0.42 + 0.4 * glow)}`,
        backgroundColor: alpha(C.slate950, 0.55),
        backgroundImage: `radial-gradient(ellipse 72% 42% at 50% 0%, ${alpha(tone, 0.2 + 0.18 * glow)} 0%, transparent 68%)`,
        boxShadow: `0 30px 80px -30px rgba(0,0,0,0.9), 0 0 ${60 * glow}px ${alpha(tone, 0.35 * glow)}`,
        overflow: 'hidden',
        isolation: 'isolate',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...checker(alpha(tone, 0.32 + 0.2 * glow), 8),
          maskImage: TOP_MASK,
          WebkitMaskImage: TOP_MASK,
        }}
      />

      {/* Title + stat. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 30, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: FONT.sans,
            fontWeight: 600,
            fontSize: 40,
            letterSpacing: '-0.02em',
            color: C.blue50,
            lineHeight: 1.1,
            whiteSpace: 'pre',
          }}
        >
          {title}
        </div>
        {stat && (
          <div
            style={{
              marginTop: 12,
              fontFamily: FONT.mono,
              fontSize: 26,
              color: C.slate400,
              letterSpacing: '0.01em',
            }}
          >
            {stat.label}:{' '}
            <strong
              style={{
                color: statColor,
                fontWeight: 700,
                textShadow:
                  statGlow > 0 ? `0 0 ${24 * statGlow}px ${alpha(statColor, 0.9 * statGlow)}` : undefined,
              }}
            >
              {stat.value}
            </strong>
          </div>
        )}
      </div>

      {/* Workload boxes. */}
      {L.apps.map((r, i) => {
        const a = apps[i];
        const infected = a.infected ?? 0;
        const guard = a.guard ?? 0;
        const flash = a.flash ?? 0;
        const lineColor =
          guard > 0.01 ? mix(C.slate400, C.blue400, guard) : mix(C.slate400, C.rose, infected);
        const lit = Math.max(guard, infected);
        const accent = guard > 0.01 || !risk ? C.blue400 : C.rose;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              borderRadius: 12,
              border: `${2 + flash * 2}px ${lit > 0.5 ? 'solid' : 'dashed'} ${alpha(lineColor, 0.6 + 0.4 * lit)}`,
              background: alpha(
                mix(C.blue400, accent, Math.max(lit, flash)),
                0.06 + 0.12 * lit + 0.2 * flash,
              ),
              boxShadow:
                lit > 0.01
                  ? `0 0 ${(28 + 40 * flash) * lit}px ${alpha(accent, 0.45 * lit + 0.3 * flash)}, inset 0 0 ${24 * lit}px ${alpha(accent, 0.25 * lit)}`
                  : undefined,
              transform: `scale(${a.pop})`,
              opacity: Math.min(1, a.pop * 1.5),
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
            }}
          >
            {guard > 0.01 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  ...checker(alpha(C.blue400, 0.35 * guard), 8),
                  maskImage: GUARD_MASK,
                  WebkitMaskImage: GUARD_MASK,
                }}
              />
            )}
            <span
              style={{
                position: 'relative',
                fontFamily: FONT.mono,
                fontWeight: 500,
                fontSize: 26,
                color: guard > 0.5 ? C.blue100 : mix(C.slate300, C.red, infected),
                whiteSpace: 'pre',
              }}
            >
              {a.label}
            </span>
            {guard > 0.5 ? (
              <Icon
                name="solar:shield-check-bold"
                size={30}
                color={C.blue200}
                style={{ position: 'relative', opacity: guard }}
              />
            ) : (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  background: mix(C.slate600, C.rose, infected),
                  opacity: 0.8,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Trusted computing base envelope. */}
      <div
        style={{
          position: 'absolute',
          left: L.zone.x,
          top: L.zone.y,
          width: L.zone.w,
          height: L.zone.h,
          borderRadius: 12,
          border: `1.5px dashed ${alpha(zoneColor, 0.5 + 0.4 * zoneHeat)}`,
          boxShadow: zoneHeat > 0.01 ? `0 0 ${40 * zoneHeat}px ${alpha(C.rose, 0.4 * zoneHeat)}` : undefined,
          opacity: zoneEnter,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: L.zone.x + 18,
          top: L.zone.y - 12,
          padding: '0 8px',
          background: C.slate950,
          fontFamily: FONT.mono,
          fontSize: 18,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: zoneHeat > 0.3 ? C.red : C.slate400,
          lineHeight: '24px',
          opacity: zoneEnter,
        }}
      >
        {zone}
      </div>

      {/* Layers inside the envelope + the base. */}
      {[...L.layers.map((r, i) => ({ r, spec: layers[i] })), { r: L.base, spec: base }].map(
        ({ r, spec }, i) => {
          const heat = spec.heat ?? 0;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: r.x,
                top: r.y,
                width: r.w,
                height: r.h,
                borderRadius: 10,
                borderWidth: 1.5,
                borderStyle: 'solid',
                ...layerStyle(spec.tone, heat),
                boxShadow: heat > 0.01 ? `0 0 ${36 * heat}px ${alpha(C.rose, 0.55 * heat)}` : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT.sans,
                fontWeight: 500,
                fontSize: 26,
                color: heat > 0.3 ? C.white : spec.tone === 'neutral' ? C.slate300 : C.blue50,
                clipPath: spec.enter >= 1 ? undefined : `inset(-40px ${100 - 100 * spec.enter}% -40px -40px)`,
                opacity: Math.min(1, spec.enter * 2),
                whiteSpace: 'pre',
              }}
            >
              {spec.label}
            </div>
          );
        },
      )}

      {children}
    </div>
  );
};

/** Site bug chip: white `solar:bug-bold` in a rose disc with a red glow. */
export const Bug: React.FC<{
  x: number;
  y: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  size?: number;
}> = ({ x, y, scale = 1, scaleX = 1, scaleY = 1, rotate = 0, size = 56 }) => (
  <div
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: '50%',
      background: C.rose,
      color: C.white,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 0 0 5px ${alpha(C.slate950, 0.8)}, 0 4px 26px ${alpha(C.rose, 0.8)}, 0 0 60px ${alpha(C.rose, 0.45)}`,
      transform: `scale(${scale * scaleX}, ${scale * scaleY}) rotate(${rotate}deg)`,
      zIndex: 5,
    }}
  >
    <Icon name="solar:bug-bold" size={size * 0.58} color={C.white} />
  </div>
);
