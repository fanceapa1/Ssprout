# 22 — Close-view art

ADRs 0185–0189 · SPEC §12a · docs/systems/{scene,paint,plants,fauna,camera}.md

The camera now spends whole sessions at 2–3× on the plant being grown, so the close view must
look like leaning into a real watercolour.

## What
- **No seams** (ADR 0185). The vertical bands across the meadow were the **paper margins**: nine
  nested, nearly rectangular 20 % lifts whose straight sides run 200–320 units into the sheet. At
  1× they read as a vignette; zoomed, each side is a seam. They are now one continuous field
  (`marginField`): a ramp from each edge, its front wandering with world-anchored noise, combined
  as a soft maximum, sampled on a coarse grid. Along the way:
  - wet-layer **flow** is anchored to the layer's own area in the world (not its clipped buffer),
    and the two flow draws happen even for a layer that misses the canvas, so a detail painting
    is the overview resolved, not a different mottling;
  - **cross-fades** (detail over overview, repaint over old painting) are exact lerps (`lighter`),
    no pale pulse mid-fade;
  - the **reflected sky** on the pond fades out inside the painted rim (a feathered pond mask)
    instead of stopping at the outline: no hard pink band at the near edge at sunset (polish
    review);
  - mirrored **trunks** in the pond waver and break up with depth instead of being straight bands.
- **Close-up texture** (ADR 0186): a meadow step paints wet-in-wet green patches with pooled
  edges, granulation and back-runs, and sparse grass strokes in drifts, from a world-anchored grid
  of cells with forked rngs, culled to the painted rect, into the overview and the detail alike.
  **Trunks** gain a cool shadow flank, dry-brush striations, knots and joined forks (no square
  limb ends).
- **Solid plants** (ADR 0187). The "ghostly" peony was not a compositing bug: sprite opacity,
  the light plate and the rim were the same at every zoom, and the close sprite's mean alpha
  matched the 1× one (0.66–0.67). The sprites are transparent watercolour on white, and laid once
  they let a third of the landscape through; at 3× that is the hill line and the pond's rim. A
  sprite's body is now laid twice when it is painted (no per-frame cost); rim widths follow the
  bitmap's resolution by √k (they were capped in pixels and shrank to a third on a close sprite).
- **Sharp creatures** (ADR 0188): the parts cache keeps a resolution per view; a resting close view
  paints sharper parts in idle callbacks while the softer ones keep drawing; two resolutions kept.
- **Edges of the frame** (ADR 0189): a phone's strip painting is extended to the whole world 1.5 s
  after load in idle time, and its cut sides fade to paper; in the dock's plant view the watering
  can fades by its share in the frame (no stray spout at the upper right — polish review);
  `renderPlantView({ framing: 'growth' })` frames what has grown, used by the "Growing now"
  thumbnails (polish review; a one-line `src/ui/session-list.ts` change).
- **Light plate's base wash** at 3×: checked at every phase with contrast boosted; no banding or
  blotches (the wash is low-frequency and its 8-bit steps fall under the paper grain). Left as is.
- **Dev**: `sprout.mute({ systemId: layers | '*' })` leaves out what systems draw (isolating a
  layer in a probe or a pixel test); `sprout.fauna.art()` / `settleArt()`.
- **Studio**: `close-view/ground`, `/margin`, `/trunk`, `close-view-plants/solid`,
  `close-view-fauna/*` (overview | detail).
- **Tests**: `margins.test.ts`, `paint-ground.test.ts`, `art-cache.test.ts`, watering/view
  additions; `tests/e2e/close-view.spec.ts` (no seams at a pinned close view at sunset and night:
  the detrended column profile across the old bands steps < 2.2 levels — the banded margins
  measured 2.6–3.3, now 1.2–1.6; a plant's presence over the landscape at 3× is 0.9 of 1×).

## Looked at
Desktop 1440×900 at DPR 2 and phone 390×844 at DPR 3, every phase at zoom 1, 2 and 3, on a tree
peony (meadow-16), a violet (path-4, tier 1), an azalea (meadow-9, shrub), a Japanese maple
(back-6, tree), a lotus (water-3) and a hydrangea at the left edge (meadow-6), plus fauna
close-ups and a phone's first glide toward its side. Before/after (local, gitignored):
`artifacts/review/before/*.png`, `artifacts/review/after/*.png` (`desktop-<plant>-<phase>-z<zoom>`,
`phone-…`, `fauna-<kind>.png`, `phone-edge-midglide.png`, `phone-pond-sunset-z3.png`). Fixed on the
way: a fork's square limb end; the shadow-side ink line drifting outside a tapering trunk; a rim that
scaled fully with resolution became a ghost of each leaf (now √k); reserving paper under plants
was tried and dropped (pale cut-outs).

## Numbers
Headless Chromium, Apple M3, a machine shared with other agents; desktop DPR 2, 30 plants, three
runs each, before → after:
- Overview paint: CPU 0.81–0.98 s → 0.97–0.98 s; wall 1.1–1.4 s → 1.3 s.
- Detail paint of a 2.6× view: 2.3–2.7 s → 2.7–3.0 s wall (cooperative, ≤ 20 ms slices between
  steps; the meadow is two steps).
- Glide main-thread work per frame: avg 0.83–0.97 ms, p95 1.3–1.7 → avg 1.02–1.06 ms, p95
  1.5–2.0 ms (the glide-cost e2e stays green).
- Fauna's sharper parts: painted in idle slices of 8 ms; a few MB.
- Memory: a phone now keeps a whole-world painting (≈ 14 MB instead of a ≈ 5 MB strip).

## Left open
- At rest at 2.6× with 30 plants, headless frames cost ~20–47 ms of main-thread work before and
  after this task: the plants' posed, sliced blits of high-resolution sprites run on the CPU
  rasteriser in headless Chromium. With GPU canvases it should be small; worth measuring on real
  devices (and, if needed, fewer bend slices for sprites above a size).
- The margin seam test reads the canvas at DPR 1; the crossfade and pans are covered by
  construction (exact lerp, same marks) and by shots, not by a pixel test.
- Peony and lotus foliage stay airy by design (pale clumps); solid now, but a species art pass
  could give a few more dark accents.
