import type React from 'react';
import { useCurrentFrame } from 'remotion';
import { EASE, lerp, progress, typed } from './motion';
import { alpha, C, FONT, TERM } from './tokens';

export type TermLine = {
  kind: 'command' | 'comment' | 'success' | 'output';
  text: string;
  /** Right-hand value for `output` / `success` lines (e.g. "9.2 ms"). */
  value?: string;
  /** Scene-local frame the line starts (commands start typing here). */
  at: number;
  /** Typing speed for commands, characters per frame. */
  cpf?: number;
};

type Props = {
  lines: TermLine[];
  title?: string;
  status?: string;
  width: number;
  /** Body font size; chrome scales with it. The site uses 13px at ~560px wide. */
  fontSize?: number;
  minBodyHeight?: number;
  /** Optional per-line highlight: returns 0..1 glow for a line index. */
  highlight?: (index: number) => number;
  style?: React.CSSProperties;
};

/**
 * The homepage hero terminal (Hero.astro `.hero-terminal` + HeroTerminal.tsx),
 * driven by frames instead of timers.
 */
export const Terminal: React.FC<Props> = ({
  lines,
  title = '~/sandbox — unikraft',
  status = 'live',
  width,
  fontSize = 26,
  minBodyHeight,
  highlight,
  style,
}) => {
  const frame = useCurrentFrame();
  const s = fontSize / 13;
  const visible = lines.filter((l) => frame >= l.at);
  const last = visible[visible.length - 1];
  const blinkOn = Math.floor(frame / 15) % 2 === 0;

  return (
    <div
      style={{
        width,
        borderRadius: 14 * s,
        overflow: 'hidden',
        background: TERM.bg,
        border: `${Math.max(1, s * 0.75)}px solid ${alpha(C.blue400, 0.22)}`,
        boxShadow: `0 ${s}px 0 0 rgba(255,255,255,0.06) inset, 0 ${30 * s}px ${60 * s}px ${-30 * s}px rgba(0,0,0,0.6), 0 0 ${80 * s}px ${-20 * s}px ${alpha(C.blue400, 0.25)}`,
        fontFamily: FONT.mono,
        color: TERM.text,
        fontSize,
        lineHeight: 1.6,
        ...style,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: `${10 * s}px ${16 * s}px`,
          background: TERM.bar,
          borderBottom: `${Math.max(1, s * 0.5)}px solid rgba(255,255,255,0.04)`,
          color: TERM.secondary,
          fontSize: 12 * s,
        }}
      >
        <div style={{ display: 'flex', gap: 8 * s }}>
          {[TERM.red, TERM.yellow, TERM.greenDot].map((c) => (
            <span key={c} style={{ width: 12 * s, height: 12 * s, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 * s }}>
          <span
            style={{
              width: 8 * s,
              height: 8 * s,
              borderRadius: '50%',
              background: TERM.success,
              boxShadow: `0 0 ${8 * s}px ${TERM.success}`,
            }}
          />
          <span style={{ color: TERM.success, fontWeight: 500 }}>{status}</span>
        </div>
      </div>

      <div style={{ padding: `${16 * s}px ${18 * s}px ${20 * s}px`, minHeight: minBodyHeight }}>
        {visible.map((line, i) => {
          const isCommand = line.kind === 'command';
          const shown = isCommand ? typed(frame, line.at, line.text.length, line.cpf ?? 1.2) : line.text.length;
          const done = shown >= line.text.length;
          const enter = isCommand ? 1 : progress(frame, line.at, 6, EASE.out);
          const prev = visible[i - 1];
          const glow = highlight?.(lines.indexOf(line)) ?? 0;
          const marginTop = i === 0 ? 0 : prev?.kind === 'command' && !isCommand ? 4 * s : 2 * s;
          const color =
            line.kind === 'comment' ? TERM.comment : line.kind === 'success' ? TERM.success : TERM.text;
          const glyph = line.kind === 'command' ? '$' : line.kind === 'comment' ? '→' : line.kind === 'success' ? '✓' : null;
          return (
            <div
              key={`${line.at}-${line.text}`}
              style={{
                display: 'flex',
                gap: 8 * s,
                marginTop,
                color,
                whiteSpace: 'pre-wrap',
                opacity: enter,
                transform: `translateX(${lerp(-10 * s, 0, enter)}px)`,
                textShadow: glow > 0 ? `0 0 ${18 * s * glow}px ${alpha(C.blue400, 0.9 * glow)}` : undefined,
              }}
            >
              {glyph && (
                <span style={{ flexShrink: 0, fontWeight: isCommand ? 600 : 400, color: isCommand ? TERM.prompt : color }}>
                  {glyph}
                </span>
              )}
              <span>
                {line.text.slice(0, shown)}
                {line === last && isCommand && (!done || blinkOn) && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '0.55ch',
                      height: '1.15em',
                      verticalAlign: 'text-bottom',
                      marginLeft: 1,
                      background: TERM.text,
                    }}
                  />
                )}
              </span>
              {line.value && done && (
                <span style={{ marginLeft: 12 * s, color: line.kind === 'success' ? TERM.success : TERM.secondary }}>
                  {line.value}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
