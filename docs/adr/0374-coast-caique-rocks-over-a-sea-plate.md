# ADR 0374: The caique rocks over a plate of the sea painted without it, under the mirrored sky

- Status: accepted
- Date: 2026-11-13
- Builds on: ADRs 0282 (scenery motion), 0302 (the generic water surface), 0366 (the coast's sea),
  0373 (the caique's carrier)

## Context
The coast's caique is painted into the still painting (the `caique` step), so reduced motion and
the thumbnails show it. A boat that bobs and rolls has to move away from where it is painted, and
a sprite drawn over the painting leaves the painted hull, mast and reflection showing round it.
ADR 0282 has the motion go over the painting and never cover it. The motion draws on
`waterSurface` after the mirrored daylight sky (`sky.drawWater`) and `water.ts`, so anything it
lays over the painted boat would also cover that tint and read as a pale box on the sea.

## Decision
- **A plate of the sea without the boat.** The motion's `prepare` runs the painting's own `sea`
  step (same seed, same rng labels, `coastSteps(art, ['sea'])`) into a small canvas over
  `CAIQUE_BOX` at 5 px a unit, adds the mooring line under the water and the buoy's ring, and
  feathers its alpha to nothing over 6 units round the box. The painted boat lies wholly inside
  the opaque part.
- **`SceneryMotion.under?(ctx, t)`**: an optional draw, pure in `t`, that the scene system calls on
  `waterSurface` before the mirrored sky and the generic surface (one line in `scene/system.ts`).
  The coast draws the plate there, then the reflection posed (its lifts over the water, its colours
  multiplied in), so the sky's tint and the light plates lie over them as over the painting.
- **The boat in pieces from the same painters.** `boat.ts` splits its steps (reflection lifts,
  reflection colours, mooring under the water, hull, rig, mooring) without changing what the
  painting draws (its hash pins hold). The motion paints the hull and rig as one sprite, carries it
  by `caiquePose(t)` about `CAIQUE` and clips it at the water line, with the keel run on a little
  under it so a lift shows wet red, not a gap. The mooring line is a thin stroke from the posed
  stem to where it meets the water, and the buoy bobs on its own.
- Each frame the motion writes the pose into `COAST_CARRIERS.caique.pose` (ADR 0373), so perches on
  the boat ride it. Under reduced motion the motion is never created: the painted boat stays, and
  the carrier stays at rest.

## Consequences
- Contract change, additive and optional: `SceneryMotion.under`. The garden, the waterfall and the
  oasis are unchanged.
- The plate hides what other layers drew under it inside the box (the `underwater` layer: a fish
  passing right under the boat would be hidden there). No coast creature swims there yet.
- The plate costs the sea step's script once (about 100–170 ms in parts, in the motion's
  `prepare`, which the first paint's `ready()` waits for), and about 2 MB of bitmap.
- The hull on the water no longer takes the mirrored sky's tint, which the painting gave it.
