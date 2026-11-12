# ADR 0366: The coast's sea is painted by depth from the shore; the beach and the pools after the shore

- Status: accepted
- Date: 2026-11-12
- Builds on: ADRs 0360 (coast layout), 0341 (lazy painters), 0226 and 0238 (paint in parts)

## Context
The coast's sea must change colour with depth: pale aquamarine over sand by the beach, turquoise
in the middle, ultramarine-teal far out, deep right under the cliff. Bands by height (the draft's
horizontal glazes) read as stripes and ignore the broken shoreline's coves. The water also meets
the rock task's work in two places: the beach runs under the rock shelf, and the rock pools sit in
the shelf inside the rims the rock task paints. The placeholder `shore` step reserves the whole
beach and the shelf, so anything painted under it is lost.

## Decision
- **Depth is a distance from the near shore** (`sea.ts`): the shoreline and the beach's waterline
  as one path, measured with the vertical stretched 2.4× (the sea plane seen low), plus a bias that
  makes the rock's foot steep (up to 320 units, the higher up the shoreline the more). A depth line
  is found per column (every 6 units), the first point down from the horizon nearer the shore than
  the depth, then smoothed; so it runs round the coves and never loops. Three lines (shallows 150,
  turquoise 420, deep 640) bound the sea's washes, light to dark.
- **The seabed is authored data** (`SEAGRASS`, `SEABED_ROCKS`, `SAND_WINDOWS`): placed clear of
  the shallows' plants, with sandy windows behind them, so plants read on pale water.
- **Order**: `sea` and `caique` stay before the rock (the promontory and the shoreline overlap the
  sea's washes). A new element `beach: ['beach', 'pools']` comes right after `shore`: the beach
  reserves its own paper from just above the waterline to its back (`BEACH`), so the shelf's top
  edge painted by `shore` stays; only the sand's wash runs 8 units past it, multiplied. The pools'
  water is laid inside each pool's outline.

### Rejected
- **Marching squares on the distance field**: a closed contour needs chaining and still loops in
  the coves; the column scan is a few lines, deterministic and cheap (15–20 ms for all four lines,
  once, on the first paint).
- **The beach and pools before `shore`**: the placeholder shelf reserves over them, and the rock
  task would have to cut the pools out of its shelf. After `shore` the water needs nothing from it.

## Consequences
- The rock task's pool rims are painted before the pool water, so the water runs slightly inside
  the rim rather than under it. A rim that must overlap the water belongs in a step after `pools`.
- Daylight and motion read the same shapes: `shallowsEdge()`, `FOAM_LINE`, `CAIQUE_SHAPES`,
  `CAIQUE_BOX`, `CLIFF_FOOT`, the reflections and the patches.
