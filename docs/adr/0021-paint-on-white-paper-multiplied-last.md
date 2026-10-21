# ADR 0021 — Paint on white; the paper is multiplied last

- Status: accepted
- Date: 2026-10-22

## Context
The renderer already composites a cached `paper` layer with `multiply` over the whole frame
(ARCHITECTURE › Rendering pipeline). Some marks need to *remove* pigment: lifted highlights on
water, a stone reserved over a pond painted earlier, white petals over green. If paintings were
made on a washi-coloured ground, a lift would have to guess the paper colour, and the paper
texture would be applied twice.

## Decision
- Backgrounds and sprites are painted on white (or transparent). `paperTexture()` contains the
  full washi colour, fibres, grain, mottle and a faint irregular vignette, and is multiplied
  over the finished frame (renderer layer 7; studio `finish()`).
- Lifts and reserves paint `PAPER_WHITE` (`#fffdf8`) with `source-over`; after the paper
  multiply they read as bare washi.
- Washes use `multiply` by default — subtractive layering, no glow. On transparent sprite
  canvases a multiplied wash is just its colour at its alpha, so sprites composite normally.
- Granulation and dry brush sample the same tileable `paperGrain` the texture is built from, so
  pigment settles where the paper's valleys are.

## Consequences
- The scene should not fill the background with paper colour (that would double the tint).
- `lift` is for opaque backgrounds only (documented); sprites use `blend: 'source-over'` for
  opaque light marks such as white petals.
- `paperTexture({ tint: false })` exists for a frame that already has a paper ground.
