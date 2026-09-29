import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Icon } from '../../../kit/design/Icon';
import type { IconName } from '../../../kit/design/icons-data';
import { EASE, lerp, pop, progress, scramble, shake } from '../../../kit/design/motion';
import { AccentText, Move } from '../../../kit/design/Text';
import { alpha, C, FONT, SAFE, TYPE } from '../../../kit/design/tokens';
import { pointOnPath, Wire } from '../../../kit/design/Wire';
import { useScene } from '../../../kit/video/SceneContext';

/**
 * A custom scene — the pattern to copy when no recipe fits.
 *
 * All timing comes from the scene's `marks` in timeline.ts through `useScene().at()`,
 * so the cues and the pacing check read the same numbers as the animation. Motion
 * durations come from `dur()`; nothing here knows the tempo.
 *
 *   headline  headline slams in                     (cue: whoosh at 0)
 *   nodes     request → cloud → app cards pop, wires draw (blip)
 *   pulse     a request travels the wires
 *   wake      the sleeping app wakes: glow, RUNNING    (hit)
 *   caption   "idle → serving" decodes under it       (blip)
 *
 * Copy comes in as scene `props` (plain data in timeline.ts), next to the `reads`
 * that budget it.
 */

export type FlowProps = { headline: string; caption: string };

const CARD = { w: 380, h: 150, y: 560 };
const NODES: readonly { x: number; label: string; icon: IconName }[] = [
  { x: 330, label: 'Request', icon: 'solar:global-bold' },
  { x: 960, label: 'Unikraft Cloud', icon: 'solar:cloud-bold' },
  { x: 1590, label: 'Your app', icon: 'solar:moon-sleep-bold' },
];
const WIRES = [0, 1].map(
  (i) => `M${NODES[i].x + CARD.w / 2},${CARD.y} L${NODES[i + 1].x - CARD.w / 2},${CARD.y}`,
);

export const Flow: React.FC = () => {
  const frame = useCurrentFrame();
  const { at, dur, frames, video, props } = useScene<FlowProps>();
  const nodesAt = at('nodes');
  const pulseAt = at('pulse');
  const wakeAt = at('wake');
  const captionAt = at('caption');
  const exitAt = at('exit');

  const awake = progress(frame, wakeAt, dur('enter'), EASE.out);
  const pulse = progress(frame, pulseAt, wakeAt - pulseAt, EASE.inOut);
  const hit = shake(frame, wakeAt, 16, 8 * video.preset.shake, 'flow-wake');
  const exit = progress(frame, exitAt, dur('exit'), EASE.in);
  const push = lerp(1, 1.03, progress(frame, 0, frames, EASE.linear));
  const dot = pulse > 0 && pulse < 1 ? pointOnPath(WIRES[pulse < 0.5 ? 0 : 1], (pulse * 2) % 1) : null;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Backdrop
        variant="tintB"
        aura={0.8 + awake * 0.8}
        auraX={82}
        auraY={60}
        grid={0.05}
        gridOffset={{ x: 0, y: -frame * 0.2 }}
      />
      <AbsoluteFill
        style={{
          transform: `translate(${hit.x}px, ${hit.y - exit * 40}px) scale(${push})`,
          opacity: 1 - exit,
          filter: exit > 0.02 ? `blur(${exit * 12}px)` : undefined,
        }}
      >
        <Move
          at={at('headline')}
          duration={dur('enter')}
          from={{ opacity: 0, scale: 1.3, blur: 18, x: -30 }}
          origin="0% 50%"
          style={{ position: 'absolute', left: SAFE.x, top: 230 }}
        >
          <div style={{ ...TYPE.display, fontSize: 104, color: C.slate300, whiteSpace: 'nowrap' }}>
            <AccentText text={props.headline} />
          </div>
        </Move>

        <svg width={1920} height={1080} style={{ position: 'absolute', overflow: 'visible' }}>
          {WIRES.map((d, i) => (
            <Wire
              key={d}
              d={d}
              progress={progress(frame, nodesAt + 6 + i * 4, dur('draw'), EASE.inOut)}
              color={C.slate700}
              width={3}
            />
          ))}
          {WIRES.map((d, i) => {
            const p = pulse * 2 - i;
            return p > 0 && <Wire key={`lit-${d}`} d={d} progress={p} color={C.blue400} width={4} glow={1} />;
          })}
          {dot && (
            <circle
              cx={dot.x}
              cy={dot.y}
              r={10}
              fill={C.blue50}
              style={{ filter: `drop-shadow(0 0 14px ${C.blue400})` }}
            />
          )}
        </svg>

        {NODES.map((n, i) => {
          const isApp = i === NODES.length - 1;
          const on = isApp ? awake : 1;
          const p = pop(frame, nodesAt + i * 4, { damping: 13 });
          return (
            <div
              key={n.label}
              style={{
                position: 'absolute',
                left: n.x - CARD.w / 2,
                top: CARD.y - CARD.h / 2,
                width: CARD.w,
                height: CARD.h,
                borderRadius: 14,
                border: `2px ${isApp && on < 0.5 ? 'dashed' : 'solid'} ${on > 0.5 ? C.blue200 : C.slate700}`,
                background: alpha(on > 0.5 ? C.blue400 : C.slate900, on > 0.5 ? 0.14 : 0.8),
                boxShadow: on > 0.02 && isApp ? `0 0 ${70 * on}px ${alpha(C.blue400, 0.55 * on)}` : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: 22,
                padding: '0 32px',
                opacity: p,
                transform: `scale(${lerp(0.85, 1, p)})`,
              }}
            >
              <Icon
                name={isApp && on > 0.5 ? 'solar:bolt-bold' : n.icon}
                size={52}
                color={on > 0.5 ? C.blue100 : C.slate500}
              />
              <div>
                <div style={{ ...TYPE.title, fontSize: 38, color: on > 0.5 ? C.slate50 : C.slate400 }}>
                  {n.label}
                </div>
                {isApp && (
                  <div
                    style={{
                      ...TYPE.eyebrow,
                      fontSize: 22,
                      marginTop: 8,
                      color: on > 0.5 ? C.green : C.slate600,
                    }}
                  >
                    {on > 0.5 ? '● running' : '○ idle · $0'}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: CARD.y + CARD.h / 2 + 90,
            textAlign: 'center',
            fontFamily: FONT.mono,
            fontSize: 40,
            color: C.blue100,
            letterSpacing: '0.02em',
          }}
        >
          {scramble(
            props.caption,
            progress(frame, captionAt, dur('decode') * 2, EASE.linear),
            frame,
            'flow-caption',
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
