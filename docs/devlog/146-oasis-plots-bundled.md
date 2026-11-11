# 146: The oasis plots' furrows bundled (Z3)

## What
The oasis's `plots` paint step was the costliest step in the app. Most of its time went to the
near plots' furrows: each furrow was two dry-brush strokes and a few seedling dabs, and each had its
own wet layer and drying pass. Now each near plot lays all its furrows' dark troughs into one
layer, their lit ridges into a second and its seedlings into a third. It then dries each layer
once (ADR 0343).
- `paint-batch.ts` (new): `dryBrushInto` lays `dryBrush`'s body and bristles into a given layer.
  `dryBrushDry` is the drying `dryBrush` would use. `batchLayer` opens a layer at the
  resolution one stroke's own layer would get. The bristles read each point's half-width and
  wobble once, not once per bristle. The values are the same and the noise calls are fewer.
- `paint-land.ts`: `paintPlots` uses them. It pauses every three furrows, after flushing the
  layers, and the drying passes pause by bands. The back beds are unchanged.

## Numbers
Prod preview, `?dev`, 1440×900, fresh context (cold paint cache), oasis on view, read from
`sceneStats()`. Medians of 3 runs. Before (main) and after were run back to back, and the machine was
busy (load 14–29).

| | DPR 2 plots | DPR 1 plots | longest plots part at DPR 1 |
|---|---|---|---|
| before, load ~14 | 1,315 ms | 978 ms | 13.4 ms |
| after, load ~14–22 | 717 ms | 505–551 ms | 14.1 ms |
| before, load ~27 | 1,581 ms | 858 ms | 13.0 ms |
| after, load ~27 | 660 ms | 479 ms | 13.6 ms |

That is −0.6 to −0.9 s at DPR 2 and about −0.4 s at DPR 1. A first version that paused every six
furrows had a 28 ms part at DPR 1, so it now pauses every three. What is left in the step is
the plots' own washes, the furrow marks' JavaScript and the back beds (about 150 ms of the profile).

## Pixels
- **Recording pins** (land): overview `65c786eb` → `dc191439`, detail `0dec365d` → `33e5d4a6`.
  The flow offsets of the drying passes are now drawn once per layer, not once per stroke. The
  strokes' own geometry and rng draws are unchanged: the seedlings and furrows sit where they did.
- **Art review**: before and after shots, overview and close views on each plot at noon and sunset.
  The mean change is 0.9–1.5 levels, and 0.2–2 % of pixels change by more than 12 (the overview's
  include moving creatures). The furrow rhythm, the dark and lit pairs, the seedlings and the
  colour read the same. No furrow looks stamped or merged. Side by side:
  `z3-plots-compare.png` in the task's scratchpad.

## Tests
- `scenery/oasis/paint-batch` (new): one stroke laid with `dryBrushInto` and dried with
  `dryBrushDry` makes exactly `p.dryBrush`'s canvas calls (a trough and a lit ridge).
- `scenery/oasis/land`: new pins. The `plots` step's pixel reads (one per layer dried) are bounded
  at 280 at the overview (they were 463).
- The oasis e2e specs pass.

## Left open
- **The back beds** (`paintBackBeds`) still dry each furrow stroke alone. Their width and opacity
  are drawn per stroke. Bundling them means folding the opacity into the marks' alpha, which
  needs its own art review. It would save roughly another 100 ms.
- `dryBrushInto` belongs in the engine (`strokeInto` in `primitives.ts`) if a second scenery
  wants it.
