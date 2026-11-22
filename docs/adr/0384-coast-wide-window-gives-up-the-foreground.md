# ADR 0384: In a wide window the coast gives up its empty foreground, not its sky

- Status: accepted
- Date: 2026-11-22
- Builds on: ADRs 0123 (cover viewport, phones), 0130 (the stage is 94 % of the window), 0132 (the
  stage's ragged edge), 0360 (the coast's layout), 0382 (perches inside `COAST_SEEN`), 0383 (slot sites)
- Amends: ADR 0382's `COAST_SEEN` (y 240–985 → y 210–960)

## Context
The overview covers the window around `view.focus`. In a wide window (1470 × 750, the owner's) the
stage is 1442 × 705 CSS px, so the world shows 782 units of height. At the coast's focus (760, 600)
that was y 209–991:
- The top 60 CSS px of the stage sit under the corner buttons ("Start studying", the icon row) and
  the stage's ragged top edge. The chapel's dome (top ≈ y 288) stood just under "Start studying",
  the temple's columns touched the edge, and the sky over the far hill (its clouds at y 206–290)
  was hidden.
- The stage's bottom dissolve is 15 % of its height (117 units here), from y ≈ 873. Below the
  lowest wall (face foot y 882–903) the painting also fades into the paper margin (166 units).
  Seven slots stood in that strip (y 946–985) and the rock pools at y 888–904: their plants read
  washed out or half gone. In every landscape window the strip was under the dissolve.

782 units cannot hold both: the sky over the hill (from y ≈ 200), the buttons' band and the
dissolve leave a clear band of about 595 units, so whatever stands below y ≈ 845 is faded.

## Decision
- The coast's focus moves to (760, 570), and only the coast's: 1470 × 750 shows y 179–961. The dome
  and the temple's top stand 34–37 units under the buttons, with about 90 units of sky over the
  hill. 16:9 windows show y ≈ 135–1000; 1440 × 900 is unchanged (y 41–1000); phones show the full
  height already and crop only the sides (unchanged).
- The foreground strip under the lowest wall is the painting's foot. No slot stands there: the
  seven move onto the terraces under their old ids (habitat, size and site kept; a terrace's lift
  instead of the ground's scale), `path-4`, `low-1` and `mid-1` shift to make room, and neighbours
  closer than half a plant box share a y so neither stands over the other's base.
- The rock pools rise 20–28 units with the beach's back (y 822–852), so their slots stay in the
  first 30 % of the dissolve. The painted shelf, pool rims, wildlife regions and the crab's and the
  octopus's places follow `POOLS`, `BEACH` and `SHELF`.
- A test pins the framing per landscape window: dome and temple below the buttons' band, 60+ units
  of sky over the hill, every slot's foot within the first 30 % of the bottom dissolve.

Rejected: a scenery field for how it wants to be cropped in wide windows (a contract change; a focus
already says it for this garden); raising the lowest wall to make a clear foreground (it squeezes the
lower terrace and moves every wall-related perch, bed and flight: a redesign); keeping the focus and
moving only the slots (the sky stays cut).

## Consequences
- Fewer large near plants: the foreground slots took `perspectiveScale(946–985)`, on the terraces
  they take their terrace's (about 0.85 of before).
- The lower terrace's front is a row of small plants (`scrub-5`, `low-1`, `path-3`, `path-4` at
  x 752–882); the strip below it holds the path's start, the near jar and phrygana only.
- `low-4` (1560, medium) keeps its place: a full medium box there reaches past x 1600; the middle
  terrace's beds behind leave it no room further left. Real medium sprites are narrower than the box.
- `COAST_SEEN` (ADR 0382) becomes x 60–1530, y 210–960.
- The other gardens keep their focus; the fit rule and the camera are unchanged.
