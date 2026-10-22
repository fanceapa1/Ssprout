# ADR 0170 — Schedules in the garden state, no schema bump

- Status: accepted
- Date: 2026-10-23

## Context
Phase 8 (ADR 0005) adds scheduled study sessions: a name, a local date and time, optionally a
length and a plan, and a repeat. They must persist with the garden, export and import with it,
and survive validation. The schema is v2 (ADR 0154); a v3 would mean a migration step and a new
fixture set.

## Decision
- `GardenState.schedules: Schedule[]` (`src/core/schedule.ts`):
  ```ts
  interface Schedule { id: string; name: string /* ≤ 40 */; date: string /* local YYYY-MM-DD */;
    time: string /* local HH:MM */; lengthMinutes: number | null; planId: string | null;
    repeat: 'none' | 'daily' | 'weekdays' | 'weekly'; until: string | null /* exclusive */;
    notes: Record<string /* date */, OccurrenceNote>; createdAt: number }
  ```
  A `null` length or plan is **left open**: chosen in the start flow. A plan needs a length it is
  recommended for (`findPlan(length, planId)`). Plant and spot are not part of a schedule.
- **No schema bump.** The key is additive and optional: `readState` reads an absent `schedules`
  as `[]`, so every v2 document (stored or exported before phase 8) loads unchanged, and a
  present key is validated (`readSchedule`: dates, times, repeat, until after the start, length
  and plan, notes; duplicate ids rejected; unknown note keys dropped). `STATE_VERSION` stays 2.
- Changes go through pure reducers (`core/schedule-reducer.ts`) wired into `createReducer`:
  `schedule/add | update | remove | note | split`. Invalid actions return the same state
  (ADR 0030).

## Consequences
- An older build of the app reading a newer export would drop the schedules silently (unknown keys
  are dropped). There is only one deployed build, so this is acceptable.
- Size: a schedule is ~250 bytes plus its notes; notes are few (skips, edits, links).

## Rejected
- **Schema v3 with a migration**: nothing to migrate (an empty list is the right value for every
  existing garden), and the migration chain would grow a no-op step.
- **Storing occurrences**: unbounded for repeats and wrong after a closed tab; occurrences are
  expanded on the fly (ADR 0171).
