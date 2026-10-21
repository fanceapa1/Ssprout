# ADR 0121 — The DOM UI dims with the garden's light; the light waits for the painting

- Status: accepted
- Date: 2026-10-22

## Context
Time-of-day lighting is a multiply wash on the canvas (ADR 0082). The washi slips and the soft
paper dabs behind the corner icons and the quiet line are DOM above it, so at night they stayed
day-bright and read as glowing lamps on the indigo painting. Separately, on a first load at
night the wash and the lantern flame were drawn over bare paper for a second or two before the
landscape finished painting.

## Decision
- `AmbienceSystem.onLight(fn)` reports the grade whenever the lighting repaints.
  `ui/ambient-light.ts` turns it into two custom properties on the UI root: `--ui-dab` (washi
  multiplied by ~70 % of the wash at the top of the frame — a lifted patch of paper, not a lamp)
  and `--ui-dim` (a brightness ≥ 0.8 for slips: `.panel`, `.tip`, `.placement-bar`,
  `.plant-label`). Sheets (`dialog.sheet`) reset both: they are paper held up to read.
- `AmbienceSystem.revealLightAfter(promise)`: lighting is drawn with alpha 0 until the renderer is
  ready, then eases in over 1.4 s (at once under reduced motion, a frozen frame or `settle()`).
  `main.ts` passes `renderer.whenReady()` and only then subscribes the UI to the light.

## Consequences
- Day and noon are unchanged (dim ≈ 1, dab ≈ washi).
- The UI follows the lighting's repaint cadence (seconds), as slow as the light itself.
