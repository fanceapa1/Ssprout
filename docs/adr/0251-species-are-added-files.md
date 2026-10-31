# ADR 0251: A species is only added files

- Status: accepted
- Date: 2026-10-31
- Builds on: ADRs 0004 (fs module cache off), 0167 (species notes), 0227 (persistent paint cache), 0242 (scenery in cache keys)
- Related: ADR 0250 (species availability per scenery, task F1)

## Context
Phase 12 adds about 12 waterfall species, two or three art tasks at a time. The registry already
globbed `species/*.ts`, but every new species still edited shared files: the notes map and its
`toHaveLength(25)` pin, the family lists (`small-species-list.ts`, the shrub `BUILDERS` and tree
`PLANS` maps in the family tests) and the hand lists in the three review studios. Parallel tasks
would conflict on each of them. Every merged species also changed the paint version, since
`src/plants` and `src/fauna` were paint roots, so each art merge threw away every visitor's cached
landscape although no cached painting holds a plant or a creature.

## Decision
- **Notes per species.** `src/plants/notes/<id>.ts` default-exports `{ note, in? }`; `in` holds a
  per-scenery note for a shared species. `notes.ts` globs them (main thread only; the sprite worker
  never imports it) and `speciesNote(id, sceneryId?)` picks the garden's note, else `note`. The
  test checks both directions (every species has a note, no orphan note) with no count pin.
- **Family suites.** `src/plants/lib/suites.ts` (test-only) holds `smallSuite(id)`,
  `shrubSuite(id, build, { habitats, sizeClass? })` and `treeSuite(id, plan)`, the assertions of
  the three family test files exactly. Each species calls its suite from `species/<id>.test.ts`
  (the registry glob skips `*.test.ts`). Species-specific checks (chrysanthemum colourways,
  camellia petals) moved to those files. 726,075 assertions before and after; 110 → 115 tests,
  because the shrubs' one shared registration test became one per shrub.
- **Generated line-ups.** The family boards take their species from the registry by tier, in id
  order. A new `flora` section lines each scenery's species up by tier at one world scale. Until
  F1's `floraOf` is on main it lists every species, behind a marked one-line hook.
- **Narrower paint version.** `UNCACHED_DIRS` (`src/plants/species`, `src/plants/lib`,
  `src/plants/notes`, `src/fauna/creatures`) are not hashed, and the plants and fauna roots do not
  follow imports into them. The closure of the other roots (scene, scenery, ambience, paint,
  render, core) still follows imports anywhere, so a helper a cached painter imports stays hashed.
  Today none is: 124 hashed files instead of 199.

## Consequences
- An "add a species" task adds `species/<id>.ts`, `species/<id>.test.ts` and `notes/<id>.ts`
  (docs/systems/species-recipe.md) and touches no shared file; merging it keeps the paint version.
- The review boards' order is alphabetical now, not the hand order, and they grow with the
  registry (the shrub rows widen past six).
- A species that follows no family writes its own checks; the recipe lists them.
- Editing a shared lib helper still changes other species' pixels but not the paint version
  (their sprites are never cached). The recipe forbids it in art tasks.
- If a cached painter ever imports a plant helper, that helper re-enters the hash by itself.
