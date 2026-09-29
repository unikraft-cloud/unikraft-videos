/**
 * DSP primitives for the procedural soundtrack: seeded noise, band-limited
 * oscillators, filters, envelope helpers. Pure functions and tiny classes with
 * no per-sample allocation.
 */

export const SR = 48_000;
export const TAU = Math.PI * 2;

export type Stereo = { l: Float32Array; r: Float32Array };
export const stereo = (n: number): Stereo => ({ l: new Float32Array(n), r: new Float32Array(n) });

export const db = (d: number): number => 10 ** (d / 20);
export const toDb = (g: number): number => 20 * Math.log10(Math.max(Math.abs(g), 1e-12));
export const mtof = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
export const cents = (c: number): number => 2 ** (c / 1200);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Exponential interpolation, for frequencies and gains: `a` at t=0, `b` at t=1. */
export const xerp = (a: number, b: number, t: number): number => a * (b / a) ** t;
/** Milliseconds → samples. */
export const ms = (m: number): number => Math.round((m * SR) / 1000);
/** Seconds → samples. */
export const sec = (s: number): number => Math.round(s * SR);

/** Shortest fade anywhere in the mix: 2 ms, so no envelope ever clicks. */
export const EDGE = ms(2);

/** Linear fade-in over `a` samples and fade-out over the last `r` samples of an `n`-sample voice. */
export const edges = (i: number, n: number, a = EDGE, r = EDGE): number => {
  let g = i < a ? i / a : 1;
  const left = n - 1 - i;
  if (left < r) {
    g *= Math.max(0, left) / r;
  }
  return g;
};

/** Raised-cosine 0→1 ramp for p ∈ [0, 1]. */
export const smooth = (p: number): number => {
  const x = clamp(p, 0, 1);
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
};

/** Balance pan law: centre is unity on both sides, ±1 is hard left/right. */
export const panL = (p: number): number => Math.min(1, 1 - p);
export const panR = (p: number): number => Math.min(1, 1 + p);

/** Soft knee saturator: transparent below `knee`, tanh-shaped approach to ±1 above it. */
export const softClip = (x: number, knee = 0.7): number => {
  const a = Math.abs(x);
  if (a <= knee) {
    return x;
  }
  const room = 1 - knee;
  return Math.sign(x) * (knee + room * Math.tanh((a - knee) / room));
};

const hash = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Seeded PRNG (mulberry32). Seed with a string so every instrument owns an independent stream. */
export class Rng {
  private s: number;

  constructor(seed: string | number) {
    this.s = typeof seed === 'number' ? seed >>> 0 : hash(seed);
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** White noise sample in [-1, 1). */
  noise(): number {
    return this.next() * 2 - 1;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

/** PolyBLEP residual for a discontinuity at phase 0 (Välimäki & Huovilainen). */
const blep = (t: number, dt: number): number => {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
};

/** Band-limited sawtooth (PolyBLEP). */
export class Saw {
  private phase: number;

  constructor(phase = 0) {
    this.phase = phase;
  }

  next(freq: number): number {
    const dt = freq / SR;
    const t = this.phase;
    this.phase += dt;
    if (this.phase >= 1) {
      this.phase -= 1;
    }
    return 2 * t - 1 - blep(t, dt);
  }
}

/** Band-limited pulse (PolyBLEP), `width` = duty cycle. */
export class Pulse {
  private phase: number;
  private readonly width: number;

  constructor(phase = 0, width = 0.5) {
    this.phase = phase;
    this.width = width;
  }

  next(freq: number): number {
    const dt = freq / SR;
    const t = this.phase;
    this.phase += dt;
    if (this.phase >= 1) {
      this.phase -= 1;
    }
    let v = t < this.width ? 1 : -1;
    v += blep(t, dt);
    v -= blep((t + 1 - this.width) % 1, dt);
    return v;
  }
}

/** Phase-accumulating sine (for pitch-swept sines, where `sin(2πft)` would be wrong). */
export class Sine {
  private phase: number;

  constructor(phase = 0) {
    this.phase = phase;
  }

  next(freq: number): number {
    const v = Math.sin(this.phase);
    this.phase += (TAU * freq) / SR;
    if (this.phase > TAU) {
      this.phase -= TAU;
    }
    return v;
  }
}

/** RBJ-cookbook biquad, transposed direct form II. For static EQ / tone shaping. */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;

  /** Set raw coefficients (normalised internally by a0). */
  coeffs(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): this {
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    return this;
  }

  lowpass(f: number, q = Math.SQRT1_2): this {
    const { c, alpha } = rbj(f, q);
    return this.coeffs((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + alpha, -2 * c, 1 - alpha);
  }

  highpass(f: number, q = Math.SQRT1_2): this {
    const { c, alpha } = rbj(f, q);
    return this.coeffs((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + alpha, -2 * c, 1 - alpha);
  }

  /** Band-pass, 0 dB peak gain. */
  bandpass(f: number, q = 1): this {
    const { c, alpha } = rbj(f, q);
    return this.coeffs(alpha, 0, -alpha, 1 + alpha, -2 * c, 1 - alpha);
  }

  peak(f: number, q: number, gainDb: number): this {
    const { c, alpha } = rbj(f, q);
    const A = 10 ** (gainDb / 40);
    return this.coeffs(1 + alpha * A, -2 * c, 1 - alpha * A, 1 + alpha / A, -2 * c, 1 - alpha / A);
  }

  process(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

const rbj = (f: number, q: number): { c: number; alpha: number } => {
  const w = (TAU * clamp(f, 5, SR * 0.49)) / SR;
  return { c: Math.cos(w), alpha: Math.sin(w) / (2 * q) };
};

/**
 * Topology-preserving-transform state-variable filter (Simper/Cytomic). Stable
 * under fast cutoff modulation, so it is the one used for filter sweeps.
 * After `process`, read `low` or `band`.
 */
export class Svf {
  low = 0;
  band = 0;
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;

  set(f: number, q: number): this {
    const g = Math.tan((Math.PI * clamp(f, 10, SR * 0.45)) / SR);
    this.a1 = 1 / (1 + g * (g + 1 / q));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
    return this;
  }

  process(v0: number): void {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1;
  }
}

/** Filter coefficients only need refreshing at control rate (every 16 samples ≈ 0.33 ms). */
export const CONTROL = 16;
