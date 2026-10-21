# ADR 0068 — Trees: one rng fork per mark, and drying passes with their own stream

- Status: accepted
- Date: 2026-10-22

## Context
Even with a growth-independent plan (ADR 0067), how many marks are painted *does* depend on
growth (fewer pads, fewer blossoms early on). Two things would then drift between growth steps:
(1) a shared paint rng consumed in call order gives every later mark different jitter; (2) every
`WetLayer.dry()` draws its flow-noise offsets from the painter's environment rng, so the
mottling of a pad would change whenever an earlier layer was added or skipped.

## Decision
- Every mark that can come and go is painted from its own fork: `rng.fork('pad-' + id)`,
  `'bl-' + id`, `'br-' + branchId`, `'lf-' + id`, … (ADR 0012: forks depend on seed + label,
  not position).
- Tree helpers dry through `stableTarget(p, rng)` / `stableLayer(p, area, rng)`: a copy of the
  painter's environment whose `rng` is a dedicated fork, so a layer's flow noise depends only on
  its own label. Engine primitives are called as free functions with that target.

## Consequences
A pad, flower or branch looks the same at every growth step it is visible in — only its size,
opacity or colour changes. Batched layers (one layer for many marks) still change slightly as
marks join them, which is acceptable: the change is local to the new marks.
