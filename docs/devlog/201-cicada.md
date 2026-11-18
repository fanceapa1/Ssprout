# 201 · Cicada (GK3, phase 15)

## What
The coast's summer singer: the ash cicada (*Cicada orni*), kind `cicada`, the `cicada` row from GK0
(2 plants, announced: "A cicada sings on the olive's trunk."). One cicada, sometimes two, on the
olive's and the leaning pine's trunks by day.

- **Module** `src/fauna/creatures/cicada.ts`, its line in `creatures/sets/creatures-coast.ts` (the
  only shared file touched, one import and one array entry). No contract change; `wildlife.ts` is
  untouched: the `bark-olive` and `bark-pine` regions were there.
- **Role:** a drifter by day (gap 90–240 s, stay 300–700 s, group 1–1.4, max 2), not counted
  against the visitor cap, so it never takes a bee's or butterfly's place. A drifter is not sent
  away by the sim at nightfall, so it flies off by itself when `w.mode.night` turns.
- **Where:** each `bark` region's middle line is scanned every 2 units (`barkSpine`), so a spot is
  a tree, how far down its trunk and a little to one side; it sits head up along the trunk at the
  tree's scale (`regionScale`), on `entities` at the trunk's foot's depth. Checked against the
  painting: on the olive it sits on the dark central stem of the painted trunk, on the pine on the
  bark between the beach and the needles.
- **Behaviour:** flies in from beyond the view's edge on a straight buzzing line, then quiet 4–14 s
  and song 5–16 s in turns; three times in ten a shuffle of 2–6 units, mostly up the trunk; after
  45–130 s it flies to the other tree. A bird within 90 units (any layer: the gull gliding past
  counts, a butterfly does not) silences it and it flattens to the bark until 5–12 s after the bird
  has gone. Two keep 12 apart.
- **The song** is the sound bed's; what shows is a shimmer: the abdomen throbs and the forewings
  tremble at 23 Hz (and 19 Hz for the wings), which the frame rate aliases into a flicker. A first
  try at 30 Hz for the wings sampled to nothing at 60 fps (the unit test caught it).
- **Paint** (`paintCicada`, 3 parts, one `ArtCache` entry): dorsal view; the broad grey-brown head
  with the big dark eyes at its corners and a glint, the thorax (collar, then the mesonotum with
  two dark wedges and the pale cross), the abdomen dim under the wings with pale segment edges, and
  one forewing drawn twice (mirrored) as the roof: a faint cool glass, the brown costa, three
  veins fanning to the tip closed by two cross-veins with the species' small dark spots, a paper
  glint along the ridge. A faint shadow on the bark. Four `drawImage`s a frame.
- **Size:** `CICADA_SIZE` 11 units, about 3.5 × life, the dropwing's exaggeration. At 7 units it
  was a 4 × 12 px smudge in the close view; at 11 the eyes and the roof read there. At the overview
  it is a speck, as asked.
- **Studio:** `fauna-cicada-close` (`cicada.studio.ts`): `poses` (rest, singing, flattened, in
  flight, on a leaning trunk), `song` (eight frames 1/60 s apart), and the real behaviour on close
  crops of the olive (`olive`) and the pine (`pine`). The def's `sheet` and `show` give the usual
  `fauna-cicada/alive` and `/parts`.

## Why
- **Region, not perches:** a perch is a point to stand on; the bark is a band the cicada moves
  along, which is what ADR 0373's `bark` regions are for. The scan reads the band's shape only, so
  it would work for any upright band.
- **Not on planted olives or pines:** the places contract has no plant trunks (`FaunaWorld.flowers`
  are flower heads only); widening it was out of scope.
- **No ADR:** nothing here binds other code.

## Spawn and the empty overview
`sprout.fauna.spawn(...)` works; the creature starts beyond the view's edge. Right after a spawn
the cicadas were at x −90 and 1690 (`fauna.list()`), as the gull, bees and butterflies are: they
enter from `entryPoint`/`exitPoint`/`offscreenPoint`. `npm run shots` runs `--eval` and then
`freeze()` at once, so a shot taken straight after a spawn shows nothing. Step the sim first:
`sprout.fauna.spawn('cicada', 2); sprout.fauna.step(25); sprout.fauna.settleArt()`. No code change.

## Looked at
`artifacts/gk3/`:
1. `studio-fauna-cicada-close` (first): eyes off the head's corners (a round dab starts at its point
   and runs along its angle, so it sat a radius too far out), a pinkish head, a green abdomen like a
   framed window under the wings, a stack of pale balls for the thorax.
2. `poses2`: grey-brown, darker thorax, narrower and dimmer abdomen; the right eye still outside.
3. `studio3`: eyes inside the head's corners; reads as a cicada with a roof of veined wings.
4. In the app (production build, 1440 × 900, the coast at noon, 4 plants, three spawned and stepped
   25 s): `scene-overview-r2` (specks), `scene-close-r1-0` (7 units: too small), `scene-close-r3-*`
   (11 units, at 3 × on each trunk; camouflaged, eyes and wings readable when enlarged).

**Bench** (production build, headless Chromium, 1440 × 900 at DPR 2, the coast at noon, 25 plants;
a busy machine with two other agents; `bench(60)` untimed, then `bench(120)` three times):
- the roster (2 butterflies, 3 bees, the heron, 2 gulls, the cat, and whatever the schedule brought
  in 20 s: one scheduled cicada, once two tortoises): **1.39/1.17/1.14, 1.09/1.15/1.17,
  1.12/1.19/1.13 ms**; the same with two more cicadas: **1.06/1.03/1.10, 1.18/1.13/1.11,
  1.13/1.09/1.13 ms**. No change inside the spread; under the 1.5 ms budget.
- alone: the cat **0.18–0.32 ms**; the cat and three cicadas (one round with only those and an
  arriving gull) **0.27–0.35 ms**: three cicadas cost a few hundredths of a millisecond.
- No "before" on `main` was measured separately; the roster with no cicada spawned by hand is the
  closest.

## Tests
`src/fauna/creatures/cicada.test.ts`, 11 tests (the bark and its spots, coast only; a visit: in,
sing, shuffle, other tree, always on the bark; the shuffle; a bird near; night; two apart; fork
and determinism; the studio stage; the shimmer; cost). Results: see the end of this entry.

## Left open
- **No plant trunks:** a planted olive or Aleppo pine gets no cicada (contract).
- **Camouflage vs reading:** at the close view at DPR 1 it is a small grey-brown shape; the eyes
  and the roof read best at DPR 2. The flight pose (wings swung out) is rough close up.
- **No hour:** it sings all day; the research's "starts when the heat is up" would need the hour in
  the fauna world (the tortoise's note, devlog 193).
- **The olive's bark band** runs along one stem of the painted trunk (`OLIVE_LIMBS[0]`), so it
  never uses the trunk's other stems.

Status: done.
