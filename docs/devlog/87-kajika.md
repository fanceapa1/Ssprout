# 87 · Kajika frog (C5)

## What
The waterfall's singing frog, the **kajika** (カジカガエル, *Buergeria buergeri*), row `kajika` of
`WATERFALL_FAUNA` (10 plants, no water plant, announced). Only new files:
- `src/fauna/creatures/kajika.ts`: the art, the behaviour (`Kajika`), pure helpers (`kajikaSeats`,
  `kajikaWaters`, `seatY`, `edgePoint`, `swimmable`, `chooseSeat`, `boutNotes`, `sacAt`) and the
  default-exported `CreatureDef` (kind `kajika`, role `resident`, rank 5, a parts `sheet`, `show`
  on the `falls` stage).
- `src/fauna/creatures/kajika.test.ts`: 14 tests (seats, the way into the water, swims, seat
  choice, the song's rhythm and swell, from the start, 30 minutes of night, day against night,
  alarms, the dipper's stone, determinism, reduced motion, the studio stage).

## How it is painted
Three-quarter side view facing right, `KAJIKA_SIZE` 18 world units snout to vent at perspective 1
(the garden frog is 17; a real kajika is 4–7 cm, so it is drawn about as large as the other
waterfall creatures are, or it would be a speck). Research palette: `#8a8070` with `#6b6458`
blotches, gold eyes `#c99a3e`.
- **Body**: a low, flat silhouette with a pointed snout and the eye standing above the head line.
  Wet-in-wet from the grey-brown back into a paler grey flank, with two dropped blotches that bleed,
  granulated like the stone. In one wet layer clipped to it: ten irregular blotches, the dark bar
  between the eyes, the stripe from the eye to the nostril and the fold over the eardrum, so they
  dry together. A cool glaze low on the flank, lost upward. A soft violet-grey contact shadow.
- **Hind leg**: the thigh is its own wet-in-wet shape over the flank (lit on top, darker below) with
  three soft crossbars in a clipped wet layer, the shank a paler wash under it, the foot a faint
  sole with toes splayed at the front only. **Arm**: a bent wash (elbow back and out) with splayed
  fingers. **Toe pads**: small paler discs laid over (source-over), so they read as pads and not
  as dark beads.
- **Eye**: a soft bump, a gold iris laid over the grey, a dark horizontal pupil, one paper-white
  speck. No lid line.
- **Raised** (calling) is the same painting with the front lifted about the hips: the same seed, so
  the same mottling, and the arms straighten because the hands stay on the stone.
- **Throat sac**: a separate sprite, a pale bubble wet-in-wet from warm white into a cool
  violet-grey low on it, no rim, its top lost where it joins the throat, one soft light. Drawn from
  the chin, scaled by the song, at most 0.9 alpha.
- **Leap** (stretched, legs trailing in one wet layer, feet spread with pads), **swim** (only the
  head and eyes at the surface) and **deep** (the leap's `deepCopy`, the body under the water).

## Behaviour
- **Resident**, one, day and night (`resident: (n) => (n > 0 ? 1 : 0)`). On its stone from the
  start (`w.t < 2`); later it climbs out of the water at a stone's foot.
  `needs`: water and at least one seat.
- **Seats** (`kajikaSeats`): the rock perches (never ledges) and the scene's other boulders whose
  foot is in or within 26 units of the water, in view. So it also uses `rock-stream-bank`, which the
  birds don't. It sits on the stone's top (`seatY`, the dipper's foot line).
- **Song** (`boutNotes`, `sacAt`): bouts of 6–12 notes, the gaps shortening from 0.62 s to 0.17 s
  (a trill). The front lifts on straight arms over 0.35 s. With each note the sac swells and
  empties, the head jerks up a little, and toward the trill the sac stays a little full. A bout
  comes 3–12 s after it settles on a new stone, then every 3–9 s in the first 20 minutes after
  nightfall (the evening chorus), 7–22 s at night and 30–100 s by day. Resting, the throat barely
  flutters.
- **Moves**: every 45–130 s at night (80–220 s by day) it leaves its stone. A stone within 64 units
  is one hop. Otherwise it leaps into the water at the stone's foot (`edgePoint`: beside or in front,
  never behind), with a splash ring, swims (head at the surface, body under, a ring every 0.7 s) on
  a line that stays on the water (`swimmable`), and climbs out onto the next stone. By day 40 % of
  moves are a 40–110 s spell hidden under a stone instead. Now and then it shifts or turns on its
  stone.
- **Birds** (`THREATS`): a dipper or wagtail within 60/50 units, a heron within 190, a yamasemi
  within 150, and it **freezes**: pressed flatter, no song, no throat, until 4–8 s after the bird
  has gone. Closer than 26/22/110/80 and it **dives**, hides under, and comes back to a free stone
  once none is near.
- **Sharing stones**: it keeps 22 units off any creature's `spot()` / `perchPoint()` and gives its
  own as `spot()`, so the dipper, the wagtail, the damselfly (and the sawagani, if it reads `spot()`)
  keep off its stone.
- **Sizes**: `w.perspective(seat.depth, seat.x)` on a stone, the point's in the water, a blend in a
  hop. **Randomness**: only `w.rng`. **Reduced motion**: every timer, gap, note, hop and swim runs
  at `w.speed`.
- **Unlike the garden frog**: grey and mottled on stone, never green, never on a pad; it sings in
  bouts with a pale bubble, swims between stones and freezes for birds.

## Looked at
Probe shots from `kajika/probe.mjs` (Playwright against my own dev server on 5412, under
`nice -n 15`). Copies are in `artifacts/shots/kajika-*.png`:
- r1 parts (`kajika-r1-parts.png`): read as a toad loaf. The contact shadow was a hard grey bar cut
  by the sprite box, there was a black slab under the belly (stacked toe strokes and shank), the toe
  pads were dark beads in a row, the thigh was a tiger-striped sausage, and the leap had two
  ruler-straight sticks for legs → a flatter body, a soft shadow wash, mottling and leg in one wet
  layer, pale pads.
- r2 (`kajika-r2-parts.png`, `kajika-r2-garden-crop.png`): at garden size a brown bump on the foot
  rock, too small and too warm → 15 → 18 units, greyer flank, fewer warm blotches. The eye lid
  stroke read as a visor or eyebrow → gone.
- r3 to r5 (`kajika-r3-parts.png`, `kajika-r5-parts-crop.png`, `kajika-r4-close-call.png`): the sit
  pose was a grey slug with an eye, the folded leg not legible, and the sac a thin ring with a pale
  inside (outline and fill) → r6 (`kajika-r6-parts-crop.png`): a pointed snout, the eye above the
  head line, the barred thigh over the flank, bent arms, the eye stripe. It reads as a frog.
- r7–r8 close views at zoom 3 (`kajika-r7-close-zoom.png`, `kajika-r8b-close-zoom.png`): calling,
  head up on straight arms, a pale violet-grey bubble under the chin. First it hung below the stone
  and over the arm, too big → smaller, anchored forward at the throat. A dark line under the hind
  leg came from overlapping toe strokes → a faint sole and toes only at the front.
- Garden size, calling (`kajika-r7-garden-call.png`, `kajika-r8-garden-zoom.png`): a small mottled
  frog with a gold speck on the top of the foot rock, the bubble a faint pale disc under it.
  Noon close (`kajika-r10-noon-close.png`): flat and grey on the stream rock, almost lost in the
  stone. Night (`kajika-r10-night-call.png`): a dark fleck on the outflow rock. Phone 390×844
  (`kajika-r10-phone.png`, `kajika-r10-phone-call.png`): a speck on the foot-left rock.
- Busy pool (`kajika-r9-busy-crop.png`): with the whole roster, a hand-spawned frog sits frozen on
  the foot rock while the heron wades about 200 units off, as it should. Swim (`kajika-r13-swim-close.png`):
  two gold eyes and a flat head at the surface over a faint body.
- Studio (`kajika-r12-alive-t8.png`, `kajika-r11-alive-t11-crop.png`, `kajika-r12-falls-all.png`):
  at 300 × 190 the frog was as big as the stage's stream stone → 420 × 266.

What reads well: close up, a flat mottled grey frog with gold eyes and barred legs on a wet stone,
head up and a soft bubble swelling under its chin. At garden size it is camouflaged, as asked: you
find it by its gold eye and the bubble.

## Bench
`sprout.fauna.bench(300)` at the waterfall, 1440×900, DPR 2, headless Chromium, 25 plants, the
whole roster spawned (`roster().kinds`: strider, dipper, leaf, damselfly, iwana, butterfly,
dragonfly, bee, bird, kajika, heron; 18 creatures with the resident and a hand-spawned kajika), art
settled, one untimed `bench(60)` first. Timed runs: **update 0.04–0.05 ms + draw 0.77–0.80 ms =
0.81–0.86 ms a frame**, under the 1.5 ms budget (load about 3). Without the hand-spawned second
frog: 0.78–0.81 ms. A frog costs about 0.02 ms (two `drawImage` calls on a stone).

## Status
- `npm run typecheck`: clean.
- `VITEST_WORKERS=1 npx vitest run src/fauna src/scenery/waterfall`: 19 files, 192 tests pass
  (kajika: 14).
- No local e2e (CI runs it). `fauna-waterfall.spec.ts` picks the kajika up from the roster.
- Scratch files (probe script, setups, raw shots) are in the untracked `kajika/` folder.

## Rows for the orchestrator
fauna.md › Creatures and behaviour:

| Kind (unlock id) | Behaviour |
|---|---|
| `kajika` (waterfall: kajika) | resident ×1, day and night (on its stone from the start). Sits flat on wet stones in and by the water (`kajikaSeats`: the rock perches and the boulders with their foot in or by the water, never ledges). Sings in bouts of 6–12 notes that quicken into a trill: the head lifts on straight arms and a pale throat bubble swells with each note. Bouts every 3–9 s in the 20 min after nightfall, 7–22 s at night, 30–100 s by day, and soon after it settles on a stone. Every 45–130 s at night (80–220 s by day) it hops to a stone within 64 units, or leaps in at the stone's foot with a splash ring, swims head-up on the water and climbs out on another; by day it sometimes hides under a stone for 40–110 s. Freezes (no song) when a dipper, wagtail, heron or yamasemi comes near, dives and hides when one comes close. Keeps 22 units off other creatures' `spot()`/`perchPoint()` and gives its own `spot()`. Only in `w.pond.world` and `w.water.moving`, never in the foam. |

fauna.md › Layers: `kajika` (waterfall) on a stone and in a hop between stones → `entities` (depth:
the base of the stone it is on or making for + 0.5), a leap into the water or a climb out → `air`,
swimming → `waterSurface` (head and eyes) over `underwater` (the body's deep copy), hidden under a
stone → nothing.

TESTING matrix:

| C5.1 | The kajika frog: one resident on a stone from the start, day and night; sits on wet stones in and by the water, never ledges, gets into the water beside or in front of a stone and never in the foam, swims only where the water goes the whole way; picks a free stone, never its own; bouts whose notes quicken into a trill, the sac swelling with each note and empty after; over 30 minutes of night it sings, hops, leaps, swims and climbs on more than one stone, always on its stone or in the water; sings far more at night than by day and sometimes hides by day; freezes (no song) for a heron, dives when it is close, comes back when it has gone; never shares a stone with the dipper; deterministic; slower but still singing and swimming in reduced motion; a stone and a way in on the studio's falls stage | fauna/creatures/kajika (all) | fauna-waterfall › every creature on the roster can be spawned…; › a busy pool renders cleanly and stays cheap (roster-driven) | ✔ |

Devlog index line: `| 87 | [C5: kajika frog](87-kajika.md) | A flat grey frog mottled like its stone, gold-eyed, singing in quickening bouts with a pale throat bubble; freezes for birds and swims between stones |`

## Left open
- **Garden size**: about 10–14 css px on its stone. It is camouflaged as the brief asks, but the
  bubble is only a faint pale disc on a pale lit stone top. It reads better on the darker outflow
  and stream rocks than on the foot rock. On the phone it is a speck.
- **Leap and climb**: the stretched sprite is the weakest part (tube legs, the body's pooled edge
  across the hips). It is on screen for under half a second.
- **The sac in front of the near arm**: it is drawn after the body, so at full swell it covers the
  upper arm a little. A separate arm sprite drawn after the sac would fix it.
- **Seat height on the studio stage**: the stage's small stones paint their top a little below the
  perch line, so the frog floats a hair above them there (the dipper has the same). In the garden
  it sits on the painted top.
- **No dusk signal**: the world has only `mode.night`, so the evening chorus starts at nightfall
  (as the iwana's rise does). At `setHour(19)` it is still day mode and sings at the day rate,
  plus a bout soon after it settles.
- **The sawagani**: it keeps off any creature's `spot()` or `perchPoint()`, but whether the crab
  keeps off the frog's stone depends on the crab reading `spot()`.
- **Swimming** is a straight line at the surface. There is no drift with the stream's current and
  no dive to the bottom on the way.
- No call sound (S15).
