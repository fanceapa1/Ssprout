# ADR 0343: The near plots' furrows dry as one layer per plot

- Status: accepted
- Date: 2026-11-11
- Amends: ADR 0330 (oasis paint pauses), for the near plots only

## Context
The oasis's `plots` step was the costliest paint step in the app: 1.3–1.6 s at DPR 2 and about
0.9 s at DPR 1, cold. In the profile most of it was the near plots' furrows. Each furrow was
two `dryBrush` strokes and a few seedling dabs, and each of those had its own wet layer and its
own drying pass. A furrow runs on a slant toward the vanishing point, so its layer's box was
mostly empty paper. The cost was per call: at DPR 1 the step still took 70 % of its DPR 2 time.

## Decision
- **One layer per kind of mark, per plot.** Each near plot paints its furrows' dark troughs into one
  wet layer, their lit ridges into a second and its seedlings into a third. Each layer covers the
  plot's outline and dries once. The marks, their order within a layer and their rng draws are
  the same as before.
- **The marks come from `paint-batch.ts`.** `dryBrushInto` lays `dryBrush`'s body and bristles
  into a layer the caller gives it. `dryBrushDry` gives the drying `dryBrush` would use. A test
  checks that one stroke laid and dried this way makes exactly `p.dryBrush`'s canvas calls.
  `batchLayer` sets the layer's resolution to what one furrow's own layer would get, so the
  bristles stay as sharp as before.
- **A pause every three furrows.** The loop pauses through `pacer(MARKS_PER_PART / 2)` and
  flushes the three layers first, so each part rasterises its own marks. The drying passes pause by
  bands (`dryParts`). The plot's clip stays on the job canvas across the pauses (ADR 0330).
- **The engine is not changed.** A `strokeInto` in `primitives.ts` would be the general form. It
  belongs to the engine's owner. If a second scenery needs this, move `dryBrushInto` there.

### Rejected
- **One layer for all three plots.** The plots are far apart, so one box would be mostly empty.
  It would also need one clip for three outlines.
- **Troughs and ridges in one layer.** The ridges are painted `source-over` and the troughs
  `multiply`, so they need two composites.

## Consequences
- The flow offsets of the drying passes are drawn once per layer, not once per stroke. That
  changes the land recording pins: overview `65c786eb` → `dc191439`, detail `0dec365d` → `33e5d4a6`.
- Where two marks of the same layer touch, they now merge before drying instead of each getting
  its own rim. Furrows are 22 apart and seedlings are about 45 apart along a furrow, so they
  almost never touch. The troughs are all composited before the ridges, not furrow by furrow.
  Changes on screen are small (mean 0.9–1.5 levels, devlog 146).
- `plots` at DPR 2 went from 1.3–1.6 s to 0.66–0.72 s. At DPR 1 it went from 0.86–0.98 s to
  0.48–0.55 s. Its longest part stayed at 13–15 ms at DPR 1.
- The back beds' furrows still dry one stroke at a time. Their width and opacity are drawn per
  stroke, so batching them would change how they look. That is left open.
