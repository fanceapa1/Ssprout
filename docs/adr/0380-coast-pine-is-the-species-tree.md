# ADR 0380: The coast's scenery pine is the Aleppo pine species' tree, pruned and leaning out

- Status: accepted
- Date: 2026-11-13
- Builds on: ADR 0367 (the scenery olive is the olive species' tree), ADR 0330 (paint parts)

## Context
The leaning pine at the coast's left edge was painted with its own marks: dark flat pads on
horizontal branches, so it read as a Japanese black pine. Its foot stood at x 30, deep in the
paper margin's lift (0.6–0.85), so its bark barely showed. The `aleppo-pine` species (devlog 187)
paints a good Aleppo pine. Three things box the tree in:
- **The margin.** The lift is still 0.4–0.6 at x 100–120 and falls under 0.25 only past x 160.
- **The village and the chapel** sit on the far hill at x 100–376, y 300–392, right behind the
  tree's middle height.
- **The shared stars** (y 20–150) must stay off the crown, and **the slots** `beach-1`,
  `beach-5`, `splash-3` and `shallows-5` surround the beach's west end.

## Decision
- The scenery pine is `planAleppoPine(createRng(PINE_TREE.seed), { lean: -1 })` at growth 1, at
  1.9× its box with its foot on `PINE.base` (166, 762), on a low rock on the beach.
- **It leans out over the left edge, not in over the cove.** A foot this far in leaning right
  would put the trunk across the village. Leaning left, the trunk climbs from the beach past the
  village's left end, and the crown frames the corner.
- **The side branches below the fork are pruned**, with the needles and cones nearest them (a
  cliff pine's bare stem). Otherwise the species' low crown would cover the bay and the village.
  The seed (101) was picked by a probe: the trunk 30+ from every slot and left of the houses, no
  tuft near a shared star, the crown clear of the chapel.
- **The crown's marks are painted in world units at `marks` 1.3× the species' size**, not at
  1.9×. At 1.9× the tufts read as big cotton balls. At 1.3× they stay fine needle clouds with sky
  between them.
- **The scenery adds** its shadow cast right on the shingle, the rock, paper under the trunk, and
  an accent on the lower trunk: staggered red washes, a shaded right flank and scaly plates. With
  that, the bark reads through the margin's lift.
- **`PINE_TRUNK`, `PINE_BRANCHES` and `PINE_PADS` are literals** in `shapes.ts`, so eager data
  never imports the species. `veg.test.ts` checks them against `pineShapes()` (paint-veg.ts). The
  night's extra stars also keep off `PINE_PADS`.
- `shallows-5` moves from (140, 640) to (188, 650): it stays on its sand window, right of the
  trunk.

## Consequences
- The scenery pine and a planted Aleppo pine are the same species' tree.
- A change to the species' plan or painters changes the scenery: `veg.test.ts` fails until the
  literals and the recording hashes are updated. The paint version hashes
  `plants/species/aleppo-pine.ts` and `plants/lib/aleppo-pine-paint.ts`.
- The tree leans away from the sea. The brief asked for "in over the cove". The village, the margin
  and the slots leave no foot that does that and keeps the bark readable.
