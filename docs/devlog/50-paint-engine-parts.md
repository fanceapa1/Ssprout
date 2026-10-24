# 50 — P23: the paint engine's long calls in parts

P6 (devlog 46, ADR 0226) let the scene painter pause between painter calls. The longest parts
left were single engine calls: the meadow's drying pass (103–139 ms at 1× at load), the pond's
`waterBody` (84–100 ms in the detail repaint), the sky and bank washes, a boulder's `stone`.

**What changed** (ADR 0238):
- `wet.ts`:
  - `PaintParts` (a generator that paints a part per `next()`) and `drain`.
  - `dryPixelsParts`, `edgeBlurParts`, `boxBlurParts`: the drying pass's row loops, paused after
    every `DRY_BAND` (64 k) pixels of rows. The box blur's column sums carry over between bands,
    and each pass waits for the pass it reads, so the output is the whole pass's, byte for byte.
  - `WetLayer.dryParts` pauses after the read, inside the passes, and after the write-back.
  - `WetLayer.flush()` reads one pixel, so the browser rasterises the marks laid so far.
  - `dryPixels`, `edgeBlur`, `boxBlur` and `dry` drain the parts forms.
- `primitives.ts`: `washParts`, `glazeParts`, `wetInWetParts`, `liftParts`, `rippleParts`. They pause
  after each fill, bloom, fade front or line, and inside the drying pass.
- `recipes.ts`: `stoneParts`, `waterBodyParts`, `foliageClumpParts`.
- `index.ts`: `Painter.parts` (`wash`, `glaze`, `wetInWet`, `lift`, `stone`, `waterBody`,
  `foliageClump`). Every one-call form drains its parts form, so plant sprites, the studio and
  effects run the same code.
- Scene: `paint-land`, `paint-pond`, `paint-ground`, `paint-pavilion`, `paint-trees` and `sprites.ts`
  `yield*` the parts forms. `reservePond` and `paintWater` became generators (`background.ts` already
  accepted a generator from any step). The meadow and its grass `flush()` before each row's pause.
  `background.ts` and `system.ts` are untouched (P8).
- No new studio entry: no new primitive, the same paintings.

**Why the flush.** With the bands in place the meadow still had a 51 ms part. It was the drying
pass's `getImageData`: Chromium records canvas calls and rasterises them at the next read, so all
17 rows of patches were rasterised there (the 1×1 read timings showed 3–12 ms per row). Flushing
before each pause moves each row's raster into its own part.

**Parity.**
- Pins first (commit "pin the drying pass and the long recipes…"). `paint/parts.test.ts` pins:
  - the drying pass's output, a hash of every byte, for six buffers covering every branch;
  - the canvas calls of each long recipe on the recording canvas (`foliageClump` pinned from the
    previous `recipes.ts`).
- All are unchanged after the change, one-call and in parts. The scene's pinned call hashes
  (`paint-slices.test.ts`) were unchanged until the flush. The flush adds one-pixel reads to the
  two views that show the meadow. With 1×1 reads skipped by the recorder (a one-off local check),
  the old overview and close-view hashes still matched. Those two were re-pinned; the trunk view
  is unchanged.
- In Chromium (dev server, the job driven part by part, the old `src` served from a copy next to
  the new one in one page), the painted canvas and all 17 sprites hash identically:

  | view | hash |
  |---|---|
  | load | `1407a362` |
  | close views | `41476053`, `49a1b497` |

**Measured** (Chromium, 1440×900 @2, `p23-ab.mjs`: old and new interleaved, three runs each, load
average ~6). Longest uninterrupted part, before → after:
| view | before | after | CPU before → after |
|---|---|---|---|
| load (world @1.5) | 76–87 ms (meadow drying pass), water 40–42 | 11–12 ms (a row of meadow cells, the margins) | 0.98–1.17 s → 0.99–1.09 s |
| close view: near meadow, big boulder (@2.8) | 53–55 ms (`waterBody`) | 9–10 ms (water) | 0.69–0.71 s → 0.69–0.72 s |
| close view: big tree trunk (@2.8) | 23–24 ms (a boulder's stone) | 6–7 ms (margins) | 0.71–0.75 s → 0.70–0.75 s |

An earlier run at load average ~7–9 gave 117–139 → 18–20 ms at load and 86–96 → 14–15 ms in the
first close view (before the foliage clumps were split, the big tree view was 33–41 → 20–22 ms).

In the app (production build to a scratch `outDir`, `vite preview` on :4329, `p23-app.mjs`:
`sceneStats().longest` and `sceneDetail().longest` after a zoom-3 rest):

| | at load | detail repaint |
|---|---|---|
| 1× | 69–146 ms (meadow) → 15–18 ms | 49–52 ms (water) → 11–14 ms |
| 4× throttle | 308 → 65 ms | 197 → 49 ms |

The app's summed CPU per paint varied from 0.97 to 1.64 s across runs for both builds on the
loaded machine. The interleaved in-page comparison above shows no difference.

**Tests:**
- `paint/parts.test.ts` (32 tests):
  - the drying pass and the recipes, pinned;
  - every band size (down to one row) equals the whole buffer, byte for byte;
  - the blurs in bands equal the whole ones;
  - `dryParts` = `dry`, in many parts;
  - `flush` is one one-pixel read;
  - each recipe in parts paints the pinned calls, in more than 8 parts, with no part over a
    quarter of the calls or reading more than one layer.
- `scene/paint-slices.test.ts`:
  - per-part bound tightened from 320 k calls / 0.9 Mpx to 130 k / 0.4 Mpx;
  - water, pond reserve, boulders and the big tree come in many parts;
  - no part dries more than one wet layer, except grass tufts and ripple lines.
- TESTING row P23.1.
- The full run (typecheck, unit, e2e) is in the report below.

**Left open**
- **Still one part each** (≤ ~18 ms at 1× on a busy laptop, 50–65 ms at 4×):
  - a row of meadow cells and the margins' field grid and fill (scene code in `paint-ground.ts`
    and `paint-land.ts`; they could pause per cell or per band of grid rows);
  - a foreground tuft sprite, painted in one call from `background.ts` (P8's file);
  - grass tufts and ripple lines.
- **The sky-light plates** (`paint-sky.ts`, `sky-light.ts`) are painted outside the scene job and
  still use the one-call forms. P18 could `yield*` the parts there if they become long tasks.
- **The read, write-back and composite of a big layer** stay one canvas call each. The biggest,
  the grass layer's read, took ~15 ms at load on the loaded machine.
- Not re-measured with P0a's `flow.mjs` (frames after the Begin rest).
- Probe scripts (not in the repo) are in `scratchpad/perf/`:
  - `p23-ab.mjs`: old and new in one page, with pixel hashes;
  - `p23-seq.mjs` and `p23-io.mjs`: part sequences of a step, and slow canvas reads and writes;
  - `p23-app.mjs` and `p23-app-ab.mjs`: the app's `longest` at 1× and 4×.
