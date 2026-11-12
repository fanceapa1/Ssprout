# 153: Damask rose sprite batched (Z11)

## What
The Damask rose was the second-slowest sprite in the phase 14 audit (125 ms, measured under load).
It now paints in about 0.51–0.54× the time of the old code. Only `src/plants/species/damask-rose.ts`
and `src/plants/lib/damask-rose-paint.ts` changed. No shared helper was edited (`ribbonInto` is
only imported, as before).

## Where the time went
Profiled on the main thread in headless Chromium against the dev server, growth 1, 1.6×, seeds
1–8. `WetLayer.dry` was wrapped (a one-pixel flush first, so the fills' rasterising and the
drying are timed apart), and a CDP CPU profile gave the self time by function. Old code, per
sprite (about 83 ms under the profiler):
- 24 wet layers, about 780 kpx in all, each over the bounds of everything it holds. Drying costs
  about 55 µs per kpx and almost nothing per layer (0.02 ms for a tiny one), so **area is the
  cost, not the number of layers**. Measured, not assumed: devlog 147's lesson ran the other way.
- The roses: 9 layers (the buds, two sets × three rings, the hearts, the lips) of 350 kpx, 21 ms.
  Each covered every flower of its set, so mostly empty paper.
- The canes: 6 layers (a body and a mark layer per band), 239 kpx, 16 ms.
- The leaflets: 6 layers (two groups per band), 191 kpx, 19 ms with 7 ms of fills.
- Flow noise was 14 ms of it. Every layer here has a small flow scale, so the noise grid runs at
  its finest step.
- `petal` and `leafletBlade` recomputed the same `pow`/`sin` profile values for every point.

## What changed
- **Each rose's marks take small layers of their own**: its bud and sepals, each ring, the heart
  and creases, the lip. The order is the old one: the buds, then set 0's rings, then set 1's,
  then the hearts, then the lips. Flowers of one set do not overlap, so this is the same painting
  in about 70 small layers: 350 → 54 kpx.
- **The canes dry with their band's leaves.** Their strokes go into the band's first leaflet layer
  before the leaflets (`caneInto`, the old stroke into a given layer). The canes and leaves both
  multiply, so the order does not matter. Their dry settings were nearly the same. The rachis,
  laterals and stalks (width < 1) take one plain fill, not two deformed ones.
- **One mark layer for the canes of all bands**: the dark underside, the red flush and the
  prickles. They kept a fixed opacity per band, so this is exact except where marks cross.
- **Leaflets take one fill each** (the plain and the deformed fill folded into one at the combined
  strength). The shaded half and the midrib lift stay.
- **No flow noise on the leaflets or the cane marks.** It hardly showed on marks this small, and
  it cost a third of their drying. The cups keep theirs.
- `petal` and `leafletBlade` read their fixed profile values from small tables (`FAN`, `RIM`,
  `TOOTH_T`, `TOOTH_P`). The points are the same.

Old: 24 layers, about 780 kpx. New: 8 big layers (6 leaf, 1 mark, 1 fallen) plus about 70 small
rose layers, about 340 kpx.

## Numbers
`paintSprite` on the main thread, growth 1, 1.6×, seeds 1–8, rounds interleaved. The old code
was served from a copy in the same page, in the same run. Median (p90) in ms:

| run | rose old | rose new | oleander | yamabuki | caper |
|---|---|---|---|---|---|
| final, quiet (6 rounds) | 71.9 (79.0) | **36.8 (42.8)** | 97.7 | 47.0 | 26.3 |
| final, loaded (6 rounds) | 80.6 (113) | 43.2 (61.6) | 106.5 | 53.6 | 31.5 |
| before the flow cut (4 rounds) | 72.6 (77.7) | 43.4 (46.8) | 98.2 | 46.4 | 26.5 |

New / old is 0.51–0.54. The rose now costs less than the yamabuki and about a third of the
oleander. Scaled to the audit's 125 ms, that is about 64–67 ms.

## Pixels (art review)
Shots are in `artifacts/z11/` (not committed). Mean change in levels, and the share of pixels
changing by more than 12:
- Sprites at 4× (close-view resolution), seeds 1–6 at full growth: 1.39–2.05 / 3.4–5.5 %.
  Growth steps 4…22 of seed 1: 0.01 / 0 % (step 4), then 1.15 / 3.3 % up to 2.16 / 6.1 %. See
  `sprites-old-top-new-bottom-r4.png` (old on top, new below; seeds 1–6, then steps 4, 8, 12, 16,
  18, 20 and 22).
- Studio `species-damask-rose`, the growth cards: 0.83 / 1.9 % (the whole page 0.24 / 0.5 %).
  See `before/` and `after/studio-species-damask-rose-1440x900.png` and `compare-studio.png`.
- Oasis at noon, close view on a seeded rose on `plot-3` (`close.mjs`): the whole frame
  0.32 / 1.0 %, the plant's crop 2.46 / 7.4 % (`before-`/`after-oasis-close-1440x900.png`, side
  by side in `compare-close.png`).

It reads the same: a loose mound of arching prickly canes with grey-green toothed leaflets,
ruffled pink cups with a gold eye in some, and buds in feathery sepals. It is still clearly apart
from the oleander. The differences you can see:
- where a cane crosses its own band's leaves it no longer darkens under them, so the canes are a
  shade softer low in the mound;
- leaflet edges are a little crisper (one fill, not two), and their tone a touch flatter;
- the cups are the same; the flow mottling in them is drawn in other places.

## Tests
- `species/damask-rose` (`shrubSuite`, pose continuity, inside the box, mound, leaves, clusters,
  growth order, range): 9 of 9 pass. The pose is unchanged, so no expectation moved. The box test
  is pure (pose only) and is not affected by the paint cost.
- `npm run typecheck` passes.

## Left open
- The leaflet layers are now most of the cost (6 layers, about 225 kpx, with the canes). Folding
  each band's two leaflet groups into one layer would save about another 6 ms. It would also lose
  the edges between neighbouring leaflets, which show in the close view, so it needs its own
  review.
- The close view frames the rose at the left edge of the frame (`focusPlant` on `plot-3`). A
  closer zoom would show the petals better.
- Scripts used (`bench.ts`, `run.mjs`, `prof.mjs`, `close.mjs`, `diff.py`, `crop.py`, the old copy
  in `old/`) are in `artifacts/z11/` and are not committed.

## Index rows
`| 153 | [Z11: Damask rose sprite batched](153-damask-rose-batched.md) | Each rose in small layers, canes dry with their band's leaves, one cane mark layer, no flow on leaflets: 72 → 37 ms (0.51×); art review passed |`

`| Z11.1 | Damask rose batched: deterministic, varies by seed, grows continuously, stays in its box (roses in their own small layers, canes in the leaf layer) | unit: src/plants/species/damask-rose.test.ts | studio › species-damask-rose | ✔ |`
