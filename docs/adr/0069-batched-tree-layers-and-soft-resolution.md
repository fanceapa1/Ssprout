# ADR 0069 — Trees: batch marks into shared wet layers, dry soft passes at low resolution

- Status: accepted
- Date: 2026-10-22

## Context
Tree sprites are ~760×920 px at DPR 2. The engine's cost is the drying pass, proportional to
layer pixels. Painting a tree the straightforward way — one `inkLine` per branch, one
`foliageClump` (4 layers) per pad, one `dab` per petal — took ~400 ms per tree against a
150 ms budget.

## Decision
- **Skeleton**: all branches are tapered ribbons filled into one wet layer (they merge at forks
  like wet ink), then a handful of modelling/dry-brush strokes on thick limbs only.
- **Foliage**: `paintPadMass` reproduces `foliageClump`'s painting order (merged light body with
  paper gaps → mid-tone → cool shadow → darks, using the engine's `foliageLayout`) but shares
  layers across pads. Pads are split into 2 body passes so neighbours keep a wet edge between
  them.
- **Blossoms and leaves**: each petal / dot / leaf is a single fill of a cheap outline
  (`dabOutline` with few samples, small `blob`) in a shared layer; pigments are pre-mixed into
  a few tones. Blossom centres dry with their petals; only flowers with stamens get an extra
  crisp layer.
- **Soft passes** (pad mid-tone/shadow/darks, deep petal tints, the cherry's pink veil) dry at
  `softRes(p)` = 0.6 (draft 0.45, high = engine default).
- Plum blossom is `sizeClass: 'large'` (300×340) — a smaller, sparser tree.

## Consequences
Every tree renders in < 100 ms median (< 140 ms max) at DPR 2 on the dev machine under load;
see `docs/systems/plants-species-c.md`. Marks inside one layer merge wet-in-wet; where a
real edge between masses matters (petals of separate plum flowers, overlapping pads) the marks
are spread across 2–3 group layers instead.
