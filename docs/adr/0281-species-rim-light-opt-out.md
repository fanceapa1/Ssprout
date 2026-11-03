# ADR 0281: A species can opt out of the rim light

- Status: accepted
- Date: 2026-11-03
- Builds on: ADRs 0146 (rim light), 0251 (a species is only added files)

## Context
At sunrise and sunset the plant system draws every plant's sun-facing edge again with `screen`
(ADR 0146): the warm rim a low sun leaves on a leaf. Baikamo (devlog 80) lives under the water.
The low sun does not light its tresses from the side, and the warm edge along the top of the weed
showed it lying on the water instead of under it. A species had no way to opt out.

## Decision
- `SpeciesDef.rimLight?: boolean`, default true. `false` means the plant system draws no rim light
  for that species (`drawLit` in `plants/system.ts`). The cast shadow and reflection are unchanged.
- The name says what it does, not why: `submerged` would suggest it also changes shadows,
  reflections and the water layers, and it does none of that.
- Baikamo sets `rimLight: false`.

## Consequences
- One optional field on the species contract (docs/ARCHITECTURE.md) and one condition per lit
  draw. No other species changes.
- `src/plants/system.ts` and `types.ts` are paint sources, so the paint version changes once.
- Covered by `plants/system.test.ts` (no `screen` blit for a species with `rimLight: false` at sunset).
