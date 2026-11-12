# 156: Drying skips empty paper (Z13)

## What
A spike, then a build: the wet layer's drying pass now runs only over the box of painted pixels
plus the edge blur's reach, and gives exactly the bytes the whole-buffer pass gives (ADR 0349).
Only `src/paint/wet.ts` changed (`dryPixelsParts`, `dryCrop`, a `halve` argument on
`edgeBlurParts`), with a new `src/paint/dry-crop.test.ts`.

## Spike: can it be bit-identical?
- Grain and flow are only read at painted pixels, and the pigment pass only writes alpha 0 to
  empty pixels (already 0). Nothing writes into empty paper. Only the edge blur reads neighbours.
- **Tiles: no.** The box blur's running sums (float64, per row and per column) do not always come
  back to exactly 0 after a mark leaves the window, so the paper right of or below a mark carries
  a tiny residue into the next pass. Skipping a tile in the middle changes the sums later pixels
  read.
- **A box: yes.** Left of and above all paint every pass is an exact 0, so the sums can start at
  the box. To the right and below, painted pixels only read values within the blur's reach. The
  margin is that reach (two passes, half resolution: `2·(2r + 2) + 2` px), and the crop's corner
  sits on even pixels so the half-resolution grid lines up. Unit tests fail if the margin is cut
  to `r` or the corner is put on an odd pixel.

## Numbers
Dev server, headless Chromium, cold paint, DPR 2 for the scenes (1440×900) and 1.6× for the
sprites (seeds 1–4, growth 1, two rounds). A temporary probe in `dryParts` dried every layer
twice from the same read, with the old engine (a copy of `wet.ts` from before this task) and the
new one, alternating which ran first, timed each and compared the bytes. The machine was shared
with another agent, so single rows are noisy. The table is the second run; a first run against
the new code with `crop = false` gave the same totals (oasis 0.89, Japanese garden 0.83, sprites 0.81).

| painting | layers | wet-layer kpx | crop / area | drying old → new (ms) | new / old |
|---|---|---|---|---|---|
| oasis, whole cold paint | 2,234 | 34,905 | 83 % | 2,590 → 2,313 | 0.89 |
| — ksar step | 335–369 | 3,924–4,480 | 58–63 % | 229 → 167 | 0.73–0.76 |
| — plots step | 232–274 | 3,635–4,302 | 90–92 % | 274 → 267 | 0.96–0.97 |
| Japanese garden, whole cold paint | 661 | 14,491 | 76 % | 880 → 729 | 0.83 |
| — tree-left step | 153 | 2,096 | 51 % | 94 → 61 | 0.65 |
| sprites (oleander, Damask rose, katsura) | 1,096 | 24,389 | 81 % | 1,103 → 914 | 0.83 |
| — katsura | 222 | 11,589 | 73 % | 532 → 409 | 0.77 |
| — oleander | 208 | 9,898 | 88 % | 429 → 378 | 0.88 |
| — Damask rose | 666 | 2,902 | 85 % | 142 → 127 | 0.89 |

Over everything: 4,573 → 3,957 ms (0.87). Dense layers (the meadow, the margins, the plots) gain
about nothing and lose nothing (a 1200×900 dense buffer: 51.4 vs 51.0 ms in Node). The drying is
only part of a layer's cost: its pixel read (which also rasterises the fills) was about as much
again and stays whole-layer, so a scene's whole paint gains about half of these percentages.

Measured but not built: 32-px tiles dilated by the blur's reach would keep 53–100 % of each
step's area, less than the box only on long thin layers (meadow 70 vs 96 %, grass 53 vs 94 %,
reflections 67 vs 93 %), and they cannot be bit-identical anyway.

## Bit-identity
- In Chromium: every layer of both runs (8,671 layers over the two scenes and the three sprites)
  dried to the same bytes cropped and whole, so the oasis landscape and the sprites are the same
  pixels.
- `dry-crop.test.ts`: 120 random sparse layers (sizes, blur radii on both blur paths, open sides,
  sharpness 0/0.6/1, flow, granules, dry brush, speckle) and marks on a 32-px tile edge, against
  each side and corner and a single pixel, all byte for byte equal to the whole-buffer pass.
- The recording pins did not move: `src/paint/*.test.ts` (the drying pins of ADR 0238 included),
  `scene/paint-record`, `scene/paint-slices`, oasis `land`, `ksar-batch`, `paint-batch`, waterfall
  `rocks`, fauna `regression`, and the Damask rose, oleander and katsura tests: 193 tests pass.

## Paint version
`src/paint/wet.ts` changed, so the paint version changes: every cached painting repaints once
when this ships (to the same pixels).

## What's left
- The pixel read and write-back still cost the whole layer. A tight `area` on big layers is still
  worth it (the plots and the bluff are dense, so they gain little here).
- Tests run: the files above with `VITEST_WORKERS=1`; no e2e was needed (no behaviour change).

## Index rows
`| 156 | [Z13: Drying skips empty tiles](156-dry-skips-empty-tiles.md) | the drying runs over the painted box plus the blur's reach, bit for bit; drying 0.89× on the oasis cold paint, 0.83× on the Japanese garden and three sprites; tiles rejected (not bit-identical) |`

`| Z13.1 | Cropped drying equals whole-buffer drying byte for byte (random sparse layers, tile edge, sides, corners, one pixel) | `src/paint/dry-crop.test.ts` |`

`| [0349](0349-drying-skips-empty-paper.md) | The drying pass runs only over the painted box and the blur's reach, bit for bit | accepted | `dryPixelsParts` crops to the painted box plus the edge blur's reach on even pixels; same bytes; tiles rejected (running-sum residue) |`
