# ADR 0181 — Tips ride with the page and wait for room

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0124 (one tip at a time)

## Context
Tips were a `position: fixed` layer, re-placed on the next animation frame after every scroll. In
the calendar screenshots the sound tip floated in the middle of the calendar, and a second tip
showed as a faint ghost over the Garden tools heading. The causes:
- a note was placed one frame late during the custom smooth scroll;
- a note whose preferred sides did not fit fell back to its first side anyway, off screen or over
  unrelated content;
- a leaving note (700 ms fade) stayed at its last fixed position while the page scrolled away;
- a control that exists twice (corner and dock) swapped notes with the two overlapping;
- the slip's small rotation, applied through `transform` together with the position, swung notes
  sideways far down the page.

## Decision
- **Document coordinates.** Page notes live in an absolutely positioned layer at the document's
  origin (`.tips`), so they scroll with the page natively and stay on their control with no
  per-frame work. Notes inside a sheet keep the sheet's fixed layer. Positions use the CSS
  `translate` property, which applies outside the slip's `rotate`.
- **Placement is pure** (`ui/tip-place.ts`). A note is placed only when its control is wholly on
  screen and the note fits on one of its preferred sides without covering other slips on the
  painting or the dock's section headings. Otherwise `placeTip` returns `null` and the tip waits.
  For a control that exists twice, the candidates are tried in order (the dock's copy, then the
  garden's), so the note goes to a copy that is on screen and has room. The dock's tool list
  counts as one slip: a note sits below or above the whole row.
- **No ghosts.** A note that has faded out has `visibility: hidden` and stops painting. A new note
  never shares the page with one still fading out: that one is removed at once. A note that moves
  to another host is replaced at once.
- Notes also step aside while a plant's card is open, as they do for the quiet line.
- A page note is no longer dimmed by the garden's light. Only notes on the painting are.

## Consequences
Scrolling only decides again *whether* a note shows. Some tips now wait longer, until their control
is on screen with room. That is the point of "one quiet thing at a time".
