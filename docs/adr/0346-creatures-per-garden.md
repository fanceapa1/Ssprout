# ADR 0346: Each garden's creatures in a lazy chunk

- Status: accepted
- Date: 2026-11-12
- Amends: ADR 0248 (the creature registry), ADR 0243 (the fauna system follows the scenery)

## Context
The creature registry globbed every `creatures/*.ts` eagerly, so all creatures (about 250 kB of
minified code, the three oasis creatures included) sat in the shared first-view chunk. A garden
shows only the creatures of its own table, and the fauna system starts after the landscape and the
plants (ADR 0232). P16a (ADR 0234) asked for lazy chunks for what is not visible; ADR 0341 did it for
the painters.

## Decision
- **One creature set per garden.** `src/fauna/creatures/sets/creatures-<scenery id>.ts` imports the
  creatures of that garden's table that have a module and default-exports their defs. The registry
  globs the sets lazily (`import.meta.glob('./sets/creatures-*.ts')`), so each set is a dynamic
  import. Nothing else imports a creature module from the app's eager graph. The bundler puts
  creatures shared by several gardens in shared chunks; each garden's own creatures are in the
  chunk named after its set.
- **The registry answers from what is loaded.** `creatureDef`, `creatureDefs` and `creatureKinds`
  only know the sets loaded so far. `loadCreatures(id)` loads one garden's set (once; a failed load
  may be tried again; a garden without a set has none), `creaturesLoaded(id)`, `loadAllCreatures()`.
  The handle is ADR 0341's `lazyPainters`, so a load that resolves empty during the stale-chunk
  reload (ADR 0230) stays pending.
- **The fauna system waits for the garden on view.** `init` loads that garden's set first (without
  a scenery, the Japanese garden's) and only then applies the garden. Before that the system has no
  sim, or keeps the previous garden's sim running under the switch's cover. An init overtaken by a
  later one is dropped. When the set is already loaded, `init` stays synchronous. The renderer awaits
  `init`, so `sprout.ready()` and `showScenery` resolve with the creatures there.
- **Determinism.** Every kind a garden's rows bring is loaded before the sim sees that garden, so
  the roster, the schedule and the rng draws are the ones they were. Resident upkeep walks the loaded
  residents by `rank` and kind, never by load order. A loaded resident that is not on the roster
  wants 0 and draws nothing. The sim's seed is taken when `init` is called, not when the set lands.
- **Prefetch.** The Gardens section's pre-paint (ADR 0339) also fetches that garden's creatures
  (`prefetchCreatures`, `src/main.ts`). Nothing else prefetches.
- **The studio and the tests load every set.** `fauna.studio.ts` awaits `loadAllCreatures()` at top
  level, and unit tests that need the registry do the same. Tests that import a creature module
  directly are unchanged. `sprout.fauna.kinds()` lists the loaded kinds, and
  `sprout.fauna.loadAll()` loads the others.
- **Adding a creature** now also adds one line to its gardens' sets. The registry test checks that
  each set is exactly its table's kinds with a module, and that the sets cover every module.

## Consequences
- Measured in devlog 148: first-view JS 1,385 → 1,129 kB raw (−256 kB), 497 → 412 kB gzip. A
  Japanese garden visit then loads 58 kB of creatures in 6 small chunks; the oasis's need 127 kB,
  the waterfall's 164 kB. Creatures shared by several gardens are fetched once.
- The fauna system starts a chunk fetch later on a cold first visit. That is one small request,
  precached by the service worker (ADR 0229), so offline still has every garden's creatures.
- A switch to a garden whose creatures are not loaded yet waits for the set, alongside the
  landscape paint.
