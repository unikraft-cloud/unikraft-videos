/**
 * Procedural soundtrack for a video: deterministic, dependency-free, on the
 * same beat grid as the picture (videos/<id>/timeline.ts).
 *
 *   npm run soundtrack -- <id>           → public/audio/<id>.wav (48 kHz / 16-bit / stereo)
 *   npm run soundtrack -- <id> --stems   → also out/audio/<id>/stems/<bus>.wav (pre-master, common scale)
 *
 * Tweaking: MASTER (loudness target / ceiling) and BUS (bus balance) below,
 * LEVELS in music.ts (per instrument), SFX_MIX in sfx.ts (per cue kind).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BPM, CUES, TOTAL_BEATS, VIDEO } from './video.ts';
import { Biquad, db, Rng, smooth, softClip, SR, stereo, toDb, type Stereo } from './dsp.ts';
import { compress, limit, loudness, pingPong, reverb, truePeakDb } from './fx.ts';
import { applyDucks, gainBus, lowpassBus, Mixer, renderLane, type DryBus, type SendBus } from './mixer.ts';
import { FADE_BEATS, gapGain, musicFilterLane, renderMusic } from './music.ts';
import { at, TOTAL_SAMPLES } from './score.ts';
import { renderCues } from './sfx.ts';

const MASTER = {
  /** Integrated loudness target (LUFS). */
  lufs: -14,
  /** Limiter ceiling (dBTP); lowered automatically if the measured true peak exceeds `maxTruePeak`. */
  ceiling: -1.3,
  maxTruePeak: -1,
  /** Soft-clip knee (linear) ahead of the limiter. */
  clipKnee: 0.6,
};

/** Bus faders (dB) into the master. */
const BUS: Record<DryBus | SendBus, number> = { kick: 0, drums: 2, bass: 0, music: 0, sfx: 2, rev: 4, dly: 5 };

const started = performance.now();
const n = TOTAL_SAMPLES;

// ─── Render ─────────────────────────────────────────────────────────────────

const mix = new Mixer(n);
renderMusic(mix);
renderCues(mix, CUES);
const { buses } = mix;

applyDucks(buses.bass, mix.ducks.bass);
applyDucks(buses.music, mix.ducks.music);
lowpassBus(buses.music, renderLane(n, musicFilterLane(), true), 0.75);
gainBus(buses.music, gapGain(n, 'music'));

// Dotted-8th ping-pong; its echoes also feed the reverb a little.
const dly = pingPong(buses.dly, at(0.75), 0.38, 280, 5500);
for (let i = 0; i < n; i++) {
  buses.rev.l[i] += dly.l[i] * 0.25;
  buses.rev.r[i] += dly.r[i] * 0.25;
}
const rev = reverb(buses.rev, { room: 0.82, damp: 0.35, width: 1, predelayMs: 18, lowCut: 250, highCut: 9000 });
const returnsGap = gapGain(n, 'returns');
gainBus(rev, returnsGap);
gainBus(dly, returnsGap);

const stems = Object.entries({ ...buses, rev, dly }) as [keyof typeof BUS, Stereo][];
const sum = stereo(n);
for (const [name, bus] of stems) {
  const g = db(BUS[name]);
  for (let i = 0; i < n; i++) {
    sum.l[i] += bus.l[i] * g;
    sum.r[i] += bus.r[i] * g;
  }
}

// ─── Master ─────────────────────────────────────────────────────────────────

const scale = (s: Stereo, g: number): void => {
  for (let i = 0; i < s.l.length; i++) {
    s.l[i] *= g;
    s.r[i] *= g;
  }
};

// DC/rumble high-pass at 20 Hz, and mono below 120 Hz (side channel high-passed).
{
  const hpL = new Biquad().highpass(20);
  const hpR = new Biquad().highpass(20);
  const side = new Biquad().highpass(120);
  for (let i = 0; i < n; i++) {
    const l = hpL.process(sum.l[i]);
    const r = hpR.process(sum.r[i]);
    const m = (l + r) / 2;
    const s = side.process((l - r) / 2);
    sum.l[i] = m + s;
    sum.r[i] = m - s;
  }
}

// Glue: normalise to a known level, then gentle 2:1 bus compression.
const preGain = db(-20 - loudness(sum).integrated);
scale(sum, preGain);
const glueGr = compress(sum, { thresholdDb: -16, ratio: 2, kneeDb: 6, attackMs: 12, releaseMs: 160 });

// Master fade to digital silence over the end (length set by the last section, see music.ts).
const fade = new Float32Array(n).fill(1);
{
  const from = at(TOTAL_BEATS - FADE_BEATS);
  for (let i = from; i < n; i++) {
    fade[i] = 1 - smooth((i - from) / (n - 1 - from));
  }
}

const master = (gain: number, ceilingDb: number): Stereo => {
  const out = stereo(n);
  for (let i = 0; i < n; i++) {
    out.l[i] = softClip(sum.l[i] * gain, MASTER.clipKnee);
    out.r[i] = softClip(sum.r[i] * gain, MASTER.clipKnee);
  }
  limit(out, db(ceilingDb), Math.round(SR * 0.003), 80);
  gainBus(out, fade);
  return out;
};

// Iterate drive into the clipper/limiter until integrated loudness hits the target and true peak is within spec.
let gain = db(MASTER.lufs - loudness(sum).integrated);
let ceiling = MASTER.ceiling;
let out = master(gain, ceiling);
let level = loudness(out);
let peak = truePeakDb(out);
for (let pass = 0; pass < 10 && (Math.abs(level.integrated - MASTER.lufs) > 0.05 || peak > MASTER.maxTruePeak); pass++) {
  if (peak > MASTER.maxTruePeak) {
    ceiling -= peak - MASTER.maxTruePeak + 0.05;
  } else {
    gain *= db(MASTER.lufs - level.integrated);
  }
  out = master(gain, ceiling);
  level = loudness(out);
  peak = truePeakDb(out);
}

// ─── Write ──────────────────────────────────────────────────────────────────

/** 16-bit PCM stereo WAV. With `dither`, TPDF dither scaled by the master fade so the tail is exact digital silence. */
const wav = (s: Stereo, dither: Float32Array | null): Buffer => {
  const frames = s.l.length;
  const buf = Buffer.alloc(44 + frames * 4);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + frames * 4, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(frames * 4, 40);
  const rng = new Rng('dither');
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < 2; c++) {
      const x = (c === 0 ? s.l : s.r)[i] * 32767;
      const d = dither ? (rng.next() - rng.next()) * dither[i] : 0;
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x + d))), 44 + i * 4 + c * 2);
    }
  }
  return buf;
};

const outPath = fileURLToPath(new URL(`../../public/audio/${VIDEO.id}.wav`, import.meta.url));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, wav(out, fade));

let samplePeak = 0;
let drivenPeak = 0;
let dcL = 0;
let dcR = 0;
for (let i = 0; i < n; i++) {
  samplePeak = Math.max(samplePeak, Math.abs(out.l[i]), Math.abs(out.r[i]));
  drivenPeak = Math.max(drivenPeak, Math.abs(sum.l[i]), Math.abs(sum.r[i]));
  dcL += out.l[i];
  dcR += out.r[i];
}

// Buses at their fader level and the master's pre-gain, for the report and `--stems`.
const scaledStems = stems.map(([name, bus]): [string, Stereo] => {
  const copy = { l: Float32Array.from(bus.l), r: Float32Array.from(bus.r) };
  scale(copy, preGain * db(BUS[name]));
  return [name, copy];
});
const busLoudness = scaledStems.map(([name, s]) => `${name} ${loudness(s).integrated.toFixed(1)}`).join(' · ');

console.log(
  [
    `Wrote ${outPath}`,
    `  ${(n / SR).toFixed(3)} s · ${n} frames · ${SR} Hz · 16-bit stereo · ${BPM} BPM · ${TOTAL_BEATS} beats · ${CUES.length} cues`,
    `  loudness ${level.integrated.toFixed(2)} LUFS integrated · short-term max ${level.shortTermMax.toFixed(1)} LUFS`,
    `  peaks    ${peak.toFixed(2)} dBTP true · ${toDb(samplePeak).toFixed(2)} dBFS sample · limiter ceiling ${ceiling.toFixed(2)} dBTP`,
    `  master   drive ${toDb(gain).toFixed(1)} dB · glue GR max ${glueGr.toFixed(1)} dB · clip+limit peak reduction ${(toDb(drivenPeak * gain) - peak).toFixed(1)} dB`,
    `  dc       L ${(dcL / n).toExponential(1)} · R ${(dcR / n).toExponential(1)}`,
    `  buses (LUFS, pre-master) ${busLoudness}`,
    `  rendered in ${((performance.now() - started) / 1000).toFixed(1)} s`,
  ].join('\n'),
);

if (process.argv.includes('--stems')) {
  const dir = fileURLToPath(new URL(`../../out/audio/${VIDEO.id}/stems/`, import.meta.url));
  mkdirSync(dir, { recursive: true });
  let stemPeak = 0;
  for (const [, s] of scaledStems) {
    for (let i = 0; i < n; i++) {
      stemPeak = Math.max(stemPeak, Math.abs(s.l[i]), Math.abs(s.r[i]));
    }
  }
  // One common factor for all stems so their relative levels stay meaningful.
  for (const [name, s] of scaledStems) {
    scale(s, 0.98 / stemPeak);
    writeFileSync(`${dir}${name}.wav`, wav(s, null));
  }
  console.log(`  stems → ${dir} (common scale, loudest stem peak ${toDb(stemPeak).toFixed(1)} dBFS before normalising)`);
}
