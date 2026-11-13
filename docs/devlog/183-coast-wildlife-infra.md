# 183 · Coast wildlife infrastructure (GK0, phase 15)

## What
The groundwork for the coast's creatures (GK1–GK12): each creature task now only adds
`src/fauna/creatures/<kind>.ts` and its line in `creatures/sets/creatures-coast.ts` (ADR 0373).
The twin of OK0 (devlog 127).

- **Rows** (`src/scenery/coast/fauna.ts`, data only), 19 in threshold order, skipped until their
  modules exist:

  | id | kind (variant) | rule |
  |---|---|---|
  | `island-cat` | `cat` | always, unannounced |
  | `gull` | `gull` | 1 plant |
  | `cicada` | `cicada` | 2 plants |
  | `green-lizard` | `green-lizard` | 3 plants |
  | `butterflies` | `butterfly` (white) | 4 pollinator flowers |
  | `rock-crab` | `rock-crab` | 5 plants |
  | `bees` | `bee` | 6 pollinator flowers |
  | `swallows` | `swallow` | 7 plants |
  | `blue-rock-thrush` | `rock-thrush` | 8 plants |
  | `swallowtail` | `butterfly` (swallowtail) | 8 pollinator flowers |
  | `goats` | `goat` | 9 plants |
  | `tortoise` | `tortoise` | 10 plants |
  | `damselfish` | `damselfish` | 11 plants |
  | `scops-owl` | `scops-owl` | 12 plants, at night |
  | `hoopoe` | `hoopoe` | 13 plants |
  | `gecko` | `gecko` (house) | 14 plants, at night |
  | `octopus` | `octopus` | 16 plants, rare |
  | `heron` | `heron` | 18 plants, rare |
  | `dolphins` | `dolphin` | 20 plants, rare |

  No plant count brings two creatures. The one overlap is the swallowtail's 8 pollinator flowers
  and the thrush's 8 plants: only a garden whose first eight plants are all pollinator flowers gets
  both at once, as the oasis's hoopoe and swallowtail do. I kept the orchestrator's numbers. The
  hawk-moth, shearwater and turtle are not in the table.
- **Creature set** `creatures-coast.ts`: bee, butterfly, heron, swallow (the shared kinds with a
  module). It is its own lazy chunk; nothing loads at boot (ADR 0346). The registry test now lists
  four gardens.
- **Contract** (`habitat.ts`, `targets.ts`, `types.ts`, `sim.ts`, `def.ts`; additive, all
  optional, ADR 0373, docs/ARCHITECTURE.md updated):
  - `Region` (`inRegion`, `regionScale`) reaches creatures as `w.regions`. A far stage is a
    region with a depth scale.
  - `Carrier` (`carried`) and `Perch.carrier` reach creatures as `w.carriers`, so the caique's
    perches can follow it once it rocks.
  - `Perch.kind` gains `branch | jar | ruin | boat | crown`.
  - `Show.stage` gains `'coast'`.
- **Places** (`src/scenery/coast/wildlife.ts`, read by name from `layout.ts`, `shapes.ts`, `sea.ts`,
  `slots.ts` and `geometry.ts`, never a painter):
  - 54 perches: 26 copings, 6 branches, 2 jars, 3 splash rocks, 4 temple ruins, 3 on the caique,
    3 far crowns, 7 cliff ledges.
  - 24 ground spots: 9 terrace walks, 3 path, 2 beach, 10 scrub.
  - 7 faces: 3 walls and 4 splash-rock fronts.
  - 8 regions: shallows, 3 pools, the bay, the sky over the cove, 2 barks.
  - 3 heron stands, and the caique carrier.
  - Far measures as the oasis's `KSAR_SCALE`: `TEMPLE_SCALE` 0.13 and `CAIQUE_MEASURE` 0.09. The
    bay is at the sea plane's scale, 0.01 → 0.04.
  - `coastPerspective(x, y)`: terrace lifts and faces on the land, `perspectiveScale(y)` on the
    sea, the beach and the shelf.
- **Water**: the sea still; the rock pools as `moving`, so the water layers clip to them.
- **Studio**:
  - `coast-wildlife/targets`, `/targets-close` and `/targets-far` draw every place over the
    painting with a creature of its size;
  - `fauna-coast/all` runs the table over the cove (`COAST_STAGE` x 120, y 220, 960 × 680).
- `src/scenery/coast/index.ts` takes `COAST_WILDLIFE` from `wildlife.ts`. The oasis studio's kind
  colours are now partial (the new perch kinds). `src/main.ts` is not touched.

## Why
The oasis's pattern: the whole table up front, rows skip until their modules land, and the
scenery says where its creatures live. The coast needs places that are areas rather than points
(water minus rocks, a pool, bark), stages far away with their own size, and a boat that will move.
A region with a scale covers both the bay and the bark. The carrier's pose is written by the
motion, not computed from a shared clock, because the fauna sim's time and the renderer's differ.

## Looked at
`artifacts/gk0/`:
- `entry-coast-wildlife_targets-1440x900.png`, `-close`, `-far`: the studio entries;
- `alive.png`: the coast in the app with the shared creatures;
- `entry-coast-map_map-1440x900.png`: the composition map.

What I saw:
- The copings, jars and splash-rock tops are where they are painted. The caique's perches sit on
  its mast top and gunwale.
- The architrave, the broken columns' slants and the drum are right, but tiny at 0.13. The cliff
  ledges sit on the painted face under the temple and right of the olive.
- The bay lies under the far hill's reflection, left of the suns, above the boat.
- The shallows run from the turquoise's edge to the foam, between the pine and the steps.
- In the app, with `?dev&scenery=coast`, `showScenery('coast')` and 25 plants:
  - `roster()` lists all 19 rows, with visitors butterfly, bee, swallow and heron, and butterfly
    variants white and swallowtail.
  - Spawned by row id:
    - bees, cabbage whites and a swallowtail fly between the terrace flowers and land on them;
    - swallows sweep across the sky band;
    - the heron glides in and stands at its stand (130, 734), then (320, 742).
  - No page errors.

## Left open
- **The cat** (GK1): `wall` perches, `walk-*`, `path-*`. The olive's shade is `walk-top-east` and
  `walk-top-mid` either side of the trunk.
- **The gull** (GK2): `boat` perches, via `carried(p, w.carriers.caique)`; `rock` perches;
  `sky-cove`; `w.pond`. At `CAIQUE_MEASURE` a gull is small; size it against the boat.
- **The cicada** (GK3): `bark-olive`, `bark-pine`.
- **The crab** (GK4): the `splash-*` faces (foot = waterline) and the `pool-*` rims. The first
  splash rock has no top perch, because its slot fills the top.
- **The thrush** (GK5): `ruin`, `wall` and `ledge`. There is no chapel perch: the village is too far.
- **The goats** (GK6): the seven `ledge` perches at `TEMPLE_SCALE`. Check them on the painting.
  The face's hard beds are drawn by the painter, so the ledges are placed at 45 % down the face, not
  on a painted bed.
- **The tortoise** (GK7): `scrub-*`, `walk-*` and `path-*`.
- **The owl** (GK8): `branch` (the olive's fork and limb 3), `wall`, `crown`.
- **The dolphins** (GK9): `bay`, at `regionScale`. They never come near the caique.
- **The lizard** (GK10) and **the gecko** (OK6): the `wall-*` faces. OK6 must add a `house`
  variant to the gecko, or the coast row falls back to its own pick (the table test checks it).
- **The damselfish** (GK11): `shallows`. **The octopus** (GK12): `pool-*` and `shallows`.
- **The motion task**: it must write `COAST_CARRIERS.caique.pose` each frame it draws the boat
  (ADR 0373).
- `crack-1` is 0.03 off `coastPerspective` (a face slot takes its own y's lift); left as it is.
- No Playwright spec, as OK0 had none. The fauna, sceneries, gardens and lazy-creatures e2e specs
  were run (Tests below).

## Tests
- Unit: `scenery/coast/fauna.test.ts`, `scenery/coast/wildlife.test.ts`, and additions to
  `fauna/targets.test.ts`, `fauna/lazy-creatures.test.ts`, `fauna/creatures/registry.test.ts`
  and `scenery/coast/coast.test.ts`. Full suite: 254 files, 2640 tests, all pass.
- E2E (one file at a time, one worker): `lazy-creatures` 2, `fauna` 6, `fauna-waterfall` 4,
  `fauna-oasis` 4, `sceneries` 8, `gardens` 7, all pass. The full e2e suite was not run.
- `fauna-coast/all` renders over the cove (studio shot at t 30).

Status: done.
