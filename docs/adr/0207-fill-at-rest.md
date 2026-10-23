# ADR 0207 — Fill at rest: ink crops, a device-resolution light plate, and an honest frame cost

- Status: accepted
- Date: 2026-10-23
- Decided by: performance, Q3 (devlog 28)

## Context
Devlog 22 reported 20–47 ms of main-thread work per frame at rest at 2.6× (30 plants, desktop
DPR 2, headless Chromium) against ~1 ms at the overview, read from `frameStats().workAvg`. The
headless browser draws canvases with a CPU rasteriser, on the main thread, when Chromium flushes
the canvas. That flush can come during the frame callback or after it. In the base build it came
after the callback at the overview, so `workAvg` left it out. At 2.6× it came during the
callback, so `workAvg` counted it. The whole main-thread time per frame (CDP `TaskDuration`) was
~31–37 ms at the overview and ~43–46 ms at 2.6×. The zoomed view cost ~1.3–1.4× the overview,
not 20×. With a GPU rasteriser (`--use-angle=metal`) both cost ~1.5–2 ms and run at 60 fps.

Per-layer raster cost (each draw flushed and timed, CPU) showed where the time went. The light
plate took 17–30 ms at both zooms: a low-resolution image resampled to 2824×1584 and multiplied.
The plants took 13 ms at the overview and 17 ms at 2.6×. The rest was water, scene sprites, the
paper and the background. The plants' cost was fill: a sprite box is about half bare paper. The
bend slices, the sway skew and the source type (worker `ImageBitmap` or canvas) made no difference.

## Decision
- **Sprites carry their ink** (`bounds.ink`: every pixel with alpha > 0, padded 2 px). Finished
  plants, single-step seedlings and rim masks blit only the ink, with the same mapping and through
  the same bend slices. Slices that miss the ink are skipped. A rim mask is cut from its sprite's
  own pixels, so the sprite's ink holds it.
- **The light plate at device resolution while the view rests** (`device-plate.ts`). When the same
  plate (`cast.version()`, the detail rect and the paper strips) is drawn through the same
  transform on the same canvas size two frames running, it is resampled once into a frame-sized
  buffer and laid 1:1 with the lighting's own compositing and alpha. Any change draws directly
  again, so glides cost what they did. The cost is one frame-sized buffer (~18 MB at desktop
  DPR 2).
- **Measure whole main-thread time.** The rest-cost guard compares CDP `TaskDuration` per frame at
  2.6× with the overview's on the same page (≤ 1.75×). Two unit tests count fill: plant blits ≤
  their ink share, and the plate is blitted 1:1 at rest and rebuilt only on change.

## Consequences
- Pixels are not bit-identical. On a frozen frame at noon, sunset and night, at 1× and 2.6×,
  about 1–6 % of channels differ by at most ~4 levels: the 8-bit rounding of the resampled plate.
  Below 0.012 % of channels differ by up to 11 levels, on hairlines through plants: Skia rounds the
  sampling phase of a cropped source rect differently. Mean |Δ| ≤ 0.064 levels, nothing visible.
- CPU rasteriser, desktop DPR 2, 30 plants: overview ~31–37 → ~23–31 ms per frame, 2.6× rest
  ~43–46 → ~31–33 ms. GPU: ~2 ms at both. Below 8 ms on a CPU rasteriser would need fewer
  full-frame passes: the paper multiply and the background blit are ~5 ms together, the night's
  saturation glaze more.
- Where Chromium flushes moved: at the overview the raster now often lands in the lighting draw,
  so `workAvg` and the ambience's own `ms` read high at DPR 2 on a CPU rasteriser. That is
  accounting, not new work; render.md says so.
