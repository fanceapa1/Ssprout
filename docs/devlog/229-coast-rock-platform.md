# 229 · GO1: The coast's terraces stand on a rock platform above the sea

## What
The owner's top complaint about the coast: "it's unclear whether the plantable area is a shore or
a rocky platform above the shore level … I prefer the rocky platform", and "the entire
floor/steps/walls in the plantable area still look unfinished". The garden stays behind
`?dev&scenery=coast`. Looked at in the owner's window (1470 × 694) in five rounds, each against
their screenshot, then at sunset and night, at 1440 × 900 and on a phone (390 × 844). Final shots
in the session scratchpad, `go1/go1-*.png` (DPR 2).

## Why the edge read as a beach
The walls, seen from the front, said "stepped and raised"; the seaward edge said "beach": one long
diagonal where the cream floor met the turquoise water with a row of round boulders and foam.
In this view a rock face shows only where the shoreline runs down to the right (the land above
the water on the screen). Most of the old shoreline ran down to the left, where a face turns away
from the viewer, and the two short runs that faced us carried faces 11–22 units high. GA1's worn
lip (devlog 226) changed the edge's texture but not that geometry. ADR 0388 records the decision.

## The composition (ADR 0388, `platform.ts`, `paint-platform.ts`)
- The top terrace and the middle one each end in a headland whose face drops into the sea: the
  top one over the upper cove (rim from its west corner (764, 552) to W1's coping, foot y 620–634),
  the bastion over the lower one (rim (690, 726) to W2's coping, foot y 778–789). 52–73 units of
  rock, more than the wall each ends; the higher headland stands higher, and the next terrace's
  floor passes in front of its foot at its east end.
- `SHORE_EDGE` now runs along the faces' feet: the faces are land, and the sea, its depth lines,
  the motion's clips and the wildlife's water stop at the rock.
- The faces: bedded limestone graded darker to the sea, shade planes on the blocks' east sides,
  hard beds as an undercut under a lit lip, joints with a lit hairline, stains under the rim, the
  west corner and the rim's arris lit (the arris continues the wall's coping), a dark wet foot with
  black lichen and weed, foam at the water; on the water the face's shade and a broken dark
  reflection.
- The back edges (the runs down to the left) are the floor's rim over deeper water: a lip of bare
  rock, the lit arris, a sliver of the rock's thickness, a dark line where it drops away, the water
  beyond in its shade. No foam and no stones on them; the row of boulders is gone (two large and
  two small fallen blocks lie at the faces' feet instead).
- The swell breaks on the faces' feet: the laps run along them (five reaches) and the white water
  climbs the face as a crest arrives; the old laps along the lip are gone. The motion's cost test
  (300 blits, 7 clips) passes unchanged.
- The beach steps are cut into the platform's corner: four slabs from the lower terrace onto the
  sand over the stair's stepped side, which rises out of the sand with sand drifted at its foot.
- The walls run full height to their seaward ends (W1 and W2 meet their headland's face, W3 the
  steps' rock), each end built of quoins.

## Floor, beds, walls, steps (`paint-land.ts`)
- The path is flagged: rows of one to three flags, about one in five missing so the gravel shows,
  dark joints, each flag its own limestone with its shade on the lower right; worn pale landings
  above and below each flight. Twelve small glazes of packed earth and cool gravel break the floor.
- Beds: darker dug soil in clods (dark lumps with a lit top), a ring of small edging stones laid
  round each (put back pale over the soil, each its own stone and shade).
- Walls: the face in a cool glaze, deeper toward its foot, under the lit coping; a dark contact
  shadow on the terrace below before the soft one; quoins at the seaward end.
- Flights: a lit west cheek with a dark seam on its outer edge, beside the lit treads and shaded
  risers.
- One light: from the upper left over the sea, in all four phases (the light plates were not
  changed; they shade the walls and their cast shadows as before).

## Slots and anchors
No slot moved; ids and counts kept. `shallows-3` keeps 37 units from the bastion's corner (30 is
the rule). Moved a little, off the new faces and the water: the shore-scrub spots 3 and 4 ((742, 800) → (752, 806), (704,
836) → (708, 836)), a phrygana cushion ((726, 800) → (748, 812); (822, 604) → (828, 550)), a grass
tuft ((842, 616) → (800, 552)) and a shore clump ((760, 742) → (800, 672)). The damselfish's
shallows keep inside the turquoise and below the caique (the smoothed line stood out past the
turquoise off the new headland). No scrub spot lies on a face.

## Pins moved
`water.test.ts`, `rock.test.ts`, `land.test.ts`, `veg.test.ts`, `daylight.test.ts` (all four
phases) and `parts.test.ts` (the shore). `motion.test.ts` and `coast.test.ts` have no hash; their
step list and lap test changed. New tests: the platform's faces, back edges and fallen blocks
(`rock.test.ts`), the laps on the headlands' feet (`motion.test.ts`); the walls' full height
(`land.test.ts`).

## Paint cost
Dev server, 1470 × 694 at DPR 1, the overview without plants, three paints each in one browser
session, `sceneStats().timings` (total ms / longest part ms / parts):

| Step | Before (`main`) | After |
|---|---|---|
| `land` | 157–160 / 9.0–9.1 / 326 | 227–237 / 19.7–20.3 / 679 (its own work: under 6) |
| `walls` | 241–252 / 25.9–26.2 / 463 | 299–300 / 5.4–7.0 / 690 |
| `beds` | 64–68 / 3.9–5.5 / 189 | 114–118 / 4.5–5.0 / 313 |
| `cliff-foot` | 20–21 / 3.3 / 155 | 18–21 / 1.3–3.3 / 155 |
| `platform` (new) | — | 24–25 / 5.4–5.5 / 555 |
| `shore-rocks` | 223–228 / 6.9–7.0 / 986 | 187–189 / 6.9–8.0 / 778 |
| `shore` | 61–64 / 4.6–4.7 / 480 | 59–67 / 4.6–7.7 / 480 |

The touched steps cost about 1.05 s against 0.79 s, most of it the finished floor, beds and walls
(flags, kerb stones, clods and the walls' shade layers). Without the settles the platform's raster
landed in `shore` (23.7 ms) and the land's in `walls`.

The land and the platform settle their queued raster in parts of their own (`settle`, a one-pixel
read, ADR 0238): before, the earlier steps' raster landed in one 26 ms part of `walls`; now it
lands in the first part of `land`, before the land paints anything, at about 20 ms. That part is
the beach's and the sea's work, not the land's. The land's own longest part is under 6 ms.

## Tests
`VITEST_WORKERS=1 npm test` after the last rebase (see the report); the coast's 13 test files
(187 tests) one directory at a time while iterating; e2e `sceneries` (13), `scene` (5), `fauna` (6)
and `studio` (38) one at a time with one worker: all passed.

## Left
- The lower terrace has no face of its own; its rim over the bastion's cove reads by its lip and
  shade only.
- The faces' heights are a painter's, not the terraces' lifts above the sea (ADR 0388).
- Out of scope and untouched: the cliff behind the olive, the pines and the olive, the far
  village, the sky, plant and creature art.
