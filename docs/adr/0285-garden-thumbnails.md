# ADR 0285: Garden thumbnails from the overview, not the camera

- Status: accepted
- Date: 2026-11-03
- Amends: ADR 0244 (the Gardens section's thumbnails)
- Builds on: ADR 0227 and 0242 (the paint cache and its keys), ADR 0161 (the overview), ADR 0226 (cooperative painting)

## Context
Since ADR 0244 a Gardens card showed a still of the stage canvas, cover-cropped. The still was
taken after the garden's first paint and again just before you left it. The shots for S5b showed
three problems:
- The still showed whatever the camera framed. On a phone the camera glides onto the seedling, so
  the card showed a zoomed fragment (a piece of pond, a corner of the cliff).
- A still taken at the first paint could catch the painting while it was still fading in from paper
  (desktop: sky and hills only, the land empty).
- A garden you had not visited showed a pale wash. Since S17 everyone has both gardens, so every
  visitor saw that wash.

The renderer already holds what a thumbnail needs. The scene's overview painting comes from the
paint cache or is painted fresh. The sky composite, the plants' sprites and the paper are drawn
over it.

## Decision
- **A renderer hook.** `renderer.drawOverview(target): boolean` draws the garden on view into
  `target` at a world-fitted viewport (cover, `createViewport(target.width, target.height, 1,
  focus)`): the whole 1600×1000 world for the cards' 8:5 thumbnails. It draws the `background`,
  `underwater` and `waterSurface` layers, then the entities (boulders, tufts, plants, creatures),
  on white. The stage's paper cache is cover-cropped and multiplied last. The camera, the air, the
  ambience and the light plate are left out, because the light plate and some fauna draws work in
  screen space. It returns false before the renderer is sized, while a switch covers the stage, or
  while a system is not ready.
- **Sources, best first** (`src/scenery/thumbnail.ts`, `createThumbnails`). A late answer never
  replaces a better source (`THUMB_RANK`, `replaces`).
  1. `live`: the garden on view through `drawOverview`. It is taken 1.5 s after the garden is
     ready (the first painting fades in over 1.2 s) and after its plants change, both in idle
     time. It is taken again just before a card switches gardens. A garden you leave keeps its last
     live thumbnail for the rest of the visit.
  2. `stored`: the paint cache, kind `scenery-thumb`, key `<scenery>|<w>x<h>` (ADR 0242: the
     scenery first). Every live or painted thumbnail is put there, so a reload shows a garden as
     last seen without visiting it. This kind is the one cache entry that is not a pure function
     of code and seed (it holds plants and the hour's sky). Each take replaces it, and the paint
     version drops it like any other entry.
  3. `painted`: a garden with neither, never the one on view. `paintThumbnail(art, w, h, yieldTo)`
     paints its painting at the thumbnail's scale (`draft`, through the cooperative `paintScene`
     in 10 ms slices, each followed by an idle callback with a 60 ms timeout). It adds the boulders
     and tufts and multiplies the paper. It paints no sky plate: one plate is a single task of
     about 200 ms, so a sky that is all plate (the waterfall's) stays paper. This fill starts only
     when the cards come within 400 px of the window.
  4. `waiting`: the pale wash, as before.
- The canvas holds 224×140 CSS px at the device pixel ratio, capped at 2× (448×280). The card shows
  it at about 205 px wide on a desktop and 112 px on a phone, so it is never upscaled.
  `[data-still]` on the canvas names the source.
- `UIDeps.drawOverview?(target)` and `UIDeps.paintOverview?(id, w, h, yieldTo)` carry the two
  painters into the UI. In `main.ts`, `drawOverview` is `renderer.drawOverview`, refused until the
  scene's painting covers the whole world (`sceneSystem.detailStats().world`). A phone first paints
  only its strip and extends it about 1.5 s later, so a take before then would show paper sides.
  `paintOverview` is `paintThumbnail(pickScenery(id).art, …)`.
- A take that is refused is tried again every 400 ms, at most 75 times. A garden left before its
  first live take is painted small like one never seen.
  The section reads and writes the paint cache itself (`paintCache()`).

## Not taken
The scene's own `scene` cache entry is not read directly for a garden not on view. Its key
depends on the stage's paint view, and it is the painting alone: no sky plate (the waterfall's sky
would be blank), no boulder sprites (they are a separate atlas) and no paper. Rebuilding the
scene's draw from three entries would duplicate the scene system. The live overview gives the
same pixels, drawn by the scene itself, and is stored as `scenery-thumb`.

## Consequences
- The thumbnails are consistent: always the whole garden, sharp, the way the stage looks at the
  overview, with plants. On a phone they no longer show the camera's crop.
- A first visit paints the garden not on view once, small: about 0.5–0.9 s of main-thread work in
  slices, none over 50 ms. A production build stores the result. On the dev server and in Vitest
  the cache is off, so the small paint runs on every load (only once the cards near the window).
- The sky follows the hour. At night the live thumbnail's sky is the night sky while the land
  keeps its daylight colours, because the light plate is not drawn.
- Tests: `scenery/thumbnail.test.ts` (sources, ranks, cache key), `render/renderer.test.ts`
  (`drawOverview`), e2e `gardens.spec.ts` (live thumbnails after a switch). Studio
  `garden-thumbnails/thumb-*`.
