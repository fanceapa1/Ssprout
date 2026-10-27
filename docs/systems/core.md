# Core logic

`src/core/` — pure, framework-free game logic. No DOM, no canvas, no `Date.now()`/`Math.random()`:
time comes from a `Clock`, randomness from a seeded `Rng`, and both enter the state only through
action payloads. Everything here is unit-tested (`src/core/*.test.ts`; fixtures in `testing.ts`).

**Every session is one plant** (ADR 0003, ADR 0036): task name, total time, study plan, species and
slot are chosen at start; the seedling grows live in its slot; breaks are optional watering moments.
**Up to three sessions are in progress** (ADRs 0150–0154): `state.session` is the active one,
`state.waiting` the others (paused); ended sessions go into `state.log`.

| File | What |
|---|---|
| `state.ts` | `GardenState` types, `createDefaultState`, `Action` union, `createReducer(world)`, `createStore`; selectors `inProgressSessions`, `canStartSession`, `lastLeftSession`, `heldSlotIds`; `logEntry` |
| `plans.ts` | `PlanBlock`, `StudyPlan`, `recommendPlans`, `findPlan`, `planProblem`, `focusMinutes`, `hasBreaks` |
| `session.ts` | `sessionTimeline`, `sessionPhase`, plan position/growth maths, pauses, goal clamping, task names, weather, `formatClock`, the focus-watering schedule (`focusWateringTimes`, `dueFocusWaterings`, `nextFocusWateringIn`) |
| `schedule.ts` | scheduled sessions: the rule + notes model, DST-safe recurrence (`expandSchedules`), due / missed / done (`occurrenceStatus`, `dueUntil`), `startPrefill`, validation — docs/systems/calendar.md (ADRs 0170–0173) |
| `schedule-reducer.ts` | `schedule/*` reducers; `planEdit` / `planRemove` ("only this one" / "this and following", ADR 0171) |
| `schedule-controller.ts` | `createScheduler` — the API for schedules, the due tick and `schedule:due` (ADR 0174) |
| `session-log.ts` | history queries over `state.log` (`entriesBetween`, `dayRange`/`weekRange`/`monthRange`, `entriesOnDay`/`InWeek`/`InMonth`, `dayKey`, `groupByDay`, `focusedMinutes`) and `backfillLog` |
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
| `fixtures/garden-v1-*.json`, `garden-v2-parallel.json` | real v1 documents (a running session with plants, a paused session) and a v2 one (active and waiting sessions, log, a schedule) for the migration tests |

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
`sessionPhase(state, now)`: no active session → `idle` (even if others wait); `pausedAt` set →
`paused`; otherwise the kind of the current block (`focus` / `break`).

## Parallel sessions (ADRs 0150–0152)
```
   A active ── start B ──▶ B active, A waits (paused at that moment)
   B active ── switchTo(A) ──▶ A active (resumed; its wait never counts), B waits
   A active, B waits ── A completes / is ended ──▶ nothing active, B waits (the dock offers Resume)
   nothing active ── switchTo(B) ──▶ B active, running
```
- At most `MAX_SESSIONS = 3` in progress; a fourth start is a no-op. Selectors: `inProgressSessions`
  (oldest start first), `canStartSession`, `lastLeftSession` (max `pausedAt` among the waiting),
  `heldSlotIds` (slots of sessions in progress: not plantable, not even as a swap).
- A waiting session is always paused (checked on load). Only the active one can be paused by the
  gardener, so "Still with us?" never concerns a waiting session.
- Pause, resume, water, skip break and the automatic watering act on the active session; cancel and
  complete take an optional `id`.

## Automatic focus watering (ADR 0153)
`focusWateringTimes(seed, focusTotalMs)`: focused-time offsets, the first 4–10 min in, each next
4–10 min later (`createRng(seed).fork('focus-water')`), none in the last minute of focus.
`dueFocusWaterings(s, now)` counts those reached by `focusDoneMs`; `session.focusWaterings` counts
those done. The controller's tick records the due ones (`session/focusWater`) and emits one
`session:water { blockIndex, sessionId, auto: true }` if the current block is focus (a batch due after
a gap collapses into one; one first seen in a break is recorded silently). Pauses and breaks never
advance focused time.

## Session log (`session-log.ts`, ADR 0151)
`state.log: SessionLogEntry[]` — `{ id, outcome: 'completed'|'cancelled', taskName, speciesId,
slotId, seed, plan (null if back-filled), goalMinutes, focusedMinutes, startedAt, endedAt,
backfilled? }`, oldest first, appended by `session/complete` and `session/cancel`. Completed:
`focusedMinutes` = the plan's focus minutes; cancelled: focused time so far (rounded).
For the calendar:
```ts
import { entriesOnDay, entriesInWeek, entriesInMonth, groupByDay, focusedMinutes } from './core/session-log';
const today = entriesOnDay(state.log, clock.now());                      // touching today (local)
const week = entriesInWeek(state.log, clock.now(), { weekStartsOn: 1 }); // Monday weeks
const done = entriesInMonth(state.log, clock.now(), { outcome: 'completed' });
for (const [day, entries] of groupByDay(week)) console.log(day, focusedMinutes(entries));
```
Ranges are half-open and local; an entry is in a range when `[startedAt, endedAt)` overlaps it (a
session across midnight is on both days); `dayKey(entry.startedAt)` is "the day it started".

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
(small < medium < large < tree). `compatibleSlots(species, slots, plants, held?)` → `{ slot, occupiedBy? }[]` (held slots of sessions in progress left out)
in slot order; an occupied slot means a swap (the occupant steps aside during the session, is
pressed on completion, returns on cancel).

## Reducer rules (`createReducer(world)`)

**Invalid actions are no-ops: the reducer returns the very same state object** (so the store
notifies nobody and nothing is saved). The reducer never mutates its input.

| Action | Valid when | Effect |
|---|---|---|
| `session/start {id, taskName, goalMinutes, plan, speciesId, slotId, seed, now, weather}` | fewer than 3 in progress; non-empty ids; finite now/seed; weather ∈ sun/rain/mist; `goalMinutes` on the grid (10–180, step 5); `planProblem(plan, goalMinutes) === null`; `id` not used by a session in progress, a finished plant or the log; `slotId` not held by a session in progress; with a world: species exists with `tier ≤ tierForMinutes(goalMinutes)`, slot exists and is compatible | new active session `{ taskName: normalized, goalMs, plan (copied), speciesId, slotId, seed, displacedPlantId: occupant of slotId ?? null, startedAt: now, pausedAt: null, pausedTotalMs: 0, skippedMs: 0, weather, waterings: [], focusWaterings: 0 }`; the previous active one → `waiting`, paused at `now` (kept if already paused); `settings.lastGoalMinutes = goalMinutes` |
| `session/switch {id, now}` | `id` is a waiting session; finite now | it becomes active and resumes (`pausedTotalMs += now − pausedAt`); the active one (if any) → `waiting`, paused at `now` |
| `session/focusWater {now}` | active session, more automatic waterings due than done | `focusWaterings = dueFocusWaterings(session, now)` |
| `session/pause {now}` | running session | `pausedAt = max(now, startedAt)` (idempotent) |
| `session/resume {now}` | paused session | `pausedTotalMs += max(0, now − pausedAt)`; `pausedAt = null` (idempotent) |
| `session/water {blockIndex, now}` | not complete; current block is a break, `blockIndex` is that block, not yet watered (allowed while paused) | `waterings.push(blockIndex)` — no effect on growth or outcome |
| `session/skipBreak {now}` | not complete; current block is a break with time left | `skippedMs += blockRemainingMs` (ends that much sooner; total and tier unchanged) |
| `session/cancel {now, id?}` | the session `id` (default: the active one) is in progress | it is removed (no other becomes active), `stats.cancelled++`, a `cancelled` log entry; the displaced plant was never removed, so it stays |
| `session/complete {now, id?}` | the session `id` (default: the active one) with `isComplete(now)` | finished plant `{ id: session.id, speciesId, slotId, seed, plantedAt: startedAt, sessionMinutes: total, taskName, completedAt: now }`; the displaced plant (and anything else in the slot) → `pressed` (`{ speciesId, seed, plantedAt, removedAt: now, taskName }`); `stats.totalMinutes += focus minutes`; `stats.completed++`; a `completed` log entry; the others stay as they are |
| `session/rename {id, taskName}` | id belongs to an in-progress session or finished garden plant; normalized name differs | update only its `taskName` and the matching log entry name; no timer, growth, statistics or species changes; unknown ids are no-ops. Exposed as `controller.rename(id, taskName): boolean`. Existing persistence saves the edit without a schema change (ADR 0219). |
| `tip/retire {id, reason?}` | non-empty id not yet retired | `tips[id] = 'seen'` (`reason` `used`/`dismissed` is not stored, ADR 0211) |
| `settings/update {patch}` | at least one valid field changes | merges `muted` (boolean), `lastGoalMinutes` (clamped), `notifications` (unasked/granted/denied) |
| `fauna/seen {id}` | non-empty id not yet seen | appended to `faunaSeen` |
| `state/replace {state}` | `state.version === 2` and a different object | replaces the whole state (callers validate first) |
| `state/reset {now}` | finite now | `createDefaultState(now)` |
| `schedule/add` · `update` · `remove` · `note` · `split` | see `reduceSchedules` (`schedule-reducer.ts`) | the `schedules` list — docs/systems/calendar.md (ADR 0171) |

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
| `switch` | Several seedlings can grow at once. Switch to another… | a session is waiting | `session/switch` (auto) |
| `pressed` | Plants you replace are pressed… | the herbarium has something | UI: `controller.retireTip('pressed')` |
| `schedule` | Plan a study time ahead… | no schedules yet and at least one bloom in the log | `schedule/add` (auto) |
| `sound` | Tap the speaker for quiet garden sounds… | always | `settings/update` toggling `muted` (auto) |

`activeTips(state, { now?, swapAvailable?, widgetSupported? })` in registry order (the UI shows
one at a time, by priority, next to its `anchor`; ADR 0124), `allTips(state)` for the ⓘ list, `tipsRetiredBy(action, prev, next)`.

Any tip can also be **dismissed** with the small × on its note (ADR 0211): the UI calls
`controller.retireTip(id, 'dismissed')`, which retires it exactly as above (persisted as `'seen'`,
listed as learned under ⓘ). A dismissal is not a use: `tipsRetiredBy` returns nothing for it.

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
| `start({ taskName, goalMinutes, planId?, speciesId, slotId })` (total clamped; plan default `unbroken`, must be one of `recommendPlans(total)`; false at 3 in progress) | `boolean` | `session:pause {…, reason: 'switch'}` for the active one if it was running, then `session:start {session, pausedId}` |
| `pause()` / `resume()` | `boolean` | `session:pause {sessionId, at, reason: 'user'}` / `session:resume {sessionId, at}` |
| `switchTo(id)` (the active one's id = `resume()`) | `boolean` | `session:pause {…, reason: 'switch'}` (if one was running), `session:resume {sessionId: id}`, `session:switch {from, to, at}` |
| `water()` | `boolean` | `session:water {blockIndex, sessionId, auto: false}` |
| `skipBreak()` | `boolean` | then `session:focus {blockIndex}` (or completion) |
| `cancel(id?)` | `boolean` | `session:cancel {sessionId, at}` |
| `check()` — announce block changes, water when focus time reaches the next automatic watering, complete when due (every tick; once at creation) | `boolean` (completed) | `session:break` / `session:focus {blockIndex, sessionId}`; `session:water {…, auto: true}`; on completion `plant:swapped {plant, removed}` (per pressed plant) → `plant:placed {plant}` → `session:complete {sessionId, plant}` |
| `recommendPlans(min)` | `StudyPlan[]` | — |
| `selectableSpecies(min)` | `{ species, locked, requiredMinutes, earned }[]` | — |
| `placementOptions(speciesId)` | `{ slot, occupiedBy? }[]` | — |
| `retireTip(id, reason = 'used')` | `boolean` | `tip:retired {id, reason}` (auto-retirements emit it too, as `used`; the note's × as `dismissed`, ADR 0211) |
| `updateSettings(patch)` | `boolean` | `settings:changed {settings}` |
| `announceFauna(id)` | `boolean` (true the first time) | `fauna:arrived {id}` |
| `status()` | `{ phase: 'idle'\|'focus'\|'break'\|'paused', session, timeline: SessionTimeline \| null, pausedForMs, longPause, sessions: { session, timeline, active, running, pausedForMs, lastLeft }[], canStart, maxSessions }` (phase…longPause: the active session) | — |
| `nextFocusWatering()` | ms of focus until the next automatic watering, or null | — |
| `onTick(fn)` | unsubscribe | `fn(status)` after every tick |
| `setTicker(t)`, `setSeed(s)`, `dispose()` | — | — |

- **Ticking** only while an active session exists (focus, break or paused — so the UI can show the
  long-pause prompt; waiting sessions need no ticks); `Ticker = { start(tick): stop }`.
- **Events for the camera** (phase 8): `session:start` (a new active plant), `session:switch` (another
  plant became active), `session:complete`, `session:cancel`, `session:water` (`auto`).
- **Block events** (active session only; switching into a session does not re-announce its block):
  each block change is announced once, from the tick, for the *current* block only
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

- Key **`studysprout:v1`** (stable forever); the document's `version` drives migrations. Schema
  `version: 3` adds optional sound preferences (ADR 0213); absent preferences retain the original
  automatic mix. The v2 fields remain: `waiting`, `log`, `focusWaterings` (ADR 0154) and optional
  `schedules` (absent → `[]`, ADR 0170).
- `loadState(storage, now, { isKnownSpecies })` → `{ state, status, warnings, error?, backupKey? }`,
  status `fresh | loaded | migrated | recovered | unavailable`. Never throws.
  - `migrated`: upgraded via `MIGRATIONS[n]: (vN) => vN+1` and re-saved. `MIGRATIONS = { 1:
    migrateV1toV2, 2: migrateV2toV3 }`: the v1 session stays the active one exactly as it was (`focusWaterings: 0`),
    `waiting: []`, `log` back-filled from the finished plants (`plan: null`, `focusedMinutes` = the
    total, `backfilled: true`). The v2 → v3 step changes only the version. Both are pure and
    never mutate input. Tested with v1 fixtures and a v2 garden containing parallel sessions,
    history and schedules.
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
  session id is not already a finished plant's id; waiting sessions are paused; at most three in
  progress with unique ids (not in the log either) and one per slot; log entries fully typed;
  present schedules must be valid (`scheduleProblem`, `noteProblem`).
  Unknown species ids (plants, pressed, sessions in progress, the log) are **kept** and listed in
  `warnings.unknownSpecies`.
- Export: `exportState(state, now)` and `exportFileName(now)` → `study-sprout-garden-YYYY-MM-DD.json`.
  Import: `importState(json, opts)` → `{ ok: true, state, warnings } | { ok: false, error: { code,
  message, path? } }` (`invalid-json | not-a-garden | unsupported-version | migration-failed |
  invalid-state`); accepts an export envelope or a bare state. Apply with `state/replace`.

Example export:
```json
{
  "format": "study-sprout-garden",
  "formatVersion": 1,
  "schemaVersion": 2,
  "exportedAt": "2026-10-22T09:05:00.000Z",
  "summary": { "plants": 1, "pressed": 0, "totalMinutes": 55, "completed": 1 },
  "state": {
    "version": 2,
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
      "weather": "rain", "waterings": [1], "focusWaterings": 3
    },
    "waiting": [],
    "log": [
      { "id": "session-mgz1k2-0a1b2", "outcome": "completed", "taskName": "Biology ch. 4", "speciesId": "japanese-iris",
        "slotId": "shore-1", "seed": 2849120533, "plan": { "id": "long-focus", "name": "Long focus", "blocks": [
        { "kind": "focus", "minutes": 25 }, { "kind": "break", "minutes": 5 }, { "kind": "focus", "minutes": 30 } ] },
        "goalMinutes": 60, "focusedMinutes": 55, "startedAt": 1792600000000, "endedAt": 1792603300000 }
    ],
    "schedules": [],
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
| `pause()`, `resume()`, `water()`, `skipBreak()`, `cancel(id?)`, `switchTo(id)` | controller calls |
| `startSessions(n, min?, gapMs?)` | starts `n` sessions ("Task 1" …), `gapMs` of dev time apart; returns their ids |
| `sessions()` | every session in progress: `{ id, taskName, speciesId, slotId, active, running, elapsedMs, totalRemainingMs, growth, pausedAt, focusWaterings }` |
| `log()` | the session log |
| `nextFocusWatering()` / `focusWater()` | focus ms to the next automatic watering / jump there and play it (false when paused, in a break or none left) |
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
- Unit: `src/core/*.test.ts` (clock, controller, controller-parallel, events, fauna-unlocks,
  focus-watering, migration-v2, migration-v3, parallel, persistence, placement, plans, reducer, rewards, rng,
  schedule, schedule-controller, schedule-reducer, session, session-log, state, tips).
- E2E: `tests/e2e/core-loop.spec.ts` (plant → break → water → skip → complete across reloads; cancel;
  corrupt save backed up; `addPlants`/`setState`) and `tests/e2e/session-rules.spec.ts` (timer and
  plan line, unwatered breaks, "Still with us?", closed-app completion, phone ink labels),
  `tests/e2e/parallel-sessions.spec.ts` (two sessions and switching, the limit, after a bloom, reload,
  automatic watering, surfaces follow the active session).
