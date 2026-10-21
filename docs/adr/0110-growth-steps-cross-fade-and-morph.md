# ADR 0110 — Growth as 24 cached steps, cross-faded and morphed

- Status: accepted
- Date: 2026-10-22

## Context
ARCHITECTURE first sketched five growth stages (0.1, 0.3, 0.55, 0.8, 1) cross-faded during the
bloom. With ADR 0003 the plant grows live for the whole session, in the garden and the widget,
and must look continuous; painting a sprite per frame is impossible (10–100 ms each).

## Decision
- Quantise growth to 24 steps (`GROWTH_STEPS`); a sprite exists per step on demand. Finished
  plants only use step 24.
- Draw the two steps around the live growth, cross-faded exactly: lower at `1 − w`, upper at `w`
  composited with `lighter` into a scratch buffer (a per-pixel lerp of premultiplied colour;
  plain source-over would darken where translucent washes overlap).
- Morph during the fade: scale the lower step toward the upper one's painted size (content
  bounds, clamped 0.8–1.25) and the upper one from the lower's, both 1 at their own step, so
  growing tips travel instead of showing as a double exposure.

## Consequences
At most 25 paints per session plant. Species must be deterministic per (seed, growth, size).
