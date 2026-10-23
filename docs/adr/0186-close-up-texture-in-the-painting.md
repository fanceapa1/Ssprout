# ADR 0186 — Close-up texture painted into the landscape

- Status: accepted (amends ADR 0163)
- Date: 2026-10-23

## Context
The camera now spends whole sessions at 2–3× on a plant. The detail painting resolved the
overview's marks sharper, but the near meadow was a few big, flat washes, so close up it read as
an empty, blurry expanse; trunks were single flat strokes, and where a limb left a stem its square
end showed.

## Decision
- A **meadow** step (after the banks, before the pond reserve and the path, whose lifts then clean
  the rim and the earth) paints two wet layers over the part of the ground the canvas shows:
  - wet-in-wet **green patches** (cool sage, yellow sap, a touch of gold, a blue-green), low and
    wide, bleeding where they touch and pooling where they stop, with granulation and clustered
    granules in the drying pass, and **back-runs** (a pale crinkled bloom lifted in about one in
    five);
  - sparse **grass strokes**: tapered, curved blades in clusters of three to seven, in drifts
    gated by a coarse noise, denser and larger toward the viewer, paler toward the far bank.
  Marks come from a **world-anchored grid of cells**, each with its own forked rng
  (`rng.fork('p<i>,<j>')`), and only cells near the painted rect are painted: a detail painting
  holds exactly the overview's marks for its part of the world (no pop when it fades in), and a
  close view pays only for its corner. Marks stay off the water, the path and the engawa
  (`onGrass`).
- **Trunks** get a shadow flank (a wet, cooler stroke along the side away from the light,
  narrowing upward), broken dry-brush striations along the grain, a knot or two, and a shadow
  flank on thick limbs, all from the tree's own rng fork. Stems keep their width almost to the
  top, limbs start full width and each fork gets a faint node, so a joint is one continuous
  shape; the ink accent follows the trunk's taper instead of a fixed offset.
- These marks are painted into the overview too (they read as texture there), not only into the
  detail: the zoom resolves the same painting.

## Consequences
Overview paint + ≈ 60–100 ms CPU (≈ 9 %; the meadow is two steps so the cooperative paint yields
between them), detail paint ≈ +0.3 s wall (2.3–2.7 s → 2.7–3.0 s, headless, loaded machine).
Studio `close-view/ground`, `close-view/trunk`. Tests: `paint-ground.test.ts` (marks stay on the
grass).
