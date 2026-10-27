# ADR 0240: Schema v4, a garden per scenery

- Status: accepted
- Date: 2026-10-28
- Amends: ADR 0033 (persistence format), ADR 0154 (schema v2), ADR 0213 (supersedes its line that
  the viewed scenery is runtime context only), ADR 0120 (announced wildlife)

## Context
Phase 10 adds a second place to grow a garden, the waterfall (ADR 0241). The owner decided:
- **Shared timeline.** Sessions, the calendar, schedules, history and settings are shared. Only
  plants and their spots belong to a garden. Planted flowers are not shared.
- **Running sessions** keep growing their seedling in their own garden while another is on view.
- **Switching follows the session**: switching the active session also shows its garden.
- **Wildlife per garden**: creatures unlock from that garden's own plants.
- **Open to everyone**: the waterfall needs no unlock.

Schema v3 had one garden. Slot ids were unique across it, `heldSlotIds`, displacement and
completion matched on `slotId` alone, and the audio module had its own `SceneryId` (`pond`,
`coast`). ADR 0213 kept the viewed scenery as runtime context only, not stored.

## Decision
- **Ids in core.** `src/core/sceneries.ts` holds `SCENERY_IDS`, `SceneryId`, `DEFAULT_SCENERY`
  and `isSceneryId`. `src/scenery/ids.ts` re-exports them, and core never imports `src/scenery`.
  The audio type becomes `SoundSceneryId`. Its stored keys (`pond`, `coast`) are unchanged.
- **Shape (v4).** `sceneryId: SceneryId` on `PlantInstance`, `PressedFlower`, `ActiveSession`
  (active and waiting) and `SessionLogEntry`. `GardenState` gets `version: 4` and
  `scenery: SceneryId`, the garden on view, which is now stored so a reload comes back to it.
  Schedules, stats, tips and settings carry no scenery.
- **A slot is `(sceneryId, slotId)`.** `ReducerWorld.getSlot(sceneryId, slotId)`. Held slots,
  the displaced plant and the plants pressed on completion are matched within the session's
  scenery. Validation keeps one plant and one seedling per `sceneryId/slotId`. Slots are injected:
  `main.ts` builds `slotLookup(id => hasScenery(id) ? getScenery(id).geometry.slots : [])` from
  the registry. A scenery that is not registered has no slots, rather than the default scenery's
  slots that `getScenery` falls back to.
- **Actions.**
  - `scenery/view { id }` rejects unknown ids and the current one, and leaves sessions alone.
  - `session/start` carries an optional `sceneryId`, defaulting to `state.scenery`.
  - The selectors are `plantsIn`, `sessionsIn` and `heldSlotIds(state, sceneryId)`.
  - `session/switch` does not change `scenery`. Following the active session's garden is runtime
    wiring for S3/S5, which call `controller.showScenery(session.sceneryId)`. The state already
    carries what that needs.
- **Wildlife namespacing: a flat list with prefixed keys**, not a per-scenery map.
  - `faunaSeen` keeps Japanese-garden ids bare and stores others as `<scenery>:<id>`
    (`faunaSeenKey`). Every v3 entry stays valid with no migration step, and the list stays a
    plain string array.
  - Today's readers (`faunaSeen.includes(id)` in the quiet line and the fauna system) stay
    correct for the Japanese garden.
  - A map would have needed a migration, a validation rewrite and every reader changed at once.
  - `unlockedFauna(state, lookup, sceneryId = state.scenery)` counts only that garden's plants.
  - `controller.announceFauna(id, sceneryId?)` stores the key and emits the bare id.
- **Migration.** `migrateV3toV4` is pure and never mutates its input:
  - it sets `scenery: 'japanese-garden'`;
  - it tags every object in `plants`, `pressed`, `waiting`, `log` and `session` with
    `sceneryId: 'japanese-garden'`;
  - it adds no keys the document lacked and leaves malformed entries for validation.
  v1 and v2 chain through it. The key stays `studysprout:v1`.
- **Validation.** A `sceneryId` and `scenery` must be in `SCENERY_IDS`. When absent they read as
  the Japanese garden, following the ADR 0034 rule that absent keys take their default. This
  covers hand-written and dev `setState` documents.
- **Sound levels missing a layer read as 0** (`readSoundscape`). Persistence and
  `settings/update` read mixes this way, so a future `falls` layer (S15) needs no migration.
  Present levels must still be 0–100. `isSoundscape` stays strict.
- **Controller and dev API.**
  - The controller adds `start({ sceneryId })`, `placementOptions(speciesId, sceneryId?)`,
    `showScenery(id)` and `status().sessions[*].sceneryId`. Its `slots` may be a function of the
    scenery, and a plain list means the default scenery's slots.
  - In `?dev`, `start`, `addPlants`, `placementOptions` and `schedule.fillHistory` take a scenery,
    defaulting to the one on view.
  - `fillHistory` takes the scenery's slot ids instead of assuming `meadow-1`.
- **Plain JSON.** The document stays plain JSON, so the `feat/accounts` branch can store it
  server-side as it is. That branch must take v4.

## Consequences
- Nothing visible changes: the Japanese garden is the only one registered and on view, and every
  existing garden migrates into it.
- An older build cannot read a v4 garden (`unsupported-version`; recovered as corrupt data, ADR
  0033). Builds deploy together, so only a stale tab is affected.
- Systems that read `state.plants` (plants, fauna, ambience motes, audio) still read all of them.
  S3 filters them to the garden on view (`plantsIn`) when it can show another garden.
- One unlock table serves every garden until S11 gives each scenery its own.
- Tests: `migration-v4`, `sceneries`, `controller-sceneries`, the per-scenery block of
  `persistence`, `soundscape` (`readSoundscape`) and `dev/fill-*`. The v3 fixture is
  `garden-v3-sound.json`.
