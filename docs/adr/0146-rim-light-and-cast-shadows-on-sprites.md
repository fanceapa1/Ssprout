# ADR 0146 — Rim light and cast shadows on sprites

- Status: accepted; amended by ADR 0187
- Date: 2026-10-23

## Context
Sunrise and sunset need warm rim light on canopies, rocks and plants and long shadows away from
the sun; midday short shadows. Plants and boulders are sprites drawn per frame (plants sway);
repainting them per phase would multiply the worker work and the cache.

## Decision
- **Rim** (`src/paint/rim.ts`): a sprite's sun-facing edge = its alpha minus a copy shifted
  away from the sun (≈ 4 % of its size, 1.5–9 px; a second half-shift at half strength softens
  it), filled with the rim colour. Cached per image (WeakMap), side and colour quantised to 16
  levels, built lazily; drawn over the sprite with `screen` at the phase's strength using the
  sprite's own pose (the plant system calls `drawPlant` again with the mask). Plants take it at
  0.85, boulders at 0.7. Growing plants use the nearer growth step's sprite (the cross-fade buffer
  changes every frame).
- **Plant shadows** (`src/plants/shadow.ts`): one pre-painted watercolour blot (cool violet-grey
  glaze, darker at the foot, lost toward the tip) stretched from the plant's base along
  `castShadow`: ≤ 1.3× the plant's visible height, about half its width thick, almost flat on the
  ground; a pool centred under the plant at midday. Multiplied before the plant at its depth; none
  on open water.
- Scene trees, shrubs, boulders and the engawa get their shadows painted into the phase's light
  plate (ADR 0147).

## Consequences
One extra blit per plant for the shadow and one for the rim (sunrise/sunset only); masks cost
memory like a second copy of the sprites in view (released with them).
