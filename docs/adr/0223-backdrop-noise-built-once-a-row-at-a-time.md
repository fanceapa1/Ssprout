# ADR 0223 — Backdrop sheet noise: built once per seed, a row at a time

- Status: accepted
- Date: 2026-10-24
- Amends: ADR 0208 (a leaf of washi behind each dock section), cost only

## Context
The phase 9 runtime profile (P0a) found the dock's sheets costing ~197 ms of main-thread work at
load, before the garden appears, and again on every section resize. `createTear` built 4 sides × 3
octaves of `createValueNoise2D(…, 256)`: twelve 256 × 256 lattices, 786 000 `rng.next()` calls,
to read 1-D noise along an edge. `sheetOutline` (twice: the body and the fringe), `sheetFibres` and
`shadowLayers` each built the tear again, and the shadow added ten more lattices. One section cost
3.8 million draws, every time it was drawn.

The edges only ever read the lattice along fixed rows: the tear's octaves at y 0.5, 3.5 and 7.5,
the shadow's pool at 1.5 and 6.5 and each glaze's jitter at `i × 3.1`. Value noise reads rows ⌊y⌋
and ⌊y⌋ + 1, so 2 to 26 of the 256 rows are ever used.

## Decision
- **Lazy rows.** `createLazyValueNoise2D(rng, period)` (`paint/noise.ts`) is `createValueNoise2D`
  value for value, but draws its lattice a row at a time, the first time a row is sampled. The
  full lattice is filled row-major from one stream, so row *r* is draws `r·period … (r+1)·period − 1`:
  drawing rows `0…r` in order reproduces it exactly, in any sampling order.
- **Once per seed.** The tear's noise (octaves, corners, skew) and the shadow's (pool, glaze
  jitters) are pure in the seed, so each is built once and kept in a 32-seed LRU cache. The
  outline, fringe, fibres and shadow share it, and every later size reuses it.
- **Byte-identical output.** `sheetMaskSvg` and `sheetShadowSvg` were fingerprinted (length and
  SHA-256) per seed for six sizes before the change; the fingerprints are unchanged. No look
  changed, so no screenshot comparison was needed.

### Rejected
- **True 1-D noise** (a 256-entry table per octave): cheaper still, but every edge would change.
  The sheets were tuned by eye (ADR 0208) and the lazy rows already meet the budget.
- **Jumping the stream ahead** to skip the rows below the sampled ones (mulberry32's state advances
  by a constant per draw): would cut a new seed's draws to ~18 000, but means reading the Rng's
  internals outside `core/rng.ts`. The rows below cost ~50 000 draws (well under a millisecond).

## Consequences
- A new section costs ~67 000 draws (was 3.8 million); a resize ~400 (the fibres' and rim's own
  small streams). All four sections at load: ~9 ms in Node cold, ~4 ms warm (was ~86 ms).
- Each cache (tears, shadows) holds at most 32 seeds. A tear seed keeps ~64 rows of 256 floats
  (64 KB), a shadow seed ~134 (137 KB): the page's four sections (8 tear seeds with the fringes, 4
  shadows) keep ~1 MB, the studio's many seeds at most ~6 MB.
- Tests: `backdrop-sheet.golden.test.ts` (fingerprints), `backdrop-sheet.cost.test.ts` (draws
  counted through a wrapped `createRng`: under 70 000 for a new section, under 1 000 for two
  resizes), `paint/noise.test.ts` › lazy value noise.
