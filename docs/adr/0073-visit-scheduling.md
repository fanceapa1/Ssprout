# ADR 0073 — Visits: quiet gaps, a sooner first visit, a cap and retries

- Status: accepted
- Date: 2026-10-22

## Context
SPEC §4: wildlife is rare at first, never more than a handful visible, behaves like real animals,
rests at night (birds, butterflies, bees), and the whole garden must never compete with the plants.
Reduced motion asks for "far fewer and slower".

## Decision
- Residents (koi per unlock, striders, the frog when a pad exists) are kept alive by upkeep; every
  other kind **visits** on its own schedule (`schedule.ts`, pure): a due time per kind, the first
  one drawn from a shorter `first` range (so a newly unlocked creature is actually seen), later ones
  from long `gap` ranges (heron 15–30 min).
- A due visit that may not come now (visitor cap of 3 individuals, the kind's own max, night,
  reduced-motion exclusions) is **retried** 8–20 s later rather than dropped, so caps delay rather
  than starve rare kinds.
- Multipliers, not separate tables: lively session × 0.75, reduced motion × 3 (and one visitor, one
  strider, no swallows, speeds × 0.6), 25 plants birds × 0.6.
- Kinds without targets are not scheduled (no bees without pollinator flowers, no frog without a pad).
- All constants live in one table (`tuning.ts`).

## Consequences
Pacing is tunable in one place and testable (`schedule.test.ts`, `sim.test.ts`). Group sizes are
clamped to the room left, so the cap holds for groups (bees, swallows) too.
