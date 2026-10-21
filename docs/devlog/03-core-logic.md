# 03 — Core logic

## What
- `core/session.ts`: elapsed/remaining/progress (pauses excluded), `isComplete`, long-pause
  detection (≥ 30 min), `completionTime`, `sessionPhase`, goal clamping (10–180, step 5), seeded
  weather (sun 60 / rain 25 / mist 15), `formatClock`.
- `core/state.ts`: every action in the union implemented by `createReducer(world)`; invalid actions
  return the same state. Placement checks habitat + size class via an injected `ReducerWorld`;
  swaps move the occupant to `pressed`.
- `core/rewards.ts`: `tierForMinutes`, `generateOffer` (earned tier first, unowned first, falls
  back tier by tier, deterministic per seed).
- `core/placement.ts`: `isCompatible`, `compatibleSlots` (with `occupiedBy`), `freeSlotIds`.
- `core/fauna-unlocks.ts`: SPEC §4 table with arrival lines, `unlockedFauna`, `newlyArrived`.
- `core/tips.ts`: seven tips with copy, relevance rules, `activeTips`, `allTips`, `tipsRetiredBy`.
- `core/persistence.ts`: load/save under `studysprout:v1`, migration framework (tested with a fake
  v0), corrupt-data backup under `studysprout:corrupt:<ts>`, debounced saver, export/import with
  typed errors and unknown-species warnings.
- `core/controller.ts`: `createSessionController`, the single UI-facing API (ticks, completion on
  boot, seeded offers, bus events, automatic tip retirement).
- `core/clock.ts`: `SpeedClock.advance(ms)` for dev time jumps.
- `main.ts`: loads with `loadState`, saves via `createSaver` on every store change (flushed on
  `pagehide`/hidden), uses `createReducer({ getSpecies, getSlot })`, creates the controller.
- `dev/core-debug.ts` + `dev/fill-garden.ts`: `window.sprout` reset/seed/start/pause/resume/cancel/
  completeSession/choose/placementOptions/place/addPlants/setState/status/flush/export/import.
  Fixed `installDebug` typing so declaration-merged methods don't break it.
- Tests: 276 unit tests total (core + dev: 249); e2e `tests/e2e/core-loop.spec.ts` (start → reload →
  complete → reload → choose → place → reload; corrupt save backup; addPlants/setState).

## Why (non-obvious)
ADRs 0030 (reducer validation + world), 0031 (offers), 0032 (controller), 0033 (persistence),
0034 (validation), 0035 (dev clock jump).

## Revision 2026-10-22 — plant chosen at start (ADR 0003 → ADR 0036)
- New `core/plans.ts`: `PlanBlock`, `StudyPlan`, `recommendPlans(total)` (unbroken, pomodoro,
  long-focus, deep-work, two-deep), `planProblem`.
- `ActiveSession` now carries task name, plan, species, slot, seed, `displacedPlantId`,
  `skippedMs`, `waterings`; `PlantInstance` gains `taskName`, `completedAt` (id = session id);
  `PressedFlower` gains `taskName`; `pendingReward`, `reward/*` and offer generation are gone.
- `sessionTimeline(s, now)` (plan position = session time + skipped breaks; growth = focused ÷
  total focus), phases `idle | focus | break | paused`.
- New actions `session/water`, `session/skipBreak`; `session/complete {now}` finalises the plant and
  presses the displaced one; cancel leaves it in place.
- Controller: `start({ taskName, goalMinutes, planId, speciesId, slotId })`, `water()`,
  `skipBreak()`, `recommendPlans`, `selectableSpecies`, `placementOptions(speciesId)`,
  `status().timeline`; events `session:break | session:focus | session:water`, completion emits
  `plant:swapped` → `plant:placed` → `session:complete {sessionId, plant}`.
- Tips: added `task`, `plan`, `water`; start-flow tips retire on `session/start`.
- Debug: `start(min, opts)`, `toBreak()`, `skipToBlock(i)`, `water()`, `skipBreak()`,
  `completeSession()` → plant, `addPlants` makes finished named plants.
- Touched outside core (test data only): `src/audio/garden-audio.test.ts` fixtures follow the new
  `ActiveSession`/`PlantInstance` shapes and `session:complete` payload.
- Tests: 411 unit tests total; e2e covers start → break → water → skip → complete with reloads,
  cancel with a displaced plant, corrupt-save backup, addPlants/setState.

## Left for others / open questions
- **UI**: create no actions directly; call the controller (created in `main.ts` `boot()`; pass it
  into the UI). Start sheet: `recommendPlans(min)`, `selectableSpecies(min)`,
  `placementOptions(speciesId)`, then `start({...})`. Ask notification permission on the first
  start, then `controller.updateSettings({ notifications })`. Show "Still with us?" when
  `status().longPause`. Retire `widget` and `pressed` tips with `controller.retireTip`; pass
  `{ now, swapAvailable, widgetSupported }` to `activeTips`.
- **Widget**: `controller.setTicker(workerTicker)`; read `status().timeline` (growth, block,
  remaining, plan segments) and call `water()` / `skipBreak()`; notify on `session:break`,
  `session:focus`, `session:complete`. Title countdown via `formatClock(timeline.totalRemainingMs)`.
- **Plants/render**: draw the session's seedling at `timeline.growth` in `session.slotId`; fade the
  plant `session.displacedPlantId` while a session runs; plants may reference unknown species
  (kept on import/load) — skip them.
- **Fauna**: `unlockedFauna(state, getSpecies)` (finished plants only); on a creature's first
  appearance call `announceFauna(id)` and show `faunaUnlock(id).arrival`.
- When the scene task replaces `placeholderScene`, `main.ts` must keep passing the same scene's
  slots to `createReducer` and the controller.
