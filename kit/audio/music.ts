/**
 * The arrangement: which instruments play what in each `MUSIC` section.
 * Everything is placed on the beat grid; section-relative positions keep the
 * arrangement correct if the timeline is re-cut, at any grid-exact tempo and
 * any section length (a partial last bar is clipped, never spilled).
 *
 * `MusicSection.energy` sets each section's density — the same track, calmer or harder:
 *   0  pads, drone and bass only: no drums, no arp
 *   1  half-time: kick on 1 and the "and" of 3, clap on 3, 8th hats, 8th-note filtered arp, few stabs
 *   2  the promo arrangement (four on the floor, 16th hats and arp) — unchanged
 *   3  lifted: extra perc, hotter hats, stabs every bar, brighter filter, a longer build roll
 *
 * Long sections vary per phrase (never inside the promo's short sections): a drum fill closes
 * every 4-bar phrase, a crash opens the next, the arp pattern changes every 4 bars, the pad
 * voicing inverts every 8 (4 at energy 0), and sparse sections get a pluck motif per phrase.
 */
import type { MusicSection } from '../timeline/define.ts';
import type { Energy } from '../timeline/presets.ts';
import { CUES, MUSIC } from './video.ts';
import { db, EDGE, lerp, ms, Rng, smooth, xerp } from './dsp.ts';
import { bass, clap, crash, glitchPerc, hat, kick, pad, pluck, snare, stab, type KickOpts } from './instruments.ts';
import type { Mixer, Point } from './mixer.ts';
import { AM_WIDE, at, breakHits, bs, cadenceChord, chordAt, DRONE, type Chord } from './score.ts';

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
/** One value per energy level, indexed by `Energy`. */
type PerEnergy = readonly [e0: number, e1: number, e2: number, e3: number];

const GROOVE_KICK: KickOpts = {};
const BIG_KICK: KickOpts = { f0: 200, f1: 46, decay: 0.3, seconds: 0.8, click: 0.6 };

/** Arp: 16-step index patterns into [voicing + 12, voicing + 24], one per 4-bar phrase (A · B · A · C …). */
const ARP_PATTERN = [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 6, 5, 4, 3, 2];
const ARP_PATTERNS: readonly (readonly number[])[] = [
  ARP_PATTERN,
  [0, 2, 4, 6, 4, 2, 1, 3, 5, 3, 1, 3, 5, 7, 6, 4],
  ARP_PATTERN,
  [7, 5, 4, 2, 6, 4, 3, 1, 5, 3, 2, 0, 4, 2, 1, 3],
];

/** Half-time bass per bar: [offset, gate (beats), octave, dB]. */
const HALF_BASS: readonly (readonly [number, number, number, number])[] = [
  [0, 1.4, 0, -2],
  [2.5, 0.4, 0, -1],
  [3.5, 0.35, 12, -3],
];

const beatsIn = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let b = from; b < to - 1e-9; b += step) {
    out.push(b);
  }
  return out;
};

/** Pad voicing for bar `i` of a section: every other 8-bar phrase (4-bar at energy 0) lifts its lowest note an octave. */
const phraseChord = (chord: Chord, i: number, e: Energy): Chord =>
  Math.floor(i / (e === 0 ? 4 : 8)) % 2 === 1 ? { ...chord, voicing: [...chord.voicing.slice(1), chord.voicing[0] + 12] } : chord;

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

  /** Sustained root for a whole bar (energy 0 and breakdowns): soft attack, dark, no pluck. */
  const droneBassAt = (beat: number, midi: number, lenBeats: number, gainDb: number): void => {
    const voice = bass({ midi, gate: at(Math.max(0.5, lenBeats - 0.1)), attack: 0.25, sub: 0.8, mid: 0.2, cutoff: 300, floor: 150 });
    mix.add('bass', voice, beat, { gain: db(LEVELS.bass + gainDb) });
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

  /**
   * Arp across [from, to) in `step`-beat notes; `cutoff`/`gainDb` may vary with progress p ∈ [0, 1].
   * The pattern follows the 4-bar phrase within section `s`.
   */
  const arp = (s: Section, from: number, to: number, step: number, cutoff: (p: number) => number, gainDb: (p: number) => number): void => {
    for (const beat of beatsIn(from, to, step)) {
      const p = (beat - from) / Math.max(step, to - from - step);
      const chord = chordAt(beat);
      const tones = [...chord.voicing.map((m) => m + 12), ...chord.voicing.map((m) => m + 24)];
      const idx = Math.round((beat - Math.floor(beat / 4) * 4) * 4) % 16;
      const pattern = ARP_PATTERNS[Math.floor((beat - s.from) / 16) % ARP_PATTERNS.length];
      const midi = tones[pattern[idx] % tones.length];
      const vel = idx % 4 === 0 ? 1 : idx % 2 === 0 ? 0.8 : 0.62;
      const voice = pluck({ midi, gate: Math.round(at(step) * 0.85), vel, cutoff: cutoff(p) });
      mix.add('music', voice, beat, { gain: db(LEVELS.arp + gainDb(p)), pan: idx % 2 === 0 ? -0.22 : 0.22, rev: 0.12, dly: 0.3 });
    }
  };

  /** A soft, seeded three-note pluck figure on `chord`: marks a new phrase in long, sparse sections. */
  const motif = (beat: number, chord: Chord, gainDb: number, end: number): void => {
    const r = new Rng(`motif@${beat}`);
    const tones = chord.voicing.map((m) => m + 12);
    [0, 0.75, 1.5].forEach((off, j) => {
      if (beat + off < end) {
        const voice = pluck({ midi: r.pick(tones), gate: at(1), vel: 0.75 - j * 0.1, cutoff: 1100, decay: 0.45 });
        mix.add('music', voice, beat + off, { gain: db(LEVELS.arp + gainDb), pan: r.range(-0.4, 0.4), rev: 0.35, dly: 0.35 });
      }
    });
  };

  const crashAt = (beat: number, gainDb = 0): void => {
    mix.add('drums', crash(`crash@${beat}`), beat, { gain: db(LEVELS.crash + gainDb), rev: 0.25 });
  };

  /** Snare run closing the bar at `bar` (end of a 4-bar phrase): longer and louder with energy, variant seeded per bar. */
  const fill = (bar: number, e: Energy): void => {
    const r = new Rng(`fill@${bar}`);
    const from = bar + (e === 1 ? 3.5 : e === 3 ? 2 : r.chance(0.5) ? 3 : 2.5);
    const to = bar + 4;
    for (const beat of beatsIn(from, to, 0.25)) {
      const p = (beat - from) / (to - from);
      const voice = snare({ tune: lerp(0, 5, p), decay: lerp(0.11, 0.07, p), tone: lerp(0.3, 0.8, p) }, `fill@${beat}`);
      mix.add('drums', voice, beat, { gain: db(LEVELS.roll + lerp(e === 1 ? -12 : -9, e === 1 ? -7 : -1, p)), pan: r.range(-0.25, 0.25), rev: 0.2 });
    }
  };

  /** Bars shared by groove / dark / build, at the section's energy. */
  const beatBars = (
    s: Section,
    o: {
      hats: 'full' | 'sparse';
      clapBeats: readonly number[];
      /** Energy 1: kick and clap offsets within the bar. */
      halfKicks: readonly number[];
      halfClaps: readonly number[];
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
    const e = s.energy;
    const sparse = o.hats === 'sparse';
    const bars = beatsIn(s.from, s.to, 4);
    const extra = new Rng(`lift@${s.from}`);
    bars.forEach((bar, i) => {
      const chord = chordAt(bar);
      const barEnd = Math.min(bar + 4, s.to);
      const pBar = (bar - s.from) / (s.to - s.from);
      padAt(bar, phraseChord(chord, i, e), barEnd - bar, o.padGain + ([2, 1, 0, 0] as PerEnergy)[e] + (e === 0 ? o.lift(pBar) * 0.5 : 0));
      if (e >= 2) {
        const hot = e === 3 ? 1.5 : 0;
        for (let k = 0; k < 4; k++) {
          const beat = bar + k;
          if (beat >= s.to) {
            break;
          }
          const p = (beat - s.from) / (s.to - s.from);
          if (beat < o.stop) {
            kickAt(beat, GROOVE_KICK);
            if (o.clapBeats.includes(k)) {
              clapAt(beat, (sparse ? -2 : 0) + (e === 3 ? 1 : 0), sparse ? 0.4 : 0.18);
            }
            bassAt(beat + 0.5, chord.root + (k === 3 ? 12 : 0), 0.38, o.bassCutoff(p) * (e === 3 ? 1.3 : 1), o.lift(p));
          }
          for (let q = 0; q < 4; q++) {
            const pos = beat + q / 4;
            if (pos >= s.to) {
              break;
            }
            const tone = o.hatTone(p);
            const lift = o.lift(p);
            if (q === 2) {
              if (pos < o.stop) {
                hatAt(pos, true, (sparse ? -3 : 0) + lift + hot, tone, k % 2 === 0 ? 0.3 : -0.3);
              }
            } else if (!sparse) {
              hatAt(pos, false, (q === 0 ? -1 : q === 1 ? -5 : -2.5) + lift + hot, tone, q === 1 ? -0.2 : 0.2);
            } else if (rng.chance(0.3)) {
              hatAt(pos, false, -6, tone * 0.6, rng.range(-0.5, 0.5));
            }
            if (o.perc && q !== 0 && rng.chance(0.24)) {
              mix.add('drums', glitchPerc(rng), pos, { gain: db(LEVELS.perc + rng.range(-3, 0)), pan: rng.range(-0.7, 0.7), dly: 0.25 });
            }
            if (e === 3 && q % 2 === 1 && extra.chance(0.3)) {
              mix.add('drums', glitchPerc(extra), pos, { gain: db(LEVELS.perc - 2 + extra.range(-3, 0)), pan: extra.range(-0.8, 0.8), dly: 0.2 });
            }
          }
        }
      } else if (e === 1) {
        const halfStop = Math.min(o.stop, s.to);
        const lift = o.lift(pBar);
        for (const off of o.halfKicks) {
          if (bar + off < halfStop) {
            kickAt(bar + off, GROOVE_KICK, off === 0 ? 0 : -2);
          }
        }
        for (const off of o.halfClaps) {
          if (bar + off < halfStop) {
            clapAt(bar + off, sparse ? -3 : -1, sparse ? 0.45 : 0.3);
          }
        }
        for (const [off, gate, octave, gainDb] of HALF_BASS) {
          if (bar + off < halfStop) {
            bassAt(bar + off, chord.root + octave, gate, o.bassCutoff(pBar) * 0.8, lift + gainDb);
          }
        }
        for (const pos of beatsIn(bar, barEnd, 0.5)) {
          const pp = (pos - s.from) / (s.to - s.from);
          const tone = o.hatTone(pp) * 0.85;
          const offbeat = pos % 1 !== 0;
          if (!sparse) {
            hatAt(pos, false, (offbeat ? -1 : -4) + o.lift(pp), tone, offbeat ? 0.2 : -0.2);
            if (pos - bar === 3.5 && pos < o.stop) {
              hatAt(pos, true, -4 + o.lift(pp), tone, 0.3);
            }
          } else if (rng.chance(0.35)) {
            hatAt(pos, false, -6, tone * 0.6, rng.range(-0.5, 0.5));
          }
          if (o.perc && offbeat && rng.chance(0.12)) {
            mix.add('drums', glitchPerc(rng), pos, { gain: db(LEVELS.perc - 2 + rng.range(-3, 0)), pan: rng.range(-0.7, 0.7), dly: 0.3 });
          }
        }
      } else {
        droneBassAt(bar, chord.root, barEnd - bar, -7);
      }
      if (o.stabs && e > 0) {
        const odd = Math.round((bar - s.from) / 4) % 2 === 1;
        const offs = e === 1 ? (odd ? [3.5] : []) : e === 3 || odd ? [1.75, 3.5] : [3.5];
        for (const off of offs.filter((x) => bar + x < s.to)) {
          mix.add('music', stab({ notes: chord.voicing.map((m) => m + 12), decay: 0.14, cutoff: e === 1 ? 3500 : 5000, seed: `stab@${bar + off}` }), bar + off, {
            gain: db(LEVELS.stab + ([0, -2, 0, 1] as PerEnergy)[e]),
            rev: 0.2,
            dly: 0.22,
          });
        }
      }
      // Phrase variation for long sections: fill into every new 4-bar phrase, crash on its downbeat.
      if (e > 0 && (i + 1) % 4 === 0 && i < bars.length - 1 && bar + 4 <= o.stop) {
        fill(bar, e);
      }
      if (e > 0 && i > 0 && i % (e === 1 ? 8 : 4) === 0) {
        crashAt(bar, ([0, -5, -3, -1] as PerEnergy)[e]);
      }
      if (e <= 1 && i > 0 && i % 4 === 0 && (e === 1 || sparse)) {
        motif(bar + 0.5, chord, e === 0 ? -8 : -5, barEnd);
      }
    });
  };

  const SECTIONS: Record<Section['name'], (s: Section) => void> = {
    intro: (s) => {
      const e = s.energy;
      const len = s.to - s.from;
      const mid = s.from + len / 2;
      padAt(s.from, DRONE, len, -6, { attack: bs(Math.min(len * 0.6, 16)), release: 0.4, cutoff: 1600 });
      mix.add('bass', bass({ midi: DRONE.root, gate: at(len), attack: bs(Math.min(len * 0.5, 16)), sub: 0.7, mid: 0.25, cutoff: 320, floor: 160 }), s.from, {
        gain: db(LEVELS.bass - 12),
      });
      // Filtered kick pulse and ticking hats build through the second half (at most the last 4 bars; 2 at energy 1).
      if (e > 0) {
        const pulseFrom = Math.max(mid, s.to - (e === 1 ? 8 : 16));
        const trim = e === 1 ? -3 : 0;
        for (const beat of beatsIn(pulseFrom, s.to, e === 1 ? 2 : 1)) {
          const p = (beat - pulseFrom) / Math.max(1, s.to - 1 - pulseFrom);
          kickAt(beat, { decay: 0.16, lowpass: Math.round(xerp(220, 1600, p)) }, lerp(-15, -4, p) + trim);
        }
        for (const pos of beatsIn(pulseFrom, s.to, e === 1 ? 0.5 : 0.25)) {
          const p = (pos - pulseFrom) / (s.to - pulseFrom);
          const q = Math.round((pos % 1) * 4);
          hatAt(pos, false, lerp(-16, -2, p) + (q === 0 ? 0 : q === 2 ? -2 : -5) + trim + (e === 3 ? 1 : 0), p, q % 2 === 0 ? 0.15 : -0.15);
          if (e === 3 && q === 2 && pos >= s.to - 4) {
            hatAt(pos, true, -6, p, 0.3);
          }
        }
        for (const bar of beatsIn(s.from + 16, s.to, 16)) {
          motif(bar, DRONE, e === 1 ? -7 : -5, s.to);
        }
      }
    },

    sting: (s) => {
      const e = s.energy;
      const len = s.to - s.from;
      padAt(s.from, AM_WIDE, len - 0.5, 1, { attack: 0.02, release: bs(0.75), cutoff: 5200 });
      mix.add('music', stab({ notes: AM_WIDE.voicing, decay: 0.6, cutoff: 7000, seed: 'sting' }), s.from, {
        gain: db(LEVELS.stab + ([-4, -1.5, 2, 3] as PerEnergy)[e]),
        rev: 0.5,
      });
      mix.add('bass', bass({ midi: AM_WIDE.root, gate: at(len - 1.5), attack: 0.4, sub: 0.8, mid: 0.2, cutoff: 400, floor: 200 }), s.from + 1, {
        gain: db(LEVELS.bass - 6),
      });
      if (e === 0) {
        return;
      }
      // Half-time: kick on 1 and the "and" of 3, clap on 3 — every bar.
      kickAt(s.from, BIG_KICK, ([0, -2, 0, 0] as PerEnergy)[e], 0.1);
      crashAt(s.from, ([0, -4, -2, 0] as PerEnergy)[e]);
      for (const bar of beatsIn(s.from, s.to, 4)) {
        if (bar > s.from) {
          kickAt(bar, GROOVE_KICK);
        }
        if (bar + 2.5 < s.to) {
          kickAt(bar + 2.5, GROOVE_KICK, -2);
        }
        if (bar + 2 < s.to) {
          clapAt(bar + 2, ([0, -2, 0, 1] as PerEnergy)[e], 0.35);
        }
      }
      const trim = e === 1 ? -3 : 0;
      for (const pos of beatsIn(s.from + 0.5, s.to, 0.5)) {
        hatAt(pos, false, -5 + trim, 0.4, pos % 1 === 0 ? -0.2 : 0.2);
        if (e === 3 && pos % 1 !== 0) {
          hatAt(pos, true, -4, 0.5, 0.3);
        }
      }
      for (const pos of beatsIn(s.to - 1, s.to, 0.25)) {
        hatAt(pos + 0.125, false, lerp(-10, -4, pos - (s.to - 1)) + trim, 0.7, 0.3);
      }
      arp(
        s,
        s.from + 1,
        s.to,
        0.5,
        (p) => xerp(700, 2600, p) * ([1, 0.7, 1, 1.3] as PerEnergy)[e],
        (p) => lerp(-5, -2, p) + ([0, -2, 0, 1] as PerEnergy)[e],
      );
    },

    groove: (s) => {
      const e = s.energy;
      if (e > 0) {
        crashAt(s.from, ([0, -4, 0, 1] as PerEnergy)[e]);
      }
      beatBars(s, {
        hats: 'full',
        clapBeats: [1, 3],
        halfKicks: [0, 2.5],
        halfClaps: [2],
        bassCutoff: () => 1400,
        hatTone: () => 0.55,
        lift: () => 0,
        padGain: 0,
        stabs: true,
        perc: false,
        stop: s.to,
      });
      if (e > 0) {
        arp(
          s,
          s.from,
          s.to,
          e === 1 ? 0.5 : 0.25,
          () => 2800 * ([1, 0.55, 1, 1.4] as PerEnergy)[e],
          () => ([0, -2, 0, 1] as PerEnergy)[e],
        );
      }
    },

    dark: (s) => {
      const e = s.energy;
      beatBars(s, {
        hats: 'sparse',
        clapBeats: [3],
        halfKicks: [0],
        halfClaps: [2],
        bassCutoff: () => 300,
        hatTone: () => 0.35,
        lift: () => 0,
        padGain: -5,
        stabs: false,
        perc: true,
        stop: s.to,
      });
      // The arp creeps back in, filtered, over the last bar.
      if (e > 0) {
        arp(
          s,
          Math.max(s.from, s.to - 4),
          s.to,
          0.5,
          (p) => xerp(600, 1800, p) * ([1, 0.8, 1, 1.3] as PerEnergy)[e],
          (p) => lerp(-8, -3, p) + ([0, -2, 0, 1] as PerEnergy)[e],
        );
      }
    },

    build: (s) => {
      const e = s.energy;
      const stop = s.to - 1;
      if (e > 0) {
        crashAt(s.from, ([0, -5, -2, 0] as PerEnergy)[e]);
      }
      beatBars(s, {
        hats: 'full',
        clapBeats: [1, 3],
        halfKicks: [0, 2.5],
        halfClaps: [2],
        bassCutoff: (p) => xerp(300, 2400, p),
        hatTone: (p) => lerp(0.4, 1, p),
        lift: (p) => lerp(-4, 1, p),
        padGain: 0,
        stabs: false,
        perc: false,
        stop,
      });
      if (e === 0) {
        return;
      }
      arp(
        s,
        s.from,
        s.to,
        e === 1 ? 0.5 : 0.25,
        (p) => xerp(700, 5500, p) * ([1, 0.7, 1, 1.3] as PerEnergy)[e],
        (p) => lerp(-2, 1, p) + ([0, -3, 0, 1] as PerEnergy)[e],
      );
      // Snare roll, rising in pitch and level. Energy 2: 16ths, then 32nds, then 64ths over the last two beats;
      // 1: 8ths then 16ths; 3: four beats, 16ths → 32nds → 64ths. Long builds get a quarter-note snare pulse first.
      const rollLen = Math.min(e === 3 ? 4 : 2, s.to - s.from);
      const rollFrom = s.to - rollLen;
      const hits =
        e === 1
          ? [...beatsIn(rollFrom, s.to - 1, 0.5), ...beatsIn(s.to - 1, s.to, 0.25)]
          : e === 2
            ? [...beatsIn(rollFrom, s.to - 1, 0.25), ...beatsIn(s.to - 1, s.to - 0.5, 0.125), ...beatsIn(s.to - 0.5, s.to, 1 / 16)]
            : [...beatsIn(rollFrom, s.to - 2, 0.25), ...beatsIn(s.to - 2, s.to - 1, 0.125), ...beatsIn(s.to - 1, s.to, 1 / 16)];
      const trim = ([0, -4, 0, 1] as PerEnergy)[e];
      for (const beat of hits) {
        const p = (beat - rollFrom) / rollLen;
        const voice = snare({ tune: lerp(0, 7, p), decay: lerp(0.12, 0.05, p), tone: p }, `roll@${beat}`);
        mix.add('drums', voice, beat, { gain: db(LEVELS.roll + lerp(-12, 0, p) + trim), rev: 0.2 });
      }
      if (e >= 2 && s.to - s.from >= 16) {
        for (const beat of beatsIn(Math.max(s.from, rollFrom - 4), rollFrom, 1)) {
          const p = (beat - (rollFrom - 4)) / 4;
          mix.add('drums', snare({ tune: 0, decay: 0.12, tone: 0.4 }, `pulse@${beat}`), beat, { gain: db(LEVELS.roll + lerp(-17, -12, p)), rev: 0.2 });
        }
      }
    },

    break: (s) => {
      const e = s.energy;
      if (e > 0) {
        kickAt(s.from, BIG_KICK, ([0, -3, 0, 0] as PerEnergy)[e], 0.25);
      }
      if (e === 3) {
        crashAt(s.from, -2);
      }
      padAt(s.from, chordAt(s.from), 1.5, -5, { attack: 0.05, release: bs(0.5) });
      if (e > 0) {
        arp(
          s,
          s.from,
          s.from + 2,
          0.5,
          (p) => xerp(1800, 700, p) * ([1, 0.7, 1, 1.2] as PerEnergy)[e],
          (p) => lerp(-3, -10, p) + ([0, -2, 0, 0] as PerEnergy)[e],
        );
      }
      // Cadence stabs double the break's hit cues; the last one is short so the pre-drop gap is clean.
      const hits = breakHits(s);
      hits.forEach((beat, idx) => {
        const chord = cadenceChord(idx);
        const last = idx === hits.length - 1;
        mix.add('music', stab({ notes: chord.voicing, decay: last ? 0.12 : 0.3, cutoff: 8000, seed: `cadence@${beat}` }), beat, {
          gain: db(LEVELS.stab + ([3, 5, 7, 8] as PerEnergy)[e]),
          rev: last ? 0.12 : 0.4,
          dly: 0.08,
        });
        bassAt(beat, chord.root + 12, last ? 0.3 : 0.45, 900, -8);
      });
      // A long break keeps breathing after its first bar: pads, a low drone and (energy ≥ 1) a filtered 8th arp.
      beatsIn(s.from + 4, s.to, 4).forEach((bar, i) => {
        const barEnd = Math.min(bar + 4, s.to);
        const chord = chordAt(bar);
        padAt(bar, phraseChord(chord, i + 1, e), barEnd - bar, -6, { attack: 0.3, release: 0.6, cutoff: 1800 });
        droneBassAt(bar, chord.root, barEnd - bar, -8);
        if (e > 0) {
          arp(
            s,
            bar,
            barEnd,
            0.5,
            () => ([900, 1200, 1500, 2000] as PerEnergy)[e],
            () => (i % 2 === 0 ? -10 : -8),
          );
        }
      });
    },

    finale: (s) => {
      const e = s.energy;
      const len = s.to - s.from;
      // The logo chord rings for the first half (all but the last 2 bars when long), then releases to the end.
      const ring = Math.min(len / 2, 8);
      const gate = Math.max(len / 2, len - 8);
      if (e > 0) {
        kickAt(s.from, BIG_KICK, ([0, -3, 0, 0] as PerEnergy)[e], 0.3);
        crashAt(s.from, ([0, -2, 1, 2] as PerEnergy)[e]);
      }
      padAt(s.from, AM_WIDE, gate, 1, { attack: 0.03, release: bs(ring - 0.2), cutoff: 4200 });
      mix.add('music', stab({ notes: AM_WIDE.voicing, decay: 0.8, cutoff: 7000, seed: 'finale' }), s.from, {
        gain: db(LEVELS.stab + ([1, 2, 4, 5] as PerEnergy)[e]),
        rev: 0.55,
      });
      mix.add('bass', bass({ midi: AM_WIDE.root, gate: at(gate), attack: 0.25, sub: 0.8, mid: 0.15, cutoff: 300, floor: 160 }), s.from + 0.5, {
        gain: db(LEVELS.bass - 3),
      });
      if (e > 0) {
        for (const bar of beatsIn(s.from + 16, s.to - 4, 16)) {
          motif(bar, AM_WIDE, -6, s.to);
        }
      }
    },
    silent: () => {},
  };

  for (const s of MUSIC) {
    SECTIONS[s.name](s);
  }
};

const LAST = MUSIC[MUSIC.length - 1];
/** Master fade to digital silence at the end: the finale's ring-out (2 beats), or a bar if the video ends on another section. */
export const FADE_BEATS = LAST.name === 'finale' ? Math.min(2, (LAST.to - LAST.from) / 2) : Math.min(4, LAST.to - LAST.from);

/** Music-bus low-pass automation (Hz): intro swell, dark closes down, build opens up — darker at lower energy. */
export const musicFilterLane = (): Point[] => {
  /** Calm grooves breathe: the filter opens over one 4-bar phrase and closes over the next. */
  const breathe = (s: Section, lo: number, hi: number): Point[] => {
    const pts: Point[] = beatsIn(s.from, s.to, 16).map((b, i) => [b, i % 2 === 0 ? lo : hi]);
    return [...pts, [s.to - 0.01, pts.length % 2 === 1 ? hi : lo]];
  };
  const shape: Record<Section['name'], (s: Section, e: Energy) => Point[]> = {
    intro: (s, e) => [
      [s.from, e === 3 ? 400 : 300],
      [s.to - 0.01, ([1600, 2000, 2600, 3200] as PerEnergy)[e]],
    ],
    sting: (s, e) => [
      [s.from, ([5000, 7000, 9000, 12_000] as PerEnergy)[e]],
      [s.to - 0.01, ([7000, 9000, 12_000, 16_000] as PerEnergy)[e]],
    ],
    groove: (s, e) =>
      e >= 2
        ? [
            [s.from, 18_000],
            [s.to - 0.01, 18_000],
          ]
        : breathe(s, e === 1 ? 6000 : 3000, e === 1 ? 9500 : 4500),
    dark: (s, e) => [
      [s.from, ([600, 800, 1000, 1600] as PerEnergy)[e]],
      [s.to - 2, ([700, 900, 1100, 1800] as PerEnergy)[e]],
      [s.to - 0.01, ([1500, 2500, 4000, 6000] as PerEnergy)[e]],
    ],
    build: (s, e) => [
      [s.from, ([400, 600, 700, 1200] as PerEnergy)[e]],
      [s.to - 0.01, ([5000, 9000, 18_000, 18_000] as PerEnergy)[e]],
    ],
    break: (s, e) => [
      [s.from, ([3000, 4000, 6000, 8000] as PerEnergy)[e]],
      [s.to - 0.01, ([3000, 4000, 6000, 8000] as PerEnergy)[e]],
    ],
    finale: (s, e) => [
      [s.from, ([4000, 6000, 9000, 12_000] as PerEnergy)[e]],
      [s.to, ([1500, 2000, 2500, 3000] as PerEnergy)[e]],
    ],
    silent: (s) => [
      [s.from, 18_000],
      [s.to - 0.01, 18_000],
    ],
  };
  return MUSIC.flatMap((s) => shape[s.name](s, s.energy));
};

/**
 * Per-sample gain for the music bus or the FX returns: the pre-drop gap at the
 * end of every break (only the reverse swell on the SFX bus is left), and — on
 * the music bus — 1/32-note chops under every `glitch` cue.
 */
export const gapGain = (n: number, target: 'music' | 'returns'): Float32Array => {
  const g = new Float32Array(n).fill(1);
  for (const brk of MUSIC.filter((s) => s.name === 'break')) {
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
