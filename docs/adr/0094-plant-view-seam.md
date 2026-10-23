# ADR 0094 — `renderPlantView`: one seam for "this species at this growth"

- Status: accepted; the signature stands, the internals described here were replaced by ADR 0118; amended by ADR 0189
- Date: 2026-10-22

## Context
ADR 0003 makes the session's plant the centre of the widget (and of start-sheet previews and the
garden). The plants task will provide cached growth-stage sprites and a painted watering
animation; the widget needed something working now without blocking on it.

## Decision
- `src/plants/view.ts` exports `renderPlantView(canvas, { speciesId, seed, growth, watering, wilt? })`
  (signature set by the orchestrator). Today: clear, contain the species with its base at the bottom
  centre, draw `species.draw(painterFor(ctx, { seed }), createRng(seed).fork(id), …)` once per
  quantised growth (24 steps, small LRU cache), and a placeholder watering animation (can slides in
  and tilts, droplets arc to the base, soil darkens, the sprite lifts by ~4 %). Returns `false`
  for unknown species.
- The widget card calls it through a `PlantRenderer` callback and falls back to its own seeded
  sprout (`src/widget/sprout.ts`) when it returns `false`; the sprout stays independent of the
  paint engine so the widget never shows an empty card.
- The plants task owns the internals and may change everything behind the signature.
