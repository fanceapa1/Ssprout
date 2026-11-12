# ADR 0367: The coast's scenery olive is the olive species' own tree

- Status: accepted
- Date: 2026-11-12
- Builds on: ADR 0341 (lazy painters), ADR 0330 (paint parts), devlog 171 (the olive species)

## Context
The big olive on the coast's top terrace at (1290, 540) is scenery, not a slot. The tree slot
`top-1` (1020, 548) takes a planted olive, so the two trees stand side by side in the
garden's signature view. A scenery olive painted with its own marks would look like a different
kind of tree next to the planted one. The species already paints a good olive (devlog 171): a
fluted, twisted trunk and a broken, silver crown.

## Decision
- The scenery olive is `planOlive(createRng(OLIVE_TREE.seed))` at growth 1, painted with the
  species' own helpers (`paintSkeleton`, `paintOliveTrunk`, `paintOliveLeaves`) and its
  colours. Its box units map onto the world, `scale` 1.12, base on `OLIVE.base`
  (`coast/shapes.ts` › `OLIVE_TREE`).
- `paintOlive` (`coast/paint-veg.ts`) runs the species' layers one per part. The leaves and the
  silver leaves are each split in two halves, left and right of the trunk. The scenery adds paper
  under the trunk, its own shadow cast right on the gravel, and a clip at the sole (the trunk's
  layers leave a pale box below it on a painted ground).
- The olive's trunk and scaffold limbs, the wildlife's perches, are a literal in `shapes.ts`
  (`OLIVE_LIMBS`), so eager data never imports the species' painting code. `veg.test.ts` checks
  the literal against the plan.

## Consequences
- The scenery olive and a planted olive are the same tree, at a larger size and from another
  seed.
- A change to the olive species' plan or painters changes the scenery. `veg.test.ts` then fails
  until `OLIVE_LIMBS` and the recording hash are updated.
- The paint version (ADR 0227, 0251) now hashes `plants/species/olive.ts` and the `plants/lib`
  files it imports, because a cached painter imports them. A change to the olive species repaints
  the cached sceneries once. `paint-version.test.ts` allows exactly what the scene and sceneries
  import from the uncached folders.
- The species' trunk dries its layers over the scaffold limbs' box. That part is about 514 k
  pixels at a 1.6× close view, over the 400 k the other parts keep to; the test allows it for the
  olive only.
