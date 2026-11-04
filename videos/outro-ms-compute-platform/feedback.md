# Outro: millisecond compute platform: feedback

One `## vN` per draft, added by `npm run draft`. Under it: the notes on that draft (verbatim,
with the slate timecodes they point at), then `Changed:` what the next draft did about them.

## v1 · 2026-11-04 · full cut · out/drafts/outro-ms-compute-platform/v1.mp4

> lets animate the squares in a staggered motion from edges to center. then, lets fade in the
> letters, not morph/transform them. use Inter Display for the logo, not Inter. (i think this
> involves removing the svg letters) raise the weight of the subtitle a tad more. (this applies
> for all three)

Changed:

- Squares pop in staggered, ring by ring from the frame edges to the clear centre (14 rings,
  3.5 frames apart, a few frames of per-square jitter, `EASE.back` pop) instead of one smooth sweep.
- Wordmark is live "Unikraft" text in Inter Display (InterVariable at `opsz` 32, weight 600)
  instead of the SVG letter outlines, matched to the mark's cap height and re-centred
  (new kit `Logo` option `font="display"`).
- Letters fade in one by one, opacity only, no rise (new kit `Logo` option `letters="fade"`).
- Subtitle weight 300 → 400.

## v2 · 2026-11-04 · full cut · out/drafts/outro-ms-compute-platform/v2.mp4

> nice. i forgot sorry: make all videos square, just like the r15 isonoe.
>
> while at it, can we animate the unikraft logo more quickly?

Changed:

- Canvas 1920×1080 → 1440×1440 (like r15). The halftone field sizes itself from the canvas; lockup 176 → 140 px tall, tagline 76 → 60 px, clear centre widened (0.44 → 0.5) so the tagline stays clear of the squares.
- Logo assembles at the kit default speed (`pace` 1.5 → 1); the tagline lands half a beat earlier (beat 2.5 → 2) to follow it.

## v3 · 2026-11-04 · full cut · out/drafts/outro-ms-compute-platform/v3.mp4

> nice. lastly, lest just make the unikraft logo animate faster generally, its still a bit too slow.

Changed:
- Logo `pace` 1 → 0.6: the whole lockup builds in ~0.5 s. The tagline lands half a beat earlier (beat 2 → 1.5) to follow it.

## v4 · 2026-11-04 · full cut · out/drafts/outro-ms-compute-platform/v4.mp4
