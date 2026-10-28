# 62 — S4: the waterfall's geometry, slots and layout

The second scenery's composition, as data: where the falls, the pool, the stream, the ledges,
the trail and every slot are, its sky numbers and its view. There is no painting yet: flat
placeholder shapes until S6–S8. It is registered, but offered only under `?dev&scenery=waterfall`.

## What
- **`src/scenery/waterfall/`** (new):
  - `layout.ts`: the skyline (`SKYLINE`, `skylineAt`, `openSky`), the `CLIFF` mass, the
    `FAR_RIDGE`, six `LEDGES` with their scale, `CROWN_SCALE`, `WATERFALL_SKY_LAYOUT`, `FOCUS`,
    `WATERFALL_AMBIENCE`, and `WATERFALL_HABITAT_WORDS` (for S5).
  - `geometry.ts`: `FALLS` (outline, lip, foot), `POOL`, `WATERLINE` 598, `STREAM_LINE` and the
    `STREAM` polygon built from it, 9 `ROCKS` (5 perches), a 6-stone `TRAIL`, `waterfallScene`
    (`structure: null`, `lights: []`, `eave: null`).
  - `slots.ts`: 49 slots. Ground slots use `perspectiveScale(y)`. Ledge and crown slots take the
    cliff's depth (0.72 / 0.68 / 0.64, crown 0.6).
  - `index.ts`: `WATERFALL` (`available` only with `?dev&scenery=waterfall`), placeholder
    `waterfallSteps`, `WATERFALL_SKY` (one flat wash per phase), `WATERFALL_LIGHT_ART` (no trees
    yet), `WATERFALL_VIEW` (focus, the trail's near edges as `pathOut`).
  - `map.studio.ts`: `waterfall-map/map` shows the composition with labels, the slot overlay with
    1.25× boxes, the sun's and the moon's paths, the stars and the portrait crop.
    `waterfall-map/placeholder` shows the placeholder painting through the real paint job, with
    painted boulders and paper.
  - `waterfall.test.ts`: 31 invariants (composition, slots, species, spacing, sky).
- `src/scenery/registry.ts`: the waterfall registered (one entry). `registry.test.ts` follows.
- Docs: ADR 0245; `docs/systems/scenery.md` › Waterfall (map, reasoning, slot table);
  ARCHITECTURE (slot scale wording, the registry); TESTING rows S4.1–S4.6; the studio table.

## Why / decisions
ADR 0245. In short:
- **The falls sit off centre** (x 542–688), between a broad cliff and a taller buttress. The lip
  hangs 24 units under a notch, so a sliver of the upper gorge shows behind the water.
- **The skyline was chosen for the light.** The crown is high on the left and the buttress
  beside the falls. The flank falls to a low far ridge, which gives the right 40 % of the frame to
  the sky. The sun sets just right of the buttress (x 1040, inside the portrait crop) and rises at
  x 1270. A first version with a flatter skyline at y 220–290 read as a lump, and a tree at the
  buttress's foot covered the setting sun. Both were changed after looking at the map.
- **No `Slot` type change.** `scale` was already an explicit field that every consumer reads.
  Only the rule "scale = `perspectiveScale(y)`" was the garden's, so ARCHITECTURE now says that,
  and the waterfall's cliff slots set their own.
- **Trees**: two tree slots, one at the left foot of the cliff (`cliff-1`, back) and one at the
  right edge (`bank-16`, meadow). Neither crown covers a ledge or the sun's path. A tree on a
  ledge or on the crown would rise out of the top of the world at 1.25×.

## Composition, as looked at
`npm run shots -- --entry waterfall-map/map` and `--entry waterfall-map/placeholder`. The map
reads clearly: falls, ledges, pool, the S of the stream, the trail, and the sun and moon over the
far ridge. In the placeholder the boulders in the pool look like they float on flat paint.
That is expected until S6/S7 paint the water and the rocks.

## Results
- `src/scenery`: 39 tests pass. The studio e2e passes with the new section (every entry renders,
  none blank).
- Final full run (`nice -n 15`, load under 8): typecheck clean; `npm test` 134 files, 1606 tests
  pass; `npm run e2e` (port 4354, 2 workers) 263 pass in 23.9 min.

## Left open
- **Runtime**: nothing switches to the waterfall yet (S3). `main.ts` is untouched.
- **Black pine has one slot** (`cliff-1`). Its habitats are shore, rock and back, and every tree
  spot near the water would cover the falls or the sun. With parallel sessions it can show as
  full (ADR 0205).
- **Fauna perspective** (S11): `perspectiveFit(slots)` fits a line through (y, scale), and the
  ledges bend it. The waterfall needs its own `perspective(x, y)`.
- **Stars** (S10): the band is y 26–186 because the crown stands high on the left. A star field
  clipped to `openSky` would put stars low over the far ridge too.
- **Habitat words** (S5): recorded in `WATERFALL_HABITAT_WORDS`. The contract has no
  `habitatWords` yet.
- **Sprites**: the background's sprite pass paints every `rock` as the garden's boulder, and no
  foreground tufts. S6 gives the waterfall its own sprites (wet rocks, the pool's boulders).
- **Small water slots**: none. The garden's small water slots fit no species. The waterfall has
  2 large and 2 medium, which is all the lotus and the water lily can use.
