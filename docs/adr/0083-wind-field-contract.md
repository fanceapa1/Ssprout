# ADR 0083 — Shared wind field: a pure seeded function

- Status: accepted
- Date: 2026-10-22

## Context
Plants (sway), fauna (drift), rain slant and motes must agree on one breeze, and sessions should make
plants "sway a touch more". Systems run independently and must stay deterministic.

## Decision
`wind(t, x, y, boost = 0) → { sway: -1..1, gust: 0..1 }` in `src/ambience/wind.ts` (re-exported from
`src/ambience`): a fixed-seed simplex field — slow base lean, quicker flutter scaled by gusts, and gust
fronts that travel toward +x at 140 world units/s. `boost` (0..1) scales the amplitude by up to 1.35;
`windBoost(phase)` gives focus 1, break 0.5, else 0. `createWind(seed)` builds other fields. Callers
pass their own time (`FrameInfo.t`), so freezing the renderer freezes the wind.

## Consequences
No shared mutable state between systems. Consumers that want the boost to ease in should smooth it
themselves (the ambience eases its own `boost` channel).
