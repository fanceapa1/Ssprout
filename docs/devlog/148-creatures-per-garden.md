# 148 · Z8: Creatures per garden

Phase 14, optimisation pass (P16a′). ADR 0346.

## What
- **One creature set per garden.** `src/fauna/creatures/sets/creatures-<scenery id>.ts` imports the
  kinds of that garden's table that have a module. The registry globs the sets lazily, so each set
  is a dynamic import. Creatures shared between gardens go to shared chunks.
- **The registry answers from what is loaded.**
  - `loadCreatures(id)`, `creaturesLoaded(id)`, `loadAllCreatures()` and `creatureGardens()` are
    new.
  - `creatureDef`, `creatureDefs` and `creatureKinds` know only the loaded sets.
  - `registryEntries` is gone: the registry test globs the modules itself.
- **The fauna system waits for its garden.**
  - `init` loads the garden on view's set, then runs the old init body (`apply`). With the set
    already loaded it stays synchronous.
  - An init overtaken by a later one is dropped (a token).
  - The sim's seed is read when `init` is called.
  - The renderer awaits `init`, so `sprout.ready()` and `showScenery` resolve with the creatures
    there, and the existing fauna e2e specs need no change.
- **Residents** (`sim.ts`): the resident order is computed from the loaded defs (by `rank`, then
  kind) and cached until another set loads. It used to be a module constant.
- **Prefetch.** The Gardens section's pre-paint also fetches that garden's creatures:
  `prefetchCreatures(id)` in `main.ts › paintOverview`.
- **Dev API.** `sprout.fauna.kinds()` lists the loaded kinds. `sprout.fauna.loadAll()` is new.
  `spawn` of a kind that is not loaded says so.
- **Studio.** `fauna.studio.ts` awaits `loadAllCreatures()` at top level, so every creature is
  still listed.
- **Tests.** The unit tests that use the registry (21 files) await `loadAllCreatures()` at top
  level. `src/main.ts`: an import and the `paintOverview` hook (4 lines).

## Numbers (main @ 432bc95, production build)
First view is everything `index.html` reaches statically, as in devlog 145. Gzip is level 9 per
file. Creature code is counted with source-map attribution.

| | before | after |
|---|---|---|
| First-view JS | 1,385 kB raw / 497 kB gzip, 8 files | 1,129 kB raw / 412 kB gzip, 11 files |
| Creature code in it | 252 kB (every creature, in `sky-light`) | 0 (only the registry) |

The first view is 256 kB lighter, above the 190 kB target. The three oasis creatures that landed
since the audit (dove, dropwing, Sahara frog) are part of that. There are three more first-view
files because the bundler splits out the modules that the eager graph shares with the creature
chunks: `slots` 44 kB, `targets` 7 kB and `sprite` 3 kB.

**Lazy chunks.** The bundler picks the names. Shared creatures go to the chunk of the first
module.

| chunk | raw / gzip | holds |
|---|---|---|
| `creatures-japanese-garden` | 0.4 / 0.3 kB | the set |
| `creatures-oasis` | 0.3 / 0.2 kB | the set |
| `creatures-waterfall` | 97.6 / 33.9 kB | the set, damselfly, dipper, iwana, iwatsubame, sawagani, yamasemi |
| `butterfly` | 19.7 / 7.0 kB | bee, bird, butterfly, `lib/` (every garden) |
| `strider` | 14.1 / 5.3 kB | heron, leaf, strider (every garden) |
| `koi` | 15.5 / 6.2 kB | frog, koi |
| `dragonfly` | 5.0 / 2.3 kB | the Japanese garden, the waterfall |
| `swallow` | 2.9 / 1.5 kB | the Japanese garden, the oasis |
| `firefly` | 9.6 / 4.3 kB | the waterfall |
| `kajika` | 18.4 / 7.0 kB | the waterfall, and the oasis (the Sahara frog imports `sacAt`) |
| `sahara-frog` | 72.1 / 24.9 kB | bunting, dove, dropwing, Sahara frog |

Per garden: the Japanese garden needs 58 kB in 6 files, the oasis 127 kB in 6 and the waterfall
164 kB in 6. So a cold first visit to the Japanese garden loads 1,187 kB in all, 198 kB less than
before. A warm visit fetches the same files from the service worker's precache.

## Determinism
- A garden's whole set is loaded before the sim sees the garden. The roster, the schedule and every
  rng draw are what they were.
- A loaded resident from another garden is not on the roster, so it wants 0 and draws nothing.
- `regression.test.ts` checks the Japanese garden's four fingerprints (taken before ADR 0248)
  first with only its set loaded, then with all three. Both match.

## Tests
- Vitest:
  - `creatures/registry.test.ts`: each set is exactly its table's kinds with a module, the sets
    cover every module, and loading works.
  - `lazy-creatures.test.ts`: the system has no sim until its garden is loaded, an overtaken init
    is dropped, and a loaded garden inits synchronously.
  - `regression.test.ts`: as above.
- E2E `lazy-creatures.spec.ts`:
  - A first visit to the Japanese garden asks for its own creature chunk only, and the oasis's and
    the waterfall's are not loaded.
  - `showScenery('oasis')` loads the oasis's chunk, and its bunting pair and striders appear.
  - The Gardens pre-paint fetches both other gardens' chunks before any switch.
- Run: `lazy-creatures` 2/2 passed, and `fauna`, `fauna-oasis` and `fauna-waterfall` 14/14 passed,
  all unchanged. Settings: one worker, port 4191, `--timeout=300000`.
- A first try with two workers ran at a load average of 74 (other work on the machine). The oasis
  specs hit the 60 s timeout during the oasis's cold paint. They pass with one worker.

Rows for the indexes (the orchestrator merges them):

`| 148 | [Z8: Creatures per garden](148-creatures-per-garden.md) | each garden's creatures a lazy chunk, loaded before its sim starts and prefetched with the pre-paint; first-view JS 1,385 → 1,129 kB raw, 497 → 412 kB gzip |`

`| Z8.1 | Each garden's creature set is exactly its table's kinds with a module, and the sets cover every creature module | creatures/registry.test.ts |`

`| Z8.2 | The fauna system applies a garden only once its creatures are loaded; an overtaken init is dropped | lazy-creatures.test.ts |`

`| Z8.3 | The Japanese garden's fauna fingerprints are unchanged with only its set loaded and with all sets | regression.test.ts |`

`| Z8.4 | A Japanese garden visit loads only its creature chunk; a switch to the oasis loads the oasis's and its creatures appear; the pre-paint fetches the others | e2e lazy-creatures.spec.ts |`

`| 0346 | [Each garden's creatures in a lazy chunk](0346-creatures-per-garden.md) | accepted | creature sets per garden, loaded by the fauna system before it applies a garden; prefetched with the pre-paint |`

## Left open
- **Six requests per garden.** A `codeSplitting` group in `vite.config.ts` could merge a garden's
  chunks. That would mean a few duplicated creatures, or a mapping from kind to garden in the
  config. It is not worth it unless a trace shows the requests.
- **Not timed.** The creatures load after the landscape and the plants (ADR 0232), so boot paint
  times should not move. No FCP or landscape timings were taken: the machine was at a load average
  of 26.
- **Unit tests.** Under that load, two timing checks that this change does not touch failed in a
  first full `src/fauna` run: `dropwing › costs little to run` (a per-frame ms ceiling) and
  `iwana › stays at night…` (the 20 s timeout). The registry, system, regression, schedule,
  arrivals and scenery fauna tests pass.
