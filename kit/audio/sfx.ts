/**
 * Sound design for every `CueKind`. Each cue renders a peak-normalised stereo
 * sound whose transient starts exactly on the cue's sample (risers and reverse
 * swells instead *end* exactly on `beat + len`; whooshes peak on the beat).
 * Tonal cues take their pitches from the chord playing at that beat.
 */
import type { Cue, CueKind } from '../timeline/define.ts';
import { Biquad, CONTROL, cents, db, EDGE, edges, lerp, ms, mtof, panL, panR, Pulse, Rng, Saw, sec, Sine, smooth, SR, stereo, Svf, TAU, xerp, type Stereo } from './dsp.ts';
import { reverb } from './fx.ts';
import { normalize } from './instruments.ts';
import type { Mixer } from './mixer.ts';
import { at, bs, chordAt, chordTones } from './score.ts';

/** Per-kind level (dB re. peak-normalised render), send levels and side-chain pressure on the music/bass buses. */
export const SFX_MIX: Record<CueKind, { gain: number; rev: number; dly: number; duck?: { depth: number; tau: number } }> = {
  impact: { gain: -2, rev: 0.22, dly: 0, duck: { depth: 0.65, tau: 0.22 } },
  boom: { gain: -1, rev: 0.3, dly: 0, duck: { depth: 0.8, tau: 0.5 } },
  hit: { gain: -1, rev: 0.2, dly: 0.12, duck: { depth: 0.45, tau: 0.12 } },
  whoosh: { gain: -4, rev: 0.2, dly: 0 },
  riser: { gain: -5, rev: 0.3, dly: 0 },
  reverse: { gain: -6, rev: 0, dly: 0 },
  glitch: { gain: -8, rev: 0.12, dly: 0.18 },
  clang: { gain: -5, rev: 0.32, dly: 0.06, duck: { depth: 0.45, tau: 0.2 } },
  chime: { gain: -8, rev: 0.3, dly: 0.35 },
  blip: { gain: -7, rev: 0.12, dly: 0.2 },
  type: { gain: -9, rev: 0.05, dly: 0 },
  ticks: { gain: -9, rev: 0.12, dly: 0.15 },
  countUp: { gain: -9, rev: 0.1, dly: 0.2 },
  shimmer: { gain: -8, rev: 0.6, dly: 0.4 },
};

type Rendered = { snd: Stereo; /** Samples relative to the cue's beat (negative = pre-roll). */ offset: number };
type Ctx = { cue: Cue; seed: string; /** Position within a run of same-kind cues ≤ ½ beat apart. */ run: number };

/** Two decorrelated noise streams for width. */
const noisePair = (seed: string): [Rng, Rng] => [new Rng(`${seed}:l`), new Rng(`${seed}:r`)];

/** Two-operator FM (phase modulation): sin(φc + index · sin(φm)). */
class Fm {
  private pc = 0;
  private pm = 0;

  next(fc: number, fm: number, index: number): number {
    const v = Math.sin(this.pc + index * Math.sin(this.pm));
    this.pc = (this.pc + (TAU * fc) / SR) % TAU;
    this.pm = (this.pm + (TAU * fm) / SR) % TAU;
    return v;
  }
}

// ─── Hits ───────────────────────────────────────────────────────────────────

/** Punchy hit: pitch-dropping body + gliding sub (mono, driven) + wide band-passed noise crack. */
const impact = ({ seed }: Ctx): Rendered => {
  const n = sec(1.4);
  const out = stereo(n);
  const [rl, rr] = noisePair(seed);
  const hpL = new Biquad().highpass(1400);
  const hpR = new Biquad().highpass(1400);
  const bpL = new Biquad().bandpass(3200, 0.6);
  const bpR = new Biquad().bandpass(3500, 0.6);
  const body = new Sine();
  const sub = new Sine();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const b = body.next(45 + 150 * Math.exp(-t / 0.04)) * (t < 0.015 ? 1 : Math.exp(-(t - 0.015) / 0.22));
    const s = sub.next(xerp(52, 36, Math.min(1, t / 0.9))) * Math.exp(-t / 0.5) * 0.6;
    const low = Math.tanh((b + s) * 1.8) * 0.8;
    const crack = Math.exp(-t / 0.045) * 2.2;
    const e = edges(i, n, EDGE, ms(80));
    out.l[i] = (low + bpL.process(hpL.process(rl.noise())) * crack) * e;
    out.r[i] = (low + bpR.process(hpR.process(rr.noise())) * crack) * e;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/** Cinematic sub drop: 125 → 30 Hz sine with warm saturation, a punchy kick layer, thud and a long wide rumble. */
const boom = ({ seed }: Ctx): Rendered => {
  const n = sec(3.6);
  const out = stereo(n);
  const [rl, rr] = noisePair(seed);
  const drop = new Sine();
  const punch = new Sine();
  const satLp = new Biquad().lowpass(700);
  const thudL = new Biquad().lowpass(1800);
  const thudR = new Biquad().lowpass(1800);
  const rumL = [new Biquad().lowpass(140), new Biquad().lowpass(140)];
  const rumR = [new Biquad().lowpass(140), new Biquad().lowpass(140)];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const d = drop.next(30 + 95 * Math.exp(-t / 0.35)) * (t < 0.02 ? 1 : Math.exp(-(t - 0.02) / 1.1));
    const harmonics = satLp.process(Math.tanh(d * 2.5) - d) * 0.5;
    const p = punch.next(48 + 140 * Math.exp(-t / 0.05)) * Math.exp(-t / 0.25);
    const low = Math.tanh((d + harmonics + p * 0.8) * 1.4) * 0.8;
    const thud = Math.exp(-t / 0.12) * 1.2;
    const rum = Math.exp(-t / 1.4) * 3;
    const e = edges(i, n, EDGE, ms(300));
    const nl = rl.noise();
    const nr = rr.noise();
    out.l[i] = (low + thudL.process(nl) * thud + rumL[1].process(rumL[0].process(nl)) * rum) * e;
    out.r[i] = (low + thudR.process(nr) * thud + rumR[1].process(rumR[0].process(nr)) * rum) * e;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/** Light accent: short thump + bright snap + a glassy FM ping on a chord tone (climbs across runs). */
const hit = ({ cue, seed, run }: Ctx): Rendered => {
  const n = sec(0.7);
  const out = stereo(n);
  const [rl, rr] = noisePair(seed);
  const hpL = new Biquad().highpass(2500);
  const hpR = new Biquad().highpass(2500);
  const bpL = new Biquad().bandpass(6000, 0.8);
  const bpR = new Biquad().bandpass(6600, 0.8);
  const thump = new Sine();
  const ping = new Fm();
  const f = mtof(chordTones(chordAt(cue.beat), 76, 6)[run % 6]);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const th = Math.tanh(thump.next(65 + 85 * Math.exp(-t / 0.022)) * Math.exp(-t / 0.08) * 1.5) * 0.8;
    const fm = ping.next(f, f * 2, 1.8 * Math.exp(-t / 0.05) + 0.2) * Math.exp(-t / 0.16) * 0.45;
    const snap = Math.exp(-t / 0.016) * 2;
    const e = edges(i, n, EDGE, ms(50));
    out.l[i] = (th + fm + bpL.process(hpL.process(rl.noise())) * snap) * e;
    out.r[i] = (th + fm + bpR.process(hpR.process(rr.noise())) * snap) * e;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/** Metallic shield block: inharmonic plate modes (L/R detuned for shimmer) + FM clang + noise tick + low thunk. */
const clang = ({ seed }: Ctx): Rendered => {
  const n = sec(1.9);
  const out = stereo(n);
  const [rl, rr] = noisePair(seed);
  const f0 = mtof(64);
  const ratios = [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501, 4.06, 4.6];
  const modesL = ratios.map(() => new Sine());
  const modesR = ratios.map(() => new Sine());
  const clangOp = new Fm();
  const thunk = new Sine();
  const tickL = new Biquad().highpass(3000);
  const tickR = new Biquad().highpass(3000);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let l = 0;
    let r = 0;
    for (let k = 0; k < ratios.length; k++) {
      const amp = Math.exp(-t / (1.1 / (1 + 0.6 * k))) / (k + 1) ** 0.6;
      const side = k % 2 === 0 ? 0.35 : -0.35;
      l += modesL[k].next(f0 * ratios[k] * cents(-2.5)) * amp * (1 + side);
      r += modesR[k].next(f0 * ratios[k] * cents(2.5)) * amp * (1 - side);
    }
    const fm = clangOp.next(f0 * 2, f0 * 2 * 1.41, 5 * Math.exp(-t / 0.06) + 0.4) * Math.exp(-t / 0.25) * 0.9;
    const th = thunk.next(80 + 40 * Math.exp(-t / 0.03)) * Math.exp(-t / 0.07) * 0.8;
    const tick = Math.exp(-t / 0.008) * 1.5;
    const e = edges(i, n, EDGE, ms(150));
    out.l[i] = Math.tanh((l * 0.45 + fm + th + tickL.process(rl.noise()) * tick) * 1.2) * e;
    out.r[i] = Math.tanh((r * 0.45 + fm + th + tickR.process(rr.noise()) * tick) * 1.2) * e;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

// ─── Tonal pings ────────────────────────────────────────────────────────────

/** DX-style FM bell (1 : 3.5) on a chord tone around E6, plus a short octave strike partial, L/R detuned. */
const chime = ({ cue }: Ctx): Rendered => {
  const n = sec(1.8);
  const out = stereo(n);
  const f = mtof(chordTones(chordAt(cue.beat), 88, 1)[0]);
  const bl = new Fm();
  const br = new Fm();
  const strike = new Sine();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const index = 2.6 * Math.exp(-t / 0.12) + 0.25;
    const amp = Math.exp(-t / 0.7);
    const s = strike.next(f * 2) * Math.exp(-t / 0.08) * 0.35;
    const e = edges(i, n, EDGE, ms(150));
    out.l[i] = (bl.next(f * cents(-1), f * 3.5, index) * amp + s) * e;
    out.r[i] = (br.next(f * cents(1), f * 3.5, index) * amp + s) * e;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/** UI pip: short FM-rounded sine on a chord tone; consecutive blips climb the chord. */
const blip = ({ cue, run }: Ctx): Rendered => {
  const n = sec(0.16);
  const out = stereo(n);
  const f = mtof(chordTones(chordAt(cue.beat), 81, 8)[run % 8]);
  const op = new Fm();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v = op.next(f * (1 + 0.02 * Math.exp(-t / 0.01)), f, 0.8 * Math.exp(-t / 0.02)) * Math.exp(-t / 0.035);
    const e = edges(i, n, EDGE, ms(20));
    out.l[i] = v * e;
    out.r[i] = v * e;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/** Rising 32nd-note ticks over `len`, accented on every 8th (fork generations, logo stripes). */
const ticks = ({ cue, seed }: Ctx): Rendered => {
  const len = cue.len ?? 0.5;
  const step = at(0.125);
  const count = Math.max(1, Math.round(len * 8));
  const tickLen = ms(45);
  const out = stereo(step * (count - 1) + tickLen);
  const rng = new Rng(seed);
  for (let k = 0; k < count; k++) {
    const accent = k % 4 === 0;
    const f = xerp(1300, 3800, k / Math.max(1, count - 1));
    const g = accent ? 1 : 0.55;
    const pan = k % 2 === 0 ? -0.35 : 0.35;
    const osc = new Sine();
    const hp = new Biquad().highpass(4000);
    for (let i = 0; i < tickLen; i++) {
      const t = i / SR;
      const v =
        (osc.next(f) * Math.exp(-t / (accent ? 0.014 : 0.009)) + hp.process(rng.noise()) * Math.exp(-t / 0.003) * 0.6) *
        g *
        edges(i, tickLen, EDGE, ms(10));
      out.l[k * step + i] += v * panL(pan);
      out.r[k * step + i] += v * panR(pan);
    }
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/** A-minor-pentatonic blip stream in 64th notes climbing over `len`, for number counters. */
const countUp = ({ cue }: Ctx): Rendered => {
  const len = cue.len ?? 1;
  const step = at(1 / 16);
  const count = Math.max(1, Math.round(len * 16));
  const blipLen = ms(34);
  const out = stereo(step * (count - 1) + blipLen);
  const pent = [0, 3, 5, 7, 10];
  const span = 12;
  for (let k = 0; k < count; k++) {
    const p = k / Math.max(1, count - 1);
    const degree = Math.round(p * span);
    const f = mtof(69 + 12 * Math.floor(degree / 5) + pent[degree % 5]);
    const g = lerp(0.8, 1, p);
    const pan = 0.3 * Math.sin(k * 0.9);
    const osc = new Sine();
    const h2 = new Sine();
    for (let i = 0; i < blipLen; i++) {
      const t = i / SR;
      const v = (osc.next(f) + 0.25 * h2.next(2 * f)) * Math.exp(-t / 0.012) * g * edges(i, blipLen, EDGE, ms(8));
      out.l[k * step + i] += v * panL(pan);
      out.r[k * step + i] += v * panR(pan);
    }
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/** Keyboard: jittered keystrokes (band-passed click + small thock) for `len`, every ~8th one a heavier key. */
const type = ({ cue, seed }: Ctx): Rendered => {
  const dur = sec(bs(cue.len ?? 1));
  const keyLen = ms(40);
  const out = stereo(dur + keyLen);
  const rng = new Rng(seed);
  let pos = 0;
  let k = 0;
  while (pos < dur) {
    const heavy = k % 8 === 7;
    const vel = k === 0 ? 1 : rng.range(0.55, 1) * (heavy ? 1.1 : 1);
    const pan = rng.range(-0.2, 0.2);
    const bp = new Biquad().bandpass(rng.range(2400, 4200) * (heavy ? 0.6 : 1), 1.4);
    const thock = new Sine();
    const fThock = rng.range(160, 260) * (heavy ? 0.7 : 1);
    for (let i = 0; i < keyLen; i++) {
      const t = i / SR;
      const v =
        (bp.process(rng.noise()) * Math.exp(-t / (heavy ? 0.007 : 0.004)) * 2.5 +
          thock.next(fThock) * Math.exp(-t / 0.012) * 0.5) *
        vel *
        edges(i, keyLen, EDGE, ms(8));
      out.l[pos + i] += v * panL(pan);
      out.r[pos + i] += v * panR(pan);
    }
    pos += sec(rng.range(0.038, 0.068));
    k++;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

// ─── Transitions ────────────────────────────────────────────────────────────

/** Fast sweep: band-passed noise swelling over a short pre-roll, peaking on the beat, panning L → R. */
const whoosh = ({ cue, seed }: Ctx): Rendered => {
  const pre = sec(0.12);
  const post = sec(bs(cue.len ?? 0.7));
  const n = pre + post;
  const out = stereo(n);
  const [rl, rr] = noisePair(seed);
  const fl = new Svf();
  const fr = new Svf();
  for (let i = 0; i < n; i++) {
    const rise = i < pre;
    const p = rise ? i / pre : (i - pre) / post;
    if (i % CONTROL === 0) {
      const f = rise ? xerp(500, 4800, p) : xerp(4800, 700, p);
      fl.set(f, 1.3);
      fr.set(f * 1.08, 1.3);
    }
    fl.process(rl.noise());
    fr.process(rr.noise());
    const env = (rise ? p ** 2.5 : Math.exp(-(i - pre) / (0.11 * SR))) * edges(i, n, 0, ms(40));
    const pan = lerp(-0.8, 0.8, i / n);
    out.l[i] = fl.band * env * panL(pan);
    out.r[i] = fr.band * env * panR(pan);
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: -pre };
};

/** Riser over `len` beats: noise band-pass sweep + detuned saw glide A3 → A5, widening, accelerating tremolo; cuts on the next downbeat. */
const riser = ({ cue, seed }: Ctx): Rendered => {
  const n = at(cue.len ?? 1);
  const out = stereo(n);
  const common = new Rng(seed);
  const [rl, rr] = noisePair(seed);
  const nf = [new Svf(), new Svf()];
  const tf = new Svf();
  const sa = new Saw(0.2);
  const sb = new Saw(0.7);
  let tremPhase = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    if (i % CONTROL === 0) {
      const f = xerp(280, 9000, p ** 1.2);
      nf[0].set(f, 1.6);
      nf[1].set(f * 1.1, 1.6);
      tf.set(xerp(600, 6000, p), 0.9);
    }
    const c = common.noise();
    nf[0].process(lerp(c, rl.noise(), p));
    nf[1].process(lerp(c, rr.noise(), p));
    const f = xerp(mtof(57), mtof(81), p ** 1.4);
    tf.process(0.5 * sa.next(f * cents(-12)) + 0.5 * sb.next(f * cents(12)));
    tremPhase += (TAU * lerp(4, 22, p)) / SR;
    const trem = 0.75 + 0.25 * Math.cos(tremPhase);
    const env = p ** 2.2 * trem * edges(i, n, EDGE, ms(4));
    out.l[i] = (nf[0].band * 1.6 + tf.low * 0.35) * env;
    out.r[i] = (nf[1].band * 1.6 + tf.low * 0.35) * env;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/**
 * Reverse swell over `len` beats: a struck crash + chord bell + low boom is
 * rendered forward through its own reverb, then time-reversed so the tail
 * swells up and the attack lands exactly on `beat + len`.
 */
const reverse = ({ cue, seed }: Ctx): Rendered => {
  const n = at(cue.len ?? 1);
  const dry = stereo(n);
  const [rl, rr] = noisePair(seed);
  const hpL = new Biquad().highpass(3500);
  const hpR = new Biquad().highpass(3500);
  const target = chordTones(chordAt(cue.beat + (cue.len ?? 1)), 69, 4).map(mtof);
  const bells = target.map(() => new Sine());
  const low = new Sine();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let bell = 0;
    for (let k = 0; k < bells.length; k++) {
      bell += bells[k].next(target[k]) * Math.exp(-t / 0.9);
    }
    const crash = Math.exp(-t / 0.45) * 0.9;
    const b = low.next(45 + 20 * Math.exp(-t / 0.05)) * Math.exp(-t / 0.5) * 0.6;
    const e = edges(i, n, EDGE, EDGE);
    dry.l[i] = (hpL.process(rl.noise()) * crash + bell * 0.18 + b) * e;
    dry.r[i] = (hpR.process(rr.noise()) * crash + bell * 0.18 + b) * e;
  }
  const wet = reverb(dry, { room: 0.88, damp: 0.25, width: 1, predelayMs: 8, lowCut: 150, highCut: 12_000 });
  const out = stereo(n);
  for (let i = 0; i < n; i++) {
    const j = n - 1 - i;
    // Exponential growth into the end so the swell culminates on the target beat, not on the reversed reverb build-up.
    const swell = smooth(i / n) * Math.exp(-(n - 1 - i) / (0.18 * SR)) * edges(i, n, EDGE, ms(3));
    out.l[i] = (wet.l[j] * 5 + dry.l[j]) * swell;
    out.r[i] = (wet.r[j] * 5 + dry.r[j]) * swell;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/** Digital stutter: grid-locked 1/64–1/32-beat slices of crushed buzz, noise, zaps and repeats, each slice panned. */
const glitch = ({ cue, seed }: Ctx): Rendered => {
  const n = at(cue.len ?? 0.75);
  const out = stereo(n);
  const rng = new Rng(seed);
  // 4th-order low-pass keeps the crushed steps from turning into broadband clicks/aliasing fizz.
  const lpL = [new Biquad().lowpass(8000, 0.54), new Biquad().lowpass(8000, 1.31)];
  const lpR = [new Biquad().lowpass(8000, 0.54), new Biquad().lowpass(8000, 1.31)];
  const sliceLens = [at(1 / 64), at(1 / 32), at(1 / 32), at(1 / 16)];
  let prev = new Float32Array(0);
  let pos = 0;
  let first = true;
  while (pos < n) {
    const kind = first ? 'buzz' : rng.pick(['buzz', 'noise', 'zap', 'repeat', 'repeat', 'rest'] as const);
    // A repeat replays the previous slice at its own length (a true stutter, never a wrapped/cut copy).
    const pick = first ? at(1 / 32) : rng.pick(sliceLens);
    const len = Math.min(kind === 'repeat' && prev.length > 0 ? prev.length : pick, n - pos);
    const slice = new Float32Array(len);
    const hold = Math.floor(rng.range(2, 7));
    const levels = 2 ** Math.floor(rng.range(3, 6));
    const f = rng.pick([110, 220, 440, 880, 1760]);
    const sq = new Pulse(rng.next(), rng.range(0.2, 0.5));
    const zap = new Sine();
    let held = 0;
    for (let i = 0; i < len; i++) {
      let v = 0;
      if (kind === 'buzz') {
        v = sq.next(f);
      } else if (kind === 'noise') {
        v = rng.noise();
      } else if (kind === 'zap') {
        v = zap.next(xerp(4000, 150, i / len));
      } else if (kind === 'repeat' && prev.length > 0) {
        v = prev[i % prev.length];
      }
      if (i % hold === 0) {
        held = Math.round(v * levels) / levels;
      }
      slice[i] = kind === 'repeat' ? v : held;
    }
    if (kind !== 'rest' && kind !== 'repeat') {
      prev = slice;
    }
    const pan = first ? 0 : rng.range(-0.8, 0.8);
    const decay = 1 - (pos / n) ** 2;
    for (let i = 0; i < len; i++) {
      const v = slice[i] * edges(i, len) * decay;
      out.l[pos + i] = lpL[1].process(lpL[0].process(v * panL(pan)));
      out.r[pos + i] = lpR[1].process(lpR[0].process(v * panR(pan)));
    }
    pos += len;
    first = false;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

/** Airy sparkle: a seeded spray of FM glass grains on high chord tones plus a swelling band of air. */
const shimmer = ({ cue, seed }: Ctx): Rendered => {
  const n = sec(2.4);
  const out = stereo(n);
  const rng = new Rng(seed);
  const tones = chordTones(chordAt(cue.beat), 84, 10).map(mtof);
  for (let g = 0; g < 26; g++) {
    // The first grains strike on the beat; the rest spray out over ~1 s.
    const start = g < 3 ? ms(g * 25) : sec(1.1 * rng.next() ** 1.8);
    const f = g < 3 ? tones[tones.length - 1 - g * 2] : rng.pick(tones);
    const tau = rng.range(0.12, 0.35) * SR;
    const gain = g < 3 ? 1 : rng.range(0.3, 1);
    const pan = rng.range(-0.9, 0.9);
    const len = Math.min(n - start, Math.round(tau * 5));
    const op = new Fm();
    for (let i = 0; i < len; i++) {
      const v = op.next(f, f * 2, 0.6 * Math.exp(-i / tau)) * Math.exp(-i / tau) * gain * edges(i, len, ms(4), ms(20));
      out.l[start + i] += v * panL(pan);
      out.r[start + i] += v * panR(pan);
    }
  }
  const [rl, rr] = noisePair(seed);
  const hpL = new Biquad().highpass(7000);
  const hpR = new Biquad().highpass(7000);
  const pkL = new Biquad().peak(11_000, 1, 6);
  const pkR = new Biquad().peak(11_000, 1, 6);
  const swell = sec(0.25);
  for (let i = 0; i < n; i++) {
    const env = (i < swell ? smooth(i / swell) : Math.exp(-(i - swell) / (0.6 * SR))) * edges(i, n, EDGE, ms(200)) * 0.5;
    out.l[i] += pkL.process(hpL.process(rl.noise())) * env;
    out.r[i] += pkR.process(hpR.process(rr.noise())) * env;
  }
  normalize([out.l, out.r]);
  return { snd: out, offset: 0 };
};

const RENDER: Record<CueKind, (ctx: Ctx) => Rendered> = {
  impact,
  boom,
  hit,
  whoosh,
  riser,
  reverse,
  glitch,
  clang,
  chime,
  blip,
  type,
  ticks,
  countUp,
  shimmer,
};

/** Render every cue onto the SFX bus (with sends) and register its side-chain pressure. */
export const renderCues = (mix: Mixer, cues: readonly Cue[]): void => {
  const sorted = [...cues].sort((a, b) => a.beat - b.beat);
  const runs: Partial<Record<CueKind, { beat: number; run: number }>> = {};
  for (const cue of sorted) {
    const last = runs[cue.kind];
    const run = last && cue.beat - last.beat <= 0.5 ? last.run + 1 : 0;
    runs[cue.kind] = { beat: cue.beat, run };
    const { snd, offset } = RENDER[cue.kind]({ cue, seed: `${cue.kind}@${cue.beat}`, run });
    const m = SFX_MIX[cue.kind];
    const gain = db(m.gain) * (cue.gain ?? 1);
    mix.add('sfx', snd, cue.beat, { gain, rev: m.rev, dly: m.dly }, offset);
    if (m.duck) {
      mix.ducks.music.push({ beat: cue.beat, depth: m.duck.depth * Math.min(1, cue.gain ?? 1), tau: m.duck.tau });
      mix.ducks.bass.push({ beat: cue.beat, depth: Math.min(0.95, m.duck.depth * 1.2), tau: m.duck.tau });
    }
  }
};
