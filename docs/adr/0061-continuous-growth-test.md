# ADR 0061 — Continuous growth is a tested property (recording painter)

- Status: accepted
- Date: 2026-10-22

## Context
"No popping" is easy to break silently: a size that starts at 30 % instead of 0, an ink line
that switches on above a length threshold, a bud and a flower swapped at a growth value. The
paint engine needs a real canvas, which Vitest (node) does not have, and screenshots of 24
steps × 13 species are too coarse to catch a one-step jump.

## Decision
- `src/plants/lib/small-recorder.ts` provides a recording `Painter`: every engine call is logged
  with its arguments, rng streams are replaced by their seeds, and each call is keyed by
  `method + rng seed + occurrence` — a stable identity thanks to per-element forks (ADR 0060).
  `layer()` returns a recording wet layer that back-fills its dried opacity onto the
  `dabInto` marks it contains.
- For every tier 1–2 species and two seeds, `small-species.test.ts` steps growth 0 → 1 in 200
  steps and asserts: a mark present in both neighbouring steps moves/changes by < 5 % of the
  sprite size (angles compared modulo 2π); a mark that appears or disappears has
  size × opacity < 1.2 % of the sprite. Plus determinism (same seed + growth → same log) and
  seed variety.
- Helpers bake the fixes in so species get them for free: new leaves/blades fade in over their
  first stretch (`smooth(k * 8)`), stems fade in with length, toothed leaves fade below 2.5
  units.

## Consequences
Popping regressions fail a fast unit test with the offending mark and growth value in the
message. The thresholds are deliberately loose enough for real growth (fast-unfurling leaves)
and tight enough to catch any visible jump at sprite scale.
