/**
 * `defineVideo`: the single source of truth for a video's pacing.
 *
 * A video is a list of scenes laid end to end on a beat grid. Each scene owns
 * its timing: named `marks` (beats from the scene start) that the scene
 * animates on, the sound `cues` that hit on those marks, and the on-screen copy
 * (`reads`) the pacing checker budgets reading time for. Scene starts, absolute
 * cue times (for the soundtrack) and music sections are derived here, so a
 * re-time is one edit and picture and sound cannot drift apart.
 *
 * Pure data with `.ts`-extension imports only (plain Node loads it).
 */
import { DUR } from './durations.ts';
import { makeGrid, type Grid } from './grid.ts';
import { PRESETS, type Energy, type Preset, type PresetName } from './presets.ts';

export type CueKind =
  | 'impact' // punchy hit: kick + noise crack + sub
  | 'boom' // cinematic sub drop for logo moments
  | 'hit' // lighter accent hit for numbers locking / chips landing
  | 'whoosh' // fast transition sweep
  | 'riser' // noise + pitch rise into the next beat (len)
  | 'reverse' // reversed swell that ends exactly `len` beats later
  | 'glitch' // digital stutter / bitcrush burst
  | 'clang' // metallic shield block
  | 'chime' // bright bell ping for "done"
  | 'blip' // UI pip
  | 'type' // keyboard ticks for `len` beats
  | 'ticks' // rapid rising ticks for `len` beats
  | 'countUp' // rising blip stream under a number counter (len)
  | 'shimmer'; // airy sparkle for wordmark reveals

/** Cue kinds that read as a hit; the pacing checker spaces these by `preset.accentGap`. */
export const ACCENT_KINDS: readonly CueKind[] = ['impact', 'boom', 'hit', 'clang', 'glitch'];

/**
 * An absolute cue (beats from the top of the video), as consumed by the soundtrack.
 * `pitch` scales the cue's frequencies (1 = as designed, 0.5 = an octave down); only `whoosh` reads it.
 */
export type Cue = { beat: number; kind: CueKind; len?: number; gain?: number; pitch?: number };

/**
 * A beat inside a scene: a number (beats from the scene start), a mark name,
 * or a mark with an offset in beats: `'land'`, `'land+0.5'`, `'exit-1'`.
 */
export type At = number | string;

export type SceneCue = { at: At; kind: CueKind; len?: number; gain?: number; pitch?: number };

/** On-screen copy that must be readable: fully legible at `at`, starts leaving at `until` (default: scene end). */
export type Read = { text: string; at: At; until?: At };

export type SceneSpec = {
  id: string;
  /** Length in beats. */
  beats: number;
  /** 1-based index into `chapters` for the HUD eyebrow; `null`/omitted hides the HUD. */
  chapter?: number | null;
  /**
   * Named moments in beats from the scene start. Scenes animate on these; cues and reads reference them.
   * `exit` (where the exit animation starts: `DUR.exit` before the end) is added unless given.
   */
  marks?: Readonly<Record<string, number>>;
  cues?: readonly SceneCue[];
  reads?: readonly Read[];
  /** Kit recipe that renders this scene (set by recipe planners); omit for a custom scene component. */
  recipe?: string;
  /** Recipe props (plain data). */
  props?: unknown;
};

export type PlanContext = { preset: Preset; grid: Grid };

/** A scene, or a planner that sizes a scene for the video's preset (what recipe helpers return). */
export type SceneInput = SceneSpec | ((ctx: PlanContext) => SceneSpec);

/** `silent`: no music at all (SFX only), for stings and bumpers; tonal cues tune to the intro drone. */
export type MusicSectionName = 'intro' | 'sting' | 'groove' | 'dark' | 'build' | 'break' | 'finale' | 'silent';

/**
 * A music section, running until `until`: a scene id (its start), a scene id with an
 * offset in beats (`'end+2'`), or an absolute beat. The last section omits `until`
 * and runs to the end of the video.
 */
export type MusicSpec = { name: MusicSectionName; until?: At; energy?: Energy };

/** A resolved music section, in absolute beats. */
export type MusicSection = { from: number; to: number; name: MusicSectionName; energy: Energy };

export type VideoSpec = {
  /** Composition id and soundtrack file name (`public/audio/<id>.wav`): a–z, 0–9, `-`. */
  id: string;
  title: string;
  preset: PresetName;
  /** Tempo override; defaults to the preset's. Must be grid-exact (see `makeGrid`). */
  bpm?: number;
  /** `'report'`: pacing errors are printed but don't fail `npm run check` (legacy cuts only). Default `'enforce'`. */
  pacing?: 'enforce' | 'report';
  /** HUD chapter labels; scenes reference them 1-based. */
  chapters: readonly string[];
  scenes: readonly SceneInput[];
  music: readonly MusicSpec[];
};

export type ResolvedRead = { text: string; at: number; until: number };

export type Scene = {
  id: string;
  index: number;
  /** Start in beats from the top of the video. */
  start: number;
  beats: number;
  chapter: number | null;
  marks: Readonly<Record<string, number>>;
  /** Cues in beats from the scene start. */
  cues: readonly Cue[];
  /** Reads in beats from the scene start. */
  reads: readonly ResolvedRead[];
  recipe: string | null;
  props: unknown;
};

export type Video = {
  id: string;
  title: string;
  preset: Preset;
  pacing: 'enforce' | 'report';
  grid: Grid;
  totalBeats: number;
  durationInFrames: number;
  chapters: readonly string[];
  scenes: readonly Scene[];
  /** All cues in absolute beats, in scene order. */
  cues: readonly Cue[];
  music: readonly MusicSection[];
  scene: (id: string) => Scene;
  /** Frames in `n` beats on this video's grid. */
  beats: (n: number) => number;
};

const AT_RE = /^([A-Za-z_]\w*)\s*(?:([+-])\s*(\d+(?:\.\d+)?))?$/;

/** Resolve an `At` against a scene's marks (beats from the scene start). Throws on unknown marks. */
export const resolveAt = (at: At, marks: Readonly<Record<string, number>>, where: string): number => {
  if (typeof at === 'number') {
    return at;
  }
  const m = AT_RE.exec(at.trim());
  if (!m || !(m[1] in marks)) {
    const known = Object.keys(marks).join(', ') || 'none';
    throw new Error(`${where}: unknown mark "${at}" (marks: ${known})`);
  }
  const offset = m[3] ? Number(m[3]) * (m[2] === '-' ? -1 : 1) : 0;
  return marks[m[1]] + offset;
};

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const SCENE_ID_RE = /^[A-Za-z][A-Za-z0-9]*$/;

export const defineVideo = (spec: VideoSpec): Video => {
  if (!ID_RE.test(spec.id)) {
    throw new Error(`Video id "${spec.id}" must be lowercase a–z, 0–9 and "-"`);
  }
  const base = PRESETS[spec.preset];
  if (!base) {
    throw new Error(`${spec.id}: unknown preset "${spec.preset}"`);
  }
  const preset: Preset = spec.bpm ? { ...base, bpm: spec.bpm } : base;
  const grid = makeGrid(preset.bpm);
  const ctx: PlanContext = { preset, grid };

  const scenes: Scene[] = [];
  let start = 0;
  for (const input of spec.scenes) {
    const s = typeof input === 'function' ? input(ctx) : input;
    const where = `${spec.id}/${s.id}`;
    if (!SCENE_ID_RE.test(s.id)) {
      throw new Error(`${where}: scene id must match ${SCENE_ID_RE}`);
    }
    if (scenes.some((x) => x.id === s.id)) {
      throw new Error(`${where}: duplicate scene id`);
    }
    if (!(s.beats > 0) || !Number.isInteger(grid.beats(s.beats))) {
      throw new Error(`${where}: length ${s.beats} beats is not a whole number of frames`);
    }
    const chapter = s.chapter ?? null;
    if (chapter !== null && (chapter < 1 || chapter > spec.chapters.length)) {
      throw new Error(`${where}: chapter ${chapter} not in 1…${spec.chapters.length}`);
    }
    const marks = { exit: s.beats - (DUR.exit * preset.motion) / grid.framesPerBeat, ...s.marks };
    for (const [name, beat] of Object.entries(marks)) {
      if (beat < 0 || beat > s.beats) {
        throw new Error(`${where}: mark "${name}" at ${beat} is outside 0…${s.beats}`);
      }
    }
    const cues = (s.cues ?? []).map((c): Cue => {
      const beat = resolveAt(c.at, marks, where);
      if (beat < 0 || beat >= s.beats) {
        throw new Error(`${where}: ${c.kind} cue at ${beat} is outside the scene (0…${s.beats})`);
      }
      const cue: Cue = { beat, kind: c.kind };
      if (c.len !== undefined) cue.len = c.len;
      if (c.gain !== undefined) cue.gain = c.gain;
      if (c.pitch !== undefined) cue.pitch = c.pitch;
      return cue;
    });
    const reads = (s.reads ?? []).map((r): ResolvedRead => {
      const at = resolveAt(r.at, marks, where);
      const until = r.until === undefined ? s.beats : resolveAt(r.until, marks, where);
      if (!(until > at) || at < 0 || until > s.beats) {
        throw new Error(`${where}: read "${r.text}" spans ${at}…${until}, outside the scene or empty`);
      }
      return { text: r.text, at, until };
    });
    scenes.push({
      id: s.id,
      index: scenes.length,
      start,
      beats: s.beats,
      chapter,
      marks,
      cues,
      reads,
      recipe: s.recipe ?? null,
      props: s.props,
    });
    start += s.beats;
  }
  const totalBeats = start;
  if (!scenes.length) {
    throw new Error(`${spec.id}: no scenes`);
  }

  // Scene order, then listed order (not re-sorted: the soundtrack mixes cues in this order).
  const cues = scenes.flatMap((s) => s.cues.map((c) => ({ ...c, beat: s.start + c.beat })));
  for (const c of cues) {
    if (c.beat + (c.len ?? 0) > totalBeats) {
      throw new Error(
        `${spec.id}: ${c.kind} cue at ${c.beat} (len ${c.len}) runs past the end (${totalBeats})`,
      );
    }
  }

  const sceneStarts = Object.fromEntries(scenes.map((s) => [s.id, s.start]));
  const music: MusicSection[] = [];
  let from = 0;
  spec.music.forEach((m, i) => {
    const last = i === spec.music.length - 1;
    if (last !== (m.until === undefined)) {
      throw new Error(`${spec.id}: every music section but the last needs \`until\`; the last must omit it`);
    }
    const to =
      m.until === undefined ? totalBeats : resolveAt(m.until, sceneStarts, `${spec.id}/music "${m.name}"`);
    if (!(to > from) || to > totalBeats) {
      throw new Error(
        `${spec.id}: music "${m.name}" spans ${from}…${to}; sections must move forward inside the video`,
      );
    }
    music.push({ from, to, name: m.name, energy: m.energy ?? preset.energy });
    from = to;
  });
  if (!music.length) {
    throw new Error(`${spec.id}: no music sections`);
  }

  return {
    id: spec.id,
    title: spec.title,
    preset,
    pacing: spec.pacing ?? 'enforce',
    grid,
    totalBeats,
    durationInFrames: grid.beats(totalBeats),
    chapters: spec.chapters,
    scenes,
    cues,
    music,
    beats: grid.beats,
    scene: (id) => {
      const s = scenes.find((x) => x.id === id);
      if (!s) {
        throw new Error(`${spec.id}: unknown scene "${id}"`);
      }
      return s;
    },
  };
};
