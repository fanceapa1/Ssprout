# Core logic

`src/core/` — pure, framework-free game logic. No DOM, no canvas, no `Date.now()`/`Math.random()`:
time comes from a `Clock`, randomness from a seeded `Rng`, and both enter the state only through
action payloads. Everything here is unit-tested (`src/core/*.test.ts`; fixtures in `testing.ts`).

**Every session is one plant** (ADR 0003, ADR 0036): task name, total time, study plan, species and
slot are chosen at start; the seedling grows live in its slot; breaks are optional watering moments.

| File | What |
|---|---|
| `state.ts` | `GardenState` types, `createDefaultState`, `Action` union, `createReducer(world)`, `createStore` |
| `plans.ts` | `PlanBlock`, `StudyPlan`, `recommendPlans`, `findPlan`, `planProblem`, `focusMinutes`, `hasBreaks` |
| `session.ts` | `sessionTimeline`, `sessionPhase`, plan position/growth maths, pauses, goal clamping, task names, weather, `formatClock` |
| `rewards.ts` | `tierForMinutes`, `TIER_MIN_MINUTES`, `selectableSpecies` |
| `placement.ts` | `isCompatible`, `compatibleSlots`, `freeSlotIds` |
| `fauna-unlocks.ts` | unlock table, `unlockedFauna`, `newlyArrived` |
| `tips.ts` | tip registry, `activeTips`, `allTips`, `tipsRetiredBy` |
| `persistence.ts` | localStorage load/save, migrations, validation, export/import |
| `controller.ts` | `createSessionController` — **the API the UI and widget use** |
| `clock.ts` | `Clock`, `realClock`, `createSpeedClock` (`SpeedClock`, ADR 0035), `createManualClock` |
| `rng.ts` | `Rng`, `createRng(seed)`, `hashString`, `toSeed` |
| `events.ts` | `EventMap`, `EVENT_NAMES`, `createEventBus` |
| `testing.ts` | test fixtures: `MIN`, `T0`, `plan(shape)`, `makeSession`, `makePlant`, `makePressed` |

## State machine

```
                 start({ task, total, plan, species, slot })
   idle ───────────────────────────────────────────────▶ focus ◀──────────┐
    ▲  ▲                                                  │  ▲             │ break over (tick)
    │  │                                   block ends     │  │ skipBreak   │  → session:focus
    │  │                                   (tick)         ▼  │             │
    │  │                     session:break ◀────────── break ─────────────┘
    │  │                                          water() (optional, once per break)
    │  │  cancel (seedling withers, displaced plant stays; stats.cancelled++)
    │  └──────────────── focus / break / paused
    │
    │  plan ends (tick, or on boot after the app was closed)
    └── complete: finished plant (task name), displaced plant pressed; plant:swapped → plant:placed → session:complete

   focus ⇄ paused ⇄ break   (pause / resume; paused time never counts; ≥ 30 min → longPause)
```
`sessionPhase(state, now)`: no session → `idle`; `pausedAt` set → `paused`; otherwise the kind of
the current block (`focus` / `break`).

## Time model (`session.ts`)
- **Session time** `elapsedMs = max(0, (pausedAt ?? now) − startedAt − pausedTotalMs)`.
- **Plan position** `planPositionMs = min(goalMs, elapsed + skippedMs)` — skipping a break moves it
  forward. Blocks, growth, progress and completion are measured on this axis.
- `isComplete ⇔ elapsed + skippedMs ≥ goalMs`; never while paused short of the end.
- `sessionTimeline(s, now)` → `{ elapsedMs (plan position), blockIndex, block, blockElapsedMs,
  blockRemainingMs, totalRemainingMs, focusDoneMs, focusTotalMs, growth, progress, watered, complete }`.
  A block boundary belongs to the next block; at the end it reports the last block, full.
- **Growth** = `focusDoneMs ÷ focusTotalMs` (0 = seed … 1 = full bloom). Breaks don't grow it.
- `completionTime(s) = startedAt + pausedTotalMs + goalMs − skippedMs` (null while paused short of it).
- `pausedFor`, `isLongPause` (≥ 30 min, `LONG_PAUSE_MS`), `blockStartsMs`/`blockStartMs`.
- `clampGoalMinutes`: 5-minute grid, 10–180 (NaN → 25). `GOAL_PRESETS = [25, 50, 90]`.
- `normalizeTaskName`: collapse whitespace, trim, ≤ 40 characters, empty → `"Study session"`.
- `pickWeather(rng)`: sun 60 %, rain 25 %, mist 15 %. `formatClock(ms)`: `24:13`, `1:05:09`.

## Study plans (`plans.ts`)
`recommendPlans(total)` (off-grid totals are snapped first):

| Plan id | Name | Offered for | Shape | Examples |
|---|---|---|---|---|
| `unbroken` | Unbroken | always, first | one focus block | 25 → 25 |
| `pomodoro` | Pomodoro | 30–180 | ~25 focus / 5 break, ≥ 2 focus blocks | 30 → 15·(5)·10 · 60 → 30·(5)·25 · 90 → 30·(5)·25·(5)·25 |
| `long-focus` | Long focus | 60–180 | ~50 focus / 10 break | 60 → 25·(10)·25 · 90 → 40·(10)·40 |
| `deep-work` | Deep work | 75–115 | long block · 15 break · shorter block (2 : 1) | 90 → 50·(15)·25 |
| `two-deep` | Two deep blocks | 120–180 | two halves around 20 | 150 → 65·(20)·65 |

Focus minutes are split on the 5-minute grid, larger blocks first. Every recommended plan sums
exactly to the total, starts and ends with focus, has no back-to-back breaks; a plan whose blocks
are identical to an earlier one's is dropped. < 30 min → only Unbroken; otherwise 2–4 plans.
`planProblem(plan, total)` explains why a plan is unusable; it checks only non-empty id/name, ≥ 1
block, known kinds with positive finite minutes, the sum and ending with focus.

## Tiers and species (`rewards.ts`)
- `tierForMinutes(total)`: 10–24 → 1, 25–49 → 2, 50–89 → 3, 90+ → 4.
- `selectableSpecies(species, total)` → `{ species, locked, requiredMinutes, earned }[]`: every species;
  `locked` = tier above the earned one (shown with "needs N min+"); `earned` = exactly the earned tier
  (highlighted). Order: earned tier, then lower tiers (highest first), then locked (lowest first);
  by name within a tier.

## Placement (`placement.ts`)
Compatible ⇔ `species.habitats` includes `slot.habitat` **and** `sizeClass ≤ slot.maxSize`
(small < medium < large < tree). `compatibleSlots(species, slots, plants)` → `{ slot, occupiedBy? }[]`
in slot order; an occupied slot means a swap (the occupant steps aside during the session, is
pressed on completion, returns on cancel).

## Reducer rules (`createReducer(world)`)

**Invalid actions are no-ops: the reducer returns the very same state object** (so the store
notifies nobody and nothing is saved). The reducer never mutates its input.

| Action | Valid when | Effect |
|---|---|---|
| `session/start {id, taskName, goalMinutes, plan, speciesId, slotId, seed, now, weather}` | no session; non-empty ids; finite now/seed; weather ∈ sun/rain/mist; `goalMinutes` on the grid (10–180, step 5); `planProblem(plan, goalMinutes) === null`; `id` not used by a finished plant; with a world: species exists with `tier ≤ tierForMinutes(goalMinutes)`, slot exists and is compatible | session `{ taskName: normalized, goalMs, plan (copied), speciesId, slotId, seed, displacedPlantId: occupant of slotId ?? null, startedAt: now, pausedAt: null, pausedTotalMs: 0, skippedMs: 0, weather, waterings: [] }`; `settings.lastGoalMinutes = goalMinutes` |
| `session/pause {now}` | running session | `pausedAt = max(now, startedAt)` (idempotent) |
| `session/resume {now}` | paused session | `pausedTotalMs += max(0, now − pausedAt)`; `pausedAt = null` (idempotent) |
| `session/water {blockIndex, now}` | not complete; current block is a break, `blockIndex` is that block, not yet watered (allowed while paused) | `waterings.push(blockIndex)` — no effect on growth or outcome |
| `session/skipBreak {now}` | not complete; current block is a break with time left | `skippedMs += blockRemainingMs` (ends that much sooner; total and tier unchanged) |
| `session/cancel {now}` | any session | session cleared, `stats.cancelled++`; the displaced plant was never removed, so it stays |
| `session/complete {now}` | session with `isComplete(now)` | finished plant `{ id: session.id, speciesId, slotId, seed, plantedAt: startedAt, sessionMinutes: total, taskName, completedAt: now }`; the displaced plant (and anything else in the slot) → `pressed` (`{ speciesId, seed, plantedAt, removedAt: now, taskName }`); `stats.totalMinutes += focus minutes`; `stats.completed++` |
| `tip/retire {id}` | non-empty id not yet retired | `tips[id] = 'seen'` |
| `settings/update {patch}` | at least one valid field changes | merges `muted` (boolean), `lastGoalMinutes` (clamped), `notifications` (unasked/granted/denied) |
| `fauna/seen {id}` | non-empty id not yet seen | appended to `faunaSeen` |
| `state/replace {state}` | `state.version === 1` and a different object | replaces the whole state (callers validate first) |
| `state/reset {now}` | finite now | `createDefaultState(now)` |

`reducer` (no world) accepts any species/slot ids; the app uses `createReducer({ getSpecies, getSlot })`.

## Fauna (`fauna-unlocks.ts`)
`FAUNA_UNLOCKS` (in order, each with an `arrival` line): `striders` always (silent) · `dragonfly` 2
plants · `koi-1` 3 · `butterflies` 4 pollinator flowers · `bees` 6 pollinator flowers · `koi-2` 7 ·
`small-birds` 8 · `frog` a water plant + 10 plants · `swallows` 14 · `heron` 20 · `koi-3` 25.
Counts use finished plants only (the growing seedling does not count). "Pollinator flower" =
species with `pollinators: true`; "water plant" = species whose habitats include `water`.
`unlockedFauna(state, lookup)`; `newlyArrived(state, lookup)` = unlocked − `faunaSeen` (kept and
tested, but the UI no longer uses it: arrivals come from the fauna system on first sight, ADR 0120).

## Tips (`tips.ts`)

| Tip | Copy (short) | Shown when (and not retired) | Retired by |
|---|---|---|---|
| `task` | Name what you are studying… | idle (start sheet) | naming a task (UI) or `session/start` (auto) |
| `duration` | Slide to choose how long you'll study… | idle | committing a time (UI) or `session/start` (auto) |
| `plan` | Breaks are watering moments — your plant will be glad of them. | idle | picking a plan (UI) or a start with a plan that has breaks (auto) |
| `placement` | Choose one of the softly glowing spots… | idle | `session/start` (auto) |
| `swap` | A glowing spot already in bloom can be replanted… | idle and `ctx.swapAvailable` (default: garden has plants) | a start into an occupied slot (auto) |
| `notifications` | …we'll ask once if we may chime softly… | idle and `notifications === 'unasked'` | `settings/update` answering it (auto) |
| `widget` | Open the little floating window… | a session exists and `ctx.widgetSupported` | UI: `controller.retireTip('widget')` |
| `water` | Tap the watering can… | a break is on (`ctx.now` required) | `session/water` (auto) |
| `pressed` | Plants you replace are pressed… | the herbarium has something | UI: `controller.retireTip('pressed')` |
| `sound` | Tap the speaker for quiet garden sounds… | always | `settings/update` toggling `muted` (auto) |

`activeTips(state, { now?, swapAvailable?, widgetSupported? })` in registry order (the UI shows
one at a time, by priority, next to its `anchor`; ADR 0124), `allTips(state)` for the ⓘ list, `tipsRetiredBy(action, prev, next)`.

## Controller API (`controller.ts`)

```ts
const controller = createSessionController({
  store, clock, bus,
  species: allSpecies(),     // SpeciesDef[]
  slots: scene.slots,        // for placementOptions()
  ticker,                    // optional; default setInterval(1 s); the widget may supply a Worker ticker
  seed,                      // optional; default clock.now()
});
```
| Method | Returns | Emits |
|---|---|---|
| `start({ taskName, goalMinutes, planId?, speciesId, slotId })` (total clamped; plan default `unbroken`, must be one of `recommendPlans(total)`) | `boolean` | `session:start {session}` |
| `pause()` / `resume()` | `boolean` | `session:pause` / `session:resume {sessionId, at}` |
| `water()` | `boolean` | `session:water {blockIndex}` |
| `skipBreak()` | `boolean` | then `session:focus {blockIndex}` (or completion) |
| `cancel()` | `boolean` | `session:cancel {sessionId, at}` |
| `check()` — announce block changes, complete when due (every tick; once at creation) | `boolean` (completed) | `session:break` / `session:focus {blockIndex}`; on completion `plant:swapped {plant, removed}` (per pressed plant) → `plant:placed {plant}` → `session:complete {sessionId, plant}` |
| `recommendPlans(min)` | `StudyPlan[]` | — |
| `selectableSpecies(min)` | `{ species, locked, requiredMinutes, earned }[]` | — |
| `placementOptions(speciesId)` | `{ slot, occupiedBy? }[]` | — |
| `retireTip(id)` | `boolean` | `tip:retired {id}` (auto-retirements emit it too) |
| `updateSettings(patch)` | `boolean` | `settings:changed {settings}` |
| `announceFauna(id)` | `boolean` (true the first time) | `fauna:arrived {id}` |
| `status()` | `{ phase: 'idle'\|'focus'\|'break'\|'paused', session, timeline: SessionTimeline \| null, pausedForMs, longPause }` | — |
| `onTick(fn)` | unsubscribe | `fn(status)` after every tick |
| `setTicker(t)`, `setSeed(s)`, `dispose()` | — | — |

- **Ticking** only while a session exists (focus, break or paused — so the UI can show the long-pause
  prompt); `Ticker = { start(tick): stop }`.
- **Block events**: each block change is announced once, from the tick, for the *current* block only
  (blocks passed while the tab was throttled or closed are not replayed). Block 0 is covered by
  `session:start`; after a reload the current block is announced once if it is not block 0. Use
  `session:break` for "Time for a break — your <plant> is thirsty." and `session:focus` for the
  next-block notification.
- **Completion time**: every completion stamps `completedAt = min(now, completionTime)`, the real
  moment; this matters for closed-app completion, where `check()` at creation completes a session
  whose plan has ended.
- **Determinism**: session ids (`session-…`, also the finished plant's id), plant seeds and weather come
  from the controller's rng.
- Long pause: `status().longPause`; "End session" = `cancel()`, "Resume" = `resume()`.
- Notification permission is the UI's job (ask on first `start`, then `updateSettings({ notifications })`).

## Persistence (`persistence.ts`)

- Key **`studysprout:v1`** (stable forever); the document's `version` drives migrations. Schema stays
  `version: 1` with the plan-based shape (ADR 0003: no public stored state existed yet).
- `loadState(storage, now, { isKnownSpecies })` → `{ state, status, warnings, error?, backupKey? }`,
  status `fresh | loaded | migrated | recovered | unavailable`. Never throws.
  - `migrated`: upgraded via `MIGRATIONS[n]: (vN) => vN+1` (none yet; tested with a fake v0) and re-saved.
  - `recovered`: invalid JSON, invalid shape or a newer/unknown version → raw text copied to
    `studysprout:corrupt:<now>`, and only if that backup write succeeded is the main key reset to a
    default garden (and `backupKey` set); otherwise the original stays in place.
  - `unavailable`: no storage / reading throws → default state, nothing persists.
- Saving: `createSaver(storage, { delayMs: 300 })` (debounced, latest wins), `flush()`, `cancel()`.
  `main.ts` schedules on every store change and flushes on `pagehide` and when the tab is hidden.
- Validation (`validateState`, ADR 0034): absent keys → defaults (plant `taskName` → "Study session",
  `completedAt` → `plantedAt`; session `skippedMs` 0, `waterings` [], `displacedPlantId` null); present keys
  must have the right type (`invalid-state` with a `path` like `session.plan.blocks[2].kind`); unknown
  keys (e.g. an old `pendingReward`) dropped. Invariants: unique plant ids, one plant per slot, session
  `goalMs` in whole minutes with a valid plan summing to it, waterings point at break blocks, the
  session id is not already a finished plant's id. Unknown species ids (plants, pressed, the growing
  session) are **kept** and listed in `warnings.unknownSpecies`.
- Export: `exportState(state, now)` and `exportFileName(now)` → `study-sprout-garden-YYYY-MM-DD.json`.
  Import: `importState(json, opts)` → `{ ok: true, state, warnings } | { ok: false, error: { code,
  message, path? } }` (`invalid-json | not-a-garden | unsupported-version | migration-failed |
  invalid-state`); accepts an export envelope or a bare state. Apply with `state/replace`.

Example export:
```json
{
  "format": "study-sprout-garden",
  "formatVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-10-22T09:05:00.000Z",
  "summary": { "plants": 1, "pressed": 0, "totalMinutes": 55, "completed": 1 },
  "state": {
    "version": 1,
    "createdAt": 1792600000000,
    "plants": [
      { "id": "session-mgz1k2-0a1b2", "speciesId": "japanese-iris", "slotId": "shore-1", "seed": 2849120533,
        "plantedAt": 1792600000000, "sessionMinutes": 60, "taskName": "Biology ch. 4", "completedAt": 1792603300000 }
    ],
    "pressed": [],
    "session": {
      "id": "session-mgz9q1-1c2d3", "taskName": "French verbs", "goalMs": 5400000,
      "plan": { "id": "pomodoro", "name": "Pomodoro", "blocks": [
        { "kind": "focus", "minutes": 30 }, { "kind": "break", "minutes": 5 }, { "kind": "focus", "minutes": 25 },
        { "kind": "break", "minutes": 5 }, { "kind": "focus", "minutes": 25 } ] },
      "speciesId": "anemone", "slotId": "meadow-3", "seed": 99120533, "displacedPlantId": null,
      "startedAt": 1792610000000, "pausedAt": null, "pausedTotalMs": 0, "skippedMs": 120000,
      "weather": "rain", "waterings": [1]
    },
    "stats": { "totalMinutes": 55, "completed": 1, "cancelled": 0 },
    "faunaSeen": ["striders"],
    "tips": { "task": "seen", "duration": "seen", "plan": "seen", "placement": "seen" },
    "settings": { "muted": true, "lastGoalMinutes": 90, "notifications": "granted" }
  }
}
```
The stored `studysprout:v1` value is the bare `state` object.

## Debug API (`?dev`, `src/dev/core-debug.ts`)

| Method | Does |
|---|---|
| `reset()` | fresh default garden (saved immediately) |
| `seed(n)` | seeds the controller rng (ids, weather, plant seeds) and `addPlants` |
| `start(min?, { taskName?, planId?, speciesId?, slotId? })` | start with defaults: `min` = `settings.lastGoalMinutes`, task "Test task", plan `unbroken`, the first selectable (unlocked) species that fits a slot, its first free compatible slot (else first compatible); returns the session or null |
| `pause()`, `resume()`, `water()`, `skipBreak()`, `cancel()` | controller calls |
| `toBreak()` | jumps the dev clock to the start of the next break; returns its block index or −1 |
| `skipToBlock(i)` | jumps the dev clock forward to block `i`'s start (resuming if paused) |
| `completeSession()` | resumes if paused, jumps the dev clock to the end, completes; returns the finished plant |
| `plans(min)`, `selectableSpecies(min)`, `placementOptions(speciesId?)` | start-sheet data (compact) |
| `addPlants(n, tier?)` | instantly adds up to `n` finished plants with sample task names in free compatible slots (full-garden screenshots); returns how many |
| `setState(partial)` | shallow merge, validated (throws on invalid), applied with `state/replace` |
| `status()`, `flush()`, `exportState()`, `importState(json)` | as named |

The jumps use `SpeedClock.advance` (ADR 0035), so everything that reads the clock stays consistent.
E2E example (`tests/e2e/core-loop.spec.ts`):
```ts
await page.evaluate(() => sprout.start(60, { taskName: 'Biology ch. 4', planId: 'pomodoro' }));
await page.evaluate(() => { sprout.toBreak(); sprout.water(); sprout.skipBreak(); });
const plant = await page.evaluate(() => sprout.completeSession());
await page.reload(); // saved on pagehide
```

## Tests
- Unit: 13 files, `src/core/*.test.ts` (clock, controller, events, fauna-unlocks, persistence,
  placement, plans, reducer, rewards, rng, session, state, tips).
- E2E: `tests/e2e/core-loop.spec.ts` (plant → break → water → skip → complete across reloads; cancel;
  corrupt save backed up; `addPlants`/`setState`) and `tests/e2e/session-rules.spec.ts` (timer and
  plan line, unwatered breaks, "Still with us?", closed-app completion, phone ink labels).
