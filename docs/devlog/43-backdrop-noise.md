# 43 — P3: backdrop sheet noise, built once per seed

The P0a profile put the dock's torn-washi sheets at ~197 ms of main-thread work at load, before the
garden appears, and again on every section resize. Each tear built twelve 256 × 256 value-noise
lattices (786 000 random draws) to read 1-D noise along its edges. The outline, the fringe, the
fibres and the shadow each built it again, and the shadow added ten lattices of its own: 3.8
million draws per section, on every draw.

**What changed** (ADR 0223, amends 0208 on cost only):
- `paint/noise.ts` gains `createLazyValueNoise2D(rng, period)`: the same noise as
  `createValueNoise2D`, value for value, but the lattice is drawn a row at a time, the first time a
  row is sampled. The edges read only rows 0–8 (the tear) and 0–25 (the shadow's glazes) of 256.
- `ui/backdrop-sheet.ts` builds each seed's tear noise and shadow noise once, in a 32-seed LRU
  cache, shared by the outline, fringe, fibres and shadow and by every later size.
- The SVG output is **byte-identical**. `sheetMaskSvg` and `sheetShadowSvg` were fingerprinted
  (length and SHA-256) for six seed/size cases on the old code and committed first; they still match.
  No look changed, so there was no screenshot comparison.

**Numbers** (Node, Vitest, four sections at their desktop sizes, mask and shadow each):

| | before | after |
|---|---|---|
| all four sections, first layout | 86 ms | 9 ms (cold JIT) |
| the same again / after a resize | 78 ms | 4 ms |
| random draws, a new section | 3 801 416 | 67 376 |
| random draws, two resizes of a section | 7 602 700 | 428 |

**Tests**: `ui/backdrop-sheet.golden.test.ts` (fingerprints per seed),
`ui/backdrop-sheet.cost.test.ts` (draws counted through a wrapped `createRng`: under 70 000 for
a new section, under 1 000 for two resizes; the old code fails both), `paint/noise.test.ts` ›
lazy value noise (equal to the full lattice in any sampling order; draws only rows up to the deepest
sampled). TESTING rows 12.30 and 12.32. The existing `backdrops` e2e passes unchanged; the full run passed (typecheck, 1395 unit tests, 230 e2e). Docs:
`systems/ui.md` (backdrops), `systems/paint.md` (noise). No `main.ts` change.

**Left open**
- Not re-profiled in the browser. The Node numbers suggest the load cost drops from ~197 ms to
  ~15–20 ms; P0a's profile run would confirm it.
- About 50 000 of a new section's 67 000 draws are the rows below the sampled ones. Jumping the
  mulberry32 stream ahead would skip them, but it needs a jump-ahead in `core/rng.ts` (not in
  this task's paths).
- The remaining cost per layout is building the SVG strings (a point every 5 px on four outlines
  and 9 glazes). It is small, but sections far below the fold still lay out at load.
