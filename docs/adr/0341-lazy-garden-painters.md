# ADR 0341: Each garden's painters in a lazy chunk

- Status: accepted
- Date: 2026-11-10
- Amends: ADR 0241 (the scenery contract), ADR 0282 (scenery motion), ADR 0228 and ADR 0236 (paintings and plates from the paint cache)

## Context
The app had no dynamic `import()`. Every garden's painters sat in the shared first-view chunk
(`sky-light`, 1,190 kB, preloaded by `index.html`): the oasis 116 kB, the waterfall 52 kB and
the Japanese garden's painters about 29 kB (bundle audit, phase 14). With a warm paint cache,
even the viewed garden's painters never run (ADRs 0228, 0236). The other gardens' painters run
only on a switch or in the pre-paint (ADR 0339).

## Decision
- **One painter chunk per scenery.** Each scenery's `painters.ts` holds what only paints:
  - the landscape's steps;
  - its boulder and tuft sprites;
  - its sky plates (`paint`, `paintWater`);
  - its own marks on the light plates (`shadows`, `lights`).

  Nothing imports it statically. Each scenery's `index.ts` (the Japanese garden's `art.ts`) makes
  one handle, `lazyPainters(() => import('./painters'))` (`src/scenery/painters.ts`). The handle
  has `get(): T | null` and `load(): Promise<T>`, and loads once; a failed load may be tried
  again. `Scenery.painters`, `art.painters`, `sky.painters` and `light.painters` are that same
  handle.
- **The contract keeps only data eager.** That data is:
  - `SceneArt`: the seed, the layout and the geometry;
  - `ScenerySky`: the layout, `rect` and `shape`;
  - `LightArt`: the trees, shrubs, sky layout and grades. `castPrint` and the plate keys use only
    these.

  The sprite atlas layout uses `rockBox` and `tuftBox` (`scene/sprite-boxes.ts`), so a stored
  atlas is cut up without any painter. The fauna habitat data, slots and layout stay eager.
- **Motion is its own chunk.** `Scenery.motion` becomes `() => Promise<SceneryMotion | undefined>`
  and imports `motion.ts` (the oasis) or `falls.ts` (the waterfall). The motion's sprites are not in
  the paint cache, so a visit to those gardens loads them even when warm. With their own chunk,
  that visit still skips the landscape painters.
- **When the painters load.**
  - `paintScene` awaits `load()` before its first step. That covers the landscape, the close view's
    detail, the pre-paint and the thumbnails.
  - The scene system's cache lookup asks the cache's index (`PaintCache.has`) first. If the painting
    or its sprites are missing, the load starts before the images are decoded, in parallel with
    the lookup.
  - The sky and light plates start the load on a lookup miss. A prepared phase that missed is
    painted once the painters are there.
  - A cache hit never loads anything, so the first pixels never wait for a chunk.
- **A plate drawn before its painters land.** A sync compose that needs a missing plate draws it
  without the scenery's marks: the sky empty, the light only its grade wash. That plate is neither
  kept nor stored. When the painters land, the sky and the light forget their last key, and the
  next update recomposes. The sky also asks the scene for that update at once. The light's close-up
  detail plates and the 0337 switch parts wait for the painters instead.
- **Sync paths need the painters loaded.** `paintJob`, `paintSceneSync` and `backgroundSteps` throw
  an error that names the scenery when its painters are not loaded. The studio loads every
  scenery's painters (top-level `await`) before it mounts its cards. Unit tests that paint load
  them in a `beforeAll`.
- **Stale chunks.** After a deploy, a dynamic import of an old chunk name fails through Vite's
  preload helper. That fires `vite:preloadError`, and the existing reload-once guard handles it
  (ADR 0230). When the guard prevents the error, the import resolves empty. The handle then stays
  pending (the page is reloading), and the motion is skipped. When the guard lets the error
  through (the same build again), `load()` rejects, the paint job fails as before, and a later
  paint tries again.
- **Precache.** The SW manifest already follows dynamic imports (ADR 0229), so every painter and
  motion chunk is precached and offline still paints every garden.

## Consequences
- Measured at main @ e69c708 (source-map attribution, devlog 145):
  - **First-view JS:** 1,416 kB → 1,324 kB raw (−92.5 kB), 500 → 476 kB gzip. It is now 8
    modulepreloaded files instead of 2, because the bundler splits out the modules that the eager
    graph shares with the lazy chunks.
  - **Lazy chunks:** the Japanese garden's painters +34 kB, the waterfall's +58 kB, its falls
    +26 kB, the oasis's painters +19 kB and its motion +13 kB.
  - **A warm repeat visit** to the Japanese garden requests no painter chunk (e2e
    `lazy-painters`).
- **The oasis gains less than planned.** The oasis's `paint-land`, `paint-water`, `paint-veg` and
  `paint-rocks` (about 76 kB) stay eager:
  - `oasis/wildlife.ts` (the fauna habitat data) reads shapes computed in the first three;
  - `paint-land` and `paint-water` take `EARTH` from `paint-rocks`.

  Moving those constants into a data module (owned by the paint-parts task running at the same
  time) would move them out of the first view as well.
- A cold first visit fetches one more chunk before the landscape paints. It is precached by the
  service worker, so it adds a few ms to a paint of 1–4 s.
