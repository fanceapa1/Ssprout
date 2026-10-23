# ADR 0190 — Overlays that read cleanly: sheets on a leaf of washi, the plant card on phones

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0051 (dialog strategy), ADR 0131 (custom smooth scroll), ADR 0167 (the plant card)

## Context
**Sheets.** On desktop the planting sheet's backdrop was a 40 % paper tint, so the dock's text read
beside and under the sheet. The sheet's sticky footer was painted edge to edge in opaque paper, so it
covered the slip's torn bottom edge, and the sheet seemed to run off into the dock below it. The page
under an open sheet still scrolled: the smooth scroll stood aside while a modal was open, and the
wheel over the backdrop then scrolled the document natively.

**The plant card.** On a 390 × 844 phone the docked card was capped at half the stage and scrolled
invisibly. Its last lines were cut ("25 minutes of study" half visible) with no sign that there was
more. The longest notes (the lotus, the spider lily) and a growing plant's three facts make the
tallest cards.

## Decision
### Sheets
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
   `innerScroller`). This applies to the calendar's hours and a plant card's long story.

### The plant card on phones
Options considered:
- Let the card grow past the stage into the dock. It would cover the Study heading, and part of the
  card would scroll off with the page.
- Shrink the type. It would fall below the dock's readability floor.
- **A tighter layout, a little more room, and scrolling inside the card with a visible cut.** This
  is the one taken.

What changes:
- The docked card may take **62 %** of the stage (was 50 %). The camera frames the plant in the
  rest (`inset()` reads the card).
- **Tighter on phones**: smaller gaps, the note at line-height 1.38, and the facts run on as one
  sentence.
- **The name stays and the rest scrolls** inside `.plant-story-body`. When there is more:
  - the words thin into the paper at the cut (a mask);
  - a small ink chevron sits on the cut, and a tap on it reads on. It is `aria-hidden`, because
    keyboard and screen reader users have the region instead;
  - the scrolling part becomes a focusable `role="region"` named after the plant, only while it
    scrolls;
  - at the top of a scrolled card the first line thins too.

  A new plant opens its card at the top.

## Consequences
- A sheet reads as the only thing on the page, and the page keeps its scroll position under it.
  `tests/e2e/overlays.spec.ts` covers the veil, the lock and the unlock, for every sheet.
  `src/ui/smooth-scroll.test.ts` covers the key hand-off.
- At 390 × 844 the longest note and a growing plant fit with no scrolling. At 360 × 740 they scroll
  with the mark. `tests/e2e/plant-card-phone.spec.ts` checks both sizes: the card stays on the
  stage, scrolls by keyboard to its end, and no line is cut. A tap on the mark reads on. Studio:
  `ui-camera/plant-card-docked-long`.
