# 210 · Common octopus (GK12, phase 15)

## What
The coast's rare water sight: the common octopus (*Octopus vulgaris*), kind `octopus`, the `octopus`
row from GK0 (16 plants, rare, announced: "An octopus ripples across the rock pool.").

- **Module** `src/fauna/creatures/octopus.ts`, its line in `creatures/sets/creatures-coast.ts` (the
  only shared code file touched: one import and one array entry). No contract change; the `pool-*`
  regions and `w.pads` were there. `src/scenery/coast/fauna.ts` is untouched (its row was waiting).
- **Rare:** a drifter by day, gap 1300–2600 s, first visit 500–1300 s, a visit 100–170 s, one at a
  time (its spawn refuses a second, so `sprout.fauna.spawn('octopus', 1)` twice brings one). With the
  session's livelier gaps that is a visit in some sessions, not every one: over six simulated hours of
  day eight to sixteen visits. None at night: the scheduler sends no diurnal kind after dark, and one
  out at nightfall goes home.
- **Where:** the three rock pools only (`poolsOf`: each `pool-*` region as its ellipse). Its visible
  water is the rim's inner edge (`RIM`: 2.6 units in across, 1.8 down; the painted rim reaches 2.2
  over the water), and the drawing clips to it, so an arm or the body past it is under the rock. A
  pool in view first, the bigger likelier, and a pool without a water plant (a `w.pads` point inside
  it) first: the pools are planting slots, and a plant in one hides it. Its sitting spots keep its
  curled arms inside the water and 30 units off a crab out on the rim and off a water plant.
  **Not the shallows:** the `shallows` region's splash rocks are holes in the region but not in the
  water layers' clip, so an octopus drawn there on `underwater` would lie over the painted rocks; a
  stony-edge place would need a new region, a contract change, so it was not done.
- **A visit:** it comes out of its den under the far rim (a point past the rim's edge at an angle
  1.2π–1.8π, the far rim's shade), fading in as it crosses the edge, and crawls to a spot. It sits
  camouflaged 10–24 s (16–30 s the first time): stone-grey mottled, papillae up, the arms curled
  round it with their tips coiled, one arm's coil slowly curling and uncurling, the mantle breathing,
  the gold eyes with their slits looking about. Then it crawls (half the time) to another spot 0.6 of
  the pool's half-width or more away: 9 plan units a second, easing in and out, turning as it goes,
  the first pair of arms feeling ahead and the rest streaming behind on a travelling wave, the skin
  smooth and sandy, often (60 %) with a red-brown flush on the way. Or it feels into a crack (35 %,
  when the rim is within 1.55 arm lengths): the arm nearest the rim reaches out to the rim's edge and
  past it, its tip curling this way and that for 3.5–7 s, sometimes (40 %) with a flush, then draws
  back. At the end of its stay it crawls home and pours in, squeezing narrower as it goes.
- **Fright:** a cat (110), heron (170), gull (100) or goat (100) within reach, standing or flying
  over, makes it pale and flat at once (its colour eases at 5/s instead of 1.4, the arms go straight
  out, the mantle spreads). If the threat is still there after 1.1–2.4 s it pours into its den and the
  visit is over; if it has gone, it settles back into stone. The heron's stands are 140–170 from the
  pools, so a heron wading by the beach ends a visit.
- **The rock crab:** it already froze for an octopus within 45 (devlog 203: `octopus: 45` in its
  threats), and its pool rims are outside the water, so nothing was added there. The octopus keeps its
  spots off a crab that is out, so they are never drawn over each other; reaching into the rim near a
  crab sends the crab off round its rock.
- **Paint** (`paintOctopus`, one `ArtCache` entry, painted at 1.25 × the cache's resolution): every
  part in values, a light body with dark pooled edges, so one tint recolours it: two arm stamps (a
  tapered dab with pigment settled along both flanks and feathered ends) and a third with a row of
  pale suckers, the web joining the arms' roots, the head with the eye bumps and the brow, the mantle
  (a bag fuller toward its end, darker there, a neck fold and two wrinkles), the eye (a gold iris, a
  dark horizontal slit, a glint, a dark lid round it), a wet sheen, the camouflage pattern over the
  whole plan (pale blotches, rows of white spots down the mantle, a dark net, darker patches, and the
  papillae's pale points with dark feet), and a soft shadow.
- **Compose** (`composeOctopus`): seen from above in its own canvas. Each arm is a curve
  (`armPoints`: 11 steps from a ring round the head, finer toward the tip, each turning by the arm's
  bend, a coil growing toward the tip, and a wave that is integrated so the arm stays smooth) laid as
  a chain of stamps, back pairs first; a coiled tip turns its suckers up on the inside. Then the web,
  head and mantle; the skin's tint over all of it (`source-atop`) and the pattern at the skin's
  strength; the sheen, the eyes, and the pool's cool tint. The four skins (`SKINS`: stone, sand,
  flush, pale) blend by weight (`skinOf`), so the change is one smooth blend of tint, strength and
  pattern. The fills keep to the box the arms painted.
- **In the pool** (`placeOctopus`): the picture is laid in the pool's plane at `SQUASH` 0.46 (rounder
  than the pool's own 0.29, so it reads as an octopus and not a smear), at 0.9 opacity on
  `underwater`: under the scene's water layer, the pool's rings and the light plates, so the phase
  tints it. Its shadow shows only while it crawls (lifted off the floor). `OCTOPUS_K` 1.2: about 30
  units across sitting, a third of the middle pool's width; at the overview a small grey shape.
- **Studio** `fauna-octopus-close` (`octopus.studio.ts`): `close` (sitting camouflaged and crawling,
  11 px a plan unit), `poses` (camouflaged, crawling, the flush, pale and flat, an arm in a crack),
  `colour` (stone → sand → flush → sand → stone → pale, nine steps), and the live behaviour on crops of
  the middle and the small pool. The def's `sheet` and `show` give `fauna-octopus/alive` and `/parts`.

## Why
- **A drifter, not a visitor,** as the dolphins: a visit would otherwise take a visitor place from the
  bees and butterflies or wait behind them.
- **Values tinted when composed** instead of a sprite set per colour: four skins blended smoothly
  would mean four times the stamps in a change; one tint fill and one pattern draw do it.
- **The pattern is fixed to the body's plan, not to each arm.** The arms slide under it as they move;
  it is strong only while it sits still (stone) and faint while it crawls (sand), which is what a real
  octopus does with its camouflage.
- **Composed ten times a second sitting, thirty moving, at most 6 px a plan unit.** Composed every
  frame at full resolution it cost 3.4 ms a frame in the close view (the bench's readback makes the
  fills dear). Sitting still nothing moves faster than the idle arm's slow coil.
- **No ADR:** nothing here binds other code.

## Looked at
`artifacts/gk12/`: studio `close` rounds r1–r5 and the garden at noon (close on each pool, sitting
and crawling), sunset and a phone.
1. r1: the arms were thin and long, a brittle star; the body small; the shadow a big blob. Arms
   thicker at the root (3.1), a web between them, a bigger head and mantle, a small shadow.
2. r2–r3: the camouflaged pose read as an octopus; the crawl was a spider (arms out sideways), with
   light and dark bands at each stamp. Trailing arms swept back (135°–167°), stamps overlapping more
   with softer ends, bigger eyes with a dark lid (they are what a viewer finds first).
3. r4–r5: the wave was added to the direction at each step, which kinked the arms; integrated as a
   curvature it bends them smoothly. Hairy stamp edges tightened.
4. In the garden: a water plant in the middle pool hid the pool, so the pools with a plant come last.
   The sitting octopus in the small pool reads at the close view and on a phone; at the overview it is a
   small grey shape in the pool, as asked.

## Bench
Production build, headless Chromium, 1440 × 900 at DPR 2, the coast at noon with 25 plants, the
fauna cleared, then 2 butterflies, 2 gulls and a tortoise spawned (with the resident cat, lizard and
crab), with or without the octopus, 12 s stepped; `bench(60)` untimed, then `bench(120)` three times
(load 2.6–3.3, the other agent running). Each pair on fresh pages with the same spawns:
- overview, without: **0.38 / 0.35 / 0.36 ms** (8 creatures); with it sitting **0.50 / 0.46 /
  0.47 ms**; with it crawling (stepped until it moves, `bench(90)`) **0.69 / 0.63 / 0.63 ms**;
- close view on its pool (zoom 3), without: **0.46 / 0.41 / 0.37 ms**; with it sitting **2.04 /
  0.99 / 1.00 ms**; crawling **2.67 / 1.06 / 1.07 ms** (12 creatures by then). The first reading
  of each close run is a spike I could not pin down (it did not repeat within the run).
- Before its own picture was cached and capped, composed every frame at full resolution, the close
  view cost **3.4–3.7 ms**: the bench reads a pixel each frame, and the picture's fills and the
  stamps' raster are paid when it is laid on the bench's canvas. Keeping the fills to the painted box
  brought it to 1.7, composing ten times a second sitting (thirty moving) and at most 6 px a plan
  unit to the numbers above. Its water layer pays the coast's sea clip as well (devlog 197), as a
  floating gull's rings do.
- Inside the 1.5 ms budget everywhere, with about 0.4 ms to spare in the close view.

## Tests
TESTS

## Left open
- **Not in the shallows** (above): a stony-edge region in the places would let it out of the pools.
- **The pattern does not follow the arms** (above); at the closest view a crawl shows the arms
  sliding under it, faintly.
- **No shell pile at the den** (the research's clue): the den is under the rim, out of sight.
- **No hour:** visits are as likely at noon as near the low suns.
- **The idle arm and the eye** are the only signs while it sits; at the overview a patient viewer
  sees a small grey shape, not an octopus.
- **The crab is not hunted:** the arm feels into the rim and draws back empty, by design (nothing
  caught on screen).

Status: done.
