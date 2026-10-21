# ADR 0125 — Tier-1 ground plants: a design box and a larger garden box

- Status: accepted
- Date: 2026-10-22

## Context
White clover, dandelion, violet, forget-me-not and wild strawberry were drawn in the 70 × 70
`small` box; at far-bank scale (0.55) that is ~35 px and the plants read as a few dots.

## Decision
- `PLANT_SIZES.small` becomes 86 × 86. The five species keep drawing in their 70-unit design box
  (`plantFrame(p, def, opts, SMALL_DESIGN)`), so the whole drawing scales up by 86/70 instead of
  the plant shrinking inside a bigger box. `def.size` is the garden box (sprite size, bounds and
  labels all follow).
- They grow a few more leaves and heads (clumpier) and their heads carry a little more value
  (violet and forget-me-not deeper, clover's florets shaded).

## Consequences
- Slot spacing is unchanged; neighbouring ground plants may touch, as ground plants do.
- Maidenhair fern (foliage) keeps 70.
