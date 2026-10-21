# ADR 0074 — Perched creatures sort by what they stand on

- Status: accepted
- Date: 2026-10-22

## Context
`entities` are depth-sorted by base y. A bird standing on a boulder has its feet on the boulder's
top, i.e. at a smaller y than the boulder's base; sorted by feet y it would be drawn *behind* the
boulder it stands on (if the scene draws rocks as entities).

## Decision
- Ground creatures report the base y of their support (+ a small ε): a perch rock's `y + 1`, a
  stepping stone's front edge, a lily pad's slot y + 0.6. The heron, standing in the water, uses its
  feet y. Flying creatures are on `air` and not sorted.
- Perches come from the contract: rocks with `perch: true` (standing area on the dome top) and the
  stepping stones (`perchesOf`).

## Consequences
Birds and the frog always draw on top of what holds them and behind plants growing in front of it.
