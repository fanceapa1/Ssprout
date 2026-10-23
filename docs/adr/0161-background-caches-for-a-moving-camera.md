# ADR 0161 — Background caches for a moving camera

- Status: accepted (amends ADR 0041)
- Date: 2026-10-23

## Context
The `background` layer (the painting and the daylight sky multiplied over it) is cached in a
stage-sized canvas and blitted each frame. With a camera, every frame of a glide is a new view:
re-compositing the painting and the sky per frame is a few large blits, and repainting anything
in a frame is out of the question.

## Decision
The renderer keeps **two background caches**:
- the **overview cache**, built at the base viewport whenever the layer is dirty; while the camera
  moves (a glide, a gesture follow, or within `REST_S` = 0.25 s of the last change) the frame
  blits **the sub-rect of it under the view, scaled up** — one `drawImage`, no system draw;
- the **resting-view cache**, built once at the view when the camera comes to rest (and when the
  layer is invalidated, e.g. the detail painting fading in); a settled view blits it as is.
- At the overview the overview cache is used directly (unchanged behaviour). A moving view that
  lies outside the overview's crop (a phone looking at the garden's sides) draws the layer
  directly that frame (still only blits).

## Consequences
During a glide the background is as sharp as the overview painting (which is all there is until
the detail paint, ADR 0163). Measured on a laptop under four parallel e2e workers: 2.1 ms average
main-thread work per frame during a glide (p95 2 ms), no background repaint. `renderer.test.ts`
checks the sub-rect blit while moving, one rebuild at rest, reuse on a still frame.
