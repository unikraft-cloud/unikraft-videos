# Unikraft Cloud — 30 s promo

A fast-cut, motion-graphics promo for [Unikraft Cloud](https://unikraft.com), built with
[Remotion](https://www.remotion.dev). The look is lifted straight from `unikraft-cloud/www`
(dark theme): InterVariable + JetBrains Mono, slate/brand-blue palette, `[NN.00] LABEL` frame
chrome, the CTA checkerboard shine, TCB-diagram hatching, Manhattan connectors, the hero
terminal and the real logo geometry.

- 1920×1080, 60 fps, 30.0 s (60 beats at 120 BPM — every cut and hit sits on the beat grid)
- Procedural soundtrack generated from the same timeline, so picture and sound stay locked

## Commands

```bash
npm install
npm run dev            # Remotion Studio (preview, scrub, per-scene compositions)
npm run render         # → out/unikraft-promo.mp4 (H.264, CRF 16, with soundtrack)
npm run render:silent  # → out/unikraft-promo-silent.mp4
npm run soundtrack     # regenerate public/audio/soundtrack.wav from src/timeline.ts
npm run icons          # re-extract the icon subset (edit the list in scripts/extract-icons.ts)
npm run lint           # eslint + tsc
```

Single frames: `npx remotion still UnikraftPromo out/frame.png --frame=420`.
Each scene is also its own composition (`01-hook` … `14-end`, under "Scenes" in the Studio) —
a window into the master timeline, so HUD, transitions and audio match the final cut.

## Storyboard

| Beats | Scene | Message |
| --- | --- | --- |
| 0–8 | `hook` | Fast. Safe. Cheap. — `// pick two.` → `// pick all three.` |
| 8–12 | `logo` | Logo assembles out of the checker field · "The millisecond compute layer." |
| 12–18 | `coldStart` | Hero terminal → idle to first byte in 8.4 ms |
| 18–22 | `race` | Cold-start race vs container / traditional VM · up to 100× faster |
| 22–26 | `scaleToZero` | Request flow wakes instances · scale to zero, $0 while idle |
| 26–28 | `fork` | Fork a live VM in ~10 ms |
| 28–33 | `isolation` | Containers don't contain · every instance is its own microVM |
| 33–36 | `trust` | SOC 2 Type II · HIPAA-compliant · independent pen-test |
| 36–40 | `density` | 100K+ microVMs on one server |
| 40–44 | `economics` | Never pay for idle · 10–100× better unit economics |
| 44–48 | `dockerfile` | A standard Dockerfile. A radically different runtime. |
| 48–52 | `rotator` | Build databases / sandboxes / … AI agents that cold-start in 10 ms |
| 52–54 | `deploy` | Your cloud, your way: hosted, on-prem, BYOC, dedicated |
| 54–60 | `end` | ✓ Fast ✓ Safe ✓ Cheap → lockup, hero stats, CTAs |

Copy and claims follow `www/AGENTS.md` product messaging (Linux-based microVM platform, never
"unikernel"; SOC 2 Type II / HIPAA / third-party pen-test only).

## Layout

```
src/
  timeline.ts        the contract: FPS/BPM, SCENES (beats), CUES (sound hits), MUSIC sections
  Promo.tsx          master composition: scenes on the grid + HUD + transitions + grain + audio
  Root.tsx           compositions (full promo + one window per scene)
  design/            tokens and primitives mirrored from the site (Backdrop, Text, Terminal,
                     Logo, CtaButton, Chip, Wire, Checkbox, patterns, Grain, icons)
  brand/logo-data.ts logo mark + wordmark paths (split per stripe for the assembly animation)
  scenes/            one component per storyboard row
  overlays/          HUD frame chrome, cross-cut transitions
scripts/
  soundtrack/        dependency-free synth + mixer → public/audio/soundtrack.wav
  extract-icons.ts   Solar/MDI subset → src/design/icons-data.ts
public/fonts/        InterVariable, JetBrains Mono (bundled; renders never hit a CDN)
```

**Retiming:** move beats in `src/timeline.ts` (`SCENES` + the matching `CUES`), then
`npm run soundtrack`. Scenes read their local frame from their `<Sequence>`, and their internal
beats are relative to the scene start.

**Swapping the music:** drop any 30 s track at `public/audio/soundtrack.wav` (or change the
`src` in `Promo.tsx`).

## Licensing notes

- Remotion is free for individuals and companies of up to 3 people; larger companies need a
  [Remotion Company License](https://www.remotion.dev/docs/license).
- Fonts: Inter and JetBrains Mono (SIL OFL 1.1). Icons: Solar (CC BY 4.0) and Material Design
  Icons (Apache 2.0), via Iconify.
