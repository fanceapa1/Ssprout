# ADR 0165 — Plant sprite resolution follows the camera

- Status: accepted (amends ADR 0112)
- Date: 2026-10-23

## Context
Sprites were painted at one resolution bucket for the whole garden, capped at 2.4 device px per
world unit (`MAX_SPRITE_RES`). At 3× zoom on DPR 2 a plant needs ~5.4.

## Decision
- **Per plant**: a plant whose box overlaps the camera's detail view (+12 % margin) is painted at
  `resolutionBucket(detailView.pixelScale)`; every other plant keeps the overview's bucket. The
  detail view is the glide's destination, so the close sprites paint in the workers while the
  camera travels; meanwhile the cache draws the nearest resolution it has (unchanged).
- `MAX_SPRITE_RES` = 6, and **no sprite side exceeds `MAX_SPRITE_SIDE` = 2048 px** (a tree at full
  zoom would be ~3500 px tall; it is shrunk to fit, aspect kept). Byte budget 64 → 96 MB.
- When the detail view changes, renders still queued for the old view are dropped
  (`cache.dropQueued`); once the camera rests, **high-resolution sprites of plants no longer in
  view are evicted** (`cache.evictWhere`, never ones drawn this frame), on top of the LRU.
- Watering sprites are sized from the context's transform and follow the zoom by themselves; rim
  masks are built per bitmap (one per new resolution, as before).

## Consequences
`sprites.test.ts` (bucket at 5.4 px/unit, side cap, `evictWhere`) and `system.test.ts` (zoomed
plants get bigger sprites, plants out of view do not, eviction at the overview, culling by the
camera's view, `toDevice` follows the camera). The plant frame-cost e2e stays under 2 ms.
