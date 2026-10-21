# ADR 0062 — A bud dissolves into its opening petals inside one render

- Status: accepted
- Date: 2026-10-22

## Context
A closed flower and an open one are different marks: a bud is one body (plus sepals), an open
flower is five to nine separate petal layers. Drawing the petals "closed" (all pointing along
the bud axis) as the bud looked wrong — five overlapping multiplied petals knot up into a
near-black spike — and switching from a bud mark to petal marks at a threshold pops.

## Decision
`bloom()` in `small-paint.ts` draws both during the opening: the bud body (swelling with `budK`,
greening → colour with `colourK`) fades out over the first half of `openK`
(`1 − smooth(openK / 0.55)`) and grows a little as it loosens, while the petals fade in over the
first third (`smooth(openK / 0.35)`) and swing from the bud direction to their open,
foreshortened poses (`petalPose`). The flower's view also turns: e.g. a violet bud hangs along
its hooked stem and the opening face turns toward the viewer. Species with very special buds
(balloon flower balloons, iris spears, spider-lily sheaths, clover balls) use the same
dissolve with their own bud mark.

## Consequences
Every growth step is a believable in-between, there is no threshold, and the continuity test
(ADR 0061) passes without special cases. Cost: during the opening window both bud and petals
are painted (a few extra drying passes for ~0.1 of growth).
