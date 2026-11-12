# 174: Coast flora wiring (GF1)

## What
- The coast's `range` wiring for the five species shared with the oasis (research §4):
  - Pomegranate and grapevine: `cultivatedIn: ['n-africa-arabia', 'mediterranean']`.
  - Oleander: wild range gains the biome `scrub` and the climate `mediterranean` (native to Greek
    stream-beds and maquis; the research also has it planted on terraces).
  - Southern maidenhair: wild range gains the biome `coast` (seeps on wet sea cliffs) and the
    climate `mediterranean`.
  - Caper and ice plant needed nothing: both are `cultivatedIn: ['mediterranean']`.
- The coast now offers: caper, grapevine, ice-plant, oleander, pomegranate, southern-maidenhair.
- `coast.test.ts`: the exact `['caper']` pin became invariants (every offer in range, the caper and
  the ice plant offered, none of the Japanese garden's or the waterfall's species offered) and a
  test of the shared offer: the five in the coast and the oasis, none of them nor the ice plant in
  the Japanese gardens, no ice plant in the oasis.
- Species tests that pinned the old ranges (oleander, grapevine) were updated.

## Checked
- The offers of the Japanese garden, the waterfall and the oasis were computed before and after
  the change: identical (still pinned in `src/scenery/flora.test.ts`).
- The ice plant is offered by no garden but the coast.

## Left open
- The olive and the lavender (parallel tasks) and the other own species. The coast stays behind its
  flag until the released-scenery invariants (10-30 species, 2 per tier and habitat, 6 own) hold.
