# Style — the Unikraft Cloud video look

Everything here is already implemented in `kit/`. This page is what to use and what not to do.
The look comes from the unikraft.com dark theme (`unikraft-cloud/www`); the 30 s promo
(`videos/promo-30s`) is the reference for what "done" looks like.

## Canvas and clock

- 1920×1080, 60 fps, H.264 CRF 16, bt709 (`remotion.config.ts`). Don't change these for a single video.
- Every video sits on a beat grid (`preset.bpm`). Cuts, landings and sound hits happen on beats
  or 8ths. Off-grid timing feels sloppy even when nobody can say why.
- Safe area: `SAFE` in `kit/design/tokens.ts` (x 120, top 64, bottom 72). The HUD takes the top rule plus
  its eyebrow row (≈ 64–130 px) and the bottom rail. Keep copy clear of both.

## Colour (`C`, `TERM` in `kit/design/tokens.ts`)

| Role | Token | Notes |
| --- | --- | --- |
| Background | `Backdrop` variants `tintC` (default), `tintB`, `tintA`, `plain`, `black` | Near-black navy gradients plus the blue `aura`. Never flat grey. |
| Body / headline text | `C.slate300` (headlines), `C.blue50` (flash) | Headlines are slate, not white. |
| Accent | `C.blue400` (`#0070f0`, THE Unikraft blue) | One accent phrase per headline: `[brackets]` in recipe copy. |
| Eyebrows, labels | `C.blue100` | Mono, uppercase. |
| Secondary text | `C.slate400`–`C.slate600` | Captions, units, the HUD's right side. |
| Hairlines / frames | `C.slate700` / `C.slate800` | 1–2 px. |
| Danger / "the old way" | `C.rose`, `C.red` | Containers escaping, idle cost, denied boxes. Only for contrast with the blue. |
| Success | `C.green` / `TERM.success` | Terminal ✓ only. |
| Logo gradient | `logoBlue → logoSky → logoCyan → logoTeal` | Logo, stripe wipe and checker moments only. |

Use `alpha(hex, a)` and `mix(a, b, t)`. Don't add new hex values. If a colour isn't in `C`, it's off-brand.

## Type (`FONT`, `TYPE`, `kit/design/Text.tsx`)

- **Display headline**: InterVariable 700, `-0.05em` tracking, leading 0.95 (`TYPE.display`, `<Display>`).
  96–200 px. One idea per headline, ≤ 8 words.
- **Title**: Inter 500, `-0.035em` (`TYPE.title`). Sub-headlines, card titles.
- **Mono eyebrow/label**: IBM Plex Mono 500, uppercase, `0.05–0.14em` tracking (`TYPE.eyebrow`, `<Mono>`).
  26 px minimum on screen.
- **Mono comment**: `// pick all three.`: the dev voice. Typed on with `scramble`, blue-100, glow when done.
- Numbers: tabular (`fontVariantNumeric: 'tabular-nums'`), count up with `fmtInt`, and lock with a `hit`.
- Fonts ship in `public/fonts` and load in `kit/design/fonts.ts`. Renders never touch a CDN.

## Brand graphics

- `[NN.00] LABEL` chapter eyebrow and `SECTION NN / TT` (the HUD, from the site's `Container.astro`).
- CTA checkerboard (`checker()` in `patterns.ts`): selection, "all three", solution space, logo field.
- TCB hatching (`hatch()`, `hatchBorder()`): stacked layers, "billed while idle" bands.
- Manhattan connectors (`Wire`, `manhattanPath`, `pointOnPath`): flows and hubs; they draw themselves on.
- Hero terminal (`Terminal`): macOS-style dots, `$` prompt in `TERM.prompt`, green ✓.
- Logo (`Logo`, `kit/brand/logo-data.ts`): the real geometry, split per stripe so it can assemble.
- `StripeWipe` (`kit/overlays`): the brand cut. Use it at most once or twice per video, on chapter changes.
- Film grain (`Grain`) sits on top of every frame; it's already in `VideoTimeline`.
- Icons: Solar bold + a few MDI (`Icon`, names in `icons-data.ts`; add more via `scripts/extract-icons.ts`).

## Motion

The rule that fixes the promo's one flaw: **motion stays fast, dwell gets longer.**

- Durations come from `DUR` (`kit/timeline/durations.ts`), in frames. They don't depend on tempo.
  In components, `useScene().dur('enter')` scales them slightly per preset (`preset.motion`).
  `flash` 8 · `snap` 7 · `enter` 12 · `exit` 8 · `decode` 14 · `draw` 26.
- Easing (`EASE` in `motion.ts`): `out` for entrances (expo-like: fast attack, long settle), `in` for exits
  and whips, `back` for pops (≈10 % overshoot), `standard`/`balanced` (the site's) for UI and fades.
- Entrances: scale-down from 1.3–1.45 with 12–22 px blur (type slams), or rise and unblur (`Move` default).
  Springs (`pop`) for chips and boxes.
- Every landing gets a reaction: a light sweep across type, a hit flash, a small camera shake
  (`shake` × `preset.shake`), and a sound cue on the same frame.
- Camera: always drifting a little (a 1.03× push over the scene). Punch in on a big number, pull out on
  reveals. Nothing sits dead still, and nothing wobbles.
- Exits: short (`dur('exit')`), `EASE.in`, usually slide + blur + fade. The next scene's entrance covers
  the cut.
- Everything is frame-derived and deterministic. No CSS transitions, no `Math.random` (use `random(seed)`
  and `noise2D`).

## Pacing (the budget `npm run check` enforces)

| Preset | BPM | Shot | Reading | Accents ≥ | Use for |
| --- | --- | --- | --- | --- | --- |
| `promo` | 120 | ≥ 1 s (mean 1.5–3 s) | 300 wpm, 0.25 s react | ½ beat | 15–30 s social cut-downs |
| `explainer` (default) | 100 | ≥ 3 s (mean 4–6.5 s) | 170 wpm, 0.7 s react | 1 beat | 60–90 s product videos |
| `walkthrough` | 90 | ≥ 4 s (mean 6–10 s) | 150 wpm, 0.9 s react | 2 beats | tutorials, terminal demos |

- Budget for one piece of copy: `react + words ÷ wpm` (a token containing a digit counts as 2 words).
  All the reads in a scene must also fit back to back.
- One idea per scene. If a scene needs more than about 12 words, split it.
- The promo fails its own budget in 13 of 14 scenes (`npm run check -- promo-30s`). That's the
  "too fast" feeling, measured.

## Sound

- The soundtrack is procedural and generated from the timeline (`kit/audio`), so every cut and hit lands
  on the sample. Don't drop in stock music unless you have to. If you do, match `preset.bpm`.
- Music sections: `intro` (drone, builds), `sting` (logo), `groove`, `dark` (tension, filtered), `build`
  (riser into a drop), `break` (cadence stabs on its `hit` cues, then silence), `finale` (wide chord, fade),
  `silent` (no music, SFX only: bumpers and outros).
  Place them with `until: '<sceneId>'`, on bar lines.
- `energy` per section: 0 pads only · 1 half-time, sparse (explainer default) · 2 full groove (the promo) ·
  3 lifted.
- Cue vocabulary (`CueKind`): `impact` (scene-opening slam), `hit` (a number or chip lands), `boom`
  (logo), `whoosh` (whip/transition), `riser` (into the next beat), `reverse` (swell into a hit), `glitch`,
  `clang` (blocked), `chime` (done/winner), `blip` (UI pip, fast sequences), `type`, `ticks`, `countUp`,
  `shimmer` (wordmark).
- Accents (`impact`/`boom`/`hit`/`clang`/`glitch`) at most one per `preset.accentGap`. For rapid sequences,
  use `blip`.

## Copy

Follow `unikraft-cloud/www/AGENTS.md` product messaging:

- Unikraft Cloud is a **Linux-based microVM cloud platform** that runs any Dockerfile-based workload.
  Never call it a unikernel product. It is not unikraft.org.
- The CLI is `unikraft`.
- Compliance: **SOC 2 Type II**, **HIPAA-compliant**, independent third-party penetration tested.
  Nothing else (no ISO 27001 / HITRUST / FedRAMP / PCI-DSS, no Gartner or academic-award claims).
- Numbers that have been used: < 10 ms cold start, 100K+ microVMs per server, 10–100× better unit
  economics, $0 while idle, fork a live VM in ~10 ms. Don't invent new ones.
- Voice: short declaratives. "Fast. Safe. Cheap." Sentence case, full stops on headlines.
