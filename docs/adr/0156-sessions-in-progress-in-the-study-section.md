# ADR 0156 — Sessions in progress live in the Study section; the pill says "+2"

- Status: accepted (amends ADRs 0130, 0133)
- Date: 2026-10-23

## Context
Phase 7 needs a place listing the sessions in progress (a tiny live plant, task, progress, time
left, Switch / Resume), a way to start another session while one runs, a gentle answer at the limit
of three, and a hint on the garden that others are waiting. The dock is a registry of sections
(ADR 0130); the brief left "a new section or extend `session`" open.

## Decision
- **Extend the `session` ("Study") section** rather than register another one: the list is about the
  same thing as the controls above it, and a separate half-width section would break the two-column
  rhythm (Study | Your plant) and push Your plant away from the controls. `src/ui/session-list.ts`
  renders under `panel.el`:
  - shown with two or three sessions in progress, or with any waiting while none is active;
    heading "Growing now" (or "Waiting for you" when none is active);
  - one row per session in start order: a 64 px live painting (`renderPlantView` over a small round
    window wash, repainted only when its growth moves by ½ %; waiting ones a little desaturated),
    the task, a thin plan line with its progress, "18:40 left · waiting", and **Switch** (another is
    active), **Resume** (none is; the session left last gets a small seal, the others stay quiet —
    ADR 0152) or "growing now" on the active row;
  - "Plant another" (quiet, with a vermilion seed dot) while a session is active. At three in
    progress it does not open the sheet: a note says "Three seedlings are growing — as many as can
    grow at once. Switch to one of them, or let one bloom first." (polite live region) and focus
    moves to the first Switch. The pill's / dock's "Start studying" do the same at the limit.
  - With none active and others waiting, the idle "Start studying" becomes a quiet ink button and
    the idle line says who is waiting, so the Resume seal is the one suggestion.
- **Timer pill:** a quiet "+N" after the controls (and after "Start studying" when idle) when other
  sessions are in progress; it glides down to the Study section like "Session controls" (focusing
  the suggested Resume when nothing is active).
- **Your plant** follows the active session: on a switch it shows the new active plant;
  `session:water` / `session:cancel` for another session do not touch it.
- **Tip:** one quiet `switch` tip ("Several seedlings can grow at once. Switch to another — the one
  you leave simply waits.") on the first Switch while others wait; retired by the first switch.
  Priority after `notifications`, panel group (ADR 0124: one tip at a time).
- `UIState` gains `sessions` (`{ visible, rows, limit }`) and `pillMore`.

## Rejected
- Listing only the waiting sessions: the brief asks for the sessions in progress, and the active
  row ("growing now") anchors the list when it is long.
- A badge on the pill: noise on the painting; "+2" in the pill's own type is enough.
