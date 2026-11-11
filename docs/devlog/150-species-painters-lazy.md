# 150 · Z9: Species painters out of the first view

Phase 14, optimisation pass (P16f). ADR 0348.

## Spike (about 25 minutes)
- **What pulled the painters in:** only the registry's eager `import.meta.glob`. Nothing else on the
  main thread imports a species or a `plants/lib` module (the studios do, but they are another entry).
  `sprites.ts`, `view.ts` and `previews.ts` reach the painters only through `def.draw`.
- **Measured** (main @ 432bc95, source-map attribution of every file `index.html` loads):
  `plants/species` 276 kB + `plants/lib` 171 kB = 447 kB raw of the 1,385 kB first view.
- **Main-thread paints that need a painter now** (all synchronous):
  - `renderPlantView` → `ensureSync` (the widget, PiP, the session rows, the plant section's inline
    path, the preview fallback);
  - the herbarium's pressed previews (`previews.get`, `def.draw` directly);
  - `renderPlantPreview` (fallbacks);
  - the sprite cache's idle fallback (no workers, or `unknown` from the worker).
- **Designs weighed:**
  - Splitting each species file into metadata and painter: 54 files rewritten, the recipe and every
    species test changed, conflicts with the queued sprite tasks (Z10–Z12). Rejected.
  - Stripping `draw` with a transform and trusting tree-shaking: top-level pigment maths
    (`mix(...)`) keeps code alive. Unreliable.
  - **Chosen:** extract the metadata at build time (esbuild bundles the species, Node runs them,
    the definition minus `draw` becomes JSON for `<id>.ts?meta`). Painters load per species on the
    main thread on demand. Species files stay as they are.
  - The sync paths keep their behaviour through preloading (below). A load on idle after boot would
    have been simpler, but every visit would then fetch and compile the 447 kB again.

## What
- `src/build/species-meta.ts`: the `sprout:species-meta` plugin (registered in `vite.config.ts`) and
  `speciesMeta(def)`. In the dev server and Vitest `?meta` re-exports the full module, so
  nothing is lazy there and tests are unchanged.
- `src/plants/registry.ts`: metadata eagerly, painters per species (`import.meta.glob` lazy).
  `fromMeta` wraps a draw-less definition with `lazySpecies`. New `loadPainters(ids)` and
  `loadAllPainters()`. `buildRegistry` moved to `build-registry.ts` (re-exported).
- `src/plants/painter.ts`: `lazySpecies`, `painterReady`, `loadPainter` (once; a failure resolves
  false and is retried later).
- `src/plants/painters.ts`: every species eagerly, the sprite worker's registry
  (`sprite-worker.ts` uses it).
- `src/plants/sprites.ts`:
  - main-thread jobs wait for their painter (they stay queued while it loads);
  - `ensureSync` queues the sprite in the worker at `now` when the painter is not there.
- `src/plants/view.ts` (one condition): a step `ensureSync` queued is reported missing, so
  `renderPlantView` returns false instead of drawing an empty ground.
- `src/ui/previews.ts`: `get` and `renderPlantPreview` paint nothing and cache nothing until the
  painter has loaded; `whenReady` awaits it.
- **Outside the owned paths, a line or two each:**
  - `src/main.ts`: loads the painters of in-progress sessions' and pressed flowers' species during
    the first paint, awaits them before the plants and UI are made, and loads new ones on every
    state change (4 lines).
  - `src/studio/main.ts`: `loadAllPainters()` with the gardens' painters.
  - `src/plants/debug.ts`: the view parity probe loads its species first.

## Numbers (production build, `index.html`'s script + modulepreloads)
| | before | after |
|---|---|---|
| First-view JS | 1,385 kB raw / 497 kB gzip, 8 files | 970 kB raw / 348 kB gzip, 12 files |
| `plants/species` + `plants/lib` in it | 447 kB | 21 kB (the metadata JSON) |
| A species' painter chunk | in the shared chunk | lazy, e.g. anemone 3.9 kB, plus shared lib chunks (`small-paint`, `shrub-paint`, `tree-paint`, …) |

Files after: `main`, `recipes`, `paint`, `slots`, `viewport`, `sky-layout`, `paint-water`,
`palm-paint`, `oasis`, `sprite-boxes`, `geometry`, `sky-light` (572 kB, was 988 kB). The four new
small files are modules the eager graph now shares with the lazy species chunks. The sprite worker
still bundles every species (502 kB).

## Tests
- Unit: `painter.test.ts` (new), `registry.test.ts` (`fromMeta`, every species' metadata survives
  JSON, the worker registry has every painter), `sprites.test.ts` (a main-thread job waits for its
  painter; `ensureSync` hands over to the queue). Also ran `previews`, `view`, `view-prewarm`,
  `anemone`, `katsura`.
- E2E `lazy-species-painters` (new): a first visit requests no species chunk. A started session
  requests its own species' chunk and no other, and its main-thread paint matches the worker's.
  Also ran `planting-previews` and `widget` (all pass).

## Left open
- **Race windows.** A sync view of a species whose painter has not landed hands over to the
  worker: a session started through the dev API, or a failed chunk.
  - The widget shows its sprout fallback for a frame or two.
  - A waiting session row (fixed growth) repaints only when its key changes, so it relies on the
    boot preload. Not seen in the specs run.
- **Dev fixtures in the first view.** `src/dev/fixture-species` (19 kB) is still there, through
  main.ts's static `withFixtures` import. It could load only with `?fixtures`.
- Not run, per the CPU rules: the studio, plants, ui-session, gardens and v2 specs, and the full
  suites.

## Index rows
`| 150 | [Z9: Species painters out of the first view](150-species-painters-lazy.md) | species metadata extracted at build time, painters per species on demand; first view 1,385 → 970 kB raw (497 → 348 kB gzip) |`

TESTING rows:
`| Z9.1 | Species metadata survives the build's JSON extraction; a lazy species loads its painter once, retries a failure; main-thread sprite jobs wait for it, ensureSync hands over to the worker | unit: src/plants/registry.test.ts, src/plants/painter.test.ts, src/plants/sprites.test.ts |`
`| Z9.2 | A first visit requests no species painter chunk on the main thread; a started session loads only its own, and its main-thread paint matches the worker's | e2e: tests/e2e/lazy-species-painters.spec.ts |`

ADR index row:
`| [0348](0348-species-painters-lazy.md) | Species painters out of the main thread's first view | accepted | metadata extracted at build time for the main thread; each species' painter a lazy chunk, preloaded for sessions and pressed flowers |`
