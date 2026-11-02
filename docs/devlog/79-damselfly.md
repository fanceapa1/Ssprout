# 79 · Miyama-kawatombo damselfly (C2)

## What
The waterfall's broad-winged damselfly, **miyama-kawatombo** (ミヤマカワトンボ, *Calopteryx
cornelia*), row `damselfly` of `WATERFALL_FAUNA` (2 plants, announced). Only new files:
- `src/fauna/creatures/damselfly.ts`: the art, the behaviour (`Damselfly`), pure helpers and the
  default-exported `CreatureDef` (kind `damselfly`, role `visitor`, variants `male`/`female`,
  `show` on the `falls` stage, a parts `sheet`).
- `src/fauna/creatures/damselfly.test.ts`: wings, where it flies and perches, visits, the dipper's
  stone, wing openings, night, determinism, reduced motion, the studio stage (15 tests).

## How it is painted
Side view facing right, `DAMSELFLY_SIZE` 34 world units from head to abdomen tip at perspective 1
(the aka-tombo is 30; the damselfly is longer and much thinner).
- **Abdomen**: a long wet stroke 1.15 units wide in metallic green (`#3f8371`), with a cooler,
  bluer stroke over its back half, a thin wet shadow stroke along the belly (shading, not an
  outline), broken pale lifts along the back (`#7eb4ac`, bluer toward the tip) for the metallic
  glint, faint dark rings at the joints and the claspers (male) or a short ovipositor (female).
- **Thorax**: a slanted shape (wings back, legs forward), washed green then glazed near-black
  underneath with a lost edge, a dark suture slanting down its side and two sheen dabs either side
  of it. **Head**: one wash plus glaze joined to the thorax's front (a dark compound eye bleeding
  into the face), with a small reserved glint. Legs: long thin sumi lines, gripping a perch or
  folded under the thorax in flight.
- **Wing**: one broad paddle (span along +x, chord across), wet-in-wet from pale amber at the base
  to sepia toward the tip, its base losing its edge (`fade`), a pooled rim, one backrun bloom,
  granulation, a darker smoke layer where the wing broadens, five faint broken veins. Male:
  darker, smokier, 0.8 opacity. Female: paler amber, 0.64, with a small white false pterostigma
  near the tip.
- **Wings in 3D**: each of the four wings is drawn with an affine `ctx.transform` from
  `wingAxes(phi, beta, near)`: `phi` lifts the wing, `beta` sweeps it back, and near wings lean
  toward the viewer (the garden is seen a little from above). The same sprite gives the closed
  rest pose (four wings stacked flat over the back, darker where they overlap), the slow opening
  (near and far wings fan apart), and the wingbeat (high over the back to below the body, the
  span foreshortened when it points at us). Far wings draw behind the body at 0.45 (rest) or 0.85
  (flight) alpha. Five `drawImage` calls a frame, no blur frames.
- **Turning**: the side view's x scale eases through end-on (`turn`) instead of flipping.

## Behaviour
- **Visitor**, its own pacing in the def: gap 80–200 s, first 12–45 s, stay 60–130 s, groups of
  1–2 (the second is the other sex: a pair along the stream), max 2, diurnal.
  `needs`: water and at least one perch.
- **Flight**: slow (30 u/s) and wavering. The heading wanders on noise, each downstroke lifts it a
  little (a zero-mean bob), 5.2 wingbeats a second. It flies 6–20 units (× perspective) over
  **water points** (`waterPoint`): in a stream, or within 70 units of the still pool's edge (the
  foam is already carved out of `w.pond.world`), 40 units inside the view. It never drops below
  3 units over its ground line. Sizes come from `w.perspective(ground, x)`, the ground eased
  between waypoints.
- **Perches** (`perchSpots`): the wet rocks' tops (never cliff ledges) and plant heads within 140
  units of water. A plant's flower target sits high in its sprite box, so the perch is 65 % of
  the way down to its base, on the flower sprays. `chooseSpot`: near ones likelier, rocks ×1.4,
  never the one it is on, 22 units clear of other creatures' `spot()` and other damselflies'
  `perchPoint()`.
- **On a perch** 4–14 s, wings closed over the back. Every 1.6–5.5 s it slowly opens them
  (1.2–2.2 s, to 45–100 % open) and closes them again. It closes them before it lifts off. Then:
  - **sally** (50 %): one or two short hops out over the water (16–55 units) and back to the
    same perch;
  - **move** (32 %): another perch, through zero or one water point;
  - **patrol** (otherwise): two to four water points, then a perch.
- **Sharing**: a bird standing on or flying to its perch flushes it at once. If its target perch
  is taken in flight it picks another (checked every 0.5 s).
- **Leaving**: when the stay is over, or at night (the sim calls `leave`), it finishes its perch
  spell and flutters off the nearer side at 1.4× speed.
- **Reduced motion**: everything runs at `w.speed` (wingbeats, flight, spells, openings).
  Randomness only from `w.rng`, noise from `w.noise`.
- **Unlike the aka-tombo**: the dragonfly darts on a spring and hovers seen from above with a
  wing blur. The damselfly is seen from the side, flutters slowly on visible wingbeats, sits
  with dark wings closed over its back, and comes back to the same perch.

## Looked at
Probe shots from a small Playwright script against my own dev server (port 5404), under
`nice -n 15`. Copies are in `artifacts/shots/damselfly-*.png`:
- r1 (`damselfly-r1-parts.png`): it read as a damselfly at once, but the thorax and face were a
  pale sage ball that read as a big pale head, the abdomen was a uniform tube with a dark belly
  line (outline and fill), the eye was clipped by the sprite box, and a leading-edge ink line
  outlined the wing → darker metallic thorax, a wet shadow stroke instead of the line, a wider
  box, no edge line, a bloom in the wing.
- r2 (`damselfly-r2-parts-zoom.png`, `damselfly-r2-garden-crop.png`): the head floated as a
  separate ball, the joint dabs read as ruler ticks, and in the garden the flight wings were pale
  tan and the insect small → joints smaller and irregular, wings darker (male) and 31 → 34 units.
- r3 (`damselfly-r3-close-crop.png`, `damselfly-r3-close-crop2.png`, zoom 3.2): it **landed on
  the dipper** on the foot rock. The female's flight downstroke reads well (a translucent amber
  wing), but her white pterostigma was too big → it keeps off birds' perches, flies off when one
  lands (test added, checked failing without the fix), and the spot is smaller.
- r4 (`damselfly-r4-garden-real.png`, real size): perched on a plant at garden size it reads as
  intended, **a dark brown wing petal over a teal needle**. But plant perches came from flower
  targets high in the sprite box and it sat in mid-air (`damselfly-r4-targets-crop.png`: on the
  rock above a daimonjisō) → perch 65 % of the way down. Studio `alive` at t 8 / 20 / 34
  (`damselfly-r4-alive-t8.png`, `damselfly-r4-alive-t20.png`): flight over the pool reads well,
  but on the falls stage it perches over a grass tuft, because the stage's flower targets assume
  80-unit plants where it paints 30-unit tufts (`stage.ts`, shared, left alone).
- r5–r7 close views (`damselfly-r5-close-crop.png`, zoom 4; `damselfly-r7-parts-zoom.png`): the
  half-open wings show the watercolour (pooled rim, faint veins, translucency), but the thorax
  was an egg and the head two dark dots with a gap, too cartoon → a slanted thorax with a suture
  and sheens, the head one wash plus glaze joined to it.
- Sunset (`damselfly-r7-sunset-crop.png`): the female landing on the stream rock stays a dark
  needle under brown wings in the warm light. The male was heading for a plant down in the
  painting's faded margin, where it nearly vanished → perches and water points keep 40 units
  inside the view.
- Busy pool (`damselfly-r8-busy-crop.png`): beside the striders, leaves and the rest of the
  roster, the male is a green needle under smoky raised wings and the female bronze → far wings
  darker in flight.
- Phone 390×844 (`damselfly-r8-phone-crop.png`): small. The female on the foot rock is a brown
  fleck over a thin needle. The male on the iwatabako is barely visible among its leaves.

## Bench
`sprout.fauna.bench(300)` at the waterfall, 1440×900, DPR 2, headless Chromium, 25 plants, the
whole roster spawned (15 creatures: striders, dipper, leaf, 2 damselflies, butterflies,
dragonfly, bees, wagtail, heron), art settled, one untimed `bench(60)` first. Two timed runs:
**update 0.03–0.04 ms + draw 0.30–0.46 ms = 0.34–0.48 ms a frame**, under the 1.5 ms budget
(load about 2).

## Status
- `npm run typecheck`: clean.
- `VITEST_WORKERS=1 npx vitest run src/fauna/creatures/damselfly.test.ts src/scenery/waterfall`
  plus `registry`, `waterfall`, `sim` and `regression` tests: 11 files, 106 tests pass.
- No local e2e (CI runs it). `fauna-waterfall.spec.ts` picks the damselfly up from the roster.

## Rows for the orchestrator
fauna.md › Creatures and behaviour:

| Kind (unlock id) | Behaviour |
|---|---|
| `damselfly` (waterfall: damselfly) | visitor, 1–2 (a pair: male green, female bronze), diurnal, gap 80–200 s, stay 60–130 s. Flutters slowly and low (6–20 units) over the stream and the pool's margin (`waterPoint`: never the foam, 40 units inside the view), on visible wingbeats with a downstroke bob. Perches on wet rocks and plant heads near the water (`perchSpots`, never ledges) with its wings closed over its back, opening them slowly now and then; after 4–14 s it sallies out over the water and back to the same perch (50 %), moves to another, or patrols. Keeps off perches a bird holds and flies off when one lands beside it. Side view; four wings from one sprite through `wingAxes`. |

fauna.md › Layers: `damselfly` → `air` (flying and perched, like the butterflies).

TESTING matrix:

| C2.1 | The miyama-kawatombo damselfly: a diurnal visitor that needs water and a perch, visits by itself once unlocked and not at night; a pair is a male and a female; wings rest closed flat over the back, fan apart when they open, beat high to low, foreshortened toward us; flies only over the streams and the pool's margin, never the foam, in view, never below its ground; perches on wet rocks and plants near water, never ledges; sallies back to the same perch; opens its wings on a perch; keeps off the dipper's stone; leaves after its stay and at night; deterministic; slower in reduced motion; works on the studio's falls stage | fauna/creatures/damselfly (all) | fauna-waterfall › every creature on the roster can be spawned…; › a busy pool renders cleanly and stays cheap (roster-driven) | ✔ |

## Left open
- **Phone**: at 390×844 it is a fleck. Its read comes from the dark wings. A perched male on a
  leafy plant nearly disappears.
- **Studio falls stage**: its flower targets assume 80-unit plants but it paints 30-unit grass
  tufts, so the `alive` entry shows the damselfly perched a little above a tuft. That needs a
  `stage.ts` change (shared).
- **Plant perches** are a guess (65 % down from a flower target). There is no per-species perch
  point, so on some plants it may cling to air or leaves rather than a stem tip.
- **Head-on and from above**: the art is a side view only. Flying straight toward or away from
  the viewer it turns through end-on as a squeezed card. Only seen in close views.
- **Courtship X** (wings crossed) and the female ovipositing on submerged plants are not done.
- **No wing shimmer**: the male's metallic green is painted lifts, not a hue that changes with
  the angle.
- Sound: none (S15).
