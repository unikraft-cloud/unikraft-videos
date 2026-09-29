import { noise2D } from '@remotion/noise';
import type React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../design/Backdrop';
import { Chip } from '../../design/Chip';
import { Icon } from '../../design/Icon';
import { clamp, EASE, lerp, pop, progress, scramble, shake } from '../../design/motion';
import { Move, Scramble } from '../../design/Text';
import { alpha, C, SAFE, TYPE } from '../../design/tokens';
import { useScene } from '../../video/SceneContext';
import { GlitchBox, glitchEnvelope, GlitchText } from './Glitch';
import { accentWords, plainText, type LayersProps, type LayersStack, type Word } from './plan';
import { Bug, stackLayout, StackCard, type StackLayout } from './StackCard';

const CARD_W = 760;
const CARD_H = 630;
const CARD_Y = 310;
const LEFT_X = 160;
const RIGHT_X = 1000;
const HEAD_TOP = 166;
const HEAD_MAX = 108;
/** Frames after the split each escaped bug lands in its workload (cycled; unscaled). */
const LAND = [16, 20, 14, 18];

const DEFAULT_APPS = ['app1', 'app2', 'app3', 'app4'];

const jitter = (seed: string, frame: number, amp: number) => ({
  x: noise2D(`${seed}-x`, frame * 0.35, 0) * amp,
  y: noise2D(`${seed}-y`, 0, frame * 0.35) * amp,
});

/** Zig-zag crack across the first shared layer (and down into the next), in card px. */
const crack = (L: StackLayout, cx: number): string[] => {
  const y = L.layers[0].y + L.layers[0].h / 2;
  const span = L.layers[0].w / 2 - 30;
  const step = span / 9;
  const side = (dir: number, seed: string) =>
    Array.from({ length: 9 }, (_, i) => {
      const x = clamp(cx + dir * (i + 1) * step, L.layers[0].x + 12, L.layers[0].x + L.layers[0].w - 12);
      return `${x} ${y + (random(`${seed}-${i}`) - 0.5) * 36}`;
    }).join(' L ');
  const down = [0, 1, 2, 3]
    .map((i) => `${cx + (random(`crack-d-${i}`) - 0.5) * 30} ${y + 18 + i * 22}`)
    .join(' L ');
  return [
    `M ${cx} ${y} L ${side(-1, 'crack-l')}`,
    `M ${cx} ${y} L ${side(1, 'crack-r')}`,
    `M ${cx} ${y} L ${down}`,
  ];
};

const SHARDS = Array.from({ length: 16 }, (_, i) => ({
  vx: (random(`shard-vx-${i}`) - 0.5) * 22,
  vy: -4 - random(`shard-vy-${i}`) * 14,
  size: 5 + random(`shard-s-${i}`) * 9,
  spin: (random(`shard-r-${i}`) - 0.5) * 40,
  color: [C.rose, C.red, C.white][i % 3],
}));

/** Consecutive words with the same accent flag, joined (so a glitch covers the whole run). */
const runs = (words: Word[]): Word[] =>
  words.reduce<Word[]>((out, w) => {
    const last = out[out.length - 1];
    if (last && last.accent === w.accent) {
      last.word += ` ${w.word}`;
    } else {
      out.push({ ...w });
    }
    return out;
  }, []);

/** Headline size that keeps `text` on one line inside the safe area. */
const fitSize = (text: string): number =>
  Math.round(Math.min(HEAD_MAX, (1920 - 2 * SAFE.x) / (plainText(text).length * 0.5)));

const stackShape = (s: LayersStack) => {
  const apps = s.apps ?? DEFAULT_APPS;
  return { apps, layout: stackLayout(CARD_W, CARD_H, apps.length, s.layers.length) };
};

export const Layers: React.FC = () => {
  const f = useCurrentFrame();
  const { props, at, dur, frames, video, scene } = useScene<LayersProps>();
  const { headline, verdict, left, right } = props;
  const zone = props.zone ?? 'Trusted computing base';
  const baseLabel = props.base ?? 'Hardware';
  const H = at('head');
  const S = at('stacks');
  const E = 'escape' in scene.marks ? at('escape') : null;
  const K = 'contain' in scene.marks ? at('contain') : null;
  const V = verdict ? at('verdict') : null;
  const exitQ = progress(f, at('exit'), dur('exit'), EASE.in);
  const q = dur;
  const amp = video.preset.shake;

  const L = stackShape(left);
  const R = stackShape(right);
  const leftRisk = (left.tone ?? 'risk') === 'risk';
  const rightRisk = (right.tone ?? 'safe') === 'risk';

  /* ---------- Camera ---------- */
  const sH = shake(f, H, 16, 12 * amp, 'layers-head');
  const sE = E === null ? { x: 0, y: 0, r: 0 } : shake(f, E, 22, 20 * amp, 'layers-escape');
  const sK = K === null ? { x: 0, y: 0, r: 0 } : shake(f, K, 16, 12 * amp, 'layers-contain');
  const camScale = lerp(1, 1.035, f / frames) * lerp(1, 1.16, exitQ);
  const camX = sH.x * 0.6 + sE.x * 0.35 + sK.x * 0.4;
  const camY = sH.y * 0.6 + sE.y * 0.35 + sK.y * 0.4;

  /* ---------- Headline → verdict ---------- */
  const slam = progress(f, H, q(12), EASE.out);
  const headIn = progress(f, H - 2, 6, EASE.out);
  const glitchHead =
    E === null ? 0 : Math.max(glitchEnvelope(f, H, q(18), 'lh0'), glitchEnvelope(f, E, q(12), 'lh1', 0.9));
  const headOut = V === null ? 0 : progress(f, V - q(8), q(10), EASE.in);
  const headSize = fitSize(headline);
  const verdictWords = verdict ? accentWords(verdict) : [];
  const verdictSize = verdict ? fitSize(verdict) : 0;

  /* ---------- Cards in ---------- */
  const inL = progress(f, S - q(4), q(20), EASE.out);
  const inR = progress(f, S - q(1), q(20), EASE.out);
  const dimL =
    K === null || E === null ? 0 : progress(f, K - q(24), q(16)) * (1 - progress(f, K + q(30), q(20)));
  const enterLayers = (s: LayersStack, heat: (i: number) => number) =>
    s.layers.map((l, i) => ({
      label: l.label,
      tone: l.tone ?? 'neutral',
      enter: progress(f, S + q(3 + 2 * i), q(12)),
      heat: heat(i),
    }));

  /* ---------- Escape (left) ---------- */
  const lSrc = Math.min(1, L.apps.length - 1);
  const lAppX = L.layout.apps.map((r) => r.x + r.w / 2);
  /** Bug rest height inside a workload box: over the glyph, below the label. */
  const lAppY = L.layout.apps[0].y + L.layout.apps[0].h / 2 + 32;
  const topY = L.layout.layers[0].y + L.layout.layers[0].h / 2;
  const lastLayer = L.layout.layers[L.layout.layers.length - 1];
  const bottomY = lastLayer.y + lastLayer.h / 2;
  const split = E === null ? 0 : E + q(8);
  const landAt = (j: number) => split + q(LAND[j % LAND.length]);
  const zoneHeat = E === null ? 0 : progress(f, E, 8);
  const redAlarm = zoneHeat * (1 - 0.5 * dimL) * (1 - exitQ);
  const layerHeat = (i: number) => {
    if (E === null) {
      return 0;
    }
    const from = E + (i === 0 ? 0 : q(4));
    return f < from ? 0 : Math.max(1 - progress(f, from, 18), 0.55 + 0.15 * Math.sin(f * 0.5 + i));
  };
  const leftApps = L.apps.map((label, i) => {
    const land = i === lSrc ? (E ?? 0) - q(8) : landAt(i);
    return {
      label,
      pop: clamp(pop(f, S + q(1 + 2 * i)), 0, 1.2),
      infected: E === null ? 0 : progress(f, land, i === lSrc ? q(8) : 4),
      flash:
        E === null
          ? 0
          : i === lSrc
            ? f >= E
              ? 1 - progress(f, E, 12)
              : 0
            : f >= landAt(i)
              ? 1 - progress(f, landAt(i), 14)
              : 0,
    };
  });
  const cardGlitch =
    E === null
      ? 0
      : Math.max(glitchEnvelope(f, E, q(16), 'lcard0'), glitchEnvelope(f, split + q(8), 8, 'lcard1', 0.5));

  type BugPose = { x: number; y: number; scale: number; sx: number; sy: number; rot: number };
  let leftBugs: BugPose[] = [];
  if (E !== null && f >= E - q(18)) {
    if (f < split) {
      const restY = lAppY;
      let y = restY;
      let sx = 1;
      let sy = 1;
      if (f >= E - q(6) && f < E - q(3)) {
        const t = progress(f, E - q(6), q(3), EASE.out);
        y = restY - 20 * t;
        sx = 1 + 0.15 * t;
        sy = 1 - 0.18 * t;
      } else if (f >= E - q(3) && f < E) {
        y = lerp(restY - 20, topY, progress(f, E - q(3), q(3), EASE.in));
        sx = 0.82;
        sy = 1.3;
      } else if (f >= E) {
        y = lerp(topY, bottomY, progress(f, E, q(6), EASE.out));
        const squash = 1 - progress(f, E, 8);
        sx = 1 + 0.35 * squash;
        sy = 1 - 0.3 * squash;
      }
      const j = jitter('lbug', f, f < E - q(6) ? 3 : 6);
      leftBugs = [
        {
          x: lAppX[lSrc] + j.x,
          y: y + (f < E - q(3) ? j.y : 0),
          scale: clamp(pop(f, E - q(18)), 0, 1.3),
          sx,
          sy,
          rot: f < E - q(3) ? 0 : noise2D('lbug-rot', f * 0.4, 0) * 18,
        },
      ];
    } else {
      leftBugs = lAppX.map((tx, j) => {
        const t = progress(f, split, landAt(j) - split, EASE.inOut);
        const landed = f >= landAt(j);
        const settle = landed ? 1 - progress(f, landAt(j), 10) : 0;
        const jj = jitter(`lbug-${j}`, f, landed ? 5 : 0);
        return {
          x: lerp(lAppX[lSrc], tx, t) + jj.x,
          y: lerp(bottomY, lAppY, t) - 150 * Math.sin(Math.PI * t) + jj.y,
          scale: j === lSrc ? 1 : lerp(0.5, 1, progress(f, split, 5)),
          sx: 1 + 0.3 * settle,
          sy: 1 - 0.25 * settle,
          rot: landed
            ? noise2D(`lbug-r${j}`, f * 0.3, 0) * 14
            : (tx - lAppX[lSrc]) * 0.08 * Math.sin(Math.PI * t),
        };
      });
    }
  }
  const cracks = crack(L.layout, lAppX[lSrc]);
  const crackDraw = E === null ? 0 : progress(f, E, q(7), EASE.out);
  const crackFade = E === null || f < E ? 0 : lerp(1, 0.55, progress(f, E + q(10), 20));

  /* ---------- Contained (right) ---------- */
  const rSrc = Math.min(1, R.apps.length - 1);
  const box = R.layout.apps[rSrc];
  const bcx = box.x + box.w / 2;
  const bcy = box.y + box.h / 2;
  const contact = box.w / 2 - 30;
  const clangFlash = K !== null && f >= K ? 1 - progress(f, K, 20) : 0;
  const rightApps = R.apps.map((label, i) => {
    const wave = K === null ? 0 : progress(f, K + q(6) + i * q(3), q(10));
    const hit = i === rSrc && K !== null ? progress(f, K, 2) : 0;
    const waveAt = K === null ? 0 : K + q(6) + i * q(3);
    return {
      label,
      pop: clamp(pop(f, S + q(4 + 2 * i)), 0, 1.2),
      guard: Math.max(wave, hit),
      flash:
        (i === rSrc ? clangFlash : 0) + (K !== null && f >= waveAt ? 0.6 * (1 - progress(f, waveAt, 12)) : 0),
    };
  });
  let vdx = 0;
  let vsx = 1;
  let vsy = 1;
  let vrot = 0;
  if (K !== null) {
    if (f >= K - q(13) && f < K - q(8)) {
      const t = progress(f, K - q(13), q(5), EASE.out);
      vdx = -28 * t;
      vsx = 1 - 0.12 * t;
      vsy = 1 + 0.1 * t;
    } else if (f >= K - q(8) && f < K) {
      const t = progress(f, K - q(8), q(8), EASE.in);
      vdx = lerp(-28, contact, t);
      vsx = 1 + 0.25 * t;
      vsy = 1 - 0.15 * t;
    } else if (f >= K) {
      vdx = lerp(contact, 0, pop(f, K, { damping: 9, stiffness: 160 }));
      const squash = 1 - progress(f, K, 8);
      vsx = 1 - 0.35 * squash;
      vsy = 1 + 0.25 * squash;
      vrot = Math.sin((f - K) * 0.55) * 28 * (1 - progress(f, K, 40));
    }
  }
  const vj = jitter('rbug', f, K !== null && f < K ? 3 : 4);
  const wallX = box.x + box.w;
  const contactY = bcy + 32 + vj.y;

  /* ---------- Render ---------- */
  const headlineEl = (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: HEAD_TOP,
        textAlign: 'center',
        ...TYPE.display,
        fontSize: headSize,
        color: C.slate300,
        transform: `translateY(${-50 * headOut}px) scale(${1 + 0.18 * (1 - slam)})`,
        filter: headOut > 0.02 ? `blur(${8 * headOut}px)` : undefined,
        opacity: headIn * (1 - headOut),
        whiteSpace: 'pre',
      }}
    >
      {runs(accentWords(headline)).map((r, i, all) => {
        const text = i < all.length - 1 ? `${r.word} ` : r.word;
        if (!r.accent) {
          return <span key={i}>{text}</span>;
        }
        return E === null ? (
          <span key={i} style={{ color: C.blue400 }}>
            {text}
          </span>
        ) : (
          <GlitchText key={i} text={text} intensity={glitchHead} seed={`lh-${i}`} color={C.red} />
        );
      })}
    </div>
  );

  const verdictEl = V !== null && f >= V - q(6) && (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: HEAD_TOP,
        textAlign: 'center',
        ...TYPE.display,
        fontSize: verdictSize,
        color: C.slate300,
        whiteSpace: 'pre',
      }}
    >
      {verdictWords.map((w, i) => (
        <span key={i}>
          <Move
            inline
            at={V - q(2) + i * 3}
            duration={q(16)}
            from={{ opacity: 0, y: 0.45, blur: 8 }}
            unit="em"
            style={{ color: w.accent ? C.blue400 : undefined }}
          >
            {w.word}
          </Move>
          {i < verdictWords.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );

  const leftCard = (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: CARD_W,
        height: CARD_H,
        transform: `translate(${LEFT_X + sE.x + sH.x * 0.4}px, ${CARD_Y + lerp(90, 0, inL) + sE.y}px) rotateX(${lerp(26, 0, inL)}deg) rotate(${sE.r}deg) scale(${lerp(0.94, 1, inL) * (1 - 0.03 * dimL)})`,
        transformOrigin: '50% 100%',
        opacity: inL * lerp(1, 0.6, dimL),
      }}
    >
      <GlitchBox intensity={cardGlitch} seed="lcard" width={CARD_W} height={CARD_H}>
        <StackCard
          width={CARD_W}
          height={CARD_H}
          layout={L.layout}
          risk={leftRisk}
          title={<Scramble text={left.title} at={S + q(2)} duration={dur('decode')} seed="ltitle" />}
          stat={left.stat}
          statGlow={E === null ? 0 : progress(f, E + q(4), 10) * (0.7 + 0.3 * Math.sin(f * 0.4))}
          apps={leftApps}
          layers={enterLayers(left, layerHeat)}
          base={{ label: baseLabel, tone: 'neutral', enter: progress(f, S + q(1), q(12)) }}
          zone={zone}
          zoneEnter={progress(f, S + q(6), q(10))}
          zoneHeat={zoneHeat}
          glow={zoneHeat * 0.6}
        >
          {E !== null && (
            <svg
              width={CARD_W}
              height={CARD_H}
              style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
            >
              {cracks.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  pathLength={1}
                  fill="none"
                  stroke={i === 2 ? C.red : C.white}
                  strokeWidth={i === 2 ? 3 : 2.5}
                  strokeLinejoin="round"
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - crackDraw}
                  opacity={crackFade}
                  style={{ filter: `drop-shadow(0 0 6px ${C.rose})` }}
                />
              ))}
            </svg>
          )}
          {leftBugs.map((b, i) => (
            <Bug key={i} x={b.x} y={b.y} scale={b.scale} scaleX={b.sx} scaleY={b.sy} rotate={b.rot} />
          ))}
        </StackCard>
      </GlitchBox>
      {E !== null &&
        f >= E &&
        f < E + 30 &&
        SHARDS.map((s, i) => {
          const t = f - E;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: lAppX[lSrc] + s.vx * t,
                top: topY + s.vy * t + 0.55 * t * t,
                width: s.size,
                height: s.size,
                background: s.color,
                transform: `rotate(${s.spin * t}deg)`,
                opacity: 1 - t / 30,
                boxShadow: `0 0 10px ${alpha(C.rose, 0.8)}`,
              }}
            />
          );
        })}
      {E !== null && left.badge && f >= E + 2 && (
        <div
          style={{
            position: 'absolute',
            left: CARD_W / 2,
            top: 0,
            transform: `translate(-50%, -50%) scale(${pop(f, E + 2, { damping: 11 })})`,
          }}
        >
          <Chip
            label={scramble(left.badge, progress(f, E + 2, q(16), EASE.linear), f, 'lbadge')}
            icon="solar:bug-bold"
            tone="red"
            mono
            size={24}
            glow={0.6 + 0.4 * (1 - progress(f, E + 2, 20))}
            style={{
              background: alpha(C.slate950, 0.92),
              minWidth: left.badge.length * 16 + 90,
              justifyContent: 'flex-start',
            }}
          />
        </div>
      )}
    </div>
  );

  const rightCard = (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: CARD_W,
        height: CARD_H,
        transform: `translate(${RIGHT_X + sK.x}px, ${CARD_Y + lerp(90, 0, inR) + sK.y}px) rotateX(${lerp(26, 0, inR)}deg) rotate(${sK.r}deg) scale(${lerp(0.94, 1, inR)})`,
        transformOrigin: '50% 100%',
        opacity: inR,
      }}
    >
      <StackCard
        width={CARD_W}
        height={CARD_H}
        layout={R.layout}
        risk={rightRisk}
        title={<Scramble text={right.title} at={S + q(4)} duration={dur('decode')} seed="rtitle" />}
        stat={right.stat}
        statGlow={K === null ? 0 : progress(f, K, 10)}
        apps={rightApps}
        layers={enterLayers(right, () => 0)}
        base={{ label: baseLabel, tone: 'neutral', enter: progress(f, S + q(4), q(12)) }}
        zone={zone}
        zoneEnter={progress(f, S + q(9), q(10))}
        glow={clangFlash * 0.9}
      >
        {K !== null &&
          [0, 5, 10].map((d) => {
            const t = progress(f, K + d, 24, EASE.out);
            return (
              f >= K + d &&
              t < 1 && (
                <div
                  key={d}
                  style={{
                    position: 'absolute',
                    left: box.x,
                    top: box.y,
                    width: box.w,
                    height: box.h,
                    borderRadius: 14,
                    border: `3px solid ${C.blue200}`,
                    boxShadow: `0 0 24px ${alpha(C.blue400, 0.7)}`,
                    transform: `scale(${1 + 0.55 * t}, ${1 + 0.35 * t})`,
                    opacity: (1 - t) * 0.9,
                  }}
                />
              )
            );
          })}
        {clangFlash > 0 && (
          <div
            style={{
              position: 'absolute',
              left: wallX - 3,
              top: box.y + 8,
              width: 6,
              height: box.h - 16,
              borderRadius: 3,
              background: C.blue50,
              boxShadow: `0 0 18px ${C.blue200}, 0 0 60px ${C.blue400}`,
              opacity: clangFlash,
            }}
          />
        )}
        {K !== null &&
          f >= K &&
          f < K + 14 &&
          Array.from({ length: 9 }, (_, i) => {
            const t = progress(f, K, 14, EASE.out);
            const ang = (-80 + i * 20) * (Math.PI / 180) + Math.PI;
            const r0 = 10 + 50 * t;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: wallX + Math.cos(ang) * r0,
                  top: contactY + Math.sin(ang) * r0,
                  width: 34 * (1 - t) + 6,
                  height: 3,
                  borderRadius: 2,
                  background: C.blue100,
                  boxShadow: `0 0 10px ${C.blue400}`,
                  transform: `rotate(${(ang * 180) / Math.PI}deg)`,
                  transformOrigin: '0 50%',
                  opacity: 1 - t,
                }}
              />
            );
          })}
        {K !== null && f >= K - q(21) && (
          <Bug
            x={bcx + vdx + (f < K && f >= K - q(8) ? 0 : vj.x)}
            y={contactY}
            scale={clamp(pop(f, K - q(21)), 0, 1.3)}
            scaleX={vsx}
            scaleY={vsy}
            rotate={vrot}
          />
        )}
        {K !== null && f >= K && (
          <div
            style={{
              position: 'absolute',
              left: wallX - 34,
              top: box.y - 12,
              transform: `scale(${clamp(pop(f, K, { damping: 10, stiffness: 260 }), 0, 1.4) * (1 - progress(f, K + 24, 10, EASE.in))})`,
              filter: `drop-shadow(0 0 16px ${C.blue400})`,
            }}
          >
            <Icon name="solar:shield-check-bold" size={68} color={C.blue100} />
          </div>
        )}
      </StackCard>
      {K !== null && right.badge && f >= K + 1 && (
        <div
          style={{
            position: 'absolute',
            left: CARD_W / 2,
            top: 0,
            transform: `translate(-50%, -50%) scale(${pop(f, K + 1, { damping: 11, stiffness: 340 })})`,
          }}
        >
          <Chip
            label={right.badge}
            icon="solar:shield-check-bold"
            tone="blue"
            mono
            size={24}
            glow={0.5 + 0.5 * clangFlash}
            style={{ background: alpha(C.slate950, 0.92) }}
          />
        </div>
      )}
    </div>
  );

  const headFlash = 1 - progress(f, H, 8);
  const escFlash = E !== null && f >= E ? 1 - progress(f, E, 10) : 0;
  return (
    <Backdrop
      variant="tintC"
      aura={1 + 0.5 * clangFlash}
      auraY={60}
      grid={0.05}
      gridOffset={{ x: -f * 0.4, y: f * 0.25 }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 34% 44% at 28% 62%, ${alpha(C.rose, 0.28 * redAlarm)} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${camX}px, ${camY}px) scale(${camScale})`,
          filter: exitQ > 0.02 ? `blur(${10 * exitQ}px)` : undefined,
          opacity: 1 - exitQ,
        }}
      >
        <AbsoluteFill style={{ perspective: 1800 }}>
          {leftCard}
          {rightCard}
        </AbsoluteFill>
        {headlineEl}
        {verdictEl}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background:
            f < H + 8
              ? `radial-gradient(ellipse 60% 30% at 50% 20%, ${alpha(E === null ? C.blue400 : C.rose, 0.3 * headFlash * (f >= H ? 1 : 0))} 0%, transparent 100%)`
              : K !== null && f >= K
                ? alpha(C.blue400, 0.2 * clangFlash)
                : alpha(C.rose, 0.26 * escFlash),
          mixBlendMode: 'screen',
        }}
      />
    </Backdrop>
  );
};
