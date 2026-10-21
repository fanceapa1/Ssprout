# ADR 0123 — Tall phones show at least 600 units of the world's width

- Status: accepted
- Date: 2026-10-22
- Amends: the viewport contract in docs/ARCHITECTURE.md ("clamped so nothing outside the world is
  ever shown")

## Context
Cover scaling on a 390 × 844 phone showed a 460-unit strip: the pond and path under half a screen
of empty sky, with every plant on the banks — and most placement spots — off screen.

## Decision
`createViewport` uses cover scaling but never shows less than `MIN_VISIBLE_W = 600` world units of
width. On a tall phone the world is then shorter than the screen and is centred vertically: bare
paper above and below, which the painting's own dissolving margins blend into. The x axis is still
clamped to the world. Landscape screens and tablets are unchanged (their visible width is already
larger).

- Systems that draw only inside the world are unaffected; the scene paints its clamped view.
- The ambience's lighting stretches its top/bottom rows over the paper beyond the world, so night
  has no seam; rain and other particles already used `viewport.visible`.

## Consequences
- `viewport.visible.y` can be negative on phones. Code that assumed `visible ⊆ world` vertically
  must clamp (none found).
- Plants are ~25 % smaller on phones than before, in exchange for seeing the garden.
