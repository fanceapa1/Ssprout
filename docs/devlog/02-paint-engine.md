# 02 — Paint engine

## What
- `src/paint/`: seeded noise (`noise.ts`), OKLab pigment palette and maths (`pigments.ts`),
  pure geometry (`geometry.ts`), washi paper grain + texture (`paper.ts`), offscreen canvas
  helpers (`canvas.ts`), wet layers with the drying pass (`wet.ts`), primitives
  (`primitives.ts`: wash, glaze, wetInWet, granulate, dab, stroke, inkLine, dryBrush,
  splatter, ripple, lift) and recipes (`recipes.ts`: foliageClump, grassTuft, stone,
  waterBody). `Painter` keeps `ctx/w/h` and gains all of these as methods plus `layer()` /
  `dabInto()` for batching.
- Studio: `paint` (one entry per primitive, several seeds side by side), `paint-recipes`,
  `paint-vignettes` (boulder at a pond edge, tree crown with ink trunk, grass bank, pond strip).
- 55 unit tests; docs in `docs/systems/paint.md`; ADRs 0020–0022.

## Why / how it went
Four critique → fix rounds against the owner's reference and ART_DIRECTION:
1. First pass: washes and foliage promising; water bands and bank tops spiky, dry brush read as
   Morse code, stones muddy and peppered, ink too straight, foliage darks like coins.
2. Outline families with capped deformation (ADR 0022), white-ground pipeline (ADR 0021), stone
   paper reserve, dry brush rebuilt as a body broken by the paper grain, softer foliage darks.
3. Median-contour edge threshold, inset clips (fixed saw-tooth rims), fixed wet-in-wet half
   planes (they were anchored at the origin, so bleeds far from x = 0 vanished), finer grass,
   soft gradient underside on stones, calmer granulation.
4. Performance: half-resolution rim blur, tight dab layers, per-row flow interpolation, granules
   inside the stone body pass. Dense background 1.9 s → 1.25 s (normal), plant sprite 54 → 24 ms.

## Left / known weaknesses
- Dense backgrounds at `quality: 'high'` take ~1.6 s at DPR 2; the scene may want `normal`
  (or `draft` for a first paint, then upgrade).
- Large straight-edged shapes still get gentle "hill" bumps along long edges unless `deform` is
  lowered; very long water edges keep a faint feathered fringe.
- Foliage shadows can still read as separate round dabs on some seeds; blooms are subtle.
- Grass blades are a little uniform in tone; ripple light lines barely show on pale water.
