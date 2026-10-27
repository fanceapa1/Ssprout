# Scenery

`src/scenery/` — a scenery is one place to grow a garden: the Japanese garden today, a rocky
waterfall next (phase 10). The contract (ADR 0241) lets every system take its data from the
current scenery instead of module constants. Only plants belong to a scenery; the timeline, the
weather and the daylight are shared (owner decisions, phase 10).

## Files
| File | What |
|---|---|
| `ids.ts` | `SCENERY_IDS` (`japanese-garden`, `waterfall`), `SceneryId`, `DEFAULT_SCENERY`, `isSceneryId`. Pure. The schema task S1 moves or re-exports them from `src/core/sceneries.ts` |
| `types.ts` | the `Scenery` contract and its parts: `ScenerySky`, `SceneryAmbience`, `SceneryView` |
| `registry.ts` | `getScenery(id)` (the default for an id not registered yet), `hasScenery(id)`, `sceneries(flags?)` (available ones, in `order`) |
| `japanese-garden/index.ts` | `JAPANESE_GARDEN`: gathers the garden's geometry, painting, sky, light art, ambience numbers and view |
| `japanese-garden/sky.ts` | `GARDEN_SKY_LAYOUT`: horizon y 368, sun x 966 rising / 556 setting, the moon's arc, where stars may be |
| `japanese-garden/light.ts` | `GARDEN_LIGHT_ART` (trees, shrubs, sky) and `ENGAWA_LIGHT`, the engawa's own light marks (its cast shadow, the lamp-lit shoji) |
| `japanese-garden/ambience.ts` | `GARDEN_AMBIENCE`: dew boxes on the near banks, dawn mist bands 1–3, the veil to y 592 |
| `japanese-garden/view.ts` | `GARDEN_VIEW`: focus (800, 560), the stepping stones' near edges for the guiding path |
| `registry.test.ts` | ids, registry, each scenery consistent with itself, the garden's numbers, `PAINT_ROOTS` |

The Japanese garden's painters stay in `src/scene/` (docs/systems/scene.md): its geometry
(`gardenScene`), its painting (`GARDEN_ART`, `gardenSteps`) and its sky (`GARDEN_SKY`).

## The contract
```ts
interface Scenery {
  id: SceneryId; name: string; blurb: string; order: number;
  available(flags: URLSearchParams): boolean;   // a scenery in progress hides behind a dev flag
  geometry: SceneGeometry;                      // pond, waterline, streams, falls, rocks, path, structure, lights, eave, slots, skyBand
  art: SceneArt;                                // scenery id, seed, painting layout, steps(art, only?); art.scene === geometry
  sky: ScenerySky;                              // layout: SkyLayout; rect; shape(below?); paint(p, rng, phase); paintWater(p, rng, phase, box)
  light: LightArt;                              // trees, shrubs, sky?, shadows?(p, rng, scene, shadow, pigment), lights?(p, rng, scene, phase)
  ambience: SceneryAmbience;                    // dew: Rect[]; mistBands: number[]; veilTo: number
  view: SceneryView;                            // focus: Pt; pathOut: Pt[] (nearest first)
}
```
A scenery is consistent with itself: `art.scenery === id`, `art.scene === geometry`,
`light.sky === sky.layout` (`registry.test.ts` checks every registered one).

**Left out for now**, with the task whose consumer sets its shape: `fauna` (unlocks, roster,
perspective; S11), `sound` (S15; note `core/soundscape.ts` has its own audio `SceneryId`, `pond`
and `coast`), `habitatWords` and `thumbnail` (S5), `surface` (the per-frame water animator; S9).

## Who reads what
Each consumer takes the scenery's part as an option and defaults to the Japanese garden's, so
`main.ts` is unchanged and runtime switching (S3) only has to pass the current scenery down.

| Consumer | Reads | Option |
|---|---|---|
| background (`scene/background.ts`) | `art.steps`; `art.scenery` in `paintingKey`/`spritesKey` | the `SceneArt` (`createSceneSystem({ art })`) |
| sky light (`scene/sky-light.ts`) | `sky.rect`, `sky.shape`, `sky.paint`, `sky.paintWater`, `sky.layout`; the id in `skyPlateKey` | `createSkyLight({ sky, scenery })` |
| sun, moon, stars (`ambience/sky-layout.ts`) | `SkyLayout` | `sunDisc(s, sky)`, `moonDisc(s, sky)`, `stars(n, seed, sky)` |
| light plates (`ambience/cast.ts`) | `light` (trees, shrubs, sky, hooks), `geometry.lights`; the id in `lightPlateKey` | `createCastLight(scene, light, seed, { scenery })` |
| grade wash (`ambience/lighting.ts`) | `geometry.lights` (reserve radius `r`), `geometry.structure` (water hidden under it) | the geometry |
| ambience (`ambience/ambience.ts`) | `light`, `ambience` (dew, mist bands, veil), `geometry.eave`, `geometry.lights` (flame) | `createAmbience({ scenery })`, `addAmbience(renderer, { scenery })` |
| viewport (`render/viewport.ts`) | `view.focus` | `DEFAULT_FOCUS`; the renderer's `focus` option |
| wayfinding (`ui/wayfinding.ts`) | `view.pathOut` | `createWayfinding({ pathOut })` |
| watering can (`plants/system.ts`) | `geometry.structure` | the geometry |

## Paint cache (ADR 0242)
Every key starts with the scenery id: `japanese-garden|s7|normal|0,0,1600,1000@1.5|2400x1500`
(`scene`, `scene-detail`), `japanese-garden|s7|normal@1.5` (`scene-sprites`),
`japanese-garden|s7|midday|…` (`sky-plate`), `japanese-garden|ambience-cast|sunset|…` (`light-plate`).
`src/scenery` is one of `PAINT_ROOTS`.

## Adding a scenery (S4 onwards)
1. A folder `src/scenery/<id>/` with its geometry, painting (`SceneArt` with its own `steps`),
   `ScenerySky`, `LightArt`, `SceneryAmbience` and `SceneryView`, gathered in `index.ts`.
2. Register it in `registry.ts`; keep `available` false behind a dev flag until it is done.
3. Studio entries for everything it paints (`*.studio.ts`).
4. Nothing else changes: the consumers above already read the scenery.

## Tests
- `src/scenery/registry.test.ts`: ids, the registry and its fallback, self-consistency, the
  Japanese garden's focus, path and ambience numbers, `PAINT_ROOTS`.
- `src/scene/geometry.test.ts`: the eave matches the engawa's frame; no streams, no falls, one
  lantern; `pavilionOf`.
- `src/scene/scene-cache.test.ts`, `src/ambience/plate-cache.test.ts`: keys carry the scenery.
- `src/ambience/lighting.test.ts`: the reserve follows `lights`; none without lights.
- Pixel identity: the recording-canvas hash pins (`paint-slices.test.ts`, `parts.test.ts`) and the
  `scene-cache`, `plates-cache`, `daylight`, `ambience`, `scene`, `camera` and `wayfinding` e2e specs.
