# ADR 0066 — Flowers are rings of petals projected from 3-D, buds are folded flowers

- Status: accepted
- Date: 2026-10-22

## Context
Peony, camellia and lotus blooms must read at garden scale and in the large planting preview,
be seen from different angles, and open continuously from bud to bloom during a session.
Separate bud and flower drawings would pop when one replaces the other; symmetric flat
rosettes are an art-direction anti-trope.

## Decision
- A bloom is a list of petal rings (`count`, `length`, `width`, final `open` angle, pigment,
  optional wet-in-wet `tip` colour, ruffles). Each petal has an angle around the flower axis and
  an opening angle away from it; `petalVector(around, open, view, roll)` projects it to a screen
  angle, a foreshortening and a front/back depth for a flower tipped toward the viewer.
- Opening is one parameter: petals swing from a small bud angle to their final angle while size
  and colour (bud green → petal colour) ramp; stamens appear past half-open, sepals fold away.
- Flowers seen from the side (`cupped`, view < 0.9) paint back petals, then the centre, then the
  front petals; face-on flowers paint rings outer → inner with the centre last.
- Many-floret heads (hydrangea mopheads, azalea blossom patches) are a different model: packed
  scalloped florets on a dome (`headFlorets`) that merge in one layer. Chrysanthemum blooms are
  ray-floret star outlines, batched by depth.

## Consequences
- Every seed varies petal count jitter, lengths, angles, view, roll and rotation, so no two
  flowers match and none is symmetric.
- The petal arrangement is computed from the bloom's own seed in a fixed order, so the same
  petals exist from bud to bloom (tested).
- Petal shapes are the engine's `petal` dab; frilly or very long petals would need a new dab
  variant in the engine.
