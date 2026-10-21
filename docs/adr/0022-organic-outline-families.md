# ADR 0022 — Organic outline families: capped recursive deformation, median contour

- Status: accepted
- Date: 2026-10-22

## Context
Recursive midpoint deformation (Tyler Hobbs' watercolour technique) gives convincing edges for
roundish shapes, but in the first iterations it produced (a) spiky "mountain range" edges on
long thin shapes (water bands, bank tops), because displacement is proportional to edge length;
(b) jagged edges once layers were sharpened, because sharpening at low coverage keeps the
*union* of all layers; (c) saw-tooth rims wherever a second pass was clipped to a fine outline.

## Decision
- Any shape is first **resampled evenly** (so authored density doesn't matter), deformed once and
  Chaikin-smoothed into a `coarse` outline. Each wash layer is a fresh recursive deformation of
  that coarse outline (`outlineLayer`), smoothed twice, with variance decaying 0.7 per level
  down to ~1% of the shape size.
- Every displacement is **capped** relative to the shape's thinnest dimension.
- The drying pass's edge threshold sits around 10–48% coverage, i.e. near the **median** layer
  contour: layers average out instead of stacking spikes, and stray single layers survive only
  as a faint fringe.
- Clipped passes (stone blotches, water bands, wet-in-wet drops) clip to `innerClip(outline)` —
  the smoothed coarse outline inset slightly — never to a fine fractal outline.
- Gaussian deviates in deformation use a cheap Irwin–Hall approximation (deterministic, ~3×
  faster than Box–Muller).

## Consequences
Edges are irregular at every scale but never spiky or vector-clean; long shapes stay usable.
Changing these constants changes every painted pixel — treat them as art-direction decisions.
