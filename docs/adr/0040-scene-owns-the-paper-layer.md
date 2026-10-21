# ADR 0040 — The scene provides the paper layer

- Status: accepted
- Date: 2026-10-22

## Context
ADR 0021 says everything is painted on white and the washi texture is multiplied over the
finished frame (renderer layer `paper`). The renderer caches and multiplies the layer, but no
system drew into it: the placeholder background filled the frame with washi colour instead.
Without a paper system the painted-on-white garden would show as white.

## Decision
`src/scene/system.ts` exports `createPaperSystem()`: on init it builds
`paperTexture(pixelW, pixelH, seed, { grainScale: dpr })` (only when the backing-store size
changes) and draws it in device pixels into the `paper` layer. `main.ts` registers it before the
scene system, so paper is visible from the first frame — while the first painting is still
being made, the screen shows bare washi, never a blank canvas.

## Consequences
- The paper is screen-space (its faint deckle vignette frames the screen, not the world); the
  painted margins of the scene (`paintMargins`) are world-space. Both together read as a sheet.
- Ambience/lighting systems paint on top of the scene and below the paper as before; they must
  not fill with paper colour either.
- ~60–160 ms per resize for the texture (sync, cheap compared to the painting).
