# ADR 0373: The coast's wildlife places: regions, far stages, a carrier for the caique

- Status: accepted
- Date: 2026-11-13
- Builds on: ADRs 0248 (scenery wildlife), 0304 (the oasis's targets), 0346 (creatures per garden), 0360 (the coast's layout)

## Context
The coast's twelve new creatures (docs/research/coast-biome.md §3) live in places the other gardens
never had. Damselfish hover in the shallows, an octopus crosses a rock pool, dolphins surface far out
in the bay, goats browse on the far cliff, a cicada clings to bark, and a gull stands on a moored
boat that a later motion task will rock. `SceneryFauna` knew water, perches, heron stands, ground
spots, wall faces and a perspective. Creature tasks must only add their own file
(docs/systems/fauna.md › Adding a creature).

## Decision
- **Regions: one new optional list on `SceneryFauna`**, passed to creatures as `FaunaWorld.regions`
  (`[]` by default). A `Region` (`fauna/targets.ts`) is `{ id, kind, outline, holes?, scale? }`,
  with kind `shallows`, `pool`, `bay`, `sky` or `bark`. `inRegion(r, q)` is inside the outline and
  in none of the holes, so "water minus rocks" is one region (the waterfall's foam carve is the
  same idea for the still water).
- **A far stage is a region with a depth scale.** `scale: { top, bottom }` is the scale of what
  moves there, linear from the region's top to its bottom (`regionScale(r, y)`), and it replaces
  `w.perspective` there. The bay takes the sea plane's scale (`seaScale`): the caique's measure at
  its waterline, falling linearly to nothing at the horizon, so what moves in the bay is drawn at 0.01–0.04.
  The goats' cliff ledges are perches of kind `ledge` with their own `scale`, as the oasis's tower
  is.
- **Far things carry their own measure.** As `KSAR_SCALE`, a creature's scale is 0.008 per unit a
  metre of what it stands on: `TEMPLE_SCALE` 0.13 (the tall columns read as 6 m shafts; also the
  promontory's ledges and pines) and `CAIQUE_MEASURE` 0.09 (the hull reads as a 7 m boat).
  `perspective(x, y)` stays the slots' rule, so fliers crossing the temple or the boat keep their
  size.
- **Carriers.** `Perch.carrier` names a moving body, and `SceneryFauna.carriers` (`FaunaWorld.carriers`,
  `{}` by default) maps it to a `Carrier { pivot, pose: { dx, dy, angle } }`. `carried(q, c)`
  gives a perch point now. The pose is written by whatever animates the body, each frame it draws
  it. This avoids sharing a clock: the fauna sim's time is its own, and the motion's is the
  renderer's. At rest it is all zero. The caique's three perches (mast top, two rail stretches)
  carry `carrier: 'caique'`.
- **Perch kinds** gain `branch`, `jar`, `ruin`, `boat` and `crown`.
- **Wall faces are shared by id.** `wall-*` are the dry-stone walls (the lizard, the gecko) and
  `splash-*` the splash rocks' front faces down to the water (the crab's waterline).
- **The rock pools are in the water clip.** The coast's `water` is the sea still and the pools as
  `moving` (no coast creature reads moving water as a stream), so `underwater` and `waterSurface`
  draw in them.
- **Places are read by name** from `layout.ts`, `shapes.ts`, `sea.ts`, `slots.ts` and `geometry.ts`,
  never from a painter, and the tests compare them against those shapes, so a repaint that moves a
  rock moves its perch.

## Consequences
- Contract change (additive, all optional): `SceneryFauna.regions`, `.carriers`;
  `FaunaWorld.regions`, `.carriers`; `Region`, `Carrier`, `inRegion`, `regionScale`, `carried`;
  `Perch.carrier` and five perch kinds; `Show.stage` gains `'coast'`. The other gardens are
  unchanged (empty regions and carriers).
- The coast motion task that rocks the caique must write `COAST_CARRIERS.caique.pose` (offset and
  clockwise tilt about `CAIQUE`) each frame it draws the boat, and reset it to zero when it stops.
- The coast's creature tasks add only `src/fauna/creatures/<kind>.ts` and a line in
  `creatures/sets/creatures-coast.ts`.
