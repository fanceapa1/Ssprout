# 67 — S8: the waterfall's vegetation and ground

**Status: done**, with the open points below.

## What
- `src/scenery/waterfall/paint-veg.ts`: the vegetation and ground painters, generators that yield
  after each mark (ADRs 0226, 0238), on white (ADR 0021), neutral daytime only (daylight is S10).
  - *Far ridge*: a cool blue-grey ridge fading down, a nearer greener ridge, a scalloped far tree
    line broken into stands.
  - *Banks*: a pale cool plain, then wet-in-wet banks far to near (right bank, the left bank round
    the pool, three warmer near mounds), warm and cool passages with granulation, cool shade where
    the banks turn to the water, dry-brush lips.
  - *Meadow and grass*: the garden's `paintMeadow` / `paintMeadowGrass`, masked off the cliff, the
    pool, the stream and the strips past the sheet's edges (`WATERFALL_GROUND`).
  - *Crown woods*: a dark under-wash along the skyline, broken stands of `foliageClump`s with gaps
    and a few spires; small and spire-free over the crown slots.
  - *Overhang*: two trees leaning out over the cliff edge (left of the notch, off the buttress).
  - *Ferns*: moss glazes at the ledges' ends, fern sprays (rachis and paired leaflets) drooping
    off each ledge end and along the cliff foot, one small wet layer per spray.
  - *Foreground*: deeper corner greens and tall grass tufts; then the garden's paper margins.
- `src/scenery/waterfall/index.ts`: the placeholders for the ridge and the ground are gone; new
  steps `far-ridge`, `banks`, `meadow`, `grass` (before the rock), `crown-woods`, `overhang`,
  `ferns` (after the ledges), `foreground`, `margins` (after the falls, before the stones). New
  elements `woods`, `ferns`, `near`. `far-ridge`, `banks` and `margins` are `soft`, like the
  garden's. The sky placeholder stays (S10).
- Studio `waterfall-veg` (108): `veg-banks`, `veg-woods`, `veg-ferns`, `veg-scene`. Stale
  "placeholder" labels in the rock, water and map studios updated.
- Tests: `veg.test.ts` (step order, no fern on a slot, quantised hash pins of the overview and a
  garden-sized close view, slice bounds, many parts per step); `waterfall.test.ts` step list.
  TESTING rows S8.1–S8.4, S4.1 reworded. Rock and water pins unchanged (they filter by element).
- `src/main.ts` untouched. Nothing changed outside `src/scenery/waterfall` and the docs.

## Why
- The land is painted before the rock: the cliff reserves its paper and the pool its rim, so
  banks and meadow can run under them without edges to fit.
- The meadow's mask grows past the sheet's edges because a full row of meadow cells across the
  whole width (no pond or path to skip, as in the garden) went over the 130 k calls bound; the
  margins leave those strips near paper anyway.
- One wet layer per fern spray: a single layer over the cliff read 0.77 Mpx in one part in a close
  view.

## Looked at
`artifacts/shots/veg3-1440x900.png` (whole scene), `veg-banks-…`, `veg-woods-…`, `veg-ferns-…`.
The woods read as a dark, broken crown; the ferns read as ferns; the ridge recedes. Weaker: the
bank lips are fairly hard and parallel (the near mounds read a little as cut shapes), the spires
look like stacked balls rather than conifers, the meadow reads mostly yellow-green at overview
size, and the left of the cliff is washed out by the garden's margins.

## Left open
- Bank lips: break the long top edges more (dry-brush scallops, lost edges) and vary the mounds.
- Spires: a proper conifer silhouette (tiered, pointed) instead of stacked clumps.
- The trail's worn earth (the garden lifts its path; here the stones sit straight on grass).
- More moss around the ledges beyond S6's cushions; ferns are fairly uniform in size.
- Daylight plates for the vegetation are S10's.
