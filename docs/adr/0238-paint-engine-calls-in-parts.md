# ADR 0238 — The paint engine's long calls in parts

- Status: accepted
- Date: 2026-10-24
- Amends: ADR 0226 (scene paint steps in parts), which left single engine calls whole; ADR 0020–0022 (the wet layer and its drying pass), cost only

## Context
Since ADR 0226 the scene painter pauses between painter calls, but one call still ran without a
pause. The longest were the drying pass of a big wet layer (the meadow and its grass, the
margins: 103–139 ms at 1× at load on a busy laptop), the pond's `waterBody` recipe (84–100 ms in
the detail repaint), the sky and bank `wetInWet` washes, and a boulder's `stone` (34–42 ms). The
cooperative painter's slice is 20 ms, so each was a long task.

## Decision
- **Parts forms.** The long engine calls get generator forms, `PaintParts`
  (`Generator<void, T, undefined>`), that paint one part per `next()`:
  - `WetLayer.dryParts`;
  - `washParts`, `glazeParts`, `wetInWetParts`, `liftParts` and `rippleParts` (`primitives.ts`);
  - `stoneParts`, `waterBodyParts` and `foliageClumpParts` (`recipes.ts`);
  - `Painter.parts.*`, which exposes the long ones.

  A recipe pauses after each layered fill (or dab, blotch, band, bloom, fade front, streak or
  ripple line) and inside its drying passes. **The one-call forms are `drain(parts)`**, so every
  other caller (plant sprites in the worker, the studio, effects) runs the same code and paints
  exactly as before.
- **The drying pass in row bands, paused, not split.** `dryPixelsParts` runs the same passes over
  one buffer: the wet edge, the edge blur's halving, its box-blur passes and upsampling, and the
  pigment. It pauses after every band of `DRY_BAND` (64 k) pixels of whole rows. Nothing is
  computed per band in isolation. The box blur's running column sum carries over from band to
  band, and a pass starts only once the pass it reads has finished. So there are no band edges
  for a neighbourhood operation to cross, and the result is the whole-buffer pass, byte for byte.
  The pixel read, the write-back and the composite each stay one canvas call (`dryParts` pauses
  between them). A composite in bands would resample differently at the seams, and reads in
  bands would change the recorded canvas calls for no gain.
- **`WetLayer.flush()`.** Chromium records canvas calls and rasterises them at the next pixel read.
  The meadow fills one layer over 17 rows of parts, so all of its fills were rasterised in the
  drying pass's read: ~50 ms at load, after the bands had made the pass itself cheap. `flush()`
  reads one pixel, so the marks laid so far are rasterised in the part that laid them. The meadow
  and its grass flush before each row's pause. It changes no pixel.
- **The scene `yield*`s the parts forms** in the sky, hills, banks, path, pond reserve, water,
  reflections, stones, trees, shrubs, pavilion, meadow, grass, margins and boulder sprites.
  `reservePond` and `paintWater` became generators. `background.ts` and `system.ts` are unchanged.

### Rejected
- **Drying each band separately** (read, dry and composite a strip at a time). The edge blur and the
  flow reach across strips, so the strips would need overlaps and two-pass handling for each blur.
  The composite would also seam. The paused whole-buffer pass costs the same and is exact.
- **Time-based pauses** (yield when 20 ms have passed). The parts are fixed by the data, so the tests
  can count them, and the cooperative painter already checks its clock after every part.
- **Flushing after every fill.** That is one extra read per fill in every wash of every plant
  sprite. Only a layer filled over many parts needs it.

## Consequences
- Chromium, 1440×900 @2, the paint job driven part by part, old and new interleaved in one page,
  three runs each, load average ~6 (devlog 50):

  | view | longest part before | after |
  |---|---|---|
  | load | 76–87 ms | 11–12 ms |
  | close views | 53–55 ms and 23–24 ms | 9–10 ms and 6–7 ms |

  CPU is unchanged (0.98–1.17 s → 0.99–1.09 s at load). The canvas and all 17 sprites hash the
  same, pixel for pixel. In the app at 1× the longest part is 15–18 ms at load (was 69–146) and
  11–14 ms in the detail repaint (was 49–52). At 4× it is 65 and 49 ms (was 308 and 197).
- On the recording canvas, the canvas calls are the same, except for the meadow's one-pixel flush
  reads. With those reads left out of the hash, the old overview and close-view hashes match. The
  two views that show the meadow were re-pinned.
- A layer filled across parts should `flush()` before each pause. A long new recipe should come with
  a parts form and a one-call `drain` wrapper.
- What still paints in one part: a row of meadow cells, the margins' field grid and fill (scene
  code), grass tufts, ripple lines and a foreground tuft sprite (`paintTuftSprite`, called from
  `background.ts`). Each is ≤ ~18 ms at 1× on a busy laptop. The sky-light plates (`paint-sky.ts`)
  are painted outside the scene job and still call the one-call forms.
