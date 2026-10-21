# ADR 0067 — Trees: build the whole skeleton first, let growth only reveal it

- Status: accepted
- Date: 2026-10-22

## Context
A study session renders a tree at ~24 growth steps and cross-fades between them. If a tree's
shape depended on `growth` (or if randomness were drawn in a growth-dependent order), adjacent
steps would be different trees and the cross-fade would shimmer and jump.

## Decision
- Each tree species exports a pure `plan<Species>(rng)` that builds everything from forks of
  the species rng (`structure`, `pads`, `blossoms`, …) in a fixed order: the full branching
  skeleton (recursive `growChildren` with per-level specs), foliage pads, leaves, blossoms,
  petals. It never sees `growth`.
- Every branch carries a growth window `[t0, t1]` in *structure time* τ. A child opens when its
  parent's growth front passes its attach point (+ a small lag); windows are normalised so the
  last ends at τ = 1.
- `treeView(g)` maps growth to `{ tau, scale, thick }`: τ completes at g = 0.5, the tree scales
  about its base from 0.32 to 1 and trunks thicken. Foliage (0.5–0.75) and colour/blossom
  (0.75–1) arrive per element through `stagger(g, start, end, delay, width)` with a delay
  stored in the plan. Everything is a smooth function of `g`.

## Consequences
Consecutive growth steps differ only where the tree actually grew, so cross-fades read as
growth. Plans are cheap (< 1 ms) and rebuilt on every draw — no cache needed. Changing a level
spec re-shapes every tree of that species (deliberate art change, like any constant).
