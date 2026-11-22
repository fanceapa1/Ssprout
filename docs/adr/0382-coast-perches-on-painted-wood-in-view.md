# ADR 0382: The coast's tree perches sit on the painted wood, and every perch lies where every window shows it

- Status: accepted
- Date: 2026-11-22
- Builds on: ADRs 0123 (portrait crop), 0367 (the scenery olive), 0373 (the coast's wildlife places), 0380 (the scenery pine)

## Context
The coast's tree perches came from five centreline samples a limb (`OLIVE_LIMBS`, `PINE_BRANCHES`):
the midpoint of each chord, with no width and no idea of the leaves. They missed the painting for
every bird: the chord cuts inside a curve, the feet went on the limb's middle line rather than on
its top, the pine's sampled twigs taper to nothing where the perch fell, and the olive's fork
was the trunk's face below the crotch. The owl patched this with seats by perch id (devlog 211).

Separately, the stage fits the world to cover the window. A wide laptop (1470 × 750, a stage of
1442 × 705) shows only y 209–991, and the camera's overview cannot go above it; the owl sat on the
pine's upper branch at y 150 for its whole stay. The side margins also lift the painting to paper
(200 wide, deeper toward the bottom): a perch at x 11–46 stood in the fade.

## Decision
- **Limb data is the painted wood.** `OLIVE_LIMBS` (trunk, scaffold limbs, the boughs at least
  2.5 thick), `PINE_TRUNK` and `PINE_BRANCHES` are `WoodPt[]`: nine samples a limb of the ribbon
  as painted (the wobble included; the olive's scaffold as the trunk painter's crotch ribbon,
  `scaffoldLimbs`), each with its half width `hw` and `leaves`, the olive leaves or pine tufts
  round a bird's body above it. `treeWood()` in `paint-veg.ts` derives them from the plans and
  `veg.test.ts` checks the literals.
- **A tree perch is the limb's upper side** (`limbTop`): the sample lifted by its half width
  across the limb, where the limb is at least 1.8 thick (half width) and has at most 8 leaves
  round the body; the flattest such samples, 24 apart. The fork is the upper side of the
  flattest scaffold limb where it leaves the trunk: the crotch.
- **Perches lie in `COAST_SEEN`** (x 60–1530, y 240–985): what every landscape window's
  overview shows (1470 × 750 is the shortest: y 209–991; 30 kept for a bird's height under the
  top), out of the side margins' deep fade. The scenery drops the rest; the goats' ledges are kept
  whole (they walk them in from off the east edge), all within the y band.
- Creatures take the perch as it is: no seat by perch id.

## Consequences
- Perches 140 → 133: the pine keeps one branch (its lower limb's bare stretch, 1 of 5 before),
  the three coping perches at the walls' faded ends go, the olive keeps three (re-placed).
- The cicada's bark bands follow the painted trunks (0.6 of the half width either side).
- Phones in portrait crop the sides instead (x 460–1060 at 390 × 844; ADR 0123): most tree and
  coping perches are off their overview. Creatures that choose by `w.view` (the cicada does) cope;
  the others do not yet.
- Trees are painted into the background, so a perched bird draws over the leaves round it.
  Choosing bare stretches keeps that from reading wrong; foliage in front of a bird would need a
  foreground leaf layer for the scenery trees (a painting and layer change, not made).
