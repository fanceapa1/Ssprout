# Paint engine

`src/paint/` — the watercolour engine every scene, plant, creature and effect is painted with.
It turns seeded geometry into marks that read as pigment on washi: irregular wet edges with
pigment pooled at the rim, lighter centres, mottled flow, granulation that sits in the paper
grain, blooms, bleeds, dry brush and tapered sumi lines.

Look at it first: studio → **Paint · primitives**, **Paint · recipes**, **Paint · test
vignettes** (`npm run shots -- --studio paint-vignettes`, or
`/Ssprout/studio.html?entry=paint-vignettes/tree-crown`).

## How it works (one paragraph)
Every primitive builds pure geometry (`geometry.ts`), lays it down as many low-alpha fills into
a private CPU **wet layer** (`wet.ts`) in the target's own coordinates, then calls
`layer.dry()`. The drying pass is per pixel: it sharpens the soft layered coverage into a wet
edge (the *median* layer contour, so edges are organic but not spiky), finds the rim with a
blur (edge − blur), pools pigment there and lifts the centre, modulates density with a flow
noise and with the shared paper grain (granulation, dry brush, edge micro-texture), then
composites onto the target with `multiply` by default — watercolour is subtractive. See
ADR 0020–0022. Open sides (ADR 0126): a `WetLayer` records which of its sides were cut off by the
canvas, and `boxBlur` / `edgeBlur` / `dryPixels` take `OpenSides` so the border value continues
outward there — no false wet edge where a wash simply runs off the canvas. **Flow is a function
of the place** (ADR 0185): its noise is anchored at the layer's own area corner (before clipping)
with an offset drawn in noise units, so a layer cut by the canvas, or painted at another
resolution, mottles exactly like the whole one; the two offsets are drawn from the painter's rng
even for a layer that misses the canvas, so every later layer draws the same numbers whatever part
of the world a painting covers (a camera's detail painting is the overview resolved).

## Pipeline convention (important)
Paint **on white** (or transparent) and multiply `paperTexture` over the finished frame last —
that is exactly what the renderer's `paper` layer does. Lifted or reserved paper is painted
`PAPER_WHITE` (`#fffdf8`) and becomes washi colour once the paper is multiplied. The studio
entries follow the same pipeline (`ground()` + `finish()` in `paint.studio.ts`). ADR 0021.

Sprites (plants, creatures) are painted on transparent canvases; a multiplied wash over
transparency is just its colour at its alpha, so sprites composite normally (`source-over`)
over the background and still receive the paper texture at the end.

## Creating a painter
```ts
import { createPainter, makeCanvas, PIGMENTS } from '../paint';

const canvas = makeCanvas(600, 800);          // OffscreenCanvas if available, else <canvas>
const p = createPainter(canvas, { seed: 42, quality: 'normal' });
p.ctx.setTransform(2, 0, 0, 2, 0, 0);          // draw in your own units; any transform works
p.wash({ cx: 150, cy: 200, rx: 80, ry: 50 }, PIGMENTS.sap);
```
- `createPainter(canvas, opts?)` / `painterFor(ctx, opts?)` (e.g. a renderer layer context).
- `Painter` keeps the original contract (`ctx`, `w`, `h`) and adds `rng`, `quality`, `paper`,
  `env` and the methods below. Species code receives a painter in `SpeciesDef.draw(p, rng, …)`.
- `PainterOptions`: `seed` (fallback rng + flow noise, default 1), `paperSeed` (default 1 —
  keep it shared), `grainScale` (grain texel in device px, default 1), `quality`
  (`'draft' | 'normal' | 'high'`, default `'normal'`).
- **Randomness**: every method takes `rng` in its options. Pass yours (e.g. the species `rng`)
  for stable, per-instance results; otherwise the painter's own stream is consumed in call
  order. No `Math.random` anywhere.
- **Units**: all sizes are in the context's user units (whatever transform is set). Wet-layer
  resolution and grain are in device pixels, so the same call looks right at DPR 1 and 2.
- **Shapes** (`Shape`): a polygon `Pt[]` or an ellipse spec `{ cx, cy, rx, ry, rotation? }`
  (becomes a gently irregular blob). Author shapes at any density — outlines are resampled
  evenly before deformation.

## API reference
All option fields are optional. Every wash-like call also accepts the **drying options**
(`DryOptions`): `opacity` 0.85 · `edge` 0.5 (rim pooling) · `edgeWidth` 2.5 · `sharpness` 0.6 ·
`centreLift` 0.25 · `granulation` 0.2 · `granules` 0 · `speckle` 0 · `flow` 0.35 ·
`flowScale` 40 · `dry` 0 · `darken` 0.3 · `blend` `'multiply'`. (Defaults shown are
`DRY_DEFAULTS`; each primitive overrides some, see below.)

### `wash(shape, pigment, opts)` — wet-edge wash
The workhorse. `layers` 16 · `deform` 0.3 (outline wander) · `spread` 0.15 (layer wander) ·
`coverage` 0.9 · `jitter` 0.025 · `fade` (angle or `{ angle, start 0.45, amount 1, ragged 0.6 }`
→ lost edge toward `angle`) · `blooms` 0 · `bloomSize` 0.16 · `drops` (wet-in-wet blotches:
`[{ pigment, at?, size? 0.3, alpha? 0.6 }]`).
```ts
p.wash(bank, PIGMENTS.sageLight, { opacity: 0.6, fade: { angle: Math.PI / 2, start: 0.6 } });
p.wash(pad, PIGMENTS.sap, { blooms: 1 });                       // a cauliflower backrun
p.wash(rock, PIGMENTS.stone, { drops: [{ pigment: PIGMENTS.sage, size: 0.35 }] });
```

### `glaze(shape, pigment, opts)` — transparent tint
Soft edges, almost no pooling, opacity 0.35, multiplied. Shadows (use `shade(p)`), warm
light, unifying a passage. `fade` makes it die away.
```ts
p.glaze(underside, shade(PIGMENTS.stone, 0.3), { fade: -Math.PI / 2, opacity: 0.4 });
```

### `wetInWet(shape, a, b, opts)` — two pigments bleeding
`angle` (from `a` toward `b`, default π/2 = `b` below) · `split` 0.5 · `softness` 0.3 ·
`fingers` 0.5, plus wash options.
```ts
p.wetInWet(stone, PIGMENTS.stone, PIGMENTS.sage, { angle: -Math.PI / 2, split: 0.75 });
p.wetInWet(sky, lighten(PIGMENTS.bellflower, 0.5), PIGMENTS.washiDeep, { opacity: 0.35, edge: 0.15 });
```

### `granulate(shape, pigment, opts)` — settled granules
`strength` 0.6. Clustered speckle in the paper's valleys, soft-edged; lay over a wash of the
same family. Cheaper alternative inside a wash: the `granules` drying option.

### `dab(at, pigment, opts)` — one brush dab
Base at `at`. `variant` `'leaf' | 'petal' | 'blade' | 'needle' | 'round'` · `angle` −π/2 (up) ·
`length` 22 · `width` length × 0.42 · `curve` 0 · `asym` random ±0.25 · `pool` 0.5 (flank) ·
`poolSide` random ±1 · `basePool` 0.3 · `layers` 4 · `jitter` 0.03.
```ts
p.dab(node, PIGMENTS.sage, { angle: -0.6, length: 26, curve: 0.2 });                  // leaf
p.dab(centre, PIGMENTS.sakura, { variant: 'petal', angle: a, length: 18, blend: 'source-over' });
```
`p.dabInto(layer, at, pigment, opts)` paints a dab into an open layer without drying (dabs then
merge wet-in-wet — see recipes).

### `stroke(points, opts)` — brush stroke
`pigment` sage · `width` 6 · `taper` [0.12, 0.4] · `pressure` (fn of t, or samples) ·
`wobble` 0.5 · `wetness` 0.5 · `dryness` 0 (bristle breakup) · `bristles` auto · `layers` 3.
```ts
p.stroke(trunk, { pigment: mix(PIGMENTS.wood, PIGMENTS.sumi, 0.2), width: 7, taper: [0, 0], pressure: [1.25, 1, 0.9] });
```

### `inkLine(points, opts)` — thin sumi line
`width` 1.6 · `pigment` sumi `#4a443c` · `breaks` 0.15 · `wobble` 0.35 · `pressureVar` 0.35 ·
`taper` [0.15, 0.3] · `pressure`. Tapered, pressure-varied, occasionally broken. Sparingly.
```ts
p.inkLine([{ x: 270, y: 354 }, { x: 274, y: 300 }, { x: 266, y: 252 }], { width: 2.2, pressure: [1.4, 1, 0.6] });
```

### `dryBrush(points, opts)` — scumble
`stroke` with `dryness` 0.6, `wetness` 0.15, `width` 14, flat ends. Breaks up along the paper
grain and most at its edges. Grass banks, bark, path edges, worn wood.

### `splatter(center, opts)` — a few flicked drops
`pigment` sage · `radius` 30 · `count` ~6 · `size` 2.4. Rare and subtle — never confetti.

### `ripple(center, opts)` — water ripple lines
`width` 70 · `count` 3 · `squash` 0.12 · `pigment` deep celadon · `opacity` 0.5 ·
`light` 0.65 (pale lifted line beside each) · `lineWidth` 1.1.

### `lift(shape, opts)` — lift pigment back to paper
`amount` 0.5 · `paper` `PAPER_WHITE`. Paints pale paper colour (`source-over`) — use on opaque
backgrounds (reflections, highlights), not on transparent sprites.

### `layer(area?)` → `WetLayer` — batch marks into one drying pass
```ts
const L = p.layer({ x: cx - 40, y: cy - 40, w: 80, h: 80 });   // user-unit area to cover
for (let k = 0; k < 6; k++) p.dabInto(L, c, PIGMENTS.sakuraLight, { variant: 'petal', angle: k, rng });
L.lift(highlightPoly, 0.4);        // also: L.fill(poly, pigment, alpha), L.clip(poly), raw L.ctx
L.dry({ edge: 0.6, blend: 'source-over' });
```
Marks in one layer merge like wet paint (no edges where they overlap); separate layers dry
separately and glaze over each other (edges show where they overlap). Call `dry()` exactly
once (or `discard()`).

### Painting in parts (ADR 0238)
A cooperative caller (the scene painter, ADR 0226) can paint the long calls a part at a time and
pause between the parts. A parts form is a generator, `PaintParts` (`Generator<void, T>`): each
`next()` paints one part. Drained, it paints exactly what the one-call form paints, with the same
canvas calls, the same rng draws and the same pixels, however often it pauses. Each one-call form
*is* `drain(xParts(…))`, so plant sprites, the studio and everything else are unchanged.
```ts
function* paintBank(p: Painter, rng: Rng): Generator<void, void, undefined> {
  yield* p.parts.wetInWet(bank, PIGMENTS.sageLight, PIGMENTS.sap, { rng });   // pauses inside
  const L = p.layer(area);
  for (const row of rows) {
    for (const cell of row) L.fill(cell, PIGMENTS.sap, 0.1);
    L.flush();                    // rasterise this row now, not in the drying pass's read
    yield;
  }
  yield* L.dryParts({ granules: 0.2 });
}
```
- `p.parts.wash / glaze / wetInWet / lift / stone / waterBody / foliageClump` take the same
  arguments as the methods. They pause after each layered fill, bloom and fade front, each
  stone blotch and underside layer, each band, streak and ripple line, each foliage dab, and
  inside every drying pass. The free functions are `washParts`, `glazeParts`, `wetInWetParts`,
  `liftParts` and `rippleParts` (`primitives.ts`), and `stoneParts`, `waterBodyParts` and
  `foliageClumpParts` (`recipes.ts`).
- `layer.dryParts(opts?, base?)`: the drying pass in parts. It pauses after the read
  (`getImageData`), after every band of rows of each pass over the buffer, and after the
  write-back, before the composite. A band is `DRY_BAND` pixels (64 k, about 1 ms) of whole rows.
  The passes are the wet edge, the edge blur's halving, box-blur and upsampling passes, and the
  pigment. They are the same row loops, only paused: the box blur's running column sums carry over
  from band to band, and no pass starts before the pass it reads has finished, so the result is
  byte for byte the whole buffer's. The read, the write-back and the composite each stay one canvas
  call. A composite in bands would resample differently at the seams, and splitting the reads would
  change the recorded calls for nothing.
- Pure forms for tests and other buffers: `dryPixelsParts(…, band?)`, `edgeBlurParts`,
  `boxBlurParts`.
- `layer.flush()`: the browser records canvas calls and rasterises them only at the next pixel
  read. A layer filled over many parts (the meadow's rows) would pay for all of its marks in the
  drying pass's read (~50 ms at load). `flush()` reads one pixel, so the marks laid so far are
  rasterised now, in the part that laid them. Pixels are unchanged. It does nothing on a dried,
  discarded or empty layer.
- **Between parts nothing else may draw on the target or on the open layer.** The scene painter
  owns its canvas. An open layer's work canvas is out of the pool, so another painter cannot get
  it. A caller that abandons a generator leaves its work canvas to the garbage collector (the
  pool makes a new one).

### Recipes
- `foliageClump(center, radius, pigments = FOLIAGE_GREEN, opts)` — cloud-pad of round dabs
  merged into a scalloped mass + mid-tone + cool shadow + a few darks. `light` (angle light
  comes from, −2.3 = upper left) · `flatness` 0.62 · `density` 1 · `dabSize` 0.2 · `shadow` 0.6 ·
  `opacity` 0.85 · `gaps` 0.35. `FoliagePigments = { light, mid, shadow, dark? }`.
- `grassTuft(base, opts)` — `height` 40 · `spread` height × 0.5 · `blades` 9–15 · `lean` ±0.15 ·
  `pigments` (light → dark) · `ground` true (faint wash under it) · `opacity` 0.85.
- `stone(shapeOrBox, opts)` — accepts a polygon, ellipse or `{ x, y, w, h }` (base at x,y, like
  scene rocks). `pigment` stone · `warm` 0.35 · `light` −2.2 · `moss` 0.3 · `granulation` 0.35 ·
  `ink` 0.3 · `groundShadow` true · `patches` 2–4 · `reserve` true (paints paper-white under
  itself so it is opaque over water/grass painted earlier).
- `waterBody(shape, opts)` — `pigments` [light, mid, deep] celadons · `bands` 5 · `ripples` 3 ·
  `reflection` 0.5 · `farShadow` 0.55 · `granulation` 0.4. Background only (lifts paper).

### Pigments (`pigments.ts`)
`PIGMENTS` — the ART_DIRECTION palette: `washi washiDeep sap sage sageLight olive celadon
celadonMid celadonDeep stone stoneDark stoneWarm sumi wood woodLight sakura sakuraLight iris
irisLight bellflower petalWhite petalShade vermilion gold shadow` and the sky pigments `cerulean
ultramarine indigo rose crimson ochre apricot violet` (ADR 0144: ~1.4× the v1 chroma, still well
below neon). A `Pigment` is a hex string.
Helpers work in OKLab: `mix(a, b, t)`, `lighten(p, k)` (also thins chroma, like water),
`darken(p, k)`, `saturate(p, f)`, `shade(p, k)` (darker + cooler — use instead of black),
`jitter(p, rng, k)` (per-stroke variation), `rgba(p, a)`, `lightness`, `chroma`.

### Rim light (`rim.ts`, ADR 0146)
`rimMask(image, side, rgb, k?)` → the sprite's sun-facing edge (its alpha minus a copy shifted
`rimWidth(w, h, k)` ≈ 4 % away from the sun, 1.5–9 px at the reference resolution, × √k for a
bitmap `k` times sharper — ADR 0187), coloured; `createRimCache()` keeps one per image, side,
quantised colour and `k`; `drawRim(ctx, cache, image, box, rim, alpha, k?)` draws it with `screen`.
Used by the plant system (in the plant's pose, `k` = sprite px per unit ÷ 1.7) and the scene's
boulders (`k` = paint scale ÷ 1.5).

### Paper, noise, geometry
- `paperTexture(w, h, seed, { tint, base, grain, mottle, vignette, grainScale })` → canvas.
  `paperGrain(seed)` → the tileable grain field granulation and dry brush sample.
- `createSimplex2D(rng)`, `createValueNoise2D(rng, period)`, `fbm(noise, x, y, opts)`,
  `noiseGrid(...)`. `createLazyValueNoise2D(rng, period)` is the same value noise, value for value,
  but draws its lattice a row at a time when a row is first sampled: for noise read along a few
  fixed rows, like the dock sheets' torn edges (ADR 0223).
- Canvases (`canvas.ts`): `makeCanvas(w, h)` (OffscreenCanvas when available), `context2d`, and a
  pool of scratch canvases (`acquireWork` / `releaseWork`).
- Pure geometry: `deformPolygon`, `organicOutline` / `outlineLayer`, `blob`, `stoneShape`,
  `dabOutline`, `smoothPath`, `ribbon`, `smoothPolygon`, `insetPolygon`, `bounds`, … — all
  deterministic for a given `Rng`, all unit-tested.

## Recipes for other agents
**A leaf clump / shrub.** One `foliageClump` per mass; trees are several clumps (pads) at
different sizes, `flatness` ~0.55, drawn *after* the branches so the ink shows faintly through
(see `paint-vignettes/tree-crown`). Pale spring: `{ light: lighten(sageLight, 0.1), mid:
sageLight, shadow: sap }`; pine: `{ light: sap, mid: sage, shadow: olive, dark: mix(olive,
sumi, 0.4) }`.

**Petals.** Petals of one flower overlap and should *not* merge — paint each with
`p.dab(…, { variant: 'petal' })` (separate layers glaze over each other), rotate around the
centre with ±0.15 rad jitter and ±10% length so the flower is never symmetric. For white
petals use `petalWhite` with `blend: 'source-over'` and shade one side with a `petalShade`
glaze. Finish with a small `round` dab in `gold` for the centre and 1–2 tapered `inkLine`
stamens at low opacity.

**Leaves along a stem.** `inkLine` (or a thin `stroke`) for the stem in `olive`, then `leaf`
dabs at nodes alternating ±0.6–1.0 rad, lengths tapering toward the tip; pass the species
`rng` everywhere.

**Grass and reeds.** `grassTuft` for tufts; reeds/iris leaves = `blade` dabs with `length`
3–5× the tuft height and `curve` 0.05–0.15.

**Stones and path.** `stone({x,y,w,h})` straight from scene rocks; stepping stones:
`stone(ellipse, { moss: 0, groundShadow: false })`. Paint stones *after* water and banks
(`reserve` keeps them opaque).

**Water.** `waterBody(pond)` first, then reflections as soft `glaze`s of the reflected colour
(vertically flipped shapes, low opacity), then stones.

### Do
- Keep most of the frame barely tinted; spend contrast on plant heads and stones.
- Layer: light → mid → dark, each dried separately; shadows as cool `glaze`s.
- Vary everything with the rng: count, angle, length, pigment (`jitter`).
- Use `fade` (lost edges) on big washes so shapes dissolve toward the margins.

### Don't
- Don't fill or stroke with raw canvas calls for visible art — it reads as vector.
- No pure black (use `sumi` or `shade`), no saturated colours outside flowers and koi.
- Don't `lift` on transparent sprite canvases (it paints paper colour).
- Don't put dozens of separate `dab` calls where one `layer` + `dabInto` would do (speed),
  but don't merge marks that should show overlapping edges (petals).
- Don't call primitives per frame — they are for cached sprites and backgrounds.

## Persistence: the paint cache (`persist.ts`, ADR 0227)
Finished paintings that depend only on code, seed, view and scale (the landscape, the sky and
light plates) can be kept across reloads, so a repeat visit decodes them (~40 ms) instead of
painting them (~1 s). The scene uses it for the landscape, its sprites and its detail paintings (ADR 0228); P18 wires the plates.

```ts
import { paintCache } from '../paint/persist';
const cache = paintCache();                      // the app's cache (IndexedDB, or the null cache)
const hit = await cache.get('scene', key);       // ImageBitmap | null
if (hit) ctx.drawImage(hit, 0, 0);
else { paint(canvas); void cache.put('scene', key, canvas); } // copied now, encoded when idle
```

- **API:** `get(kind, key)` → `ImageBitmap | null`. `put(kind, key, canvas, { copy? })` → `Promise<boolean>`
  (true once written). `clear()` removes every entry of every version. `stats()` →
  `{ enabled, off, version, entries, bytes, maxBytes, hits, misses, puts, skipped, evictions, dropped, errors, lastError }`.
  `settle()` waits for queued puts, and `version` is the cache's version. Nothing throws or
  rejects. `createPaintCache({ adapter, version?, maxBytes?, encode?, decode?, copy?, idle? })`
  builds another cache, for example with a Map adapter in tests. `createNullPaintCache(off)` builds
  one that stores nothing.
- **Keys:** `version:kind:key`. `kind` is the painting (`scene`, `sky`…, with no `:`). `key` holds
  *everything else* the pixels depend on: seed, view rect, scale or pixel size, quality, the
  phase… A missing ingredient shows the wrong painting.
- **Version:** `__PAINT_VERSION__` plus the browser (a short user-agent hash). `__PAINT_VERSION__`
  is a build-time hash (`paint-version.ts`, `vite.config.ts` `define`). It covers every file in
  the import closure of `src/paint`, `src/scene`, `src/ambience`, `src/plants`, `src/fauna`,
  `src/render` and `src/core`, without tests and studio entries. Any change there, or anything
  those files import from elsewhere, gives a new version, and old entries are dropped when the
  store opens. The dev server and Vitest get `'dev'`, which turns the cache off.
- **Off (the null cache):** on the dev server, with `?nopaintcache` (compare against a fresh
  painting), without IndexedDB, or when it fails to open. `stats().off` says which:
  `dev | opted-out | unavailable | failed`.
- **Cost:** `put` copies the canvas synchronously. That is one `drawImage` of the full size: pass
  `{ copy: false }` for a canvas nothing will draw on again. The PNG encode runs in idle time, one
  put at a time, and only the latest of queued puts of one entry is encoded. LRU eviction keeps the
  store under 48 MB of PNG bytes (`maxBytes`). The landscape is about 6 MB at 1440×900 @2.
- **Exactness:** `get` decodes with `colorSpaceConversion: 'none'` and `premultiplyAlpha: 'none'`.
  In Chromium the round trip canvas → PNG → bitmap → `drawImage` reads back identical
  `getImageData`, opaque and with every alpha value (`tests/e2e/paint-cache.spec.ts`). Store the
  painting before the paper (ADR 0021) and before any time-of-day plate.
  **Draw it scaled only from a canvas copy.** Drawn scaled with smoothing, the decoded
  (unpremultiplied) bitmap filters translucent pixels differently from the canvas it was painted
  on: up to 35 levels on a third of the landscape. A 1:1 `copy` into a canvas first is exact
  (the scene's `canvasOf`, ADR 0228).
- **Where:** IndexedDB `studysprout-paint` (devtools › Application › IndexedDB) has two object
  stores: `meta` (`EntryMeta`: `id`, `version`, `kind`, `key`, `bytes`, `used`) and `blobs` (the PNG
  under the same id). `?dev`: `sprout.paintCache` is the app's cache, plus `open({ version, maxBytes })`
  for another cache on the same store.

## Performance
Measured in headless Chromium (Apple M3) with an ad-hoc benchmark driving the engine through
the dev server, DPR 2:

| Workload | draft | normal | high |
|---|---|---|---|
| Dense full background 1600×1000 world → 3200×2000 px (sky bleed, 3 hills, 2 bank bleeds, pond, 5 stepping + 9 boulders, 18 foliage clumps, 8 trunks, 30 tufts, 6 dry-brush strokes) | 0.61 s | 1.25 s | 1.62 s |
| + `paperTexture(3200, 2000)` (separate cached layer) | +0.16 s | +0.16 s | +0.16 s |
| Plant sprite 300×400 at DPR 2 (5 stems, 30 leaf dabs, 5 five-petal heads) | 10 ms | 24 ms | 26 ms |

The real scene has fewer elements than the stress composition. Cost is roughly proportional
to the wet-layer pixels processed (≈18 M px for the normal background); `quality` trades layer
counts and wet-layer resolution (draft: half resolution; normal: 0.8 for layers > 250 k px,
0.7 above 1.5 M px). Tips: batch marks into one `layer()`, keep shapes' bounding boxes tight.

## Tests
`noise.test.ts`, `pigments.test.ts`, `geometry.test.ts` (determinism of deformation and
outlines, brush profiles, paths), `wet.test.ts` (drying pass on synthetic buffers: rim pooling,
opacity, dry brush, determinism), `parts.test.ts` (ADR 0238: the drying pass's output pinned
against the engine before it could pause, for every option branch; every band size, down to a
row, dries byte for byte like the whole buffer; the blurs in bands equal the whole; `dryParts`
paints what `dry` paints, in many parts; `flush` is one one-pixel read; the long recipes' canvas
calls pinned on a recording canvas, one call and in parts alike, in more than 8 parts with no part
over a quarter of the calls or reading more than one wet layer), `primitives.test.ts` (jsdom-safe import, documented
defaults, quality scaling, pure brush geometry), `rim.test.ts` (rim width, screen draw, faint rims skipped, one mask per image, side and colour), `persist.test.ts` (keys, versions
and the drop of other versions, LRU and the byte cap, idle encoding, the null cache, swallowed
storage, encode and decode failures; Map adapter), `paint-version.test.ts` (the hashed import
closure, what changes the version). E2E `paint-cache.spec.ts` (a bit-exact round trip across a
reload, `?nopaintcache`, version drop and eviction in real IndexedDB). Visuals: the studio sections
above.
