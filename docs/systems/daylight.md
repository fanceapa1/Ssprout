# Daylight

The garden follows the real sun in four painted phases — **sunrise, midday, sunset, night** —
blended over 40 minutes (SPEC §5, ADRs 0140–0147). It is spread over three folders because each
part belongs with what it paints:

| File | What |
|---|---|
| `src/ambience/solar.ts` | pure: NOAA sun times (`sunTimes`), `sunAltitude`, `solarNoon`, `moonPhase` |
| `src/ambience/zones.ts` | pure: IANA zone → lat/lon table, `locationForZone(zone, offset)`, `browserLocation()` |
| `src/ambience/daylight.ts` | pure: phase boundaries, weights, `DaylightState`, `pinnedState`, `parseTimeOverride`, `nextPhase` |
| `src/ambience/daylight-source.ts` | `createDaylightSource()` — the one shared daylight (location, override, cache); `pinnedSource(p)` |
| `src/ambience/sky-layout.ts` | pure: `sunDisc`, `moonDisc`, `stars`, `castShadow`, `rimLight` (world positions) |
| `src/ambience/timeofday.ts` | `PHASE_GRADES` (the light grade of each phase), `gradeFor(weights)`, the hour-based `TYPICAL_DAY` |
| `src/ambience/lighting.ts` | the per-pixel grade wash (`paintGradeWash`, `gradePlate`, lantern reserve) |
| `src/ambience/cast.ts` | the light plates: painted per phase, blended, moving lights lifted out (`createCastLight`) |
| `src/scene/paint-sky.ts` | the four painted skies and their mirrored water plates |
| `src/scene/sky-light.ts` | `createSkyLight`: sky + water composites, the sun and moon punched out |
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

## The painting
- **Sky plates** (scene, ADR 0145): one per phase, 0.7 px/unit over world y −240 … 500, multiplied
  over the landscape in the cached background. Midday: cerulean graded to warm paper, three
  paper clouds. Sunrise: violet-blue into peach and apricot on the right, rose cloud banks, cool
  blue hills. Sunset: rose-violet, crimson band, ochre glow on the left, crimson/gold cloud banks,
  violet hills. Night: indigo into a paler ultramarine horizon, darker hills, 30 stars left as
  paper. The sun (low, `SUN_R` 22) and the moon (`MOON_R` 17, lunar phase shown) are punched out;
  the sun only above the far ridge.
- **Water plates**: the same skies as horizontal bands on the pond (source-over 0.22 midday …
  0.42 sunset).
- **Light plates** (ambience, ADR 0147): 0.4 px/unit over the world. Grade wash + long shadows of
  boulders, shrubs, trees and the engawa away from the sun (pools at midday) + light caught on the
  crowns at sunrise/sunset + lamp light in the shoji (sunset, night) + stars. Composite lifts the
  sun's glow, the moon and its halo, the broken light path on the pond and the lantern's pool.
- **Grades** (`PHASE_GRADES`): midday 0.03 (bare paper); sunrise lavender 0.2 warmed toward the
  right; sunset amber 0.34 glowing toward the left, lantern 0.45; night indigo 0.5 (+0.26 toward the
  sky), lantern 1, colour taken out first (`LOOK.nightDesaturate` 0.38).
- **Sprites** (ADR 0146): rim light (screen, sunrise peach from the right, sunset gold from the
  left) on plants (0.85) and boulders (0.7); plants' shadow blots (`SHADOW_PLANT` 0.6).
- **Ambience extras**: dawn mist on the far bank and the water, rising 26 units and thinning as the
  sun climbs (`LOOK.dawnMist*`); 16 dew glints twinkling on the near grass at sunrise.

## Caching and cost
- Plates are painted on demand: a sky + water plate ≈ 100 ms, a light plate ≈ 30 ms (M3, Chrome);
  the **next phase's plates are painted in idle time** (`whenIdle`, `nextPhase`).
- Composites are rebuilt only when the weights move by 1/200 or a sun/moon disc by a world unit
  (scene checks every 2 s, ambience every 3 s, both at once after `setTime`). The sky rebuild
  invalidates the background cache (two blits).
- Per frame: one multiply blit of the light composite (+ one saturation fill at night), the water
  composite blit, one shadow and (sunrise/sunset) one rim blit per plant. Ambience stays < 1.5 ms.

## Dev (`?dev`)
- `sprout.setTime('sunrise' | 'midday' | 'sunset' | 'night')`, a blend
  `sprout.setTime({ from: 'sunset', to: 'night', t: 0.5 })`, a v1 alias (`'morning'`, `'noon'`,
  `'evening'`, `'dusk'`, `'dawn'`), an hour of today (`sprout.setTime(6.5)`) or `null` (the clock).
- `sprout.daylight()` → phase, weights, blend, sun/moon discs, shadow, rim, location, sun times,
  override. `sprout.skyStats()` → plates painted, composites, paint ms.
- Screenshots: `npm run shots -- --eval "sprout.setTime('sunset'); sprout.addPlants(25); await sprout.plantsReady(); sprout.settleAmbience()"`.

## Tests
Unit: `solar.test.ts` (London, New York, Tokyo, Sydney ±3 min; polar day, polar twilight, deep polar
night, the exact poles; moon phase), `zones.test.ts`, `daylight.test.ts` (windows, blends, sums,
continuity minute by minute, short days, white nights, polar cases, setTime parsing),
`daylight-source.test.ts`, `sky-layout.test.ts`, `timeofday.test.ts`, `scene/sky-light.test.ts`,
`paint/rim.test.ts`, `plants/shadow.test.ts`. E2E: `tests/e2e/daylight.spec.ts` (each phase's
pixels, the moon and the setting sun as lights, blends, the clock-driven location, fauna's night,
frame budget, plantsReady).

## How to tweak
Sky colours and clouds: `paint-sky.ts` (studio `daylight/sky-*`). Light, shadows, crown lights:
`cast.ts` and `PHASE_GRADES` (studio `daylight/cast-*`, `daylight/garden-*`). Where the sun and
moon are: `sky-layout.ts`. Phase windows: `BLEND_MS`, `GOLDEN_MS` in `daylight.ts`.
