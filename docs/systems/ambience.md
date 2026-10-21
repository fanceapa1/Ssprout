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

Registered in `main.ts` with one line: `addAmbience(renderer, { dev: speedClock !== null })`.

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
  second ring) expanding on the pond; a cool grey grade. No eave drip line (the eave position is not
  in the geometry contract).
- **Mist**: four horizontally tileable painted bands (dense bottom, wispy top) drifting at different
  speeds over the far bank, far water and one faint low band; a thin veil.
- **Motes**: pale gold/green specks rising from plants (the growing plant weighs 3×), drifting with the
  wind, fading in and out over 7–11 s. Focus only; at most 7 alive.
- **Lighting**: a noise-mottled multiply wash with rare soft backruns; the sky deepens first, the
  foreground stays lighter (plants readable); a warm, thinner wash toward a low sun; at dusk and
  night the paper is **reserved** (left lighter and warm) around `pavilion.lantern` and on the water
  where its light falls (mirrored about `waterline` if that lands on the pond, else the nearest water).

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
| 5:00 | night | indigo `70,80,132` | 0.68 (+0.16 sky, ×0.8 ground) | — | 1 |
| 6:30 | dawn | blue-grey `178,184,210` | 0.34 | pink, right | 0.2 |
| 8:00 | morning | cool `208,220,230` | 0.20 | pale, right | 0 |
| 11:00–15:30 | noon | neutral | 0.03 | — | 0 |
| 17:45 | evening | golden `238,196,146` | 0.30 | warm, low left | 0.12 |
| 19:30 | dusk | blue `124,140,200` | 0.40 | rose, low left | 0.6 |
| 21:15 | night | indigo | 0.68 | — | 1 |

`setTime` names jump to: morning 8, noon 13, evening 17.75, dusk 19.5, night 23. The wash is painted
per pixel into a 480×300 world cache (`LIGHT.cacheScale` 0.3) and blitted every frame; it is repainted
on demand (override change) or, following the clock, at most every 3 s and only when the grade moved
perceptibly (`LIGHT.redrawEps`). A repaint costs ~6 ms.

## Wind API (`wind.ts`)
```ts
import { wind, windBoost } from '../ambience';
const { sway, gust } = wind(f.t, x, y, windBoost(phase)); // sway -1..1 (+ = toward +x), gust 0..1
```
Pure and deterministic (fixed seed; `createWind(seed)` for others). Slow base lean + flutter + gust
fronts travelling toward +x at 140 units/s (neighbouring plants lean one after another). `boost`
0..1 multiplies the amplitude by up to 1.35 (`windBoost`: focus 1, break 0.5, otherwise 0) — "plants
sway a touch more" during a session. The plant system should use `sway` for its skew; fauna may use
both. Unit tests cover bounds, determinism, continuity, boost and the front direction.

## Tuning constants
`LOOK` (ambience.ts): grade alphas (sun 0.15, rain 0.2, mist veil 0.08), `shaftAlpha` 0.42 (screen),
breath 13 s / 0.35, rain alpha per depth 0.24/0.30/0.34 and widths 0.7/0.95/1.25, `rippleAlpha` 0.75,
squash 0.3, `glintAlpha` 0.65, flame 0.22. `RAIN` (sim.ts): strokes per depth 70/42/16 per full world,
speeds 300/470/720, slant 0.2 rad + 0.14 × sway. `RIPPLE` 2.4/s, max 16. `GLINT` 1.2/s, max 5.
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
(update + draw command recording); the lighting blit is one full-frame `drawImage`. Budget 1.5 ms is
asserted in `tests/e2e/ambience.spec.ts`. Sprites are painted once per scene (~100 ms total).

## Tests
Vitest: `wind.test.ts`, `envelope.test.ts` (start / end / pause / resume / break / weather change,
frame-rate independence), `timeofday.test.ts` (keyframes, smooth wrap, readability at night),
`motes.test.ts` (emitters, rates, sim bounds, reduced-motion stillness, determinism),
`lighting.test.ts` (wash ordering, lantern reserve and reflection, mottling, glow).
Playwright: `tests/e2e/ambience.spec.ts` (session weather, each preview, night, pause/end fades,
setTime parsing, frame budget, reduced-motion emulation).
