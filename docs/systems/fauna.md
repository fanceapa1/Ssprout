# Fauna

`src/fauna/` — the wildlife that slowly moves into each garden (SPEC §4). Creatures arrive one at a
time as the garden's unlocked rows grow, visit rarely, behave like real animals and never overpower
the plants: never more than a handful of visitors on screen. Each scenery has its own unlock table
and tells the sim where its water, perches and heron stands are (ADR 0248).

Look at it: studio → **Fauna · …** sections (`npm run shots -- --studio fauna-koi`,
`/Ssprout/studio.html?entry=fauna-koi/varieties`). Each creature has an `alive` entry (the real
behaviour code on a small painted stage; `?t=` presimulates so stills show real behaviour) and a
`parts` sheet. **Fauna · everyone** runs the real scheduler with the Japanese garden's table;
**Fauna · the falls** (`fauna-falls/all`) runs the waterfall's table on a small plunge pool with
foam at the foot, a stream, a ledge and wet rocks.

## Wiring
```ts
// main.ts: in its own boot task, once the landscape is painted (ADR 0232)
const fauna = createFauna({ species: getSpecies, daylight });
void renderer.add(fauna);
// … and with ?dev, in the last boot task with the rest of window.sprout
installFaunaDebug(fauna);
```
`createFauna` (`index.ts`) returns the `FaunaSystem` (`system.ts`). With `debug` it installs
`window.sprout.fauna` a microtask later. That works only when `installDebug` runs in the same task,
so `main.ts` calls `installFaunaDebug` itself. The system takes the garden on view from
`SystemContext.scenery` (its `fauna`; without one, the Japanese garden's table) and re-inits with
it when the scenery switches (ADR 0243): new still water and targets, residents reset, that
garden's rows.

| File | What |
|---|---|
| `creatures/<kind>.ts` | one creature: art, behaviour and its default-exported `CreatureDef` (kind = file name) |
| `creatures/registry.ts` | globs `./*.ts`: `creatureDef(kind)`, `creatureDefs()`, `creatureKinds()` |
| `creatures/lib/def.ts` | the contract: `CreatureDef`, `SpawnContext`, `Sheet`, `Show`, `variantOf` |
| `creatures/lib/flight.ts` | shared flying-visitor helpers (entry/exit points off the view, flower choice) |
| `habitat.ts` | `SceneryFauna`: what a scenery tells its wildlife (`Scenery.fauna`) |
| `tuning.ts` | pacing / size / speed constants of the garden's creatures (`VISITS`, `SIZES`, `SPEEDS`, `FAUNA_TUNING`) |
| `schedule.ts` | pure visit scheduling: gaps, first visits, caps, night and night-only, reduced motion; `visitTuning(kind)` |
| `roster.ts` | unlocked rows → resident counts, visiting kinds, variants, boosts (`rosterFor`) |
| `targets.ts` | flower heads, perches (rocks, stones, `ledgePerch`), lily pads, heron wading spots, perspective fit |
| `math.ts` | steering (`springStep`, `arrive`, `turnToward`), polygons (`carveEllipse`, `clockwise`, `containPoint`), pond plane, cubic paths, hours |
| `sim.ts` | `FaunaSim`: world (still water, water clip, targets), residents upkeep, visits, ripples, per-layer drawing, entities |
| `system.ts` | render System wrapper: store → that garden's rows and targets, scenery → its `fauna`, session → lively, clock → night; first sightings → `fauna:arrived` (`sightedFauna`, ADR 0120) |
| `sprite.ts` | `paintSprite` (engine-painted parts), `deepCopy` (under-water copy), `ArtCache`, scratch canvas |
| `types.ts` | shared shapes: the creature world (`PondInfo`, `WaterInfo`, targets, art cache, rng, noise) |
| `stage.ts`, `fauna.studio.ts`, `close-view.studio.ts` | studio stages (`pond`, `falls`) and entries (`close-view.studio.ts`: **Close view · creatures**, ADR 0188) |
| `dev.ts` | `window.sprout.fauna` |

## Sceneries (ADR 0248)
Each `Scenery` carries `fauna: SceneryFauna`:

| Field | Japanese garden | Waterfall |
|---|---|---|
| `unlocks` | `JAPANESE_FAUNA` (`scenery/japanese-garden/fauna.ts`) | `WATERFALL_FAUNA` (`scenery/waterfall/fauna.ts`) |
| `water` | default: `geometry.pond` still, `geometry.streams` moving (none) | the pool still, minus a foam ellipse (84 × 30) at the falls' foot; the stream moving |
| `perches` | default: rocks flagged `perch`, every stepping stone | the six ledge edges (`ledgePerch`) and the four wet rocks; no trail stones |
| `stands` | default: `heronStands` along the pond's far edge | three on the pool's back edge right of the falls (x 830–940), clear of pads when it can |
| `perspective(x, y)` | default: a line fitted through the slots' scales | `perspectiveScale(y)` on the ground; inside the cliff, crown 0.6 under the skyline → the shelf scales 0.64/0.68/0.72 → the foot (within 0.02 of every slot; the fitted line was 7–15 % off) |

The sim's still water (`w.pond`) is what the water creatures live on (striders, koi, the floating
leaf; `pond.plane` for the plane maths). The water layers (`underwater`, `waterSurface`) clip to
`w.water.clip`: the still outline (foam included) and the streams, wound alike so the nonzero clip
is their union. Creatures read perspective as `w.perspective(y, x)`: always pass `x`.

**Unlock tables** (`core/fauna-unlocks.ts`, generic; core imports neither `src/fauna` nor
`src/scenery`): a row is `{ id, kind, variant?, rule, arrival, announce, unlocked(counts), boost? }`.
`unlockedFauna(state, lookup, sceneryId, table)` gives the rows unlocked by that garden's own plants
(`GardenCounts`: plants, pollinator flowers, water plants). `rosterFor(rows)` turns them into
resident counts by kind, visiting kinds in table order, variants per kind (row order) and boosted
kinds (koi-3 boosts `bird`), **skipping rows whose creature module does not exist yet**: never
spawned, never announced. `src/scenery/fauna.ts › faunaTable(id)` gives the tables without loading
the sceneries' painting (the quiet line). A shared creature takes the garden's variant
(`variantOf`): at the waterfall the dragonfly is `aka`, the butterflies `swallowtail`, the birds
`wagtail`, the leaf `maple`, the striders `margin` (they keep within 70 plane units of the pool's
edge). A resident's n-th individual may take the n-th variant (`SpawnContext.index`).

### The waterfall's table
| id | kind (variant) | rule | announced |
|---|---|---|---|
| striders | strider (margin) | always | no |
| dipper | dipper | always | no |
| leaf | leaf (maple) | always | no |
| damselfly | damselfly | 2 plants | yes |
| iwana-1 | iwana (iwana) | 3 plants | yes |
| butterflies | butterfly (swallowtail) | 4 pollinator flowers | yes |
| dragonfly | dragonfly (aka) | 5 plants | yes |
| bees | bee | 6 pollinator flowers | yes |
| wagtail | bird (wagtail) | 6 plants | yes |
| iwana-2 | iwana (yamame) | 7 plants | yes |
| sawagani | sawagani | 8 plants | yes |
| kajika | kajika | 10 plants (no water plant: it sits on stones) | yes |
| iwatsubame | iwatsubame | 14 plants | yes |
| fireflies | firefly | 16 plants, night only (its `visit.nocturnal`) | yes |
| heron | heron | 18 plants | yes |
| yamasemi | yamasemi | 20 plants, rare (its `visit` gaps) | yes |

Not shared: koi, the lily-pad frog, the garden swallows (B0 §4). The Japanese garden's table is
SPEC §4's, verbatim, plus a silent `leaf` row last (the falling leaf used to come with the
striders; last keeps the visit order and so the seeds).

## Layers and depth
| Creature | Layer | Notes |
|---|---|---|
| koi | `underwater` | clipped to the water; crisp/warm near the surface, blurred/cooler deep |
| striders, floating leaf, ripples, heron reflection | `waterSurface` | clipped to the water |
| small birds on a perch, frog, standing heron | `entities` | depth = the supporting rock / stone / ledge / pad base y (+ε) or the heron's feet y |
| dragonfly, butterflies, bees, birds in flight, swallows, heron in flight, falling leaf | `air` | |

Birds on a rock use the rock's base y (+1) rather than their feet y, so they draw in front of the
rock entity they stand on (feet are on its top, which is above its base). On a ledge the depth is
the edge's y (+1).

## Creatures and behaviour
| Kind (Japanese unlock id) | Behaviour |
|---|---|
| `strider` (striders) | resident ×3 (reduced: 1). Rest 1–6 s with tiny twitches, then a rowing burst that glides to a stop (exp. friction), choosing a heading away from the shore and other striders; a faint ring per burst. Moves in the pond plane, contained with a margin. Variant `margin` (the waterfall): starts and keeps near the edge. |
| `leaf` (leaf) | drifter, occasional. See-saws down from above the pond (swing settles before landing), lands with a ring, drifts on a noise current for ~1 min, soaks away. Variants `katsura`, `maple`, `green` (its three tints). |
| `dragonfly` | visitor. Darts in from off-screen (critically damped spring), hovers 1.5–5 s with the faintest drift, darts a short way, sometimes dips to touch the water (ring), leaves. Wings a flickering blur sprite over glassy wings. Variants `shiokara`, `aka`, `ochre`. |
| `koi` (koi-1/2/3) | resident, one per unlock. Wander targets ahead-ish in the pond plane, rate-limited turns, look-ahead shore avoidance, separation from other koi, glides on spread fins; depth drifts slowly and now and then rises near the surface (a "kiss" ring) and sinks. Body = painted strip cut into 9 segments laid along a trail-following spine + a travelling swim wave, flowing caudal fin with lagging sweep, long paddling pectoral fins; composed at full opacity in a scratch canvas, then laid down faded. Varieties by seed: Kohaku, Yamabuki ogon, Sanke, Showa, Asagi. |
| `butterfly` (butterflies) | visitor (cabbage white 65 %, swallowtail; variants `white`, `swallowtail`). Erratic: heading wanders on a noise field around the way to a flower, bobbing lift per downstroke; swallowtails glide between flap bursts. Lands, wings slowly breathe open/closed, visits 2–4 flowers (nearby ones likelier), drifts away. |
| `bee` (bees) | visitor, 1–2 staggered. Zips with a slight weave, hovers in front of a bloom, settles and crawls, short hops to nearby blooms (4–9 visits), leaves. |
| `bird` (small-birds) | visitor, wagtail or sparrow (variants). Bounding flight on a cubic path (flap bursts / folded glides), lands on a free perch (`choosePerch`: wagtails prefer rocks, sparrows stones), then hops along the perch, pecks, turns, stands; wagtails pump the tail; flies off after 16–45 s. |
| `frog` | resident once `frog` unlocks (a water plant and 10 finished plants) **and** a lily pad exists (a water species in a water slot). Sits on the pad, throat pulses with breath, sometimes turns; every 240–700 s (`frogDive`) crouches and hops into open water (big ring), stays under 30–90 s (`frogAway`), climbs back. |
| `swallow` (swallows) | visitor group of 1–3 sweeping one swooping cubic across the sky band, flap bursts and swept glides. Not in reduced motion. |
| `heron` | rare visitor. Slow wingbeats in (the wing foreshortens through edge-on as it beats), glides down to a wading spot (the scenery's stands, or the far edge of the pond clear of boulders, pads and far-bank plants: `heronStands`, cached), stands 1.5–4 min: slow neck drift, craning forward, a rare step; crouches and leaves with slow beats. Faint reflection. |

**Targets.** Flowers: finished plants whose species has `pollinators`, a seeded point in the top
third of the sprite box (slot position + `size` × `scale` + `anchor`). Pads: water species in water
slots. Perches: by default rocks flagged `perch` (top of the rock, a little dome) and every stepping
stone; a scenery may give its own (the waterfall's ledges: flat, `kind: 'ledge'`). Kinds whose
`needs(w)` fails are not scheduled (no bees without pollinator flowers…).

**Mode.** `night` (the shared daylight's night weight ≥ 0.5 — `FaunaSim.nightSource`, ADR 0141; without a
daylight, or with `setHour`, the local hour in `nightHours` [20, 5)): diurnal visitors are not scheduled and
those present leave; koi, striders, frog and leaves stay. Night-only visitors (`visit.nocturnal`,
the fireflies) are refused by day (`'day'`) and leave at daybreak. `lively` (a session running, not
paused): gaps × 0.75. `boost` (kinds boosted by a row: birds at koi-3): gaps × 0.6. `reduced`
(prefers-reduced-motion): gaps × 3, speeds × 0.6, stays × 1.5, one visitor at a time, one strider,
no swallows.

## Pacing table (`tuning.ts › VISITS`, the Japanese garden's creatures)
| Kind | gap (s) | first visit (s) | stay (s) | group | max on screen |
|---|---|---|---|---|---|
| leaf | 120–300 | 20–90 | 50–90 | 1 | 2 (not counted as a visitor) |
| dragonfly | 100–260 | 15–60 | 25–55 | 1 | 1 |
| butterfly | 80–200 | 20–70 | 35–70 | 1–2 | 2 |
| bee | 60–150 | 20–60 | 30–60 | 1–2 | 3 |
| bird | 130–320 (× 0.6 boosted) | 30–90 | 16–45 | 1–2 | 2 |
| swallow | 240–600 | 60–180 | one pass | 1–3 | 3 |
| heron | 900–1800 | 120–400 | 90–220 | 1 | 1 |

`maxVisitors` 3 (counting individuals). A due visit that is blocked (cap, night, day for night-only
kinds) is retried after 8–20 s, not dropped. Sizes (world units at perspective 1): strider 13, bee 7,
butterfly 24 / 30, dragonfly 30, sparrow 19, wagtail 27, frog 17, swallow 26, koi 56–76 (≈ 45–60
after the pond's perspective), heron 150 tall (≈ 95–110 on the far shore). Sizes were tuned against
the painted scene (boulders 60–150 wide).

## Art
Every part is painted once with the paint engine (`paintSprite` → `createPainter`, washes,
wet-in-wet, dabs, ink lines, clipped wet layers for markings) into a small transparent canvas at
`ArtCache.res` device px per world unit (bucketed to quarters, 1.5–6), and
composed per frame with `drawImage` transforms only — no vector shapes. Koi get `deepCopy` twins
(down/up-sampled blur + cool tint) and cross-fade by depth. Flapping is done with frames
(bee/dragonfly blur sprites, bird up/down/fold, swallow spread/up/swept) or by foreshortening a
single wing (butterflies horizontally, heron vertically).

**Close views** (ADR 0188): the resolution follows the camera once it rests — the overview's pixel
scale, or a zoomed resting view's (`faunaResolution`) — so the bee on the flower you look at is as
sharp as the flower. Parts are cached per key and resolution; a part missing at the new resolution
is painted at once only if no other resolution has it, otherwise the softer copy keeps drawing and
the sharp one is painted from idle callbacks, 8 ms at a time (`ArtCache.paintPending`). Two
resolutions are kept (current and previous): a return to the overview repaints nothing. Studio:
**Close view · creatures** (overview parts upscaled | close parts).

## Dev API (`window.sprout.fauna`, ?dev)
`kinds()` (every kind with a module), `spawn(id, count?)` (a kind, or an unlock id of the garden on
view; ignores schedule, cap and night; takes the garden's variant; the frog needs a pad), `list()`
(`{ id, kind, variant, x, y, layer, state, visitor, inPond, edge }`: `inPond` inside the still
water, `edge` the distance to its edge in the pond plane), `clear()`, `step(seconds, dt?)` (advance
the sim without rendering), `setHour(h | null)` (pins an hour over the daylight), `night()`,
`roster()` (`{ scenery, ids, residents, visitors, kinds, variants }`: unlocked row ids, resident
counts by kind, visiting kinds enabled now, every kind the rows bring that has a module),
`schedule()` (seconds until each visit), `pond()` (the still water), `water()` (`{ still, moving,
clip }`), `view()`, `targets()` (flowers, pads, perches, heron stands), `bench(frames?)` (update +
draw ms), `art()` (resolution, parts waiting to be painted sharper, parts painted), `settleArt()`
(paint the waiting parts now, for screenshots).
```js
sprout.fauna.setHour(12); sprout.fauna.spawn('heron'); sprout.fauna.step(25); await sprout.freeze();
```

## Performance
`bench(300)` in headless Chromium (Apple M3), 1440×900 at DPR 2, 17 creatures (3 koi, 3 striders,
dragonfly, 2 butterflies, 3 bees, 2 birds, 3 swallows, heron, leaves): **update 0.01–0.02 ms + draw
0.87–1.18 ms per frame** (placeholder vs painted scene; budget 1.5 ms). Painting parts happens on
first appearance (a few ms per kind). **The budget is for all creatures together:** a new creature
has to fit in what is left, measured with everything its garden can show at once
(`fauna-waterfall › a busy pool…` spawns the waterfall's whole roster; its CI ceiling is 8 ms).

## Adding a creature
A checklist for the art tasks (S12, S13, …), following the drawing-assets loop: write → render →
look → name what is wrong → change → repeat. The unlock row is already in the scenery's table; the
creature appears in the game as soon as its file exists.

**Files to add** (nothing else changes):
1. `src/fauna/creatures/<kind>.ts`, the kind exactly as the table row names it (`dipper`, `iwana`,
   `damselfly`, `sawagani`, `kajika`, `iwatsubame`, `firefly`, `yamasemi`). Helpers shared with
   other creatures go in `creatures/lib/`, never next to them (every `./*.ts` there is a creature).
2. `src/fauna/creatures/<kind>.test.ts` for its pure parts (paths, choices, counts).
3. A devlog, and its lines in this doc (Creatures and behaviour, Layers).

**The def** (`creatures/lib/def.ts`), the file's default export:
```ts
const dipper: CreatureDef = {
  kind: 'dipper', title: 'brown dipper', role: 'resident',   // or 'visitor' / 'drifter'
  resident: (n) => (n > 0 ? 1 : 0),                          // residents: how many to keep
  // visitors and drifters instead: visit: { gap, first, stay, group, max, diurnal, nocturnal?, visitor }
  needs: (w) => w.perches.some((p) => p.kind === 'rock'),    // its targets exist
  spawn: (w, s) => [new Dipper(w, s.variants)],
  sheet: { w: 420, h: 120, make: (res, seed) => [/* painted parts */] },
  show: { stage: 'falls', spec: { w: 300, h: 190 }, w: 570, h: 361, order: 20 },
};
export default dipper;
```
- Behaviour: a class extending `BaseCreature` (`update`, `draw(layer)`, `depth()` on the ground,
  `leave`). Randomness from `w.rng`, noise from `w.noise`, targets from `w.flowers`, `w.perches`,
  `w.pads`, `w.stands()`, `w.pond` (still water) and `w.water.moving` (streams): never coordinates
  of your own.
- Pacing lives in the def's `visit` (or in `tuning.ts` beside the garden's). Rare means long gaps
  (the heron's 900–1800 s). Night-only: `diurnal: false, nocturnal: true`.
- Variants: list them in `variants`, set `this.variant`, and pick with
  `variantOf(s.variants, VARIANTS, rng, fallback)`. Without a variant from the garden keep the
  creature's own pick, so other gardens stay as they are.
- `rank` orders resident upkeep (koi 0, striders 1, frog 2; default 10); `spawnCount` is a hand
  spawn's default.

**Tests.** The pure parts in `<kind>.test.ts`; behaviour over a long simulated run at its scenery
(the pattern in `fauna/waterfall.test.ts`: collect problems, assert once). The registry test and
`fauna-waterfall.spec.ts` pick the creature up by themselves (roster-driven). Add a TESTING matrix
row for new rules.

**Studio and shots.** Its `show` puts it on the `falls` stage (or the pond). Look at
`/Ssprout/studio.html?entry=fauna-<kind>/alive` and `/parts`, and at **Fauna · the falls**:
- `npm run shots -- --entry fauna-<kind>/alive --t 20`, with several `--seed`s side by side;
- in the garden, with `--query scenery=waterfall` and an `--eval` that runs
  `await sprout.showScenery('waterfall'); await sprout.camera.settle(); sprout.setTime('noon');`
  then `sprout.fauna.setHour(12); sprout.fauna.clear(); sprout.fauna.spawn('<kind>');
  sprout.fauna.step(20); sprout.fauna.settleArt()`;
- a close view on it, and night if it is out at night. Line it up against its neighbours (the
  wagtail, the heron) for size and palette.

**Bench.** With the garden's whole roster spawned, one untimed `sprout.fauna.bench(60)`, then a
timed one: **all creatures together under 1.5 ms a frame** on the owner's laptop. Write the number
in the devlog.

**Pitfalls.**
- `faunaSeen` is namespaced outside the Japanese garden (`waterfall:<id>`): use `faunaSeenIn` /
  `faunaSeenKey`, never compare bare ids.
- The water layers are clipped to the still outline and the streams: anything drawn on `underwater`
  or `waterSurface` outside them is invisible. A creature in the foam or on a ledge draws on
  `entities` or `air`.
- Sizes on ledges: pass `x` to `w.perspective(y, x)`. Inside the cliff the scale is the ledge's
  (0.64–0.72), not the ground's at that y (0.55).
- Call `sprout.fauna.settleArt()` before shots (sharper parts are painted in idle time), and
  `sprout.camera.settle()` after switching gardens.
- The waterfall shows only with `?dev&scenery=waterfall`.

## Tests
`math.test.ts`, `schedule.test.ts` (delays, caps, night and night-only, reduced, retries, roster from
rows), `targets.test.ts` (flowers, pads, perches, perch choice, heron stands, perspective),
`sim.test.ts` (long simulated afternoons: residents, pond containment, visitor cap, rarity,
determinism, night, reduced motion), `regression.test.ts` (the Japanese garden's positions and
states for four seeds and modes, hashed before the registry), `creatures/registry.test.ts` (file =
kind, roles), `arrivals.test.ts` (`sightedFauna` by kind and variant, `fauna:arrived` on first sight,
per garden), `waterfall.test.ts` (the foam carve, still water and clip, perches, stands, margin
striders and nothing in the foam over 15 simulated minutes, gorge variants, perspective within
0.02), `art-cache.test.ts`. Tables: `scenery/japanese-garden/fauna.test.ts`,
`scenery/waterfall/fauna.test.ts`. E2E `tests/e2e/fauna.spec.ts` (the garden: striders from the
start, koi with plants, roster and schedule, every creature in bounds, birds land and leave, night
rest, cost) and `tests/e2e/fauna-waterfall.spec.ts` (the waterfall's roster from `roster()`, every
kind spawned and in bounds, nothing on the water in the foam or the stream, striders at the edge,
ledges and wet rocks, stands, cost). Simulation loops run in-page with the renderer frozen.

## Arrivals (ADR 0120, 0248)
Every 0.5 s the system maps the creatures inside `viewport.visible` to the garden's unlocked rows
(`sightedFauna`: each row claims one creature of its kind, and of its variant if it names one, in
table order, so a second koi is `koi-2`; hand-spawned dev/studio creatures and leaving ones are
ignored) and emits `fauna:arrived { id, sceneryId }` once per run for each announceable row with a
creature module that `faunaSeenIn(state, sceneryId, id)` says is new. The UI's quiet line shows that
garden's line (`faunaArrivalLine(sceneryId, id)`) and records it there with
`controller.announceFauna(id, sceneryId)`, so a dragonfly seen in the Japanese garden is still new at
the waterfall, and not again after a reload. Unit tests: `arrivals.test.ts`,
`ui/quiet-line.test.ts`. Audio still raises its bird layer on the Japanese ids only (`small-birds`,
`swallows`; the sound task S15).

## Time of day
Night comes from the shared daylight (`main.ts` passes `daylight`; night weight ≥ 0.5), so
`sprout.setTime` (ambience) moves the fauna's night too. `sprout.fauna.setHour(h)` pins a local hour
over it (`nightHours`); `setHour(null)` gives it back to the daylight.
