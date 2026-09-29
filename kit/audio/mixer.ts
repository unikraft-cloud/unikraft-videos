/**
 * Mix buses, voice placement with sends, trigger-driven side-chain ducking and
 * beat-based automation lanes.
 */
import { CONTROL, EDGE, panL, panR, SR, stereo, Svf, type Stereo } from './dsp.ts';
import { at, SAMPLES_PER_BEAT } from './score.ts';

export type DryBus = 'kick' | 'drums' | 'bass' | 'music' | 'sfx';
export type SendBus = 'rev' | 'dly';
export type Place = { gain?: number; pan?: number; rev?: number; dly?: number };

/** A trigger that pumps a bus: gain dips by `depth` over 2 ms, then recovers with time constant `tau` (s). */
export type Duck = { beat: number; depth: number; tau: number };

export class Mixer {
  readonly n: number;
  readonly buses: Record<DryBus | SendBus, Stereo>;
  /** Side-chain triggers per ducked bus. */
  readonly ducks: Record<'bass' | 'music', Duck[]> = { bass: [], music: [] };

  constructor(n: number) {
    this.n = n;
    this.buses = { kick: stereo(n), drums: stereo(n), bass: stereo(n), music: stereo(n), sfx: stereo(n), rev: stereo(n), dly: stereo(n) };
  }

  /** Mix a mono or stereo voice into `bus` starting at absolute `beat` (+ `offset` samples), with optional sends. */
  add(bus: DryBus, voice: Float32Array | Stereo, beat: number, p: Place = {}, offset = 0): void {
    const start = at(beat) + offset;
    const g = p.gain ?? 1;
    const gl = g * panL(p.pan ?? 0);
    const gr = g * panR(p.pan ?? 0);
    const l = voice instanceof Float32Array ? voice : voice.l;
    const r = voice instanceof Float32Array ? voice : voice.r;
    this.write(this.buses[bus], l, r, start, gl, gr);
    if (p.rev) {
      this.write(this.buses.rev, l, r, start, gl * p.rev, gr * p.rev);
    }
    if (p.dly) {
      this.write(this.buses.dly, l, r, start, gl * p.dly, gr * p.dly);
    }
  }

  private write(dst: Stereo, l: Float32Array, r: Float32Array, start: number, gl: number, gr: number): void {
    const from = Math.max(0, -start);
    const to = Math.min(l.length, this.n - start);
    for (let i = from; i < to; i++) {
      dst.l[start + i] += l[i] * gl;
      dst.r[start + i] += r[i] * gr;
    }
  }
}

/** Multiply a bus by the min-combined ducking curve of its triggers (deterministic "ghost" side-chain). */
export const applyDucks = (bus: Stereo, ducks: readonly Duck[]): void => {
  const n = bus.l.length;
  const gain = new Float32Array(n).fill(1);
  for (const d of ducks) {
    const start = at(d.beat);
    const len = Math.min(n - start, Math.round(d.tau * 7 * SR));
    for (let i = 0; i < len; i++) {
      const dip = d.depth * Math.min(1, i / EDGE) * Math.exp(-Math.max(0, i - EDGE) / (d.tau * SR));
      gain[start + i] = Math.min(gain[start + i], 1 - dip);
    }
  }
  gainBus(bus, gain);
};

/** Automation breakpoint: [absolute beat, value]. */
export type Point = readonly [beat: number, value: number];

/**
 * Render an automation lane to one value per sample. Linear or exponential
 * (for frequencies) interpolation between points, held outside them.
 */
export const renderLane = (n: number, points: readonly Point[], exponential: boolean): Float32Array => {
  const out = new Float32Array(n);
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const beat = i / SAMPLES_PER_BEAT;
    while (k < sorted.length - 1 && sorted[k + 1][0] <= beat) {
      k++;
    }
    const [b0, v0] = sorted[k];
    const next = sorted[k + 1];
    if (!next || beat <= b0) {
      out[i] = v0;
      continue;
    }
    const t = (beat - b0) / (next[0] - b0);
    out[i] = exponential ? v0 * (next[1] / v0) ** t : v0 + (next[1] - v0) * t;
  }
  return out;
};

/** Automated 12 dB/oct low-pass over a bus (cutoff per sample, refreshed at control rate). */
export const lowpassBus = (bus: Stereo, cutoff: Float32Array, q: number): void => {
  const fl = new Svf();
  const fr = new Svf();
  for (let i = 0; i < bus.l.length; i++) {
    if (i % CONTROL === 0) {
      fl.set(cutoff[i], q);
      fr.set(cutoff[i], q);
    }
    fl.process(bus.l[i]);
    fr.process(bus.r[i]);
    bus.l[i] = fl.low;
    bus.r[i] = fr.low;
  }
};

/** Multiply a bus by a per-sample gain lane. */
export const gainBus = (bus: Stereo, gain: Float32Array): void => {
  for (let i = 0; i < bus.l.length; i++) {
    bus.l[i] *= gain[i];
    bus.r[i] *= gain[i];
  }
};
