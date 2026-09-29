/**
 * Offline effects, dynamics and metering: Freeverb, ping-pong delay, glue
 * compressor, true-peak lookahead limiter, BS.1770-4 loudness.
 */
import { Biquad, db, ms, SR, stereo, toDb, type Stereo } from './dsp.ts';

// ─── Freeverb (Jezar's public-domain tunings, rescaled from 44.1 kHz) ───────────

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
const STEREO_SPREAD = 23;
const TUNING_SCALE = SR / 44_100;

class Comb {
  private readonly buf: Float32Array;
  private i = 0;
  private store = 0;

  constructor(size: number) {
    this.buf = new Float32Array(Math.round(size * TUNING_SCALE));
  }

  process(x: number, feedback: number, damp: number): number {
    const out = this.buf[this.i];
    this.store = out * (1 - damp) + this.store * damp;
    this.buf[this.i] = x + this.store * feedback;
    if (++this.i >= this.buf.length) {
      this.i = 0;
    }
    return out;
  }
}

class Allpass {
  private readonly buf: Float32Array;
  private i = 0;

  constructor(size: number) {
    this.buf = new Float32Array(Math.round(size * TUNING_SCALE));
  }

  process(x: number): number {
    const b = this.buf[this.i];
    this.buf[this.i] = x + b * 0.5;
    if (++this.i >= this.buf.length) {
      this.i = 0;
    }
    return b - x;
  }
}

export type ReverbOpts = {
  /** 0–1, Freeverb "room size". */
  room: number;
  /** 0–1, high-frequency damping inside the tank. */
  damp: number;
  /** 0–1 stereo width of the wet signal. */
  width: number;
  predelayMs: number;
  /** Send EQ: keep lows and fizz out of the tank. */
  lowCut: number;
  highCut: number;
};

/** Wet-only stereo Freeverb of a send bus. */
export const reverb = (input: Stereo, o: ReverbOpts): Stereo => {
  const n = input.l.length;
  const out = stereo(n);
  const feedback = 0.28 + 0.7 * o.room;
  const damp = 0.4 * o.damp;
  const combsL = COMBS.map((c) => new Comb(c));
  const combsR = COMBS.map((c) => new Comb(c + STEREO_SPREAD));
  const apsL = ALLPASSES.map((a) => new Allpass(a));
  const apsR = ALLPASSES.map((a) => new Allpass(a + STEREO_SPREAD));
  const hp = new Biquad().highpass(o.lowCut);
  const lp = new Biquad().lowpass(o.highCut);
  const pre = ms(o.predelayMs);
  const wet1 = o.width / 2 + 0.5;
  const wet2 = (1 - o.width) / 2;
  for (let i = 0; i < n; i++) {
    const j = i - pre;
    const x = lp.process(hp.process(j >= 0 ? (input.l[j] + input.r[j]) * 0.5 : 0)) * 0.03;
    let l = 0;
    let r = 0;
    for (let c = 0; c < combsL.length; c++) {
      l += combsL[c].process(x, feedback, damp);
      r += combsR[c].process(x, feedback, damp);
    }
    for (let a = 0; a < apsL.length; a++) {
      l = apsL[a].process(l);
      r = apsR[a].process(r);
    }
    out.l[i] = l * wet1 + r * wet2;
    out.r[i] = r * wet1 + l * wet2;
  }
  return out;
};

/**
 * Wet-only ping-pong delay: the mono sum enters the left line, repeats bounce
 * L → R → L…, and every lap passes through a band-pass so echoes darken.
 */
export const pingPong = (input: Stereo, delay: number, feedback: number, lowCut: number, highCut: number): Stereo => {
  const n = input.l.length;
  const out = stereo(n);
  const lineL = new Float32Array(delay);
  const lineR = new Float32Array(delay);
  const hp = new Biquad().highpass(lowCut);
  const lp = new Biquad().lowpass(highCut);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const yl = lineL[idx];
    const yr = lineR[idx];
    lineL[idx] = lp.process(hp.process((input.l[i] + input.r[i]) * 0.5 + yr * feedback));
    lineR[idx] = yl;
    out.l[i] = yl;
    out.r[i] = yr;
    if (++idx >= delay) {
      idx = 0;
    }
  }
  return out;
};

// ─── Dynamics ───────────────────────────────────────────────────────────────

export type CompOpts = { thresholdDb: number; ratio: number; kneeDb: number; attackMs: number; releaseMs: number };

/**
 * Stereo-linked feed-forward compressor, soft knee, log-domain smooth branching
 * detector (Giannoulis/Massberg/Reiss). In place. Returns max gain reduction in dB.
 */
export const compress = (s: Stereo, o: CompOpts): number => {
  const aA = Math.exp(-1 / ((o.attackMs * SR) / 1000));
  const aR = Math.exp(-1 / ((o.releaseMs * SR) / 1000));
  const slope = 1 / o.ratio - 1;
  let env = 0;
  let maxGr = 0;
  for (let i = 0; i < s.l.length; i++) {
    const over = toDb(Math.max(Math.abs(s.l[i]), Math.abs(s.r[i]))) - o.thresholdDb;
    let target = 0;
    if (2 * over >= o.kneeDb) {
      target = -slope * over;
    } else if (2 * over > -o.kneeDb) {
      target = (-slope * (over + o.kneeDb / 2) ** 2) / (2 * o.kneeDb);
    }
    env = target > env ? aA * env + (1 - aA) * target : aR * env + (1 - aR) * target;
    maxGr = Math.max(maxGr, env);
    const g = db(-env);
    s.l[i] *= g;
    s.r[i] *= g;
  }
  return maxGr;
};

// ─── True peak (4× oversampled, windowed-sinc interpolation) ────────────────

const TP_HALF = 8;
const TP_PHASES = [0.25, 0.5, 0.75].map((frac) => {
  const taps = new Float64Array(2 * TP_HALF);
  const bessel0 = (x: number): number => {
    let sum = 1;
    let term = 1;
    for (let k = 1; k < 30; k++) {
      term *= (x / (2 * k)) ** 2;
      sum += term;
    }
    return sum;
  };
  const beta = 7;
  let total = 0;
  for (let k = 0; k < taps.length; k++) {
    const u = frac - (k - TP_HALF + 1);
    const sinc = Math.sin(Math.PI * u) / (Math.PI * u);
    const w = bessel0(beta * Math.sqrt(Math.max(0, 1 - (u / TP_HALF) ** 2))) / bessel0(beta);
    taps[k] = sinc * w;
    total += taps[k];
  }
  return taps.map((t) => t / total);
});

/** Per-sample true-peak magnitude of one channel, max-merged into `env` (inter-sample peaks credit both neighbours). */
const truePeakInto = (x: Float32Array, env: Float32Array): void => {
  const n = x.length;
  for (let i = 0; i < n; i++) {
    let m = Math.abs(x[i]);
    if (i >= TP_HALF - 1 && i + TP_HALF < n) {
      for (const taps of TP_PHASES) {
        let y = 0;
        for (let k = 0; k < taps.length; k++) {
          y += x[i + k - TP_HALF + 1] * taps[k];
        }
        m = Math.max(m, Math.abs(y));
      }
      if (m > env[i + 1]) {
        env[i + 1] = m;
      }
    }
    if (m > env[i]) {
      env[i] = m;
    }
  }
};

/** True-peak level of a stereo signal, in dBTP. */
export const truePeakDb = (s: Stereo): number => {
  const env = new Float32Array(s.l.length);
  truePeakInto(s.l, env);
  truePeakInto(s.r, env);
  let m = 0;
  for (let i = 0; i < env.length; i++) {
    m = Math.max(m, env[i]);
  }
  return toDb(m);
};

/**
 * Lookahead brick-wall limiter driven by the true-peak envelope, in place.
 * Gain = sliding-min of the required reduction over the lookahead window,
 * exponential release, then a box average of the same length so the gain has
 * fully ramped down exactly when the peak arrives (no audio delay needed
 * offline: gain index is shifted instead).
 */
export const limit = (s: Stereo, ceiling: number, lookahead: number, releaseMs: number): void => {
  const n = s.l.length;
  const env = new Float32Array(n);
  truePeakInto(s.l, env);
  truePeakInto(s.r, env);
  // Sliding minimum over [i - L + 1, i] with a monotonic deque.
  const gmin = new Float32Array(n);
  const dq = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const req = (i: number): number => (env[i] > ceiling ? ceiling / env[i] : 1);
  for (let i = 0; i < n; i++) {
    const g = req(i);
    while (tail > head && req(dq[tail - 1]) >= g) {
      tail--;
    }
    dq[tail++] = i;
    if (dq[head] <= i - lookahead) {
      head++;
    }
    gmin[i] = req(dq[head]);
  }
  // Instant attack (the box filter below shapes it), exponential release.
  const kRel = 1 - Math.exp(-1 / ((releaseMs * SR) / 1000));
  let g = 1;
  for (let i = 0; i < n; i++) {
    g = Math.min(gmin[i], g + (1 - g) * kRel);
    gmin[i] = g;
  }
  // Box average of length L (virtual unity gain before the start), applied L-1 samples early.
  let acc = lookahead;
  const smoothed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    acc += gmin[i] - (i >= lookahead ? gmin[i - lookahead] : 1);
    smoothed[i] = acc / lookahead;
  }
  for (let j = 0; j < n; j++) {
    const k = Math.min(n - 1, j + lookahead - 1);
    s.l[j] *= smoothed[k];
    s.r[j] *= smoothed[k];
  }
};

// ─── Loudness (ITU-R BS.1770-4 / EBU R128) ──────────────────────────────────

export type Loudness = { integrated: number; shortTermMax: number };

/** Integrated loudness (gated, LUFS) and max short-term (3 s) loudness. Coefficients are the spec's 48 kHz K-filter. */
export const loudness = (s: Stereo): Loudness => {
  if (SR !== 48_000) {
    throw new Error('K-weighting coefficients are defined for 48 kHz');
  }
  const hop = SR / 10;
  const hops = Math.floor(s.l.length / hop);
  const power = new Float64Array(hops);
  for (const ch of [s.l, s.r]) {
    const shelf = new Biquad().coeffs(1.53512485958697, -2.69169618940638, 1.19839281085285, 1, -1.69065929318241, 0.73248077421585);
    const rlb = new Biquad().coeffs(1, -2, 1, 1, -1.99004745483398, 0.99007225036621);
    for (let h = 0; h < hops; h++) {
      let acc = 0;
      for (let i = h * hop; i < (h + 1) * hop; i++) {
        const y = rlb.process(shelf.process(ch[i]));
        acc += y * y;
      }
      power[h] += acc;
    }
  }
  const lufs = (p: number): number => -0.691 + 10 * Math.log10(Math.max(p, 1e-20));
  const blockPower = (first: number, count: number): number => {
    let acc = 0;
    for (let h = first; h < first + count; h++) {
      acc += power[h];
    }
    return acc / (count * hop);
  };
  const blocks: number[] = [];
  for (let b = 0; b + 4 <= hops; b++) {
    blocks.push(blockPower(b, 4));
  }
  // Two-stage gate: absolute −70 LUFS, then relative −10 LU below the absolute-gated mean.
  let threshold = -70;
  let gatedMean = 0;
  for (let stage = 0; stage < 2; stage++) {
    const kept = blocks.filter((p) => lufs(p) > threshold);
    gatedMean = kept.reduce((a, p) => a + p, 0) / Math.max(1, kept.length);
    threshold = lufs(gatedMean) - 10;
  }
  let shortTermMax = -Infinity;
  for (let b = 0; b + 30 <= hops; b++) {
    shortTermMax = Math.max(shortTermMax, lufs(blockPower(b, 30)));
  }
  return { integrated: lufs(gatedMean), shortTermMax };
};
