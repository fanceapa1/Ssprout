# ADR 0154 — Persisted schema v2 and the v1 → v2 migration

- Status: accepted (amends ADR 0033: the first real migration); amended by ADR 0213 (v2 → v3) and ADR 0240 (v3 → v4)
- Date: 2026-10-23

## Context
Parallel sessions (ADR 0150) and the session log (ADR 0151) change the stored garden. Existing
gardens and a v1 session in progress — running or paused — must survive, and old export files
must still import.

## Decision
- `STATE_VERSION = 2`. The storage key stays `studysprout:v1` (ADR 0033); the document's `version`
  drives `MIGRATIONS = { 1: migrateV1toV2 }` through the existing chain (`migrate`), on load and on
  import.
- `migrateV1toV2(doc)` is pure (no clock) and never mutates its input: the v1 `session` stays the
  active one exactly as it was (running or paused; `focusWaterings: 0`), `waiting: []`, and `log`
  is back-filled from the finished plants (`backfillLog`, ADR 0151). Malformed plants are skipped in
  the back-fill and left for validation to report.
- Validation (`validateState`) for v2: `waiting` sessions must be paused; at most three sessions in
  progress; their ids unique and unused by plants or the log; one session per slot;
  `focusWaterings` a whole number ≥ 0 (absent → 0); log entries fully typed (`plan` may be null).
  Unknown species in waiting sessions and the log are flagged like the others.
- A migrated garden is saved back at once (`status: 'migrated'`); the next load is `loaded`.

## Consequences
- An older build cannot read a v2 garden (`unsupported-version`, backed up as corrupt data — the
  existing recovery path). Builds are deployed together, so this only matters for a stale tab.
- Fixtures of real v1 documents live in `src/core/fixtures/` and are tested in
  `migration-v2.test.ts`.
