# Daylight

The garden follows the real sun in four painted phases — **sunrise, midday, sunset, night** —
blended over 40 minutes (SPEC §5, ADRs 0140–0147). It is spread over four folders because each
part belongs with what it paints:

| File | What |
|---|---|
| `src/ambience/solar.ts` | pure: NOAA sun times (`sunTimes`), `sunAltitude`, `solarNoon`, `moonPhase` |
| `src/ambience/zones.ts` | pure: IANA zone → lat/lon table, `locationForZone(zone, offset)`, `browserLocation()` |
| `src/ambience/daylight.ts` | pure: phase boundaries, weights, `DaylightState`, `daylightAt`, `pinnedState`, `parseTimeOverride`, `nextPhase`, `whenIdle` |
| `src/ambience/daylight-source.ts` | `createDaylightSource()` — the one shared daylight (location, override, cache); `pinnedSource(p)` |
| `src/ambience/sky-layout.ts` | pure: `SkyLayout` (with its `sunSide`); `sunDisc`, `moonDisc`, `stars`, `castShadow`, `rimLight`, `sunSide` (from a scenery's layout, default the Japanese garden's `GARDEN_SKY_LAYOUT`) |
| `src/ambience/timeofday.ts` | `PHASE_GRADES` (the light grade of each phase), `gradeFor(weights)`, the hour-based `TYPICAL_DAY` |
| `src/ambience/lighting.ts` | the per-pixel grade wash (`paintGradeWash`, `gradePlate`, lantern reserve) |
| `src/ambience/cast.ts` | the light plates: painted per phase, blended, moving lights lifted out (`createCastLight`) |
| `src/ambience/night-edge.ts` | where a dark light stops at the stage's edge (`createNightEdge`, `edgeStrength`; ADR 0184) |
| `src/scene/paint-sky.ts` | the four painted skies and their mirrored water plates |
| `src/scene/sky-light.ts` | `createSkyLight`: sky + water composites, the sun and moon punched out; `skyPlateKey` |
| `src/ambience/plate-cache.ts` | the sky and light plates from the persistent paint cache (`createPlateCache`, `cutImage`, `fingerprint`; ADR 0236) |
| `src/paint/rim.ts` | rim-light masks for sprites (plants, boulders) |
| `src/plants/shadow.ts` | the plants' cast-shadow blot |
| `src/scene/daylight.studio.ts` | studio section **Daylight · four painted phases** |

## Sun times and location (ADR 0140)
`sunTimes(now, { lat, lon })` → `{ noon, midnight, dawn, sunrise, sunset, dusk, noonAltitude,
midnightAltitude }` (epoch ms; missing events are `null`) for the **solar day around now** — only
the longitude defines the day, so no time zone is involved. Polar day/night: no sunrise/sunset;
white nights / deep polar night: no civil dawn/dusk. The location is the time zone's city
(`ZONES`, ~110 zones), else the UTC offset's longitude and the region's mid latitude.

## Phases (ADR 0141)
| Boundary (blend centre, ±20 min) | Change |
|---|---|
| civil dawn | night → sunrise |
| sunrise + 60 min | sunrise → midday |
| sunset − 60 min | midday → sunset |
| civil dusk | sunset → night |

Short days keep midday ±20 min around noon; white nights blend sunset → sunrise at solar midnight;
polar day = midday, polar night = night, polar twilight = night → sunrise → sunset → night.
Weights smoothstep through each blend and always sum to 1. Example, London on 21 June (BST),
pure phases with the blends between them: night until 03:36 · sunrise 04:16–05:23 · midday
06:03–20:01 · sunset 20:41–21:49 · night from 22:29.

`DaylightState`: `weights`, `phase` (dominant), `blend`, `sunAltitude`, `sunRising`,
`moonProgress` (0 at dusk → 1 at dawn), `moonPhase`, `times`, `night` (= the night weight).

## Who uses it (ADR 0143)
`main.ts` creates **one** `createDaylightSource()` and passes `{ daylight }` to:
| System | Uses |
|---|---|
| scene (`createSceneSystem`) | the sky composite in `background`, the sky on the pond and water glints in `waterSurface`, the boulders' rim light |
| ambience (`addAmbience`) | the light plate in `lighting`, night desaturation, the lantern, dawn mist and dew, `onLight` grade for the UI |
| plants (`createPlantSystem`) | each plant's cast shadow and rim light |
| fauna (`createFauna`) | diurnal creatures rest while `night ≥ 0.5` |

## The sun side (ADR 0284)
Each scenery's `SkyLayout.sunSide` says which side its low sun lights the scene from:
`{ sunrise: -1 | 1, sunset: -1 | 1 }` (−1 left, +1 right). The Japanese garden is `{ sunrise: 1,
sunset: -1 }` (it rises over the right-hand hills and sets over the left); the waterfall is
`{ sunrise: 1, sunset: 1 }` (both low suns stand right of the falls), and so is the oasis; the
coast is `{ sunrise: -1, sunset: -1 }` (both over the sea on the left). A sky without one gets the
garden's. Everything that is lit from the side reads it from the viewed scenery's sky:
- `castShadow(s, sky)`: the low-sun terms of `dx` point away from the sun. Length, `dy`, alpha,
  midday's short pool and the moon's faint night shadow (`dx` −0.2) are the same everywhere.
- `rimLight(s, sky)`: the rim faces the sun; strength and colours are the same everywhere.
- Readers: the plant system (`SystemContext.scenery.sky.layout`: shadows and rims), the scene
  system (boulder rims), the light plates (`LightArt.sky`: boulder, shrub and tree shadows, crown
  lights on the sun side), the studio's daylight sections and `sprout.daylight()`.
- Not sided: the weather sun's lifted bands and leaf glints (ADR 0193) keep their upper-left light.

**Mirror symmetry (S10c).** A shadow falling left is the mirror image of one falling right. A
boulder's long shadow (`cast.ts › rockShadow`, pure) tilts by `side × atan2(dy, |dx|) × 0.15`, a
few degrees, its far end dipping toward the viewer on either side. Until S10c it was
`atan2(dy, dx) × 0.15`, which is about π × 0.15 when `dx < 0`: a left-falling shadow rose about
27° away from the viewer (the garden's sunrise, the waterfall's sunrise and sunset). Right-falling
shadows keep their exact value, so the garden's sunset is pixel-identical. Shrub and tree shadows
were already mirrored (only their `x` offsets and fade turn with the side). A plant's blot is placed
as a mirror (`shadowBox` angle `π − tilt`, so the outline is the mirror image), but the blot's
texture is rotated, not flipped, so its painted grain is upside down on the left. That is
invisible in a soft violet glaze and kept, so the moon's left-falling night shadow is unchanged.

## The painting
- **Sky plates** (scene, ADR 0145): one per phase, 0.7 px/unit over world y −240 … 500, multiplied
  over the landscape in the cached background. Midday: wet-in-wet cerulean graded to warm paper, a
  second wet pass of darker pools, and whites lifted out of the wet blue in drifts (soft lifts, a
  rare crisp dried edge or bloom, torn wisps; never cloud shapes, ADR 0184). Sunrise: violet-blue into peach and apricot on the right, rose cloud banks, cool
  blue hills. Sunset: rose-violet, crimson band, ochre glow on the left, crimson/gold cloud banks,
  violet hills. Night: indigo into a paler ultramarine horizon, darker hills, 30 stars left as
  paper. The sun (low, `SUN_R` 22) and the moon (`MOON_R` 17, lunar phase shown) are punched out;
  the sun only above the far ridge.
- **Water plates**: the same skies as horizontal bands on the pond (source-over 0.22 midday …
  0.42 sunset, `WATER_SKY_ALPHA`; a scenery may set its own through `ScenerySky.waterAlpha`, ADR
  0372, and its plate may carry its own alpha).
- **Light plates** (ambience, ADR 0147): 0.4 px/unit over the world. Grade wash + long shadows of
  boulders, shrubs, trees and the engawa away from the sun (pools at midday) + light caught on the
  crowns at sunrise/sunset + lamp light in the shoji (sunset, night) + stars. Composite lifts the
  sun's glow, the moon and its halo, the broken light path on the pond and the lantern's pool.
- **Grades** (`PHASE_GRADES`; a scenery may give its own through `LightArt.grades`, ADR 0301): midday 0.03 (bare paper); sunrise lavender 0.2 warmed toward the
  right; sunset amber 0.34 glowing toward the left, lantern 0.45; night indigo 0.54 (+0.22 toward the
  sky, × 1.2 toward the near ground: the meadow and the path are thin paint and need the weight,
  devlog 29), lantern 1, colour taken out first (`LOOK.nightDesaturate` 0.38; the frame is backed with white first, so the glaze only desaturates and draws no line where the sky plate stops at y 500, ADR 0206).
- **Waterfall** (S10, ADR 0247, `scenery/waterfall/{sky,light}.ts`): the same four skies with the
  glows and banks over the far ridge right of the buttress (sun 1270 rising, 980 setting: `WATERFALL_SUN_SKY`; the layout's 1040 put half the disc past a phone's crop, devlog 98), clipped
  to `plateSky()` (14 units under the cliff, 40 over the flank and ridge) so no bleed lands on the
  pale cliff top; the far ridge glazed per phase after the clip; 30 stars from its own band. The
  pool plate darkens toward the cliff. Light hooks: shade under the ledges and along the cliff foot,
  at a low sun the notch under the buttress and the left cliff, to the left (as the shared shadows,
  its sun side being right at both low suns, ADR 0284); feathered warm
  paper on the buttress, the crown's edge, the ledges and the ridge under the sun at sunrise and
  sunset; at night pale cool paper down the falls and over the spray (no lantern). Global grades.
  Studio `waterfall-daylight`.
- **Oasis** (O5, ADR 0301, `scenery/oasis/{sky,light}.ts`): desert skies over the notch where
  both low suns stand (ADR 0300). Midday a high dusty blue bleached to almost white over the
  horizon; sunrise pale rose-gold with a low haze along the far range; sunset violet, coral and
  ember; night a granulating indigo with a lifted Milky Way and 240 extra small stars
  (`OASIS_NIGHT_STARS`, reserved on the sky and the night light plate). Clipped to `plateSky()`:
  4 units under the bluff and the ksar, up to 44 over the far range, never onto the shoulder.
  The basin plate stays turquoise in every phase (`OASIS_WATER_SKY`), the sky's colour laid on as
  broken streaks. Light hooks: shadows always to the left (the bluff's left ridge, the towers
  onto their neighbours, the terrace walls' faces and the strip below them, the basin's coping on
  the water, the big palms' trunks and crowns thrown diagonally toward the viewer, short pools at
  midday); warm paper on the ksar, its flanks and parapets, the shoulder, the left crown and the
  palms at sunrise and sunset, the far range glazed in the sky's colour; pale paper over the
  basin's water by day so the warm grade does not grey it; at night a cool sheen on the basin, the
  coping and the pisé, the Milky Way's glow and the stars. **Its own grades** (`OASIS_GRADES`,
  through `LightArt.grades`): midday a thin gold, sunset a deeper amber, both glows over the
  notch, night a little lighter than the garden's, no lantern. Studio `oasis-daylight`.
- **Coast** (G5, ADR 0372, `scenery/coast/{sky,light,daylight}.ts`): an Ionian summer sky, both low
  suns over the sea on the left (ADR 0360). Midday a clear cerulean thinning to a warm haze, two
  small soft clouds; sunrise lilac into peach with a pearly horizon; sunset violet, rose and
  apricot with violet bars; night a deep blue with 170 extra small stars. The sky is cut round the
  temple (`TEMPLE_CUT`), not traced round it. The sea plate goes from the horizon's colour to the
  near water's (turquoise, pearl, apricot to dusky teal, ink) with a broken path under each low sun
  and the moon, thins toward the viewer, and lies on the sea strongly (`waterAlpha` 0.34–0.78).
  Light hooks: shadows to the right (the promontory's face, walls, columns, the olive, the pine);
  warm paper on the temple, the village, the olive and the pine, the promontory rose, the near
  cove kept teal; at night cool paper on the stone, seven lit windows and the chapel's lamp. **Its
  own grades** (`COAST_GRADES`): glows over the sea at each sun, no lantern, a bluer night 0.5.
  Studio `coast-daylight`.
- **Close views** (ADR 0163): when the camera rests zoomed in, the sky composes a detail plate for
  the view (plates upscaled; sun, moon with its phase and stars punched at up to 3 px/unit) and
  the light plate repaints its marks for the view at up to 2 px/unit (`CAST_DETAIL_MAX`) over its
  upscaled grade wash (kept per phase before the marks), one phase per idle callback; the moving
  lights are lifted in the detail composite. Each is used only when it covers the whole view.
  `sprout.lightDetail()`, `skyStats().detail`.
- **Sprites** (ADR 0146): rim light (screen, sunrise peach, sunset gold, from the scenery's sun
  side: in the garden from the right at sunrise and the left at sunset, at the waterfall from the
  right at both, ADR 0284) on plants (0.85) and boulders (0.7); plants' shadow blots (`SHADOW_PLANT` 0.6).
- **The night edge** (ADR 0184, `ambience/night-edge.ts`): in dark light (night + 0.35 · sunset +
  0.15 · sunrise) the lighting layer lifts the painting back to paper in a band just inside the
  stage's CSS dissolve: the wash stops at a ragged line with a pooled rim and thins into paper on the
  grain, so the margins read as paper rather than a grey haze. Screen space, built once per canvas
  size, two blits per frame only in dark light. Studio `ambience-lighting/night-edge`.
- **Ambience extras**: dawn mist on the far bank and the water, rising 26 units and thinning as the
  sun climbs (`LOOK.dawnMist*`); 16 dew glints twinkling on the near grass at sunrise.

## Caching and cost
- Plates are painted on demand: a sky + water plate ≈ 80–100 ms, a light plate ≈ 30–60 ms with
  its wash fields (M3, Chrome); the **next phase's plates are prepared in idle time** (`whenIdle`,
  `nextPhase`).
- **The paint cache** (ADR 0236): a phase's plates are looked up in `paintCache()` before they
  are painted and stored (in idle time) after a miss. The kinds are `sky-plate` (the sky with its
  water plate packed below, `skyPlateKey`: scenery, seed, phase, pixel sizes, water rect) and
  `light-plate` (`lightPlateKey`: scenery, seed, phase, size, a fingerprint of the geometry, the art and the sky layout; ADR 0242). The
  composites, with the sun, moon and blend, are always built here. While a needed plate is being
  looked up the composite is deferred; it is built when the answer comes, or by the first draw
  (which paints what is still missing), so no frame shows a stale composite and readiness is
  unchanged. `prepare` looks the coming phase up and paints it in idle time only on a miss. All four
  phases are 4.0 MB of PNG; a repeat visit paints no plate. The light's close-view detail plates
  are not cached (idle work keyed per view). With `?nopaintcache` (and on the dev server, in
  Vitest) the plates paint synchronously as before.
- Composites are rebuilt only when the weights move by 1/200 or a sun/moon disc by a world unit
  (scene checks every 2 s, ambience every 3 s, both at once after `setTime`). The sky rebuild
  invalidates the background cache (two blits).
- Per frame: one multiply blit of the light composite (+ a white backing fill and one saturation fill at night), the water
  composite blit, one shadow and (sunrise/sunset) one rim blit per plant. Ambience stays < 1.5 ms.

## Dev (`?dev`)
- `sprout.setTime('sunrise' | 'midday' | 'sunset' | 'night')`, a blend
  `sprout.setTime({ from: 'sunset', to: 'night', t: 0.5 })`, a v1 alias (`'morning'`, `'noon'`,
  `'evening'`, `'dusk'`, `'dawn'`), an hour of today (`sprout.setTime(6.5)`) or `null` (the clock).
- `sprout.daylight()` → phase, weights, blend, sun/moon discs, shadow, rim (all from the viewed
  scenery's sky), location, sun times, override. `sprout.plants.state().sun` → the plants' shadow
  `dx`, rim side and strength. `sprout.skyStats()` → `plates` (held), `painted`, `composes`, `paintMs`, `cacheHits`,
  `cacheMisses`, `detail`. `sprout.lightPlates()` → the light plates' `painted`, `cacheHits`,
  `cacheMisses`.
- Screenshots: `npm run shots -- --eval "sprout.setTime('sunset'); sprout.addPlants(25); await sprout.plantsReady(); sprout.settleAmbience()"`.

## Tests
Unit: `solar.test.ts` (London, New York, Tokyo, Sydney ±3 min; polar day, polar twilight, deep polar
night, the exact poles; moon phase), `zones.test.ts`, `daylight.test.ts` (windows, blends, sums,
continuity minute by minute, short days, white nights, polar cases, setTime parsing),
`daylight-source.test.ts`, `sky-layout.test.ts` (with the sun side of both gardens, and the
garden's shadow and rim pinned to the pre-0284 formulas), `cast.test.ts` (a boulder's shadow with
the sun on the other side is its exact mirror; the right-falling tilt pinned to the pre-S10c
formula), `timeofday.test.ts`, `scene/sky-light.test.ts`,
`paint/rim.test.ts`, `plants/shadow.test.ts` (the blot placed as the mirror), `ambience/plate-cache.test.ts` (the plates' lookups,
stores and keys). E2E: `tests/e2e/daylight.spec.ts` (each phase's
pixels, the moon and the setting sun as lights, blends, the clock-driven location, fauna's night,
frame budget, plantsReady), `tests/e2e/plates-cache.spec.ts` (a repeat visit paints no plate and
matches `?nopaintcache` pixel for pixel at midday, at night and close up).

## How to tweak
Sky colours and the lifted whites: `paint-sky.ts` (studio `daylight/sky-*`). The night edge:
`night-edge.ts` (`edgeStrength`, the line and break widths in `nightEdgeFields`). Light, shadows, crown lights:
`cast.ts` and `PHASE_GRADES` (studio `daylight/cast-*`, `daylight/garden-*`). Where the sun and
moon are: each scenery's `SkyLayout` (the Japanese garden's: `src/scenery/japanese-garden/sky.ts`;
horizon y 368, sun x 966 rising / 556 setting, the moon's arc 902,270 → 806,182 → 708,252), read by `sky-layout.ts`.
The sky plates' rect, open-sky shape and painters are the scenery's `ScenerySky` (`GARDEN_SKY`), the engawa's
shadow and lamp-lit shoji its `LightArt` hooks (`src/scenery/japanese-garden/light.ts`; docs/systems/scenery.md). Phase windows: `BLEND_MS`, `GOLDEN_MS` in `daylight.ts`.
