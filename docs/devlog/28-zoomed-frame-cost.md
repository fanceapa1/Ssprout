# 28 — Q3: frame cost at rest while zoomed in

ADR 0207 · docs/systems/{plants,ambience,render,camera}.md

## What
- **Measured first.** Desktop 1440×900 DPR 2, 30 plants, noon, 2.6× at (500, 640), headless
  Chromium. Each sample was 120 frames, run back to back against a base build of `main`. The
  machine was shared with another agent, so loads varied and ranges are given.
  - `workAvg` (the frame callback) does not measure a CPU rasteriser's cost. The canvas is
    rasterised on the main thread when Chromium flushes it, and that is often after the callback.
    The whole main-thread time per frame (CDP `TaskDuration`) is what counts.
  - Base: overview ~31–37 ms, 2.6× ~43–46 ms. The zoomed view cost ~1.4× the overview, not 20×.
  - GPU raster (`channel: 'chromium'`, `--use-angle=metal --enable-gpu-rasterization`): ~1.5–2 ms
    at both, 60 fps. So "zoomed is slow" was mostly a headless CPU-rasteriser effect plus a metric
    that reads raster only sometimes.
  - Per-layer raster (each draw flushed and timed): the light plate 17–30 ms at any zoom, the
    plants 13 → 17 ms. Turning off the sway, the slices, the shadows or the reflections changed
    nothing. Nearest-neighbour sampling and main-thread copies of the bitmaps changed nothing
    either. The plants' cost is fill, and half of every sprite box is bare.
- **Ink crop** (`perf(plants)`): sprites carry their ink rect. Plants and rim masks blit only that
  part, through the same slices. Plants' raster at 2.6×: 17.4 → 9.2 ms (overview 13.7 → 8.7).
- **Resting light plate at device resolution** (`perf(ambience)`): resampled once into a
  frame-sized buffer, then laid 1:1. Lighting raster: ~17–30 → ~4 ms at both zooms.
- **Guards**: `plants/system` › a close view blits only the painted part (fill ÷ box area 0.44;
  1.0 without the crop). `ambience/device-plate.test.ts` checks the 1:1 blit at rest and the
  rebuild only on a change. `camera · cost at rest` (e2e) checks that the 2.6× main-thread
  time per frame is ≤ 1.75 × the overview's (measured 1.0–1.5).

## Numbers (CPU rasteriser, main-thread ms per frame, raster included)
| | base | after |
|---|---|---|
| overview | 31–37 | 23–31 |
| 2.6× rest | 43–46 | 31–33 |
| GPU, both | 1.4–1.9 | 1.5–2.2 (60 fps) |
The glide e2e still passes (work avg 1.4 ms).

## Pixels
A frozen frame was compared with the base build: reduced motion, fauna and water muted, noon,
sunset and night at 2.6×, and noon and sunset at 1×. Max |Δ| ≤ 11 levels on < 0.012 % of
channels: hairlines where a cropped source rect samples at a phase rounded differently.
Max |Δ| ≤ 4 levels on 1–6 % of channels: the plate's 8-bit rounding. Mean |Δ| ≤ 0.064. I looked at
the frame and the diff map, and nothing is visible.

## Left open
- **< 8 ms on a CPU rasteriser is not reached.** What remains at 2.6× is ~25 ms of raster: water
  (sky reflection + shimmer through the pond clip) ~5, plants ~5, scene boulders/tufts ~5,
  plate ~4, paper multiply ~4, fauna ~2.5, reflections ~2, background ~1.3. The paper and the
  background are full-frame passes. Going further would mean merging the plate into the paper at
  rest, or caching the reflected sky like the plate.
- The night's white backing + saturation glaze (ADR 0206) are two more full-frame passes at night,
  costly on a CPU rasteriser. Not measured here.
- At DPR 2 on a CPU rasteriser the overview's flush now lands in the lighting draw, so `workAvg` and
  `sprout.ambience().ms` read ~20–30 ms there. The e2e budgets run at DPR 1 and pass. Real devices
  with GPU canvases are unaffected.
- The growing plant's cross-fade buffer is drawn whole (one plant).
- Full e2e run (2 workers, `nice`): 179 passed, 2 failed. The failures are `calendar.spec.ts:702` (the planned slip on a
  phone, zoomed) and `marks.spec.ts:41` (`.due-when` sprout mark). Both also fail on `main` (6b59647) without these
  changes; they look time-of-day dependent (run at ~17:00). Not touched here.
