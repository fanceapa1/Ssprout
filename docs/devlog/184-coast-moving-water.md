# 184 · G6: The coast's moving water

## What
The coast's sea, waterline, rocks, pools and caique move, slowly and faintly, over the still
painting (docs/systems/scenery.md › Coast › Motion; ADRs 0282, 0374).
- `src/scenery/coast/motion.ts`: `createCoastMotion`, `COAST.motion`, in the coast's lazy chunk.
  - Swell: 80 soft broken pale streaks over faint teal troughs, 22 longer troughs and 20 glints
    drift in toward the beach, scaled by `seaScale(y)`, denser toward the horizon, few over the
    pale shallows. Each draws from 29 start places picked once.
  - Waterline: nine overlapping reaches of `FOAM_LINE`, each a lace, a wet band and a sheet of
    water. Every 7–11.5 s, out of phase, a reach runs 4–10 units up the shingle, then draws back,
    leaving the wet band to dry.
  - Rocks: the foam ring at the foot of every wet boulder and splash rock swells out and fades
    (5.5–9 s). The ledge's lips and the cliff's foot lap the same way.
  - Pools: still; a small ring now and then.
  - Caique: bob, roll and surge (`caiquePose`), the reflection mirrored to the pose, the mooring line
    from the posed stem, the buoy bobbing on its own, a ring from the hull now and then.
- `src/scenery/coast/pose.ts` (eager): `caiquePose(t, out?)` → `{ dx, dy, angle }` about `CAIQUE`,
  within `CAIQUE_SWING` (0.9 and 1.15 units, 1.9°); `posePoint(q, pose)`.
- **Wired to the wildlife (ADR 0373)**: each `draw` writes the pose into
  `COAST_CARRIERS.caique.pose`, so the mast and rail perches ride the boat through `carried`.
  Under reduced motion nothing writes it, so it stays at rest on the painted boat.
- **Contract** (ADR 0374, docs/ARCHITECTURE.md): `SceneryMotion.under?(ctx, t)`, drawn on
  `waterSurface` before the mirrored sky and `water.ts`. One line in `scene/system.ts`.
- `boat.ts` split into exported steps (reflection lifts, reflection colours, mooring under the
  water, hull, rig, mooring). The painting draws the same: `water.test.ts`'s hash pins hold.
- `index.ts`: `motion` and `pondSurface: 0`.
- Studio `coast-motion` (159): the cove, the beach, the boat, the rocks and the pools, live and as
  strips a second apart, and the sprite sheet.

## Decisions
- **The boat rocks over a plate of the sea painted without it** (ADR 0374). The painted boat stays
  for reduced motion and the thumbnails. The motion paints the painting's own `sea` step over
  `CAIQUE_BOX` (5 px a unit) and feathers it out over 6 units. It is drawn under the mirrored sky,
  so no box shows at noon or night (checked in the strips).
- **The generic water surface is off** (`pondSurface: 0`, ADR 0302). Its shimmer bands, rings and
  glints landed anywhere on the open sea, doubled the swell and crossed the boat. With it off,
  reduced motion leaves a still painting.
- **Colour from the light, not from code**: everything is on `waterSurface`, under the light plates,
  as the oasis's and the waterfall's are. The placeholder plates tint it now, and the daylight
  task's plates will tint it the same way. No sun or moon glitter path.
- **Plants over marks**: the Posidonia and the pool plants are `entities`, drawn after
  `waterSurface`, so the marks pass under them and never draw on a plant.
- **Time is the renderer's `t`**, as for every scenery motion (ADR 0282): `freeze()` holds it and
  the motion is pure in it. `sprout.advance` moves the dev clock, not this time, so it does not move
  the water. Making it do so would change the oasis's and the waterfall's motion too, and `?speed`
  would race the sea. The fauna carrier gets the pose written each frame, as ADR 0373 asks, so
  the two clocks never need to agree.

## Cost
`artifacts/g6/look.ts bench`: the app's `frameStats` (main-thread work a frame, average / p95 ms)
at 1440 × 900, DPR 2, Chromium with Metal, noon, 5 s a view. A/B: reduced motion (no motion is
created) against no preference, two passes each.

| view | without motion | with motion |
|---|---|---|
| overview | 0.53 / 0.8, 0.59 / 0.8 | 1.18 / 1.9, 1.61 / 2.2 |
| close on the boat (zoom 6) | 0.55 / 0.8, 0.52 / 0.7 | 1.03 / 1.3, 1.00 / 1.4 |
| close on the beach (zoom 4) | 0.50 / 0.7, 0.53 / 0.7 | 1.06 / 1.3, 1.07 / 1.4 |

The motion adds about 0.5 ms close up and 0.6–1.0 ms at the overview. After the bench the troughs
were batched into one composite switch (two per frame instead of one per trough). Unit test: at most
160 blits, 6 clips and 1 stroke a frame. Every clip is a cached `Path2D`, and no mark allocates. The
prepare paints about 100 parts, the sea plate the largest (the sea step, in its own parts).
Nothing draws while the stage is scrolled away (the render loop pauses, ADR 0224).

## Looked at
`artifacts/g6/`, rounds r1–r5: frames a second apart in the real app.
- Desktop at noon: the overview, the beach (zoom 4), the boat (zoom 6), the rocks (3.5).
- The same at night.
- A phone at noon.

Fixed on the way:
- The swell's streaks read as hairlines. They are now soft broken bands over a trough, two to
  three times longer.
- The rock foam was too faint to see swell. It is now stronger and swells out 2 units.
- A swell mark could drift onto rock or out of the sea. A start place now needs both its start and
  its end in the sea, clear of rock and the boat, and falls back to the open bay.

## Tests
- `src/scenery/coast/motion.test.ts` (11): the motion is pure in `t` and holds when frozen. Swell,
  rock foam and wavelets are always there, and glints, rings and pool rings come and go. Every
  mark is in its water, off rock and off the boat. The pose is bounded, continuous and inside the
  plate. A mast perch follows the pose through the carrier. Under reduced motion nothing is drawn
  and the carrier stays at rest. Nothing is drawn off screen. The frame cost is bounded.
- `coast.test.ts`: the coast now has a motion.

## Left open
- The bastion's ledge faces have no moving foam (their block feet are internal to the rock
  painter). Only the lips, the cliff's foot and the boulders lap.
- The waterline's lace is close to the painted foam, so at the overview the reach reads mostly as
  the sheet and the wet band moving.
- The plate hides the `underwater` layer inside `CAIQUE_BOX`. No coast creature swims there yet.
- `sprout.advance` does not move the water (Decisions).
