# ADR 0004 — Disable Vitest's fs module cache

- Status: accepted
- Date: 2026-10-22
- Decided by: orchestrator

## Context
Vitest caches transformed modules in `node_modules/.vitest-cache` by default. The cached
transform of `src/plants/registry.ts` kept the old `import.meta.glob('./species/*.ts')`
expansion after new species files were merged, so unit tests reported newly added species as
unregistered (the dev server and builds were fine).

## Decision
Set `test.fsModuleCache: false` in `vite.config.ts`.

## Consequences
Slightly slower cold test starts; correct results whenever files are added to globbed folders
(species, studio sections). If a stale-cache symptom ever reappears, delete `node_modules/.vitest-cache`.
