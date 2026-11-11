# ADR 0348: Species painters out of the main thread's first view

- Status: accepted
- Date: 2026-11-12
- Amends: ADR 0251 (a species is only added files), ADR 0110–0112 (sprites in workers), ADR 0220–0222 (the plant view and previews)

## Context
The registry imported every species eagerly (`import.meta.glob(..., { eager: true })`), so every
painter (`src/plants/species/*.ts` and `src/plants/lib/*`) was in the first-view bundle: 447 kB
raw of 1,385 kB. The garden's sprites and the planting sheet's previews are painted in workers,
so the main thread mostly needs a species' metadata (tier, size, habitats, range, colours, names).
It still paints on its own thread in a few places: `renderPlantView` (the widget, PiP, session
rows) paints a missing step now, the herbarium's pressed previews, the fallbacks of
`renderPlantPreview`, and the sprite cache's idle fallback without workers.

## Decision
- **Metadata is extracted at build time.** The main-thread registry imports `species/<id>.ts?meta`.
  The `sprout:species-meta` plugin (`src/build/species-meta.ts`) answers in a production build
  with the definition minus `draw`, as JSON: it bundles every species with esbuild once and runs
  it in Node. The dev server and Vitest re-export the full module, so nothing is lazy there.
  Species files are unchanged and a new species is still only added files.
- **The painter loads per species.** A definition without `draw` becomes a lazy species
  (`src/plants/painter.ts`): its `draw` runs the full module's once `loadPainter(def)` has
  imported it (one chunk per species, shared lib chunks), and throws before that.
  `painterReady(def)` is always true for full definitions (workers, tests, `?fixtures`).
- **The worker imports every species eagerly** (`src/plants/painters.ts`), not the registry.
- **Main-thread paints wait or hand over to the worker:**
  - the sprite cache's idle fallback (no workers, or a sprite the worker could not paint) loads
    the painter first and keeps the job queued meanwhile;
  - `ensureSync` queues the sprite in the worker at `now` instead; `renderPlantView` then returns
    false (the widget draws its sprout fallback for those frames) and draws once it lands;
  - previews (`get`, `renderPlantPreview`) return nothing and cache nothing until it has loaded;
    `whenReady` awaits it.
- **Preloading, so those paths stay identical in practice.** main.ts loads the painters of the
  species the in-progress sessions and the pressed flowers show, during the first paint, and
  awaits them before the plants and the UI are made; a store subscriber loads them for every new
  session or pressed flower. The studio loads every painter before it mounts (as ADR 0341). The
  dev parity probe loads its species first.

## Consequences
- First-view JS (main @ 432bc95, production build, source-map attribution, devlog 150):
  1,385 kB → 970 kB raw (−415 kB), 497 → 348 kB gzip, 8 → 12 modulepreloaded files. The 21 kB of
  species code left is the metadata JSON.
- A first visit requests no species chunk on the main thread (e2e `lazy-species-painters`);
  starting a session requests that species' chunk only.
- Every field of a `SpeciesDef` but `draw` must survive `JSON` (no functions, `undefined`,
  `Infinity`); `registry.test.ts` checks it for every species.
- A sync view of a species whose painter has not landed (a session started from the dev API,
  a chunk that failed) shows nothing for a frame or two, then the worker's sprite. A session row
  waiting at a fixed growth repaints only when its key changes, so it relies on the preload.
- The paint version (ADR 0227) is unchanged: the painted pixels are the same.
