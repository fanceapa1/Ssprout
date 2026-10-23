# ADR 0176 — The waiting card in the Study section, a slip above the pill

- Status: accepted; amended by ADRs 0194, 0201, 0203
- Date: 2026-10-23

## Context
At the scheduled time a card waits with one-tap Start (ADR 0005), "in the dock (and near the timer
pill, if that makes sense)". The garden stage fills ~88 % of the window, so the dock is usually
below the fold when the moment comes.

## Decision
- **The card** sits at the top of the Study section, above the controls — where starting already
  lives. One card per due occurrence (oldest first): "Planned for 3:40 PM", the name, "50 min ·
  Pomodoro" / "Time and plan chosen when you begin", a small seal **Start** and a quiet **Not this
  time** (lets it pass, ADR 0172). It disappears when started, let pass or missed.
- **The slip** sits on the garden just above the timer pill (lower-left on wide screens, centred on
  phones, like the pill, ADR 0133): "<name> · its time has come · Start". It dims with the garden's
  light (ADR 0121), rests with the pill while you focus, and steps aside while planting or placing.
- **At three in progress** (ADR 0150) the card offers no Start: "Three seedlings are already
  growing. When one blooms or you end one, this can begin — or switch to one of them now." and
  **See them** (the Study section's limit note, focus on the first Switch). The slip hides. When a
  session ends, the card offers Start again.
- Mounted by `createUI` into `dock.get('session').body` and `stage.layer` (`ui/schedule-card.ts`).

## Rejected
- A separate dock section for due sessions: another heading for a moment that lasts minutes.
- A modal at the scheduled time: the owner asked for something that waits, not something that
  interrupts.
