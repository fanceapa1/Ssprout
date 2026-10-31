# ADR 0248: Wildlife per scenery

- Status: accepted
- Date: 2026-10-31
- Builds on: ADR 0070 (sim behind the system), 0073 (visit scheduling), 0120 (announced on first
  sight), 0240 (a garden per scenery), 0241 (the scenery contract), 0243 (switching at runtime)
- Amends: 0120 (the event carries the garden), 0240 (unlock tables leave core), 0243 (fauna no
  longer stays empty outside the Japanese garden)

## Context
The waterfall needs its own creatures (B0 §3: dipper, damselfly, iwana, sawagani, kajika,
iwatsubame, Genji firefly, yamasemi) and shares a few of the garden's in their gorge forms (B0 §4).
The code audit (B1) found that every new creature edited about ten shared files (closed kind
unions, `VISITS`, `SIZES`, the `Roster` shape, `VISITOR_OF`, `KIND_ALIASES`, `ARRIVAL_OF`, the spawn
switch, studio sheets and shows), that the unlock table lived in core as a single global, and that
`wild()` (fauna off outside the Japanese garden) hid four bugs: bare ids compared with the
namespaced `faunaSeen`, arrivals recorded in the garden on view, a `fauna:arrived` without its
garden, and one global arrival table. A line fitted through the waterfall's slot scales was 7–15 %
off at its ledges; the water clip knew only the pond; perches were rocks and stepping stones only;
heron stands assumed the pond's far edge was open water.

## Decision
- **A creature is one file.** `src/fauna/creatures/<kind>.ts` default-exports a `CreatureDef`:
  `kind` (= the file name), `title`, `role` (`resident` kept by upkeep · `visitor` scheduled and
  counted against the cap · `drifter` scheduled, not counted), `visit?` (pacing), `resident?(n,
  mode)`, `needs?(w)` (its targets exist), `rank?` (upkeep order), `spawnCount?`, `variants?`,
  `spawn(w, s)`, and the studio's `sheet?` and `show?` (`stage: 'pond' | 'falls'`, `order`,
  `group`). `creatures/registry.ts` globs `./*.ts` (helpers live in `creatures/lib/`). The sim,
  schedule, dev API and studio read the registry; kinds are plain strings. The garden's own
  pacing stays in `tuning.ts › VISITS`, which their defs reference; new creatures may keep theirs
  in their file.
- **Unlock tables are data per scenery.** `core/fauna-unlocks.ts` is generic: `FaunaUnlock { id,
  kind, variant?, rule, arrival, announce, unlocked(counts), boost? }`, `FaunaTable`,
  `unlockedFauna(state, lookup, sceneryId, table)` (rows), `newlyArrived(…, table)` (ids),
  `faunaRow`. Core imports neither `src/fauna` nor `src/scenery`. The Japanese garden's table
  moved verbatim to `src/scenery/japanese-garden/fauna.ts` with a `kind` per row, `boost: 'bird'`
  on koi-3 and one new silent row, `leaf`, last (it used to come with the striders; last keeps the
  visit order and so the seeds). The waterfall's whole table is in `src/scenery/waterfall/fauna.ts`
  now. `src/scenery/fauna.ts › faunaTable(id)` gives the tables without loading the paintings.
- **The roster comes from the unlocked rows** (`rosterFor(rows)`): resident counts by kind,
  visiting kinds in table order, variants per kind in row order, boosted kinds. Rows whose
  creature module does not exist yet are skipped: never spawned, never announced. Art tasks add
  files and nothing else. Shared creatures adapt per garden through `variant` (the waterfall's
  dragonfly is `aka`, its butterflies `swallowtail`, its birds `wagtail`, its leaf `maple`, its
  striders `margin`); a resident's n-th individual may take the n-th variant.
- **`Scenery.fauna: SceneryFauna`** (`src/fauna/habitat.ts`): `unlocks`, and optionally `water {
  still, moving, avoid }` (foam ellipses carved out of the still water), `perches`, `stands`,
  `perspective(x, y)`. Without them the sim derives everything from `SceneGeometry` as before.
  `FaunaWorld` gains `water { moving, clip }`, `stands()` and `perspective(y, x?)`; the water
  layers clip to the union of the still outline and the streams (wound alike).
- **The waterfall:** still water is the pool minus an 84 × 30 foam ellipse at the falls' foot;
  the stream is moving water; perches are the six ledge edges and the four wet rocks (no trail
  stones); three heron stands on the pool's back edge right of the falls; perspective is
  `perspectiveScale(y)` on the ground and, inside the cliff polygon, a piecewise line from the
  crown (0.6 under the skyline) through the three shelf heights to the cliff foot (within 0.02 of
  every slot).
- **`wild()` is gone.** `fauna:arrived { id, sceneryId }`; the system and the quiet line check
  `faunaSeenIn(state, sceneryId, id)`; the quiet line records in the garden the creature was seen
  in and reads its line from that garden's table (`faunaArrivalLine(sceneryId, id)`). Sightings
  match rows to creatures by kind and, where a row names one, variant.
- **Night-only visitors:** `VisitTuning.nocturnal` refuses visits by day (`'day'`) and sends those
  present away at daybreak, as `diurnal` does at nightfall.
- `containPoint` falls back to the edge's inward normal when pulling toward the centroid would
  land outside (a notch facing away from the centroid, like the foam bite). The Japanese pond never
  takes that branch.

## Consequences
- The Japanese garden is unchanged: a regression test pins the sim's positions and states for
  four seeds and modes to hashes taken before the registry, and `fauna.spec.ts` passes unchanged in
  outcome (`roster()` changed shape: `residents`, `ids`, `kinds`, `variants`).
- The waterfall has wildlife now: striders on the pool's margins, a maple leaf, and the shared
  visitors as their thresholds unlock. Its own eight creatures appear as their modules land.
- Audio still keys its bird layer on bare unlock ids (`garden-audio.ts`, `params.ts`): the waterfall's
  ids (`wagtail`, `iwatsubame`…) do not raise it. That belongs to the sound task (S15).
- The Japanese table gained a silent `leaf` row, last; `FAUNA_UNLOCKS`, `FAUNA_IDS`, `faunaUnlock`,
  `kindOf` and the kind unions are gone (`JAPANESE_FAUNA`, `faunaRow`, the registry instead).
