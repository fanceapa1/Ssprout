# ADR 0030 — Reducer validates every action, placement via an injected world

- Status: accepted; amended by ADR 0036 (the compatibility and tier checks now run on `session/start`; there is no pending reward)
- Date: 2026-10-21

## Context
The foundation exported a single `reducer` with no knowledge of species or slots. SPEC §3 says a
plant may only go into a slot whose habitat it likes and whose `maxSize` it fits. Checking this
only in the UI or controller would let any other dispatcher (dev tools, imports, future systems)
plant a tree on a lily pad.

## Decision
- `createReducer(world?: ReducerWorld)` in `src/core/state.ts`, with
  `ReducerWorld = { getSpecies(id), getSlot(id) }`. Both are static data (registry, scene), so the
  reducer stays pure. `main.ts` builds the app reducer from the plant registry and scene slots.
- `reducer` stays exported as `createReducer()` (no world: any slot id is accepted) so existing
  imports keep working.
- **Every invalid action is a no-op that returns the same state reference**: wrong phase, wrong
  payload shape, incompatible slot, duplicate id. The store then notifies nobody and nothing is
  saved. Tests assert `toBe(state)` for each rule.
- `session/complete` is only accepted once `elapsedMs(session, now) >= goalMs` and with
  `tier === tierForMinutes(goal)`, so a buggy tick source cannot hand out early or wrong rewards.
  Dev tools jump the clock instead of forcing completion (ADR 0035).
- `session/start` is refused while a reward is pending (orchestrator rule): "plant later" keeps
  the reward safe, but the next session waits until it is placed or discarded.

## Rejected
- Passing slot habitat/size in the `plant/place` payload: the payload would be trusted data.
- Throwing on invalid actions: the store would need try/catch at every call site, and UI
  double-clicks (pause twice) are normal, not errors.

## Consequences
`ARCHITECTURE.md › State` documents `createReducer`/`ReducerWorld`. If the "no start while a reward
is pending" rule proves annoying in play-testing, relaxing it is a one-line reducer change plus a
UI affordance.
