# ADR 0172 — Due, the grace window and missed

- Status: accepted
- Date: 2026-10-23

## Context
At the scheduled time the owner wants a soft notification and a waiting card with one-tap Start;
never an automatic start. If it is not started it is "quietly marked missed, with no guilt"
(ADR 0005). We need a rule for how long an occurrence waits, and it must be right after the tab
was closed (no server, ADR 0001).

## Decision
- An occurrence is **due** from its time `at` until `dueUntil = at + (length + 30) min`, where an
  open length counts as 30 min (so an hour). The longest window is 180 + 30 = 210 min
  (`MAX_DUE_MS`). After it the occurrence is **missed**.
  Reasoning: within its own length plus half an hour, starting late still fits the time the
  gardener set aside; a two-hour block can still be begun an hour in. Later than that, the moment
  has passed, and the next day's (or next week's) occurrence is the better invitation. The window
  never reaches the next occurrence (daily is ≥ 24 h apart).
- **Status is derived, never stored** (`occurrenceStatus(o, { now, inProgress, log })`):
  `upcoming` → `due` → `missed`; `dismissed` (let pass: "Not this time"); with a linked session
  (ADR 0173) `started` while it is in progress, `done` once it blooms, `ended` if it was ended
  early. Because it is derived from the clock and the state, a closed tab needs nothing: on return
  the card shows what is due now and the calendar shows what passed as missed.
- **Missed is quiet.** The calendar draws it as a ghost of the planned block (a faint broken
  outline, the name in muted ink, "passed"); there is no count, no streak, no notification, no
  copy about it anywhere else.
- **No early card.** The card appears at the time, not before; the calendar shows upcoming
  occurrences, and a scheduled block can be started early from its editor ("Start now").

## Consequences
- Dismissing is stored (a `dismissed` note); a dismissed occurrence looks like a missed one.
- An occurrence whose length is edited moves its window with it.

## Rejected
- **Until the end of the day**: an 8:00 plan still waiting at 23:00 nags; and a late-evening plan
  would get almost no window.
- **A fixed 15 minutes**: too tight for someone who sits down a little late to a long session.
- **Storing missed**: needs a writer at the right time (impossible while the tab is closed) and
  would disagree with the derived truth after an edit.
