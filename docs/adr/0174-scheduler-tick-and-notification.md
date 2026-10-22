# ADR 0174 — The scheduler's tick and the soft notification

- Status: accepted
- Date: 2026-10-23

## Context
At the scheduled time the gardener gets a soft notification (ADR 0005). The session controller
ticks only while a session is active (ADR 0032), and main-thread timers are throttled in
background tabs (ADR 0090). Notifications only fire while the page is not attended (ADR 0091).

## Decision
- The scheduler (`createScheduler`, `core/schedule-controller.ts`) has **its own subscription** on
  a `Ticker`, started while any schedule exists and stopped when none is left. `main.ts` passes
  the timer surfaces' **Web Worker ticker** (`surfaces.internals.ticker`): one worker, one
  `setInterval` per subscription id, so a background tab notices a due occurrence within a
  second, as it does a break. Without a worker it falls back to `setInterval`.
- Each tick runs `check()`: occurrences that are due now and not yet announced on this page emit
  `schedule:due { occurrence }` (once per occurrence key per page lifetime); when the set of due
  occurrences changes (one came due, one passed into missed), `onChange` listeners run so the
  waiting card and the calendar re-render without a store change.
- **Notification**: `createNotifier` listens to `schedule:due` and applies the same policy as the
  session moments (`decideNotification`: supported, granted, not opted out, not already notified
  for this occurrence, page not attended). Text: “It’s time for “<name>”.” / “Whenever you are
  ready, a card in your garden will start it.” Same tag (`renotify`), so it replaces any earlier
  note; the service worker focuses the app on click. The permission is still only asked at the
  first Begin (ADR 0091), never for a schedule.
- **Closed tab**: nothing (no server, ADR 0001). On return the first tick announces what is due
  (the page is attended, so no notification) and the card shows it; what passed is missed
  (ADR 0172).

## Consequences
- `WidgetEvent` gains `schedule:due` (contract.ts) and `NotifyKind` gains `scheduled`.
- A page reload re-announces a still-due occurrence to the notifier; it is attended then, so no
  second notification in practice.

## Rejected
- Driving the scheduler from the session controller's tick: it stops when no session is active,
  which is exactly when a scheduled session is most likely to start.
- A second worker for the scheduler: one inline worker already multiplexes subscriptions.
