# ADR 0302: A scenery can still the generic water surface on its pond

- Status: accepted
- Date: 2026-11-05
- Builds on: ADRs 0185 (pond mask), 0282 (scenery motion)

## Context
The scene draws `water.ts` (slow shimmer bands, a ripple ring every 9 s, sun glints) over every
scenery's pond. That suits the garden's pond and the waterfall's pool. The oasis's basin is a
stone tank fed by a slow inlet: it should read as a mirror, with only the rings O6 spreads from the
inlet (devlog 117, Left open). Its generic rings and glints land anywhere on the water and fight
the reflected ksar.

## Decision
- **`Scenery.pondSurface?: number`**: how much of the generic surface plays on the pond, 0–1.
  Left out it is 1. The scene system passes it to `createWaterSurface` as `strength`.
- **`WaterOptions.strength`** scales the alpha of every shimmer, ring and glint blit. At 0 the
  surface's `draw` returns at once: no clip, no blit. The mirrored daylight sky and the scenery's
  `motion` are drawn by the scene, not by `water.ts`, so they are unchanged.
- **The oasis sets 0.** Under reduced motion it is also 0 there, so the basin stays a still mirror.
- The garden and the waterfall leave it out. At strength 1 every alpha is multiplied by exactly 1,
  so their blits and pixels are identical (checked against the previous `water.ts`, call for call).

## Consequences
- A new scenery with still water sets `pondSurface` instead of painting over the shimmer.
- A scenery that wants a calmer but living pond can set a value between 0 and 1.
- Rain rings, striders and floating leaves come from other systems and still use the pond.
