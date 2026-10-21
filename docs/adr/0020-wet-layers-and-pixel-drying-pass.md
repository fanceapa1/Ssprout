# ADR 0020 — Wet layers with a per-pixel drying pass

- Status: accepted
- Date: 2026-10-22

## Context
The look depends on things plain canvas fills cannot do: pigment pooled at a wash's rim with a
lighter centre, granules that sit in the paper's valleys, dry brush that skips the paper's
peaks, blooms with a dark crinkled fringe. Pure "Hobbs-style" layered polygons (dozens of
deformed fills at ~4% alpha) give soft, organic edges but a *lighter* rim and no paper
interaction, and need 30–50 layers per shape. WebGL would be fast but adds a second rendering
path, context limits and test complexity, and `ctx.filter` blur is not available everywhere.

## Decision
- Every mark is first drawn into a private, CPU-backed (`willReadFrequently`) **wet layer**
  covering only its bounds, in the target context's user space (any transform). Layers come
  from a small pool so nothing is allocated per mark.
- `dry()` reads the layer back once and runs a pure per-pixel pass (`dryPixels`):
  coverage is perturbed by the paper grain and shaped toward a wet edge; a box blur
  (half resolution for wide rims) gives `edge = shaped − blur`, used to pool pigment and darken
  the rim; a coarse flow-noise grid mottles density; the shared paper grain drives
  granulation, granules, speckle and dry brush. The result is composited onto the target with
  `multiply` by default.
- Marks drawn into the same layer merge wet-in-wet; separate layers dry separately and glaze.
  The `layer()`/`dabInto()` API exposes this choice to other agents.
- A `quality` knob scales layer counts and the wet-layer resolution.

## Consequences
- 12–16 fills per wash are enough (the pass does the rest); rims, granulation and paper
  agreement come for free on every primitive.
- Cost scales with wet-layer pixels (~18 M px for a dense 3200×2000 background ≈ 1.25 s at
  normal quality). Fine for cached backgrounds and sprites, never per frame.
- The pixel maths is unit-testable on typed arrays without a canvas.
