# 151: Alfalfa sprite batched (Z10)

## What
The alfalfa was the slowest sprite in the phase 14 audit (246 ms, measured under load). It now
paints in about 0.47× the time of the old code. Only `src/plants/species/alfalfa.ts` and
`src/plants/lib/alfalfa-paint.ts` changed. No shared helper was edited.

## Where the time went
Profiled on the main thread in headless Chromium against the dev server, growth 1, 1.6×, seeds
1–8. The painter's methods were wrapped and the drying pass timed per layer. Old code, per sprite
(about 53 ms on a quiet machine):
- 1,869 `dabInto` marks, 24 ms of JS. Of these, 830 were the leaflets' tooth dabs (8–10 ms) and 326
  were midribs (4–5 ms). Each mark is a deformed polygon, and most are a pixel or two across at
  1.6×.
- 6 band layers (leaves and flowers per depth band) over the whole design box: 13–16 ms. Of
  that, 8 ms is the read that rasterises all those fills.
- 29 stems and stalks as their own `stroke`, each with its own layer and drying, plus 15.6 stem
  ink lines at 2.5 % opacity: 9–10 ms.
- The soil wash and the ground glaze: 4 ms.

## What changed
- **Teeth, midribs, petioles and keels** are plain fills, not deformed dabs. Each is a small
  four-point spindle (or an ellipse for a keel). A leaf's teeth go in one fill, and so do its
  midribs.
- **Stems and stalks are laid into their band's leaf layer** before the leaves (`stemInto`, a
  local copy of `paintStem`'s wet stroke, at 1.3× the stroke's strength relative to the layer so
  they read as before). They no longer get their own layer, so 29 drying passes go.
- **The stems' ink line is dropped.** At 2.5 % opacity it did not show.
- **One flower layer over all three bands**, not one per band. Each cluster keeps its band's
  strength through `globalAlpha` and its own rng fork, so the florets have the same shapes as
  before. Clusters sit at the stem tips, above the leaves, so the change in overlap hardly shows.
- **Leaflets** take one fill each instead of two, with no base pool. The flank pool stays.
- **The soil wash** takes 6 layers instead of 16 (it is a 10 % film).

Old: 6 big layers and about 48 small ones. New: 4 big layers and about 5 small ones (the pods and
the two ground washes). `dabInto` calls: 1,869 → 522.

## Numbers
The same harness: `paintSprite` on the main thread, growth 1, 1.6×, seeds 1–8, 6 rounds
interleaved. The old code was served next to the new from a copy, in the same page and the same
run. Median (p90) in ms:

| run (load) | alfalfa old | alfalfa new | white clover | spearmint | caper |
|---|---|---|---|---|---|
| final (~5) | 48.4 (58.9) | **22.6 (26.6)** | 24.7 | 50.2 | 25.2 |
| before the last two cuts (~12) | 48.5 (59.0) | 24.0 (28.3) | 24.4 | 50.4 | 26.6 |
| a loaded run (~13) | 80.7 (97.6) | 43.3 (54.3) | 42.9 | 87.5 | 45.1 |

New / old is 0.45–0.54, and the alfalfa now costs about what the white clover and the caper do.
On this machine both versions run well under 100 ms. Scaled to the audit's 246 ms, the ratio
gives about 110–115 ms, **a little short of the "< 100 ms" target**. What is left is the
leaflets' and florets' dabs (about 520 per sprite, 7 ms) and the 4 big layers' read and drying
(10 ms). Z13 (drying skips empty tiles) would cut the drying part.

## Pixels (art review)
Shots are in `artifacts/z10/` (not committed). Mean change in levels, and the share of pixels
changing by more than 12:
- Sprites at 4× (close-view resolution), seeds 1–6 at full growth: 2.4–2.9 / 7.4–9.3 %. Growth
  steps 4…22 of seed 1: 0.14 / 0.4 % (step 4) up to 2.45 / 7.7 %. See
  `sprites-old-top-new-bottom-r4.png` (old on top, new below; seeds 1–6, then steps 4, 8, 12, 16,
  18, 20 and 22).
- Studio `species-alfalfa`, the five growth cards: 1.51 / 5.3 % (`before-studio-1440x900.png`,
  `after-studio-1440x900.png`).
- Oasis at noon, close view on `walk-1` (seeded, `close.sh`): the whole frame 0.55 / 1.9 %, the
  plant's crop 2.62 / 8.8 % (`before-`/`after-oasis-close-1440x900.png`, side by side in
  `compare-close.png`).

It reads the same: an upright green tuft of trefoils with violet clusters at the tips, the coiled
pods and the pale earth. It stays distinct from the white clover, whose low mat and white pompoms
did not change. The differences you can see:
- the stems are a shade softer low in the clump, where the leaves now share their wet layer;
- the clusters are a touch paler at the back;
- the leaflets' edges are a little crisper (one fill, not two).

## Tests
- `species/alfalfa` (`smallSuite`): determinism, seed variety, and growth continuity over 200
  steps all pass. The recording painter has no `env`, so `stemInto` falls back to no wobble noise
  there.
- The stems are now `layer.fill` calls with no rng option, so the continuity check no longer keys
  them. Their geometry is unchanged (the same `subPath` growth that was tested), and the
  trefoils, clusters and pods are still checked. The suite has no recording or pixel pins to
  retake.
- `npm run typecheck` passes.

## Left open
- About 1.1–1.2× of the target if the audit's load is assumed. The next cut would be a cheaper
  leaflet outline (fewer vertices than `dabOutline`). That shows in the close view, so it needs
  its own review.
- Scripts used (`bench.mjs`, `sheet.mjs`, `close.sh`, the old copy in `old/`) are in
  `artifacts/z10/` and are not committed.

## Index rows
`| 151 | [Z10: Alfalfa sprite batched](151-alfalfa-batched.md) | Stems dry with their band's leaves, one flower layer, teeth, midribs and keels as plain fills: 48 → 23 ms (0.47×), about the white clover's; art review passed |`

`| Z10.1 | Alfalfa batched: deterministic, varies by seed, grows continuously (stems in the leaf layer, one flower layer) | unit: src/plants/species/alfalfa.test.ts | studio › species-alfalfa | ✔ |`
