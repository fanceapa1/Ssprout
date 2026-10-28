# Scenery

`src/scenery/` — a scenery is one place to grow a garden: the Japanese garden, and a rocky
waterfall in progress (phase 10; geometry and slots done, painters to come). The contract (ADR 0241) lets every system take its data from the
current scenery instead of module constants. Only plants belong to a scenery; the timeline, the
weather and the daylight are shared (owner decisions, phase 10).

## Files
| File | What |
|---|---|
| `ids.ts` | re-exports `SCENERY_IDS` (`japanese-garden`, `waterfall`), `SceneryId`, `DEFAULT_SCENERY`, `isSceneryId` from `src/core/sceneries.ts`, where core keys plants, sessions and slots by them (ADR 0240; docs/systems/core.md › Gardens) |
| `types.ts` | the `Scenery` contract and its parts: `ScenerySky`, `SceneryAmbience`, `SceneryView` |
| `registry.ts` | `getScenery(id)` (the default for an id not registered yet), `hasScenery(id)`, `sceneries(flags?)` (available ones, in `order`) |
| `japanese-garden/index.ts` | `JAPANESE_GARDEN`: gathers the garden's geometry, painting, sky, light art, ambience numbers and view |
| `japanese-garden/sky.ts` | `GARDEN_SKY_LAYOUT`: horizon y 368, sun x 966 rising / 556 setting, the moon's arc, where stars may be |
| `japanese-garden/light.ts` | `GARDEN_LIGHT_ART` (trees, shrubs, sky) and `ENGAWA_LIGHT`, the engawa's own light marks (its cast shadow, the lamp-lit shoji) |
| `japanese-garden/ambience.ts` | `GARDEN_AMBIENCE`: dew boxes on the near banks, dawn mist bands 1–3, the veil to y 592 |
| `japanese-garden/view.ts` | `GARDEN_VIEW`: focus (800, 560), the stepping stones' near edges for the guiding path |
| `waterfall/layout.ts` | the waterfall's skyline (`SKYLINE`, `skylineAt`, `openSky`), `CLIFF`, `FAR_RIDGE`, `LEDGES` (with their scale), `CROWN_SCALE`, `WATERFALL_SKY_LAYOUT`, `FOCUS`, `WATERFALL_AMBIENCE`, `WATERFALL_HABITAT_WORDS` |
| `waterfall/geometry.ts` | `FALLS`, `POOL`, `WATERLINE`, `STREAM_LINE` and `STREAM`, `ROCKS`, `TRAIL`, `waterfallScene` |
| `waterfall/slots.ts` | `WATERFALL_SLOTS`: 49 slots, explicit scale on the cliff |
| `waterfall/index.ts` | `WATERFALL` (`available` only with `?dev&scenery=waterfall`), `waterfallSteps` (the rock, the water and the placeholders), `WATERFALL_SKY`, `WATERFALL_LIGHT_ART`, `WATERFALL_VIEW` |
| `waterfall/paint-rocks.ts` | the rock's painters (S6): `paintGorge`, `paintCliff`, `paintButtress`, `paintLedges`; `cliffBody`, `buttressShape`, `ROCK_LIGHT` and the rock pigments |
| `waterfall/paint-water.ts` | the water's painters (S7): `paintPool`, `paintStream`, `paintFalls`; `sheetAt` (a point on the falling sheet) and the `WATER` pigments |
| `waterfall/water.studio.ts` | studio `waterfall-water` (106): `water-falls`, `water-pool`, `water-stream`, `water-scene` |
| `waterfall/water.test.ts` | the water's steps, the sheet's edges, hash pins, slice bounds, parts |
| `waterfall/sprites.ts` | `WATERFALL_ROCKS` (`art.rockSprites`): `paintWaterfallRock`, `isWetRock` |
| `waterfall/rocks.studio.ts` | studio `waterfall-rocks` (104): `cliff`, `ledges`, `boulders`, `scene` |
| `waterfall/rocks.test.ts` | the rock's steps, wet and mossy boulders, hash pins, slice bounds |
| `waterfall/map.studio.ts` | studio `waterfall-map` (103): the composition map and the placeholder painting |
| `registry.test.ts` | ids, registry, each scenery consistent with itself, the garden's numbers, `PAINT_ROOTS` |
| `waterfall/waterfall.test.ts` | the waterfall's composition, slot, species, spacing and sky invariants |

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
perspective; S11), `sound` (S15; `core/soundscape.ts` names its audio sceneries `SoundSceneryId`, `pond`
and `coast`), `habitatWords` and `thumbnail` (S5), `surface` (the per-frame water animator; S9).

## Who reads what
Each consumer takes the scenery's part as an option and defaults to the Japanese garden's, so
`main.ts` is unchanged and runtime switching (S3) only has to pass the current scenery down.

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

## Paint cache (ADR 0242)
Every key starts with the scenery id: `japanese-garden|s7|normal|0,0,1600,1000@1.5|2400x1500`
(`scene`, `scene-detail`), `japanese-garden|s7|normal@1.5` (`scene-sprites`),
`japanese-garden|s7|midday|…` (`sky-plate`), `japanese-garden|ambience-cast|sunset|…` (`light-plate`).
`src/scenery` is one of `PAINT_ROOTS`.

## Adding a scenery
1. A folder `src/scenery/<id>/` with its geometry, painting (`SceneArt` with its own `steps`),
   `ScenerySky`, `LightArt`, `SceneryAmbience` and `SceneryView`, gathered in `index.ts`.
2. Register it in `registry.ts`; keep `available` false behind a dev flag until it is done.
3. Studio entries for everything it paints (`*.studio.ts`).
4. Nothing else changes: the consumers above already read the scenery.

## Waterfall (ADR 0245)
A rocky waterfall in the same watercolour style. This task (S4) set its geometry, slots and
numbers. Its painters are S6–S8, the animated falls S9, its daylight S10, its wildlife S11–S13
and its sound S15. Until then it is registered but offered only under `?dev&scenery=waterfall`,
and its steps paint flat shapes in their places. Look at it in the studio: `waterfall-map/map`
and `waterfall-map/placeholder`.

```
y    0 ┌───────────────────────────────────────────────────────────────────────────┐
       │ · stars (y 26–186) · · ·                    ·   · moon arc (990→1150→1300)│
  200  │ crown woods ▲(60,200)            buttress ▲(780,214)        · open sky ·  │
       │ ╲___ cliff-3 L      notch 270  ╱╲ cliff-5     ╲  sunset ○1040  ○1270 sun- │
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
  (296 → 606) from a notch in the cliff top. The lip is about 24 units under the notch's skyline,
  so a sliver of the upper gorge shows behind it and the water does not pour out of the sky.
- **The skyline decides the light.** The crown woods are highest at the left edge (y 200), and the
  buttress beside the falls is the tallest rock there (y 214). Its flank falls away to a low far
  ridge (y 344–372). The right 40 % of the frame is open sky for the daylight phases: the sun sets
  at x 1040, just right of the buttress, and rises at x 1270 over the far ridge (horizon y 384,
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
| `sky` | `sky` | placeholder (S10) | flat wash over the open sky |
| `far-ridge` | `ridge` | placeholder (S8) | flat far ridge and plain |
| `banks` | `banks` | placeholder (S8) | flat ground from y 470 |
| `gorge` | `gorge` | S6 | the upper gorge behind the lip |
| `cliff` | `cliff` | S6 | the cliff mass and its detail |
| `buttress` | `cliff` | S6 | the buttress right of the falls |
| `ledges` | `ledges` | S6 | the six ledges and their moss |
| *(S8: crown woods, ledge ferns)* | | | |
| `pool` | `water` | S7 | the plunge pool: deep heart, shallows, reflections, churn |
| `stream` | `water` | S7 | the outflow stream: channel, ripples, riffles |
| `falls` | `falls` | S7 | the falling sheet (still) and the foam at its foot |
| *(S8: near banks, the trail's earth, grass)* | | | |
| `stones` | `path` | S6 | the trail's stepping stones (the garden's `paintStones`) |

**The rock (S6, `paint-rocks.ts`).** Painted on white like the garden (ADR 0021), lit from the
upper right (`ROCK_LIGHT`, −0.95: the sun sets and rises right of the buttress), in parts.
- *Gorge*: the notch is cut out of the cliff's body down to the lip (`cliffBody`), so the gorge
  shows through: a pale cool far end, a lit left wall, a shadowed right wall.
- *Cliff*: its paper is reserved first (a full lift of the body), so it stands opaque over
  whatever S8 paints behind it. One wet-in-wet mass, warm grey lit at the top to cool blue-grey
  at the foot, dissolving toward the right flank. Strata are broken blocks dipping gently left,
  clipped to the body: a thin lift on top (the lit bed) over a shadow wash with a crisp top that
  dies downward. Dry-brush scumbles follow the bedding, a few short cracks cross it. A cool
  glaze darkens the alcove behind the falls and the cliff's foot, warm glazes light the faces
  turned to the sun. Wet streaks run down from the lip either side of the falls (soft, wet
  strokes in `WET_ROCK`), and dark-green seeps run under some ledges.
- *Buttress*: its own wet-in-wet over the cliff, lit warm on the right, cool toward the falls, so
  the two glazes leave an edge between them. A fissure splits the crest from the flank, columnar
  joints with a vertical scumble make it stand rather than lie in beds.
- *Ledges*: a lifted shelf on top, an undercut shadow glaze below the lip, a broken ink line
  along the lip and moss cushions (small flat `foliageClump`s, scaled by the ledge's depth).

**Boulders (`sprites.ts`).** `SceneArt.rockSprites` replaces the garden's boulder for this
scenery (same `rockBox`, so the atlas layout is unchanged in shape). A boulder within 24 units of
the pool or the stream is *wet*: a dark waterline instead of a cast shadow, a dark cool stone with
little moss, a darker splashed lower half, a lifted sheen on the lit shoulder and green slime at
the waterline. The others are *mossy*: a cast shadow, a warmer stone with a lot of moss, a moss
cushion on top and grass at the foot.

Studio: `waterfall-rocks/cliff`, `/ledges`, `/boulders` and `/scene` (the whole painting so far).

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

### Left for later tasks
- S5: `WATERFALL_HABITAT_WORDS` ('in the plunge pool', 'on the mossy ledges'…) once the
  contract has habitat words.
- S10: a star field clipped to `openSky` (the band is shallow because of the crown).
- S11: a fauna perspective per scenery. `perspectiveFit(slots)` fits a line through (y, scale),
  which the ledges bend.

## Tests
- `src/scenery/waterfall/waterfall.test.ts`: the dev flag; self-consistency; no building,
  lantern or eave; the paint steps' order; habitat words; the falls off centre under the notch, into
  the pool; the pool at the cliff foot and the stream out of it to the bottom edge; the trail and
  `pathOut`; the portrait crop; boulders off the falls; slot counts, ids and prefixes; slots in the
  world, out of the sky and off the falls; at most a fifth of the falls hidden; water slots on the
  water, land slots off it, shore slots near it; ledge, crown and ground slots and their scales;
  stones and boulders; every species placeable, the lotus on 2 large pool slots; spacing at 1.25×
  (distance, footprint overlap, cliff plants, tree crowns); the sun at 8–16°, the moon's arc and
  the stars in open sky; the sun clear of the tree crowns; the sky plates' band.
- `src/scenery/registry.test.ts`: ids, the registry and its fallback, self-consistency, the
  Japanese garden's focus, path and ambience numbers, `PAINT_ROOTS`.
- `src/scene/geometry.test.ts`: the eave matches the engawa's frame; no streams, no falls, one
  lantern; `pavilionOf`.
- `src/scene/scene-cache.test.ts`, `src/ambience/plate-cache.test.ts`: keys carry the scenery.
- `src/ambience/lighting.test.ts`: the reserve follows `lights`; none without lights.
- Pixel identity: the recording-canvas hash pins (`paint-slices.test.ts`, `parts.test.ts`) and the
  `scene-cache`, `plates-cache`, `daylight`, `ambience`, `scene`, `camera` and `wayfinding` e2e specs.
