# ADR 0157 — The floating card follows the active session and can switch

- Status: accepted (amends ADR 0093)
- Date: 2026-10-23

## Context
Phase 7: the widget, tab title, favicon and notifications follow the active session; the widget
should allow switching "if it's cheap". The card is 260 × 340 px with one row of buttons; in a
break it already holds Water, Skip break and Pause.

## Decision
- All surfaces read `controller.status()`, whose `session`/`phase`/`timeline` are the active
  session's (ADR 0150), so the title, favicon, notifications and card follow it with no change.
  Notifications only ever concern the active session (the controller announces blocks and
  completion for it alone).
- Switching is cheap, so the card offers it: `WidgetStatus.sessions` (optional) lists the sessions in
  progress and `WidgetController.switchTo` is optional. With another session in progress, focus and
  paused cards add a quiet **Switch** that goes to the next session in start order (cycling, so
  every session is reachable from the one button); break cards do not (the row is full and a
  break is a moment for the plant). With none active, the idle card names who waits and offers
  **Resume** on the session left last (ADR 0152); a bloom card keeps "Open garden" first and adds
  Resume beside it.
- A `session:switch` drops a bloom still shown; the switched-to plant grows in from seed on the
  card, as for any new plant.

## Rejected
- A list of sessions on the card: no room without shrinking the plant, which is the card's point.
