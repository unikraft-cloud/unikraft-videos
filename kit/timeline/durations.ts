/**
 * Motion durations in frames (60 fps) — the promo's vocabulary. Tempo-independent:
 * a slower preset holds longer, it does not animate slower. Components read them
 * through `useScene().dur(...)`, which applies `preset.motion`; planners use them
 * to reserve room for exits. Pure (no Remotion imports): plain Node loads it.
 */
export const DUR = {
  /** Cut flash / hit flash decay. */
  flash: 8,
  /** Word swaps, chip pops. */
  snap: 7,
  /** Default entrance (Move, SplitText, pop settle). */
  enter: 12,
  /** Default exit: the last frames of a scene. */
  exit: 8,
  /** Scramble / decode of a label. */
  decode: 14,
  /** Rules, wires and rings drawing on. */
  draw: 26,
} as const;

export type DurName = keyof typeof DUR;
