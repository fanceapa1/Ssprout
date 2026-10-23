# 26 — Q1: the lotus is plantable

## What
- Reproduced the report through the real flow with real species (`tests/e2e/lotus.spec.ts`):
  60 min → Lotus → only `water-1` and `water-3` glow (both on screen) → choose one → Begin → the
  session holds the lotus and its seedling is drawn and hit-testable in the pond. It passes. A
  throwaway probe also passed at 390×844, 360×740 and 844×390, and with 60 finished plants
  (the two spots are then swap markers).
- **Root cause of the report:** commit 106d830 fixed the slots but did not update SPEC, TESTING
  (matrix and open gap 1) or `docs/systems/plants.md`. Devlog 23 copied the known-issue line from
  them. Those docs are corrected now.
- **The one real dead end:** slots holding another session's seedling are not offered (ADR 0150).
  The lotus fits only two slots, so two seedlings there left it offered in the sheet with no spot
  in placement mode. The sheet now shows such a species greyed and not choosable, with "Its spots
  all hold growing seedlings just now" (ADR 0205, `src/ui/planting-sheet.ts` plus three selectors
  in `src/ui/ui.css`).
- `src/plants/plantable.test.ts`: the lotus fits exactly `water-1`/`water-3`, and has no spot only
  when both are held.
- Looked at the lotus at 1.25× in both slots (`npm run shots`, desktop, phone and a close view of
  `water-3`): pads lie on open water clear of the rim, and the far lotus reads in front of the shore
  irises. No geometry change.

## Left
- Nothing for Q1. Water lilies and irises may still take the large water slots first. That is the
  gardener's choice, and the sheet now explains it.
