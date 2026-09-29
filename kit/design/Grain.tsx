import type React from 'react';
import { useMemo } from 'react';
import { AbsoluteFill, Img, random, useCurrentFrame, useVideoConfig } from 'remotion';

const TILE = 512;

/**
 * Film grain + dither: one seeded noise tile (generated once per tab),
 * tiled with <Img> and re-positioned every frame. Besides texture, it breaks
 * up the 8-bit banding the dark navy gradients would otherwise show in H.264.
 */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const tile = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Grain: 2D canvas unavailable');
    }
    const img = ctx.createImageData(TILE, TILE);
    // LCG: deterministic and fast enough for 262k pixels.
    let seed = 0x2f6b1d;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const v = seed >>> 24;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }, []);

  const ox = Math.floor(random(`gx-${frame}`) * TILE);
  const oy = Math.floor(random(`gy-${frame}`) * TILE);
  const cols = Math.ceil(width / TILE) + 1;
  const rows = Math.ceil(height / TILE) + 1;

  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'overlay', pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -ox, top: -oy, width: cols * TILE, height: rows * TILE }}>
        {Array.from({ length: cols * rows }, (_, i) => (
          <Img
            key={i}
            src={tile}
            style={{
              position: 'absolute',
              left: (i % cols) * TILE,
              top: Math.floor(i / cols) * TILE,
              width: TILE,
              height: TILE,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
