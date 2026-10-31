# 72 — S11: wildlife per scenery

**Status: done**, with the open points below. ADR 0248.

## What
- **A creature is one file** (b1). Every existing kind (`bee`, `bird`, `butterfly`, `dragonfly`,
  `frog`, `heron`, `koi`, `leaf`, `strider`, `swallow`) default-exports a `CreatureDef` from its own
  file; `creatures/registry.ts` globs `./*.ts` and the kind is the file name. `flight.ts` moved to
  `creatures/lib/` beside the contract (`lib/def.ts`). `creatures/index.ts` (the spawn switch) and
  `creatures/sheets.ts` are gone; the sim's upkeep, the scheduler's tuning lookup, the dev API and
  the studio's shows read the registry. Kinds are plain strings.
- **Unlock tables per scenery** (b2). `core/fauna-unlocks.ts` is generic over a `FaunaTable`; the
  Japanese table moved verbatim to `src/scenery/japanese-garden/fauna.ts` with a `kind` per row,
  `boost: 'bird'` on koi-3, and a silent `leaf` row last. The waterfall's whole table is in
  `src/scenery/waterfall/fauna.ts` (below). `rosterFor(rows)` skips rows whose module does not
  exist yet. `wild()` is gone; `fauna:arrived { id, sceneryId }`; the system and the quiet line use
  `faunaSeenIn`, the quiet line records in the garden the creature was seen in and reads that
  garden's line. Night-only visitors (`visit.nocturnal`).
- **Waterfall targets** (b3). `Scenery.fauna` (`src/fauna/habitat.ts`): the pool minus an 84 × 30
  foam ellipse is the still water (`carveEllipse`), the stream is moving water, the water layers
  clip to both (wound alike); perches are the six ledge edges and four wet rocks; three heron stands
  right of the falls; `waterfallPerspective(x, y)` (crown → shelves → foot inside the cliff, the
  ground's outside). Striders take a `margin` variant there. `containPoint` falls back to the edge
  normal in a notch that faces away from the centroid (the foam bite).
- **Studio and e2e** (b4). A `falls` stage (`fauna-falls/all`); `Show.stage` lets a creature live on
  it. Dev: `list()` gains `variant` and `edge`, `water()`, and `roster()` is `{ scenery, ids,
  residents, visitors, kinds, variants }`. `tests/e2e/fauna-waterfall.spec.ts` spawns the roster
  `roster().kinds` names.

The waterfall's table (rule → row): always: striders (margin), dipper, leaf (maple), none announced ·
2 plants damselfly · 3 iwana-1 · 4 pollinator flowers swallowtail butterflies · 5 red dragonfly
(aka) · 6 pollinator flowers bees · 6 plants wagtail · 7 iwana-2 (yamame) · 8 sawagani · 10 kajika (no
water plant) · 14 iwatsubame · 16 fireflies (night only) · 18 heron · 20 yamasemi (rare).

## Why
- The art tasks (S12 iwana, S13 dipper, …) should only add a file: B1 counted ten shared files per
  creature before. The waterfall's rows are written now so those tasks need not touch tables.
- `wild()` hid four `faunaSeen` and payload bugs that would have fired the moment wildlife came to
  the waterfall; tests cover each now (a dragonfly seen in the garden is still new at the waterfall,
  once, and not after a reload).
- The fitted perspective line was 7–15 % off at the waterfall's ledges; the cliff-aware function is
  within 0.02 of every slot.
- Keeping the Japanese garden identical: the leaf row goes last so the visitors are scheduled in
  the same order and the seeds draw the same numbers; `rank` keeps the residents' upkeep order
  (koi, striders, frog). `regression.test.ts` pins four runs' positions and states to hashes taken
  before any change.

## Checked
- `npm run typecheck`, `npx vitest run` (149 files, 1717 tests).
- E2E, one worker: `fauna.spec.ts` (6, unchanged in outcome), `fauna-waterfall.spec.ts` (4),
  `sceneries.spec.ts` (7), `gardens.spec.ts` (5), `studio.spec.ts` (12, the new section renders),
  `ui-menu › a creature arrival gets one quiet line and is recorded`.
- Looked at: `artifacts/shots/entry-fauna-falls_all-1440x900.png` (the falls stage: cliff, fall left
  as paper, foam reserved, pool, stream, wet rocks, a ledge; striders near the pool's edge) and
  `artifacts/shots/falls-fauna-1440x900.png` (the waterfall at noon: a wagtail on the left wet rock,
  another on the high right ledge at the ledge's scale, the heron at the pool's back edge right of
  the falls).

## Shared files
- `src/main.ts`: untouched. `src/scenery/types.ts` (+1 field, `fauna`) and both scenery `index.ts`
  files (+1 import, +1 field each). `src/core/controller.ts`: one line (the event's `sceneryId`).
  `src/core/events.ts`: the payload type.

## Left open
- **Audio** keys its bird layer on bare Japanese ids (`src/audio/garden-audio.ts` on
  `fauna:arrived`, `src/audio/params.ts` `small-birds`/`swallows`): the waterfall's `wagtail` and
  `iwatsubame` do not raise it, and the event's `sceneryId` is ignored. For S15.
- No nocturnal creature exists yet, so night-only visits are covered by the scheduler's unit test
  only; the firefly task should add a sim run at night.
- The heron's stands sit on the pool's back edge with the cliff right behind it; it reads as at the
  cliff foot. If the S-tasks want it in the shallows by the outflow instead, change `STANDS`.
- Striders keep to a 70-unit band (pond plane) along every still edge, including the foam's rim.
- The falls studio stage is a plain backdrop (flat cliff wash, lifted fall and foam) meant for
  looking at creatures, not a painting.
- `roster().kinds` on a fresh waterfall lists only the shared kinds; the e2e covers the new ones as
  their files land.
