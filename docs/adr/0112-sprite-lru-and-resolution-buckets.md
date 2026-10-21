# ADR 0112 — Byte-budgeted sprite LRU and resolution buckets

- Status: accepted
- Date: 2026-10-22

## Decision
- Sprites are keyed `species|seed|step|w×h` with `w×h = size × slot.scale × resolution`, and the
  resolution is the viewport's pixel scale snapped to quarter octaves (≈ 19 %), capped at 2.4.
  Only a change of bucket re-renders; until the new sprites exist the old ones draw scaled
  (`best()` = closest resolution of the same instance+step).
- An LRU with a byte budget (64 MB garden, 24 MB plant view) evicts least-recently-used sprites,
  never ones used in the current frame epoch (it may overshoot rather than drop a visible plant),
  and closes evicted bitmaps. Drawables re-fetch sprites every frame, never hold them.
