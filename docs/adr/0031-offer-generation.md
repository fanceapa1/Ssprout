# ADR 0031 — Reward offers: earned tier first, unowned first, seeded per session

- Status: superseded by ADR 0003 / ADR 0036 (no end-of-session offer; the species is chosen at start)
- Date: 2026-10-21

## Context
SPEC §3: offer 3 species (2 when the pool is too small) from the earned tier, preferring species
the gardener does not own. Early on, tiers will have few species, and a tier may be empty.

## Decision
`generateOffer(rng, tier, species, ownedIds)` in `src/core/rewards.ts` is pure; the species list
is a parameter, never the registry.
1. Walk tiers from the earned one down to 1. Within each tier: unowned species first, then owned.
   Each group is shuffled with the rng; species are sorted by id first, so input order never
   changes the result.
2. Stop at 3. Fewer come back only when the whole pool at or below the earned tier is smaller
   (including 1 or 0 in development with a single placeholder species).
3. **Tier beats novelty**: an owned species of the earned tier is preferred over an unowned one of
   a lower tier. A long session should always feel like it earned something bigger.
4. **Never higher** than the earned tier.
5. "Owned" = currently growing in the garden. Pressed flowers do not count: replanting a
   once-pressed species is a nice return, not a duplicate.
6. The controller seeds each offer with `rng.fork('offer:' + sessionId)`: deterministic per
   (seed, session), independent of how many other draws the controller has made (ADR 0012).

## Rejected
- Weighting by rarity within a tier: not in the spec; can be added inside a group later.
- Including pressed species in "owned": would exhaust small tiers quickly.
