# ADR 0191 — The plant card reads whole on phones

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0167 (the plant card)

## Context
On a 390 × 844 phone the docked card was capped at half the stage and scrolled invisibly. Its last
lines were cut ("25 minutes of study" half visible) with no sign that there was more. The longest
notes (the lotus, the spider lily) and a growing plant's three facts make the tallest cards.

## Options
- Let the card grow past the stage into the dock. It would cover the Study heading and part of the
  card would scroll off with the page.
- Shrink the type until it fits. It would fall below the dock's readability floor.
- **A tighter layout, a little more room, and scrolling inside the card with a visible cut.**

## Decision
- The docked card may take **62 %** of the stage (was 50 %). The camera frames the plant in the
  rest, as before (`inset()` reads the card).
- **Tighter on phones**: smaller gaps, the note at line-height 1.38, and the facts run on as one
  sentence ("24 % grown, 18:57 to go · 6 minutes studied so far · planted …").
- **The name stays and the rest scrolls** inside `.plant-story-body`. When there is more:
  - the words thin into the paper at the cut (a mask);
  - a small ink chevron sits on the cut. A tap reads on by most of a window. It is `aria-hidden`,
    because keyboard and screen reader users have the region.
  - The scrolling part becomes a focusable `role="region"` named after the plant, and only while it
    scrolls. Arrow, page and Home/End keys scroll it (ADR 0190).
  - At the top of a scrolled card the first line thins too.
- A new plant opens its card at the top.

## Consequences
At 390 × 844 the longest note and a growing plant fit with no scrolling. At 360 × 740 the card
scrolls with the mark. `tests/e2e/plant-card-phone.spec.ts` checks both sizes: the card stays on
the stage, scrolls by keyboard to its end, and no line is cut. A tap on the mark reads on. Studio:
`ui-camera/plant-card-docked-long`.
