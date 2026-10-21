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
- Tests: ~270 unit tests total (core ≈ 210); e2e `tests/e2e/core-loop.spec.ts` (start → reload →
  complete → reload → choose → place → reload; corrupt save backup; addPlants/setState).

## Why (non-obvious)
ADRs 0030 (reducer validation + world), 0031 (offers), 0032 (controller), 0033 (persistence),
0034 (validation), 0035 (dev clock jump).

## Left for others / open questions
- **UI**: create no actions directly; call the controller (exported from `main.ts` boot, pass it
  into the UI). Ask notification permission on the first `start`, then
  `controller.updateSettings({ notifications })`. Show "Still with us?" when
  `status().longPause`. Retire `widget` and `pressed` tips with `controller.retireTip`.
  Pass `{ swapAvailable, widgetSupported }` to `activeTips`.
- **Widget**: `controller.setTicker(workerTicker)`; title countdown via `formatClock(status().remainingMs)`.
- **Fauna**: `unlockedFauna(state, getSpecies)`; on a creature's first appearance call
  `announceFauna(id)` (or dispatch `fauna/seen` and emit `fauna:arrived`); show `faunaUnlock(id).arrival`.
- **Plants/render**: plants may reference unknown species (kept on import/load); skip them.
- Starting a new session while a reward is pending is refused (orchestrator rule). If play-testing
  finds "plant later" then blocks studying, revisit ADR 0030.
- When the scene task replaces `placeholderScene`, `main.ts` must keep passing the same scene's
  slots to `createReducer` and the controller.
