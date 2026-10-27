# ADR 0151 — The session log: an append-only history of ended sessions

- Status: accepted; amended by ADR 0219 (a garden plant's edited name updates its log entry)
- Date: 2026-10-23

## Context
The calendar (phase 8, ADR 0005) shows past sessions — completed, and cancelled faintly — by day,
week and month. v1 kept only finished plants (and a cancelled counter), so a cancelled session or
a plant later pressed left no trace with times.

## Decision
- `GardenState.log: SessionLogEntry[]`, oldest first, appended by the reducer on
  `session/complete` and `session/cancel` (`logEntry(session, outcome, now)` in `core/state.ts`),
  never edited:
  ```ts
  interface SessionLogEntry {
    id: string;                 // session id (= the plant's id when completed)
    outcome: 'completed' | 'cancelled';
    taskName: string; speciesId: string; slotId: string; seed: number;
    plan: StudyPlan | null;     // null when back-filled from a v1 plant
    goalMinutes: number;        // the chosen total (focus + breaks)
    focusedMinutes: number;     // focus actually studied, whole minutes
    startedAt: number; endedAt: number; // wall clock, epoch ms (pauses and waiting in between)
    backfilled?: true;
  }
  ```
  Completed: `focusedMinutes` = the plan's focus minutes (as `stats.totalMinutes`); cancelled: the
  focused time so far, rounded. Species, slot and seed are kept so the calendar can paint the plant.
- **Queries** are pure functions in `core/session-log.ts`: `entriesBetween(log, { from, to },
  { outcome? })` (half-open ranges; an entry belongs where its `[startedAt, endedAt)` span overlaps,
  so a session across midnight shows on both days), `dayRange` / `weekRange(t, weekStartsOn = 1)` /
  `monthRange` in the **local** calendar, `entriesOnDay` / `entriesInWeek` / `entriesInMonth`,
  `dayKey(t)` (`YYYY-MM-DD`, "the day it started"), `groupByDay(entries)`, `focusedMinutes(entries)`.
- **Back-fill** (`backfillLog(plants)`, used by the v1 → v2 migration): one `completed` entry per
  finished plant with `plan: null`, `focusedMinutes` = the session total (its breaks are unknown) and
  `backfilled: true`. Pressed flowers (no minutes or slot kept) and cancelled sessions (only a
  counter) cannot be rebuilt.
- Size: an entry is ~300 bytes of JSON; three sessions a day for a year is ~330 KB, well inside
  localStorage. No pruning for now.

## Consequences
- The calendar task reads `store.get().log` (and `inProgressSessions(state)` for sessions still
  growing) with the queries above; scheduled sessions will be a separate list.
- Log ids are reserved: a new session never reuses one (ADR 0150).

## Rejected
- Recording every pause/resume span: the calendar does not need it yet, and it would make entries
  unbounded.
- Deriving history from plants + pressed: loses cancelled sessions and times of pressed plants.
