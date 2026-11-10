# Scenery

`src/scenery/` — a scenery is one place to grow a garden: the Japanese garden (the default) and the
rocky waterfall, both offered to everyone since S17 (SPEC §1a). The contract (ADR 0241) lets every
system take its data from the current scenery instead of module constants. Plants, spots and
wildlife progress belong to a scenery; the timeline, the weather and the daylight clock are shared
(owner decisions, phase 10).

## Files
| File | What |
|---|---|
| `ids.ts` | re-exports `SCENERY_IDS` (`japanese-garden`, `waterfall`, `oasis`), `SceneryId`, `DEFAULT_SCENERY`, `isSceneryId` from `src/core/sceneries.ts`, where core keys plants, sessions and slots by them (ADR 0240; docs/systems/core.md › Gardens) |
| `types.ts` | the `Scenery` contract and its parts: `ScenerySky`, `SceneryAmbience`, `SceneryView`, `SceneryMotion` (and `SceneryFauna` from `src/fauna/habitat.ts`) |
| `fauna.ts` | `faunaTable(id)`: every scenery's unlock table without loading its painting (the quiet line's arrival lines) |
| `japanese-garden/fauna.ts` | `JAPANESE_FAUNA`: the garden's unlock table (SPEC §4, ADR 0248) |
| `registry.ts` | `getScenery(id)` (the default for an id not registered yet), `hasScenery(id)`, `sceneries(flags?)` (available ones, in `order`: the garden, the waterfall and the oasis without any flag (the oasis was behind `?dev&scenery=oasis` until O8, devlog 140)) |
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
| `thumbnail.ts` | the Gardens cards' thumbnails (ADR 0285): `createThumbnails` (sources live › stored › painted › waiting, `THUMB_RANK`, `replaces`), `cacheStore` (`scenery-thumb`, `thumbKey`), `paintThumbnail`/`thumbnailView`/`composeThumbnail` (a garden's painting small) |
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
the paint cache or the scenery's `art` painted small (S5b, ADR 0285). The
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

## Adding a scenery
1. A folder `src/scenery/<id>/` with its geometry, painting (`SceneArt` with its own `steps`),
   `ScenerySky`, `LightArt`, `SceneryAmbience` and `SceneryView`, gathered in `index.ts`.
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
  cultivated: true }`. No existing species is shared by biology (docs/research/oasis-biome.md),
  so it offers none until the phase 13 art queue lands. That is why it stays behind the flag:
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
- **Bluff** (O10, devlog 131): a hand-cut outline (noise ≤ 1.8, inside the sky's hang), painted
  as a Draa sandstone and conglomerate cliff. Its form is fixed (`BLUFF_FORM`, seeded by name, so
  only the brushwork follows the art seed): eight gullies, each a funnel notched into the rim that
  narrows to a chute and opens onto the scree (the shoulder's prow has none), and four hard beds.
  - A red-ochre body, rosier on the left and golden toward the shoulder; the left ridge's west
    face in cool shade with its crown and stepped east side lit; the prow's face to the sun with
    a core shade further in.
  - Buttresses between the gullies: the west face of each in cool violet-brown shade along the
    gully wall, the east face catching the sun, a joint or two. The shade is laid as three
    stacked, narrower bands so it is strongest at the wall and lost away from it.
  - Beds per buttress, each at its own small offset: soft ones as faint broken lines, hard ones as
    caprock ledges (a lit lip, a pale face, a dark undercut, the odd weathered recess), sometimes
    weathered away. Gullies in shade, deeper on their east wall, the west wall lit, a dark cleft
    down the deep ones. Desert varnish hangs from the lips in loose curtains of tapering stains.
  - A scree apron at the foot: a granulating wash, a cone at each gully mouth (pale on its sun
    side, shaded on the west), pebbles, a few fallen blocks; the scree spills onto the terrace.
    A warm bounce along the foot and a lit rim where the skyline turns to the sun.
  - Cost: marks of a kind are filled into one wet layer and dried once (`wetBatch`), not glazed
    one by one, so the step costs about half of O2's.
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
  vanishing point, seedling rows, a watered side. **Footpath**: lifted and paled, footprints.
- **Walls**: pisé faces hung from the layout's copings (the grove wall runs 44 further left,
  under the basin's corner), formwork courses, streaks, a damp foot, a cast shade, a broken lit
  cap, fallen lumps. `WALL_FACES` exports each face for daylight.
- **Foreground**: the bund, a stone channel where it meets the seguia, a broken jar, stones, dry
  halfa tufts, and earth fallen into the basin's near-left corner.

### Vegetation (O4, `paint-veg.ts`)
Steps `grove` (after the ground) and `big-palms` (after the water), in parts. Every palm is the
date-palm species' tree (devlog 106), planned by `planPalm` with its helpers: arching rachises,
V-set leaflets, a wet crown wash, a few gold old fronds, the diamond leaf-base lattice.
- **Grove**: a shaded floor, a hazy back row and a nearer row of palms (batched wet layers), fig,
  pomegranate and olive masses lit from the right, crops as soft green bands before the wall.
- **Big palms**: the four `BIG_PALMS`, planned from fixed seeds: crown wash, back fronds, trunk on
  reserved paper (flared foot, lattice, sun on the right flank), the crown's heart, front fronds,
  date bunches on the three near ones, and a shadow cast left.
- **Seams for O5**: `VEG_SHAPES` (`bigPalms` with trunk, width and crown outline, `grovePalms`,
  `groveTrees`, `grove`), `PALM` and `haze()`.

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

## Tests
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
