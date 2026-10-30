# AGENTS.md — making Unikraft Cloud videos

This repo is a kit for motion-graphics videos in the style of the unikraft.com dark theme, built with
[Remotion](https://www.remotion.dev). Design, motion, music and pacing are already solved here. Your
job is to write a timeline: pick scenes, write the copy, run the checks. **Don't reinvent the look, the
sound or the timing model.** Read `STYLE.md` before writing copy or a custom scene.

## Read first (in this order)

1. `videos/template/timeline.ts`: a whole video in one file (3 scenes: a recipe, a custom scene, an end card).
2. `kit/recipes/*/demo.ts`: one example call per recipe. `videos/gallery` plays them all in a row.
3. `STYLE.md`: colour, type, motion, pacing, sound and copy rules.
4. Only if you need a custom scene: `videos/template/scenes/Flow.tsx`.

## Commands

```bash
npm install
npm run new-video -- my-video "My video"   # copy the template → videos/my-video, register it
npm run check -- my-video                  # pacing report; exits 1 on errors (run after every timeline edit)
npm run review -- my-video                 # report + out/review/my-video/sheet.png contact sheet
npm run review -- my-video --scene hook    # … + full-size stills of one scene's review frames
npm run review -- my-video --frames 90,400 # … + full-size stills of chosen frames
npm run dev                                # Remotion Studio: my-video, my-video-scenes/<NN-scene>
npm run soundtrack -- my-video             # public/audio/my-video.wav (render does this for you)
npm run draft -- my-video                  # check → soundtrack → out/drafts/my-video/vN.mp4 (half-res, slate bar)
npm run draft -- my-video --scene hook     # … one scene only → vN-hook.mp4 (--scale 1 for full res)
npm run render -- my-video                 # check → soundtrack → out/my-video.mp4 (final quality)
npm run lint                               # eslint + tsc
```

## Workflow

1. **Brief → storyboard.** Write the storyboard as a comment table at the top of `timeline.ts`
   (scene · recipe · message). One idea per scene. Most 60–90 s videos have 8–14 scenes.
2. **Pick a preset.** `explainer` (100 BPM, the default), `walkthrough` (90 BPM) for tutorials,
   `promo` (120 BPM) only for ≤ 30 s social cut-downs. Pacing is only as good as the preset you pick.
3. **Build it from recipes.** Every recipe takes `(id, props, options?)` and sizes itself so its copy
   is readable at the preset's pace. `options`: `{ chapter, hold, beats, cues }`.
4. **Music.** Sections with `until: '<sceneId>'` (the last one has no `until`). Put section starts on
   bar lines; recipe scenes are whole bars in explainer and walkthrough, so any scene start works.
   Typical arc: `intro` → `sting` (on a logo) → `groove` → `dark` (the problem) → `groove` → `build`
   → `break` → `finale`. Set `energy` per section if you need to (0–3, default 1 for explainer).
   `silent` plays no music (SFX only), for short bumpers and outros.
5. **`npm run check`** until it's clean. Fix errors by lengthening (`hold`) or cutting copy. Never
   silence the check. `pacing: 'report'` is only for the legacy promo.
6. **`npm run review`** and look at `sheet.png`. Every tile is a moment where its copy should be
   fully legible. If it isn't, the scene is wrong, whatever the numbers say.
7. **Draft** with `npm run draft -- <id>` and hand the user the `.mp4` path. Iterate in feedback
   rounds (below) until they sign off.
8. **Render** with `npm run render -- <id>`. Watch the result with sound before calling it done.

## Feedback rounds

The user prompts, you build, they watch a draft and reply; repeat until they approve. Drafts are cheap
(half resolution, light encoding, about half the final render time) and every one is numbered.

- **Resuming a video?** Read `videos/<id>/feedback.md` first: it holds every earlier round's notes
  and decisions. Don't undo something a previous round asked for.
- **Every draft frame names itself.** The slate bar under the frame shows `vN · time / total · frame ·
  NN/TT scene · beat in scene`. Ask the user to quote it ("v3 00:12.40, the headline is too fast").
  Times are master-timeline times, also in scene-only drafts and in `npm run check`'s `start` column.
- **`npm run draft` appends `## vN` to `feedback.md`.** Under it, write the user's notes on that draft
  verbatim (with the timecodes they quoted), then `Changed:` what you did about each one before the
  next draft. Commit `feedback.md` with the video.
- **Locate a note:** the slate's scene and beat point at the mark to change (marks are beats from the
  scene start). `npm run review -- <id> --frames <f>` renders a full-size still of the slate's
  frame, to look at before and after a fix.
- **Draft scope:** a note about one scene → `--scene <id>` draft for a quick look; anything touching
  timing, music or several scenes → full draft. The user signs off on a full draft.
- `check` and `review` still run before every draft; a draft never ships with pacing errors.
- Live alternative: `npm run dev` (Remotion Studio) scrubs any video or scene window at full quality.
  The full video's frame counter matches the slate; scene windows count from the scene start.

## Recipes (`kit/recipes/<name>/plan.ts`: full prop docs live in the types)

| Recipe | Use it for | Key props |
| --- | --- | --- |
| `statement` | Kinetic headline: lines slam in one per beat, optional mono `// kicker`, optional ticked checkboxes | `lines[]`, `kicker?`, `checks?`, `eyebrow?` |
| `logoSting` | Logo assembles (checker dissolve, stripes, shockwave), wordmark, tagline | `tagline?`, `caption?`, `checker?` |
| `terminal` | Hero terminal demo: commands type, output lands, optional dive into a giant count-up readout | `title?`, `commands[{ cmd, output?, step? }]`, `result?` |
| `race` | Cold-start race between lanes on a simulated clock, headline slams after the finish | `headline`, `lanes[{ label, value, highlight?, pending? }]`, `unit?` |
| `stat` | Hero number counting up and locking, with a claim headline. `visual: 'grid'` (density field) or `'chart'` (cost over time) | `value`, `prefix?`/`suffix?`, `label`, `caption?`, `visual?` |
| `layers` | Two stacks side by side (the TCB diagram): a bug escapes on the left, gets contained on the right, then the verdict | `headline`, `left`/`right: { title, layers[], apps?, stat?, badge? }`, `threat?`, `verdict?` |
| `chips` | 2–5 badges landing (Trust), or chips on connectors under a hub box (Deploy) | `headline`, `items[{ label, icon, detail? }]`, `hub?`, `footer?` |
| `rotator` | "Build [noun] that …": nouns swap with icon tiles, the last one holds | `before`, `nouns[{ text, icon }]`, `after[]`, `tag?` |
| `endCard` | Recap ticks → lockup boom → stats row → CTAs → URL. Holds to the last frame | `recap?`, `stats?` (`SITE_STATS`), `ctas?`, `url?`, `final?` |

Copy conventions shared by every recipe: `[brackets]` mark the one accent phrase (brand blue), `\n`
breaks lines where a prop says so, and icon names come from `kit/design/icons-data.ts`.

## Custom scenes (when no recipe fits)

Copy `videos/template/scenes/Flow.tsx`. The contract:

- **In `timeline.ts`:** `{ id, beats, chapter?, marks, cues, reads, props }`. `marks` are beats from the
  scene start. Cues and reads can reference them (`'wake'`, `'wake+0.5'`). `exit` is added
  automatically (`DUR.exit` before the end). `props` is plain data: the copy lives here, next to the
  `reads` that budget it.
- **Register the component** in `videos/<id>/index.ts` under `scenes: { <sceneId>: Component }`.
- **In the component:** `const { at, dur, frames, beats, props, video } = useScene<Props>()`.
  - Animate from `at('<mark>')` (frames).
  - Motion durations come from `dur('enter' | 'exit' | 'snap' | 'flash' | 'decode' | 'draw' | frames)`.
    Never derive entrance speed from beats.
  - Exit from `at('exit')` over `dur('exit')`.
  - Shake amplitudes are multiplied by `video.preset.shake`.
- Build from `kit/design` only: `Backdrop`, `Move`, `SplitText`, `Scramble`, `AccentText`, `Display`,
  `Mono`, `Terminal`, `Chip`, `Wire`, `Logo`, `CtaButton`, `Checkbox`, `Icon`, `patterns`, `tokens`,
  and `motion` (`progress`, `pop`, `shake`, `scramble`…).
- It must be deterministic (no `Math.random`, no CSS transitions) and stay inside `SAFE` (the HUD takes
  the top ~130 px and the bottom rail).
- `Logo` takes `pace` (default 1) to slow its assembly for calm cards: `pace={1.5}` runs every step
  1.5× as long. `body="trace"` draws the U's outline, then fades its fill in (no transform) instead
  of springing it up.
- If the same custom scene shows up in a second video, turn it into a recipe (`kit/recipes/<name>/`:
  `plan.ts` pure, `<Name>.tsx`, `demo.ts`, one line in `kit/recipes/index.ts`, one scene in
  `videos/gallery`). Follow `statement/` as the reference.

## Rules

- **Don't edit `kit/` for one video.** Fix or extend the kit only when every video gets better. Then
  `npm run check` on every video, confirm the promo is unchanged (below), and update this file.
- **Pure modules stay pure.** `timeline.ts`, `plan.ts`, `demo.ts` and `kit/timeline/*` run under
  plain Node (soundtrack, check). They import only other pure modules, with `.ts` extensions. No
  React, no Remotion.
- **Numbers and claims:** only what `STYLE.md` → Copy allows. CLI examples use real `unikraft`
  syntax (see the terminal demo). Never say "unikernel".
- **Tempo:** `preset.bpm`, or a grid-exact `bpm` override (72, 75, 90, 100, 120…; `makeGrid`
  rejects the rest).
- **Canvas:** 1920×1080 by default. `canvas: { width, height }` (even integers) in `defineVideo` sets
  another frame size, e.g. `{ width: 1440, height: 1440 }` for a square social cut. Recipes, the HUD
  and `SAFE` are laid out for 1920×1080 only, so other canvases need custom scenes with
  `chapters: []` (see `videos/r14-harpalyke-end`).
- **Formatting:** prettier only on files you touched (`npx prettier --write <files>`). The ported
  promo/kit files are deliberately not reformatted.
- **Commits:** Conventional Commits, sentence-case subject (`feat(recipes): Add quote recipe`).

## Done means

- [ ] `npm run check -- <id>` passes with no errors, and any warnings are understood.
- [ ] `npm run lint` passes.
- [ ] `sheet.png` reviewed: every tile legible, nothing clipped, nothing under the HUD.
- [ ] `npm run render -- <id>` watched start to finish **with sound**.
- [ ] The user signed off on the latest full draft, and `feedback.md` records every round.
- [ ] If the kit changed: `node kit/audio/generate.ts promo-30s && md5sum public/audio/promo-30s.wav`
      prints `6f96dfc8665492161c866bfeb5ca4001`, and promo stills are unchanged.

## Layout

```
kit/
  design/      tokens, motion, Text, Terminal, Logo, Button, Chip, Checkbox, Wire, Backdrop, Grain, Icon, patterns, fonts
  brand/       logo geometry (per stripe)
  overlays/    Hud (chapter chrome), StripeWipe (brand cut)
  timeline/    grid (FPS, makeGrid, ms) · presets · define (defineVideo) · pacing (checkVideo) · durations (DUR) · review · load
  video/       VideoTimeline / VideoFrame / SceneWindow / VideoEntry · useScene · Compositions · ContactSheet · Slate (draft bar)
  recipes/     <name>/{plan.ts, <Name>.tsx, demo.ts} + index.ts (registry) + common.ts
  audio/       procedural soundtrack: dsp · instruments · mixer · fx · score · music · sfx · generate
videos/
  template/    what new-video copies
  gallery/     every recipe demo in a row
  promo-30s/   the original 30 s promo (bespoke scenes, the visual reference; report-only pacing)
  registry.ts  every video in the Studio
scripts/       new-video · check · review · draft · render · extract-icons
public/        fonts, audio/<id>.wav
```
