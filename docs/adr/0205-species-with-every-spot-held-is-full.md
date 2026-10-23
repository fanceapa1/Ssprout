# ADR 0205 — A species with every spot held is shown full, not offered

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0053 (planting sheet), ADR 0150 (held slots)

## Context
Q1: "the lotus is still offered in the planting sheet but can't be planted". Since `water-1` and
`water-3` became large (commit 106d830) the lotus plants fine through the real flow at every
viewport, with a fresh or a full garden (finished plants are swaps). The report repeated a stale
known-issue line. One real dead end remained: with parallel sessions, slots holding another
session's seedling are left out of `placementOptions` (ADR 0150). The lotus fits only two slots,
so two seedlings there (two water lilies, an iris on the water) leave it nowhere. The sheet still
offered it, and placement mode then said "There is no spot where Lotus can grow just now" with
Begin disabled.

## Decision
The planting sheet asks `controller.placementOptions` for every unlocked species when it renders
its cards. A species with none is shown like a locked card (`data-full="true"`, `aria-disabled`,
greyed) with the line "Its spots all hold growing seedlings just now", and cannot be chosen. A
draft holding such a species is cleared. Slot geometry is unchanged: more large water slots would
crowd the pond at 1.25× (ADR 0148).

## Consequences
The reason shows before the gardener commits to a plant. Rendering the cards costs one
`compatibleSlots` pass per species (25 × 52 slots, negligible next to the previews). Tests:
`src/plants/plantable.test.ts` › lotus (Q1); `tests/e2e/lotus.spec.ts`.
