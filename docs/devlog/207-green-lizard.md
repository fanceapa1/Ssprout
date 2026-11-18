# 207 · Balkan green lizard (GK10, phase 15)

## What
The coast's wall lizard: the Balkan green lizard (*Lacerta trilineata*), kind `green-lizard`, the
`green-lizard` row from GK0 (3 plants, announced: "A Balkan green lizard basks on the dry-stone
wall."; text unchanged).

- **Module** `src/fauna/creatures/green-lizard.ts` with its test and studio file, and its line in
  `creatures/sets/creatures-coast.ts` (the only shared code file touched: one import, one array
  entry). `wildlife.ts` and `scenery/coast/fauna.ts` are untouched: the `wall-*` faces and their
  coping perches were there. No contract change, no ADR.
- **Role:** a resident by day only (`resident` gives 0 at night, and one already out goes into its
  gap at nightfall and is gone).
- **Where** (`lizardHomes`): each coping perch of the three terrace walls (the places put them clear
  of the flights and the slots) with 34 units either side along the face. Its place is `x` along the
  wall and `v` down the face from the coping (−0.15 is on the coping's top, at most 0.75, never at the
  foot). Gated on all three of `wall-top`, `wall-middle`, `wall-lower`, since the oasis has a
  `wall-middle` too. Checked in the painting at zoom 3: on the dry-stone face of the top and middle
  walls, a plant in front of the middle wall drawn over it (depth: the wall's foot).
- **Behaviour:** hidden in the gap at one end of its stretch; peers out head first (1.5–4 s, the head
  turning), then straight dashes (6–16 units at 80 u/s × perspective) with stops (0.25–1.1 s) to a
  basking spot; basks flat and still (6–18 s); often lifts its head and looks round (1.5–3.5 s, the
  yellowish throat showing). Cat 100, gull 90, heron 160, goat 70, hoopoe 55, thrush 45 within reach:
  one dash to the nearer end of its stretch, snout at the gap, and it slips in head first (everything
  past the gap clipped), stays 7–16 s and while the threat is near, then peers out again.
- **Paint** (`paintGreenLizard`, one `ArtCache` entry): from above (its back to the viewer on the
  face), a grass-green wet-in-wet body, softened a little toward ochre to sit in the painting, dense
  fine dark speckling, a whip tail about twice the body that dulls toward the tip, four splayed legs
  with five toe strokes each, in three body frames (flat, the S one way, the S the other way, the legs
  reaching on the outside of the bend); the head a separate sprite (flat, or lifted with the throat
  wash) turned for looking round; a soft shadow. Three `drawImage`s a frame, plus a clip only while
  half in a gap. `GREEN_LIZARD_SIZE` 30 units snout to tail.
- **Studio** `fauna-green-lizard-close`: poses (basking, looking round, slipping in, peering out),
  the run frames, and a live close crop of the top wall.

## Frame cost
`sprout.fauna.bench(300)` in headless Chromium, 1440×900 at DPR 2, the coast at noon with its
residents and the shared visitors: without the lizard 0.99 ms a frame (11 creatures), with it
0.76 ms (14 creatures). The run is noisy (creatures walk off screen between the two), so the lizard's
own share is below what this bench resolves; it is three `drawImage`s and a few comparisons.

## Tests
`green-lizard.test.ts` (10): homes on the walls' face and coping; coast only; resident by day, none
at night; peers, basks, looks, dashes with stops on its stretch; dashes fast and lies still while it
basks; looking round lifts the head; slips head first from a cat (not a butterfly or a far gull),
stays in while it is near, peers out after; big birds frighten it, small ones not; goes in at
nightfall; deterministic per seed.

## Left open
- **Not on the path edge** yet: only the walls' faces and copings. The path's spots are `GroundSpot`s
  in `wildlife.ts`; a second home kind along the path's edge would be the next step.
- A hand `sprout.fauna.spawn('green-lizard')` adds one beside the resident (as for every resident).
- Unverified, as the research doc marks it: the species and its Ionian record (*Podarcis* wall
  lizards are the other candidate). No user-visible text was added beyond the doc's name.
- No pale stripes or blue throat of the spring male; the green is the brightest in the scene but a
  little flat at the overview, where it is a small green dash.
