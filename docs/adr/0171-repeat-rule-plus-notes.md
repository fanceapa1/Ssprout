# ADR 0171 — Repeats: a rule plus per-occurrence notes, expanded on the fly

- Status: accepted
- Date: 2026-10-23

## Context
Schedules repeat daily, on weekdays or weekly (ADR 0005). The gardener edits and deletes either
"only this one" or "this and following". Calendar views need the occurrences of any day, week or
month, and the result must be right across DST changes.

## Decision
- **The rule**: `date` (first occurrence), `time`, `repeat`, `until` (exclusive end date, null =
  open-ended). `occursOn(rule, date)`: one-off on its date; daily every day from it; weekdays
  Monday–Friday (a series starting on a weekend first occurs the next Monday); weekly on the
  weekday of `date`.
- **Notes** (`Schedule.notes`, keyed by the occurrence's original date): `skipped` (removed only
  this one), `dismissed` (let pass from the waiting card), `sessionId` (started from it, ADR 0173),
  and overrides `name`, `time`, `lengthMinutes`, `planId` (edited only this one).
- **Expansion is pure** (`expandSchedule(s, range)`, `expandSchedules(list, range)`): walk the
  range's local calendar days (from the day before, so a late occurrence running past midnight is
  found), apply the rule and the notes, keep occurrences whose `[at, end)` overlaps the range.
  Dates and times are **local wall time**; `at = new Date(y, m, d, hh, mm)`, so a 9:00 daily
  stays at 9:00 across DST (23 h or 25 h apart). A time inside a spring-forward gap lands just
  after it (02:30 → 03:30); an ambiguous autumn time takes the first one. Days are stepped with
  calendar arithmetic, never by adding 24 h. Tested in Europe/London across both 2026 changes.
- **Edits are actions, planned by pure functions** (`planEdit`, `planRemove` in
  `core/schedule-reducer.ts`):
  | Edit | One-off | Repeat, first occurrence | Repeat, later occurrence |
  |---|---|---|---|
  | only this one | update the schedule | note overrides | note overrides |
  | only this one, moved to another day | update | skip note + a new one-off | skip note + a new one-off |
  | this and following | update | update the rule | `schedule/split`: the series ends before that day (`until`), a new series carries the change and the later notes |
  | a new repeat (always "following") | update | update the rule | split |
  | delete only this one | remove | skip note | skip note |
  | delete this and following | remove | remove | `until` = that day |
  Changing a rule drops notes on dates it no longer has.

## Consequences
- Any range is cheap to expand (a month view: ~43 days × schedules). The scheduler's due check
  expands only the last 3½ hours.
- A split leaves two schedules; the calendar shows them as one series visually (same name).

## Rejected
- **RRULE (RFC 5545)**: far more than four repeat kinds need; parsing and exceptions (EXDATE,
  RECURRENCE-ID) would dwarf the feature.
- **Materialised occurrences**: unbounded, and every rule edit would rewrite them.
- **Repeats by adding 24 h × n**: drifts by an hour across DST.
