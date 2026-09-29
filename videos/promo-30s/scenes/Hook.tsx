import type React from 'react';
import { AbsoluteFill, random, useCurrentFrame } from 'remotion';
import { Backdrop } from '../../../kit/design/Backdrop';
import { Checkbox } from '../../../kit/design/Checkbox';
import { EASE, lerp, pop, progress, scramble, shake } from '../../../kit/design/motion';
import { beats } from '../timeline';
import { Move } from '../../../kit/design/Text';
import { alpha, C, FONT, mix, TYPE } from '../../../kit/design/tokens';
import { Wire } from '../../../kit/design/Wire';

/**
 * 01 · THE TENSION (8 beats).
 * "Fast. Safe. Cheap." slam in on b1/b2/b3 while a trade-off triangle wires
 * itself up. On b4 only two boxes may be ticked — `// pick two.` On b6 the
 * frame glitches, the rule is struck out and rewritten to `// pick all
 * three.`, and the triangle fills with the brand checkerboard. From b6.5 the
 * camera dives into it; the logo sting picks up from the checker field.
 */

const WORDS = ['Fast.', 'Safe.', 'Cheap.'] as const;
const WORD_AT = [beats(1), beats(2), beats(3)];
const PICK_TWO_AT = beats(4);
const TYPE_AT = beats(4.5);
const GLITCH_AT = beats(6);
const DIVE_AT = beats(6.5);
const END = beats(8);

// Trade-off triangle, in frame coordinates.
const TRI = {
  fast: { x: 1405, y: 262, label: 'FAST', anchor: 'top' },
  safe: { x: 1128, y: 742, label: 'SAFE', anchor: 'bottom' },
  cheap: { x: 1682, y: 742, label: 'CHEAP', anchor: 'bottom' },
} as const;
const CENTROID = { x: (TRI.fast.x + TRI.safe.x + TRI.cheap.x) / 3, y: (TRI.fast.y + TRI.safe.y + TRI.cheap.y) / 3 };
const VERTICES = [TRI.fast, TRI.safe, TRI.cheap];

const FONT_SIZE = 204;
const LINE = FONT_SIZE * 0.93;
const TEXT_X = 236;
const TEXT_Y = 214;

/** Horizontal-slice displacement + chromatic split, active while `amount` > 0. */
const Glitch: React.FC<{ amount: number; frame: number; children: React.ReactNode }> = ({ amount, frame, children }) => {
  if (amount <= 0.001) {
    return <>{children}</>;
  }
  const tick = Math.floor(frame / 2);
  const bands = 7;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${-14 * amount}px)`, opacity: 0.8, mixBlendMode: 'screen', filter: 'url(#hook-red)' }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${14 * amount}px)`, opacity: 0.8, mixBlendMode: 'screen', filter: 'url(#hook-cyan)' }}>
        {children}
      </AbsoluteFill>
      {Array.from({ length: bands }, (_, i) => {
        const top = (i / bands) * 100;
        const offset = (random(`glitch-${i}-${tick}`) - 0.5) * 120 * amount;
        return (
          <AbsoluteFill
            key={i}
            style={{
              clipPath: `inset(${top}% 0 ${100 - top - 100 / bands}% 0)`,
              transform: `translateX(${offset}px)`,
            }}
          >
            {children}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();

  // Camera: slow push the whole time, then a hard dive into the triangle.
  const dive = progress(frame, DIVE_AT, END - DIVE_AT, EASE.in);
  const drift = progress(frame, 0, DIVE_AT, EASE.linear);
  const hits = [...WORD_AT, GLITCH_AT].map((at, i) => shake(frame, at, 16, i === 3 ? 22 : 9, `hook-${i}`));
  const sx = hits.reduce((a, h) => a + h.x, 0);
  const sy = hits.reduce((a, h) => a + h.y, 0);
  const zoom = lerp(1, 1.035, drift) * lerp(1, 5.5, dive);
  // During the dive, bring the triangle's centre to frame centre (the logo sting is centred).
  const panX = lerp(0, 960 - CENTROID.x, dive);
  const panY = lerp(0, 540 - CENTROID.y, dive);

  const pickTwo = progress(frame, PICK_TWO_AT, 10, EASE.out);
  const glitch = frame >= GLITCH_AT && frame < GLITCH_AT + 9 ? 1 - (frame - GLITCH_AT) / 9 : 0;
  const allThree = progress(frame, GLITCH_AT + 4, 12, EASE.out);
  const cheapDenied = pickTwo * (1 - allThree);

  const comment = frame < GLITCH_AT + 5 ? '// pick two.' : '// pick all three.';
  const commentP =
    frame < GLITCH_AT + 5
      ? progress(frame, TYPE_AT, 26, EASE.linear)
      : progress(frame, GLITCH_AT + 5, 16, EASE.linear);
  const commentStrike = frame < GLITCH_AT + 5 ? progress(frame, GLITCH_AT, 5, EASE.out) : 0;

  const wordsOut = progress(frame, DIVE_AT, 30, EASE.in);
  const flash = progress(frame, END - 10, 10, EASE.in);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="hook-red">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
        <filter id="hook-cyan">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />
        </filter>
      </svg>

      <Backdrop
        variant="tintC"
        aura={1.1 + allThree * 0.9}
        auraX={70}
        auraY={52}
        grid={0.05 * progress(frame, -8, 16, EASE.standard)}
        gridOffset={{ x: -frame * 0.25, y: 0 }}
      />

      <AbsoluteFill
        style={{
          transform: `translate(${sx + panX}px, ${sy + panY}px) scale(${zoom})`,
          transformOrigin: `${CENTROID.x}px ${CENTROID.y}px`,
        }}
      >
        <Glitch amount={glitch} frame={frame}>
          {/* Trade-off triangle */}
          <AbsoluteFill>
            <svg width={1920} height={1080} style={{ position: 'absolute', overflow: 'visible' }}>
              <defs>
                <pattern id="hook-checker" width={16} height={16} patternUnits="userSpaceOnUse">
                  <rect width={8} height={8} fill={C.blue400} />
                  <rect x={8} y={8} width={8} height={8} fill={C.blue400} />
                </pattern>
                <radialGradient id="hook-fill-fade" cx="50%" cy="60%" r="60%">
                  <stop offset="0" stopColor={C.white} stopOpacity={1} />
                  <stop offset="1" stopColor={C.white} stopOpacity={0.25} />
                </radialGradient>
                <mask id="hook-fill-mask">
                  <polygon
                    points={VERTICES.map((v) => `${v.x},${v.y}`).join(' ')}
                    fill="url(#hook-fill-fade)"
                  />
                </mask>
              </defs>

              {/* checker solution space */}
              <rect
                x={0}
                y={0}
                width={1920}
                height={1080}
                fill="url(#hook-checker)"
                mask="url(#hook-fill-mask)"
                opacity={allThree * lerp(0.42, 1, dive)}
              />

              {VERTICES.map((a, i) => {
                const b = VERTICES[(i + 1) % 3];
                const toCheap = a === TRI.cheap || b === TRI.cheap;
                // Pre-rolled so the very first frame of the video already shows the wireframe forming.
                const draw = progress(frame, i * 5 - 10, 24, EASE.inOut);
                const lit = toCheap ? allThree : Math.max(pickTwo, allThree);
                const d = `M${a.x},${a.y} L${b.x},${b.y}`;
                return (
                  <g key={a.label}>
                    <Wire d={d} progress={draw} color={C.slate700} width={2} />
                    {toCheap && cheapDenied > 0.01 && (
                      <Wire d={d} progress={1} color={C.rose} width={2.5} dashed opacity={cheapDenied * 0.9} />
                    )}
                    {lit > 0.01 && <Wire d={d} progress={lit} color={C.blue400} width={4} glow={1} />}
                  </g>
                );
              })}
            </svg>

            {VERTICES.map((v, i) => {
              const on = pop(frame, WORD_AT[i], { damping: 11 });
              const denied = v === TRI.cheap ? cheapDenied : 0;
              const size = 34;
              return (
                <div key={v.label}>
                  <div
                    style={{
                      position: 'absolute',
                      left: v.x - size / 2,
                      top: v.y - size / 2,
                      width: size,
                      height: size,
                      borderRadius: 8,
                      border: `3px solid ${denied > 0.2 ? C.rose : on > 0.5 ? C.blue200 : C.slate600}`,
                      background: on > 0.02 ? alpha(denied > 0.2 ? C.rose : C.blue400, 0.25 + 0.75 * on * (1 - denied * 0.7)) : C.black,
                      boxShadow: on > 0.02 ? `0 0 ${40 * on}px ${alpha(denied > 0.2 ? C.rose : C.blue400, 0.8 * on)}` : undefined,
                      transform: `scale(${progress(frame, i * 5 - 4, 10, EASE.back) * lerp(1, 1.25, on * (1 - progress(frame, WORD_AT[i] + 6, 14)))})`,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: v.x - 200,
                      width: 400,
                      top: v.anchor === 'top' ? v.y - 74 : v.y + 34,
                      textAlign: 'center',
                      ...TYPE.eyebrow,
                      fontSize: 26,
                      letterSpacing: '0.14em',
                      color: denied > 0.2 ? C.red : on > 0.5 ? C.blue100 : C.slate600,
                    }}
                  >
                    {scramble(v.label, progress(frame, i * 5 - 2, 16, EASE.linear), frame, v.label)}
                  </div>
                </div>
              );
            })}
          </AbsoluteFill>

          {/* Fast. Safe. Cheap. */}
          <AbsoluteFill
            style={{
              transform: `translateX(${lerp(0, -260, wordsOut)}px)`,
              opacity: 1 - wordsOut,
              filter: wordsOut > 0.02 ? `blur(${wordsOut * 14}px)` : undefined,
            }}
          >
            {WORDS.map((word, i) => {
              const isCheap = i === 2;
              const checked = isCheap
                ? progress(frame, GLITCH_AT + 4, 8, EASE.out)
                : progress(frame, PICK_TWO_AT + i * 4, 8, EASE.out);
              const denied = isCheap ? cheapDenied : 0;
              const blueFlash = progress(frame, GLITCH_AT + 6 + i * 3, 6, EASE.out) * (1 - progress(frame, GLITCH_AT + 14 + i * 3, 18, EASE.standard));
              return (
                <div
                  key={word}
                  style={{ position: 'absolute', left: 120, top: TEXT_Y + i * LINE, height: LINE, display: 'flex', alignItems: 'center' }}
                >
                  <Move at={WORD_AT[i] - 2} duration={6} from={{ opacity: 0, scale: 0.4 }} easing={EASE.back}>
                    <Checkbox checked={checked} denied={denied} size={64} />
                  </Move>
                  <Move
                    at={WORD_AT[i]}
                    duration={12}
                    from={{ opacity: 0, scale: 1.45, blur: 22, x: -40 }}
                    origin="0% 60%"
                    style={{ position: 'absolute', left: TEXT_X - 120 }}
                  >
                    <div
                      style={{
                        ...TYPE.display,
                        fontSize: FONT_SIZE,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        color: blueFlash > 0.01 ? mix(C.slate300, C.blue400, blueFlash) : C.slate300,
                        opacity: 1 - denied * 0.7,
                        position: 'relative',
                      }}
                    >
                      {word}
                      {/* light sweep across the word as it lands */}
                      {(() => {
                        const sweep = progress(frame, WORD_AT[i] + 3, 16, EASE.standard);
                        if (sweep <= 0 || sweep >= 1) {
                          return null;
                        }
                        return (
                          <span
                            style={{
                              position: 'absolute',
                              inset: 0,
                              color: 'transparent',
                              background: `linear-gradient(100deg, transparent ${lerp(-30, 100, sweep)}%, rgba(255,255,255,0.95) ${lerp(-15, 115, sweep)}%, transparent ${lerp(0, 130, sweep)}%)`,
                              WebkitBackgroundClip: 'text',
                              backgroundClip: 'text',
                            }}
                          >
                            {word}
                          </span>
                        );
                      })()}
                      {isCheap && denied > 0.01 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: -8,
                            top: '54%',
                            height: 12,
                            width: `${progress(frame, PICK_TWO_AT + 8, 10, EASE.out) * 104}%`,
                            background: C.rose,
                            borderRadius: 6,
                            opacity: denied,
                          }}
                        />
                      )}
                    </div>
                  </Move>
                </div>
              );
            })}

            {/* // pick two. → // pick all three. */}
            <div
              style={{
                position: 'absolute',
                left: 124,
                top: TEXT_Y + 3 * LINE + 26,
                fontFamily: FONT.mono,
                fontSize: 46,
                letterSpacing: '0.02em',
                color: frame < GLITCH_AT + 5 ? C.slate500 : C.blue100,
                whiteSpace: 'pre',
                textShadow: frame >= GLITCH_AT + 5 ? `0 0 28px ${alpha(C.blue400, 0.7)}` : undefined,
              }}
            >
              {scramble(comment, commentP, frame, comment, 3)}
              {commentP < 1 && frame >= TYPE_AT && Math.floor(frame / 8) % 2 === 0 && (
                <span style={{ display: 'inline-block', width: 26, height: 50, marginLeft: 4, verticalAlign: -8, background: C.slate400 }} />
              )}
              {commentStrike > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: -6,
                    top: '52%',
                    height: 6,
                    width: `${commentStrike * 104}%`,
                    background: C.rose,
                    borderRadius: 3,
                  }}
                />
              )}
            </div>
          </AbsoluteFill>
        </Glitch>
      </AbsoluteFill>

      {/* Dive flash hands over to the logo sting's checker field */}
      {flash > 0 && <AbsoluteFill style={{ background: alpha(C.blue400, flash * 0.55) }} />}
    </AbsoluteFill>
  );
};
