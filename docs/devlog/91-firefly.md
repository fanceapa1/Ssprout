# 91 · Genji firefly (C7)

## What
The waterfall's night signature, the **Genji firefly** (ゲンジボタル, *Nipponoluciola cruciata*),
row `fireflies` of `WATERFALL_FAUNA` (16 plants, night only, announced). New files:
- `src/fauna/creatures/firefly.ts`: the art (`paintFirefly`), the rhythm (`flash`, `orderOf`,
  `syncStep`), where it flies and rests (`nearFoam`, `overFlightWater`, `flightPoint`, `restSpots`,
  `chooseRest`), the swarm (`Firefly`) and the default-exported `CreatureDef` (kind `firefly`, role
  `drifter`, a parts `sheet`, `show` on the `falls` stage).
- `src/fauna/creatures/firefly.test.ts`: 11 tests.
- `src/fauna/creatures/firefly.studio.ts`: **Fauna · Genji fireflies at night** (`fauna-firefly-night`):
  the swarm alive on the falls stage at night, and the light through a flash on a night pool with the
  body close up.
- `docs/adr/0280-lights-layer.md` (proposed).

**One contract change, in its own commit** (`feat(render): a lights layer…`, ADR 0280): a frame
layer `lights` between `lighting` and `paper`, an optional `Creature.drawLights(ctx, w)` that the
sim calls for it, `FaunaSystem` drawing it, and `Stage.render(…, light?)` taking a stand-in for the
light plate. Shared files touched: `src/render/types.ts`, `src/render/renderer.test.ts` (layer
order), `src/fauna/{types,sim,system,stage}.ts`. No `main.ts` change. `src/render` is a paint root,
so the paint version changes once.

Why: everything a creature draws is under the light plate, which at night desaturates the frame and
multiplies it by indigo (about 0.6 / 0.65 / 0.83). A multiply only darkens, so the brightest a
creature can be at night is the plate. Round 1 (light on `air`) showed exactly that: the lights were
dull khaki blots on the pool that read as floating leaves, and over the near meadow (bare paper)
nothing. Drawn after the plate, a pale dab ends as washi when the paper multiplies: reserved paper,
as the art direction asks, with no glow filter or additive blend. If the orchestrator drops the
commit, the light has to move back into `draw('air')` (the ADR says how) and it reads only as a
pale fleck over the water.

## How it is painted
- **Light** (`drawLights`, after the light plate): a pale core, `#fbfae4` at full opacity
  with no rim or darkening (1.9 × 1.7 units), so it is paper white once the paper multiplies. Around
  it, a bloom in six thin source-over glazes. The outer ones are `#b8c06a` and `#d8d97a`, the inner
  ones `#eef0b4`. Opacity rises from 0.1 at r 10.5 to 0.32 at r 2.2, so the bleed grades out with no
  step. Only the outermost glaze has a faint dried rim, where the wet bleed stopped. Three seeded
  halo shapes, each turned at random per light.
- **Breathing**: the halo's alpha follows the flash and it spreads a little as the light swells
  (scale 0.95 → 1.3). The core's alpha leads it. In the overview the halo is scaled up to 1.5×
  (`4.5 / art.res`), because a brush can't paint a bloom smaller than its tip. Two `drawImage`
  calls per lit light, from one cached sprite set.
- **Body** (`draw('air')`, under the plate): black wing cases, a red-orange pronotum `#c9603e` and a
  pale lantern at the tail, 6 units long. It shows only in a close view (`art.res` from 4.5 to 6).
  At night it is a dark speck, as it should be.

## Behaviour
- **One swarm a night**: role `drifter` with `visit: { gap 300–900, first 20–80, stay 1500–3000,
  group 1, max 1, diurnal: false, nocturnal: true, visitor: false }`. It is not counted against the
  visitor cap, so it never blocks the other night creatures. The schedule refuses it by day. At
  daybreak (or when its stay ends) the lights go dark one by one over 0–35 s: a resting light fades
  where it sits, a flying one drifts up as it fades. A hand-spawned swarm (dev, studio, e2e at noon)
  stays by day.
- **9–16 lights** (5–8 in reduced motion) in one creature. The creature's `x, y` is their centroid.
  Half start resting on the bank. They come on over 0–25 s after the swarm arrives; a swarm there
  from the start is already lit.
- **Flight** (`flightPoint`, `overFlightWater`): slow (4–9 units/s), low (5–20 units over the
  water, with a slow bob), meandering on noise toward points over the stream or within 60 units
  of the still pool's edge. The foam is kept clear by an ellipse (92 × 36) round `scene.falls.foot`
  and by the water clip's foam. A light over the water that would leave it turns back. Every
  14–45 s it lands.
- **Rest** (`restSpots`, `chooseRest`): bank grass every 38 units along the water, 7 units out (none
  on the cliff foot behind the pool or near the foam), low on the plants within 90 units of the
  water (never more than 20 units up), and low on the wet moss of the rock perches. Never ledges,
  never above the pool's back edge. Near spots are likelier, rock less likely, never one another
  light holds. It stays 8–30 s.
- **Rhythm** (`flash`, `syncStep`): the eastern Genji's slow flash. The period is 3.7–4.4 s per
  light: the gorge is the central and northern Honshū beech zone, east of the Fossa Magna, where
  the flash is about 4 s (the western one is about 2 s). The light swells over 22 % of the cycle,
  fades over 42 % and is dark for the rest. A Kuramoto pull (0.45 rad/s at full order) and a little
  phase wander (0.18) bring the swarm into step within a minute, but never perfectly: order about
  0.8. Between flashes a flying light keeps 6 % and a resting one 12 % (they glow on the leaf).
- **Reduced motion**: drift, timers and rhythm run at `w.speed` (0.6). The pulse breathes gently
  between 0.4 and 0.8 and never goes dark.
- **Sizes**: `w.perspective(g.y, g.x)` at the ground point under each light. **Randomness**: each
  swarm draws from its own `w.rng.fork('firefly:…')`, so other creatures' streams don't shift
  (tested).

## Looked at
Probe shots from `firefly/probe.mjs` (Playwright against my own dev server on 5416, under
`nice -n 15`; jobs in `firefly/jobs-*.json`, `firefly/run.py`). Copies are in `artifacts/shots/firefly-*.png`:
- r1 (`firefly-r1-air-crop.png`): the light on `air`, under the night plate. Two dull khaki blots
  on the pool read as floating leaves, and nothing showed over the meadow. Hence the `lights` layer.
- r3 (`firefly-r3-zoom.png`): after the plate the lights read as lights. Zoomed in, the halo was one
  opaque lumpy blob with a hard edge (lichen, popcorn) and the core a tiny dot. At garden size they
  read as lemon stickers. → Three graded glazes, then (r7) six.
- Studio r1 (`firefly-s1-alive-t31.png`): at t 31 the night stage reads as fireflies over a night pool.
  Two lights sat on the cliff face and on the foam edge (bank and plant spots above the pool's back
  edge) → nothing above the pool's back edge.
- r5–r6: half the stills showed the whole swarm dark. They were too tightly in step (order about
  0.95) with a short lit part → coupling 0.7 → 0.45, more wander, a longer swell and fade, a faint
  glow between flashes. Close (`firefly-r6-close-zoom.png`): the halo was still stepped rings, like a
  fried egg → six thin glazes.
- r7 overview (`firefly-r7-overview-sheet.png`, four frames 1 s apart): about ten soft lights over
  the pool margin and the stream, lit together, fading together, then dark.
- s2 (`firefly-s3-parts.png` before/after the fix): the core was **darker than the paper**
  (196,190,160 on 245,237,215). The wash's default 2.5-unit rim covered the whole small core and
  darkened it → no rim and no darkening on the core and the glazes. Now 238,231,193 on the sheet and
  233,228,190 at night (`firefly-s3-lights.png`): the brightest thing in the night scene, warm paper.
- Final, r9 overview (`firefly-r9-overview-sheet.png`, 1440×900 at DPR 2, four frames 1 s apart):
  about 15 soft yellow-green lights over the pool, on the outflow rock, on the bank and a plant,
  breathing on and off together. Close view, zoom 3 (`firefly-r9-close-sheet.png`): blooms on the
  skunk cabbage, in the grass by the stream and on the stone, a pale centre in each. Phone 390×844
  (`firefly-r8-phone-sheet.png`): about ten points of light over the pool on the lit frame. Day
  studio stage against night (`firefly-s2-day-night-stage.png`): by day the light is a faint yellow
  smudge, as it should be.

What reads well: at night, soft paper-white lights with a yellow-green bleed drift low over the
dark water and the bank, swell and fade together, and the swarm goes dark as one. They are not UI
dots or bokeh: the shapes are irregular, graded and seeded, they are small, and they sit in the
painting's tones.

## Bench
`sprout.fauna.bench(300)` at the waterfall at night (`setTime('night')`, `setHour(22)`), 1440×900,
DPR 2, headless Chromium, 25 plants. The whole roster was spawned (13 kinds: strider, dipper, leaf,
damselfly, iwana, butterfly, dragonfly, bee, bird, sawagani, kajika, firefly, heron; 21
creatures), `step(40)`, art settled, one untimed `bench(60)` first. Bench draws every layer,
`lights` included. Timed runs with the swarm: **1.07–1.31 ms a frame** (update 0.06–0.07 ms). The
same without the firefly: **0.95–1.03 ms**. So the swarm of about 12 lights costs about 0.05–0.3 ms
(load-noisy), under the 1.5 ms budget.

## Status
- `npm run typecheck`: clean.
- `VITEST_WORKERS=1 npx vitest run src/fauna src/scenery/waterfall src/render`: 24 files, 274 tests
  pass (firefly: 11). The paint-version and studio tests pass too.
- No local e2e (CI runs it). `fauna-waterfall.spec.ts` picks the firefly up from the roster: it is
  spawned by hand at noon and stays (forced), and its centroid stays in view.
- Scratch files (probe, jobs, crops) are in the untracked `firefly/` folder.

## Rows for the orchestrator
fauna.md › Creatures and behaviour:

| Kind (unlock id) | Behaviour |
|---|---|
| `firefly` (waterfall: fireflies) | night-only drifter (not counted as a visitor), one swarm a night of 9–16 lights (5–8 reduced), one creature. The lights come on one by one, drift slowly (4–9 u/s) and low (5–20 units) over the stream and within 60 units of the pool's edge, never over the foam, and land on the bank grass, low on plants by the water and on the wet rocks' moss (never ledges or the cliff). Each flashes on the eastern Genji's slow ~4 s rhythm (swell, fade, dark) and a Kuramoto pull brings them into step (order about 0.8). Resting ones glow faintly between flashes. At daybreak or when the stay ends they go dark one by one. Reduced motion: slower and gentler, never dark. A light is a paper-white core in a graded yellow-green bloom on the `lights` layer; the body (black, red-orange pronotum) shows only close. |

fauna.md › Layers: `firefly` (waterfall) → its light on `lights` (after the light plate, ADR 0280:
paper under the night), its body on `air` (only in close views).

fauna.md › File table, beside `types.ts`: `Creature.drawLights?` is drawn on the `lights` layer.

ARCHITECTURE.md › the layer table, a row after `lighting` (ADR 0280):
`| 7 | lights | living lights left as paper over the night (the fireflies' `Creature.drawLights`); nothing large, no glow fills | per frame |`
(and renumber `paper`).

ADR index (`docs/adr/README.md`):
`| [0280](0280-lights-layer.md) | Living lights draw after the light plate | proposed | A `lights` frame layer between `lighting` and `paper`; `Creature.drawLights?` opts in (the sim calls only that); `Stage.render(…, light?)` for night stages; the paint version changes once |`

TESTING matrix:

| C7.1 | The Genji firefly: night only (refused by day, comes after dark, not a counted visitor); 5–20 lights that drift slowly and low over the stream and the pool's margin, never over the foam, and rest on the bank, plants and wet rocks (never the cliff, in view); a flash that swells, fades and goes dark once a cycle; phases pulled into step but never into one; over ten minutes they fly, rest, flash and go dark; go dark one by one at daybreak; a hand-spawned swarm stays by day; deterministic, from its own stream; fewer, slower and gently breathing (never dark) in reduced motion; lives on the studio's falls stage | fauna/creatures/firefly (all) | fauna-waterfall › every creature on the roster can be spawned…; › a busy pool renders cleanly and stays cheap (roster-driven) | ✔ |

Devlog index line: `| 91 | [C7: Genji firefly](91-firefly.md) | Soft paper-white lights in a yellow-green bloom drift over the stream at night and breathe in step; a lights layer after the light plate (ADR 0280) |`

## Left open
- **ADR 0280 is a contract change outside the owned path.** It is in its own commit for the
  orchestrator to accept or drop (the ARCHITECTURE row and ADR index line are above).
- **Synchrony makes stills hit or miss**: for about a third of each 4 s cycle the whole swarm is
  dark. That is true to Genji, but a screenshot can catch nothing. Shoot several frames
  (`sprout.fauna.step(1)` between them).
- **The halo's rings** still show faintly when zoomed far in (six glazes, slightly offset). At
  garden size and zoom 3 they read as a soft bleed.
- **Overview**: the bloom is mostly lost at overview size; a light reads as a soft point with a
  faint halo. On the phone the lights are small points over the pool.
- **No reflection on the water**: a faint second light mirrored on `waterSurface` would be lovely
  over the pool, but it would sit under the light plate (khaki), so it is left out.
- **Season**: the research brief says fireflies are an early-summer event. The app has no seasons,
  so they come every night.
- **Body**: a tiny tadpole-like speck close up. The pronotum's black cross (*cruciata*) is not
  painted.
- **No dusk signal** (as for the iwana and kajika): they come with `mode.night`, not "after dusk"
  as such.
- Sound: none (S15).
