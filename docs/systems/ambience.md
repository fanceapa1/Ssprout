# Ambience & lighting

`src/ambience/` — the garden "working with you" during a session (sun / rain / mist, photosynthesis
motes), the shared wind field, and the light of the four daylight phases (docs/systems/daylight.md). **Subtlety is the whole brief**: low
contrast, slow, never competing with the plants. Look at it in the studio (**Ambience · session
weather**, **· photosynthesis motes & wind**, **· time of day**) or with `npm run shots`.

## Files
| File | What |
|---|---|
| `wind.ts` | pure seeded wind field `wind(t, x, y, boost?)` (shared contract, ADR 0083) |
| `envelope.ts` | pure: phase → channel targets, critically damped easing (ADR 0081) |
| `timeofday.ts` | `PHASE_GRADES` per daylight phase, `gradeFor(weights)`, `TYPICAL_DAY` / `gradeAt(hour)` for hour callers (ADRs 0082, 0141) |
| `motes.ts` | pure: mote emitters from plants + session slot, spawn rate |
| `sim.ts` | pure: particles (rain ×3 depths, ripples, glints, motes) as Poisson spawns (ADR 0084) |
| `lighting.ts` | per-pixel grade wash (`paintGradeWash`, pure), `washField`, `gradePlate`; lantern reserve |
| `cast.ts` | the painted light plate of each daylight phase and their blended composite (ADR 0147); `version()` bumps on every repaint |
| `device-plate.ts` | the resting light plate at device resolution (ADR 0207) |
| `night-edge.ts` | where a dark light stops: the wash lifted back to paper with a ragged, pooled edge just inside the stage's dissolve (ADR 0184) |
| `solar.ts`, `zones.ts`, `daylight.ts`, `daylight-source.ts`, `sky-layout.ts` | the daylight: sun times, location, phases, the shared source, where the light falls — docs/systems/daylight.md |
| `sprites.ts` | pre-painted textures: the sun's lifted glaze (`sunBands`, `sunGround`, `sunGlazeAt`, pure), rain strokes, ripple rings, glints, leaf glints, motes, mist bands, flame |
| `ambience.ts` | the engine: update + draw into world-unit contexts (no store, no renderer — ADR 0080) |
| `system.ts` | render `System` adapter (store, Clock, dev overrides, cost metering) |
| `dev.ts`, `index.ts` | `window.sprout` methods; `addAmbience(renderer, { dev, daylight })` |
| `ambience.studio.ts` | studio entries over a painted test garden |

Registered in `main.ts`: `const ambience = addAmbience(renderer, { dev: speedClock !== null, daylight })` (the shared daylight source), then
(ADR 0121) `ambience.revealLightAfter(renderer.whenReady())` and, once painted,
`ambience.onLight((grade) => applyUiLight(uiRoot, grade))`.
- `revealLightAfter(promise)`: the lighting draws with alpha 0 until the promise resolves (never a
  wash on bare paper), then eases in over 1.4 s (`LIGHT_REVEAL_S`; at once under reduced motion, a
  frozen frame or `settle()`).
- `onLight(fn)` → unsubscribe: reports the grade whenever the lighting repaints (the UI dims its
  slips with it, `src/ui/ambient-light.ts`).

## Layers
| Layer | Draws |
|---|---|
| `waterSurface` | ripple rings (rain) and warm glints (sun), clipped to `scene.pond` |
| `ambience` | the sun's glaze with its lifted light (multiply), the rain grade (multiply), mist bands + veil, dawn mist and dew (sunrise), leaf glints (screen), rain strokes (multiply), motes |
| `lighting` | night desaturation (the frame backed with white, then a saturation glaze over the drawn view, ADR 0206), the daylight light plate composite (multiply), the night edge (screen space, ADR 0184) + a tiny lantern flame (screen) |

Inputs come only from the `SceneGeometry` contract (`pond`, `waterline`, `pavilion.lantern`, `slots`)
and the store (`session.weather`, phase via `sessionPhase`, `plants`, session slot + growth).

## Effects
- **Sun** (ADR 0193): a thin raw-sienna glaze over the garden, mottled, fading out above the hills
  so the sky is never striped, with four soft diagonal bands of light (≈ 0.62 rad, from the upper
  left) **lifted out** of it: the width wanders slowly, the lifted pigment pools a little darker at
  the edge, and the light comes in soft from the hills and dies away on the near bank. Two sprites,
  each favouring one group of bands, are cross-weighted by a 13 s breath, so the light shifts as
  under drifting cloud while the glaze stays constant. Warm lifted glints on the far water, and
  **leaf glints**: warm dabs on the sunlit (upper left) side of the plants' crowns, spawned from the
  mote emitters. All of it fades with the night weight. The old screen shafts read as pale columns
  over the sky and are gone.
- **Rain**: tapered, faintly broken ink-wash strokes in three depths (far: short, slow, many; near:
  long, fast, few), slanted by the wind; broken ripple rings (deep line + pale lifted line, often a
  second ring) expanding on the pond; a cool grey grade; a **drip line** off the pavilion eave — drops
  gather at points every ~30 units along the fascia (`eaveOf(scene)`, from the scene's own
  `pavilionFrame`) and fall straight down under gravity, stretching as they speed up, to the foot of
  the deck (`pavilion.y + h`).
- **Mist**: four horizontally tileable painted bands (dense bottom, wispy top) hugging the far bank
  and far water, drifting at different speeds, plus one faint wisp low on the water; a thin veil over
  the far half only (fades out above the plant zone). At night the mist is thinned (`mistNight`
  0.45) so it does not read as fog under the indigo wash.
- **Motes**: pale gold/green specks rising from plants (the growing plant weighs 3×), drifting with the
  wind, fading in and out over 7–11 s. Focus only; at most 7 alive.
- **Lighting**: a noise-mottled multiply wash with rare soft backruns; the sky deepens first, the
  foreground stays lighter (plants readable); a warm, thinner wash toward a low sun; at dusk and
  night the paper is **reserved** (left lighter and warm) around `pavilion.lantern` and on the water
  where its light falls (mirrored about `waterline` if that lands on the pond, else the nearest water;
  then stepped toward the pond's middle until it is off the shore and clear of the water hidden under
  the pavilion — in the garden scene it lies just left of the front post, broken into soft bands).
- **Real-scene check** (1440×900, 1920×1080 and 390×844): mist bands sit on the hills, the far bank
  and the far water (heights derive from the pond's top); at 1× DPR the rain strokes needed more
  weight than on phones. The pre-paper frame is white, so light is never added with `screen` over
  paper: the sun's light is lifted out of its glaze, and only the leaf glints (over foliage) and the
  water glints use screen.

## Envelopes (`envelope.ts`)
Channels `sun rain mist motes motion boost`, each eased toward a target with a critically damped
spring (exact solution, frame-rate independent, no overshoot from rest).

| Phase | weather level | motes | motion | boost |
|---|---|---|---|---|
| idle | 0 | 0 | 1 | 0 |
| focus | 1 | 1 | 1 | 1 |
| break | 0.55 (softens) | 0 | 0.75 | 0.5 |
| paused | 0.3 (a still trace) | 0 | 0 (held breath) | 0 |

Settle times (to 2 %): weather/boost 4 s (start, end, weather change, break), motion 3 s (pause /
resume), motes 3 s. Every particle advances on **ambience time** (`dt × motion`), so a pause slows
everything to stillness rather than cutting it. Reduced motion: motion 0 and motes 0 always; the
weather's strokes are laid down once (static, faint) and fade with the envelope; lighting unchanged.
On load and on dev previews the envelope snaps to steady state and particles are pre-simulated.

## Daylight light (`cast.ts`, `timeofday.ts`; ADRs 0141, 0147)
The v1 hour keyframes are gone: the engine gets the shared `DaylightState` every frame (from the
`DaylightSource` main creates) and multiplies the **light plate** of the current phase blend in
the `lighting` layer. Each phase's plate is painted once (on demand; the next phase in idle time):

| Phase | Grade (multiply) | Amount | Painted on top | Lantern |
|---|---|---|---|---|
| sunrise | lavender `204,202,234`, peach glow right | 0.20 | long cool shadows to the left, light on the crowns' right sides | 0.08 |
| midday | near paper `252,248,236` | 0.03 | short pools under boulders, trees, shrubs, the deck | 0 |
| sunset | amber `242,186,128`, gold glow left | 0.34 | long violet shadows to the right, light on the crowns' left sides, lamp light in the shoji | 0.45 |
| night | indigo `92,106,184` (+0.22 toward the sky, × 1.2 toward the near ground) | 0.54 | lamp light in the shoji and on the deck, stars left as paper | 1 |

The composite lifts the moving lights (a warm glow round the low sun, the moon and its halo, the
broken light path on the pond, the lantern's pool) and is rebuilt when the light moved (checked
every `LIGHT.redrawS` 3 s, at once after `setTime`). At night a saturation glaze takes some colour
out first (`LOOK.nightDesaturate` 0.38), over a frame backed with white so it never leaves grey where the painting is thin (ADR 0206). Sunrise also lays **dawn mist** on the far bank and the
water (bands 1–3, rising `dawnMistRise` 26 units and thinning as the sun climbs) and twinkles 16
**dew glints** on the near grass. The sun's glaze and glints fade with the night weight. A zoomed-in
view gets a sharp **detail plate** for its part of the world (`CAST_DETAIL_MAX` 2 px per unit),
repainted one phase per idle callback (ADR 0163). In dark light the wash stops short of the
stage's dissolve with a watercolour edge instead of fading to a grey haze (`night-edge.ts`,
`edgeStrength`: night 1, sunset 0.35, sunrise 0.15; ADR 0184). Details, the
phase windows and the sky: docs/systems/daylight.md.

## Wind API (`wind.ts`)
```ts
import { wind, windBoost } from '../ambience';
const { sway, gust } = wind(f.t, x, y, windBoost(phase)); // sway -1..1 (+ = toward +x), gust 0..1
```
Pure and deterministic (fixed seed; `createWind(seed)` for others). Slow base lean + flutter + gust
fronts travelling toward +x at 140 units/s (neighbouring plants lean one after another). `boost`
0..1 multiplies the amplitude by up to 1.35 (`windBoost`: focus 1, break 0.5, otherwise 0) — "plants
sway a touch more" during a session. The plant system uses `sway` for its skew (via
`src/plants/wind-adapter.ts`); the fauna does not read the wind field. Unit tests cover bounds, determinism, continuity, boost and the front direction.

## Tuning constants
`LOOK` (ambience.ts): `sunGlaze` 0.35 (multiply, `COLOURS.sunGlaze` 228,204,158; lift −92 %, rim
+16 %), `sunBreathS` 13 / `sunBreath` 0.35, `leafGlintAlpha` 0.55, grade alphas (rain 0.2, mist veil
0.08), rain alpha per depth 0.30/0.36/0.42 and widths 0.9/1.2/1.5,
`mistNight` 0.45, `rippleAlpha` 0.75, squash 0.3, `glintAlpha` 0.65, `dripAlpha` 0.6, `dripMaxLen` 30, flame 0.22.
`LEAF_GLINT` (sim.ts): 0.9/s × sun, life 1.6–3.2 s, size 3.5–6.5, ≤ 6. `RAIN` (sim.ts): strokes per depth 84/50/20 per full world, speeds 300/470/720, slant 0.2 rad +
0.14 × sway. `RIPPLE` 2.4/s, max 16. `GLINT` 1.2/s, max 5. `DRIP` spacing 30, 0.6/s per point,
v0 30, gravity 1300, max 24. `LIGHT.reflectLift` 0.45, `lanternR` 78, `lanternLift` 0.8. `LOOK.nightDesaturate` 0.38, `dawnMist` 1.25, `dawnMistRise` 26, `dewCount` 16, `dewAlpha` 0.75.
`MOTE` (motes.ts): 0.15/s + 0.06/s per weight, ≤ 0.6/s, ≤ 7 alive. `ENVELOPE`, `LIGHT` as above.

## Dev (`?dev`)
`sprout.setTime('sunrise'|'midday'|'sunset'|'night'|{ from, to, t }|hour|null)` (v1 names kept as aliases;
moves the sky, light, shadows, rims and fauna — docs/systems/daylight.md), `sprout.daylight()`,
`sprout.setWeather('sun'|'rain'|'mist'|null)` (preview without a session; snaps to steady state),
`sprout.settleAmbience()` (skip running transitions — call before `freeze()` for screenshots),
`sprout.lightDetail()` (the light plate's detail for the resting view: rect, scale, painted yet; null: none),
`sprout.ambience()` → `{ phase, weather, preview, levels, time (daylight phase), weights, counts (rain, ripples, glints, leafGlints, motes, drips), lightingPaints,
lightingMs, reducedMotion, ms, timeOverride, location, sunTimes }` (`ms` = moving average of update + draw per frame).
```
npm run shots -- --name night-rain --eval "sprout.setTime('night'); sprout.start(25); sprout.setWeather('rain')"
```

## Performance
Headless Chromium, 1440×900: rain (132 strokes + ripples) ≈ 0.35 ms/frame, sun ≈ 0.14, mist ≈ 0.06
(update + draw command recording); the lighting blit is one full-frame `drawImage` with
`imageSmoothingQuality = 'low'`. While the view rests the plate is resampled once into a
frame-sized buffer and laid 1:1 (`device-plate.ts`, ADR 0207; rebuilt when `cast.version()`, the
transform or the canvas size changes): on a CPU rasteriser ~4 ms instead of ~17–30 ms a frame at
2824×1584, the same on a GPU, one frame-sized buffer of memory (bilinear — `'high'` made each blit dramatically slower on software
GPUs and is invisible on a soft wash). Sprites and the lighting noise field are built once per
scene + seed and shared between engines (the studio runs several). Budget 1.5 ms is
asserted in `tests/e2e/ambience.spec.ts`. Sprites are painted once per scene (~100 ms total).

## Tests
Vitest: `sun.test.ts` (the glaze: sky unglazed, lifted bands, diagonal fall, pooled edge, half lift;
leaf glints on the sunlit side, only in sun, still while paused), `wind.test.ts`, `envelope.test.ts` (start / end / pause / resume / break / weather change,
frame-rate independence), `timeofday.test.ts` (phase grades, blends, readability at night, the typical day),
`motes.test.ts` (emitters, rates, sim bounds, reduced-motion stillness, determinism),
`lighting.test.ts` (wash ordering, lantern reserve and reflection, mottling, glow),
`device-plate.test.ts` (resample once at rest, same pixels, direct again on change),
`night-edge.test.ts` (the mask's bands, dark light only, lift and broken rim, determinism).
Playwright: `tests/e2e/ambience.spec.ts` (session weather, each preview, night, pause/end fades, the
sun's glaze warm in the garden but not the sky and a trace on pause,
setTime phases, blends and aliases, frame budget, reduced-motion emulation); the daylight tests are listed in docs/systems/daylight.md.
