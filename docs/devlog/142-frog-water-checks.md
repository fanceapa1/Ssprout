# 142: The frog's water checks (Z2, phase 14)

## What
The runtime report (phase 14) found 23–26 ms of main thread per second in the oasis under
`kajika → closestOnPolygon`, about a fifth of the oasis frame, and a GC rate 3–10× the other
gardens'.

**Where it came from.** The oasis has no kajika: its frog row (`sahara-frog`) has no creature
module yet. But the sim's resident upkeep (`FaunaSim.upkeepResidents`) asks every resident's
`needs(w)` every frame in every garden, before it asks how many it wants. The kajika's `needs` was
`kajikaSeats(w).length > 0`: every perch and every boulder, each tested against every water polygon
with `closestOnPolygon`, which allocated a point per edge. The oasis has many perches (frond tips,
copings, the rim) and long water polygons (the seguia, the sluice, the oued), so it paid most; the
waterfall (where the kajika lives) and the Japanese garden paid the same check on fewer points.

**The change** (behaviour identical, `src/fauna/math.ts` and `src/fauna/creatures/kajika.ts`):
- `closestOnPolygon` runs the same per-edge arithmetic without allocating (one result object per
  call); new `distanceToPolygon` returns only the distance and allocates nothing.
  `insideWithMargin` uses it, which helps every creature's water checks.
- `nearWater` (kajika) skips a polygon whose bounding box (cached per polygon array) is further
  than the reach, which proves the point is neither in it nor near its edge.
- The kajika's `needs` is `kajikaHasSeats`: the answer is cached per world and recomputed only when
  the pond, the moving waters, the perches, the scene's rocks or the view's numbers change (the
  view is copied every frame, so its numbers are compared, not its identity).

## Measured
Production build with `?dev`, 1440×900 at DPR 2, headless Chromium, full garden (`addPlants(200)`)
at the overview, 5 s windows (`frog.mjs`, a trimmed copy of the runtime report's `steady.mjs`).

| | kajika.ts ms/s (inclusive) | math.ts ms/s | `closestOnPolygon` self ms/s | GC events/s | JS work/frame (avg) |
|---|---|---|---|---|---|
| oasis day, before → after | 26.0 → 0.2 | 25.0 → 0.2 | 19.7 → 0 | 3.0 → 0.6 | 1.83 → 1.40 ms |
| oasis night, before → after | 30.8 → 0 | 30.0 → 0 | 20.3 → 0 | 3.0 → 0.4 | 3.46 → 1.59 ms |
| waterfall day, before → after | 2.6 → 0.6 | 7.6 → 5.2 | 4.5 → 0 | 0.8 → 0.8 | 1.58 → 1.56 ms |
| Japanese garden day, before → after | 2.0 → 0 | 1.8 → 0 | 0.8 → 0 | 1.0 → 0.4 | (noisy) |

The machine was shared (1-minute load 5–8 during the windows), so the frame averages are noisy;
the per-function figures are sampled profiles and steadier. The oasis's GC rate is now at or below
the other gardens'. What is left in `math.ts` at the waterfall is the other creatures' own water
checks (pointInPolygon and the like), not the kajika.

## Tests
`src/fauna/creatures/kajika-water.test.ts`: the old functions are kept in the test as the
reference. Over ~4000 random points plus every vertex, edge midpoint and points scattered 0.5–140
units around them, in all three gardens: `closestOnPolygon` gives the same point and bit-identical
distance, `distanceToPolygon` the same distance, `insideWithMargin` and `nearWater` the same answer
at every margin and reach, and `kajikaSeats` the same seats in the same order; degenerate polygons
(empty, one point, repeated points, NaN) match too. `kajikaHasSeats` matches the uncached answer as
the view and the scene change.

## Left open
- `upkeepResidents` still asks `needs` before the wanted count, for every resident every frame.
  Asking the count first would skip it outright where a kind is not on the roster; `sim.ts` was not
  this task's to change.
