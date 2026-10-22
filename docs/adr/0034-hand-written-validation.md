# ADR 0034 — Hand-written structural validation; lenient on absence, strict on type

- Status: accepted; amended by ADR 0036 (the session invariants are plan-based; no pending reward, `chosen` or `options`)
- Date: 2026-10-21

## Context
Imported files come from outside (other devices, older or newer builds, hand edits). Stored state
is normally written by us but may be truncated or come from another build. We need path-precise
errors and must not grow the bundle.

## Decision
- `validateState` in `persistence.ts` is a small hand-written reader (`obj`, `arr`, `str`, `num`,
  `oneOf`, `opt` helpers) that **rebuilds** a fresh `GardenState`, so unknown keys are dropped and
  the output is fully typed.
- **Absent** keys take defaults (forward-compatible with additive fields); **present** keys must
  have the right type, otherwise `{ code: 'invalid-state', path: 'plants[3].seed' }`.
- Invariants are enforced: unique plant ids, at most one plant per slot, `chosen` among `options`,
  unique options, `goalMs > 0`, non-negative counters, no active session alongside a pending reward.
- Values are normalised where the meaning is obvious: `lastGoalMinutes` snapped to the goal grid,
  `faunaSeen` deduplicated.
- **Unknown species ids are kept, not rejected**, and reported in `warnings.unknownSpecies`: a file
  from a newer build (or a species renamed during development) must not wipe a garden. Rendering
  code must tolerate an unknown `speciesId` (skip it).
- Slot ids are not checked against the scene: the scene task may re-lay out slots, and a plant in a
  vanished slot is kept in the data.

## Rejected
- A schema library (zod, valibot): extra bundle weight for one schema; error paths are just as good here.
- Repairing broken entries (dropping a bad plant): silent data loss. Rejecting the whole import,
  and backing up a corrupt store, is more honest.
