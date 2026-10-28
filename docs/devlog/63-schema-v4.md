# 63 — S1: schema v4, a garden per scenery

Phase 10 lets each scenery grow its own garden. This task changes the stored garden and the core
API to support that, with nothing visible yet: the Japanese garden is still the only one
registered and on view. Runtime switching is S3; the Gardens UI is S5.

## What
- **`src/core/sceneries.ts`** (new): `SCENERY_IDS`, `SceneryId`, `DEFAULT_SCENERY`, `isSceneryId`
  moved here from `src/scenery/ids.ts`, which now re-exports them. Also `slotLookup(of)` (slots by
  scenery and id, indexed once per scenery) and `slotsOfAny` (a plain slot list = the default
  scenery's). The audio module's own `SceneryId` (`pond`/`coast`) is now `SoundSceneryId`; its
  stored keys are unchanged.
- **State v4** (`state.ts`):
  - `sceneryId` on plants, pressed flowers, sessions (active and waiting) and log entries;
    `GardenState.scenery` is the garden on view; `STATE_VERSION = 4`.
  - `scenery/view { id }` rejects unknown ids and the current garden, and leaves sessions alone.
  - `session/start` takes an optional `sceneryId` (default `state.scenery`).
  - Held slots, the displaced plant and the plants pressed on completion stay within the
    session's scenery.
  - `ReducerWorld.getSlot(sceneryId, slotId)`.
  - Selectors `plantsIn`, `sessionsIn`, `heldSlotIds(state, sceneryId)`.
- **Wildlife** (`fauna-unlocks.ts`):
  - `gardenCounts`/`unlockedFauna`/`newlyArrived` take a scenery (default: the one on view) and
    count only its plants.
  - `faunaSeenKey(scenery, id)` keeps Japanese ids bare and gives others `<scenery>:<id>`.
    `faunaSeenIn` reads it.
- **Persistence**:
  - `migrateV3toV4` is pure and never mutates its input. It tags every entry
    `'japanese-garden'`, sets `scenery`, adds no missing keys and leaves `faunaSeen` alone.
  - Validation: scenery ids must be known (absent → the Japanese garden); one plant and one
    seedling per `scenery/slot`.
  - `readSoundscape` reads a missing sound layer as 0, so the future `falls` layer needs no
    migration. `settings/update` reads mixes the same way.
- **Controller**:
  - `start({ sceneryId })`, `placementOptions(speciesId, sceneryId?)`, `showScenery(id)`,
    `announceFauna(id, sceneryId?)`, `status().sessions[*].sceneryId`.
  - `slots` may be `sceneryId => Slot[]`.
- **Dev API**:
  - `sprout.start(min, { sceneryId })`, `addPlants(n, tier?, sceneryId?)`,
    `placementOptions(speciesId?, sceneryId?)`, `sessions()[*].sceneryId`.
  - `setState` accepts plants without `sceneryId`.
  - `schedule.fillHistory(days?, seed?, sceneryId?)` takes that garden's slot ids (`buildHistory`
    throws for a scenery with no slots instead of assuming `meadow-1`).
- **`src/main.ts`** (7 lines, over the 3-line budget):
  - two imports (`slotLookup`; `getScenery`, `hasScenery`);
  - `slots = slotLookup(id => hasScenery(id) ? getScenery(id).geometry.slots : [])` replaces
    `slotById`;
  - the reducer, the controller, `installCoreDebug` and `installScheduleDebug` take it.
  - A scenery that is not registered (the waterfall, until S4 merges) has no slots. It does not
    get the default garden's slots, which is what `getScenery` falls back to.
- **Outside the listed paths, the minimum to compile:**
  - `src/scenery/ids.ts` re-exports the ids.
  - `src/audio/{params,garden-audio}.ts` and `src/ui/types.ts` rename the audio type.
  - `src/core/session-log.ts` copies `sceneryId` into back-filled log entries.
  - `src/dev/schedule-debug.ts`: `fillHistory` takes a scenery and slots.
  - `src/fauna/stage.ts` and test fixtures in `ambience`, `audio`, `fauna`, `plants` and `ui` add
    `sceneryId: 'japanese-garden'`; `world` mocks take `(sceneryId, slotId)`.
  - `tests/e2e/smoke.spec.ts` and `sound-mixer.spec.ts` expect version 4. No other e2e change.

## Why / decisions
ADR 0240:
- `state.scenery` is stored, which supersedes ADR 0213's runtime-only line.
- `faunaSeen` stays a flat list with prefixed keys, not a per-scenery map: no migration, and
  today's readers stay right.
- Absent ids read as the Japanese garden.
- Slots are injected from the registry.
- `session/switch` does not change the view in the reducer. Following the active session's
  garden is S3/S5's wiring through `controller.showScenery(session.sceneryId)`.

## Tests
- Unit:
  - `core/migration-v4` (new `fixtures/garden-v3-sound.json`; v1, v2 and v3 chains; JSON,
    export and storage round trips).
  - `core/sceneries` (`scenery/view`, starts, held slots, displacement, completion, selectors,
    wildlife).
  - `core/controller-sceneries`.
  - `core/persistence` › per-scenery gardens.
  - `core/soundscape` › `readSoundscape`.
  - `dev/fill-garden`, `dev/fill-history`.
  - `migration-v2`/`-v3` updated for the chain.
- E2E: the affected specs pass on their own (smoke, sound-mixer, core-loop, fauna,
  parallel-sessions). Final full run: see Status.
- TESTING.md: rows S1.1–S1.6 and 9.4.

## Status
Done. `npm run typecheck && npm test && npm run e2e` (2026-10-28, under `nice`, load below 8 at the start): typecheck clean; 137 unit files, 1618 tests; e2e 269 passed in 24.8 min, 0 flaky.

## Left open
- **S3:**
  - Filter `state.plants` to the garden on view (`plantsIn`) in the plants, fauna, motes and
    audio systems; they still read every plant, which is right while only one garden exists.
  - Wire "switching follows the session" (`showScenery(session.sceneryId)` on switch and start).
  - Pass the scenery to the fauna system's `unlockedFauna` call (it already defaults to the
    viewed garden).
- **S4:** registering the waterfall makes its slots reach the reducer, controller and dev API
  with no further change.
- **S11:** per-scenery unlock tables. Readers of `faunaSeen` outside core (`ui/quiet-line.ts`,
  `fauna/system.ts`, `audio/garden-audio.ts`) compare bare ids, which is right for the Japanese
  garden only; they should use `faunaSeenIn` once another garden has wildlife.
- **`feat/accounts`** must rebase onto v4: the document is still plain JSON.
- `main.ts` took 7 lines, not 3. The ROADMAP's ≤ 3 lines was not enough for the registry lookup
  and the two debug installers.
