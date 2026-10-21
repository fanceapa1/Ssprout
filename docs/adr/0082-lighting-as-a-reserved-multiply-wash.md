# ADR 0082 — Time-of-day lighting as a cached multiply wash with reserved lights

- Status: accepted
- Date: 2026-10-22

## Context
Lighting must be painterly (no flat gradients, no glow filters — ART_DIRECTION anti-tropes), keep
plants readable at night, interpolate smoothly between keyframes and be redrawn only every few
seconds. The paint engine's wet-edge washes have edges, which a whole-frame light change must not.

## Decision
- Keyframes (night, dawn, morning, noon, evening, dusk) each describe a **grade**: multiply tint and
  amount, sky deepening, foreground lift, warm low-sun glow, lantern strength, mottling. `gradeAt(hour)`
  smoothsteps between neighbours and wraps at midnight.
- The grade is painted **per pixel** into a world-sized cache at 0.3 px/unit: fBm mottling, rare soft
  backruns with a faint pooled rim, and lights *reserved*: around `pavilion.lantern` and on the water
  where its light falls the wash is thinned and warmed (watercolour leaves lights unpainted) with a
  ragged edge. Only a 5-unit flame dab is added with `screen`.
- The cache is blitted with `multiply` every frame (one `drawImage`); it is repainted on override
  changes, or at most every 3 s when the grade moved perceptibly (~6 ms per repaint).
- Night stays at roughly 45 % luminance or more on white paper, with the foreground lifted (`ground` 0.8).

## Consequences
The paper layer still multiplies its grain on top, so the wash reads as pigment on the same paper.
At 0.3 px/unit the lantern reserve is soft-edged by design.
