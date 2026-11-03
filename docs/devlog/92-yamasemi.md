# 92 · Yamasemi, the crested kingfisher (C8)

## What
The waterfall's rare last visitor, **yamasemi** (ヤマセミ, crested kingfisher, *Megaceryle lugubris*),
row `yamasemi` of `WATERFALL_FAUNA` (20 plants, rare, announced). Only new files:
- `src/fauna/creatures/yamasemi.ts`: the art, the behaviour (`Yamasemi`), pure helpers
  (`yamasemiPerches`, `choosePerch`, `sharePerch`, `roomOn`, `plungeSpot`, `onRock`, `streamWay`,
  `Route`) and the default-exported `CreatureDef` (kind `yamasemi`, role `visitor`, `show` on the
  `falls` stage, a parts `sheet`).
- `src/fauna/creatures/yamasemi.test.ts`: perches, plunge spots, the stream way, a whole visit,
  fish, rarity and night, the rng fork, determinism, reduced motion, the studio stage (16 tests).

## How it is painted
Side view, painted facing right. `YAMASEMI_SIZE` 44 world units from bill tip to tail tip at
perspective 1 (pigeon-sized, nearly twice the dipper's 23). Painted as sumi on reserved white:
- **The white is reserved paper**: each part starts with an opaque `petalWhite` ground with no rim
  (`edge 0, darken 0`), so the paper multiplied last turns it to the washi's own white, with only a
  faint cool shade low on the belly for its roundness.
- **Fine barring** (`bars`): rows of short brush touches, staggered, broken, bowed a little to follow
  the form, all in **one wet layer dried once**, so 2-px marks keep their shape. (Separate ink lines
  were broken into wedges by each one's drying pass, and dabs read as leopard spots.) Dark on white
  for the breast band (a rusty touch in it, the male's), the malar stripe, the flanks and the tail.
  On the slate back and the folded wing it works the other way: a dark ink wash with fine white bars
  lifted across it.
- **The head**: a black cap broken by the dry brush over the eye, white specks in it; the white
  cheek stripe and half-collar reserved; a slate hindneck so the head joins the back; the eye dark on
  dark with only a glint. **The bill** is a heavy dark dagger with a paler tip and a fine gape line.
- **The shaggy crest** is its own sprite: tapering blade strokes flung back from the crown (most
  lying back over the nape, a few standing up), a small wet core, white spots. It raises and lowers
  by rotation and stretch about its root (`drawHead`). The head is drawn 1.12× (a kingfisher's big
  head).
- **Flight**: a level body (white below, barred above), one raised wing of round-tipped spotted
  flight feathers over barred coverts, foreshortened through edge-on for the beat; the far wing at
  0.75. The perched head and crest sprites are reused, set at the front of the body.
- **Hover**: body nose-up, head bent so the bill points at the water, the beat drawn as a haze of the
  whole sweep. **Plunge**: nose straight down, wings swept back, cut at the surface.
- **Splash**: a broken column of cool white water (not the paper's warm white, which read beige on
  the blue pool) with jets and drops; **rings**: its own three-ring sprite on `waterSurface`, darker
  than the sim's shared ripple (that one is lost on the waterfall's blue), spreading for 3.2 s after
  the bird has gone. The sim's ripples are fired too.
- A small silver fish, held crosswise in the bill, beaten on the perch and swallowed.
- Per frame: 3 `drawImage` perched (body, crest, head), 4–6 in flight, +1 for the splash and the rings.

## Behaviour
- **Visitor, rare**: `visit { gap 1100–2200, first 150–420, stay 150–300, group 1, max 1, diurnal,
  visitor }`. Counted against the cap; the sim sends it away at nightfall (it then leaves down the
  stream). `needs`: a stream to come along and a perch over still water, so never the Japanese garden.
- **Arrival**: fast (250 u/s × perspective) and low (10 units over the water) up the stream from just
  off the view (`streamWay`: the stream's far end, middle and near end, stepped in from the ends),
  dropping under its perch and swooping up onto it.
- **Perches** (`yamasemiPerches`): rocks with their foot within 30 units of the still water, and
  shelves with still water within 90 units straight below that are 120 units or more from the falls'
  sheet (`FALLS_CLEAR`). At the waterfall that is rock-pool-left, rock-outflow and rock-foot, never a
  ledge and never the stone out in the stream. High ones likelier; the falls-foot rock, in the spray,
  much less. Free ones first (30 units from others' `spot()`), those in view first (a phone shows
  only part of the gorge); with every perch held it shares the roomiest boulder and stands at the end
  farthest from the other bird (`sharePerch`, `roomOn`). It gives its own `spot()`.
- **On the perch**: faces the pool; the crest goes up and down every 1.8–6.5 s, raised at landing and
  with most bouts of head bobs (1–4 bobs, a dip and a nod of the head); a rare turn about. Before a
  hunt it leans and peers at the water for about a second. 9–26 s between hunts (16–32 s the first time).
- **Hunting**: picks a spot (`plungeSpot`) 40–230 units off, on the side it faces first, in the still
  water 16 units in from its edge (so never in the foam or on the shore) and never on or just behind
  a boulder standing in the pool (`onRock`). Flies out to hover 46–72 units over it for 0.9–2.2 s
  (gives up 18 % of the time), plunges bill first in 0.42 s (big rings, a splash, an echo ring),
  0.45–0.8 s under, bursts up and flies back to its perch (or another if someone took it). 45 % of
  the time it comes up with a fish, beats it on the perch for 3 s and swallows it.
- **Leaving**: at the end of its stay (or at night): drops off the perch and goes fast and low down
  the stream, out of view.
- **Sizes**: `w.perspective(ground, x)`, where the ground is the water under the bird in flight and
  the hover, and the perch's base on it.
- **Layers**: on the perch → `entities` at the perch's depth + 1; hovering, plunging, under and
  emerging → `entities` at the spot's depth (so a near rock or a bank plant is in front), the part
  under the surface clipped away; flying in, out and between → `air`; its rings → `waterSurface`.
- **Randomness**: one `w.rng.fork('yamasemi:<seed>:<t>:<index>:<count>')` per visit; it never draws
  from the world's stream (tested with the sim's ring calls left out: their variant comes from the
  sim's own rng).
- **Reduced motion**: everything at `w.speed` (0.6), longer perch spells, still hunts.

## Other creatures and the kingfisher
- `sawagani` (`SAWAGANI_TUNING.threats.yamasemi` 150) and `kajika` (`THREATS.yamasemi`, freeze 150 /
  flee 80) already know kind `yamasemi` (tested).
- **For the orchestrator**: `iwana` reacts to no bird at all (no threat list); a fish fleeing a
  kingfisher's shadow would be a change in `iwana.ts`. `bird.ts` (the wagtail) counts as taken only
  the spots of other `Bird` instances (`c instanceof Bird` in its `spawn`), so a wagtail may land on
  the yamasemi's rock. The dipper and the damselfly read every creature's `spot()` and keep off.
  Not edited.

## Looked at
Probe shots from a small Playwright script (`artifacts/yamasemi/probe.ts`, with `garden.sh`,
`hunt.sh`, `sheet.ts`) against my own dev server on port 5417, under `nice -n 15`, one at a time.
All in `artifacts/yamasemi/`:
- r1 (`r1-parts.png`): leopard polka dots instead of bars, a grey translucent bubble for the white
  with a grey rim, the crest a black fan pointing down and clipped, the cap a beanie, the wing an egg,
  the splash a sea urchin.
- r2 (`r2-parts.png`): bars as scattered rice grains, the crest a grey rock, the wing an agave of
  grass blades, the splash a tulip. r3 (`r3-parts.png`): thin ink lines broken into wedges by their
  drying.
- r4 (`r4-parts.png`, `r4-alive-t20.png`, `r4-alive-t20-crop.png`): fine bars at last. On the stage it
  reads as a kingfisher, but a tall white bottle, the wing a grey shield pasted on, the crest a black
  flame standing up, a faded grey cap. r5 (`r5-alive-t20-crop.png`): the crest still stood up, since
  the raise rotation had the wrong sign; a white hindneck detached the head.
- r6 (`r6-alive-t20-crop.png`): reads as a crested kingfisher: crest swept back, slate nape, white
  half-collar. `r6-hunt-t*.png`, `r6-full-t22.9.png`: the hover and the plunge work, the splash tiny.
- r7 (`r7-hunt-sheet.png`, the stage's hover, mid-plunge, splash and emerge): plunge and emerge read;
  drops like mud specks, jets a grey crystal, the hover's wings invisible.
- r8 (`r8-wf-noon.png`, `r8-wf-noon-crop2.png`): in the waterfall it chose the lowest shelf beside the
  falls (out now) and reads at garden size as a speckled black-and-white kingfisher with a crest.
- r9 (`r9-wf-hover-crop.png`): a good hover, but over the falls-foot-left boulder, whose rocks were not
  out of the water (fixed: `onRock`). r10 (`r10-wf-plunge.png`, `r10-wf-splash.png`): mid-plunge in
  open water; splash small, no ring. r11 (`r11-parts.png`, `r11-wf-splash.png`, `r11-wf-emerge.png`):
  its own rings, at first pale blue on blue (darkened and enlarged), the emerge.
- r12 close view (`r12-close.png`, zoom 4 on rock-pool-left at noon): bars, collar, crest, the
  dagger bill. Sunset (`r12-sunset.png`, zoom 2.5, rock-outflow, crest lowered). Phone
  (`r12-phone.png`, 390×844): perched off the edge of the crop, out of sight (fixed: perches in view
  first). `r13-phone.png`: on the outflow rock, crest up, clearly bigger than the dipper on the
  falls-foot rock.
- `r14-bench.png`, `r14-bench-without.png`: the bench frames.

What reads well: at garden size a big pied, speckled bird with a crest watching the pool from a
boulder, twice the dipper; close up the ink barring on reserved white, the black cap and shaggy
crest, the white half-collar, the barred breast band and tail; the hover with the bill down, the
bill-first plunge cut at the surface, and the ring spreading after it.

## Bench
`sprout.fauna.bench(300)` ×3 at the waterfall, 1440×900, DPR 2, headless Chromium, 25 plants, the
whole roster spawned (`roster().kinds`), stepped 20 s, art settled, one untimed `bench(60)` first.
With the yamasemi (27 creatures, it on its perch): **update 0.05–0.06 ms + draw 1.00–1.05 ms =
1.05–1.11 ms a frame**. Without it (26): 1.12–1.16 ms. The difference is noise: it costs 3–7
`drawImage` a frame. Under the 1.5 ms budget.

## Status
- `npm run typecheck`: clean.
- `VITEST_WORKERS=1 npx vitest run src/fauna src/scenery/waterfall`: 22 files, 227 tests pass (with
  `yamasemi.test.ts`, 16 tests).
- No local e2e (CI runs it). `fauna-waterfall.spec.ts` picks the yamasemi up from the roster.
- No shared file changed (`main.ts` untouched).

## Rows for the orchestrator
fauna.md › Creatures and behaviour:

| Kind (unlock id) | Behaviour |
|---|---|
| `yamasemi` (waterfall: yamasemi) | rare visitor by day (gap 1100–2200 s, stay 150–300 s, one at a time; leaves at nightfall). Comes in fast and low up the stream from off the view and swoops up onto a high rock over the still water (`yamasemiPerches`: rocks with their foot by the pool, shelves overhanging it 120 units or more from the falls; high ones likelier, the falls-foot rock in the spray less; free and in-view ones first, else it shares the roomiest boulder at its far end). Faces the pool, raises and lowers its shaggy crest, bobs its head in bouts, peers before a hunt; every 9–26 s it hovers 46–72 units over a spot in the still water (16 in from the edge, never the foam, never on a boulder; `plungeSpot`), plunges bill first with a splash and big rings, comes up (45 % with a small fish it beats and swallows on the perch) and goes back. Leaves fast and low down the stream. Side view; sumi bars on reserved white. |

fauna.md › Layers: `yamasemi` (waterfall) on its perch → `entities` (depth: the perch's + 1); hovering, plunging, under and emerging → `entities` at the plunge spot's depth (clipped at the surface); in flight → `air`; its plunge rings → `waterSurface`.

TESTING matrix:

| C8.1 | The yamasemi: perches on the high rocks by the pool, never a shelf in the falls or the stone in the stream, the high rock likelier than the spray rock; keeps off held perches, perches in view on a narrow view, shares a wide boulder when every perch is held; plunges only well inside the still water, never the foam or a boulder; comes and goes low along the stream from off the view; a whole visit (enter, perch, launch, hover, plunge, under, emerge, return, leave) within its stay; fish now and then; rare, diurnal, counted, gone at night; never in the Japanese garden; the crab and the kajika know it; draws only on its own fork; deterministic; slower in reduced motion and still hunts; hunts on the studio's falls stage | fauna/creatures/yamasemi (all) | fauna-waterfall › every creature on the roster can be spawned…; › a busy pool renders cleanly and stays cheap (roster-driven) | ✔ |

Devlog index (`docs/devlog/README.md`):

| 92 | [C8: yamasemi crested kingfisher](92-yamasemi.md) | The rare crested kingfisher in sumi bars on reserved white: in low along the stream, watches from a high rock raising its crest, hovers and plunges with a splash and big rings, leaves down the stream |

## Left open
- **No overhanging branch**: the arrival line says "from a branch", but the waterfall has no branch
  or snag perch; it uses the high boulders. A dead branch over the pool in the scenery (with a perch
  of its own) would suit it best, and it would take one by itself (any perch within 90 units over the
  still water qualifies).
- **Its white does not take the evening light**: the reserved white is opaque paper-white, so at
  sunset the bird stays cool while the gorge glows. A warm glaze from the daylight would need the
  creature world to carry the light.
- **Under the water**: nothing is drawn for the 0.45–0.8 s under the surface (the splash covers it).
  No dark shape of the bird under water, and no fish taken from the iwana (the fish it catches is
  generic).
- **The flight wing** is one plan sprite foreshortened; the downstroke shows the same (upper) face
  mirrored, not the white underwing (the female's rufous underwing coverts are not painted).
- **The hover**: the head bends 1.2 rad from a nose-up body; at close view the neck join is abrupt.
- **The breast band** is the male's (a rusty touch). No female variant.
- **The iwana do not flee it** and **wagtails may land on its rock** (see Other creatures; not my files).
- **Sound**: no call (its loud rattling "kyara-kyara"); S15.
