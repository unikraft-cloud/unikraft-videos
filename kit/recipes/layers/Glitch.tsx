/** Glitch effects from the promo (videos/promo-30s/scenes/isolation/Glitch.tsx), for the layers recipe. */
import type React from 'react';
import { random, useCurrentFrame } from 'remotion';
import { alpha, C } from '../../design/tokens';

/** Horizontal slice bands for the current glitch tick (re-rolled every 2 frames). */
const slices = (seed: string, tick: number, count: number, intensity: number, maxShift: number) =>
  Array.from({ length: count }, (_, i) => {
    const top = random(`${seed}-top-${i}-${tick}`) * 88;
    const h = 4 + random(`${seed}-h-${i}-${tick}`) * 16;
    const shift = (random(`${seed}-dx-${i}-${tick}`) - 0.5) * 2 * maxShift * intensity;
    return { top, bottom: Math.max(0, 100 - top - h), shift };
  });

/**
 * RGB-split + slice-offset glitch for a run of headline text. `intensity` 0
 * renders the plain text; 1 is a full-on digital tear.
 */
export const GlitchText: React.FC<{
  text: string;
  intensity: number;
  seed: string;
  color: string;
  style?: React.CSSProperties;
}> = ({ text, intensity, seed, color, style }) => {
  const frame = useCurrentFrame();
  const tick = Math.floor(frame / 2);
  const on = intensity > 0.02;
  const split = on ? intensity * (5 + random(`${seed}-split-${tick}`) * 11) : 0;
  const jitter = on ? (random(`${seed}-jit-${tick}`) - 0.5) * 14 * intensity : 0;
  const base: React.CSSProperties = { position: 'absolute', left: 0, top: 0, whiteSpace: 'pre' };
  return (
    <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre', ...style }}>
      <span style={{ color, display: 'inline-block', transform: `translateX(${jitter}px)` }}>{text}</span>
      {on && (
        <>
          <span
            style={{
              ...base,
              color: C.rose,
              opacity: 0.9 * Math.min(1, intensity * 1.4),
              mixBlendMode: 'screen',
              transform: `translate(${-split + jitter}px, ${split * 0.15}px)`,
            }}
          >
            {text}
          </span>
          <span
            style={{
              ...base,
              color: C.logoCyan,
              opacity: 0.55 * Math.min(1, intensity * 1.4),
              mixBlendMode: 'screen',
              transform: `translate(${split * 0.7 + jitter}px, ${-split * 0.1}px)`,
            }}
          >
            {text}
          </span>
          {intensity > 0.35 &&
            slices(seed, tick, 3, intensity, 70).map((s, i) => (
              <span
                key={i}
                style={{
                  ...base,
                  color: i === 1 ? C.rose : C.red,
                  clipPath: `inset(${s.top}% -20% ${s.bottom}% -20%)`,
                  transform: `translateX(${s.shift + jitter}px)`,
                }}
              >
                {text}
              </span>
            ))}
        </>
      )}
    </span>
  );
};

/**
 * Glitches an absolutely laid-out block (e.g. a diagram card) by re-rendering
 * it in a few shifted, rose-tinted slices. Children MUST be absolutely
 * positioned inside a box of `width`×`height`.
 */
export const GlitchBox: React.FC<{
  intensity: number;
  seed: string;
  width: number;
  height: number;
  children: React.ReactNode;
}> = ({ intensity, seed, width, height, children }) => {
  const frame = useCurrentFrame();
  const tick = Math.floor(frame / 2);
  const on = intensity > 0.02;
  const layer: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width, height };
  return (
    <div style={{ position: 'relative', width, height }}>
      <div style={layer}>{children}</div>
      {on &&
        slices(seed, tick, 4, intensity, 46).map((s, i) => (
          <div
            key={i}
            style={{
              ...layer,
              clipPath: `inset(${s.top}% -10% ${s.bottom}% -10%)`,
              transform: `translateX(${s.shift}px)`,
            }}
          >
            {children}
            <div style={{ ...layer, background: alpha(C.rose, 0.18), mixBlendMode: 'screen' }} />
          </div>
        ))}
    </div>
  );
};

/** Stutter envelope: mostly on, occasionally dropping out, decaying over `dur` frames from `at`. */
export const glitchEnvelope = (frame: number, at: number, dur: number, seed: string, peak = 1): number => {
  const t = (frame - at) / dur;
  if (t < 0 || t > 1) {
    return 0;
  }
  // Always fully on for the first frames so the hit reads on the cue.
  const stutter = frame - at < 4 || random(`${seed}-${Math.floor(frame / 2)}`) > 0.3 ? 1 : 0.2;
  return peak * (1 - t) * stutter;
};
