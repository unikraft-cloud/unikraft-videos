import type React from 'react';
import { Icon } from '../../../../kit/design/Icon';
import { checker, hatch, hatchBorder } from '../../../../kit/design/patterns';
import { alpha, C, FONT, mix } from '../../../../kit/design/tokens';

/**
 * Frame-driven port of the site's TcbDiagram column (Security/TcbDiagram):
 * rounded card with a tinted top glow + checker, app boxes on top, the
 * dashed "Trusted Computing Base" envelope, and a Hardware layer. Everything
 * is absolutely positioned in card-local px so bugs can be choreographed
 * against exact box/layer rects.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type StackKind = 'container' | 'vm';

const PAD = 36;
const GAP = 16;
const LAYER_H = 60;
const ZONE_PAD = 14;
const LAYER_GAP = 12;
export const APP_W = 160;
const APP_H = 190;
/** App-box pitch once the VM card has widened to 8 boxes. */
const WIDE_PITCH = (1560 - 2 * PAD - 8 * APP_W) / 7 + APP_W;

export type TcbLayout = { apps: Rect[]; zone: Rect; layers: Rect[]; hardware: Rect };

/**
 * Bottom-anchored stack layout (like the site: Hardware lines up across
 * columns). `spread` 0→1 moves the app boxes from the 4-up pitch to the
 * 8-up pitch used once the VM card takes over the frame.
 */
export const tcbLayout = (kind: StackKind, width: number, height: number, count: number, spread = 0): TcbLayout => {
  const hardware = { x: PAD, y: height - PAD - LAYER_H, w: width - 2 * PAD, h: LAYER_H };
  const n = kind === 'container' ? 2 : 1;
  const zoneH = 2 * ZONE_PAD + n * LAYER_H + (n - 1) * LAYER_GAP;
  const zone = { x: PAD, y: hardware.y - GAP - zoneH, w: width - 2 * PAD, h: zoneH };
  const layers = Array.from({ length: n }, (_, i) => ({
    x: zone.x + ZONE_PAD,
    y: zone.y + ZONE_PAD + i * (LAYER_H + LAYER_GAP),
    w: zone.w - 2 * ZONE_PAD,
    h: LAYER_H,
  }));
  const top = zone.y - GAP - APP_H;
  const narrowPitch = APP_W + GAP;
  const apps = Array.from({ length: count }, (_, i) => ({
    x: PAD + i * (narrowPitch + (WIDE_PITCH - narrowPitch) * spread),
    y: top,
    w: APP_W,
    h: APP_H,
  }));
  return { apps, zone, layers, hardware };
};

export type AppState = {
  /** 0→1 entrance (scale pop). */
  pop: number;
  /** 0→1 compromised (red). */
  infected?: number;
  /** 0→1 hardware boundary lit (solid blue + checker). */
  guard?: number;
  /** Extra flash on top of `guard`/`infected`. */
  flash?: number;
};

type LayerSpec = { label: string; tone: 'neutral' | 'warn' | 'tint'; heat?: number; enter: number };

type Props = {
  kind: StackKind;
  width: number;
  height: number;
  label: React.ReactNode;
  tcb: string;
  loc: string;
  /** Card tone: rose for risk, blue for safe. */
  tone: string;
  locColor: string;
  locGlow?: number;
  apps: AppState[];
  appLabel: (i: number) => string;
  spread?: number;
  layers: LayerSpec[];
  hardwareEnter: number;
  zoneEnter: number;
  /** 0→1 red alarm on the TCB envelope. */
  zoneHeat?: number;
  /** Extra glow on the card border/top (landing, takeover). */
  glow?: number;
  children?: React.ReactNode;
};

const layerStyle = (tone: LayerSpec['tone'], heat: number): React.CSSProperties => {
  if (tone === 'warn') {
    return { ...hatch(C.rose, { line: 40 + 40 * heat, tint: 14 + 30 * heat, stripe: 3, gap: 7 }), borderColor: hatchBorder(C.rose, 48 + 52 * heat) };
  }
  if (tone === 'tint') {
    return { ...hatch(C.blue400, { line: 42, tint: 14, stripe: 3, gap: 7 }), borderColor: hatchBorder(C.blue400, 45) };
  }
  if (heat > 0.01) {
    return { ...hatch(C.rose, { line: 60 * heat, tint: 8 + 30 * heat, stripe: 3, gap: 7 }), borderColor: mix(C.slate700, C.rose, heat) };
  }
  return { backgroundColor: alpha(C.slate900, 0.7), borderColor: alpha(C.slate700, 0.8) };
};

export const TcbCard: React.FC<Props> = ({
  kind,
  width,
  height,
  label,
  tcb,
  loc,
  tone,
  locColor,
  locGlow = 0,
  apps,
  appLabel,
  spread = 0,
  layers,
  hardwareEnter,
  zoneEnter,
  zoneHeat = 0,
  glow = 0,
  children,
}) => {
  const L = tcbLayout(kind, width, height, apps.length, spread);
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
      {/* Checker texture fading in from the top border. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...checker(alpha(tone, 0.32 + 0.2 * glow), 8),
          maskImage: 'radial-gradient(ellipse 72% 42% at 50% 0%, rgba(0,0,0,0.7) 0%, transparent 68%)',
          WebkitMaskImage: 'radial-gradient(ellipse 72% 42% at 50% 0%, rgba(0,0,0,0.7) 0%, transparent 68%)',
        }}
      />

      {/* Meta: label + TCB size. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 34, textAlign: 'center' }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 36, letterSpacing: '-0.02em', color: C.blue50, lineHeight: 1.1 }}>
          {label}
        </div>
        <div style={{ marginTop: 10, fontFamily: FONT.mono, fontSize: 22, color: C.slate500, letterSpacing: '0.01em' }}>
          {tcb}:{' '}
          <strong style={{ color: locColor, fontWeight: 700, textShadow: locGlow > 0 ? `0 0 ${24 * locGlow}px ${alpha(locColor, 0.9 * locGlow)}` : undefined }}>
            {loc}
          </strong>
        </div>
      </div>

      {/* App boxes (c1…c4 / VM1…VM8). */}
      {L.apps.map((r, i) => {
        const a = apps[i];
        const infected = a.infected ?? 0;
        const guard = a.guard ?? 0;
        const flash = a.flash ?? 0;
        const lineColor = guard > 0.01 ? mix(C.slate400, C.blue400, guard) : mix(C.slate400, C.rose, infected);
        const lit = Math.max(guard, infected);
        const accent = kind === 'vm' ? C.blue400 : C.rose;
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
              background: alpha(mix(C.blue400, accent, Math.max(lit, flash)), 0.06 + 0.12 * lit + 0.2 * flash),
              boxShadow: lit > 0.01 ? `0 0 ${(28 + 40 * flash) * lit}px ${alpha(accent, 0.45 * lit + 0.3 * flash)}, inset 0 0 ${24 * lit}px ${alpha(accent, 0.25 * lit)}` : undefined,
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
                  maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(0,0,0,0.9) 0%, transparent 80%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(0,0,0,0.9) 0%, transparent 80%)',
                }}
              />
            )}
            <span
              style={{
                position: 'relative',
                fontFamily: FONT.mono,
                fontWeight: 500,
                fontSize: 24,
                color: guard > 0.5 ? C.blue100 : mix(C.slate300, C.red, infected),
              }}
            >
              {appLabel(i)}
            </span>
            {guard > 0.5 ? (
              <Icon name="solar:shield-check-bold" size={30} color={C.blue200} style={{ position: 'relative', opacity: guard }} />
            ) : (
              <div style={{ width: 20, height: 20, borderRadius: 4, background: mix(C.slate600, C.rose, infected), opacity: 0.8 }} />
            )}
          </div>
        );
      })}

      {/* Trusted Computing Base envelope. */}
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
          top: L.zone.y - 10,
          padding: '0 8px',
          background: C.slate950,
          fontFamily: FONT.mono,
          fontSize: 14,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: zoneHeat > 0.3 ? C.red : C.slate500,
          lineHeight: '20px',
          opacity: zoneEnter,
        }}
      >
        Trusted computing base
      </div>

      {/* Layers inside the envelope + Hardware. */}
      {[...L.layers.map((r, i) => ({ r, spec: layers[i] })), { r: L.hardware, spec: { label: 'Hardware', tone: 'neutral' as const, enter: hardwareEnter } }].map(
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
                fontSize: 24,
                color: heat > 0.3 ? C.white : spec.tone === 'neutral' ? C.slate300 : C.blue50,
                clipPath: spec.enter >= 1 ? undefined : `inset(-40px ${100 - 100 * spec.enter}% -40px -40px)`,
                opacity: Math.min(1, spec.enter * 2),
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
export const Bug: React.FC<{ x: number; y: number; scale?: number; scaleX?: number; scaleY?: number; rotate?: number; size?: number; opacity?: number }> = ({
  x,
  y,
  scale = 1,
  scaleX = 1,
  scaleY = 1,
  rotate = 0,
  size = 56,
  opacity = 1,
}) => (
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
      opacity,
      zIndex: 5,
    }}
  >
    <Icon name="solar:bug-bold" size={size * 0.58} color={C.white} />
  </div>
);
