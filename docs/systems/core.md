# Core logic

`src/core/` — pure, framework-free game logic. No DOM, no canvas, no `Date.now()`/`Math.random()`:
time comes from a `Clock`, randomness from a seeded `Rng`, and both enter the state only through
action payloads. Everything here is unit-tested (`src/core/*.test.ts`).

| File | What |
|---|---|
| `state.ts` | `GardenState` types, `createDefaultState`, `Action` union, `createReducer(world)`, `createStore` |
| `session.ts` | session maths (elapsed/remaining/progress, pauses), goal clamping, weather pick, `formatClock` |
| `rewards.ts` | `tierForMinutes`, `generateOffer` |
| `placement.ts` | `isCompatible`, `compatibleSlots`, `freeSlotIds` |
| `fauna-unlocks.ts` | unlock table, `unlockedFauna`, `newlyArrived` |
| `tips.ts` | tip registry, `activeTips`, `allTips`, `tipsRetiredBy` |
| `persistence.ts` | localStorage load/save, migrations, validation, export/import |
| `controller.ts` | `createSessionController` — **the API the UI uses** |

## State machine

```
            start(goal)                 pause
   idle ─────────────────▶ running ─────────────▶ paused
    ▲  ▲                    │   ▲                   │
    │  │      cancel        │   └──── resume ───────┤  (pausedFor ≥ 30 min → longPause)
    │  └────────────────────┴───────────────────────┘  cancel: stats.cancelled++
    │                       │
    │                       │ goal reached (tick, or on boot after the app was closed)
    │                       ▼
    └── place(slot) ──── reward ◀── choose(id)  (repeatable until placed)
        discard()
```
`sessionPhase(state)`: `session` present → `running`/`paused` (by `pausedAt`); else
`pendingReward` present → `reward`; else `idle`. A session and a pending reward never coexist.
"Plant later" = leave the reward pending (it is persisted); nothing can start until it is placed
or discarded.

## Rules (reducer, `createReducer(world)`)

**Invalid actions are no-ops: the reducer returns the very same state object** (so the store
notifies nobody and nothing is saved). The reducer never mutates its input.

| Action | Valid when | Effect |
|---|---|---|
| `session/start {goalMinutes, now, id, weather}` | no session **and** no pending reward; non-empty id; finite now/goal; weather ∈ sun/rain/mist | session `{goalMs = clamp(goal)·60 000, startedAt: now, pausedAt: null, pausedTotalMs: 0}`; `settings.lastGoalMinutes = clamp(goal)` |
| `session/pause {now}` | running session | `pausedAt = max(now, startedAt)` (idempotent: already paused → no-op) |
| `session/resume {now}` | paused session | `pausedTotalMs += max(0, now − pausedAt)`; `pausedAt = null` (idempotent) |
| `session/cancel {now}` | any session (running or paused) | session cleared, `stats.cancelled++`, nothing grows |
| `session/complete {now, options, tier}` | session with `elapsed(now) ≥ goal`; `tier = tierForMinutes(goalMinutes)`; options are unique non-empty ids (may be empty) | `pendingReward {sessionId, goalMinutes, tier, options, chosen: null, completedAt: now}`; session cleared; `stats.totalMinutes += goalMinutes` (the goal, not wall time); `stats.completed++` |
| `reward/choose {speciesId}` | pending reward, id ∈ options, differs from current choice | `chosen = speciesId` (may change before placing) |
| `plant/place {slotId, id, seed, now}` | `chosen` set; new unique plant id; finite seed/now; with a world: slot exists, species known and **compatible** | new `PlantInstance {speciesId: chosen, slotId, seed, plantedAt: now, sessionMinutes: goalMinutes}`; an occupant of that slot moves to `pressed` (`{speciesId, seed, plantedAt, removedAt: now}`); reward cleared |
| `reward/discard` | pending reward | reward cleared |
| `tip/retire {id}` | non-empty id not yet retired | `tips[id] = 'seen'` |
| `settings/update {patch}` | at least one valid field changes | merges `muted` (boolean), `lastGoalMinutes` (clamped), `notifications` (unasked/granted/denied); invalid fields ignored |
| `fauna/seen {id}` | non-empty id not yet seen | appended to `faunaSeen` |
| `state/replace {state}` | `state.version === 1` and a different object | replaces the whole state (callers validate first — see persistence) |
| `state/reset {now}` | finite now | `createDefaultState(now)` |

`world: ReducerWorld = { getSpecies(id), getSlot(id) }` supplies static data for the placement
check. `reducer` (exported for compatibility) is `createReducer()` without a world: any slot id is
accepted. The app uses `createReducer({ getSpecies, getSlot })` (`main.ts`).

### Session maths (`session.ts`)
- `elapsedMs = max(0, (pausedAt ?? now) − startedAt − pausedTotalMs)`; `remainingMs = max(0, goalMs − elapsed)`.
- `isComplete ⇔ elapsed ≥ goalMs` (exactly at the goal counts). Never completes while paused short of the goal.
- `progress` 0..1 (clamped). `pausedFor(s, now)` = current pause length; `isLongPause` ⇔ ≥ 30 min (`LONG_PAUSE_MS`).
- `completionTime(s) = startedAt + pausedTotalMs + goalMs` — the moment the goal was reached; `null` while paused short of it.
- `clampGoalMinutes(m)`: snap to 5-minute steps, clamp to 10–180; NaN → 25. `GOAL_PRESETS = [25, 50, 90]`.
- `pickWeather(rng)`: sun 60 %, rain 25 %, mist 15 %.
- `formatClock(ms)`: `24:13`, `1:05:09` (rounds up, so `0:00` only at the end).

### Rewards (`rewards.ts`, ADR 0031)
- `tierForMinutes`: 10–24 → 1, 25–49 → 2, 50–89 → 3, 90+ → 4 (`TIER_MIN_MINUTES`).
- `generateOffer(rng, tier, species, ownedIds)` → up to 3 ids. Order of preference: earned tier
  unowned → earned tier owned → next lower tier unowned → owned → … → tier 1. Shuffled within each
  group; independent of input order. Fewer than 3 only when the whole pool (≤ tier) is smaller.
  "Owned" = growing in the garden (`ownedSpeciesIds(plants)`); pressed flowers do not count.
  The controller seeds it with `rng.fork('offer:' + sessionId)`.

### Placement (`placement.ts`)
Compatible ⇔ `species.habitats` includes `slot.habitat` **and** `sizeClass ≤ slot.maxSize`
(small < medium < large < tree). `compatibleSlots(species, slots, plants)` → `{ slot, occupiedBy? }[]`
in slot order; occupied entries are swap candidates.

### Fauna (`fauna-unlocks.ts`)
`FAUNA_UNLOCKS` (in order, each with an `arrival` line): `striders` always (silent, `announce: false`) ·
`dragonfly` 2 plants · `koi-1` 3 · `butterflies` 4 pollinator flowers · `bees` 6 pollinator flowers ·
`koi-2` 7 · `small-birds` 8 · `frog` a water plant + 10 plants · `swallows` 14 · `heron` 20 · `koi-3` 25.
"Pollinator flower" = plant whose species has `pollinators: true`; "water plant" = species whose
habitats include `water`. Plants of unknown species count as plants only.
`unlockedFauna(state, lookup)`; `newlyArrived(state, lookup)` = unlocked − `faunaSeen`.

### Tips (`tips.ts`)
Ids: `duration`, `notifications`, `widget`, `placement`, `swap`, `pressed`, `sound`. Each has
`copy`, an `anchor` (control name for the UI) and a relevance rule:

| Tip | Shown when (and not retired) | Retired by |
|---|---|---|
| duration | idle | `session/start` (auto) |
| notifications | idle and `notifications === 'unasked'` | `settings/update` that answers it (auto) |
| widget | a session exists and PiP is supported (`ctx.widgetSupported`) | UI: `controller.retireTip('widget')` |
| placement | a chosen reward is waiting to be placed | `plant/place` (auto) |
| swap | placing and a swap is possible (`ctx.swapAvailable`, default: garden has plants) | a placement that swapped (auto) |
| pressed | the herbarium has something | UI: `controller.retireTip('pressed')` when the book is opened |
| sound | always | `settings/update` toggling `muted` (auto) |

`activeTips(state, ctx?)`, `allTips(state)` (ⓘ list with `retired`), `tipsRetiredBy(action, prev, next)`.
The controller dispatches the automatic retirements for every applied action.

## Controller API (`controller.ts`)

```ts
const controller = createSessionController({
  store, clock, bus,
  species: allSpecies(),     // SpeciesDef[]
  slots: scene.slots,        // for placementOptions()
  ticker,                    // optional; default setInterval(1 s); widget may supply a Worker ticker
  seed,                      // optional; default clock.now()
});
```
| Method | Returns | Emits |
|---|---|---|
| `start(goalMinutes?)` (default: last goal) | `ActiveSession \| null` (null unless idle) | `session:start {session}` |
| `pause()` / `resume()` / `cancel()` | `boolean` (false = nothing to do) | `session:pause\|resume\|cancel {sessionId, at}` |
| `check()` — complete if due (every tick; once at creation) | `boolean` | `session:complete {sessionId, reward}` |
| `offer()` | `SpeciesDef[]` for the pending options | — |
| `choose(speciesId)` | `boolean` | `reward:chosen {speciesId}` |
| `placementOptions()` | `CompatibleSlot[]` for the chosen species | — |
| `place(slotId)` | `PlantInstance \| null` | `plant:swapped {plant, removed}` (if swap), then `plant:placed {plant}` |
| `discard()` | `boolean` | — |
| `retireTip(id)` | `boolean` | `tip:retired {id}` (auto-retirements emit it too) |
| `updateSettings(patch)` | `boolean` | `settings:changed {settings}` |
| `announceFauna(id)` | `boolean` (true the first time) | `fauna:arrived {id}` |
| `status()` | `SessionStatus {phase, session, pendingReward, goalMs, elapsedMs, remainingMs, progress, pausedForMs, longPause}` | — |
| `onTick(fn)` | unsubscribe | `fn(status)` after every tick |
| `setTicker(ticker)` | — | — |
| `setSeed(seed)` | — | — |
| `dispose()` | — | — |

- **Ticking**: `Ticker = { start(tick): stop }`. The controller ticks only while a session exists
  (running or paused, so the UI can show the long-pause prompt) and stops when it ends.
- **Closed-app completion**: at creation (and every tick) `check()` completes a session whose
  goal has passed, stamping `completedAt` with the real moment (`completionTime`), so the reward is
  waiting on return.
- **Determinism**: ids (`session-…`, `plant-…`), weather, plant seeds come from the controller's rng;
  offers from `rng.fork('offer:' + sessionId)`.
- Long pause: `status().longPause`; "End session" = `cancel()`, "Resume" = `resume()`.
- Notification permission is the UI's job (ask on first `start`, then `updateSettings({ notifications })`).

## Persistence (`persistence.ts`)

- Key **`studysprout:v1`** (stable forever); the document's `version` drives migrations.
- `loadState(storage, now, { isKnownSpecies })` → `{ state, status, warnings, error?, backupKey? }`,
  status `fresh | loaded | migrated | recovered | unavailable`. Never throws.
  - `migrated`: upgraded via `MIGRATIONS[n]: (vN) => vN+1` (none yet; tested with a fake v0) and re-saved.
  - `recovered`: invalid JSON, invalid shape or a newer/unknown version → raw text copied to
    `studysprout:corrupt:<now>`, the main key reset to a default garden. If the backup cannot be
    written, the original is left in place.
  - `unavailable`: no storage / reading throws → default state, nothing persists.
- Saving: `createSaver(storage, { delayMs: 300 })` → `schedule(state)` (debounced, latest wins),
  `flush()`, `cancel()`. `main.ts` schedules on every store change (`createStore` `onChange`) and
  flushes on `pagehide` and when the tab is hidden.
- Validation (`validateState`, ADR 0034): absent keys → defaults; present keys must have the right
  type (else `invalid-state` with a `path` like `plants[3].seed`); unknown keys dropped; invariants:
  unique plant ids, one plant per slot, `chosen ∈ options`, no session alongside a pending reward;
  `lastGoalMinutes` clamped; `faunaSeen` deduped. Unknown species ids are **kept** and listed in
  `warnings.unknownSpecies`.
- Export: `exportState(state, now)` (pretty JSON) and `exportFileName(now)` →
  `study-sprout-garden-YYYY-MM-DD.json` (local date). Import: `importState(json, opts)` →
  `{ ok: true, state, warnings } | { ok: false, error: { code, message, path? } }`, codes
  `invalid-json | not-a-garden | unsupported-version | migration-failed | invalid-state`. It accepts
  an export envelope or a bare stored state, and migrates old versions. Apply with
  `store.dispatch({ type: 'state/replace', state })`.

Example export:
```json
{
  "format": "study-sprout-garden",
  "formatVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-10-21T19:05:00.000Z",
  "summary": { "plants": 1, "pressed": 0, "totalMinutes": 25, "completed": 1 },
  "state": {
    "version": 1,
    "createdAt": 1792600000000,
    "plants": [
      { "id": "plant-mgz1k2-0a1b2", "speciesId": "japanese-iris", "slotId": "shore-1",
        "seed": 2849120533, "plantedAt": 1792601600000, "sessionMinutes": 25 }
    ],
    "pressed": [],
    "session": null,
    "pendingReward": null,
    "stats": { "totalMinutes": 25, "completed": 1, "cancelled": 0 },
    "faunaSeen": ["striders"],
    "tips": { "duration": "seen", "placement": "seen" },
    "settings": { "muted": true, "lastGoalMinutes": 25, "notifications": "granted" }
  }
}
```
The stored `studysprout:v1` value is the bare `state` object.

## Debug API (`?dev`, `src/dev/core-debug.ts`)

Added to `window.sprout` with `extendDebug`:

| Method | Does |
|---|---|
| `reset()` | fresh default garden (saved immediately) |
| `seed(n)` | seeds the controller rng (ids, weather, offers, plant seeds) and `addPlants` |
| `start(min?)`, `pause()`, `resume()`, `cancel()` | controller calls |
| `completeSession()` | resumes if paused, jumps the dev clock (`SpeedClock.advance`) to the goal, completes; returns the pending reward |
| `choose(id?)` | choose (default: first option) |
| `placementOptions()` | `[{ id, habitat, occupiedBy? }]` for the chosen species |
| `place(slotId?)` | place (default: first free compatible slot, else first compatible) |
| `addPlants(n, tier?)` | instantly plants up to `n` random species in free compatible slots (for full-garden screenshots); returns how many |
| `setState(partial)` | shallow merge, validated (throws on invalid), applied with `state/replace` |
| `status()` | `controller.status()` |
| `flush()` | write the pending save now |
| `exportState()` / `importState(json)` | persistence round-trip (import applies on success) |

E2E example (`tests/e2e/core-loop.spec.ts`):
```ts
await page.evaluate(() => { sprout.reset(); sprout.seed(42); sprout.start(25); });
const reward = await page.evaluate(() => sprout.completeSession());
await page.evaluate((id) => { sprout.choose(id); return sprout.place(); }, reward.options[0]);
await page.reload(); // saved on pagehide
```
