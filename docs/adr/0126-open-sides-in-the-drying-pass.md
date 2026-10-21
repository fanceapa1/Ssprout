# ADR 0126 — No wet edge where a wash is cut off by the canvas

- Status: accepted
- Date: 2026-10-22

## Context
A faint hard dark line ran around the garden's edges. A `WetLayer` clamps its area to the target
canvas; the drying pass finds edges by blurring coverage with "outside = 0", so a wash cut off by
the canvas pooled pigment along the cut as if the shape ended there.

## Decision
`WetLayer` records which sides were cut by the canvas (all sides for a whole-canvas layer) and
`boxBlur` / `edgeBlur` / `dryPixels` take `OpenSides`: on an open side the border value continues
outward instead of zero. Closed sides behave exactly as before.

## Consequences
Only pixels where a shape touches the buffer border change — always a clipping artefact. Sprites
whose leaves touch their canvas edge lose a false rim there too.
