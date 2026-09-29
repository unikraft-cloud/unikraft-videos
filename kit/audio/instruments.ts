/**
 * Instrument voices. Each call renders one note/hit into a fresh buffer that
 * the arrangement drops onto the grid with `Mixer.add`. Drum voices come out
 * peak-normalised so velocities in the arrangement read as plain gains.
 */
import {
  Biquad,
  CONTROL,
  cents,
  EDGE,
  edges,
  ms,
  mtof,
  panL,
  panR,
  Pulse,
  Rng,
  Saw,
  sec,
  Sine,
  smooth,
  SR,
  stereo,
  Svf,
  TAU,
  xerp,
  type Stereo,
} from './dsp.ts';

/** Scale channels in place so their joint peak equals `peak`. */
export const normalize = (channels: readonly Float32Array[], peak = 1): void => {
  let m = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      m = Math.max(m, Math.abs(ch[i]));
    }
  }
  const g = m > 0 ? peak / m : 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      ch[i] *= g;
    }
  }
};

// ─── Drums ──────────────────────────────────────────────────────────────────

export type KickOpts = {
  /** Pitch envelope start / end (Hz). */
  f0?: number;
  f1?: number;
  pitchTau?: number;
  /** Amp decay time constant (s) after a 12 ms hold. */
  decay?: number;
  click?: number;
  drive?: number;
  seconds?: number;
  lowpass?: number;
};

/** Kick: sine with exponential pitch drop, hold + exponential decay, band-passed noise click, tanh drive. Mono. */
export const kick = (o: KickOpts = {}, seed = 'kick'): Float32Array => {
  const f0 = o.f0 ?? 175;
  const f1 = o.f1 ?? 50;
  const pitchTau = o.pitchTau ?? 0.03;
  const decay = o.decay ?? 0.1;
  const clickAmt = o.click ?? 0.45;
  const drive = o.drive ?? 1.5;
  const n = sec(o.seconds ?? 0.4);
  const out = new Float32Array(n);
  const rng = new Rng(seed);
  const clickBp = new Biquad().bandpass(3800, 0.8);
  const lp = o.lowpass ? new Biquad().lowpass(o.lowpass, 0.9) : null;
  const osc = new Sine();
  const norm = 1 / Math.tanh(drive);
  const hold = 0.012;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const body = osc.next(f1 + (f0 - f1) * Math.exp(-t / pitchTau)) * (t < hold ? 1 : Math.exp(-(t - hold) / decay));
    const click = clickBp.process(rng.noise()) * Math.exp(-t / 0.005) * clickAmt;
    const s = Math.tanh((body + click) * drive) * norm;
    out[i] = (lp ? lp.process(s) : s) * edges(i, n, EDGE, ms(30));
  }
  return out;
};

/** 808-style clap: three 10 ms-spaced noise bursts then a decaying tail, band-passed, decorrelated L/R. */
export const clap = (tail = 0.085, seed = 'clap'): Stereo => {
  const n = sec(tail * 5 + 0.05);
  const out = stereo(n);
  const common = new Rng(seed);
  const rl = new Rng(`${seed}:l`);
  const rr = new Rng(`${seed}:r`);
  const bpL = new Biquad().bandpass(1200, 1.1);
  const bpR = new Biquad().bandpass(1320, 1.1);
  const hpL = new Biquad().highpass(500);
  const hpR = new Biquad().highpass(500);
  const bursts = [0, ms(10), ms(20)];
  const tailAt = ms(30);
  const burstTau = ms(5);
  for (let i = 0; i < n; i++) {
    let env = 0;
    for (const b of bursts) {
      if (i >= b) {
        env += Math.min(1, (i - b) / EDGE) * Math.exp(-(i - b) / burstTau);
      }
    }
    if (i >= tailAt) {
      env += Math.min(1, (i - tailAt) / EDGE) * Math.exp(-(i - tailAt) / (tail * SR));
    }
    env *= edges(i, n, 0, ms(20));
    const c = common.noise();
    out.l[i] = hpL.process(bpL.process(0.8 * c + 0.4 * rl.noise())) * env;
    out.r[i] = hpR.process(bpR.process(0.8 * c + 0.4 * rr.noise())) * env;
  }
  normalize([out.l, out.r]);
  return out;
};

/** TR-808 hat oscillator bank (six square waves, inharmonic). */
const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800];

export type HatOpts = { open: boolean; /** 0–1 */ tone?: number; decay?: number };

/** Hi-hat: 808 metallic square bank + noise, high-passed, presence peak, decorrelated noise for width. */
export const hat = (o: HatOpts, seed: string): Stereo => {
  const n = ms(o.open ? 240 : 70);
  const tau = (o.decay ?? (o.open ? 0.09 : 0.014)) * SR;
  const tone = o.tone ?? 0.5;
  const rng = new Rng(seed);
  const rl = new Rng(`${seed}:l`);
  const rr = new Rng(`${seed}:r`);
  const oscs = HAT_FREQS.map(() => new Pulse(rng.next()));
  const hpL = new Biquad().highpass(6200 + 2200 * tone, 0.9);
  const hpR = new Biquad().highpass(6200 + 2200 * tone, 0.9);
  const pkL = new Biquad().peak(10_500, 1.1, 2 + 4 * tone);
  const pkR = new Biquad().peak(10_500, 1.1, 2 + 4 * tone);
  // Roll off the top octave so 16th hats read crisp rather than fizzy.
  const lpL = new Biquad().lowpass(14_000, 0.7);
  const lpR = new Biquad().lowpass(14_000, 0.7);
  const out = stereo(n);
  for (let i = 0; i < n; i++) {
    let metal = 0;
    for (let k = 0; k < oscs.length; k++) {
      metal += oscs[k].next(HAT_FREQS[k]);
    }
    metal /= oscs.length;
    const env = Math.exp(-i / tau) * edges(i, n, EDGE, ms(o.open ? 40 : 12));
    out.l[i] = lpL.process(pkL.process(hpL.process(0.55 * metal + 0.6 * rl.noise()))) * env;
    out.r[i] = lpR.process(pkR.process(hpR.process(0.55 * metal + 0.6 * rr.noise()))) * env;
  }
  normalize([out.l, out.r]);
  return out;
};

/** Crash: the hat's square bank pitched up + wide noise, two-stage decay (bright splash, long wash). */
export const crash = (seed: string, seconds = 2.4): Stereo => {
  const n = sec(seconds);
  const out = stereo(n);
  const rng = new Rng(seed);
  const rl = new Rng(`${seed}:l`);
  const rr = new Rng(`${seed}:r`);
  const oscs = HAT_FREQS.map(() => new Pulse(rng.next()));
  const hpL = new Biquad().highpass(3200, 0.8);
  const hpR = new Biquad().highpass(3400, 0.8);
  const pkL = new Biquad().peak(7500, 0.9, 4);
  const pkR = new Biquad().peak(8200, 0.9, 4);
  const lpL = new Biquad().lowpass(15_000, 0.7);
  const lpR = new Biquad().lowpass(15_000, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let metal = 0;
    for (let k = 0; k < oscs.length; k++) {
      metal += oscs[k].next(HAT_FREQS[k] * 1.7);
    }
    metal /= oscs.length;
    const env = (0.6 * Math.exp(-t / 0.06) + 0.4 * Math.exp(-t / 0.75)) * edges(i, n, EDGE, ms(300));
    out.l[i] = lpL.process(pkL.process(hpL.process(0.35 * metal + 0.8 * rl.noise()))) * env;
    out.r[i] = lpR.process(pkR.process(hpR.process(0.35 * metal + 0.8 * rr.noise()))) * env;
  }
  normalize([out.l, out.r]);
  return out;
};

export type SnareOpts = { /** Semitones up from 185 Hz. */ tune?: number; decay?: number; tone?: number };

/** Snare: two pitch-dropping body modes + high-passed noise with a presence peak. */
export const snare = (o: SnareOpts, seed: string): Stereo => {
  const decay = o.decay ?? 0.12;
  const ratio = 2 ** ((o.tune ?? 0) / 12);
  const n = sec(decay * 5 + 0.04);
  const out = stereo(n);
  const rl = new Rng(`${seed}:l`);
  const rr = new Rng(`${seed}:r`);
  const hpL = new Biquad().highpass(900 + 1200 * (o.tone ?? 0.5));
  const hpR = new Biquad().highpass(900 + 1200 * (o.tone ?? 0.5));
  const pkL = new Biquad().peak(5000, 0.8, 5);
  const pkR = new Biquad().peak(5000, 0.8, 5);
  const m1 = new Sine();
  const m2 = new Sine();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const drop = 1 + 0.5 * Math.exp(-t / 0.012);
    const body = (m1.next(185 * ratio * drop) * 0.7 + m2.next(330 * ratio * drop) * 0.4) * Math.exp(-t / 0.045);
    const env = Math.exp(-t / decay);
    const e = edges(i, n, EDGE, ms(20));
    out.l[i] = (body + pkL.process(hpL.process(rl.noise())) * env) * e;
    out.r[i] = (body + pkR.process(hpR.process(rr.noise())) * env) * e;
  }
  normalize([out.l, out.r]);
  return out;
};

/** Digital percussion for the dark section: bit-crushed, sample-rate-reduced zaps, clicks and stutters. */
export const glitchPerc = (rng: Rng): Float32Array => {
  const kind = Math.floor(rng.next() * 3);
  const n = ms(rng.range(30, 75));
  const out = new Float32Array(n);
  const hold = Math.floor(rng.range(3, 12));
  const levels = 2 ** Math.floor(rng.range(3, 6));
  const f0 = rng.range(400, 2600);
  const sine = new Sine();
  const sq = new Pulse(rng.next(), 0.3);
  const grain = Math.floor(n / 4);
  const lp = new Biquad().lowpass(9000);
  let held = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    let v: number;
    let env = Math.exp(-p * 4);
    if (kind === 0) {
      v = sine.next(xerp(f0 * 2.5, 90, p));
    } else if (kind === 1) {
      v = 0.7 * sq.next(f0) + 0.3 * rng.noise();
    } else {
      const g = Math.floor(i / grain);
      v = rng.noise();
      env *= g % 2 === 0 ? edges(i - g * grain, grain) : 0;
    }
    if (i % hold === 0) {
      held = Math.round(v * levels) / levels;
    }
    out[i] = lp.process(held * env) * edges(i, n);
  }
  normalize([out]);
  return out;
};

// ─── Synths ─────────────────────────────────────────────────────────────────

export type BassOpts = {
  midi: number;
  /** Gate length in samples (a 30 ms release follows). */
  gate: number;
  sub?: number;
  mid?: number;
  /** Mid-bass filter envelope peak and floor (Hz). */
  cutoff?: number;
  floor?: number;
  /** Attack in seconds (default 3 ms; long for drones). */
  attack?: number;
};

/** Bass: sine sub at the root + two detuned saws an octave up through an enveloped low-pass, gently driven. Mono. */
export const bass = (o: BassOpts): Float32Array => {
  const n = o.gate + ms(30);
  const out = new Float32Array(n);
  const f = mtof(o.midi);
  const sub = new Sine();
  const a = new Saw(0);
  const b = new Saw(0.37);
  const svf = new Svf();
  const peak = o.cutoff ?? 1400;
  const floor = o.floor ?? 180;
  const subGain = o.sub ?? 0.65;
  const midGain = o.mid ?? 0.55;
  const attack = Math.max(ms(3), sec(o.attack ?? 0));
  for (let i = 0; i < n; i++) {
    if (i % CONTROL === 0) {
      svf.set(floor + (peak - floor) * Math.exp(-i / SR / 0.07), 1.1);
    }
    svf.process((a.next(f * 2 * cents(-4)) + b.next(f * 2 * cents(4))) * 0.5);
    const mid = Math.tanh(svf.low * 1.6);
    out[i] = (sub.next(f) * subGain + mid * midGain) * edges(i, n, attack, ms(30));
  }
  return out;
};

export type PluckOpts = { midi: number; gate: number; vel: number; cutoff: number; decay?: number };

/** Arp pluck: detuned saw pair + pulse sub-octave, fast filter envelope scaled by velocity. Mono. */
export const pluck = (o: PluckOpts): Float32Array => {
  const n = o.gate + ms(60);
  const out = new Float32Array(n);
  const f = mtof(o.midi);
  const a = new Saw(0.1);
  const b = new Saw(0.6);
  const sub = new Pulse(0.3, 0.35);
  const svf = new Svf();
  const decay = (o.decay ?? 0.2) * SR;
  for (let i = 0; i < n; i++) {
    if (i % CONTROL === 0) {
      svf.set(260 + o.cutoff * (0.4 + 0.6 * o.vel) * Math.exp(-i / SR / 0.06), 1.6);
    }
    svf.process(0.4 * a.next(f * cents(-7)) + 0.4 * b.next(f * cents(7)) + 0.3 * sub.next(f / 2));
    out[i] = svf.low * o.vel * Math.exp(-i / decay) * edges(i, n, EDGE, ms(60));
  }
  return out;
};

export type PadOpts = {
  notes: readonly number[];
  /** Samples until release starts. */
  gate: number;
  /** Seconds. */
  attack: number;
  release: number;
  cutoff: number;
  /** Detune spread in cents (± across the unison voices). */
  detune?: number;
  voices?: number;
  seed: string;
};

/**
 * Warm pad: per note a unison stack of PolyBLEP saws, detuned and spread across
 * the stereo field, through a slowly breathing low-pass; raised-cosine
 * attack/release.
 */
export const pad = (o: PadOpts): Stereo => {
  const voices = o.voices ?? 5;
  const spread = o.detune ?? 12;
  const rel = sec(o.release);
  const att = Math.max(EDGE, sec(o.attack));
  const n = o.gate + rel;
  const out = stereo(n);
  const rng = new Rng(o.seed);
  const oscs: { saw: Saw; f: number; gl: number; gr: number }[] = [];
  o.notes.forEach((m, ni) => {
    for (let v = 0; v < voices; v++) {
      const d = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1;
      const pan = d * 0.8 * (ni % 2 === 0 ? 1 : -1);
      oscs.push({ saw: new Saw(rng.next()), f: mtof(m) * cents(d * spread + rng.range(-1.5, 1.5)), gl: panL(pan), gr: panR(pan) });
    }
  });
  const fl = new Svf();
  const fr = new Svf();
  const lfoPhase = rng.next() * TAU;
  const norm = 1 / Math.sqrt(oscs.length);
  for (let i = 0; i < n; i++) {
    let l = 0;
    let r = 0;
    for (let k = 0; k < oscs.length; k++) {
      const s = oscs[k].saw.next(oscs[k].f);
      l += s * oscs[k].gl;
      r += s * oscs[k].gr;
    }
    if (i % CONTROL === 0) {
      const c = o.cutoff * (1 + 0.15 * Math.sin((TAU * 0.15 * i) / SR + lfoPhase));
      fl.set(c, 0.8);
      fr.set(c, 0.8);
    }
    fl.process(l * norm);
    fr.process(r * norm);
    const env = (i < att ? smooth(i / att) : 1) * (i > o.gate ? 1 - smooth((i - o.gate) / rel) : 1);
    out.l[i] = fl.low * env;
    out.r[i] = fr.low * env;
  }
  return out;
};

export type StabOpts = { notes: readonly number[]; decay: number; cutoff: number; seed: string };

/** Chord stab: 7-voice supersaw per note, wide, with a snappy filter envelope. */
export const stab = (o: StabOpts): Stereo => {
  const n = sec(o.decay * 5 + 0.06);
  const out = stereo(n);
  const rng = new Rng(o.seed);
  const detunes = [-22, -14, -6, 0, 6, 14, 22];
  const oscs: { saw: Saw; f: number; gl: number; gr: number }[] = [];
  for (const m of o.notes) {
    detunes.forEach((d, v) => {
      const pan = (v / (detunes.length - 1)) * 2 - 1;
      oscs.push({ saw: new Saw(rng.next()), f: mtof(m) * cents(d), gl: panL(pan * 0.9), gr: panR(pan * 0.9) });
    });
  }
  const fl = new Svf();
  const fr = new Svf();
  const norm = 1 / Math.sqrt(oscs.length);
  const decay = o.decay * SR;
  for (let i = 0; i < n; i++) {
    let l = 0;
    let r = 0;
    for (let k = 0; k < oscs.length; k++) {
      const s = oscs[k].saw.next(oscs[k].f);
      l += s * oscs[k].gl;
      r += s * oscs[k].gr;
    }
    if (i % CONTROL === 0) {
      const c = 350 + o.cutoff * Math.exp(-i / SR / 0.09);
      fl.set(c, 1);
      fr.set(c, 1);
    }
    fl.process(l * norm);
    fr.process(r * norm);
    const env = Math.exp(-i / decay) * edges(i, n, EDGE, ms(40));
    out.l[i] = fl.low * env;
    out.r[i] = fr.low * env;
  }
  return out;
};
