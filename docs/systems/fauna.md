# Fauna

`src/fauna/` — the wildlife that slowly moves into the garden (SPEC §4). Creatures arrive one at a
time as `unlockedFauna(state)` grows, visit rarely, behave like real animals and never overpower the
plants: never more than a handful of visitors on screen.

Look at it: studio → **Fauna · …** sections (`npm run shots -- --studio fauna-koi`,
`/Ssprout/studio.html?entry=fauna-koi/varieties`). Each creature has an `alive` entry (the real
behaviour code on a small painted stage; `?t=` presimulates so stills show real behaviour) and a
`parts` sheet; **Fauna · everyone** runs the real scheduler with everything unlocked.

## Wiring
```ts
// main.ts (one line)
void renderer.add(createFauna({ species: getSpecies, debug: dev }));
```
`createFauna` (`index.ts`) returns the `FaunaSystem` (`system.ts`) and, with `debug`, installs
`window.sprout.fauna` once `installDebug` has run (a microtask later).

| File | What |
|---|---|
| `tuning.ts` | **every** pacing / size / speed constant (the table below) |
| `schedule.ts` | pure visit scheduling: gaps, first visits, caps, night, reduced motion |
| `roster.ts` | unlock ids → residents (koi count, striders, frog) + visiting kinds; `kindOf` aliases |
| `targets.ts` | flower heads, perches, lily pads, heron wading spots, perspective fit — from `SceneGeometry` |
| `math.ts` | steering (`springStep`, `arrive`, `turnToward`), polygons, pond plane, cubic paths, hours |
| `sim.ts` | `FaunaSim`: world, residents upkeep, visits, ripples, per-layer drawing, entities |
| `system.ts` | render System wrapper: store → roster/targets, session → lively, clock → night; first sightings → `fauna:arrived` (`sightedFauna`, ADR 0120) |
| `sprite.ts` | `paintSprite` (engine-painted parts), `deepCopy` (under-water copy), `ArtCache`, scratch canvas |
| `creatures/<kind>.ts` | art + behaviour per creature; `creatures/index.ts` spawns, `sheets.ts` studio sheets, `flight.ts` shared flying-visitor helpers (entry/exit points off the view, flower choice) |
| `stage.ts`, `fauna.studio.ts` | studio stages and entries |
| `dev.ts` | `window.sprout.fauna` |

## Layers and depth
| Creature | Layer | Notes |
|---|---|---|
| koi | `underwater` | clipped to the pond; crisp/warm near the surface, blurred/cooler deep |
| striders, floating leaf, ripples, heron reflection | `waterSurface` | clipped to the pond |
| small birds on a perch, frog, standing heron | `entities` | depth = the supporting rock / stone / pad base y (+ε) or the heron's feet y |
| dragonfly, butterflies, bees, birds in flight, swallows, heron in flight, falling leaf | `air` | |

Birds on a rock use the rock's base y (+1) rather than their feet y, so they draw in front of the
rock entity they stand on (feet are on its top, which is above its base).

## Creatures and behaviour
| Kind (unlock id) | Behaviour |
|---|---|
| `strider` (striders) | resident ×3 (reduced: 1). Rest 1–6 s with tiny twitches, then a rowing burst that glides to a stop (exp. friction), choosing a heading away from the shore and other striders; a faint ring per burst. Moves in the pond plane, contained with a margin. |
| `leaf` (striders) | occasional. See-saws down from above the pond (swing settles before landing), lands with a ring, drifts on a noise current for ~1 min, soaks away. |
| `dragonfly` | visitor. Darts in from off-screen (critically damped spring), hovers 1.5–5 s with the faintest drift, darts a short way, sometimes dips to touch the water (ring), leaves. Wings a flickering blur sprite over glassy wings. |
| `koi` (koi-1/2/3) | resident, one per unlock. Wander targets ahead-ish in the pond plane, rate-limited turns, look-ahead shore avoidance, separation from other koi, glides on spread fins; depth drifts slowly and now and then rises near the surface (a "kiss" ring) and sinks. Body = painted strip cut into 9 segments laid along a trail-following spine + a travelling swim wave, flowing caudal fin with lagging sweep, long paddling pectoral fins; composed at full opacity in a scratch canvas, then laid down faded. Varieties by seed: Kohaku, Yamabuki ogon, Sanke, Showa, Asagi. |
| `butterfly` (butterflies) | visitor (cabbage white 65 %, swallowtail). Erratic: heading wanders on a noise field around the way to a flower, bobbing lift per downstroke; swallowtails glide between flap bursts. Lands, wings slowly breathe open/closed, visits 2–4 flowers (nearby ones likelier), drifts away. |
| `bee` (bees) | visitor, 1–2 staggered. Zips with a slight weave, hovers in front of a bloom, settles and crawls, short hops to nearby blooms (4–9 visits), leaves. |
| `bird` (small-birds) | visitor, wagtail or sparrow. Bounding flight on a cubic path (flap bursts / folded glides), lands on a free perch (`choosePerch`: wagtails prefer rocks, sparrows stones), then hops along the perch, pecks, turns, stands; wagtails pump the tail; flies off after 16–45 s. |
| `frog` | resident once `frog` unlocks (a water plant and 10 finished plants) **and** a lily pad exists (a water species in a water slot). Sits on the pad, throat pulses with breath, sometimes turns; every 240–700 s (`frogDive`) crouches and hops into open water (big ring), stays under 30–90 s (`frogAway`), climbs back. |
| `swallow` (swallows) | visitor group of 1–3 sweeping one swooping cubic across the sky band, flap bursts and swept glides. Not in reduced motion. |
| `heron` | rare visitor. Slow wingbeats in (the wing foreshortens through edge-on as it beats), glides down to a wading spot on the far edge of the pond, clear of boulders, pads and far-bank plants (`heronStands`, cached), stands 1.5–4 min: slow neck drift, craning forward, a rare step; crouches and leaves with slow beats. Faint reflection. |

**Targets.** Flowers: finished plants whose species has `pollinators`, a seeded point in the top
third of the sprite box (slot position + `size` × `scale` + `anchor`). Pads: water species in water
slots. Perches: rocks flagged `perch` (top of the rock, a little dome) and every stepping stone.
Kinds without targets are not scheduled (no bees without pollinator flowers…).

**Mode.** `night` (the shared daylight's night weight ≥ 0.5 — `FaunaSim.nightSource`, ADR 0141; without a
daylight, or with `setHour`, the local hour in `nightHours` [20, 5)): diurnal visitors are not scheduled and
those present leave; koi, striders, frog and leaves stay. `lively` (a session running, not paused):
gaps × 0.75. `reduced` (prefers-reduced-motion): gaps × 3, speeds × 0.6, stays × 1.5, one visitor
at a time, one strider, no swallows.

## Pacing table (`tuning.ts › VISITS`)
| Kind | gap (s) | first visit (s) | stay (s) | group | max on screen |
|---|---|---|---|---|---|
| leaf | 120–300 | 20–90 | 50–90 | 1 | 2 (not counted as a visitor) |
| dragonfly | 100–260 | 15–60 | 25–55 | 1 | 1 |
| butterfly | 80–200 | 20–70 | 35–70 | 1–2 | 2 |
| bee | 60–150 | 20–60 | 30–60 | 1–2 | 3 |
| bird | 130–320 (× 0.6 at 25 plants) | 30–90 | 16–45 | 1–2 | 2 |
| swallow | 240–600 | 60–180 | one pass | 1–3 | 3 |
| heron | 900–1800 | 120–400 | 90–220 | 1 | 1 |

`maxVisitors` 3 (counting individuals). A due visit that is blocked (cap, night) is retried after
8–20 s, not dropped. Sizes (world units at perspective 1): strider 13, bee 7, butterfly 24 / 30,
dragonfly 30, sparrow 19, wagtail 27, frog 17, swallow 26, koi 56–76 (≈ 45–60 after the pond's
perspective), heron 150 tall (≈ 95–110 on the far shore). Sizes were tuned against the painted
scene (boulders 60–150 wide).

## Art
Every part is painted once with the paint engine (`paintSprite` → `createPainter`, washes,
wet-in-wet, dabs, ink lines, clipped wet layers for markings) into a small transparent canvas at
`ArtCache.res` device px per world unit (bucketed `viewport.pixelScale`; cleared on change), and
composed per frame with `drawImage` transforms only — no vector shapes. Koi get `deepCopy` twins
(down/up-sampled blur + cool tint) and cross-fade by depth. Flapping is done with frames
(bee/dragonfly blur sprites, bird up/down/fold, swallow spread/up/swept) or by foreshortening a
single wing (butterflies horizontally, heron vertically).

## Dev API (`window.sprout.fauna`, ?dev)
`kinds()`, `spawn(id, count?)` (kinds or unlock ids; ignores schedule, cap and night; the frog needs
a pad), `list()` (`{ id, kind, x, y, layer, state, visitor, inPond }`), `clear()`,
`step(seconds, dt?)` (advance the sim without rendering), `setHour(h | null)` (pins an hour over the daylight), `night()`, `roster()`,
`schedule()` (seconds until each visit), `pond()`, `view()`, `targets()` (flowers, pads, perches,
heron stands), `bench(frames?)` (update + draw ms).
```js
sprout.fauna.setHour(12); sprout.fauna.spawn('heron'); sprout.fauna.step(25); await sprout.freeze();
```

## Performance
`bench(300)` in headless Chromium (Apple M3), 1440×900 at DPR 2, 17 creatures (3 koi, 3 striders,
dragonfly, 2 butterflies, 3 bees, 2 birds, 3 swallows, heron, leaves): **update 0.01–0.02 ms + draw
0.87–1.18 ms per frame** (placeholder vs painted scene; budget 1.5 ms). Painting parts happens on first appearance (a few ms per kind).

## Adding a creature
1. Add its kind (and visit tuning if it visits) to `tuning.ts`; map its unlock id in `roster.ts`.
2. Write `creatures/<kind>.ts`: a `paint…(res, seed)` returning sprites, and a class extending
   `BaseCreature` with `update(dt, w)`, `draw(layer, ctx, w)` (and `depth()` when on the ground).
   Randomness from `w.rng`, noise from `w.noise`, targets from `w.flowers / perches / pads`, never
   coordinates of your own.
3. Spawn it in `creatures/index.ts`, add a sheet in `creatures/sheets.ts` and a show in
   `fauna.studio.ts`.
4. Test the pure parts; extend `sim.test.ts` / `tests/e2e/fauna.spec.ts` if it has new rules.

## Tests
`math.test.ts`, `schedule.test.ts` (delays, caps, night, reduced, retries, roster mapping),
`targets.test.ts` (flowers, pads, perches, perch choice, heron stands, perspective), `sim.test.ts`
(long simulated afternoons: residents, pond containment, visitor cap, rarity, determinism, night,
reduced motion), `arrivals.test.ts` (`sightedFauna`, `fauna:arrived` on first sight). E2E
`tests/e2e/fauna.spec.ts`: striders from the start, koi with plants, roster and schedule, every
creature spawned stays in bounds, birds land as entities and leave (the test follows the spawned
bird by id), night rest, cost and a clean render. Simulation loops run in-page with the renderer
frozen.

## Arrivals (ADR 0120)
Every 0.5 s the system maps the creatures inside `viewport.visible` to unlock ids (`sightedFauna`:
koi are counted, so a second koi is `koi-2`; hand-spawned dev/studio creatures and leaving ones are
ignored) and emits `fauna:arrived {id}` once per run for each unlocked, announceable id not yet in
`state.faunaSeen`. The UI's quiet line shows it and records it with `controller.announceFauna(id)`.
Unit test: `arrivals.test.ts`.

## Time of day
Night comes from the Clock's local hour. `sprout.setTime` (ambience) does not reach the fauna; use
`sprout.fauna.setHour(h)`.
