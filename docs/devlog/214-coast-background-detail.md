# 214 · Coast background detail (GB1, phase 15)

## What
An enrichment pass on the coast's background, after the owner asked for "a little more detail",
"good and realistic". The composition is unchanged: no slot, perch, creature place or the focus
moved. Shapes are data in a new `src/scenery/coast/distance.ts` (fixed seeds); the painters are
`village.ts`, `sky.ts`, `paint-rocks.ts` and a few lines in `light.ts`. No new step, no contract
change, so no ADR.

- **The far hill** (`far-hill`, soft): two gullies, old field terraces (the hill's contours broken
  into runs, a lit riser over a thin shade), four olive groves in rows on them, the road from the
  harbour up the bare right slope in hairpins to the chapel (broken where it passes behind a grove),
  and the warm ground under the village.
- **The village** (`village`): pastel ochre and rose walls on two houses and low tiled roofs on four
  (the Ionian note beside the white cubes and the blue dome), a slender bell tower in the lower
  village, eight cypresses in the gaps between houses. At the hill's foot a harbour: low rocky points
  over the sea's top edge, a strip of shingle with two boats drawn up, the quay under the lower
  houses, a mole curving out to a light post, five small boats moored, each with a short dark
  reflection painted by this step.
- **The horizon**: in the gap between the hill and the point a pale far coast and a nearer island
  before it, at most 14 above the horizon and lost into the haze at their feet, and a far sail. The
  sun is reserved paper on the sky plate, so a setting sun goes down behind the island.
- **The sky** (`sky.ts`): a low cumulus bank building over the far hill (in the band a 1470×750
  window shows), a smaller one over the promontory, four high streaks; lifted out of the noon blue
  with a soft grey belly, a rose-violet or lilac wash with the low sun's colour dropped in at
  sunrise and sunset, a faint indigo at night. Same shapes in every light. The old small cloud at
  (330, 176) went (it crowded the bank); the one at (940, 118) stays for tall views. The sky now
  hangs 1.5 over the far hill instead of 4, and the hill's wash pools a little less at its edge:
  the crest had a dark rim at sunset and at night.
- **The headland** (`promontory`): broad warm and cool patches across the limestone, scrub caught
  on the hard ledges (`LEDGE_SCRUB` in `shapes.ts`, off the goats' ways and 50 from every slot), a
  broken black lichen band above the wet foot with clusters of orange lichen over it, a few orange
  crusts on the point.
- **Night**: the harbour light on the mole's post and five warm dabs below it on the water, through
  `LightArt.lights`, which already gets the phase. The village's lit windows were already there
  (ADR 0372). No contract question.
- **Studio**: `coast-rock/harbour`, `horizon`, `ledges`; `coast-daylight/coast-far-<phase>` and
  `coast-harbour-night`.

## Left out, on purpose
- **A windmill**: the research lists it with the postcard clichés (§6). The bell tower is the one
  vertical added.
- **Fallen blocks down the point's face**: tried; at the overview they were invisible and close up
  they read as boxes pasted on the rock. The temple already has blocks at the krepis' broken end.
- **Anything on the water painter**: the harbour's reflections and the rocks' wet feet are painted
  by the `village` step over the sea; `sea.ts`, `paint-water.ts`, `motion.ts`, `pose.ts` and
  `boat.ts` are untouched and the `sea` step's output (the motion's plate) is unchanged.

## Cost
`sceneStats()` on the dev server, cold paint, fresh profile, laptop under load from the other
agents (same session, main's coast files checked out for "before"):

| step | 1470×750 @2 before → after (longest part) | 390×844 @2 before → after (longest part) |
|---|---|---|
| far-hill | 27 → 39 ms (2.7 → 1.8) | 20 → 27 ms (1.5 → 1.7) |
| village | 11 → 20 ms (0.4 → 1.1) | 3 → 7 ms (0.3 → 0.7) |
| promontory | 225 → 249 ms (54.9 → 56.5) | 76 → 97 ms (5.7 → 5.9) |
| temple | 26 → 27 ms | 26 → 28 ms |

Every new part stays under 2 ms. The promontory's 55 ms part at the owner's DPR 2 is main's
(its body wash over the whole face), not this task's. The sky plates still paint in one task each;
the daylight test keeps them under 1.5× the oasis's cost.

## Pins moved
`rock.test.ts` (overview and temple close view: the far hill, village and promontory painted more)
and `daylight.test.ts` (all four sky plates: the clouds, the hang, the far islands' distance glaze).
`motion.test.ts`'s sea-plate pin is unchanged.

## Left open
- The ledge scrub is subtle: most hard ledges in view are the goats' ways, so only a few pockets
  show on the point; most sit behind the olive.
- The far hill's crest is still stepped when zoomed far in (it is a soft step, painted at draft
  resolution).
- The sunset bank reads as a few soft lobes at the very top of the owner's window, close to the
  corner controls.

## Tests
`npm run typecheck`; the coast's unit files (152); the full unit suite after the rebase; e2e one
file at a time (`E2E_WORKERS=1`): see the report of this task for the files and counts.
