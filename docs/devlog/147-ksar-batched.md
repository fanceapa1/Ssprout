# 147: Ksar blocks batched (Z4)

## What
The plan was to make the oasis's `ksar` step cheaper the way Z3 did for the plots: dry a block's
small marks together, not one wet layer and drying pass per mark. That is done (ADR 0345), but
a profile showed that the small marks were not where the time went. The step's real cost is the
blocks' big washes, so they now take fewer layers as well.
- `ksar-batch.ts` (new): `strokeInto` lays `stroke`'s marks (wet or dry-brush) into a given layer,
  optionally at a lower strength through `globalAlpha`. `strokeDry` is the drying `stroke` would
  use. `washInto` lays a small wash's or glaze's fills (and a plain fade). `batchLayer` opens a
  layer at the resolution one mark's own layer would get.
- `paint-rocks.ts`: on each block, one layer per kind of mark: the pale and the damp patches,
  courses, putlogs, rain streaks, blotted corners and lit tops. On a band: the fillets, the
  flicks and the niches. On a ruin: the gullies, the lit edges and the holes. In the openings:
  the holes, lintels and sills. Each palm frond's blades share a layer, and so do the seat's
  cracks and its lit edges. The fronts' `wetInWet` takes 9 layers (it was 14) and the flanks' 6.
- A previous agent had started the batching without committing. Its patch was the starting
  point. This task fixed its stroke helper so a full-strength stroke matches `p.stroke` call for
  call, added the palms, the seat and the wash layers, and measured.

## Where the time goes
CPU profile of a cold oasis paint (dev server, 1440×900 @2, `Profiler` sampling at 0.2 ms),
time under `paintKsar` by the outermost paint call:

| | wetInWet | glazes | washes | small marks (strokes, dabs, their drying) | total |
|---|---|---|---|---|---|
| before | 267 ms | 218 ms | 76 ms | ~150 ms | 719 ms |
| batching only | 263 ms | 223 ms | 60 ms | ~139 ms | 703–771 ms |
| batching + fewer layers | 146 ms | 183 ms | 51 ms | ~125 ms | 600 ms |

Batching alone saved about 25 ms. A batched layer covers the whole face, so its drying pass
reads and dries pixels that the separate marks' small layers never touched. Each `wetInWet`
layer is two fills, each clipped by a freshly deformed half plane. That geometry and the clipped
fills' rasterising are most of the step.

## Numbers
Prod preview, `?dev&scenery=oasis`, 1440×900, a fresh context per run (cold paint cache), read
from `sceneStats()`. Before (main) and after served side by side and run back to back, best of 3.
The machine was shared and busy (load 3 to 20 during these runs, up to 68 later).

| | DPR 2 ksar | DPR 1 ksar | longest ksar part at DPR 1 |
|---|---|---|---|
| before | 695 ms | 1,084 ms | 13.1–13.5 ms |
| after (batching + fewer layers) | 588 ms | 946 ms | 13.1–15.3 ms |
| before, an earlier pair (load ~8) | 710 ms | 608 ms | 7.1–10.0 ms |
| batching only, same pair | 733 ms | 647 ms | 7.7–9.9 ms |

The DPR 1 runs were slower than the DPR 2 runs because the load rose during them. Each pair was
run back to back, so compare within a pair. That is about −0.1 s at DPR 2 and −0.14 s at DPR 1:
**short of the −0.3–0.5 s target**. Every ksar part stays within the Z1 budget at 1× (≤ 15.3 ms).
At DPR 2 the longest ksar part is 35–37 ms before and after alike: a drying pass's single read.

## Pixels
- **Recording pins** (rock): overview `59fcb2af` → `bce0f3ed`, detail `94c1b4e4` → `621f5c7d`,
  taken from the first run in a fresh process. The ksar's pixel reads went from 1122 to 342 at the
  overview (507 to 205 in the detail view).
- **Art review**: before and after shots from the two prod builds (fauna cleared, frozen), in
  `artifacts/z4/` (not committed). Mean change and share of pixels changing by more than 12:
  overview 1440×900 0.85 levels / 1.9 %, 1920×1080 0.93 / 2.1 %, 390×844 0.94 / 2.5 %, sunset
  0.74 / 1.5 %; ksar close view (zoom 3) at noon 2.7 / 8.8 % and at sunset 2.3 / 7.1 %; the middle
  tower (zoom 5) 2.7 / 8.7 %. The close views change more than Z3's because the fronts'
  `wetInWet` draws fewer numbers from the block's rng, so every mark after it on that block (patches,
  courses, putlogs, rain) is a new draw of the same kind: same density and size, different
  places. The towers, the openings and their lintels and sills, the carved bands (fillets,
  zigzag, lozenges), the crumbling crests, the palms and the seat into the rock read the same.
  The flicks are a shade lighter at their rims where they touch, and the arched openings fade a
  little more evenly toward their foot. Side by side: `compare-close.png` (ksar noon, ksar
  sunset, tower; before left) and `compare-tower-band.png`.

## Tests
- `scenery/oasis/ksar-batch` (new): a wet flick, a rain streak and a lit dry-brush touch, each
  laid with `strokeInto` and dried with `strokeDry`, make exactly `p.stroke`'s canvas calls.
- `scenery/oasis/rock`: new pins. The ksar's pixel reads are at most 360 at the overview and
  220 in the detail view.

## Left open
- **The target needs the engine.** What is left in the step is the big washes: `wetInWetParts`
  (a deformed half plane per colour per layer) and the glazes' ragged fades (`applyFade`, four
  half-plane lifts each). Cheaper half planes (one per layer, or reused across layers) would
  help every scenery. It is the engine owner's task.
- The shade glazes keep their 7 layers. Their spread makes the soft edges, and fewer would show.
- `strokeInto` overlaps `dryBrushInto` (`paint-batch.ts`). Both belong in the engine.
- Scripts used (`bench.mjs`, `prof.mjs`, `shots.mjs`, `diff.py`) are in the task's scratchpad
  and are not committed.

## Index rows
`| 147 | [Z4: Ksar blocks batched](147-ksar-batched.md) | The ksar's small marks dry per kind and block, its fronts' wet-in-wet takes fewer layers: −0.1 s, short of target; the rest is the engine's big washes |`

`| Z4.1 | ksar marks laid in a shared layer dry exactly as p.stroke | unit: src/scenery/oasis/ksar-batch.test.ts |`

`| Z4.2 | the ksar dries its small marks per kind and block (pixel reads bounded) | unit: src/scenery/oasis/rock.test.ts |`

`| [0345](0345-ksar-batched.md) | The ksar's small marks dry per kind and block; the blocks' wet-in-wet takes fewer layers | accepted |`
