# ADR 0349: The drying pass runs only over the painted box and the blur's reach, bit for bit

- Status: accepted
- Date: 2026-11-12
- Amends: ADR 0238 (paint calls in parts), for `dryPixelsParts`

## Context
Devlogs 147, 151 and 153 found that drying a wet layer costs its area (about 55 µs per 1,000 px)
and that big layers covering mostly empty paper are where the time goes. Z13 asked whether the
drying could skip empty tiles and still give exactly the same bytes.

The drying pass (`dryPixelsParts`) has three passes over the buffer: the wet edge (shaped
coverage `s`), the edge blur (`edgeBlur`: a 2×2 halving, two separable box blurs with running
sums, a bilinear upsampling) and the pigment pass. Where a pixel has no paint (alpha 0), the
pigment pass only writes alpha 0, which it already is. Paper grain and flow are looked up per
painted pixel only. So the output can only differ through the blur values that painted pixels
read.

Tiles do not work bit for bit. The box blur keeps running sums (a float64 per row, a float64
per column). After a mark leaves the window, the sum need not come back to exactly 0, so pixels
right of or below a mark carry a tiny rounding residue into later passes. Skipping a tile in the
middle of a row would change the sums every later pixel of that row reads.

A box works. Left of and above all paint, every value of every pass is an exact 0 and every
running sum stays exactly 0, so starting the sums at the box's corner gives the same numbers. To
the right and below, a pixel's value depends only on values within the blur's reach, so
computing a margin as wide as that reach is enough.

## Decision
- `dryPixelsParts` first finds the **painted box** (every pixel with alpha > 0, also those the
  wet edge shapes to nothing), in bands of rows like every other pass.
- `dryCrop` grows it by the edge blur's whole reach: `2·(2r + 2) + 2` px with the half-resolution
  blur (`r` its rounded half radius, two passes), `2r + 2` px with the full-resolution one, and
  puts its corner on even pixels so the half-resolution grid is the whole buffer's. It is clamped
  to the buffer.
- The wet edge, the edge blur and the pigment pass run over the crop only. The blur takes the
  whole buffer's choice of half or full resolution (`edgeBlurParts`'s new `halve` argument). A
  crop side inside the buffer is closed; a side on the buffer's edge keeps the layer's open side.
- `crop = false` runs the whole buffer, as before, for tests.
- The pixel read (`getImageData`), the write-back and the composite stay whole-layer canvas
  calls, so the recorded canvas calls and every recording pin are unchanged.

### Rejected
- **Tiles** (32 or 64 px). Not bit-identical through the running sums (above). Measured on real
  layers, 32-px tiles dilated by the blur's reach would keep more area than the box on most big
  layers, and less only on a few long thin ones (the meadow, the grass, reflections).
- **A write-back of the crop only** (`putImageData` with a dirty rect). The same pixels, but a
  different canvas call: every recording pin would move. The write-back is 1–2 % of the drying.
- **A box from the marks' geometry** (to read only the crop). A layer's `ctx` takes any canvas
  call, so the engine cannot know where the paint is before reading it.

## Consequences
- Bit-identical: in Chromium, every one of 8,671 real layers (oasis and Japanese-garden cold
  paints, oleander, Damask rose and katsura sprites) dried to the same bytes cropped and whole;
  `dry-crop.test.ts` checks random sparse layers and marks on the edges; every recording pin
  holds.
- The drying pass is 11 % cheaper on the oasis cold paint and 17 % on the Japanese garden and the
  three sprites (devlog 156). Sparse layers gain most (the ksar −24–27 %, tree layers −35–50 %);
  dense ones (the plots, the meadow) about nothing.
- `src/paint/wet.ts` changed, so the paint version changes: every cached painting repaints once,
  to the same pixels.
