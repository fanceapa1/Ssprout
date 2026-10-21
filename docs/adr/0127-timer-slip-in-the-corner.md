# ADR 0127 — The timer slip lies in the lower-left corner on wide screens

- Status: accepted
- Date: 2026-10-22

## Context
At the bottom centre the panel covered the stepping-stone path — the painting's leading line —
and while resting (low opacity) its digits sat on top of the stones, unreadable.

## Decision
On wide landscape screens (`min-width: 900px` and aspect ≥ 5/4) the panel is a 360 px slip in the
lower-left corner, where the painting has already dissolved into bare paper. `meadow-8` moved up
out from under it. Phones and portrait tablets keep the bottom-centre sheet. The resting opacity
is 0.26 (was 0.2) so the time still reads at a glance on paper.

## Consequences
The dev widget harness moved to the bottom-right so it does not cover the slip.
