# 60 — S2: the scenery contract, the Japanese garden behind it

Phase 10 adds a rocky waterfall. This task makes that possible without changing a pixel: one
`Scenery` contract, the Japanese garden as its first instance, and the systems reading their
data from it instead of module constants. Runtime switching is S3.

## What
- **`src/scenery/`** (new):
  - `ids.ts`: `SCENERY_IDS = ['japanese-garden', 'waterfall']`, `SceneryId`, `DEFAULT_SCENERY`,
    `isSceneryId`. **S1 owns `src/core/sceneries.ts`** and can re-export or move these; nothing
    in `core/` imports them yet.
  - `types.ts`: `Scenery`, `ScenerySky`, `SceneryAmbience`, `SceneryView`.
  - `registry.ts`: `getScenery(id)` (falls back to the default), `hasScenery`, `sceneries(flags?)`.
  - `japanese-garden/`: `index.ts` (`JAPANESE_GARDEN`), `sky.ts`, `light.ts`, `ambience.ts`, `view.ts`.
- **`SceneGeometry`** (`src/scene/geometry.ts`): `pavilion` gives way to `structure`, `lights`
  and `eave`; `streams` and `falls` are new. `gardenScene` keeps every number (the eave is the
  literal `pavilionFrame` gives: a test holds them together); `pavilionOf(scene)` rebuilds the
  engawa for its painters. `main.ts` is untouched.
- **Consumers now read the scenery** (default: the Japanese garden):
  - background: `SceneArt` gains `scenery` and `steps`; `backgroundSteps(art) = art.steps(art)`;
    the garden's list is `gardenSteps`, unchanged;
  - sky plates: `createSkyLight({ sky, scenery })` (rect, shape, painters, layout);
  - sun, moon, stars: `sunDisc`/`moonDisc`/`stars` take a `SkyLayout` (`HORIZON_Y` and friends
    are gone from `sky-layout.ts`);
  - light plates: `LightArt` gains `sky` and two hooks, `shadows` and `lights`; the engawa's
    shadow and lamp-lit shoji moved from `cast.ts` to `scenery/japanese-garden/light.ts`;
  - the lantern: the grade wash's reserve, the warm pool and the flame loop over `scene.lights`
    (`LIGHT.lanternR` became the light's `r`);
  - eave drips from `scene.eave` (`eaveOf` is gone); dew boxes, dawn mist bands and the veil from
    `SceneryAmbience` (`LOOK.dawnMistBands` is gone);
  - `DEFAULT_FOCUS` is the default scenery's `view.focus`; the wayfinding takes `pathOut()`; the
    watering can avoids `structure`.
- **Cache keys** (ADR 0242): all four kinds start with the scenery id; `src/scenery` is in
  `PAINT_ROOTS`.
- **Outside the listed paths, the minimum to compile and keep studios identical:**
  `src/ambience/system.ts` forwards a `scenery` option (2 lines); `src/scene/paint-pavilion.ts`
  takes the `Pavilion` type; `src/fauna/stage.ts` and `src/plants/system.test.ts` build the new
  geometry fields; `src/scene/daylight.studio.ts` and `camera-detail.studio.ts` use
  `GARDEN_LIGHT_ART` (so their plates keep the engawa marks); `ambience.studio.ts` reads the
  structure and the lantern light.

## Why / decisions
ADR 0241 (the contract, and where it departs from the S0 proposal: `ScenerySky` as one object,
light hooks instead of `paintExtras` with grades, no fields without a consumer yet, the garden's
painters left in `src/scene/`). ADR 0242 (keys).

## Still reading Japanese-garden constants directly
- `src/main.ts` uses `gardenScene` and the renderer's default focus: S3 passes the scenery.
- `src/scene/system.ts` defaults to `GARDEN_ART` and creates the sky light without a `sky`
  option (the garden's by default): S3 passes `scenery.art` / `scenery.sky`.
- `addAmbience` defaults to `JAPANESE_GARDEN`; `createAmbience` without a scenery uses the
  garden's ambience numbers and engawa marks (the ambience studio relies on this).
- `src/ambience/dev.ts`, `scene/camera-detail.studio.ts` and other callers of `sunDisc`/`moonDisc`
  use the default sky layout.
- Fauna (pond info, perches, heron, perspective), audio (`core/soundscape.ts` with its own
  `SceneryId`), habitat words and the UI copy: out of scope (S11, S15, S5).
- `PHASE_GRADES.lantern` stays global: the grade is daylight, and a scenery without lights simply
  has nothing to reserve.

## Tests
- New `src/scenery/registry.test.ts`; new cases in `scene/geometry.test.ts` (eave against the
  frame; streams, falls, lights) and `ambience/lighting.test.ts` (no lights, no reserve); key
  tests updated in `scene/scene-cache.test.ts` and `ambience/plate-cache.test.ts`.
- **Recording-canvas hash pins unchanged**: `scene/paint-slices.test.ts` and `paint/parts.test.ts`
  pass untouched (L1 is rewriting them for cross-platform pins; rebase onto L1 before merging).
- **Full frames**: a scratch Playwright script loaded the production build before and after the
  change (Date pinned to 2026-10-20 10:00, reduced motion so the water is still, fauna cleared,
  `sprout.setTime`, `camera.overview`/`glideTo` + `settle`, `settleAmbience`, `freeze`) and
  hashed every canvas's `toDataURL`. 12 frames × 3 canvases: midday, sunset and night overviews,
  midday and night close-ups of the engawa and lantern (zoom 3 at 1350,330), a sunrise close-up of
  the path (zoom 2.5 at 760,820), at 1440×900 and 390×844. **Diff 0 on every pixel**; the
  baseline was taken twice first to prove the capture deterministic.
- E2E on the fresh build: `scene-cache`, `plates-cache`, `daylight`, `ambience`, `scene`,
  `camera`, `wayfinding`: 55 passed.
- Final full run (load < 8 before it): typecheck clean; 132 unit files, 1571 tests passed; e2e
  262 of 263 passed. The one failure, `ui-session › completion: … its label shows on hover`, timed
  out tearing down its context with a truncated trace zip. Alone it passed with its whole spec
  (9 of 9). It touches nothing this task changed.

## Left open
- S1: move `ids.ts` into `src/core/sceneries.ts` (or re-export it) and reconcile it with
  `core/soundscape.ts`'s audio `SceneryId` (`pond`, `coast`).
- S3: `SystemContext.scenery`, pass `scenery.art`/`scenery.sky` to the scene system,
  `scenery.view.focus` to the renderer and `pathOut` to the wayfinding.
- Later tasks add `fauna`, `sound`, `habitatWords`, `thumbnail` and `surface` to the contract.
- The Japanese garden's painters could move from `src/scene/` into
  `src/scenery/japanese-garden/` once the waterfall's own folder settles the layout; not needed.
- No studio entry added: the contract adds nothing drawable.
