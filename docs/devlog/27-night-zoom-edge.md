# 27 — The night zoom edge (Q2)

## What
A reviewer reported two things at night, zoomed in (zoom ≈ 3) on a seedling, at 1440 × 900:
- a lighter rectangle with a hard edge at the top left;
- a plant sprite cut off by a hard edge.

ADR 0206.

## How it was found
- **Reproduced** with `?dev`, using `setTime('night')` and `start(…)` (the camera frames the
  seedling at 3×). I also tried `addPlants(25)` with `focusPlant` on seven plants (edges and
  centre, before and after the detail settles) and the world's corners. Every view over the left
  meadow showed the same thing: a straight horizontal line, lighter above. The "vertical edge"
  is where that lighter band ends at the pond's bank, which is painted opaque. The line runs
  through any plant that stands across it, as with a tree peony on `meadow-2`.
- **Mapped** the line to world y 500 (`camera.toClient`). That is the bottom of `SKY_RECT`.
- **Isolated** it with `sprout.mute`. Muting either the scene's background or the ambience's
  `lighting` layer removed the line, and so did skipping only the sky's multiply. Reading the
  canvas alpha with only the background drawn showed why: the painting is partly transparent
  (alpha 40–250), and above y 500 the sky plate makes it opaque.
- **Cause**: the night's desaturation is a `saturation` fill, which composites source-over. It
  leaves its grey wherever the frame is still clear, but not above y 500. Multiplies are
  unaffected. Midday, sunrise and sunset have no desaturation, so they show no line. The
  sunset→night and night→sunrise blends have the line in proportion to the night weight.

## Fix
- `src/ambience/ambience.ts` › `drawLighting`: white goes behind the frame (`destination-over`)
  before the saturation fill, so the glaze only desaturates.
- The fill now covers the drawn view, not only the overview's crop.
- The multiplies after it are unchanged.
- No new visual, so no studio entry.

## Test
`close-view.spec` › "no hard line where the sky plate ends, at night, zoomed on the meadow". It
pins a 3× view at (260, 500) and takes a row profile over world x 40–420. The largest detrended
step must stay under 3 levels at night and in both blends. It measured 9.7 at y 500 before the
fix and 1.6–2.0 after. TESTING.md row 12a.22.

## Screenshots (`artifacts/shots/`, gitignored)
- `q2-before-zoom-1440x900.png` / `q2-after-zoom-1440x900.png`: the seedling at 3×, night.
- `q2-before-plant-1440x900.png` / `q2-after-plant-1440x900.png`: a tree peony across y 500.
- `q2-before-overview-1440x900.png` / `q2-after-overview-1440x900.png`: the night overview.

## Left open
- The night garden is a little lighter where the paint is thin (the path, the pale meadow),
  because the accidental grey haze is gone: about 9 levels lower in the frame, about 5 overall.
  It still reads as night. If the owner wants the old weight back, deepen
  `PHASE_GRADES.night`. Don't add grey to clear pixels.
- Screen-blend marks drawn before the lighting (glints, plant rims) still see a frame that is
  clear below y 500 and opaque above it. I measured no line in any daytime phase (row step
  ≤ 2.4 there), so I left them alone (ADR 0206, alternatives).
- No change to `src/main.ts`.
