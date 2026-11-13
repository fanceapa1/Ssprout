# Scenery

`src/scenery/` — a scenery is one place to grow a garden: the Japanese garden (the default) and the
rocky waterfall, both offered to everyone since S17 (SPEC §1a). The contract (ADR 0241) lets every
system take its data from the current scenery instead of module constants. Plants, spots and
wildlife progress belong to a scenery; the timeline, the weather and the daylight clock are shared
(owner decisions, phase 10).

## Files
| File | What |
|---|---|
| `ids.ts` | re-exports `SCENERY_IDS` (`japanese-garden`, `waterfall`, `oasis`, `coast`), `SceneryId`, `DEFAULT_SCENERY`, `isSceneryId` from `src/core/sceneries.ts`, where core keys plants, sessions and slots by them (ADR 0240; docs/systems/core.md › Gardens) |
| `types.ts` | the `Scenery` contract and its parts: `ScenerySky`, `SceneryAmbience`, `SceneryView`, `SceneryMotion` (and `SceneryFauna` from `src/fauna/habitat.ts`) |
| `fauna.ts` | `faunaTable(id)`: every scenery's unlock table without loading its painting (the quiet line's arrival lines) |
| `japanese-garden/fauna.ts` | `JAPANESE_FAUNA`: the garden's unlock table (SPEC §4, ADR 0248) |
| `registry.ts` | `getScenery(id)` (the default for an id not registered yet), `hasScenery(id)`, `sceneries(flags?)` (available ones, in `order`: the garden, the waterfall and the oasis without any flag (the oasis was behind `?dev&scenery=oasis` until O8, devlog 140); the coast only with `?dev&scenery=coast` (phase 15)) |
| `host.ts` | `createSceneryHost({ store, renderer, getScenery })`: follows `state.scenery` and calls `renderer.setScenery` (see Switching) |
| `host.test.ts` | the host follows the store; a session from another garden brings its garden into view first |
| `japanese-garden/fauna.test.ts` | the garden's table is SPEC §4's plus the silent leaf |
| `japanese-garden/index.ts` | `JAPANESE_GARDEN`: gathers the garden's geometry, painting, sky, light art, ambience numbers and view |
| `japanese-garden/sky.ts` | `GARDEN_SKY_LAYOUT`: horizon y 368, sun x 966 rising / 556 setting, its sun side (rising right, setting left; ADR 0284), the moon's arc, where stars may be |
| `japanese-garden/light.ts` | `GARDEN_LIGHT_ART` (trees, shrubs, sky) and `ENGAWA_LIGHT`, the engawa's own light marks (its cast shadow, the lamp-lit shoji) |
| `japanese-garden/ambience.ts` | `GARDEN_AMBIENCE`: dew boxes on the near banks, dawn mist bands 1–3, the veil to y 592 |
| `japanese-garden/view.ts` | `GARDEN_VIEW`: focus (800, 560), the stepping stones' near edges for the guiding path |
| `japanese-garden/flora.ts` | `GARDEN_FLORA` (a cultivated garden in warm Japan, see Flora) and `GARDEN_HABITAT_WORDS` ('on the water', 'at the pond’s edge'…; the UI's default) |
| `waterfall/flora.ts` | `WATERFALL_FLORA`: a wild, cool montane gorge in Japan, see Flora |
| `flora.test.ts` | each scenery's flora: the offer rule, every species has a home and a slot there, `also`/`except` ids, the garden's 25, the waterfall's 17 (12 own, 5 shared), both released sceneries' balance (ADR 0250) |
| `waterfall/layout.ts` | the waterfall's skyline (`SKYLINE`, `skylineAt`, `openSky`), `CLIFF`, `FAR_RIDGE`, `LEDGES` (with their scale), `CROWN_SCALE`, `WATERFALL_SKY_LAYOUT`, `FOCUS`, `WATERFALL_AMBIENCE`, `WATERFALL_HABITAT_WORDS` |
| `waterfall/geometry.ts` | `FALLS`, `POOL`, `WATERLINE`, `STREAM_LINE` and `STREAM`, `ROCKS`, `TRAIL`, `waterfallScene` |
| `waterfall/slots.ts` | `WATERFALL_SLOTS`: 49 slots, explicit scale on the cliff |
| `waterfall/fauna.ts` | the waterfall's wildlife (ADR 0248): `WATERFALL_FAUNA` (its unlock table), `FOAM`, `waterfallPerspective(x, y)`, `WATERFALL_WILDLIFE` (`Scenery.fauna`: still pool minus the foam, the stream, ledge and wet-rock perches, heron stands) |
| `waterfall/fauna.test.ts` | the table: ids, lines, shared kinds in their gorge variants, thresholds, rows without a module skipped |
| `waterfall/index.ts` | `WATERFALL` (offered to everyone), `waterfallSteps` (the land, the rock, the vegetation and the water; the sky is the daylight's plates), re-exports `WATERFALL_SKY` and `WATERFALL_LIGHT_ART`, `WATERFALL_VIEW` |
| `waterfall/sky.ts` | the daylight's sky (S10, ADR 0247): `WATERFALL_SKY` (`paintWaterfallSky`, `paintWaterfallWaterSky`), `plateSky` (the washes' clip), `WATERFALL_SKY_RECT`, `WATERFALL_SUN_SKY` (the layout with its sun side, right at both low suns; ADR 0284) |
| `waterfall/light.ts` | `WATERFALL_LIGHT_ART`: no trees or shrubs; `shadows` (ledges, cliff foot, notch, left cliff) and `lights` (warm rock at sunrise and sunset, moonlit falls at night) hooks |
| `waterfall/daylight.studio.ts` | studio `waterfall-daylight` (109): the four phases, dusk, and each phase's sky, water and light plates |
| `waterfall/daylight.test.ts` | the lights in open sky per phase, the plate's lower edge, plate keys carry `waterfall` |
| `waterfall/paint-rocks.ts` | the rock's painters (S6): `paintGorge`, `paintCliff`, `paintButtress`, `paintLedges`; `cliffBody`, `buttressShape`, `ROCK_LIGHT` and the rock pigments |
| `waterfall/paint-water.ts` | the water's painters (S7): `paintPool`, `paintStream`, `paintFalls`; `sheetAt` (a point on the falling sheet) and the `WATER` pigments |
| `waterfall/paint-veg.ts` | the vegetation and ground painters (S8): `paintFarRidge`, `paintBanks`, `paintWaterfallMeadow`, `paintWaterfallGrass`, `paintCrownWoods`, `paintOverhang`, `paintFerns`, `paintForeground`; `WATERFALL_GROUND` (where the meadow's texture may go), `WOODS`, `OVERHANG`, `FERN_SPOTS` |
| `waterfall/veg.studio.ts` | studio `waterfall-veg` (108): `veg-banks`, `veg-woods`, `veg-ferns`, `veg-scene` |
| `waterfall/veg.test.ts` | the vegetation's steps, ferns off the slots, hash pins, slice bounds, parts |
| `waterfall/water.studio.ts` | studio `waterfall-water` (106): `water-falls`, `water-pool`, `water-stream`, `water-scene` |
| `waterfall/water.test.ts` | the water's steps, the sheet's edges, hash pins, slice bounds, parts |
| `waterfall/falls.ts` | the falls in motion (S9, ADR 0282): `createFallsMotion` (`WATERFALL.motion`), `dropAt`, `FALL_TOP`, `FALL_FOOT`, `FALL_S`, `MOTION_BOUNDS` |
| `waterfall/falls.studio.ts` | studio `waterfall-falls-motion` (107): `falls-sheet` and `falls-foot` (animated), `falls-sprites` |
| `waterfall/falls.test.ts` | the motion: pure in `t`, frozen, nothing under reduced motion, skipped off screen, always falling, the fall's speed |
| `waterfall/sprites.ts` | `WATERFALL_ROCKS` (`art.rockSprites`): `paintWaterfallRock`, `isWetRock` |
| `waterfall/rocks.studio.ts` | studio `waterfall-rocks` (104): `cliff`, `ledges`, `boulders`, `scene` |
| `waterfall/rocks.test.ts` | the rock's steps, wet and mossy boulders, hash pins, slice bounds |
| `waterfall/map.studio.ts` | studio `waterfall-map` (103): the composition map and the placeholder painting |
| `thumbnail.ts` | the Gardens cards' thumbnails (ADR 0285): `createThumbnails` (sources live › stored › painted › waiting, `THUMB_RANK`, `replaces`), `cacheStore` (`scenery-thumb`, `thumbKey`), `prepaintThumbnail` (pre-paint a garden not on view and make its thumbnail from that painting, ADR 0339), `paintThumbnail`/`thumbnailView`/`composeThumbnail` (any painting at the thumbnail framing; painted small without a paint cache) |
| `thumbnail.test.ts`, `thumbnail.studio.ts` | the sources and the cache key; studio `garden-thumbnails` (110) |
| `registry.test.ts` | ids, registry, each scenery consistent with itself, the garden's numbers, `PAINT_ROOTS` |
| `waterfall/waterfall.test.ts` | the waterfall's composition, slot, spacing and sky invariants |

The Japanese garden's painters stay in `src/scene/` (docs/systems/scene.md): its geometry
(`gardenScene`), its painting (`GARDEN_ART`, `gardenSteps`) and its sky (`GARDEN_SKY`).
| `oasis/index.ts` | `OASIS` ("Ksar oasis", offered to everyone since O8), `OASIS_ELEMENTS` (the elements and the draft steps each runs: the seams O2–O4 swap), `oasisSteps`, `OASIS_ART` (seed 13), `OASIS_VIEW` |
| `oasis/layout.ts` | draft A's shapes re-exported, `SKYLINE`/`skylineAt`/`openSky`, `LIFT` and `terraceScale` (ADR 0300), `copingAt`, `FOOTPATH`, `OASIS_SKY_LAYOUT` (both low suns on the right), `FOCUS`, `OASIS_AMBIENCE`, `OASIS_HABITAT_WORDS` |
| `oasis/geometry.ts` | `BASIN_WATER` (the pond), `BASIN_STONE`, `WATERLINE`, `SEGUIA`, `SLUICE_WATER`, `OUED_WATER`, `BAR`, `oasisScene` |
| `oasis/slots.ts` | `OASIS_SLOTS`: 47 slots, terrace lift in scale; `SLOT_TERRACE` |
| `oasis/flora.ts`, `oasis/fauna.ts` | `OASIS_FLORA` (offers nothing yet); `OASIS_FAUNA`: the unlock table, data only (the shared creatures and its own eight) |
| `oasis/wildlife.ts` | where its wildlife lives (ADR 0304): `OASIS_PERCHES`, `OASIS_GROUND`, `OASIS_WALLS`, `OASIS_STANDS`, `oasisPerspective(x, y)`, `KSAR_SCALE`, `NEST`, `OASIS_WILDLIFE` (`Scenery.fauna`) |
| `oasis/wildlife.studio.ts` | studio `oasis-wildlife` (142): every target over the painting with a creature of its size, whole and close |
| `oasis/fauna.test.ts`, `oasis/wildlife.test.ts` | the table (ids, kinds, thresholds, skipping) and the targets (each in its shape, perspective) |
| `oasis/sky.ts`, `oasis/light.ts` | placeholders until O5: one golden wash per phase cut to the skyline, a plain basin sky; a shade at the bluff's foot and warm light on the ksar |
| `oasis/map.studio.ts` | studio `oasis-map` (141): the composition map over the painting, and the painting under the midday plate |
| `oasis/oasis.test.ts` | see Tests |
| `coast/index.ts` | `COAST` ("Greek coast", behind `?dev&scenery=coast`, `order` 3), `COAST_ELEMENTS` (the placeholder steps by element: the seams the painter tasks swap), `COAST_ART` (seed 15), `COAST_SKY`, `COAST_LIGHT_ART`, `COAST_VIEW`, `COAST_PAINTERS` |
| `coast/layout.ts` | the composition (ADR 0360): `FAR_HILL`, `VILLAGE`, `CHAPEL`, `PROMONTORY`, `STYLOBATE`, `COLUMNS`, `ARCHITRAVE`, `DRUM`, `PROMONTORY_PINES`, `CAIQUE`, `SHORE_EDGE`, `WATERLINE_EDGE`, `BEACH`, `SHELF`, `POOLS`, `SPLASH_ROCKS`, `SHORE_BOULDERS`, `SHORE_SCRUB`, `WALLS`, `LAND`, `OLIVE`, `PINE`, `PATH`, `STEPS`; `TEMPLE_SHAPES`, `silhouetteAt`, `SKYLINE`/`skylineAt`/`openSky`, `COAST_SKY_RECT`, `LIFT`, `WALL_TERRACE`, `terraceScale`, `copingAt`, `COAST_SKY_LAYOUT` (both low suns on the left), `FOCUS`, `COAST_AMBIENCE`, `COAST_HABITAT_WORDS` |
| `coast/geometry.ts` | `SEA_WATER` (the pond), `POOL_WATER`, `coastScene` |
| `coast/slots.ts` | `COAST_SLOTS`: 48 slots, terrace lift in scale; `SLOT_TERRACE` |
| `coast/flora.ts`, `coast/fauna.ts` | `COAST_FLORA` (ADR 0361; offers the five shared species and the ice plant so far); `COAST_FAUNA` (empty) and `COAST_WILDLIFE` |
| `coast/painters.ts`, `coast/paint-placeholder.ts` | the lazy chunk: `coastSteps` runs draft B's steps moved onto the final layout; `COAST_PAINTERS_LOADED` |
| `coast/sky.ts`, `coast/light.ts` | placeholders: one wash per phase cut to the skyline with a low glow over the sea, a mirrored sea sky; a shade under the promontory and the walls, warm light on the temple at low suns |
| `coast/sea.ts`, `coast/paint-water.ts`, `coast/boat.ts`, `coast/water.studio.ts` | the water (G3, ADR 0366): its shapes (eager data: depth lines, seabed, reflections, the caique, foam and wrack lines), its painters (`paintSea`, `paintBeach`, `paintPools`, `paintCaique`), studio `coast-water` (153) |
| `coast/map.studio.ts` | studio `coast-map` (152): the composition map over the placeholder painting (`map`), and the painting under the midday plate (`painting`) |
| `coast/coast.test.ts` | see Tests |

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
  flora: SceneryBiome;                          // realm, biomes, climate, cultivated, also?, except? (ADR 0250)
  habitatWords: Record<Habitat, string>;        // how the planting sheet and placement name each habitat
  fauna: SceneryFauna;                          // unlocks: FaunaTable; water?, perches?, stands?, perspective?(x, y) (ADR 0248)
  sound: SoundSceneryId;                        // its sound profile in core/soundscape.ts SCENERIES: 'pond' or 'waterfall' (ADR 0283)
  motion?: () => SceneryMotion;                 // moving water over the painting: prepare() in parts, draw(ctx, t) pure in t (ADR 0282)
}
```
A scenery is consistent with itself: `art.scenery === id`, `art.scene === geometry`,
`light.sky === sky.layout` (`registry.test.ts` checks every registered one).

**Thumbnails** are not part of the contract: `thumbnail.ts` makes them from the renderer's overview,
the paint cache or the garden's pre-painted overview (S5b, ADRs 0285, 0339). The
sound profile became `sound` (S15, ADR 0283; `coast` is a profile without a scenery yet), and the
per-frame water animator became `motion?` (S9, ADR 0282).

## Flora (ADR 0250)
Each scenery offers its own species, from where they really grow. Its `flora` is its place in the
world: a realm, its biomes, a climate, whether people plant it (`cultivated`), and two escape
hatches, `also` and `except`, for what biology alone cannot say (each id with a comment why). A
species is offered when its `range` matches (docs/systems/plants.md › Flora). `main.ts` builds
`floraLookup(species, id => getScenery(id).flora)` once: the controller's `speciesIn`, the
reducer's `grows` and the dev hooks take it. The slot habitats (`water`, `shore`…) still decide
*where in a scene* a plant goes; the flora decides *which scene*.

| Scenery | Flora | Offers |
|---|---|---|
| Japanese garden | `japan · garden · warm-temperate`, cultivated | the 25 garden species (all `cultivatedIn: ['japan']`) |
| Waterfall | `japan · montane-stream, wet-cliff, temperate-forest · cool-temperate`, wild; `except: ['wisteria']` (the sprite hangs from a trellis) | 17: its own iwatabako, daimonjisō, iwakagami, wasabi, kurinsō, baikamo, mizubashō, hototogisu, yamabuki, taniutsugi, katsura, tochinoki; shared by biology: maidenhair fern, Japanese maple, violet, wild strawberry, silver grass |

**Adding a scenery**: give it a `flora` (extend `REALMS`, `BIOMES` or `CLIMATES` in
`src/plants/biomes.ts` if it needs a new tag, one line each) and its `habitatWords`, then check
`src/scenery/flora.test.ts`: once it is released (`available(new URLSearchParams())`) it needs
10–30 species, at least 2 per tier, at least 2 for each habitat its slots have, and at least 6
offered nowhere else. Its own species carry a wild `range` without `cultivatedIn`, so they stay
out of the Japanese garden.

## Who reads what
Each consumer takes the scenery's part as an option and defaults to the Japanese garden's; at
runtime the renderer passes the scenery on view down (`SystemContext.scenery`, see Switching).

| Consumer | Reads | Option |
|---|---|---|
| background (`scene/background.ts`) | `art.steps`; `art.rockSprites` (the boulder sprites and their atlas boxes, default `GARDEN_ROCKS`); `art.scenery` in `paintingKey`/`spritesKey` | the `SceneArt` (`createSceneSystem({ art })`) |
| sky light (`scene/sky-light.ts`) | `sky.rect`, `sky.shape`, `sky.paint`, `sky.paintWater`, `sky.layout`; the id in `skyPlateKey` | `createSkyLight({ sky, scenery })` |
| sun, moon, stars (`ambience/sky-layout.ts`) | `SkyLayout` | `sunDisc(s, sky)`, `moonDisc(s, sky)`, `stars(n, seed, sky)` |
| light plates (`ambience/cast.ts`) | `light` (trees, shrubs, sky, hooks), `geometry.lights`; the id in `lightPlateKey` | `createCastLight(scene, light, seed, { scenery })` |
| grade wash (`ambience/lighting.ts`) | `geometry.lights` (reserve radius `r`), `geometry.structure` (water hidden under it) | the geometry |
| ambience (`ambience/ambience.ts`) | `light`, `ambience` (dew, mist bands, veil), `geometry.eave`, `geometry.lights` (flame) | `createAmbience({ scenery })`, `addAmbience(renderer, { scenery })` |
| viewport (`render/viewport.ts`) | `view.focus` | `DEFAULT_FOCUS`; the renderer's `focus` option |
| wayfinding (`ui/wayfinding.ts`) | `view.pathOut` | `createWayfinding({ pathOut })` |
| watering can (`plants/system.ts`) | `geometry.structure` | the geometry |
| fauna (`fauna/system.ts`, `fauna/sim.ts`) | `fauna` (unlock table, water, perches, stands, perspective), `geometry` (pond, streams, rocks, path, slots, sky band) | `SystemContext.scenery`; `FaunaSim({ habitat })` (default: the Japanese garden's table, everything else from the geometry) |
| quiet line (`ui/format.ts`) | the table's arrival lines | `faunaTable(id)` |

## Switching (ADR 0243)
`src/scenery/host.ts` (`createSceneryHost({ store, renderer, getScenery })`) follows
`state.scenery` and calls `renderer.setScenery`; `main.ts` gives it the sceneries the URL flags
offer (an unavailable id reads as the Japanese garden). The renderer covers the stage with its
last frame, cuts the camera to the overview, re-inits every system with `SystemContext.scenery` and
cross-fades over 0.9 s once the new garden is ready (a cut under reduced motion); docs/systems/render.md.

| System | On a new scenery |
|---|---|
| scene (`scene/system.ts`) | drops its paintings, jobs, sky and water; paints `scenery.art` (or takes it from the paint cache) with `scenery.sky`; init blocks until painted |
| ambience (`ambience/system.ts`) | builds its engine again with the scenery's `light` and `ambience`; the weather, the time override and the reveal carry over |
| plants (`plants/system.ts`) | shows `gardenOnView(state, id)`: the finished plants and seedlings of that garden only; sessions elsewhere keep growing in state; watering applies only to a seedling on view |
| fauna (`fauna/system.ts`) | the new scene and the scenery's `fauna` (`setScene(scene, habitat)`), `resetResidents()`, that garden's unlocked rows and targets (ADR 0248) |
| audio (`main.ts` subscription) | `audio.setScenery(scenery.sound)`: the beds glide to the new profile and the mixer shows its palette (ADR 0283) |

A session from another garden that becomes active (started or switched to) dispatches
`scenery/view` first, in the same dispatch, so its garden is cut in before the glide to its
seedling. The timeline and the weather are shared: the active session's weather shows in any garden.

From the page: the dock's **Gardens** section (docs/systems/ui.md › Gardens, ADR 0244) lists
the available sceneries and calls `controller.showScenery(id)`. The UI reads the viewed
scenery's slots and habitat words through getters, so placement, the planting sheet, the
seedling framing, labels and the dev `slots()` hooks follow a switch.

Dev API: `sprout.scenery()` → `{ viewed, available, fade }`; `sprout.showScenery(id)` resolves
once the garden is ready (rejects an unavailable id). Both gardens are offered without a flag.

### Switch times (S17, devlog 95)
Measured on the production build (`vite preview`) in headless Chromium on the owner's laptop while
it was loaded (everything under `nice -n 19`). *Ready* runs from the dispatch until `showScenery`
resolves (the new garden painted or taken from the cache); *settled* adds the 0.9 s cross-fade.
Three runs on desktop, two on the phone.

| Switch | Desktop 1440×900: ready (settled) | Phone 390×844: ready (settled) |
|---|---|---|
| cold: first visit to the waterfall, nothing cached | 5.8–7.0 s (6.7–7.9 s) | 2.4–2.8 s (3.5–3.8 s) |
| cold: first visit to the Japanese garden (booted on the waterfall) | 4.5–4.9 s | — |
| warm: back to the Japanese garden (paint cache hit) | 0.18–0.29 s (1.08–1.18 s) | 0.01–0.09 s (0.93–0.99 s) |
| warm: to the waterfall again (paint cache hit) | 0.38–0.57 s (1.24–1.46 s) | 0.16–0.20 s (1.03–1.09 s) |
| after a reload, to the waterfall (persisted cache) | 0.49–0.56 s (1.35–1.44 s) | 0.20–0.22 s (1.07–1.10 s) |

Every warm switch was one cache hit and no paint. The waterfall's warm switch is a little slower
than the garden's: its falls' motion paints its sprites (about 90 ms of parts) before the scene is
ready. The cold paint runs in parts between frames, so the page stays responsive while it waits.

## Paint cache (ADR 0242)
Every key starts with the scenery id: `japanese-garden|s7|normal|0,0,1600,1000@1.5|2400x1500`
(`scene`, `scene-detail`), `japanese-garden|s7|normal@1.5` (`scene-sprites`),
`japanese-garden|s7|midday|…` (`sky-plate`), `japanese-garden|ambience-cast|sunset|…` (`light-plate`).
`src/scenery` is one of `PAINT_ROOTS`.

## Lazy painters (ADR 0341)
Each scenery's painters are a chunk of their own, loaded the first time one of its paints has to
run. With a warm paint cache they are never requested.
- `<id>/painters.ts` exports its `GardenPainters`: `steps(art, only?)`, `rock?`/`tuft?` sprites,
  `sky: { paint, paintWater }` and `light: { shadows?, lights? }`. Nothing imports it statically.
- `index.ts` (the Japanese garden's `art.ts`) makes one handle,
  `lazyPainters(() => import('./painters').then((m) => m?.X_PAINTERS_LOADED))`, and puts it on
  `Scenery.painters`, `art.painters`, `sky.painters` and `light.painters`.
- `motion` imports its own module (`motion.ts`, `falls.ts`): the motion's sprites are painted on
  every visit, so they do not drag the landscape painters in.
- What stays eager is data: geometry, layout, slots, flora, fauna habitat data, the sky's layout,
  rect and shape, the light's trees, shrubs, sky layout and grades. Keep painting code out of the
  modules these import, or it lands in the first view again.
- Sync painting (`paintSceneSync`, `paintJob`, `backgroundSteps`, the studio, unit tests) needs
  `await scenery.painters.load()` first; `paintScene` loads them itself.
- **The oasis's shared shapes** live in `oasis/shapes.ts` (devlog 149): `WALL_FACES` and
  `copingLine`, `FALLEN_STONES`, `NEAR_STONES`, `BASIN_STEPS`, `SLUICE_GATE`, `planPalm`,
  `BIG_PALM_SHAPES`, `GROVE_PALMS` and the `PalmShape` type. The wildlife data, daylight, the
  motion and the painters read them from there, so the oasis's `paint-*` modules are only in its
  lazy chunks. A shape eager code needs goes into `shapes.ts` (or `layout.ts`, `geometry.ts`),
  never into a `paint-*` module. `lazy-painters.spec.ts` checks that a Japanese garden visit,
  first or warm, loads none of the oasis's paint code.

## Adding a scenery
1. A folder `src/scenery/<id>/` with its geometry, painting data (`SceneArt`), `ScenerySky`,
   `LightArt`, `SceneryAmbience` and `SceneryView`, gathered in `index.ts`, and its painters in
   `painters.ts` behind a `lazyPainters` handle (see Lazy painters).
2. Register it in `registry.ts` and its unlock table in `fauna.ts`, and name its `sound` profile;
   keep `available` false behind a dev flag until it is done (the waterfall's was
   `?dev&scenery=waterfall` until S17), then return true and check `flora.test.ts`. Its
   wildlife: `<id>/fauna.ts`, a table (rows name creature kinds; rows without a module are skipped)
   and, where the geometry alone is not enough, water, perches, stands and perspective
   (docs/systems/fauna.md › Sceneries).
3. Studio entries for everything it paints (`*.studio.ts`).
4. Nothing else changes: the consumers above already read the scenery.

## Waterfall (ADR 0245)
A rocky waterfall in the same watercolour style, offered to everyone since S17. S4 set its
geometry, slots and numbers; its painters are S6–S8, the animated falls S9, its daylight S10, its
wildlife S11 and the C tasks, its own species the W tasks and its sound S15. Its composition map
is in the studio: `waterfall-map/map` (and `waterfall-map/placeholder`, the flat shapes it began
with).

```
y    0 ┌───────────────────────────────────────────────────────────────────────────┐
       │ · stars (y 26–186) · · ·                    ·   · moon arc (990→1150→1300)│
  200  │ crown woods ▲(60,200)            buttress ▲(780,214)        · open sky ·  │
       │ ╲___ cliff-3 L      notch 250  ╱╲ cliff-5     ╲ sunset ○980    ○1270 sun- │
  296  │     ╲___ ledge hi ═  ┃lip┃  ═ ledge hi          ╲_______________ rise ____│
  336  │ cliff    ledge mid ═ ┃   ┃  ═ ledge mid          far ridge 344–372 (pale)  │
  448  │ face     ledge lo  ═ ┃fal┃  ═ ledge lo           far plain (bank-17/18)    │
  530  │  (stone)            ┃ls ┃                  ╲flank                        │
  598  │──cliff foot──╮ ╭────┸foot┸── plunge pool ───╮        rock-right (1340,650) │
       │ cliff-1 T    │ │ pool-3   pool-4  pool-1 L  pool-2 L╲                      │
  748  │ bank-5 L     ╰─┴──────────────── near edge ─╯  ╲ stream                    │
       │ bank-6 L    trail ▒ (650,760)…(680,968)    bank-10    ╲  (S, widening)    │
       │ bank-7 M         ▒ ▒ ▒                     bank-11 L   ╱  bank-13/14 L     │
 1000  └──────────────────▒─────────────────────────────────╱──────────────────────┘
```
- **The falls are the subject, so they sit off centre** (x 542–688, about a third of the way in),
  between a broad cliff on the left and a narrower buttress on the right. They drop one sheet
  (296 → 606) from a notch in the cliff top. The lip is about 37 units under the notch's skyline,
  so the upper gorge shows behind it and the water does not pour out of the sky.
- **The skyline is broken rock** (S6b): the crown steps down toward the falls in blocks, the
  notch's skyline is the far gorge's top, the buttress's crest steps up, and its flank steps down to
  the ridge in jointed blocks of uneven size. `BUTTRESS_END` is the buttress's right edge under the
  skyline, where the far ridge meets it; `FAR_RIDGE` and the sky plate follow it.
- **The skyline decides the light.** The crown woods are highest at the left edge (y 200), and the
  buttress beside the falls is the tallest rock there (y 214). Its flank falls away to a low far
  ridge (y 344–372). The right 40 % of the frame is open sky for the daylight phases: the sun sets
  at x 980, on the buttress's right shoulder (`WATERFALL_SUN_SKY`; the layout still says 1040), and rises at x 1270 over the far ridge (horizon y 384,
  under the ridge, so the sun climbs out from behind it). The moon arcs between them. The stars
  stay above the crown (y 26–186), with a gap round the moon's arc. `WATERFALL_SKY_LAYOUT`.
- **The plunge pool** (x 452–1010, y 597–748) lies against the cliff's foot: its back edge is the
  cliff's base, and the waterline (598) is the far edge the cliff's reflection mirrors about. The
  falls' foot (615, 608) is in its back-left. The calm right half holds the large water slots.
- **The stream** leaves the pool's right end at (985, 704) and winds toward the viewer in an S,
  widening from 48 to 120 units, and leaves the bottom at x ≈ 1080. It is moving water: no
  reflections, no striders (`streams`). Its banks are `stream-*` shore slots.
- **Six ledges** at three heights either side of the falls (`LEDGES`) carry the `ledge-*` rock
  slots. The trail's six stepping stones climb from the bottom (680, 968) to the pool's near edge.
  Their near edges are `view.pathOut`, where the guiding path leaves the painting.
- **Portrait crop**: focus (760, 560). Phones see x 460–1060: the whole falls, most of the pool,
  the ledges beside the falls, the trail, the stream's start and the setting sun.
- **Depth on a cliff** (ADR 0245): ground slots use `perspectiveScale(y)` as in the garden. A
  plant on a ledge stands at the cliff's depth, not at the depth its y would give on flat ground.
  The cliff's foot is at 0.76 and it leans back, so the low, mid and high ledges are 0.72, 0.68
  and 0.64, and the crown is 0.6 (`CROWN_SCALE`). Each slot carries its scale. `Slot` is unchanged.

### Slots (49)
| Habitat | Count | Where | Sizes |
|---|---|---|---|
| water | 4 | `pool-1…4`, the pool's calm right half, ≥ 80 from the falls' foot | 2 large (the lotus's), 2 medium |
| shore | 9 | `bank-1…4` the pool's rim, `stream-1…5` the stream's banks | 1 large, 7 medium, 1 small |
| meadow | 12 | `bank-5…16` the grassy banks left of the trail, between the trail and the stream, right of the stream | 1 tree (`bank-16`, the right edge), 5 large, 6 medium |
| path | 6 | `trail-1…6` beside the stepping stones | 1 medium, 5 small |
| back | 7 | `cliff-1` (tree, the left foot), `cliff-2` (the buttress's foot), `cliff-3…5` the crown, `bank-17/18` the far plain | 1 tree, 2 large, 3 medium, 1 small |
| rock | 11 | `ledge-1…11` on the six ledges | 2 medium, 9 small |

Every species has a compatible slot. The lotus has 2 (`pool-1`, `pool-2`). The black pine has 1
(`cliff-1`), and the other trees have 2. Ledge plants never stand over the base of a plant higher
up, and no plant box covers more than a fifth of the falls. Tree crowns keep clear of the ledges
and the sun's paths. Plants at the same depth overlap by at most half their footprint at 1.25×.

### Painting
Steps, back to front (`only` filters by element):

| Step | Element | Who | What |
|---|---|---|---|
| `far-ridge` | `ridge` | S8 | the far ridge, a nearer ridge and a far tree line (soft) |
| `banks` | `banks` | S8 | the plain and the grassy banks, warm and cool passages, shade, lips (soft) |
| `meadow` | `banks` | S8 | the garden's meadow patches, off the cliff, the pool, the stream and the edges |
| `grass` | `banks` | S8 | the garden's sparse grass strokes, same mask |
| `gorge` | `gorge` | S6 | the upper gorge behind the lip |
| `cliff` | `cliff` | S6 | the cliff mass and its detail |
| `buttress` | `cliff` | S6 | the buttress right of the falls |
| `ledges` | `ledges` | S6 | the six ledges and their moss |
| `crown-woods` | `woods` | S8 | dark broken woods along the cliff top, with spires |
| `overhang` | `woods` | S8 | two trees leaning out over the cliff edge |
| `ferns` | `ferns` | S8 | moss at the ledges' ends, fern sprays there and at the cliff foot |
| `pool` | `water` | S7 | the plunge pool: deep heart, shallows, reflections, churn |
| `stream` | `water` | S7 | the outflow stream: channel, ripples, riffles |
| `falls` | `falls` | S7 | the falling sheet (still) and the foam at its foot |
| `foreground` | `near` | S8 | deeper greens in the bottom corners, tall grass tufts |
| `margins` | `near` | S8 | the garden's unpainted-paper margins (soft) |
| `stones` | `path` | S6 | the trail's stepping stones (the garden's `paintStones`) |

**The rock (S6, `paint-rocks.ts`).** Painted on white like the garden (ADR 0021), lit from the
upper right (`ROCK_LIGHT`, −0.95: the sun sets and rises right of the buttress), in parts.
- *The exact edge* (S6b): a wash smooths its outline at a spacing set by its size (perimeter / 24),
  so a wash over the whole cliff turned its steps into a rounded blob and left a margin of
  unreserved paper at the flank, where the ridge showed through. The rock is therefore reserved
  with a full paper fill of a hand-cut outline (`roughOutline`: resampled every 4 units, nudged by
  noise) and its body washes cover a rectangle clipped to that outline.
- *Gorge*: the notch is cut out of the cliff's body down to the lip (`cliffBody`), so the gorge
  shows through. Seen from below, the river above the lip is hidden: the gorge is three spurs
  overlapping from either side (deep distance), the farthest a cool haze whose top is the notch's
  skyline, then a shaded right spur and a lit left one, each clipped to its own hand-cut outline,
  with mist at each spur's foot, a crease and a few beds on the near ones, and far trees.
- *Cliff*: paper reserved to the exact edge, so it stands opaque over whatever S8 paints behind
  it. One wet-in-wet mass, warm grey lit at the top to cool blue-grey at the foot. Strata are
  broken blocks dipping gently left: a thin lift on top (the lit bed) over a shadow wash with a
  crisp top that dies downward, and joints dropping under each bed, some with the block's shaded
  side turning away from the light. Dry-brush scumbles follow the bedding, a few short cracks cross it. A cool
  glaze darkens the alcove behind the falls and the cliff's foot, warm glazes light the faces
  turned to the sun. Wet streaks run down from the lip either side of the falls (soft, wet
  strokes in `WET_ROCK`), and dark-green seeps run under some ledges.
- *Buttress*: its own wet-in-wet over the cliff, clipped to its hand-cut outline, lit warm on the
  right, cool toward the falls. Its blocks (between the risers of the stepped skyline,
  `buttressSteps`) alternate cool and warm planes dying downward; a dark rim under each tread
  gives the lit tops a thickness; a broken sumi contour finds the flank's edge on the sky and is
  lost at its foot; a joint drops from each riser's foot, cut by axe strokes on its shade side. A
  fissure splits the crest from the flank.
- *Ledges*: each the outcrop of a bed. The bed runs on into the face either side, thinning out; a
  lit top (lift and a warm glaze), thickest in the middle; a shaded front face under a slightly
  broken lip, cut into blocks by short joints; an undercut in two or three soft pools with no
  edge, dark under the face and dying into the cliff; a broken lip line, heavier on the shaded
  left; moss in clusters with gaps, a few strands spilling over the face. The lip stays on
  `Ledge.edge`, so the slots and perches are unchanged.

**Boulders (`sprites.ts`).** `SceneArt.rockSprites` replaces the garden's boulder for this
scenery (same `rockBox`, so the atlas layout is unchanged in shape). A boulder within 24 units of
the pool or the stream is *wet*: a dark waterline instead of a cast shadow, a dark cool stone with
little moss, a darker splashed lower half, a lifted sheen on the lit shoulder and green slime at
the waterline. The others are *mossy*: a cast shadow, a warmer stone with a lot of moss, a moss
cushion on top and grass at the foot.

Studio: `waterfall-rocks/cliff`, `/ledges`, `/gorge`, `/buttress`, `/boulders` and `/scene` (the whole painting so far).

**The water (S7, `paint-water.ts`).** On white, in parts, in a cooler, bluer celadon than the
garden's still pond (`WATER`: light, mid, deep, a warm `shallow` and the sheet's grey-blue).
The pool and the stream come after the ledges and before the stepping stones; the falls come
after both, so the sheet lies over the cliff's alcove and its foam over the pool's back edge.
Boulders are sprites, drawn over the whole background, so every boulder sits on the water.
- *Falls*: the sheet's paper is reserved by two lifts (0.8 over the outline, full over its inner
  80 %), so the alcove's dark glaze shows faintly through the thin edges. `WET_ROCK` washes in
  broken vertical runs down both edges are the cliff glimpsed through the thinnest water. A soft
  glaze shades the left half (the light comes from the upper right). Then vertical strips
  (`sheetAt` follows the sheet as it widens) in the sheet's grey-blue or the water's mid, each
  faded at one end, leave white paper between them; thin lifts pull a few bright threads back
  out. The lip is a darker glassy roll with a lifted gleam. The foam at the foot is nine soft
  lifts in a flat mass, a cool shade under it and a misty lift up into the sheet's base.
- *Pool*: the rim is reserved like the garden's pond (thin at the back, wider toward the viewer),
  then the garden's `waterBody` recipe in the cooler palette. Over it, clipped to the pool: a deep
  heart bled in under the falls (two soft glazes), warm shallows along the near edge fading toward
  the deep, the cliff's dark wet reflection in broken pieces under the waterline (none under the
  falls), soft dark reflections under the boulders in the pool, and the reserves: the falls' pale reflection as stacked short lifts below the foot, and
  the sky band as a few long level lifts, where the garden reserves its own. Churn rings
  (`ripple`) spread from the foot toward the outflow with foam flecks drifting on the current.
- *Stream*: its rim is reserved outside the pool only (an even-odd clip), so no rim line crosses
  the outflow. One wet-in-wet body, deeper upstream and paler toward the viewer, a deeper channel
  ribbon swaying down the middle, warm shallows inside the bends. Ripples are short, nearly level
  marks (the stream lies flat, seen from above), half dark strokes, half lifts. Each rock in or
  at the stream (`rock-outflow`, `rock-stream`, `rock-stream-bank`) gets a pale collar at its
  waterline (mostly under the sprite, it shows as a bright rim) and a broken wake either side.

Studio: `waterfall-water/water-falls`, `/water-pool`, `/water-stream` and `/water-scene`.

**The vegetation and ground (S8, `paint-veg.ts`).** On white, in parts, neutral daytime only. The
land is painted first, under the cliff's reserved paper and the pool's rim reserve, so the rock
and the water need nothing from it; the vegetation on the rock comes after the ledges; the near
foreground and the margins come after the falls and before the stepping stones, as in the garden.
`far-ridge`, `banks` and `margins` are `soft` (draft resolution), like the garden's big washes.
- *Far ridge*: `FAR_RIDGE` in a cool blue-grey (bellflower and stone, through `atmos`), fading
  down; a nearer, greener ridge under it; a scalloped tree line on that, broken into stands by
  low-frequency noise.
- *Banks*: a pale cool plain from y 452, then wet-in-wet banks far to near (the right bank up to
  the plain, the left bank round the pool's rim, three warmer near mounds either side of the trail
  and the stream), each with a lit lip bleeding into its body and a ragged fade toward its open
  side. Soft warm (sap, gold, ochre) and cool (sage, celadon) passages with granulation, cool shade
  glazes where the banks turn down to the water, dry-brush along the lips.
- *Meadow and grass*: the garden's `paintMeadow` and `paintMeadowGrass` with `WATERFALL_GROUND`.
  Its `pond` is the cliff and the pool as one shape plus a strip past the left edge, its `path`
  the stream plus strips past the right and bottom edges, where the margins leave paper. That
  keeps the work per row of cells under the slice bound and paints nothing under the cliff.
- *Crown woods*: a dark under-wash along the skyline, then stands of `foliageClump`s in `WOODS`
  (olive toward indigo and sumi) with gaps, now and then a spire of three stacked clumps. Over the
  crown slots (`cliff-3`, `-4`, `-5`) the clumps stay small and no spire grows.
- *Overhang*: `OVERHANG`, a tree left of the notch and one off the buttress's right flank, each a
  dry trunk stroke leaning out and three clumps.
- *Ferns*: a moss glaze at each ledge end, then fern sprays (`FERN_SPOTS`) just past the ledges'
  ends, drooping outward, and five along the cliff foot clear of the slots. A frond is an arching
  rachis with paired tapered leaflets; each spray is its own small wet layer, so its fronds bleed
  together and no drying pass reads the whole cliff.
- *Foreground*: deeper green glazes in the bottom corners and six tall grass tufts away from the
  slots and the trail; the margins dissolve them toward the edge.

Studio: `waterfall-veg/veg-banks`, `/veg-woods`, `/veg-ferns` and `/veg-scene`.

### Daylight (S10, ADR 0247)
The painting is on white with no sky step; the sky is the daylight's plates (docs/systems/daylight.md
› Waterfall). `sky.ts` paints the four skies in the garden's language, the glows and cloud banks
over the far ridge on the right, clipped to `plateSky()` (4 units under the cliff, down the buttress's
right edge, 40 over the ridge; a longer hang tinted the flank, so it read see-through; each base
wash covers `openSky(48)`, so its smoothed edge falls under the clip, not over the stepped rock), then the far ridge's distance glaze unclipped. The pool
plate darkens toward the cliff's back edge. `light.ts` adds the rock's shadows (always to the left:
both low suns are right of the buttress), warm light on the sun-facing rock and moonlight on the falls
and their spray. Grades stay global. Studio `waterfall-daylight`.
`WATERFALL_SUN_SKY` (`sky.ts`) is the layout with its sun side, `{ sunrise: 1, sunset: 1 }`, used as
both `sky.layout` and `light.sky`: the shared plant and boulder shadows fall left and the rims face
right at both low suns (ADR 0284). It also moves the setting sun to x 980 so its whole disc stays
inside a phone's 600-unit crop (x 460–1060) at every altitude it shows (devlog 98).

### Wildlife (S11, ADR 0248)
`fauna.ts` holds the waterfall's whole unlock table: the striders (`margin`: they keep to the
pool's edge), the dipper and a maple leaf from the start; then the damselfly, iwana, a red
dragonfly, swallowtails, bees, a wagtail, the yamame, sawagani, kajika (no water plant needed),
house martins, fireflies (night only), the heron and the rare crested kingfisher
(docs/systems/fauna.md › The waterfall's table). Rows whose creature is not painted yet are
skipped. Still water is `POOL` minus `FOAM` (an 84 × 30 ellipse at the falls' foot); `STREAM` is
moving water; the water layers clip to both. Perches are the six `LEDGES` edges and the four wet
rocks (`rock-foot`, `rock-pool-left`, `rock-outflow`, `rock-stream`). The heron wades at three
stands on the pool's back edge right of the falls. `waterfallPerspective(x, y)` is
`perspectiveScale(y)` outside `CLIFF`; inside it runs from `CROWN_SCALE` under the skyline through
the shelves' mean heights and scales to the cliff foot, within 0.02 of every slot.

### Motion (S9, ADR 0282)
`falls.ts` animates the falls over the still painting, never over a cover of its own. The
painting's streaks stay as the sheet's structure, and three kinds of marks fall down it:
- *Surges*: wide, pale, greyed shades (`SURGE`, the sheet's colour moved toward stone and off the
  cyan), 8–15 % of the sheet's width, overlapping, two per lane, out of phase.
- *Lights*: lifted white spindles between them, which veil the painting's streaks as they pass.
- *Threads*: eight thin bright lines, falling a little faster.

Each mark is a spindle sprite with a long tail that dissolves (faded toward the top) and a short
rounded head with a watercolour edge. A pointed head reads as an icicle. A mark is drawn between
its tail's and its head's heights on `dropAt`. Water leaves the lip at 40 units/s and reaches the
foam at 120 (constant gravity, `FALL_S` ≈ 3.9 s), all played at `TEMPO` 1.25× (the owner's pace, so
about 3.1 s on screen; foam and spray too). The sprite stretches as the water speeds up, and
it is born out of the lip and swallowed by the foam by length and alpha, never cut flat. Lanes
fall at 0.8–1.2× speed, fastest in the middle. Each pass draws its sprite, length, lane jitter and
strength from a 96-entry table (a weak draw skips the pass), so a lane repeats only after 32
passes (about 4 minutes), and the lanes' cycles do not share a period.

At the foot, five cool shades (`FOAM_SHADE`) roll round small loops and breathe in the foam, so it
has body and not just a white band. Twelve white puffs, two out of phase at each of six places,
swell, rise and spread outward, then sink. The spray is three faint wisps (alpha ≤ 0.24, painted
at 1.5 px/unit) rising 50–90 units off the plunge over 11–16 s, drifting right on the draught.

The sprites (20, at 3 px/unit, threads at 5) are painted in about 500 parts (≈ 90 ms in all,
2–3 ms the longest) and sealed into `ImageBitmap`s. A frame only blits them, a few dozen
times. The motion draws on `waterSurface`, under the light plate, so noon, sunset and night tint
it like the painting. It skips its draw when the view misses `MOTION_BOUNDS`. Under reduced
motion the scene never creates it (`still: true` also draws nothing). `freeze()` holds `t`.
Studio: `waterfall-falls-motion/falls-sheet`, `/falls-foot`, `/falls-sprites`.

### Left for later tasks
- S10b: the shared shadows and rim light still follow the garden's sun side (boulder shadows fall
  right, rim light comes from the left, while the waterfall's low sun is on the right).
- S5b: the Gardens thumbnails are camera stills, not painted from each scenery's cached overview.
- A cold first visit paints for several seconds on a loaded laptop (Switch times).

## Oasis (phase 13, ADR 0300)
A tended palm grove in the Draa valley, from draft A ("Ksar & palmeraie", devlog 102): the red
bluff with its ksar on the left, terraces stepping down to a stone basin fed by a seguia, big
palms on the right and the oued bending past the viewer's right foot. O1 (devlog 105) made it a
scenery behind `?dev&scenery=oasis`; O8 (devlog 140) released it to everyone. O2 (devlog 107) reframed it and paints its rock; O3 (devlog 110)
paints its water, O4 (devlog 112) its land and vegetation; no draft step runs any more (`drafts/a` is a record). O5 (devlog 114, ADR 0301)
paints its daylight. O6 (devlog 117) adds `motion`, and O7 adds its own `sound` (it borrows `pond` for now).
O1b (devlog 119) adds medium sand and river slots, lowers the moon, deepens the far range and stills the basin.
Composition map: studio `oasis-map/map`. Rock: studio `oasis-rock`. Water: studio `oasis-water`.

- **Composition** (O2, `layout.ts`, `ksar.ts`): the ksar spans x 430–898 on the bluff's seat at
  y 318. The tallest horn tip is at y 152, so a 16:9 screen (which shows y 70–970 round the focus)
  keeps about 80 units of sky above it, clear of the corner controls. The bluff is a rounded
  conglomerate ridge on the left (top y 216), broken down to the ksar's seat, with a rounded,
  broken shoulder on the right (x 900–1022) falling to its foot by the basin. The basin is seen
  at eye level (O2d, devlog 121): a shallow band whose sides run to `BASIN_VP` (810, 340) on the
  horizon (`towardVp`). Its near rim runs x 506–1114 at y 640, its far rim x 585–1035 at y 562
  (78 deep, the far rim 0.74 of the near's width). `BASIN_RIM`: far coping 6 (a sliver: a thin top
  and the inner face below it), near coping 10, side coping 22 wide at the near rim, near outer
  face 24. The water runs y 568–630. The middle terrace wall runs on to the basin's far-left
  corner, and the sand behind the basin takes a pale trodden patch and two sets of short ripples.
  Grove palms begin at `GROVE_FROM` 1030, right of the notch.
- **Skyline**: `SKYLINE` is sampled every 2 units from the painted silhouette (`silhouetteAt`:
  the bluff, every block's front and flank with its horns and crenels, the far range right of
  x 780). Each sample takes the lowest edge within a step either side, plus 1, so the sky plate
  runs into every gap between the towers. Palm crowns are not cut out: the sky's wash
  multiplies over them, as it does over the waterfall's crown woods. At night that reads as
  the crowns going blue-dark against the sky, which is right, so O5 kept it.
- **Near ground** (shaped by O2, reshaped and painted by O4): `NEAR_PLOTS` either side of the
  footpath, the low `BUNDS` curving across (no change of level, so no lift), wet sand along the
  seguia's last run (`WET_SAND_HALF_WIDTH`), and the footpath's trodden band (`PATH_HALF_WIDTH`).

- **Water**: the basin's water inside its coping is the still pond (`BASIN_WATER`, the reflections'
  waterline at its far edge, y 568). The seguia's three runs, the sluice and the oued are
  `streams`. The sand bars inside the oued are land (`OUED_BARS`, the big one the layout's `BAR`). There are no boulders or stepping stones yet.
- **Terraces** (ADR 0300): ground and copings on a raised terrace take `perspectiveScale(y + lift)`.
  The lifts are high 70, middle 36 and grove 24, the wall drops in front of each.
- **Sun** (ADR 0300): both low suns stand in the notch between the bluff's shoulder and the grove,
  as the painting is lit from the right. Sunset is at x 920 (sinking behind the shoulder right of
  the east tower) and sunrise at x 990, both over horizon y 340.
- **Moon**: its arc runs (1040, 232) → (960, 150) → (926, 200), so its top is at about y 149 (O1b;
  it was 110). On a 16:9 screen (y 70–970) the whole disc stays at least 60 under the top edge,
  clear of the corner controls and the paper's edge.
- **View**: the focus is (730, 520). The phone crop (x 430–1030) holds every tower and house, about
  90% of the basin's water, and both suns. `pathOut` is the `FOOTPATH` from the bottom edge to the basin's near rim. O4 paints it.
- **Flora**: `{ realm: 'n-africa-arabia', biomes: ['desert', 'wetland'], climate: 'arid',
  cultivated: true }`. None of the Japanese species is shared by biology (docs/research/oasis-biome.md),
  so it offered none until the phase 13 art queue landed. The coast's olive is shared back: it is
  the commonest fruit tree of the Moroccan oases (`cultivatedIn` names `n-africa-arabia`, GP1). That is why it stays behind the flag:
  `flora.test.ts` holds its invariants for released sceneries only.
- **Wildlife** (OK0, ADR 0304; docs/systems/fauna.md › The oasis): `fauna.ts` is the table: the
  creatures it shares by biology (striders, a gold leaf, the cabbage white, bees, the swallowtail,
  swallows, a rare heron) and its own eight, from the house bunting at the start to the rare white
  stork at 20 plants. Their rows are skipped until each creature's module exists. `wildlife.ts`
  says where they live, from the real shapes: the basin still and the channels and oued moving;
  perches on the three terrace walls' copings, the basin's rim (near, far and both sides), green
  front fronds of the big and the near grove palms, the middle tower's top (the stork's `NEST`),
  the sluice gate's posts and the painted stones; five damp plots and terrace strips for the
  hoopoe; the terrace walls' faces and the basin's near face for the gecko; heron stands on the
  basin's submerged steps and in the oued. `oasisPerspective(x, y)` is the slots' rule: a raised
  terrace and its coping take its lift, a wall face its coping's scale, the basin's near face its
  rim's; the fronds and the tower carry their own scale.

- **Daylight** (O5, `sky.ts`, `light.ts`; docs/systems/daylight.md › Oasis): four desert skies
  clipped to `plateSky()` (4 under the rock, up to 44 over the far range), a turquoise basin plate
  in every phase, shadows always to the left (bluff, towers, walls, coping, the big palms' long
  diagonal shadows), warm light on the ksar, shoulder and palms at low suns, moonlight on the
  basin, and its own golden grades (`OASIS_GRADES`, `LightArt.grades`, ADR 0301). Plants take
  the sky's sun side (right at both low suns). Studio `oasis-daylight`.

### Slots (55)
| Habitat ("words") | Count | Where | Sizes |
|---|---|---|---|
| water ("in the shallows") | 8 | `basin-1…5` (with `basin-5` in the overflow corner by the sluice, for the cattail), `shallows-1/2` in the oued, `shallows-3` (medium) mid-river above the big bar's head, clear of every bar (O1b) | 2 large, 4 medium, 2 small |
| shore ("by the water") | 13 | `rim-1…5` before the basin's near face and by the sluice, `seguia-1…3`, `oued-1…4` (`oued-1` and `oued-3` large, for the oleander on the oued bank), `bar-1` | 2 large, 4 medium, 7 small |
| meadow ("in the plots") | 13 | `plot-1…7` on the basin terrace, `plot-8/9` on the middle terrace, `bed-1…4` in the beds behind the basin (O12) | 3 large, 5 medium, 5 small |
| path ("on the sand") | 6 | `walk-1…6` either side of the footpath; `walk-3` and `walk-4` (medium, one each side, for the desert hyacinth) stand off the line of `walk-5/6` behind them (O1b) | 2 medium, 4 small |
| back ("under the palms") | 7 | `high-1` (tree, the left edge under the bluff), `high-2`, `grove-1` behind the grove's wall, `palm-1` (tree, among the big palms), `palm-2`, `foot-1` (large) and `foot-2` at the bluff's foot behind the beds (O12) | 2 trees, 1 large, 3 medium, 1 small |
| rock ("on the walls") | 8 | `wall-1…5` on the copings, `talus-1…3` at the bluff's foot | 8 small |

No plant stands over the base of a slot on a terrace or wall behind it, and no tree hides a slot
behind it. `talus-2` stands at the shoulder's foot, right of the basin, on the basin terrace.

**Behind the basin** (O12, devlog 137): the band between the basin's far rim (y 562) and the
bluff's foot (y 460–478) holds four irrigated beds (`BACK_BEDS`, fronts at y 552, backs at 514,
sides running to `BASIN_VP`) fed by a head ditch (`BACK_RUNNEL`) from the pool at the first
fall's foot. `bed-1…4` (meadow, small and medium) stand in the beds; `foot-1` (the band's one
large) and `foot-2` (back) stand above the ditch, and `talus-3` under the bluff between them. The
1.25× box of every slot there stays under the ksar's seat (y 318) and above the far rim, so no
plant covers a tower or the basin. The basin's water plants stand in front of the beds and hide
part of them; the slots sit between the basin slots' x where they can.

### Rock (O2, `paint-rocks.ts`)
Two steps, `bluff` then `ksar`, painted in parts (ADR 0226, 0238). Both use the same golden-red
earth (`EARTH`), so the building grows out of the rock. The sun is on the right (ADR 0300).
- **Bluff** (O10, devlog 131; second pass O13, devlog 138): a hand-cut outline (noise ≤ 1.8,
  inside the sky's hang), painted as a Draa sandstone cliff. Its form is fixed (`BLUFF_FORM`,
  seeded by name, so only the brushwork follows the art seed): seven V gullies (two of them
  shallow creases where buttresses have merged, stopping short of the scree), buttresses 89–162
  wide between them, four hard beds and seventeen soft ones at uneven spacing. The shoulder's
  prow has no gully.
  - A red-ochre body, rosier and deeper on the left, golden toward the shoulder; the left ridge's
    west face a cool shade plane with its crown and stepped east side lit; the prow's face to the
    sun with a core shade further in.
  - **Strata** (`paintStrata`), shared by the whole face, never per buttress: the soft beds as thin
    broken lines that run on over several buttresses and fade, and broad faint bands of redder or
    paler sandstone between beds.
  - **Buttresses by plane** (`paintButtresses`), not rounded: the west side of each a flat
    violet-brown shade plane (`PLANE`) with a crisp arris that leans and jogs back at some hard
    beds, lost toward the foot; the east side a narrow lit plane. Some faces turn through two
    facets (a slanting arris, the west facet half in shade), some are fluted by long soft grooves.
    The arrises catch a broken lit line.
  - **Gullies** (`paintGullies`): a V in shade that tapers to a point over its scree cone, darkest
    high up where it bites deepest, the east wall in shade and the west wall lit. No cleft hangs
    below.
  - **Caprock** (`paintCaprock`): each hard bed, and a cap just under the rim (left of the
    shoulder), runs as long bands across the buttresses, broken where a stretch has fallen: a lit
    top of varying thickness over a dark undercut that is lost downward. The lip stands 2.5 proud
    of each gully wall. Up to five flat-topped alcoves sit under the hard beds, with a lit floor.
  - **Varnish** (`paintVarnish`): soft sheets under the lips and the rim, tapering and lost
    downward, with a few streaks through them.
  - A scree apron at the foot: a pale granulating wash laid over the face's foot, a cone at each
    gully's tip (pale on its sun side, shaded on the west), pebbles, a few fallen blocks; the scree
    spills onto the terrace. A warm bounce along the foot and a lit rim where the skyline turns to
    the sun.
  - Cost: marks of a kind are filled into one wet layer and dried once (`wetBatch`), not glazed
    one by one.
- **Ksar** (`ksar.ts`, deterministic shapes; O9, devlog 130): two courtyard palms, then six
  houses (three far ones stepping up behind three near ones), three pisé towers tapering 9 % a
  side, and three ruined curtain walls. No edge is ruled: the sides carry a slow bulge and a
  little crumble. Towers end in rounded, blunt corner horns with worn round merlons between;
  houses in a low parapet of small rounded merlons; curtain walls in an eroded crest with a
  breach worn to a saddle and sharp notches where chunks came away.
- **Ksar painting**: each block has its own earth (`tintOf`: the towers vary a little warmer or
  redder, the houses paler and cooler as they step back). A block's flank (the face turned to
  the sun) takes the palest gold; its front a wet-in-wet wash from warm upper right to cooler
  lower left, granulating, with pooled edges. An opaque underlayer just inside each outline
  hides what is behind (a wash stops short of its edge, so a paper fill would leave a white rim).
  The parapet gets its own small wash, because a big wash's outline is too coarse for merlons.
  Over that: soft patches of newer and damp mud, a cool shade at the front's left edge and foot,
  short broken formwork courses with a few putlog runs, rain streaks, and broken lit touches on
  the worn tops. Each tower and near house throws its shade left onto the houses behind it.
  Towers carry the carved band as loose brushwork: broken fillets, a zigzag of single flicks, a
  row of lozenges in four flicks each (some faint or missing), and two blind niches on the tall
  ones. Openings (`windows`) are few and placed loosely: slits, small squares and round-headed
  windows, darkest at the top, some with a palm-wood lintel, with a lit sill. Curtain walls get
  a lit crest, a shade under it, rain gullies and a couple of holes (`paintRuin`).
- **Ksar cost** (Z4, ADR 0345): a block's small marks dry per kind, one wet layer each (patches,
  courses, putlogs, rain, blotted corners, lit tops; a band's fillets, flicks and niches; a
  ruin's gullies, edges and holes; the openings' holes, lintels and sills), as do each palm
  frond's blades and the seat's cracks and lit edges. `ksar-batch.ts` lays the marks
  (`strokeInto`, `washInto`) and gives their drying (`strokeDry`). Most of the step's time is in
  the blocks' big washes, so the fronts' `wetInWet` takes 9 layers and the flanks' 6 (their
  `spread` is 0.02, so more layers added little).
- **Seat**: `SEAT_LINE` runs just above each block's base, with the rock swelling up into the
  walls in outcrops, and carried about 30 higher at the two ends (under the west curtain wall and
  the east tower's foot), where `paintEndOutcrops` models it as the bluff: shade west, sun east, two ledges. Every block is clipped above it, so no wall foot is painted over the rock
  and the bluff's own texture (beds, runnels) runs right up to the walls. The outcrops above the
  bluff's top get an underlayer and a granulating wash in the bluff's tone that is lost down
  into the bluff. Over it: the rock's tone creeping up the wall feet, shaded outcrop faces,
  short beds, a broken seam (a dark crack here, a lit edge there), fallen pisé under the ruins
  and a soft shade below the walls.
- **Seams for O5**: `ROCK_SHAPES` (`bluff`, `ksar` with each block's `front`, `flank` and `top`),
  `bluffTopAt` and `EARTH`.

### Water (O3, `paint-water.ts`)
Three steps, `basin`, `seguia` then `oued`, painted in parts (ADR 0226, 0238), after the walls.
The shapes are the layout's (`geometry.ts`); the big sand bar is the layout's `BAR`.
- **Basin**: a lime-washed coping of dressed stone (joints square to each wall), the near outer
  face warmer and darker, the inner faces under the coping (left lit, right turned away) with a
  wet, algae-tinged stain at the waterline. The water runs turquoise under the far wall into
  deep teal, green-brown in the depths. Seen low, the water is mostly mirror: the bluff and the
  ksar are reflected about their feet (y 470) onto the far waterline, squeezed to 0.17 so the
  towers' tops fall near the near rim. The teal is lifted under them first so the red reads warm,
  level breaks run across the mirrored rock (so it reads as water, not as a wall), then slow
  horizontal lifts and a few dark ripple strokes. Turquoise shows between the towers and along
  the near rim. The grove's palms reflect dark olive on the right. The phase's mirrored sky
  plate (`paintOasisWaterSky`) fades out toward the far edge, so its shine gathers near the rim. Slow rings spread from the inlet notch in the left coping.
  `BASIN_STEPS`: five short, foreshortened treads down the right wall from its far corner, two
  dry, the rest paler shapes under the water. `SLUICE_GATE`: a cut through the right coping at
  the near right corner, an upright post either side and a board in their slots with a thin spill over it.
  Both shapes are in `shapes.ts`.
- **Seguia** (O11, devlog 132): each run is a clay-lined cut: damp clay either side, the far
  bank's inner face in shade with a few lining joints, the water light-to-teal with the far bank
  mirrored dark under it, a lit, broken near lip lying over the water's edge (so the water sits
  in the cut), dark wet edges and a broken sky glint. A run that ends at a fall is clipped at
  its wall's top edge (`aboveWall`), so the water meets the lip instead of ending square. The
  last run widens toward the viewer. The sluice's channel runs from the gate to the oued.
- **Falls** (O11): small drops (`fallSheet`, half-width `fallHalf`: 6.5 at the lip, 9.5 at the
  foot). Under each: a damp halo on the wall, narrow at the lip and widest past the foot, the face
  soaked dark either side of the sheet, a little moss low down and a faint runnel. Then the
  sheet: reserved whole for the tongue (the top 45%), then as tapering strands with the wet wall
  between them; the tongue glazed turquoise, fading as it thins, a teal roll just under the
  brink and the shaded left side; the sky caught in a bowed lifted line along the brink and a
  gleam down the tongue's lit side; thin streaks down the strands; a churned turquoise pool and
  a row of white foam lifts across the foot, a few drops and a faint spray haze; the coping's
  edge soaked either side of the lip. The last fall's water runs on in a short lined cut
  (`BASIN_INLET`) and alone through the coping's notch into the basin.
- **Gate's spill**: the cut's outer half holds turquoise; the spill over the board is reserved,
  its roll in teal and the sky along its top; broken white foam lies along its outer edge at the
  sluice's head (kept off the posts), and the coping round it is damp.
- **Oued**: banks of damp, darker sand lost into the dry, then gold sand under milky blue-green
  water, deeper threads braiding round the bars (`OUED_BARS`: the big bar on the inside of the
  bend, a sliver upstream, one by the viewer's feet), riffles at each bar's head, flow marks,
  crisp wet edges along stretches of each bank (lost elsewhere) and pebbles on the bars and
  banks. `ouedAt(s, u)` maps along (0 upstream … 1 at the bottom edge) and across (0 left bank).
  No reeds: plants come from species.
- **Seams for O5 and O6**: `WATER_BOXES` (`basin`, each fall, `oued`, `gate`), `WATER_SHAPES`
  (`basin`, `rim`, `steps`, `gate`, `falls`, `seguia`, `sluice`, `oued`, `bars`) and `WATER`.

### Land (O4, `paint-land.ts`)
Steps `ranges`, `dunes` (soft), `ground`, `terraces`, `plots`, `footpath`, `walls` and
`foreground`, in parts (ADR 0226, 0238); `margins` is the garden's. Palette `LAND`, lit from the right.
- **Far**: lilac-to-rose flat-topped ranges lost into haze; gold dunes, their west lee flanks rose.
  O1b deepened the range (wash 0.42 → 0.64, from lilac with a third of the deep lilac into deep
  lilac and rose, a fade that keeps 40% at its foot instead of 10%) and started the dunes from plain
  sand, so on wide screens the band holds against the sunset sky instead of reading as a pale strip.
- **Ground**: gold sand with warm and cool passages, the pale basin terrace, damp sand along the
  seguia's last run and along both oued banks (a dark band, a cut-bank shade, a lit lip), wind
  ripples on open sand. **Beds behind the basin** (O12): damp tilled earth inside low lit bunds
(front and sides; the head opens to the ditch), broken furrows toward `BASIN_VP`, two beds
greened by a young crop, one dry and one just watered; a head ditch (a dark cut, a broken
sky-teal glint, a lit far lip) and a faint worked strip at the bluff's foot. **Terraces**: worked soil along the walls' curves, contour furrows,
  faint cross-bunds, greener toward the seguia. **Plots**: soft outlines, furrows toward a
  vanishing point, seedling rows, a watered side. Each plot lays its furrows' dark troughs, lit ridges and seedlings
  into three wet layers over its outline and dries each once (`paint-batch.ts`, ADR 0343). The
  back beds' furrows still dry one stroke at a time. **Footpath**: lifted and paled, footprints.
- **Walls**: pisé faces hung from the layout's copings (the grove wall runs 44 further left,
  under the basin's corner), formwork courses, streaks, a damp foot, a cast shade, a broken lit
  cap, fallen lumps. `WALL_FACES` (`shapes.ts`) is each face, for daylight and the wildlife.
- **Foreground**: the bund, a stone channel where it meets the seguia, a broken jar, stones, dry
  halfa tufts, and earth fallen into the basin's near-left corner.

### Vegetation (O4, `paint-veg.ts`)
Steps `grove` (after the ground) and `big-palms` (after the water), in parts. Every palm is the
date-palm species' tree (devlog 106), planned by `planPalm` (`shapes.ts`): arching rachises,
V-set leaflets, a wet crown wash, a few gold old fronds, the diamond leaf-base lattice.
- **Grove**: a shaded floor, a hazy back row and a nearer row of palms (batched wet layers), fig,
  pomegranate and olive masses lit from the right, crops as soft green bands before the wall.
- **Big palms**: the four `BIG_PALMS`, planned from fixed seeds: crown wash, back fronds, trunk on
  reserved paper (flared foot, lattice, sun on the right flank), the crown's heart, front fronds,
  date bunches on the three near ones, and a shadow cast left.
- **Seams for O5**: `VEG_SHAPES` (`bigPalms` with trunk, width and crown outline, `grovePalms`,
  `groveTrees`, `grove`), `PALM` and `haze()`.

### Paint parts (Z1, ADR 0330)
The oasis steps pause inside their loops so the cooperative painter can yield. Each grove palm's
crown is planned in its own part. Runs of dry-brush strokes, flicks and small glazes pause every
few marks (`pacer()`, `paint-pace.ts`), sometimes inside a clip. A pause adds no canvas call, so the
recording hash pins hold. In the app the cold oasis's longest part is about 18 ms on a quiet
laptop (it was 24–26). That part is Chromium rasterising the job canvas's queued composites, not
oasis code. A new loop of small wet marks should take a `pacer()`. A long run of like marks can instead share a
layer and dry once (`dryBrushInto`, ADR 0343): the near plots pause every three furrows and flush their
layers before each pause.

### Motion (O6, `motion.ts`, ADR 0282)
`createOasisMotion` is `OASIS.motion`. Like the waterfall's (Waterfall › Motion), it goes over
the still painting and never covers it. About 20 sprites are painted once in parts and sealed into
`ImageBitmap`s. Each frame blits them as a pure function of `t`, played at `TEMPO` 1.25, the
waterfall's pace. Each element is clipped to its own water.
- **Seguia falls** (`FALLS`, from `SEGUIA_FALLS`, `fallSheet` and `fallHalf`): per fall, five
  narrow lanes (0.28–0.32 of the sheet, like the painted strands) with two marks each, out of
  phase, so the sheen never stops. Three are lifted lights and two are long greyed-turquoise
  surges (`SURGE`). The surges run 0.85–1.25 of the fall long, so their heads are lost in the
  splash and never read as drips. There are also four threads, bright or teal, spread across.
  Water leaves the lip at 16 units/s and reaches the foot at 44 (`fallDropAt`, constant gravity,
  about 1.1 s; 0.9 s on screen). Clip: the sheet. At each foot, four pale puffs flicker up out
  of the painted foam across its width (0.7–1.1 s, O11) and a turquoise pool breathes either side. Clip: an ellipse round the foot and the
  channel below it (fall 0) or the inlet (fall 1).
- **Sluice spill** (`SLUICE_GATE.spill`): five glassy lights, each a white dash over a small teal
  trough, slip outward over the board and off its lip (1.1–1.7 s). A small puff pulses where the
  spill drops. Clip: the gate's cut, the spill and the sluice's channel.
- **Basin**: three rings from `INLET` (the notch in the left coping, `BASIN_INLET`), flattened to 0.09 for the low view, 11 s each, spreading ever
  slower to 150 units and fading. Three ring sprites (30, 70, 140 wide) keep the line's width as
  a ring grows. Clip: `BASIN_WATER`. The rest of the basin gets nothing: the oasis sets
  `pondSurface: 0`, so the scene's generic shimmer, rings and glints stay off it and the basin
  is a still mirror (O1b, ADR 0302).
- **Oued**: 56 drifters (glints: a white dash over a teal trough, so it reads on the milky water;
  riffle lines: a teal crescent with a light under it) start each pass at a table-drawn `(s, u)`
  and drift down `ouedAt` at 10–15 units/s, faster and larger toward the viewer. `liveliness`
  skips a pass more often over the deep braids (as `paintOued` lays them, weight 0.35) and less
  near a bar's head (up to 1.6). Four riffles stand at each of the three bar heads, parting either
  side and slipping a little downstream as they pulse. Clip: the oued with the bars cut out
  (even-odd).
- **Cost**: at most 110 blits and 7 clips a frame (tested), with everything in
  view. `MOTION_BOXES` skip any element the view misses, and `MOTION_BOUNDS` skips the whole draw.
  Bench numbers are in devlog 117.
- Under reduced motion the scene never creates it, and `still: true` draws nothing. `freeze()`
  holds `t`. It draws on `waterSurface`, under the light plates, so noon, the low suns and night
  tint it like the painting. White lights turn moonlit blue at night and the teal troughs keep
  them readable. Studio: `oasis-motion/falls`, `/falls-frames`, `/oued`, `/oued-frames`, `/gate`,
  `/inlet`, `/inlet-frames`, `/oasis-motion-sprites`.

## Coast (phase 15, ADR 0360)
A tended clifftop garden stepping down to an Ionian cove, from draft B ("Stepped terraces down to
the shore", the owner's choice; docs/research/coast-biome.md §1). G1 (devlog 170) made it a scenery
behind `?dev&scenery=coast`. Its painting, sky and light were placeholders: draft B's steps moved
onto the final layout (`paint-placeholder.ts`; `drafts/b` is a record). The rock, water, land and
vegetation, daylight and motion tasks replace them; G2 (devlog 175) painted the rock and G2b (devlog 180) gave it a second pass at its seams with the water and the land (Rock below);
G5 (devlog 182) painted the skies and the light (Daylight below).
Composition map: studio `coast-map/map`; the rock: studio `coast-rock`.

```
y    0 ┌──────────────────────────────────────────────────────────────────────────────┐
       │ · stars (y 20–150) ·      moon (524,268)→(640,198)→(770,254)                 │
  200  │ leaning pine crown            ○ suns (8–16°)                olive crown      │
  300  │ far hill, village, chapel ╲   ○  ┃┃┃┃ temple      ___ promontory, pines ___  │
  400  │ ════ sea horizon ═══════════╲  ╱═══════╲ point 636 ‾‾‾ foot y 500 ‾‾‾‾‾‾‾‾‾‾ │
       │      caique (430,500)          ╲ shelf ╲  top terrace · olive (1290,540)     │
  580  │                                 ╲cove ═══ W1 (856→1620, y 578→560, h 40) ═══ │
       │   shallows · splash rocks      bastion ╲  middle terrace                     │
  716  │                                  ╲cove  ═══ W2 (772→1620, y 716→694, h 44) ═ │
  760  │ ‾‾ beach waterline (y 742–812) ‾‾ steps ╲  lower terrace                     │
  850  │   beach · rock shelf · pools (y 886–902)   ═ W3 (690→1620, y 855→834, h 48) ═ │
 1000  │   (paper margin)                 path ▒ foreground                          │
       └──────────────────────────────────────────────────────────────────────────────┘
```
- **Light from the left** (ADR 0360): the sea and the open sky are on the left, and draft B is lit
  from the upper left. `sunSide: { sunrise: -1, sunset: -1 }`; both suns stand over the sea's
  horizon (y 400) between the far hill's foot (x 516) and the temple's point (x 636): sunset x 552,
  sunrise x 636. The moon arcs (524, 268) → (640, 198) → (770, 254), over the bay and the temple,
  inside a phone's crop all night (G5); the stars (y 20–150) keep a gap round it.
- **Skyline**: sampled every 2 units from the painted silhouette (`silhouetteAt`: the far hill, the
  horizon, the promontory and each column), so the sky runs between the columns. The architrave,
  the olive, the leaning pine and the promontory's pines cross it and take the sky's wash.
- **The promontory** (x 636–1620, top y 393 at the temple to 294 at the right, foot y 500) carries
  the temple on its point: a stylobate at y 393 (x 680–830), four columns (two tall under an
  architrave fragment, two broken) and a fallen drum. Its foot is the top terrace's back.
- **The shoreline** (`SHORE_EDGE`) is broken, not one diagonal: the top terrace ends in a rock shelf
  (tip x 792), the sea cuts in under it, the middle terrace ends in a rock bastion (tip x 690) with
  a second cove below, the lower terrace ends in scrub, and stone steps come down to the beach at
  (684, 812). Boulders and scrub are painted over the edge.
- **Terraces**: three dry-stone walls, each holding the terrace above it (`WALLS`, `WALL_TERRACE`).
  Lifts as the oasis (ADR 0300): lower 48, middle 92, top 132. The big olive stands on the top
  terrace at (1290, 540), right of the path; the gravel `PATH` climbs from the bottom edge (900,
  1000) up the three walls by stone flights (`STEPS`) to the olive.
- **The sea edge** sits above the paper margin (`paintMargins` lifts the bottom 166 units, and up
  to 320 at the sides near the bottom): the beach's waterline runs y 742–812 and its back y
  840–852, and three pools lie in the rock shelf at y 886–902. Splash rocks stand in the shallows.
- **Water**: `SEA_WATER` (from the horizon to the promontory's foot, the shoreline and the waterline)
  is the still `pond`, waterline y 400. No streams. The rock pools are `POOL_WATER` (not on the
  geometry; their slots are water slots).
- **View**: focus (760, 600). The phone crop (x 460–1060) holds the temple, open sea across more
  than a third of its width, shallows, splash rocks, beach and pool slots, beds on all three
  terraces and both low suns. A 16:9 screen shows y 100–1000: 190 units of sky above the temple.
  `pathOut` is `PATH`.
- **Flora** (ADR 0361): `{ realm: 'mediterranean', biomes: ['coast', 'scrub', 'garden', 'marine'],
  climate: 'mediterranean', cultivated: true }`, the research's profile. By biology it offers the
  species shared with the oasis and the ice plant so far; the phase 15 species bring the rest.
  - **Shared** (GF1, devlog 174): the caper and the ice plant are `cultivatedIn: ['mediterranean']`;
    the pomegranate and the grapevine gained `'mediterranean'` in `cultivatedIn`; the oleander (stream-beds
    and scrub) and the southern maidenhair (seeps on wet sea cliffs) gained the biome `scrub`
    respectively `coast` and the climate `mediterranean` in their wild range. The oasis's and the
    Japanese gardens' offers did not change.
  - The olive and the lavender (paint tasks) add their own `cultivatedIn` or wild range.
- **Wildlife** (GK0, ADR 0373): see Wildlife below.
- **Sound** (G7, ADR 0376): `coast`, its own bed; see Sound below.

### Slots (48)
| Habitat ("words") | Count | Where | Sizes |
|---|---|---|---|
| water ("in the shallows") | 9 | `shallows-1…6` in the cove's near shallows (y 590–706), `pool-1…3` in the rock pools | 1 large (`shallows-1`, the seagrass meadow), 4 medium, 4 small |
| shore ("on the beach") | 5 | `beach-1…5` on the pebble beach | 1 large (`beach-2`), 1 medium, 3 small |
| meadow ("in the terrace beds") | 12 | `top-1…3` on the top terrace, `mid-1…5` the middle, `low-1…4` the lower | 1 tree (`top-1`, the top terrace's left end), 1 large (`mid-1`), 3 medium, 7 small |
| path ("along the path") | 5 | `path-1…3` on the foreground, `path-4` on the lower terrace, `path-5` on the top terrace | 5 small |
| back ("in the scrub") | 6 | `scrub-1` (tree, the promontory's foot behind the top terrace's right end), `scrub-2` by the pine's rock, `scrub-3…6` the foreground's scrub | 1 tree, 1 medium, 4 small |
| rock ("on the walls and rocks") | 11 | `wall-1…5` on the copings, `crack-1/2` in the wall faces, `splash-1…3` on the splash rocks, `shelf-1` on the bastion | 2 medium, 9 small |

Raised slots (on a terrace, a coping or a face) take their terrace's lift; the rest take
`perspectiveScale(y)`. Each terrace's slots stand in the gaps between those of the terraces
behind, so no plant stands over the base of one higher up, and neither tree hides a slot. The
tree slots' crowns keep clear of the temple and the sun's paths.

### Water (G3, `paint-water.ts`, `boat.ts`, shapes in `sea.ts`, ADR 0366)
Steps `sea` and `caique` (element `sea`, before the rock) and `beach` and `pools` (element
`beach`, right after `shore`), in parts. Palettes `SEA`, `SAND` and `BOAT`; lit from the left.
- **Depth** (ADR 0366): `shoreDistance` measures from the near shore (`SHORE_PATH`: the shoreline,
  then the beach's waterline), the vertical stretched 2.4× and the rock's foot made steep.
  `shoreContour(r)` finds, per 6-unit column, the first point down from the horizon nearer than
  `r`, smoothed more the farther out, so the lines round the coves without looping. `DEPTH`:
  shallows 150, turquoise 420, deep 640.
- **Sea**, light to dark, every wash running from above the horizon (clipped to it) past both
  sides, under the promontory, the land and the beach: glassy aquamarine everywhere; a paler
  turquoise and then the strong turquoise out past the shallows' edge; ultramarine into deep teal
  from the horizon, lost downward; ultramarine far out. Then the seabed (`SEAGRASS` meadows and
  `SEABED_ROCKS`, granulating, one layer each; `SAND_WINDOWS` lifted behind the shallows' plants),
  the horizon's haze, the far hill and the village's walls mirrored (`HILL_REFLECTION`), the pale
  cliff mirrored under its foot (`CLIFF_REFLECTION`) with a dark line at the foot (`CLIFF_FOOT`),
  level breaks across both, wind lanes as broken pale streaks in four uneven bands, a few short
  dark ripples, and dry-brush sparkles on the left.
- **Beach**: paper reserved from just above the waterline to the beach's back (`beachBody`; the
  sand's wash runs 8 past it over the shelf's edge), wet sand graded to pale dry shingle, a warm
  glaze up the beach; shingle by spatter in drifts, larger pebbles with a shade to the lower
  right; the wrack line (`WRACK_LINE`) in broken dry brush with shells. At the water: an aquamarine film thinning over the sand, broken
  wet dark sand, and the foam as lace along two scalloped reaches of `FOAM_LINE` with bubbles.
- **Pools**: each `POOLS` outline reserved and washed aquamarine with a dark wet edge, a hinted
  bottom, a soft darker middle, the far rim's shade with its pale reflection under it, and a sky
  glint. The rims (the rock task) are painted before them (ADR 0366).
- **Caique** (`CAIQUE_SHAPES`, about `CAIQUE`, scale 0.85, bow left): the white hull mirrored soft
  and then in broken slices, the red and blue bands and the mast mirrored in pieces, the hull's
  shade on the water; the hull reserved white with a cool shade low and at the stern, the far
  gunwale's wooden inside, a blue sheer strake, a red band at the waterline, the dark gunwale cap,
  blue stem and sternpost heads; the mast, the sail furled on its yard with ties, the mooring line
  to a red buoy with a ring.
- **The generic water surface** (`water.ts`) is off the sea: the coast sets `pondSurface: 0` (ADR
  0302), and its own motion plays the swell (Motion below).
- **Seams for motion and daylight**: `shallowsEdge()` (the pale shallows' edge), `FOAM_LINE` (the
  waterline's foam, left to right), `WRACK_LINE`, `CAIQUE_SHAPES` and `CAIQUE_BOX` (the boat, its
  mast and its reflection: what a rocking sprite covers), `CLIFF_FOOT`, `CLIFF_REFLECTION`,
  `HILL_REFLECTION`, `SEA_RECT`, the seabed patches; `POOL_WATER` (geometry).
- **Cost** (dev server, 1440×900 at DPR 1, overview, `sceneStats().timings`): sea 174 ms in 446
  parts (longest 12 ms), caique 11 ms (190 parts), beach 61 ms (171 parts, longest 6 ms), pools
  19 ms (289 parts): about 265 ms in all.
- Studio `coast-water` (153): `sea`, `cove`, `shoreline`, `beach`, `pool`, `caique`, `scene`.

### Rock (G2 and G2b, `paint-rocks.ts`, `temple.ts`, `village.ts`)
Ionian limestone, white-grey to warm cream, lit from the left over the sea; shade planes cool
violet-grey; sunlit planes lifted back toward paper. Palette `LIME` and `MARBLE` (`rock-kit.ts`, with
the shared helpers: `rough` outlines, `wetBatch` and `liftBatch`, which wet a kind of mark into one
layer and dry it once). Steps:
- **`far-hill`** (`far` element, soft): two headlands as pale blue-violet washes (`HEADLANDS`: a far
  ridge over the hill's left end, a low island behind the temple's point, under the sky's wash and
  clear of the suns' gap x 516–636), the far hill in haze (lilac grey into greyed maquis, its right
  slope in shade), maquis patches, a few cypresses and a dark line where it meets the sea.
- **`village`** (`rock` element, after the sea so the sea's lobes never cover it): the layout's
  `VILLAGE` as `VILLAGE_CUBES` (`shapes.ts`, fixed seed): one to three white cubes per house, an
  upper storey on some, in rows from the top of the slope down. Each row: walls lifted to white, a
  pale lilac shade side and foot, tiny dark openings. The chapel at `CHAPEL`: a white cell, a bell wall
  with its arch on the left, one clear blue dome with a lit shoulder, a small cross.
- **`promontory`**: the layout's outline cut by hand (noise ≤ 1.1, inside the sky's hang), run on past
  the right edge and 16 below the foot where the top terrace overlaps it. An opaque pale underlayer
  first, so no paper shows at the point (the placeholder's sliver). Its form is fixed
  (`PROMONTORY_FORM`, seeded by name), irregular on purpose so it never reads as coursed masonry
  (G2b, devlog 180): fissures at uneven spacing (a quarter of them in pairs 12–26 apart, the rest
  34–95 near the point and 55–210 further on; about a third shallow cracks), leaning −0.22…0.3,
  zigzagging at two scales, some opening below the rim and some with a side branch; beds 5–32
  apart, each with its own tilt on the face's slope (`SLOPE` ± 0.04) and its own wander, stepped
  across the deep fissures, a third of them hard.
  - A cream-to-white-grey body wash; each block between deep fissures lit high on its left (a lift)
    and a shade plane on its right that eases in width, jogs at the hard beds and darkens into the
    fissure (three marks in one layer); a half-tone facet on some.
  - Beds: short faint lines for the soft ones; the hard ones as ledges whose lit lip crumbles into
    pieces over an undercut that thickens and thins; a fifth of them an overhang, its shadow deep
    under one end and lost toward the other.
  - Fissures as broken tapering darks with a lit hairline on the sunward wall, branches and a few
    side cracks.
  - Ochre and rust stains under the rim and the ledges, long grey limestone streaks, fine runnels.
  - The foot: a cool shade low on the face; along the sea (x 636 to the shoreline's start) one soft
    undercut graded darker downward, its depth wandering and pinched where a buttress comes down,
    a lit overhang over it in places, and a dark wet algae band at the water.
- **`temple`**: a krepis of three steps (the left ends broken away; shadows under the lips that come
  and go, a few joints, chipped arrises), the fallen drum (short, its fluted flat end to the light)
  and four blocks; the four shafts (`columnShapes()`: a slight taper and swell, hand-cut edges, the
  broken ones ending in a jagged slant that stays on or above their skyline shape), each ivory with
  a cool shade side turning toward the right rim, broken flute touches, drum joints that arch a
  little and come and go, rust runs; two Doric capitals (abacus, echinus, necking lines); the
  architrave slumped 2.5 to the left, two fasciae, its right end broken.
- **`cliff-foot`** (`stones` element, before `shore-rocks`; ADR 0370): the cliff's foot over the top
  terrace's back, which the land leaves ruler-straight (`LAND_BACK`, y 496–500). The face's lowest
  35–60 units in a cool violet-grey glaze lost upward, so the lit gravel reads as ground in front
  of a wall of rock; a toe of rock coming down 2–9 over the land's edge, unevenly; the shade at
  the base on the gravel and a broken dark seam where rock meets it; low scree fans of pale grey
  debris under the fissures (and five more places), shaded on the right, with stones on them and
  spilling beyond; `CLIFF_STONES` (seven fallen stones, `shapes.ts`) as boulders on the ground.
  It skips itself when the view does not reach the foot.
- **`shore-rocks`** (a `stones` element after the land and the shore, before the trees):
  - The rock shelf in front of the beach, with the pools cut out (`POOLS`, the water painter's).
    Its top edge (`shelfTopAt`) is not a line: `SHELF_LOBES` run rock tongues up to 11 into the
    sand and hollows down to 5 where the sand drifts in. Its right end meets the lower wall's
    foot and the flight's landing, so no bare strip is left. Pale slabs with broken crack lines,
    lit lips and shaded fronts, pits, the rock wet round each pool; sand drifted into the hollows
    and the cracks near the beach; a lit arris where it rises out of the sand; pebbles gathered on
    the sand at its foot, each with its shade. A wet rim over each pool's edge, the far inner wall
    in shade and a lit near lip.
  - The shoreline as one broken limestone ledge, down `SHORE_EDGE` to the head of the beach flight
    (`LEDGE_EDGE`), where the rock yields to the steps: a pale grey top on the land behind the edge
    (7–22 wide, ragged inside, cracked); under the runs that face the viewer, a face in blocks
    12–30 long of their own height (11–22) with a small step at each top, a lit arris, joints,
    shade toward each block's right end, pits, a dark wet foot with weed; along the runs that face
    away, a wet lip under a lit arris. At the water: a contact shade and a broken reflection under
    the faces, a contact shade along the lips, and broken foam along both.
  - The beach flight (`FLIGHTS[BEACH_FLIGHT]`, the land's `paintFlight`): narrow slabs running down
    to the left along the shoreline from the lower terrace onto the beach's tip (ADR 0370).
  - Stones at both beach ends (the `stone` recipe), none on the flight.
  - `SHORE_BOULDER_SHAPES` and `SPLASH_ROCK_SHAPES` (`shapes.ts`, `boulderShape`): sea-worn
    boulders seen a little from above, all wet in shared layers each clipped to its own outline
    (`clipBatch`). Each is a squarish dome with rounded shoulders, one shoulder cut by a flat
    facet and a small step in the crown. Its crown is the broad dry top (`top`), whose front edge
    sits 2 below the slot. The rock has a pale lit crown and left shoulder, the right flank and
    the face below the crown turned from the sun, sea-worn pits and a crack. In the water, each
    has a dark wet foot with a weed band and weed tongues, a broken reflection (dark under the
    foot, pale slices further down) and a broken foam ring with a fainter lap mark. On land
    (`ground`) it has a dark contact and a shadow cast right. The shore boulders are the layout's
    four (`SHORE_BOULDERS`), dropped 14 into the water at the ledge's foot, or left on the ledge
    where that is land. With them are nine small ones out in the water along the faces and lips.
    The one on the beach flight is left out.
- **Edges for the other painters**: the sea is under the promontory (its foot and undercut end at
  the layout's foot), under the ledge's faces (which hang 11–26 below `SHORE_EDGE` where it runs
  down-right) and under the boulders (whose wet feet end at each rock's `y` + 3–5). The land is
  painted over the promontory's foot (16 under it) and under the cliff-foot and shore-rocks steps.
  The pools' water is cut out of the shelf; the rims reach 1.5 over it. The cliff's reflection is
  the water's (`CLIFF_REFLECTION`); the boulders' and the ledge's are the rock's.
- **Cost** (headless Chromium, DPR 1, the overview at scale 0.9, cold then best of three warm, A/B
  against `main` on the same machine): cliff-foot 21 / 19 ms (new), shore-rocks 127 / 117 ms
  (main 160 / 151), promontory 102 / 95 ms (main 98 / 92). The whole coast is 1.40 s cold and
  1.26 s warm, against 1.40 s and 1.28 s on `main`. The longest part of the rock's steps is 6.6 ms.

### Land (G4, `paint-land.ts`)
Steps `land`, `walls` and `beds` (element `land`), in parts. Palette `EARTH`, lit from the left
over the sea. Shapes live in `coast/shapes.ts` (data only, devlog 149).
- **Ground** (`land`): `LAND` is reserved, then pale limestone gravel bleeding into dry earth, a
  few broad warm and cool glazes, the promontory's cool shade over the top terrace's back (a narrow band, 24 deep), darker
  earth on the foreground. Raked gravel: broken dry-brush lines along each terrace's walk, between
  the wall above and the beds (one batched layer per terrace, ADR 0343). About 900 grit specks in
  one layer. **Path**: `PATH` lifted pale down its length, a warm glaze, a trodden middle, its
  darker gritty edges in one batched layer.
- **Walls** (`walls`): for each wall, its shade cast on the terrace below, the face reserved and
  washed (warm up top, cool at the foot), then dry-stone work clipped to the face: a coping course
  of broad slabs over rough courses of flat pieces (`wallStones`). Three batched layers: the
  joints (the face dark with every stone lifted out, and a soil pocket at each crack slot), the
  stones (each its own limestone), and each stone's shade on its lower right. Then ochre and grey
  lichen and rain streaks, the coping's broken lit top and the shade line under it (batched), a
  shaded foot, and dry grass tufts (`WALL_GRASS`, away from the wall and crack slots).
  `WALL_FACES` steps down over its last 60 units at the seaward end (`wallDrop`), so a wall ends in
  the slope instead of a cut. `WALL_TOPS` are the copings.
- **Flights** (end of `walls`; the beach flight is painted by `shore-rocks`, ADR 0370): `FLIGHTS` from `STEPS`, each step a rough slab with a lit tread
  over a shaded riser, a worn lit nose, and the flight's shade cast right.
- **Beds** (`beds`): `BEDS`, ten rounded strips of tilled soil along each terrace's front behind
  its coping, under every bed slot. They share one soil layer (darker toward the coping), one layer
  of raked furrows and one of lit grit lips on the gravel side. They hold no plants: the player
  grows them. Then the two terracotta pithoi (`JARS`), off every slot.
- Work whose box misses the canvas is skipped (`inView`): a close view paints only what it shows.
  Each wall, bed, flight and jar has its own rng, so skipping one changes nothing else.

### Vegetation (G4, `paint-veg.ts`)
Steps `maquis`, `olive` and `pine` (element `trees`), in parts. Palette `VEG`, lit from the left.
- **Maquis** (`maquis`): `MAQUIS` along the promontory's back (paler toward the temple),
  `PROMONTORY_PINE_SHAPES` (thin trunks under flat broken umbrella crowns), `PHRYGANA` cushions
  (grey-green or summer rust, a short shadow to the right, twiggy flicks), `SHORE_CLUMPS` in pockets of soil behind the shoreline ledge (G2b moved them off the rock), softening
  the shoreline's edge, and dry golden `GRASS` on the terrace ends and the foreground. Every clump
  is a cloud of scalloped lobes in two batched layers: the lit body, then each lobe's shade on its
  lower right.
- **Olive** (`olive`, ADR 0367): the olive species' tree, `planOlive(OLIVE_TREE.seed)` at growth
  1, at 1.12× its box with its base on `OLIVE.base`, painted with the species' helpers one layer
  per part. The scenery adds paper under the trunk, its shadow on the gravel and a clip at its sole.
- **Pine** (`pine`): the leaning Aleppo pine on `PINE_ROCK`: a reddish trunk on reserved paper
  (`PINE_TRUNK`) with scaly plates and its left flank lit, crooked branches (`PINE_BRANCHES`), open
  needle pads (`PINE_PADS`): a light wash of tufts, then dark, mid and lit fans of fine needles,
  then cones.
- Crowns above the skyline (olive, pine, promontory pines) take the sky's wash, as devlog 170
  says. They reserve no paper there, so no white gaps show.
- **Perches for the wildlife** (all in `shapes.ts`): `WALL_TOPS` (the copings), `OLIVE_LIMBS` (the
  olive's trunk and scaffold limbs, checked against the plan), `PINE_BRANCHES` and `PINE_TRUNK`,
  `JARS` (rim at `y - h`), and `PROMONTORY_PINE_SHAPES`.
- **Cost** (headless Chromium, DPR 1, overview at 0.9, warm, load ≈ 5): land 155 ms, walls 235,
  beds 62, maquis 96, olive 37, pine 48: about 640 ms (900 ms cold). The longest part is 9.6 ms
  (a wall's batched layer).

### Wildlife (GK0, ADR 0373)
`fauna.ts` holds the whole table: the island cat from the start; then the gull, cicada, Balkan
green lizard, cabbage whites, marbled rock crab, bees, swallows, blue rock thrush, swallowtails,
goats, Hermann's tortoise, damselfish, scops owl (night only), hoopoe, house gecko (night only),
octopus, heron and dolphins (the last three rare). Rows whose creature is not painted yet are
skipped; the shared bees, butterflies, swallows and heron come now (docs/systems/fauna.md › The
coast). `wildlife.ts` reads every place by name from `layout.ts`, `shapes.ts`, `sea.ts`, `slots.ts`
and `geometry.ts`:
- Still water is `SEA_WATER`; the rock pools (`POOL_WATER`) join the water layers' clip as `moving`.
- Perches (54, none within 20 of a slot): the copings (`WALL_TOPS`), the olive's fork and limbs
  (`OLIVE_LIMBS`), the pine's branches (`PINE_BRANCHES`), the jars' rims, the splash rocks' tops,
  the architrave, the broken columns and the drum, the caique's mast top and rail (they ride its
  carrier), the far pines' crowns and seven ledges across the promontory's face. Far ones carry
  their own measure: `TEMPLE_SCALE` 0.13, `CAIQUE_MEASURE` 0.09.
- Ground: each terrace's gravel walk (three per terrace), the path, the beach and the scrub at the
  terraces' ends. Faces: the three walls where they stand full height, and the splash rocks' fronts.
- Regions: the shallows (water minus rocks), the three pools, the bay far out under the far hill
  (left of the low suns' glitter path; the sea plane's scale, 0.01 → 0.04), the sky over the cove,
  the olive's and the pine's bark.
- The heron wades at three stands off the beach's waterline. `coastPerspective(x, y)` gives the
  terrace lifts and faces on the land and `perspectiveScale(y)` elsewhere; within 0.02 of every slot
  but `crack-1` (0.03: a slot in a face takes its own y's lift, the face its coping's scale).
- Studio `coast-wildlife` (`targets`, `targets-close`, `targets-far`) draws every place over the
  painting; `fauna-coast/all` runs the table over the cove.
### Sound (G7, ADR 0376)
`Scenery.sound` is `coast`, the coast's own bed (docs/systems/audio.md › Coast): the sea breathing
on a pebble beach (a wash up the shingle every 6–10 s, then the hiss and rattle of stones drawing
back, over a far surf and small laps at the rocks), a light breeze in the pines, and a far cicada
chorus that swells toward the hot afternoon and stops at dusk and in rain. Rare voices sit where
the painting puts them: the caique's rope and hull and the chapel's sunset bell to the left, goat
bells on the promontory to the right, a far gull anywhere; at night a Scops owl's spell and a few
crickets. The mixer reads The sea on the pebbles, Breeze in the pines, Cicadas, Gulls and goat
bells, The owl and crickets. A `coast:gull`, `coast:goats`, `coast:scops-owl`, `coast:cicada` or
`coast:swallows` sighting makes its sound more frequent (`fauna.ts` ids).

### Daylight (G5, `sky.ts`, `light.ts`, `daylight.ts`, ADR 0372)
The painting is on white with no sky step; the sky is the daylight's plates (docs/systems/daylight.md
› Coast). Studio `coast-daylight` (158).
- **Cut round the temple** (ADR 0372). `plateSky()` follows the ground without the columns
  (`groundAt`: the far hill, the horizon, the promontory) with a 4-unit hang, 0.5 over the krepis.
  A second clip takes out `TEMPLE_CUT`: each painted shaft (`columnShapes()`), the two capitals and
  the architrave, 0.7 inside their edges. Each base wash covers `washSky()`, the same line 48 lower,
  so no wet edge shows. The sky reaches every column's edge, runs under the architrave, and covers
  the island behind the base. `SKYLINE` is unchanged (the sun's clip, the stars, the slots).
- **Skies**: midday a clear cerulean overhead thinning to a warm haze on the horizon, two small
  soft clouds lifted out (330, 176) and (940, 118); sunrise lilac into pale peach, a gold glow round
  the sun, a pearly haze on the horizon, two quiet lilac bars; sunset violet over rose, an apricot
  band low, an ember glow round the sun, three violet bars lit apricot underneath; night a deep
  granulating blue paler over the horizon, the shared 30 stars and 170 smaller ones
  (`COAST_NIGHT_STARS`, kept off the pine's pads, the olive and the temple). After the clip, the far
  hill and the headlands are glazed in each phase's colour (`DISTANCE`).
- **Sea plate** (`COAST_WATER_SKY`): the horizon's colour and the near water's as two washes lost
  into each other: turquoise at noon, pearl and peach to a softened turquoise at sunrise, apricot
  to dusky teal at sunset, night blue to ink. A broken path of light under each low sun (sheen plus
  soft dashes, `sunPath`) and a moon path at night. The plate then thins toward the viewer
  (`WATER_NEAR`, over `WATER_FALLOFF` 280 units), and lies on the sea at `COAST_WATER_ALPHA`
  (`ScenerySky.waterAlpha`, 0.34–0.78): far water mirrors the sky, the shallows keep their floor.
- **Light** (`light.ts`): shadows to the right and toward the viewer (both suns are over the sea on
  the left): the promontory's face and foot, each wall's face and the strip below it, each column
  along the krepis, the olive's trunk and crown on the top terrace, the leaning pine's on the
  beach; short pools at midday. Sunrise and sunset: warm paper on the temple and each shaft's lit
  flank, the village, the olive's sun side, the pine's trunk and the walls' seaward ends; the
  promontory rose; the near cove lifted so the warm grade does not grey it (midday too). Night:
  cool paper on the temple, the point, the village and the cove, seven lit windows
  (`LIT_WINDOWS`, from the village's painted openings) and the chapel's lamp (`CHAPEL_LAMP`), small
  and steady, and the extra stars.
- **Grades** (`COAST_GRADES`): the low glows over the sea at each sun's x (glowY 0.4), no lantern,
  sunset apricot 0.34, night a blue 0.5.
- **The temple's shade** starts under the slanted break on the broken shafts, and the architrave's
  is clipped to the fragment (`temple.ts`), so no dark wedge stands against the sky.
- **Cost** (Chromium, dev build, laptop under load, `bench.mjs`-style timing of each plate's own
  painting): sky plates 107–250 ms (night the cheapest, sunset the dearest), sea plates 44–64 ms,
  light plates' marks 72–98 ms (night 1). The oasis's on the same run: sky 105–221, basin 41–70,
  light 70–135. Each plate is one task, as in every garden.

### Motion (G6, `motion.ts`, `pose.ts`, ADRs 0282, 0374)
`createCoastMotion` is `COAST.motion`, in the coast's lazy chunk. Like the oasis's (Oasis ›
Motion) it goes over the still painting, about 60 sprites painted once in parts and sealed into
`ImageBitmap`s; each frame blits them as a pure function of `t` (the renderer's animation time,
which `freeze()` holds; tempo 1). All of it is slow and faint: nothing should pull the eye from the
plants.
- **Swell** (clip: `SEA_WATER` less every rock outline): 80 pale streaks (two or three soft lifted
  pieces over a faint teal trough) and 22 longer troughs drift in toward the beach at 1.1 units/s
  times `seaScale(y)` (nothing at the horizon, 1 by the beach), each living 7–13 s. 20 glints
  (a white dash over a teal trough) flicker 1–2.6 s, mostly far out. Each mark draws its start from
  29 places picked once (more toward the horizon, 0.3 as often over the pale shallows, 0.1 for
  glints, none near rock or the boat, start and end in the sea), so a mark repeats a place after
  29 passes (4–7 min) and no two share a cycle.
- **Waterline** (clip: a band along `FOAM_LINE` less the rocks): nine overlapping reaches, each
  with a lace (scalloped broken foam and bubbles), a wet band (`SAND.wetDark`) and a sheet of water
  (`SEA.aqua`), their ends feathered. Every 7–11.5 s, out of phase, a reach runs 4–10 units up the
  shingle in the first third (ease out), the lace brightening and the sheet following, then draws
  back while the wet band left at the top dries.
- **Rocks** (clip as the swell): a foam ring along each wet boulder's and splash rock's foot (from
  their `columns`, curling up behind at both ends) swells out 2 units and 9 % wider and fades,
  every 5.5–9 s. The ledge's lips (`SHORE_RUNS.lip` above the flight) and the cliff's foot
  (`CLIFF_FOOT` in 45-unit stretches, feathered) lap the same way, 6–10 s.
- **Pools** (clip: `POOL_WATER`): still mirrors; now and then (a 29–47 s cycle, about half the
  passes) one small ring spreads over 9 s.
- **Caique** (ADR 0374): `under` draws a plate of the sea painted without the boat (the painting's
  own `sea` step over `CAIQUE_BOX`, 5 px a unit, feathered over 6 units) and the reflection, mirrored
  to the pose (its lifts over the water, its colours multiplied in), before the mirrored sky. `draw`
  then adds a ring spreading from the hull now and then (two cycles, 16–27 s), the mooring line as
  a thin stroke from the posed stem to the water, the hull and rig carried by the pose and clipped
  at the water line (the keel runs on under it), and the buoy bobbing on its own.
- **The pose** (`pose.ts`, eager): `caiquePose(t, out?)` → `{ dx, dy, angle }` about `CAIQUE`, the
  angle clockwise in radians: two bobs (6.7 and 3.9 s) and two rolls (8.3 and 4.7 s) and a slow
  surge on the mooring (23.3 s), within `CAIQUE_SWING` (0.9, 1.15 units, 1.9°). `posePoint(q, pose)`
  carries a point of the boat at rest. Each `draw` writes the pose into
  `COAST_CARRIERS.caique.pose` (ADR 0373), so a perch on the mast or the rail rides the boat via
  `carried`. Under reduced motion nothing writes it: it stays at rest, on the painted boat.
- **Layers**: everything is on `waterSurface`, under `entities`: a plant in the shallows (the
  Posidonia) or a pool is drawn over the marks, which pass under it as if it stood above the
  surface; the marks never draw on a plant. The light plates are multiplied over the marks, so
  noon, the low suns and night tint them like the painting (white lights go moonlit blue at night).
- **The generic surface** is off (`pondSurface: 0`): its shimmer bands and rings landed anywhere on
  the open sea and doubled the swell; with it off, reduced motion leaves the sea a still painting.
- **Cost**: at most 160 blits, 6 clips and 1 stroke a frame (tested), every clip a cached
  `Path2D`, no allocation per mark. `MOTION_BOXES` skip what the view misses and `MOTION_BOUNDS`
  the whole draw. Bench numbers in devlog 184.
- Studio `coast-motion` (159): `cove`, `cove-frames`, `beach`, `beach-frames`, `boat`,
  `boat-frames`, `rocks`, `pools`, `coast-motion-sprites`.

### Left for later tasks
- Water (devlog 176, Left open): the far hill's reflection is faint, the shingle's spatter still
  reads a little even, and the placeholder `paintSea` and `paintCaique` are unused until the
  placeholder file goes.
- Land and vegetation (devlog 177, Left open): the pine reads more Japanese than Aleppo; the
  beds are even strips; the walls' seaward ends are a step down, not rubble.
- Daylight: the white puff behind the temple's base between the first and second columns is the placeholder midday sky plate's (its wash leaves a rounded hole there; the background paints the sky as paper, devlog 180). Real plates lit from the left; the architrave, the capitals and the crowns sit under the
  sky's wash, and the skyline's 2-unit reach either side of each column leaves a pale sky-tinted
  band down the columns' sides.
- Motion (devlog 184, Left open): the bastion's ledge faces have no moving foam of their own
  (only the lips, the cliff's foot and the boulders); `sprout.advance` does not move the water.
- Wildlife (devlog 183, Left open): no perch on the chapel or the village (too far for a bird to
  read); the first splash rock's top is all slot.
- Daylight (devlog 182, Left open): the promontory's face reads cool grey rather than rose at
  sunset; the plates paint in one task each, as every garden's; Posidonia stays teal at sunset.
- Motion and the fauna's targets (perches on the copings, the caique's mast, the chapel; heron
  stands on the splash rocks; a far sea band).

## Tests
- `src/scenery/coast/water.test.ts` (G3): the water's steps and their order; recording hash pins
  (overview and a close view of the caique); no part over 130 k calls or 400 k pixels; every step
  in many parts; the sea's washes cover the sea and the beach's runs under the shelf; depth lines
  across the sea, deeper ones farther out, never looping; the shallows' slots in the water, out of
  the deep and off the dark seabed, most on sandy windows; pool slots in a pool; beach slots on
  the beach below the foam; the caique on open water, clear of every slot, the reflections below
  the horizon.
- `src/scenery/coast/motion.test.ts` (G6): the motion is pure in `t`, holds when frozen, always has
  swell, rock foam and wavelets, glints, rings and pool rings come and go; every mark in its water
  and off rock and the boat; the pose bounded, continuous and inside the plate; the pose written
  into the caique's carrier (a mast perch follows it), at rest under reduced motion, where nothing
  is drawn; nothing off screen; at most 160 blits and 6 clips a frame.
- `src/scenery/coast/coast.test.ts` (G1): offered only with `?dev&scenery=coast`; self-consistency
  with no building, lantern, eave, falls or streams, and its motion; its placeholder steps by element;
  habitat words; `pathOut` from the bottom edge up the terraces; the framing (the temple, open sea,
  the sea edge's slots and beds on all three terraces in the portrait crop; sky above the temple at
  16:9; both suns in the crop); the broken shoreline; land, beach and shelf against the sea; 45–56
  slots with prefixed ids, every habitat (4+) and size (2+), beds on each terrace, wall, crack and
  splash slots, a tree in the beds and one in the scrub; slots in the world, out of the sky, off the
  promontory and the temple; water slots in the sea or a pool; rock slots on a coping, face, splash
  rock or the bastion; terrace scales and bounds; path slots; spacing at 1.25×; the sun, moon and
  stars in open sky, the sun side, the skyline down to the silhouette and between the columns, the
  plate band; the flora profile and its one species; an empty wildlife table; a v4 garden with
  coast plants validates and round-trips.
- `src/scenery/coast/fauna.test.ts` and `wildlife.test.ts` (GK0): the table (thresholds, one
  arrival per count, shared rows, skipped rows) and every place against its shape, the regions,
  the carrier and `coastPerspective` (docs/systems/fauna.md › The coast).
- `src/scenery/coast/rock.test.ts` (G2): the rock's steps and where the shore's rock falls in the
  order; pinned recording hashes (overview and a close view of the temple); no part over 60 000
  calls or 400 000 pixels, every step in many parts, few pixel reads per step; the hand-cut outlines
  within the sky's hang; the promontory's top and foot; fissures of uneven spacing and hard beds;
  each column covering its skyline shape; the shoreline's face and lip runs; each splash slot on
  its rock's flat top; every rock wider than tall; the village on the far hill in rows.
- `src/scenery/oasis/motion.test.ts` (O6): the scenery's motion; sprites in small parts; pure in
  `t` and held while frozen; every element always moving and passes differing; every mark inside
  its water (the oued's off the bars); the rings spreading from the inlet; livelier at the bars'
  heads than elsewhere; the falls gathering speed; nothing under reduced motion; nothing off
  screen, only what the view sees; at most 110 small blits and 7 clips a frame.
- `src/scenery/oasis/daylight.test.ts` (O5): wiring and the sun side; its grades warmer and
  more golden by day, glowing over the notch, no heavier at night, no lantern, read by
  `gradeFor`; sun, moon and the dense stars in open sky; the washes clear of the plate's lower
  edge and only 4 under the rock; the basin's mirrored sky turquoise in every phase; plate keys
  and the light print (grades only in the oasis's); pinned recording hashes of all three plates
  per phase; plate cost under 1.5× the waterfall's (about 1.1×).
- `src/scenery/oasis/veg.test.ts` and `land.test.ts` (O4): their steps; pinned recording hashes
  (overview and a close view); no part over one big mark's work; many parts per step; the big
  palms from the layout, their crowns round their tops; the grove on its floor; each wall face
  hung from its coping, every wall slot on a face; the near shapes in the world and off the oued.
- `src/scenery/oasis/water.test.ts` (O3): three steps, pinned recording hashes, no part over one
  big mark's work (overview and the basin's corner close up), many parts per step, the steps in
  the water and the gate across the coping, each fall off a wall's coping inside its box, each
  fall spilling from its run's end as wide as the channel onto the next run or the inlet (O11), the
  bars in the oued, the big one the layout's bar and none on the shallows' slots, the exported boxes.
- `src/scenery/oasis/oasis.test.ts` (O1, O8): offered to everyone; self-consistency
  with no building, lantern, eave, falls or motion; its own steps in order, by element; habitat words; the portrait crop and `pathOut`; the basin inside its stone and the
  streams to the bottom edge; 40–49 slots with prefixed ids, every habitat (4+) and size (2+); in
  the world at 1.25×, out of the sky and off the bluff; water, land and shore slots against the
  water; rock slots on a coping or the talus; terrace scales (ADR 0300); footpath slots; spacing at
  1.25× (distance, footprints, nothing over a raised slot's base, trees); the sun, moon and stars in
  open sky, the sun side and the plate band; the flora profile offering nothing; the wildlife
  table; a v4 garden with oasis plants validates and round-trips through export. O2 adds: the
  whole ksar and most of the basin in the portrait crop; the ksar under y 150 and clear of the
  corner controls with sky above it at 16:9; the skyline down to the silhouette everywhere and
  within 5 of it over the ksar.
- `src/scenery/oasis/rock.test.ts` (O2): the rock's two steps; pinned recording hashes (overview,
  close view) and the same crumbling per block; the shapes exported for daylight, each foot inside
  the bluff; no part over one big mark's work; both steps in many parts; flanks tucked under the
  fronts, and the hand-cut outline within 3 of the bluff.
- `src/scenery/waterfall/waterfall.test.ts`: offered to everyone; self-consistency; no building,
  lantern or eave; the paint steps' order; habitat words; the falls off centre under the notch, into
  the pool; the pool at the cliff foot and the stream out of it to the bottom edge; the trail and
  `pathOut`; the portrait crop; boulders off the falls; slot counts, ids and prefixes; slots in the
  world, out of the sky and off the falls; at most a fifth of the falls hidden; water slots on the
  water, land slots off it, shore slots near it; ledge, crown and ground slots and their scales;
  stones and boulders; the lotus-sized pool slots; spacing at 1.25×
  (distance, footprint overlap, cliff plants, tree crowns); the sun at 8–16°, the moon's arc and
  the stars in open sky; the sun clear of the tree crowns; the sky plates' band.
- `src/scenery/waterfall/falls.test.ts` (S9): the motion is the waterfall's, painted in parts,
  a pure function of `t` (two motions alike, one moment twice alike), held while frozen and moving
  0.15 s later, always more than 8 falling marks and 8 foam puffs, wisps over a minute, two
  passes of a cycle drawn unlike, nothing under reduced motion, nothing when the view misses the
  falls, the fall from the lip to the foam gathering speed.
- `src/scenery/waterfall/daylight.test.ts`: the sky and light wiring, the sun's centre and the
  moon's disc in open sky in every phase (and the moon along its arc), the stars in open sky, the
  washes' outline clear of the plate's lower edge, `waterfall` in both plate keys.
- `tests/e2e/sceneries.spec.ts` › the waterfall has its own daylight: night darker and bluer than
  noon, sky plates stored under `waterfall|` and taken from the cache on a second load.
- `src/scenery/flora.test.ts` (ADR 0250): the offer rule (`growsIn`, `floraLookup`); every species
  has a range and a scenery, and a slot in every scenery that offers it; `also`/`except` ids exist;
  the fixtures grow everywhere; the Japanese garden's 25 and the waterfall's 17 (pins); released
  sceneries (both): 10–30 species, ≥ 2 per tier, ≥ 2 per slot habitat, ≥ 6
  exclusive; the lotus on the garden's two large water slots.
- `src/scenery/waterfall/fauna.test.ts`, `src/fauna/waterfall.test.ts`, `tests/e2e/fauna-waterfall.spec.ts`:
  the waterfall's table, targets and perspective (docs/systems/fauna.md › Tests).
- `src/scenery/registry.test.ts`: ids, the registry (both offered without a flag, the default
  first) and its fallback, self-consistency, the sound profiles, the Japanese garden's focus, path
  and ambience numbers, `PAINT_ROOTS`.
- `src/core/migration-v4.test.ts` › a real v3 export (S17): a file made with the last v3 build's
  Export button (`src/core/fixtures/garden-v3-export.json`) imports into the Japanese garden with
  every plant, pressed flower, session, log entry, schedule, tip and sound level intact, and
  exports again as v4 unchanged.
- `tests/e2e/garden-import.spec.ts` (S17): the same file through Garden data lands in the Japanese
  garden, which shows its plants while the waterfall shows none; a v4 export with plants in both
  gardens round-trips and each garden shows its own again.
- `tests/e2e/gardens.spec.ts` › released (S17): without `?dev` the Gardens section offers both, a
  new garden opens on the Japanese garden, a choice is saved and comes back on reload. The rest of
  the spec: listing, switching, planting in the waterfall through the real flow, keyboard, phone,
  each garden's flora, the herbarium.
- `tests/e2e/sceneries.spec.ts`: both offered without a flag, switching with a cross-fade and back
  to the same pixels, the paint cache on a second switch, each garden's own plants, a session
  counting in another garden, the cut under reduced motion, the waterfall's daylight.
- `src/scene/geometry.test.ts`: the eave matches the engawa's frame; no streams, no falls, one
  lantern; `pavilionOf`.
- `src/scene/scene-cache.test.ts`, `src/ambience/plate-cache.test.ts`: keys carry the scenery.
- `src/ambience/lighting.test.ts`: the reserve follows `lights`; none without lights.
- Pixel identity: the recording-canvas hash pins (`paint-slices.test.ts`, `parts.test.ts`) and the
  `scene-cache`, `plates-cache`, `daylight`, `ambience`, `scene`, `camera` and `wayfinding` e2e specs.
