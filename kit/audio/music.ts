/**
 * The arrangement: which instruments play what in each `MUSIC` section.
 * Everything is placed on the beat grid; section-relative positions keep the
 * arrangement correct if the timeline is re-cut.
 */
import type { MusicSection } from '../timeline/define.ts';
import { CUES, MUSIC } from './video.ts';
import { db, EDGE, lerp, ms, Rng, smooth, xerp } from './dsp.ts';
import { bass, clap, crash, glitchPerc, hat, kick, pad, pluck, snare, stab, type KickOpts } from './instruments.ts';
import type { Mixer, Point } from './mixer.ts';
import { AM_WIDE, at, BREAK_HITS, bs, cadenceChord, chordAt, DRONE, type Chord } from './score.ts';

/** Instrument levels in dB — the music mix in one place. */
export const LEVELS = {
  kick: -2,
  clap: -1,
  hatClosed: -9,
  hatOpen: -8,
  roll: -2,
  perc: -7,
  bass: -3,
  pad: -14,
  arp: -8,
  stab: -9,
  crash: -11,
};

type Section = MusicSection;

const GROOVE_KICK: KickOpts = {};
const BIG_KICK: KickOpts = { f0: 200, f1: 46, decay: 0.3, seconds: 0.8, click: 0.6 };

/** Arp: 16-step index pattern into [voicing + 12, voicing + 24]. */
const ARP_PATTERN = [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 6, 5, 4, 3, 2];

const beatsIn = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let b = from; b < to - 1e-9; b += step) {
    out.push(b);
  }
  return out;
};

export const renderMusic = (mix: Mixer): void => {
  const rng = new Rng('arrangement');
  const kickCache = new Map<KickOpts, Float32Array>();

  const kickAt = (beat: number, opts: KickOpts, gainDb = 0, rev = 0): void => {
    let voice = kickCache.get(opts);
    if (!voice) {
      voice = kick(opts);
      kickCache.set(opts, voice);
    }
    const g = db(LEVELS.kick + gainDb);
    mix.add('kick', voice, beat, { gain: g, rev });
    mix.ducks.bass.push({ beat, depth: 0.92 * Math.min(1, g * 1.2), tau: 0.05 });
    mix.ducks.music.push({ beat, depth: 0.6 * Math.min(1, g * 1.2), tau: 0.13 });
  };

  const clapAt = (beat: number, gainDb = 0, rev = 0.18): void => {
    mix.add('drums', clap(0.085, `clap@${beat}`), beat, { gain: db(LEVELS.clap + gainDb), rev });
  };

  const hatAt = (beat: number, open: boolean, gainDb: number, tone = 0.5, pan = 0): void => {
    const level = open ? LEVELS.hatOpen : LEVELS.hatClosed;
    const jitter = rng.range(-1.2, 1.2);
    mix.add('drums', hat({ open, tone }, `hat@${beat}`), beat, { gain: db(level + gainDb + jitter), pan, rev: open ? 0.06 : 0 });
  };

  const bassAt = (beat: number, midi: number, gateBeats: number, cutoff: number, gainDb = 0): void => {
    mix.add('bass', bass({ midi, gate: at(gateBeats), cutoff }), beat, { gain: db(LEVELS.bass + gainDb) });
  };

  const padAt = (beat: number, chord: Chord, lenBeats: number, gainDb: number, o: { attack?: number; release?: number; cutoff?: number } = {}): void => {
    const voice = pad({
      notes: chord.voicing,
      gate: at(lenBeats),
      attack: o.attack ?? 0.08,
      release: o.release ?? 0.45,
      cutoff: o.cutoff ?? 2600,
      seed: `pad@${beat}`,
    });
    mix.add('music', voice, beat, { gain: db(LEVELS.pad + gainDb), rev: 0.3 });
  };

  /** Arp across [from, to) in `step`-beat notes; `cutoff`/`gainDb` may vary with progress p ∈ [0, 1]. */
  const arp = (from: number, to: number, step: number, cutoff: (p: number) => number, gainDb: (p: number) => number): void => {
    for (const beat of beatsIn(from, to, step)) {
      const p = (beat - from) / Math.max(step, to - from - step);
      const chord = chordAt(beat);
      const tones = [...chord.voicing.map((m) => m + 12), ...chord.voicing.map((m) => m + 24)];
      const idx = Math.round((beat - Math.floor(beat / 4) * 4) * 4) % 16;
      const midi = tones[ARP_PATTERN[idx]];
      const vel = idx % 4 === 0 ? 1 : idx % 2 === 0 ? 0.8 : 0.62;
      const voice = pluck({ midi, gate: Math.round(at(step) * 0.85), vel, cutoff: cutoff(p) });
      mix.add('music', voice, beat, { gain: db(LEVELS.arp + gainDb(p)), pan: idx % 2 === 0 ? -0.22 : 0.22, rev: 0.12, dly: 0.3 });
    }
  };

  /** Four-on-the-floor bars shared by groove / dark / build. */
  const beatBars = (
    s: Section,
    o: {
      hats: 'full' | 'sparse';
      clapBeats: readonly number[];
      bassCutoff: (p: number) => number;
      hatTone: (p: number) => number;
      /** dB offset for hats and bass over the section (the build's energy ramp). */
      lift: (p: number) => number;
      padGain: number;
      stabs: boolean;
      perc: boolean;
      /** Kick, clap, bass and open hats stop here (build drops out for its roll). */
      stop: number;
    },
  ): void => {
    for (const bar of beatsIn(s.from, s.to, 4)) {
      const chord = chordAt(bar);
      padAt(bar, chord, 4, o.padGain);
      for (let k = 0; k < 4; k++) {
        const beat = bar + k;
        const p = (beat - s.from) / (s.to - s.from);
        if (beat < o.stop) {
          kickAt(beat, GROOVE_KICK);
          if (o.clapBeats.includes(k)) {
            clapAt(beat, o.hats === 'sparse' ? -2 : 0, o.hats === 'sparse' ? 0.4 : 0.18);
          }
          bassAt(beat + 0.5, chord.root + (k === 3 ? 12 : 0), 0.38, o.bassCutoff(p), o.lift(p));
        }
        for (let q = 0; q < 4; q++) {
          const pos = beat + q / 4;
          const tone = o.hatTone(p);
          const lift = o.lift(p);
          if (q === 2) {
            if (pos < o.stop) {
              hatAt(pos, true, (o.hats === 'sparse' ? -3 : 0) + lift, tone, k % 2 === 0 ? 0.3 : -0.3);
            }
          } else if (o.hats === 'full') {
            hatAt(pos, false, (q === 0 ? -1 : q === 1 ? -5 : -2.5) + lift, tone, q === 1 ? -0.2 : 0.2);
          } else if (rng.chance(0.3)) {
            hatAt(pos, false, -6, tone * 0.6, rng.range(-0.5, 0.5));
          }
          if (o.perc && q !== 0 && rng.chance(0.24)) {
            mix.add('drums', glitchPerc(rng), pos, { gain: db(LEVELS.perc + rng.range(-3, 0)), pan: rng.range(-0.7, 0.7), dly: 0.25 });
          }
        }
      }
      if (o.stabs) {
        const odd = Math.round((bar - s.from) / 4) % 2 === 1;
        for (const off of odd ? [1.75, 3.5] : [3.5]) {
          mix.add('music', stab({ notes: chord.voicing.map((m) => m + 12), decay: 0.14, cutoff: 5000, seed: `stab@${bar + off}` }), bar + off, {
            gain: db(LEVELS.stab),
            rev: 0.2,
            dly: 0.22,
          });
        }
      }
    }
  };

  const crashAt = (beat: number, gainDb = 0): void => {
    mix.add('drums', crash(`crash@${beat}`), beat, { gain: db(LEVELS.crash + gainDb), rev: 0.25 });
  };

  const SECTIONS: Record<Section['name'], (s: Section) => void> = {
    intro: (s) => {
      const len = s.to - s.from;
      const mid = s.from + len / 2;
      padAt(s.from, DRONE, len, -6, { attack: bs(len * 0.6), release: 0.4, cutoff: 1600 });
      mix.add('bass', bass({ midi: DRONE.root, gate: at(len), attack: bs(len * 0.5), sub: 0.7, mid: 0.25, cutoff: 320, floor: 160 }), s.from, {
        gain: db(LEVELS.bass - 12),
      });
      // Filtered kick pulse and ticking hats build through the second half.
      for (const beat of beatsIn(mid, s.to, 1)) {
        const p = (beat - mid) / Math.max(1, s.to - 1 - mid);
        kickAt(beat, { decay: 0.16, lowpass: Math.round(xerp(220, 1600, p)) }, lerp(-15, -4, p));
      }
      for (const pos of beatsIn(mid, s.to, 0.25)) {
        const p = (pos - mid) / (s.to - mid);
        const q = Math.round((pos % 1) * 4);
        hatAt(pos, false, lerp(-16, -2, p) + (q === 0 ? 0 : q === 2 ? -2 : -5), p, q % 2 === 0 ? 0.15 : -0.15);
      }
    },

    sting: (s) => {
      const len = s.to - s.from;
      padAt(s.from, AM_WIDE, len - 0.5, 1, { attack: 0.02, release: bs(0.75), cutoff: 5200 });
      mix.add('music', stab({ notes: AM_WIDE.voicing, decay: 0.6, cutoff: 7000, seed: 'sting' }), s.from, { gain: db(LEVELS.stab + 2), rev: 0.5 });
      mix.add('bass', bass({ midi: AM_WIDE.root, gate: at(len - 1.5), attack: 0.4, sub: 0.8, mid: 0.2, cutoff: 400, floor: 200 }), s.from + 1, {
        gain: db(LEVELS.bass - 6),
      });
      // Half-time: kick on 1 and the "and" of 3, clap on 3.
      kickAt(s.from, BIG_KICK, 0, 0.1);
      crashAt(s.from, -2);
      kickAt(s.from + 2.5, GROOVE_KICK, -2);
      clapAt(s.from + 2, 0, 0.35);
      for (const pos of beatsIn(s.from + 0.5, s.to, 0.5)) {
        hatAt(pos, false, -5, 0.4, pos % 1 === 0 ? -0.2 : 0.2);
      }
      for (const pos of beatsIn(s.to - 1, s.to, 0.25)) {
        hatAt(pos + 0.125, false, lerp(-10, -4, pos - (s.to - 1)), 0.7, 0.3);
      }
      arp(
        s.from + 1,
        s.to,
        0.5,
        (p) => xerp(700, 2600, p),
        (p) => lerp(-5, -2, p),
      );
    },

    groove: (s) => {
      crashAt(s.from);
      beatBars(s, {
        hats: 'full',
        clapBeats: [1, 3],
        bassCutoff: () => 1400,
        hatTone: () => 0.55,
        lift: () => 0,
        padGain: 0,
        stabs: true,
        perc: false,
        stop: s.to,
      });
      arp(
        s.from,
        s.to,
        0.25,
        () => 2800,
        () => 0,
      );
    },

    dark: (s) => {
      beatBars(s, {
        hats: 'sparse',
        clapBeats: [3],
        bassCutoff: () => 300,
        hatTone: () => 0.35,
        lift: () => 0,
        padGain: -5,
        stabs: false,
        perc: true,
        stop: s.to,
      });
      // The arp creeps back in, filtered, over the last bar.
      arp(
        s.to - 4,
        s.to,
        0.5,
        (p) => xerp(600, 1800, p),
        (p) => lerp(-8, -3, p),
      );
    },

    build: (s) => {
      const stop = s.to - 1;
      crashAt(s.from, -2);
      beatBars(s, {
        hats: 'full',
        clapBeats: [1, 3],
        bassCutoff: (p) => xerp(300, 2400, p),
        hatTone: (p) => lerp(0.4, 1, p),
        lift: (p) => lerp(-4, 1, p),
        padGain: 0,
        stabs: false,
        perc: false,
        stop,
      });
      arp(
        s.from,
        s.to,
        0.25,
        (p) => xerp(700, 5500, p),
        (p) => lerp(-2, 1, p),
      );
      // Snare roll: 16ths, then 32nds, then 64ths over the last two beats, rising in pitch and level.
      const rollFrom = s.to - 2;
      const hits = [...beatsIn(rollFrom, s.to - 1, 0.25), ...beatsIn(s.to - 1, s.to - 0.5, 0.125), ...beatsIn(s.to - 0.5, s.to, 1 / 16)];
      for (const beat of hits) {
        const p = (beat - rollFrom) / 2;
        const voice = snare({ tune: lerp(0, 7, p), decay: lerp(0.12, 0.05, p), tone: p }, `roll@${beat}`);
        mix.add('drums', voice, beat, { gain: db(LEVELS.roll + lerp(-12, 0, p)), rev: 0.2 });
      }
    },

    break: (s) => {
      kickAt(s.from, BIG_KICK, 0, 0.25);
      padAt(s.from, chordAt(s.from), 1.5, -5, { attack: 0.05, release: bs(0.5) });
      arp(
        s.from,
        s.from + 2,
        0.5,
        (p) => xerp(1800, 700, p),
        (p) => lerp(-3, -10, p),
      );
      // Cadence stabs double the break's hit cues; the last one is short so the pre-drop gap is clean.
      BREAK_HITS.forEach((beat, idx) => {
        const chord = cadenceChord(idx);
        const last = idx === BREAK_HITS.length - 1;
        mix.add('music', stab({ notes: chord.voicing, decay: last ? 0.12 : 0.3, cutoff: 8000, seed: `cadence@${beat}` }), beat, {
          gain: db(LEVELS.stab + 7),
          rev: last ? 0.12 : 0.4,
          dly: 0.08,
        });
        bassAt(beat, chord.root + 12, last ? 0.3 : 0.45, 900, -8);
      });
    },

    finale: (s) => {
      const len = s.to - s.from;
      kickAt(s.from, BIG_KICK, 0, 0.3);
      crashAt(s.from, 1);
      padAt(s.from, AM_WIDE, len / 2, 1, { attack: 0.03, release: bs(len / 2 - 0.2), cutoff: 4200 });
      mix.add('music', stab({ notes: AM_WIDE.voicing, decay: 0.8, cutoff: 7000, seed: 'finale' }), s.from, { gain: db(LEVELS.stab + 4), rev: 0.55 });
      mix.add('bass', bass({ midi: AM_WIDE.root, gate: at(len / 2), attack: 0.25, sub: 0.8, mid: 0.15, cutoff: 300, floor: 160 }), s.from + 0.5, {
        gain: db(LEVELS.bass - 3),
      });
    },
  };

  for (const s of MUSIC) {
    SECTIONS[s.name](s);
  }
};

/** Music-bus low-pass automation (Hz): intro swell, dark closes down, build opens up. */
export const musicFilterLane = (): Point[] => {
  const shape: Record<Section['name'], (s: Section) => Point[]> = {
    intro: (s) => [
      [s.from, 300],
      [s.to - 0.01, 2600],
    ],
    sting: (s) => [
      [s.from, 9000],
      [s.to - 0.01, 12_000],
    ],
    groove: (s) => [
      [s.from, 18_000],
      [s.to - 0.01, 18_000],
    ],
    dark: (s) => [
      [s.from, 1000],
      [s.to - 2, 1100],
      [s.to - 0.01, 4000],
    ],
    build: (s) => [
      [s.from, 700],
      [s.to - 0.01, 18_000],
    ],
    break: (s) => [
      [s.from, 6000],
      [s.to - 0.01, 6000],
    ],
    finale: (s) => [
      [s.from, 9000],
      [s.to, 2500],
    ],
  };
  return MUSIC.flatMap((s) => shape[s.name](s));
};

/**
 * Per-sample gain for the music bus or the FX returns: the pre-drop gap at the
 * end of the break (only the reverse swell on the SFX bus is left), and — on
 * the music bus — 1/32-note chops under every `glitch` cue.
 */
export const gapGain = (n: number, target: 'music' | 'returns'): Float32Array => {
  const g = new Float32Array(n).fill(1);
  const brk = MUSIC.find((s) => s.name === 'break');
  if (brk) {
    const floor = 0.03;
    const fallFrom = at(brk.to - 0.75);
    const fallTo = at(brk.to - 0.5);
    // Music comes back right on the downbeat; the reverb/delay tails ease back in over an 16th.
    const riseFrom = target === 'music' ? at(brk.to) - ms(20) : at(brk.to);
    const riseTo = target === 'music' ? at(brk.to) : at(brk.to + 0.25);
    for (let i = fallFrom; i < Math.min(n, riseTo); i++) {
      if (i < fallTo) {
        g[i] = lerp(1, floor, smooth((i - fallFrom) / (fallTo - fallFrom)));
      } else if (i < riseFrom) {
        g[i] = floor;
      } else {
        g[i] = lerp(floor, 1, smooth((i - riseFrom) / (riseTo - riseFrom)));
      }
    }
  }
  if (target === 'music') {
    const slice = at(1 / 32);
    for (const cue of CUES.filter((c) => c.kind === 'glitch')) {
      for (let k = 1; k < 12; k += 2) {
        const from = at(cue.beat) + k * slice;
        for (let i = 0; i < slice && from + i < n; i++) {
          g[from + i] *= 1 - Math.min(1, i / EDGE, (slice - i) / EDGE);
        }
      }
    }
  }
  return g;
};
