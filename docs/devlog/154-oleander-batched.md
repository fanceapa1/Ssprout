# 154: Oleander sprite batched (Z12)

## What
The oleander was the slowest common sprite left after Z10 and Z11 (103 ms in the phase 14 audit,
about 98 ms in devlog 153's quiet bench). It now paints in about 0.53× the time of the old code.
Only `src/plants/species/oleander.ts` and `src/plants/lib/oleander-paint.ts` changed. No shared
helper was edited (`ribbonInto` is only imported, as before). The pose is unchanged.

## Where the time went
Profiled on the main thread in headless Chromium against the dev server, growth 1, 1.6×, seeds
1–8, the same method as devlog 153 (`WetLayer.dry` wrapped with a one-pixel flush first, and a CDP
CPU profile for the self and inclusive time). Old code, per sprite:
- 24 wet layers, about 1,230 kpx in all. Every one of them covered nearly the whole plant.
- The stems: 3 body layers (multiply) and 3 accent layers over the same area, 460 kpx, about
  33 ms of drying.
- The leaves: 6 layers (two groups per band), 364 kpx, about 31 ms, each leaf in two fills.
- The flowers: 12 layers (buds, two petal sets and the throats per band), 406 kpx, about 35 ms.
  Each covered every flower of its band, so mostly empty paper.
- The rest (about a third) was fills and shapes: about 2,900 fills per sprite for the flowers
  alone, 15 of them per throat.

## What changed
- **The stems dry with their band's leaves.** Their strokes go into the band's first leaf layer
  before the leaves (`stemInto`), and their broken dark side with them. The stem layers and the
  accent layers are gone (460 kpx). Fine stems (the flower stalks) take one plain fill.
- **Each flower's marks take small layers of their own**: each bud, each pinwheel's petals, each
  throat. The order is the old one: the buds, then every other flower's petals, then the rest,
  then the throats: 406 → 108 kpx in about 200 small layers (about 20 µs each).
- **Leaves take one fill each** (the plain and the deformed fill folded into one at the combined
  strength). The shaded half and the lifted midrib stay.
- **No flow noise** on the leaves, the buds, the petals or the throats. On marks this small the
  noise grid runs at its finest step: it was half the petals' drying and hardly showed.
- A throat's five streaks and ten corona threads are two path fills, not fifteen.

Old: 24 layers, about 1,230 kpx. New: 6 leaf layers (with the stems) of about 404 kpx, plus about
200 small flower layers of about 108 kpx.

## Numbers
`paintSprite` on the main thread, growth 1, 1.6×, seeds 1–8, rounds interleaved. The old code
was served from a copy in the same page, in the same run. Median (p90) in ms:

| run | oleander old | oleander new | damask rose | yamabuki | caper |
|---|---|---|---|---|---|
| final, quiet (6 rounds) | 90.2 (112.7) | **48.0 (48.7)** | 36.8 | 45.9 | 25.7 |
| final, loaded (4 rounds) | 93.9 (94.7) | 48.4 (48.8) | 37.5 | 46.6 | 26.7 |
| stems folded, flowers split, flows kept on petals (loaded) | 104.2 | 62.8 | 43.6 | 57.8 | 33.5 |

New / old is 0.52–0.53 (0.60 before the petal flow and the throat fills went). The rose matches
devlog 153's quiet run (36.8 ms), so these runs are comparable with it. Scaled to the audit's
103 ms, that is about 55 ms. Drying per sprite: about 30 ms (leaves 19, petals 7, buds and
throats 4) where it was about 99.

## Pixels (art review)
Shots are in `artifacts/z12/` (not committed). Mean change in levels, and the share of pixels
changing by more than 12:
- Sprites at 4× (close-view resolution), seeds 1–6 at full growth: 2.97–4.09 / 6.3–9.1 %.
  Growth steps 4…22 of seed 1: 0 / 0 % (step 4), 0.72 / 1.4 % (step 8), then 2.45 / 5.1 % up to
  2.97 / 6.6 %. See `sprites-old-top-new-bottom-r4.png` (old on top, new below; seeds 1–6, then
  steps 4, 8, 12, 16, 18, 20 and 22), `cmp-s1-4.png` (seeds 1–4, smaller) and `cmp-base.png`
  (the crown, 2×).
- Studio `species-oleander`, the growth cards (not the animated one): 1.46 / 3.8 % for growth
  0.1–0.8, 3.21 / 8.1 % for growth 1 (the whole page 0.45 / 1.2 %). See `before/` and
  `after/studio-species-oleander-1440x900.png` and `compare-studio.png`.
- Oasis at noon, close view on an oleander (seed 1077) on `oued-1`: the whole frame 0.40 / 0.8 %,
  the plant's crop 3.81 / 8.0 % (`before-`/`after/oasis-close-1440x900.png`, side by side in
  `compare-close.png`).

It reads the same: an upright fountain of stems from a narrow crown, narrow dark leathery knife
leaves in whorls, pink pinwheel clusters at the tips with pale mouths, and twisted buds. It stays
clearly apart from the Damask rose (arching prickly canes, toothed leaflets, ruffled cups). The
differences you can see:
- the stems no longer multiply over the leaves and stems of the bands behind them, so the dark
  crossings low in the crown are gone. The stems are a shade deeper to make up for it
  (`shade(…, 0.2)`) and their broken dark side is darker (`mix(BARK, sumi, 0.65)` at 0.85, laid
  in the layer instead of multiplied over it), but the crown is a little softer and more even;
- leaf edges are a little crisper (one fill, not two) and the leaves a touch flatter in tone;
- the flowers are the same; where two flowers of one set overlap they now keep both edges.

The numbers are higher than the rose's (devlog 153), almost all of it from the stem crossings and
the leaves' flow and fill. I judged them within "slight"; the owner may want to look at
`cmp-base.png`.

## Tests
- `species/oleander` (`shrubSuite`, growth continuity, inside the box (16 seeds), fountain,
  whorls, clusters, growth order): 9 of 9 pass, about 5 s. The box test is pure (pose only) and is
  not affected by the paint cost.
- `npm run typecheck` passes.

## Left open
- The leaf layers are now most of the cost (6 layers, about 404 kpx, 19 ms). Merging each band's
  two groups would halve that but lose the edges between leaves of a whorl, which carry the look.
- The group-0 leaf layer reaches down to the ground for the stems (about 40 kpx more than the
  leaves alone); stems could go into a small layer of their own below the lowest whorl.
- Scripts used (`bench.ts`, `bench.html`, `run.mjs`, `prof.mjs`, `diff.py`, the old copy in
  `old/`) are in `artifacts/z12/` and are not committed. The close view is
  `npm run shots -- --eval "…showScenery('oasis'); setState({ … oleander on oued-1, seed 1077 });
  setTime('noon'); plants.settle(); camera.focusPlant('p', { animate: false }); camera.settle()"`.

## Index rows
`| 154 | [Z12: Oleander sprite batched](154-oleander-batched.md) | Stems dry with their band's leaves, each bud, pinwheel and throat in a small layer, no flow on leaves or flowers: 90 → 48 ms (0.53×); art review passed |`

`| Z12.1 | Oleander batched: deterministic, varies by seed, grows continuously, stays in its box (stems in the leaf layer, flowers in their own small layers) | unit: src/plants/species/oleander.test.ts | studio › species-oleander | ✔ |`
