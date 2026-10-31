# 71 — F2: species scaffolding

**Status: done**, with the open points below.

## What
- **Notes per species**: the 25 notes moved to `src/plants/notes/<id>.ts` (`{ note, in? }`);
  `notes.ts` globs them; `speciesNote(id, sceneryId?)` and `pickNote`. `notes.test.ts`: every
  species has a note, no note without a species (the `toHaveLength(25)` pin is gone), the style
  rules for every text, per-garden notes name known sceneries, the override is picked.
- **Family suites**: `src/plants/lib/suites.ts` (`smallSuite`, `shrubSuite`, `treeSuite`) and one
  `src/plants/species/<id>.test.ts` per species. `lib/small-species.test.ts`,
  `lib/shrub-species.test.ts`, `lib/tree-plans.test.ts` and `lib/small-species-list.ts` are gone.
  Assertions counted with an `afterEach` reading `expect.getState().assertionCalls`:
  **726,075 before and after** (110 → 115 tests: the shrubs' shared registration test is now one
  per shrub, same assertions).
- **Studios**: `small-review`, `shrub-gallery` and `tree-review` take their species from
  `speciesByTier`; new `src/plants/flora.studio.ts` (`flora/<sceneryId>`, order 206).
- **Paint version**: `UNCACHED_DIRS` in `src/paint/paint-version.ts`; 199 → 124 hashed files, all 75
  dropped files under those folders. Tests: a fixture project where the scene imports a lib
  helper (kept, and its edit changes the version) while a new species, test, note, helper, creature
  and an edited `creatures/index.ts` keep it; the real project hashes nothing under those folders
  and everything the scene and scenery closures reach.
- **Recipe**: `docs/systems/species-recipe.md`, linked from `plants.md` and `AGENTS.md`.

## Why / decisions
ADR 0251. Notes are a default export because `in` is a reserved word as an export name.
`src/plants/notes` joins the uncached folders: otherwise each note file would have changed the
paint version, being under the `src/plants` root.

## Looked at
`artifacts/shots/f2-flora-1440x900.png` (both gardens' line-ups by tier, ×0.5),
`artifacts/shots/f2-wf-close-1440x900.png` (the recipe's close-view command: a violet on
`ledge-3` at the waterfall, noon).

## Tests
`npx vitest run` (all), `npm run typecheck`, `tests/e2e/studio.spec.ts` (1 worker).

## Left / for others
- **F1 hook**: `flora.studio.ts` lists every species per garden until `floraOf` lands. Replace
  `offeredIn` with `floraOf(sceneryId)` (one line, marked).
- **Plant card**: `ui/plant-card.ts` still calls `speciesNote(id)` without the plant's
  `sceneryId` (F1 owns the file). Passing `plant.sceneryId` / `session.sceneryId` enables `in`.
- The review boards are now in id order, not the old hand order; their pixels moved, the species'
  did not.
- A tier-3 or tier-4 species that does not use the shrub or tree structure has no ready suite.
- No automated check of the worker paint budget (4–127 ms at 1.6×); the recipe asks for a probe.
