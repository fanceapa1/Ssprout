# ADR 0033 — Persistence: one stable key, versioned documents, back up rather than lose

- Status: accepted; amended by ADR 0154 (v1 → v2) and ADR 0213 (v2 → v3)
- Date: 2026-10-21

## Context
SPEC §9: localStorage key `studysprout:v1`, versioned schema with migrations, export/import.
A garden represents weeks of study; losing it to a parse error or a bad deploy would be the worst
bug the app could have.

## Decision
- The key stays `studysprout:v1` for the life of the app; the `version` field inside drives
  migrations. `MIGRATIONS[n]` upgrades vN → vN+1 and must not mutate its input; `migrate` chains
  them and checks each step produced the next version. v1 has none yet; the framework is tested
  with a fake v0 schema.
- `loadState` never throws. If the stored text is not JSON, fails validation, or has a newer or
  unknown version, the raw text is copied to `studysprout:corrupt:<now>` **before** anything else
  is written, then the main key is reset to a default garden. If the backup write fails (quota),
  the original stays where it is and the app runs on a fresh in-memory garden until the next save.
- A migrated garden is re-saved immediately, so migrations run once.
- Saving is debounced (300 ms, latest state wins) from the store's `onChange` and flushed on
  `pagehide` and `visibilitychange → hidden`, so a reload right after planting never loses it.
- Exports wrap the state in `{ format: 'study-sprout-garden', formatVersion, schemaVersion,
  exportedAt, summary, state }`; import accepts that envelope or a bare state and runs the same
  migrate + validate pipeline.

## Rejected
- A key per schema version (`studysprout:v2`): leaves orphaned data and makes downgrades silent.
- Discarding corrupt data: unrecoverable; a backup costs a few KB.
- Saving synchronously on every dispatch: pause/resume and tip retirements come in bursts.
