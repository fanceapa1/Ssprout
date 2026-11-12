# ADR 0370: The coast's cliff foot and beach flight are painted over the land, by the rock

- Status: accepted
- Date: 2026-11-13
- Builds on: ADR 0360 (coast layout), ADR 0366 (water by depth), ADR 0330 (paint parts), devlog 177

## Context
The land (G4) reserves `LAND` and paints it after the promontory and the shore. Two seams broke
because of that order (devlog 177 › The meeting of land, rock and water):
- The top terrace's back edge is ruler-straight at y 496–500. The land covered the promontory's
  scree cones along that line, so the cliff stood on the gravel like a stage flat.
- The beach flight (`STEPS[3]`) stood where the shoreline crosses the beach's tip. Its top step
  lay over the water, and the shore-rocks step (after the land) painted blocks and stones across
  it, leaving grey slabs and a bare strip.

The layout (`layout.ts`) is not this task's, and `LAND` and `STEPS` are read by the sea's depth,
the slots' tests and the map.

## Decision
- A new step **`cliff-foot`** in the `stones` element, before `shore-rocks`: it paints the
  cliff's base in a cool shade, a foot that comes down unevenly over the land's straight edge, the
  shadow on the gravel, scree fans under the fissures and stones fallen onto the terrace
  (`CLIFF_STONES`). The promontory's own scree, which the land covered, is gone.
- **The beach flight is painted by the rock**: `paintShoreRocks` calls the land's `paintFlight`
  for `BEACH_FLIGHT` after the shelf and the ledge, and `paintWalls` skips it. Its shape
  (`FLIGHTS[BEACH_FLIGHT]` in `shapes.ts`) runs down to the left along the shoreline, from the
  lower terrace onto the beach's tip, every step on dry ground. Nothing of the shore's rock lies
  on `BEACH_FLIGHT_BOX`.
- `LAND` and `STEPS` do not change.

## Consequences
- `COAST_ELEMENTS.stones` is `['cliff-foot', 'shore-rocks']`; the full order has 18 steps.
- `cliff-foot` skips itself when the view does not reach the cliff's foot.
- `FLIGHTS[BEACH_FLIGHT]`'s top step is about 58 right of `STEPS[3].x`; `land.test.ts` checks it
  runs down to the left on the land and the beach instead of its centre.
- A later land change that moves the top terrace's back must move `LAND_BACK` in `paint-rocks.ts`
  with it.
