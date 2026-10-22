# ADR 0054 — One quiet line for completion and fauna arrivals; the UI announces on unlock

- Status: accepted; the arrival trigger changed by ADR 0120 (first sight, from the fauna system)
- Date: 2026-10-21

## Decision
A single line near the top shows one sentence at a time (~6 s, 900 ms fades), never while a sheet
or placement is open. Completion ("Your Japanese Iris for “Biology ch. 4” has bloomed.") jumps the
queue. Fauna lines come from the core unlock table (`FAUNA_UNLOCKS[].arrival`; no copy is
duplicated): the UI watches `newlyArrived(state)` and, when it shows a creature's line, calls
`controller.announceFauna(id)`. Silent creatures (striders) are recorded without a line. If the
fauna system later prefers to announce on first *sight*, it calls `announceFauna` itself and the UI
shows the line from the `fauna:arrived` event instead (it ignores its own calls).

## Consequences
Until the fauna system exists, "arrival" means unlock. A reload while a line is visible does not
repeat it (it was recorded when shown).
