# Ambience & lighting

`src/ambience/` — the garden "working with you" during a session (sun / rain / mist, photosynthesis
motes), the shared wind field, and time-of-day lighting. **Subtlety is the whole brief**: low
contrast, slow, never competing with the plants. Look at it in the studio (**Ambience · session
weather**, **· photosynthesis motes & wind**, **· time of day**) or with `npm run shots`.

## Files
| File | What |
|---|---|
| `wind.ts` | pure seeded wind field `wind(t, x, y, boost?)` (shared contract, ADR 0083) |
| `envelope.ts` | pure: phase → channel targets, critically damped easing (ADR 0081) |
| `timeofday.ts` | pure: keyframes, `gradeAt(hour)`, `localHour`, `parseTimeOverride` (ADR 0082) |
| `motes.ts` | pure: mote emitters from plants + session slot, spawn rate |
| `sim.ts` | pure: particles (rain ×3 depths, ripples, glints, motes) as Poisson spawns (ADR 0084) |
| `lighting.ts` | per-pixel multiply wash (`paintGradeWash`, pure) + its cached canvas |
| `sprites.ts` | pre-painted textures: shafts, rain strokes, ripple rings, glints, motes, mist bands, flame |
| `ambience.ts` | the engine: update + draw into world-unit contexts (no store, no renderer — ADR 0080) |
| `system.ts` | render `System` adapter (store, Clock, dev overrides, cost metering) |
| `dev.ts`, `index.ts` | `window.sprout` methods; `addAmbience(renderer, { dev })` |
| `ambience.studio.ts` | studio entries over a painted test garden |

Registered in `main.ts`: `const ambience = addAmbience(renderer, { dev: speedClock !== null })`, then
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
| `waterSurface` | ripple rings (rain) and glints (sun), clipped to `scene.pond` |
| `ambience` | weather grades (multiply), mist bands + veil, light shafts (screen), rain strokes (multiply), motes |
| `lighting` | the cached time-of-day wash (multiply) + a tiny lantern flame (screen) |

Inputs come only from the `SceneGeometry` contract (`pond`, `waterline`, `pavilion.lantern`, `slots`)
and the store (`session.weather`, phase via `sessionPhase`, `plants`, session slot + growth).

## Effects
- **Sun**: four diagonal shafts from the upper left in two groups breathing in antiphase (13 s),
  noise-broken edges and faint lengthwise streaks, dissolving toward the ground; a faint warm
  multiply grade; occasional lifted-paper glints on the far water. Shafts/glints fade at dusk/night.
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
- **Real-scene check** (1440×900 and 390×844): mist bands sit on the hills, the far bank and the far
  water (heights derive from the pond's top); at 1× DPR the rain strokes needed more weight than on
  phones, and the shafts only read over foliage, hills and water (the pre-paper sky is white, so a
  `screen` shaft cannot lighten it — they read against the slightly stronger warm grade instead).

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

## Time-of-day keyframes (`timeofday.ts`)
Local hour from `Clock.now()` (or `setTime`). Smoothstep between neighbours, wrapping at midnight.

| Hour | Name | Tint (multiply) | Amount | Glow | Lantern |
|---|---|---|---|---|---|
| 5:00 | night (moonlit) | indigo `100,114,182` | 0.47 (+0.2 sky, ×0.66 ground) | — | 1 |
| 6:30 | dawn | blue-grey `178,184,210` | 0.34 | pink, right | 0.2 |
| 8:00 | morning | cool `208,220,230` | 0.20 | pale, right | 0 |
| 11:00–15:30 | noon | neutral | 0.03 | — | 0 |
| 17:45 | evening | golden `238,196,146` | 0.30 | warm, low left | 0.12 |
| 19:30 | dusk | blue `146,158,206` | 0.34 | rose, low left | 0.6 |
| 21:15 | night | indigo | 0.47 | — | 1 |

`setTime` names jump to: morning 8, noon 13, evening 17.75, dusk 19.5, night 23. The wash is painted
per pixel into a 480×300 world cache (`LIGHT.cacheScale` 0.3) and blitted every frame; it is repainted
on demand (override change) or, following the clock, at most every 3 s and only when the grade moved
perceptibly (`LIGHT.redrawEps`). A repaint costs ~5 ms. `setTime` affects the ambience lighting
only: fauna night (`sprout.fauna.setHour`) and audio do not follow it.

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
`LOOK` (ambience.ts): grade alphas (sun 0.2, rain 0.2, mist veil 0.08), `shaftAlpha` 0.6 (screen,
near-white cream), breath 13 s / 0.35, rain alpha per depth 0.30/0.36/0.42 and widths 0.9/1.2/1.5,
`mistNight` 0.45, `rippleAlpha` 0.75, squash 0.3, `glintAlpha` 0.65, `dripAlpha` 0.6, `dripMaxLen` 30, flame 0.22.
`RAIN` (sim.ts): strokes per depth 84/50/20 per full world, speeds 300/470/720, slant 0.2 rad +
0.14 × sway. `RIPPLE` 2.4/s, max 16. `GLINT` 1.2/s, max 5. `DRIP` spacing 30, 0.6/s per point,
v0 30, gravity 1300, max 24. `LIGHT.reflectLift` 0.45.
`MOTE` (motes.ts): 0.15/s + 0.06/s per weight, ≤ 0.6/s, ≤ 7 alive. `ENVELOPE`, `LIGHT` as above.

## Dev (`?dev`)
`sprout.setTime('morning'|'noon'|'evening'|'dusk'|'night'|hour|null)`,
`sprout.setWeather('sun'|'rain'|'mist'|null)` (preview without a session; snaps to steady state),
`sprout.settleAmbience()` (skip running transitions — call before `freeze()` for screenshots),
`sprout.ambience()` → `{ phase, weather, preview, levels, hour, time, counts, lightingPaints,
lightingMs, reducedMotion, ms, timeOverride }` (`ms` = moving average of update + draw per frame).
```
npm run shots -- --name night-rain --eval "sprout.setTime('night'); sprout.start(25); sprout.setWeather('rain')"
```

## Performance
Headless Chromium, 1440×900: rain (132 strokes + ripples) ≈ 0.35 ms/frame, sun ≈ 0.14, mist ≈ 0.06
(update + draw command recording); the lighting blit is one full-frame `drawImage` with
`imageSmoothingQuality = 'low'` (bilinear — `'high'` made each blit dramatically slower on software
GPUs and is invisible on a soft wash). Sprites and the lighting noise field are built once per
scene + seed and shared between engines (the studio runs several). Budget 1.5 ms is
asserted in `tests/e2e/ambience.spec.ts`. Sprites are painted once per scene (~100 ms total).

## Tests
Vitest: `wind.test.ts`, `envelope.test.ts` (start / end / pause / resume / break / weather change,
frame-rate independence), `timeofday.test.ts` (keyframes, smooth wrap, readability at night),
`motes.test.ts` (emitters, rates, sim bounds, reduced-motion stillness, determinism),
`lighting.test.ts` (wash ordering, lantern reserve and reflection, mottling, glow).
Playwright: `tests/e2e/ambience.spec.ts` (session weather, each preview, night, pause/end fades,
setTime parsing, frame budget, reduced-motion emulation).
