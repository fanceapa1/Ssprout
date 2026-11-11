# 149 · Z25: Oasis shape data out of the painters

Phase 14, optimisation pass. Follows devlog 145 › Left open. No ADR: it applies ADR 0341's rule
(only data stays eager) to the oasis.

## What
- **`src/scenery/oasis/shapes.ts`, data only.** The shapes that eager code reads moved out of the
  painters, unchanged:
  - from `paint-land.ts`: `copingLine`, `WALL_FACES`, `FALLEN_STONES`, `NEAR_STONES`;
  - from `paint-water.ts`: `BASIN_STEPS`, `SLUICE_GATE` and their helpers;
  - from `paint-veg.ts`: `PalmFrond`, `PalmShape`, `planPalm` with `trunkPath` and
    `crownOutline`, `BIG_PALM_SHAPES`, `GROVE_PALMS`.
- **Importers.** `wildlife.ts`, `light.ts`, `motion.ts` and the painters import them from
  `shapes.ts`, and so do the tests (`wildlife`, `land`, `water`, `motion`, `veg`). The painters do
  not re-export them, so eager code cannot reach a painter through an old import path by accident.
- **`EARTH`** stays in `paint-rocks.ts`. Only `paint-land` and `paint-water` read it, and they are
  lazy now.
- **Test.** `lazy-painters.spec.ts` now also reads the source map of every script that a Japanese
  garden visit requests. Neither the first visit nor the warm repeat visit may hold an oasis
  `paint-*`, `painters`, `ksar-batch`, `sky`, `light` or `motion` module. On the old code this
  check fails: it lists `paint-rocks`, `paint-water`, `paint-land`, `paint-veg`, `paint-batch`,
  `paint-pace` and `ksar-batch`.

`src/main.ts` is unchanged.

## Numbers (main @ 2feaea1, production build)
First view is everything `index.html` reaches statically, as in devlogs 145 and 148. Gzip is level 9
per file.

| | before | after |
|---|---|---|
| First-view JS | 1,132.8 kB raw / 413.1 kB gzip, 11 files | 1,051.6 kB raw / 386.4 kB gzip, 11 files |
| Oasis code in it (source-map attribution) | 105.0 kB | 24.3 kB |

The first view is 81.2 kB raw (26.7 kB gzip) lighter, above the 76 kB target.

**Files.**
- Before: `main` 226.7, `slots` 44.3, `viewport` 2.5, `sky-layout` 4.9, `targets` 6.8,
  `paint-water` 67.3, `oasis` 42.7, `sprite-boxes` 0.2, `sprite` 3.4, `geometry` 6.1,
  `sky-light` 727.9 kB.
- After: the same, except that `paint-water` (67.3) and `oasis` (42.7) became `shapes` 18.9 and
  `oasis` 9.8 kB.

The new `shapes` chunk holds `shapes.ts`, `layout.ts`, `ksar.ts`, `slots.ts` and the oasis's
`geometry.ts`. These modules were in the eager `paint-water` chunk before. The bundler picks the
chunk names.

**The oasis's lazy chunks** (raw / gzip):

| chunk | size | holds |
|---|---|---|
| `paint-water` | 54.7 / 18.1 kB | `paint-rocks`, `paint-water`, `ksar-batch`, `paint-pace` (shared with the motion) |
| `painters` | 32.2 / 11.8 kB | `painters`, `paint-land`, `paint-veg`, `paint-batch`, `light` |
| `sky` | 5.4 / 2.2 kB | `sky.ts` |
| `motion` | 12.7 / 5.1 kB | `motion.ts` |

A Japanese garden visit, first or warm, loads none of them. A switch to the oasis or its pre-paint
loads them, as it already loaded its `painters` and `motion` chunks.

## Pixels and determinism
- The code moved without changes. `planPalm` draws from the same seeded rngs in the same order
  (`oasis-big-palm-<i>`, `oasis-grove-palms`), so every shape is the same.
- The oasis unit tests pass with no pin touched, the recording hashes of the land, water,
  vegetation and rock included (11 files, 147 tests).
- The paint version (ADR 0227) hashes the sources, and moving the code changed them. After the
  deploy, each visitor repaints once, as after any paint-code change.

## Tests
- Vitest: `npx vitest run src/scenery/oasis`, 147/147 passed (one worker).
- E2E: `lazy-painters.spec.ts` 1/1 passed (one worker, port 4191). It failed as expected against
  the old oasis code.
- `npm run typecheck` and `npm run build` pass.

Rows for the indexes (the orchestrator merges them):

`| 149 | [Z25: Oasis shape data out of the painters](149-oasis-shape-data.md) | the oasis's shared shapes in a data module (shapes.ts), so its paint code is only in lazy chunks; first-view JS 1,133 → 1,052 kB raw, 413 → 386 kB gzip |`

`| Z25.1 | A Japanese garden visit, first or warm, requests none of the oasis's paint code (source maps of every requested script) | e2e lazy-painters.spec.ts |`

## Left open
- **Not timed.** Only the bytes were measured: no FCP or landscape timings were taken. The
  bytes left the first view of every garden, and the oasis's own visit loads them as before.
- The first view's large chunk is still `sky-light` (728 kB). The species painters (P16f) are the
  largest share left in it (devlog 145).
