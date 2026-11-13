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
foam at the foot, a stream, a ledge and wet rocks. **Fauna · the oasis** (`fauna-oasis/all`) runs
the oasis's table over a crop of its real painting with its real targets, and **Scenery · oasis
wildlife targets** (`oasis-wildlife/targets`) marks every target with a creature of its size.
**Fauna · the coast** (`fauna-coast/all`) and **Scenery · coast wildlife places**
(`coast-wildlife/targets`, `/targets-close`, `/targets-far`) do the same for the coast.

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

### Creatures per garden (ADR 0346)
Each garden's creatures are a lazy chunk: `creatures/sets/creatures-<scenery id>.ts` imports the
kinds of that garden's table that have a module. The registry only knows the sets loaded so far.
- `init` loads the garden on view's set first (without a scenery, the Japanese garden's), then
  applies the garden. Loaded already: synchronous, as before. An init overtaken by a later one is
  dropped. The renderer awaits `init`, so `sprout.ready()` and `showScenery` resolve with the
  creatures there. Until then nothing of that garden spawns or is announced.
- The Gardens section's pre-paint fetches each garden's set with its painting (`prefetchCreatures`
  in `main.ts`). Nothing else prefetches.
- Determinism: the whole set is there before the sim sees the garden. Resident upkeep walks the
  loaded residents by `rank` and kind, and a resident that is not on the roster wants 0, so loading
  another garden's creatures changes nothing (`regression.test.ts` runs with one set, then all).
- The studio (`fauna.studio.ts`) and the unit tests that use the registry await
  `loadAllCreatures()` at top level. Tests that import a creature module directly need nothing.

| File | What |
|---|---|
| `creatures/<kind>.ts` | one creature: art, behaviour and its default-exported `CreatureDef` (kind = file name) |
| `creatures/sets/creatures-<id>.ts` | a garden's creatures, one lazy chunk (ADR 0346) |
| `creatures/registry.ts` | loads the sets (`loadCreatures(id)`, `creaturesLoaded(id)`, `loadAllCreatures()`) and answers from the loaded ones: `creatureDef(kind)`, `creatureDefs()`, `creatureKinds()` |
| `creatures/lib/def.ts` | the contract: `CreatureDef`, `SpawnContext`, `Sheet`, `Show`, `variantOf` |
| `creatures/lib/flight.ts` | shared flying-visitor helpers (entry/exit points off the view, flower choice) |
| `habitat.ts` | `SceneryFauna`: what a scenery tells its wildlife (`Scenery.fauna`) |
| `targets.ts` › regions, carriers | `Region` (`inRegion`, `regionScale`): areas and far stages; `Carrier` (`carried`): moving bodies under perches (ADR 0373) |
| `tuning.ts` | pacing / size / speed constants of the garden's creatures (`VISITS`, `SIZES`, `SPEEDS`, `FAUNA_TUNING`) |
| `schedule.ts` | pure visit scheduling: gaps, first visits, caps, night and night-only, reduced motion; `visitTuning(kind)` |
| `roster.ts` | unlocked rows → resident counts, visiting kinds, variants, boosts (`rosterFor`) |
| `targets.ts` | flower heads, perches (rocks, stones, `ledgePerch`; `slope`, `scale`), `GroundSpot`, `WallFace` (`wallTopAt`, `wallFootAt`), lily pads, heron wading spots, perspective fit |
| `math.ts` | steering (`springStep`, `arrive`, `turnToward`), polygons (`carveEllipse`, `clockwise`, `containPoint`), pond plane, cubic paths, hours |
| `sim.ts` | `FaunaSim`: world (still water, water clip, targets), residents upkeep, visits, ripples, per-layer drawing, entities |
| `system.ts` | render System wrapper: store → that garden's rows and targets, scenery → its `fauna`, session → lively, clock → night; first sightings → `fauna:arrived` (`sightedFauna`, ADR 0120) |
| `sprite.ts` | `paintSprite` (engine-painted parts), `deepCopy` (under-water copy), `ArtCache`, scratch canvas |
| `types.ts` | shared shapes: the creature world (`PondInfo`, `WaterInfo`, targets, art cache, rng, noise); `Creature.drawLights?` is drawn on the `lights` layer (ADR 0280) |
| `stage.ts`, `fauna.studio.ts`, `close-view.studio.ts` | studio stages (`pond`, `falls`, `oasis`, `coast`) and entries (`close-view.studio.ts`: **Close view · creatures**, ADR 0188) |
| `dev.ts` | `window.sprout.fauna` |

## Sceneries (ADR 0248)
Each `Scenery` carries `fauna: SceneryFauna`:

| Field | Japanese garden | Waterfall | Oasis | Coast |
|---|---|---|---|---|
| `unlocks` | `JAPANESE_FAUNA` (`scenery/japanese-garden/fauna.ts`) | `WATERFALL_FAUNA` (`scenery/waterfall/fauna.ts`) | `OASIS_FAUNA` (`scenery/oasis/fauna.ts`) | `COAST_FAUNA` (`scenery/coast/fauna.ts`) |
| `water` | default: `geometry.pond` still, `geometry.streams` moving (none) | the pool still, minus a foam ellipse (84 × 30) at the falls' foot; the stream moving | the basin still; the seguia's runs, the sluice and the oued moving | the sea still; the rock pools as `moving`, so the water layers clip to them |
| `perches` | default: rocks flagged `perch`, every stepping stone | the six ledge edges (`ledgePerch`) and the four wet rocks; no trail stones | wall copings, the basin's rim, palm fronds, a tower top, gate posts, stones (below) | copings, tree limbs, jars, splash rocks, the temple, the caique, far pines, cliff ledges (below) |
| `stands` | default: `heronStands` along the pond's far edge | three on the pool's back edge right of the falls (x 830–940), clear of pads when it can | two on the basin's submerged steps, three in the oued | three in the shallows off the beach |
| `ground`, `walls` | none | none | five damp plots and terrace strips; three terrace wall faces and the basin's near face | terrace walks, the path, the beach, scrub; three wall faces and four splash-rock faces |
| `regions`, `carriers` | none | none | none | shallows, three pools, the bay, the sky over the cove, two barks; the caique |
| `perspective(x, y)` | default: a line fitted through the slots' scales | `perspectiveScale(y)` on the ground; inside the cliff, crown 0.6 under the skyline → the shelf scales 0.64/0.68/0.72 → the foot (within 0.02 of every slot; the fitted line was 7–15 % off) | `oasisPerspective`: terrace lifts (ADR 0300), wall faces at their coping's scale (within 0.02 of every slot, continuous down every column) | `coastPerspective`: on the land the terrace lifts and faces as the oasis's (ADR 0360); the sea, beach and shelf `perspectiveScale(y)`; within 0.02 of every slot but `crack-1` (0.03) |

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

### The oasis (OK0, ADR 0304)
The table (`scenery/oasis/fauna.ts`, data only) and where its creatures live
(`scenery/oasis/wildlife.ts`, studio `oasis-wildlife`).

| id | kind (variant) | rule | announced |
|---|---|---|---|
| striders | strider (margin) | always | no |
| house-bunting | bunting | always | no |
| leaf | leaf (katsura: a pomegranate or fig leaf) | always | no |
| laughing-dove | dove | 2 plants | yes |
| violet-dropwing | dropwing | 3 plants | yes |
| butterflies | butterfly (white) | 4 pollinator flowers | yes |
| sahara-frog | sahara-frog | 5 plants (the basin: no water plant) | yes |
| bees | bee | 6 pollinator flowers | yes |
| swallowtail | butterfly (swallowtail) | 8 pollinator flowers | yes |
| hoopoe | hoopoe | 8 plants | yes |
| gecko | gecko | 10 plants, night only (its `visit.nocturnal`) | yes |
| bee-eater | bee-eater | 14 plants | yes |
| swallows | swallow | 17 plants (moved from 14, the bee-eater's) | yes |
| white-stork | stork | 20 plants, rare (its `visit` gaps) | yes |
| heron | heron | 22 plants, rare | yes |

No plant count brings two creatures. The ids `laughing-dove`, `gecko`, `sahara-frog` and
`swallows` are what the sound bed listens for (`audio/params.ts`, `oasis:<id>`): keep them.

**Targets** (counts as built):
- `w.perches` (42): `wall` ×14 along the high, middle and grove walls' copings, every ~70 units,
  clear of the seguia's falls, the wall slots and the big palms' trunks (y = the coping, a gentle
  `slope`); `rim` ×9: four on the near coping, three on the far coping's sliver, one on each side
  coping (steep `slope` ±1.02, spread 5: they run to the vanishing point), clear of the inlet and
  the gate; `frond` ×11: green front fronds of the big palms (5) and of the grove's near row (6),
  where the rachis runs near level, never inside another big palm's crown, each with its palm's
  ground `scale` (0.64–0.71); `tower` ×1: the middle tower's merlon tops (`NEST`, x 664, y 158),
  `scale` `KSAR_SCALE` 0.15; `post` ×2: the sluice gate's stone posts; `rock` ×5: the stones at
  the basin's near-left corner and on the near ground (`FALLEN_STONES`, `NEAR_STONES`).
- `w.ground` (5): `plot-west`, `plot-mid`, `plot-east` (the near plots' watered sides),
  `terrace-middle`, `terrace-high` (the raised terraces' watered strips). Ellipses: walk inside.
- `w.walls` (4): `wall-high`, `wall-middle`, `wall-grove` (the pisé faces, `WALL_FACES`) and
  `basin-face` (the basin's near face). The ksar's walls are left out: at its scale a gecko is
  about two units long.
- `w.stands()` (5): steps 3 and 4 of the basin's submerged stair (facing left), and the oued
  either side of the sand bar and above it.

**How a creature task uses them.** Filter `w.perches` by kind (the bunting: `wall`, `rim`, `rock`;
the dove: `frond`, `wall`, `rim`; the dropwing: `post`, `rock`; the bee-eater: `frond`; the stork:
`tower`), and stand on `perchY(p, x)` within `p.spread`. Draw at `p.scale ?? w.perspective(p.y,
p.x)` and at `p.depth` on `entities`. Walkers pick a `w.ground` spot and stay inside its ellipse,
at `w.perspective(y, x)` and depth = feet y. The gecko picks a `w.walls` face, clings inside its
`outline` below `wallTopAt(face, x)`, sized by `w.perspective(y, x)` (constant down the face) and
drawn at depth `wallFootAt(face, x)`. The Sahara frog uses `w.pond` (the basin) and the rim.
The oasis (released in O8) shows them in the garden; `stage: 'oasis'` in the def's `show` puts the
creature on the oasis stage, `spec: { x, y, w, h }` choosing the crop (default `OASIS_STAGE`:
x 360, y 120, 880 × 790).

### The coast (GK0, ADR 0373)
The table (`scenery/coast/fauna.ts`, data only) and where its creatures live
(`scenery/coast/wildlife.ts`, studio `coast-wildlife`). The creature set
(`creatures/sets/creatures-coast.ts`) holds the shared kinds with a module: bee, butterfly,
heron, swallow. Each new creature adds its line there.

| id | kind (variant) | rule | announced |
|---|---|---|---|
| island-cat | cat | always | no |
| gull | gull | 1 plant | yes |
| cicada | cicada | 2 plants | yes |
| green-lizard | green-lizard | 3 plants | yes |
| butterflies | butterfly (white) | 4 pollinator flowers | yes |
| rock-crab | rock-crab | 5 plants | yes |
| bees | bee | 6 pollinator flowers | yes |
| swallows | swallow | 7 plants | yes |
| blue-rock-thrush | rock-thrush | 8 plants | yes |
| swallowtail | butterfly (swallowtail) | 8 pollinator flowers | yes |
| goats | goat | 9 plants | yes |
| tortoise | tortoise | 10 plants | yes |
| damselfish | damselfish | 11 plants | yes |
| scops-owl | scops-owl | 12 plants, night only | yes |
| hoopoe | hoopoe | 13 plants (once OK5 exists) | yes |
| gecko | gecko (house) | 14 plants, night only (once OK6 exists; it must offer the `house` variant) | yes |
| octopus | octopus | 16 plants, rare | yes |
| heron | heron | 18 plants, rare | yes |
| dolphins | dolphin | 20 plants, rare | yes |

No plant count brings two creatures. The pollinator rows sit at counts no plant row uses, except
the swallowtail's 8, which is the thrush's: only a garden whose eight plants are all pollinator
flowers gets both at once (the oasis's hoopoe and swallowtail share 8 the same way). Not in the
table: the hummingbird hawk-moth, Scopoli's shearwater, the loggerhead turtle.

**Places** (counts as built; read by name from `layout.ts`, `shapes.ts`, `sea.ts`, `slots.ts`
and `geometry.ts`, never from a painter, and tested against those shapes, so a repaint moves them):
- `w.perches` (54), none within 20 of a slot:
  - `wall` ×26: along `WALL_TOPS` every 70 where the wall stands full height (60 in from its
    seaward end), clear of the flights;
  - `branch` ×6: the olive's fork and its flattest limb stretches (`OLIVE_LIMBS`), the pine's
    branches (`PINE_BRANCHES`), each at its tree's foot scale (the pine's trunk is too steep to
    stand on);
  - `jar` ×2: the pithoi's rims (`JARS`);
  - `rock` ×3: the splash boulders' dry crowns (`SPLASH_ROCK_SHAPES`, its `columns`), the middle or a shoulder clear of
    the slot on it (the first rock has none clear);
  - `ruin` ×4: the architrave's top, the two broken columns' slanted tops, the fallen drum, at
    `TEMPLE_SCALE` 0.13;
  - `boat` ×3: the mast top and two level rail stretches (`CAIQUE_SHAPES`), at `CAIQUE_MEASURE`
    0.09, `carrier: 'caique'`;
  - `crown` ×3: the far pines' crown tops (`PROMONTORY_PINE_SHAPES`) the olive does not hide, at
    `TEMPLE_SCALE`;
  - `ledge` ×7: the goats' ledges across the promontory's face, 45 % down from its top, clear of
    the maquis, the far pines and the olive's crown, at `TEMPLE_SCALE`.
- `w.ground` (24): `walk-{top,middle,lower}-{west,mid,east}` (each terrace's gravel walk between
  the wall above and its beds, either side of the path, the olive and the jar); `path-foreground`,
  `path-lower`, `path-middle` (on the path's middle); `beach-west`, `beach-east` (the shingle);
  `scrub-shore-*` and `scrub-<x>` (under the shoreline's clumps and the phrygana, shrunk onto the
  land).
- `w.walls` (7): `wall-top`, `wall-middle`, `wall-lower` (where they stand full height) for the
  lizard and the gecko; `splash-1…4` (each splash rock's front from its top's edge down to the
  water) for the crab.
- `w.regions` (8):
  - `shallows`: the sea nearer the shore than the turquoise's edge, right of the pine and left of
    the steps, below the caique, down to the foam; the splash rocks and shore boulders are holes;
  - `pool-1…3`: `POOL_WATER` (the rim is the outline);
  - `bay` (a far stage): far out under the far hill, left of the low suns' glitter path, above the
    caique, right of the pine; scale 0.01 → 0.04, the sea plane's (`seaScale`);
  - `sky-cove`: the open sky right of the pine, 14 above the skyline and the architrave;
  - `bark-olive`, `bark-pine`: bands along the trunks, at each tree's scale.
- `w.carriers`: `caique` (pivot `CAIQUE`, the waterline centre). At rest until the motion task
  writes its pose (ADR 0373).
- `w.stands()` (3): in the shallows a few units off the beach's waterline (x 130, 320, 545), 50
  from every water and beach slot, off the splash rocks.

**How a creature task uses them.** Perches by kind, as in the oasis; draw at `p.scale ??
w.perspective(p.y, p.x)`, and on a carrier at `carried({ x, y }, w.carriers[p.carrier])`.
Region dwellers pick a region by kind, stay `inRegion`, and draw at `regionScale(r, y) ??
w.perspective(y, x)`. The cat: `wall` perches, `walk-*` and `path-*`; the gull: `boat`, `rock`,
`sky-cove` and `w.pond`; the cicada: `bark-*`; the lizard and the gecko: the `wall-*` faces; the
crab: the `splash-*` faces and the `pool-*` rims; the thrush: `ruin`, `wall`, `ledge`; the goats:
`ledge`; the tortoise: `scrub-*`, `walk-*`, `path-*`; the damselfish: `shallows`; the owl: `branch`,
`wall`, `crown`; the octopus: `pool-*`, `shallows`; the dolphins: `bay`. `stage: 'coast'` in the
def's `show` puts the creature on the coast stage (default `COAST_STAGE`: x 120, y 220, 960 × 680).

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
- `dipper` (waterfall) on a perch or in the water → `entities` (depth: the perch's, or `max(rock depth, y)` in the water; clipped above the waterline), the part below the waterline and the whole bird when under → `underwater`, in flight → `air` (devlog 77).
- `damselfly` (waterfall) flying and perched → `air`, like the butterflies (devlog 79).
- `iwana` (waterfall) → `underwater` (clipped to the water; the crisp and the deep copy mixed by depth in one scratch, its shadow on the bed under it).
- `sawagani` (waterfall) → `entities` (depth: its stone's base y + 0.5 when out, − 0.5 going to or from its den behind the stone's foot).
- `kajika` (waterfall) on a stone and in a hop between stones → `entities` (depth: the base of the stone it is on or making for + 0.5), a leap into the water or a climb out → `air`, swimming → `waterSurface` (head and eyes) over `underwater` (the body's deep copy), hidden under a stone → nothing.
- `iwatsubame` (waterfall) flying, clinging at its cup and the cups → `air`.
- `firefly` (waterfall) → its light on `lights` (after the light plate, ADR 0280: paper under the night), its body on `air` (only in close views).
- `yamasemi` (waterfall) on its perch → `entities` (depth: the perch's + 1); hovering, plunging, under and emerging → `entities` at the plunge spot's depth (clipped at the surface); in flight → `air`; its plunge rings → `waterSurface`.
- `bunting` (oasis) on a wall coping, the rim or a stone → `entities` (depth: the perch's); in flight, arriving and leaving → `air`.
- `dove` (oasis) on a frond, a wall coping, the rim or a plot → `entities` (depth: the perch's + 0.5, or its feet y + 0.5 on a plot); arriving, between places and leaving → `air`.
- `dropwing` (oasis) on a post, stone, rim or coping → `entities` (depth: the perch's); sallying, chasing, arriving and leaving → `air`.
- `sahara-frog` (oasis) on the coping or a tread → `entities` (depth: the seat's + 0.5; on a tread clipped at the waterline over a faint copy); a plop or a climb → `air`; afloat, surfacing, diving → `waterSurface` (head and sacs) over `underwater` (the hanging body's deep copy); under → `underwater` (a dim gliding shape).

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
| `dipper` (waterfall: dipper) | resident ×1 by day (`resident` 0 at night: it flies off down the stream, back by day; on its perch from the start). Bobs in bursts of dips (legs bend, tail flicks), blinks a white eyelid; every 10–30 s it dives (walks down its rock to the water's edge, wades, sinks, 5–12 s under to 24–70 units on, emerges, floats, flies off), flies low and straight to another perch (rocks 4×, ledges 1×), or (rarely, after 90 s) goes away down the stream for 25–70 s. Only in `w.pond.world` and `w.water.moving`, never in the foam. |
| `damselfly` (waterfall: damselfly) | visitor, 1–2 (a pair: male green, female bronze), diurnal, gap 80–200 s, stay 60–130 s. Flutters slowly and low (6–20 units) over the stream and the pool's margin (`waterPoint`: never the foam, 40 units inside the view), on visible wingbeats with a downstroke bob. Perches on wet rocks and plant heads near the water (`perchSpots`, never ledges) with its wings closed over its back, opening them slowly now and then; after 4–14 s it sallies out over the water and back to the same perch (50 %), moves to another, or patrols. Keeps off perches a bird holds and flies off when one lands beside it. Side view; four wings from one sprite through `wingAxes`. |
| `iwana` (waterfall: iwana-1, iwana-2) | resident, one per row: the char (`iwana`) and then the yamame (`yamame`; `nextVariant` gives the garden's row variant with the fewest fish). Holds a station in the pool's tail (15–50 % up from the outflow toward `scene.falls.foot`, `poolAxis`), nose into the current, sculling, the body clear of the rocks; two fish a body length apart. Every 5–16 s it darts aside 0.3–0.75 body lengths, pauses and drops back facing the current, or (12 % by day) rises to sip with two rings. In the evening rise (20 min after nightfall) 2.4 × as active, 1.4 × at night; stays at night. Only in `w.pond.world`, never in the foam. Seen from above with a blurred shadow on the bed. |
| `sawagani` (waterfall: sawagani) | resident: one by day, two after dark (one in reduced motion); each lives under its own wet stone at the waterline (`crabHomes`: a door in the water or within 12 units of it, in view, 8 units off the foam). Sidles out from behind the stone's foot with stops, forages on the stone's lower face and foot (30–90 s at night, 8–20 s by day, its first outing always long), picks at the moss with one claw at a time, now and then raises the big claw, sidles sideways to another spot, goes back under. Freezes when a heron, kingfisher, dipper or wagtail comes within reach, or when a close view comes to rest (the art resolution rises), then scuttles home if the bird stays. Never in the foam. Front view; red-brown, or a rare blue-grey morph (`blue`). |
| `kajika` (waterfall: kajika) | resident ×1, day and night (on its stone from the start). Sits flat on wet stones in and by the water (`kajikaSeats`: the rock perches and the boulders with their foot in or by the water, never ledges). Sings in bouts of 6–12 notes that quicken into a trill: the head lifts on straight arms and a pale throat bubble swells with each note. Bouts every 3–9 s in the 20 min after nightfall, 7–22 s at night, 30–100 s by day, and soon after it settles on a stone. Every 45–130 s at night (80–220 s by day) it hops to a stone within 64 units, or leaps in at the stone's foot with a splash ring, swims head-up on the water and climbs out on another; by day it sometimes hides under a stone for 40–110 s. Freezes (no song) when a dipper, wagtail, heron or yamasemi comes near, dives and hides when one comes close. Keeps 22 units off other creatures' `spot()`/`perchPoint()` and gives its own `spot()`. Only in `w.pond.world` and `w.water.moving`, never in the foam. |
| `iwatsubame` (waterfall: iwatsubame) | drifter by day (scheduled, not counted against the visitor cap), a loose flock of 3–7 (2–3 in reduced motion), gap 110–280 s, stay 70–150 s. Swirls in arcs along the cliff face (`cliffFace`: the ledges and the falls, inside the view) round a slowly drifting centre and down through the falls' spray, with now and then a tight loop; every 6–20 s one darts up under a ledge to its mud cup (`nestSites`: 1–3 cups under most ledges), clings 0.7–2.6 s and drops away (at most two at the cups). Rolls edge-on in hard turns and comes out showing its dark back and white rump (70 %) or its pale underside. Leaves one by one at the end of its stay, and by itself at nightfall, up over the skyline. Plan view; wings and body apart so a beat foreshortens only the wings. |
| `firefly` (waterfall: fireflies) | night-only drifter (not counted as a visitor), one swarm a night of 9–16 lights (5–8 reduced), one creature. The lights come on one by one, drift slowly (4–9 u/s) and low (5–20 units) over the stream and within 60 units of the pool's edge, never over the foam, and land on the bank grass, low on plants by the water and on the wet rocks' moss (never ledges or the cliff). Each flashes on the eastern Genji's slow ~4 s rhythm (swell, fade, dark) and a Kuramoto pull brings them into step (order about 0.8). Resting ones glow faintly between flashes. At daybreak or when the stay ends they go dark one by one. Reduced motion: slower and gentler, never dark. A light is a paper-white core in a graded yellow-green bloom on the `lights` layer; the body (black, red-orange pronotum) shows only close. |
| `yamasemi` (waterfall: yamasemi) | rare visitor by day (gap 1100–2200 s, stay 150–300 s, one at a time; leaves at nightfall). Comes in fast and low up the stream from off the view and swoops up onto a high rock over the still water (`yamasemiPerches`: rocks with their foot by the pool, shelves overhanging it 120 units or more from the falls; high ones likelier, the falls-foot rock in the spray less; free and in-view ones first, else it shares the roomiest boulder at its far end). Faces the pool, raises and lowers its shaggy crest, bobs its head in bouts, peers before a hunt; every 9–26 s it hovers 46–72 units over a spot in the still water (16 in from the edge, never the foam, never on a boulder; `plungeSpot`), plunges bill first with a splash and big rings, comes up (45 % with a small fish it beats and swallows on the perch) and goes back. Leaves fast and low down the stream. Side view; sumi bars on reserved white. |
| `bunting` (oasis: house-bunting) | resident pair by day (a cock and a duller hen; 0 at night: each finishes its act and flies off the view, and they fly back in the morning). Perches on the wall copings, the basin rim and the stones (`buntingPerches`: `wall`, `rim`, `rock`), a free one 40 units inside the view first, near ones likelier (`choosePerch`); never one another creature holds (`heldSpots` within its spread + 12). On a perch: hops 3–8 units, pecks 1–4 seeds with quick head-bobs, drinks at the long rim stretches (1–3 sips, a lean down and the bill lifted), looks, turns, flicks its tail; every 7–20 s a short dip to another perch, bounding (bursts of beats, shut-winged glides). Side view; cinnamon body, grey streaked hood, plain rufous wings, no bib or bars. |
| `dove` (oasis: laughing-dove) | visitor by day, alone or a pair (group 1–2, gap 150–340 s, stay 90–170 s; leaves at nightfall). Settles on palm fronds (at the palm's `scale`), wall copings, the near and far basin rim to drink (`drinkPerches`), or a `w.ground` plot (`choosePlace`, weighted by kind, in view first), never within 30 units of a spot another creature holds (`heldSpots`); gives its own `spot()`. A pair comes in from one side and lands side by side; the leader moves on every 10–24 s and the mate follows. On a perch: rests, looks, shuffles, bows and coos in bouts (the mate bows back); on a plot: the nodding walk and pecks; at the rim: stands on the coping's water edge and holds its head down in the water 3–6.5 s (rings at the bill). Takes off with a clatter (deep quick beats, steep climb), flies in bursts and bowed-wing glides, lands with a flutter, tail fanned. Side view; pinkish-buff head, chequered cinnamon neck patch, blue-grey wing panel, rufous back, white-cornered tail. |
| `dropwing` (oasis: violet-dropwing) | visitor by day (gap 90–220 s, stay 90–200 s; 78 % a male, else a duller female; a second visitor is a rival male 6–30 s later). Perches on the sluice-gate posts, the stones, the basin rim and the wall copings within 60 units of water (`dropwingPerches`: `post` 3, `rock` 2, `rim` 1, `wall` 0.7, near ones likelier, a free one 30 units inside the view first; never one another creature holds), still, wings drooped forward and down; a third of its perch spells in the obelisk (abdomen raised 0.75–1.25 rad). Every 3–11 s it sallies: 1–3 fast darts over the basin or a channel within 18–85 units with a short pause at each, then back to the same perch (68 %) or one within 200 units. A male chases a rival male within 110 units of its perch for 2.2–4.5 s; the rival takes a perch well away or leaves. Side view; magenta body with a bluish bloom, red-violet eyes, clear wings with red veins and amber bases. |
| `sahara-frog` (oasis: sahara-frog) | resident: 1 by day, 3 after dark (2 in reduced motion); `needs` only still water. Seats (`frogSeats`, cached): the level near and far rim perches at the water's edge, and the heron's stands inside the basin (the submerged treads, where it sits half under); float spots (`floatSpot`) inside the basin 7 units in, off the stair, near the lilies' pads, in view first; keeps 22 units off other frogs and held spots, gives its `spot()` while seated. Basks 45–120 s by day (15–45 s at night), floats 20–50 s (30–80 s), then by day mostly paddles to a seat and climbs out, after dark mostly stays afloat; plops in at the end of a spell or when a bird comes near (`FROG_THREATS`), swims under 3–9 s and surfaces elsewhere with a ring. After dark it calls in bouts of 4–9 croaks (both sacs swelling), every 3–9 s in the first 40 min after nightfall, 9–26 s later; the others answer. Side view; green or olive-brown, dark blotches, pale ridges and green back line, gold eye. |

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
`kinds()` (the loaded kinds: the gardens shown or pre-painted so far), `loadAll()` (every garden's
creatures, to spawn one outside its garden), `spawn(id, count?)` (a kind, or an unlock id of the garden on
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
**`needs(w)` runs every frame for every resident, in every garden** (resident upkeep), so keep it
cheap or cached: the kajika's (`kajikaHasSeats`) caches its seat search until the scene or the view
changes; it cost the oasis ~27 ms/s before (devlog 142). Prefer `distanceToPolygon` over
`closestOnPolygon(...).d`: it allocates nothing.

## Adding a creature
A checklist for the art tasks (S12, S13, …), following the drawing-assets loop: write → render →
look → name what is wrong → change → repeat. The unlock row is already in the scenery's table; the
creature appears in the game once its file exists and its gardens' sets list it.

**Files to add** (and one line per garden):
1. `src/fauna/creatures/<kind>.ts`, the kind exactly as the table row names it (`dipper`, `iwana`,
   `damselfly`, `sawagani`, `kajika`, `iwatsubame`, `firefly`, `yamasemi`). Helpers shared with
   other creatures go in `creatures/lib/`, never next to them (every `./*.ts` there is a creature).
   Add it to `creatures/sets/creatures-<id>.ts` of every garden whose table names it; the registry
   test fails until you do (ADR 0346).
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

**Studio and shots.** Its `show` puts it on the `falls` stage, the `oasis` stage (a crop of the
oasis's painting, `spec.x`/`spec.y` its corner) or the pond. Look at
`/Ssprout/studio.html?entry=fauna-<kind>/alive` and `/parts`, and at **Fauna · the falls**:
- `npm run shots -- --entry fauna-<kind>/alive --t 20`, with several `--seed`s side by side;
- in the garden, with an `--eval` that runs
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

## Tests
`math.test.ts`, `schedule.test.ts` (delays, caps, night and night-only, reduced, retries, roster from
rows), `targets.test.ts` (flowers, pads, perches, perch choice, heron stands, perspective),
`sim.test.ts` (long simulated afternoons: residents, pond containment, visitor cap, rarity,
determinism, night, reduced motion), `regression.test.ts` (the Japanese garden's positions and
states for four seeds and modes, hashed before the registry; with only its set loaded, then with
all), `creatures/registry.test.ts` (file = kind, roles, each set = its table's kinds with a module,
loading), `lazy-creatures.test.ts` (the system waits for its garden's set; an overtaken init is
dropped), `arrivals.test.ts` (`sightedFauna` by kind and variant, `fauna:arrived` on first sight,
per garden), `waterfall.test.ts` (the foam carve, still water and clip, perches, stands, margin
striders and nothing in the foam over 15 simulated minutes, gorge variants, perspective within
0.02), `art-cache.test.ts`. Tables: `scenery/japanese-garden/fauna.test.ts`,
`scenery/waterfall/fauna.test.ts`, `scenery/oasis/fauna.test.ts`, `scenery/coast/fauna.test.ts`;
the oasis's targets and perspective: `scenery/oasis/wildlife.test.ts`; the coast's places:
`scenery/coast/wildlife.test.ts`. E2E `tests/e2e/fauna.spec.ts` (the garden: striders from the
start, koi with plants, roster and schedule, every creature in bounds, birds land and leave, night
rest, cost) and `tests/e2e/fauna-waterfall.spec.ts` (the waterfall's roster from `roster()`, every
kind spawned and in bounds, nothing on the water in the foam or the stream, striders at the edge,
ledges and wet rocks, stands, cost), and `tests/e2e/lazy-creatures.spec.ts` (a Japanese garden
visit asks only for its own creature chunk; the oasis's comes with the switch, the others with the
pre-paint). Simulation loops run in-page with the renderer frozen.

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
