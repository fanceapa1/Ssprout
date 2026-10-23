# ADR 0190 — Sheets sit on a leaf of washi and lock the page

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0051 (dialog strategy), ADR 0131 (custom smooth scroll)

## Context
On desktop the planting sheet's backdrop was a 40 % paper tint, so the dock's text read beside and
under the sheet. The sheet's sticky footer was painted edge to edge in opaque paper, so it covered
the slip's torn bottom edge, and the sheet seemed to run off into the dock below it. The page under
an open sheet still scrolled: the smooth scroll stood aside while a modal was open, and the wheel
over the backdrop then scrolled the document natively.

## Decision
1. **A leaf of washi behind every sheet.** `dialog.sheet::backdrop` is the page's own paper tile
   (`--page-paper`) at 0.965 opacity, not a grey scrim or a blur. The garden is a ghost and no
   dock text is legible beside or below the sheet. It is paper laid over paper.
2. **The page is locked.** `html:has(dialog.sheet[open]:not(.is-closing)) { overflow: hidden }`
   stops wheel, keys and touch from scrolling the page, whichever sheet is open (planting,
   schedule, pressed flowers, garden data, hints). The smooth scroll already ignores input while a
   modal is open. Programmatic scrolls (placement's glide to the top) still work. The page is free
   again while a sheet fades out.
3. **The torn edge is drawn over the content.** `dialog.sheet::after` paints the slip's outline
   alone (`--slip-dense-edge-*`, the same seeded path as the fill), and the planting footer stops
   short of it. The sticky footer no longer hides the bottom edge.
4. **Focused inner scrollers keep their keys.** The smooth scroll leaves arrow, page, Home/End and
   Space keys to a focused element that can still scroll that way (`keyDirection` +
   `innerScroller`). This applies to the calendar's hours and a plant card's long story (ADR 0191).

## Consequences
- A sheet reads as the only thing on the page. The page keeps its scroll position under it.
- `tests/e2e/overlays.spec.ts` covers the veil, the lock (wheel beside the sheet, PageDown/End/
  Space), the sheet's own wheel scrolling and the unlock on close. It runs for every sheet.
  `src/ui/smooth-scroll.test.ts` covers the key hand-off.
