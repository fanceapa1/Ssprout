# 180: The coast's rock and its seams, second pass (G2b)

## What
A second pass on the coast's rock, and on the seams where rock, water and land meet, after the
review of the joined picture (devlog 177 › The meeting of land, rock and water).

Files:
- `src/scenery/coast/paint-rocks.ts`: the promontory's form, the new `cliff-foot` step, and the
  shore's rock rewritten (shelf, ledge, beach flight, boulders).
- `shapes.ts`: `boulderShape`, `SPLASH_ROCK_SHAPES`, `SHORE_BOULDER_SHAPES`, `CLIFF_STONES`,
  `BEACH_FLIGHT` and `BEACH_FLIGHT_BOX`, the beach flight in `FLIGHTS`, and `SHORE_CLUMPS`.
- `rock-kit.ts`: `clipBatch`.
- `paint-land.ts`: `paintFlight` exported, the beach flight skipped, and the top terrace's back
  shade narrowed.
- `index.ts` and `painters.ts`: the `cliff-foot` step.
- The studio entries: `coast-rock/cliff-foot`, `coast-rock/ledge` and `coast-water/seat`. The
  water's in-place entries now include the `stones` element.
- ADR 0370.

Shapes the other tasks read:
- **Same names:** `SPLASH_ROCK_SHAPES` and `SHORE_BOULDER_SHAPES` keep their names.
  - `RockShape` lost `block` and gained `columns` (the profile) and `ground`.
  - The splash rocks stand on their layout places, with the same tops under the slots.
- **Moved:**
  - The shore boulders are dropped 14 into the water where that is water; the one on the beach
    flight is gone.
  - Nine small boulders were added.
  - `SHORE_CLUMPS` are now two clumps, at (866, 560) and (760, 742).
- **Unchanged:** the water's shapes (`FOAM_LINE`, `CLIFF_FOOT` and the rest), `WALL_TOPS`, the
  perches, the layout and the slots.

## The seven faults
1. **Splash rocks** (fixed):
   - Each is a sea-worn boulder: a squarish dome with rounded shoulders, one shoulder cut by a
     facet and a small step in the crown, so no two read as the same loaf.
   - The rock: a pale dry crown where the slot stands, the right flank and face in shade, pits
     and a crack.
   - At the water: a dark wet foot with weed, a broken reflection (dark under the foot, pale
     slices below), and a broken foam ring with a lap mark.
   - All rocks dry together in shared layers, each clipped to its own outline (`clipBatch`).
2. **Shoreline** (fixed in part):
   - One ledge down to the head of the beach flight: a pale grey top behind the edge.
   - Faces in blocks of their own height and step, under the runs that face the viewer.
   - Wet lips along the runs that face away.
   - At the water: foam, a contact shade and a broken reflection.
   - Thirteen boulders seated in the water break the line.
   - The ledge's top is faint at the overview, and the small boulders sit a little evenly spaced
     along the lips.
3. **Beach and shelf** (fixed):
   - The shelf's top runs rock tongues up into the sand and dips where sand drifts into hollows
     (`SHELF_LOBES`).
   - Sand lies in its cracks, a lit arris where it rises, and pebbles gather at its foot.
4. **Beach steps** (fixed): the flight runs down to the left along the shoreline, from the lower
   terrace onto the beach's tip. It is painted after the shelf and the ledge (ADR 0370), so no rock
   lies on it, and the shelf now meets the lower wall's foot, so no bare strip is left.
5. **Cliff foot** (fixed): the new `cliff-foot` step paints over the land's straight edge.
   - The face's base is in a cool glaze, so the lit gravel stands in front of a darker wall.
   - The foot comes down unevenly, with a dark seam and its shade on the gravel.
   - Low scree fans with stones, and seven fallen stones on the terrace.
   - The land's shade band under it is narrower and stronger.
6. **Promontory face** (mostly fixed):
   - Fissures at uneven spacing (some in pairs), leaning both ways, zigzagging, some opening
     below the rim and some branching.
   - Each bed has its own tilt and wander. The ledges' lips crumble into pieces over undercuts
     that thicken and thin, and a fifth of them are overhangs.
   - The notch is one soft undercut, graded darker down to a dark wet band.
   - At the overview the face is still a little regular toward the right.
7. **Small faults:**
   - The shoreline scrub is off the rock: one clump moved inland, one put on the lower
     terrace's corner, two removed (the flight and a slot were in the way).
   - The white patch behind the temple's base (between the first and second columns) is the
     placeholder **midday sky plate's**. With the background and the plate painted apart, the
     background leaves paper there (the sky, by design), and the plate's wet-in-wet wash leaves a
     rounded hole. Left for the daylight task.

## Cost
The probe was headless Chromium against the dev server: `paintJob` on the overview at scale 0.9,
DPR 1, cold, then the best of three warm runs. It ran A/B against `main` (exported from git and
served alone), at machine load about 4–6.

| step | main cold / warm | G2b cold / warm |
|---|---|---|
| promontory | 98 / 92 | 102 / 95 |
| cliff-foot | — | 21 / 19 |
| shore-rocks | 160 / 151 | 127 / 117 |
| land | 162 / 153 | 165 / 152 |
| whole coast | 1404 / 1283 | 1402 / 1261 |

- **Added cost:** none in all. The new step costs about 20 ms, and the shore's rock is about
  33 ms cheaper because its marks share layers.
- **Longest part** in the rock's steps: 6.6 ms (the promontory).
- **Not this task's:** the placeholder `shore` step (one part, 91 ms cold) and a 26 ms `walls`
  part, both the same on `main`.

## Looked at
Close views at noon (`?dev&scenery=coast`, zoom about 3):
- splash rocks, empty and planted;
- the shoreline by the bastion;
- the steps;
- the cliff foot;
- the promontory.

Also the overview on desktop and phone, the planted overview, sunset (planted) and night.
Copies are in the session scratchpad (`g2b-*.png`).
- The plants on `splash-1…3` stand on the rocks' tops.
- At sunset and at night nothing breaks; the boulders' foam stays pale at night.

## Tests
- Added:
  - `rock.test.ts`: the whole base of each splash rock's plant (the slot and ±8 × its scale)
    lies on the rock's dry top. The cliff foot is pinned in the step order. The fallen stones
    are wider than tall.
  - `land.test.ts`: the beach flight runs down to the left on the land and the beach.
- Re-pinned: the rock, land and vegetation recording hashes, all changed by this task. The
  water's did not change. The full order is 18 steps.

## Left open
- The ledge's pale top is faint at the overview. The small boulders along the lips are a little
  evenly spaced, like beads.
- The flight's slabs are pale and plain (the land's slab painter).
- The shelf's slab cracks still run in near-parallel rows.
- The temple's white patch is the sky plate's (daylight task).
- The olive's paper under its trunk shows as a pale box on the top terrace's bed in the cliff-foot
  close view (G4's olive, not changed here).
