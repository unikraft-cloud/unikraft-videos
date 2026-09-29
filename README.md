# unikraft-videos

A kit for Unikraft Cloud motion-graphics videos, built with [Remotion](https://www.remotion.dev).
It grew out of the 30 s promo (`videos/promo-30s`). Its look is lifted from the unikraft.com dark
theme, with a procedural soundtrack locked to the picture. The kit turns that one video into
reusable parts, so the next ones keep the look **at a pace people can read**.

- **Design system** (`kit/design`): the site's tokens, type, backdrops, terminal, logo, chips,
  connectors, CTA checker and TCB hatching.
- **Recipes** (`kit/recipes`): nine configurable scenes extracted from the promo (statement, logo
  sting, terminal, race, stat, layers, chips, rotator, end card). You write copy, not animation code.
- **Pacing presets and a checker** (`kit/timeline`): the tempo plus a reading budget for every line
  on screen. `npm run check` fails a cut that's too fast to read. (The original promo fails in 13 of
  its 14 scenes. That's the "too fast" feeling, measured.)
- **Procedural soundtrack** (`kit/audio`): generated from the timeline at any grid tempo, with
  energy levels per section, so a calmer video sounds like the same track played calmer.
- **Review contact sheet**: one PNG with a tile for every moment where copy should be legible.

## Quick start

```bash
npm install
npm run dev                                  # Studio: promo-30s, template, gallery (+ per-scene windows)
npm run new-video -- launch-q4 "Q4 launch"   # new video from the template
npm run check -- launch-q4                   # pacing report
npm run review -- launch-q4                  # → out/review/launch-q4/sheet.png
npm run render -- launch-q4                  # → out/launch-q4.mp4 (with soundtrack)
```

Working with an AI agent? Point it at [`AGENTS.md`](AGENTS.md) (the playbook) and
[`STYLE.md`](STYLE.md) (the look, motion, sound and copy rules).

## Videos

| Id | What |
| --- | --- |
| `template` | 19 s, 3 scenes: a `statement` recipe, a custom scene, an `endCard`. What `new-video` copies. |
| `gallery` | 86 s, every recipe's demo in a row: the catalogue. |
| `promo-30s` | The original 30 s promo, bespoke scenes, 120 BPM. The visual reference. Pacing is report-only. |

## Presets

| Preset | BPM | Shot length | Reading speed | Use for |
| --- | --- | --- | --- | --- |
| `promo` | 120 | ≥ 1 s | 300 wpm | ≤ 30 s social cut-downs |
| `explainer` | 100 | ≥ 3 s, avg 4–6.5 s | 170 wpm | default: 60–90 s product videos |
| `walkthrough` | 90 | ≥ 4 s, avg 6–10 s | 150 wpm | tutorials, terminal demos |

## Licensing notes

- Remotion is free for individuals and companies of up to 3 people. Larger companies need a
  [Remotion Company License](https://www.remotion.dev/docs/license). Check before sharing renders
  across the team.
- Fonts: Inter and IBM Plex Mono (SIL OFL 1.1). Icons: Solar (CC BY 4.0) and Material Design Icons
  (Apache 2.0), via Iconify.
