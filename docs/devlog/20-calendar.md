# 20 — Calendar & scheduling

## What
Phase 8 (ADR 0005): the dock's Calendar section, scheduled sessions with repeats, and what happens
at the scheduled time. ADRs 0170–0177; details in `docs/systems/calendar.md`.

- **Model** (ADRs 0170, 0171): `state.schedules` — a rule (`date`, `time` in local wall time,
  `repeat`: once / daily / weekdays / weekly, `until`) plus per-occurrence notes (skipped, let pass,
  the session it became, edits for that day). Length and plan are optional (`null` = chosen at
  start); plant and spot are never part of a schedule. Occurrences are expanded on the fly by pure,
  DST-safe functions (calendar-day steps; tested in Europe/London across both 2026 changes). No schema
  bump: the key is optional in v2 documents; import/export validate it.
- **Edits** as pure planned actions: one-offs change in place; "only this one" writes a note (a move
  to another day = skip + a new one-off); "this and the following" updates the rule at the first
  occurrence or splits the series (`schedule/split`); a new repeat always applies from that day on.
- **Due, missed, done** (ADR 0172): derived, never stored. Due from the time until its length (30 min
  when open) + 30 min, then missed — quietly, a ghost outline with "passed". A session started from a
  plan links back through a note; the occurrence is then started → done (bloomed) or ended.
- **Scheduler** (`createScheduler`, ADR 0174): the API; ticks on the widget's Web Worker ticker while
  any schedule exists; `schedule:due` once per occurrence → the notifier's usual background-only soft
  notification ("It’s time for “Essay draft”.").
- **Waiting card** (ADR 0176): at the top of the Study section, and a slip above the timer pill —
  Start / Not this time. Start opens the planting sheet prefilled (ADR 0173: name, length and plan when
  given; plant and spot chosen now). At three in progress the card says so and offers the sessions.
- **Calendar** (ADR 0175): Daily (default) / Weekly / Monthly, remembered per viewer in
  `localStorage`; prev / Today / next. Day and week: an hour timeline in a 9-hour window that opens
  near now, at the first item or at 8:00, overlapping blocks side by side. Blocks are washes in the
  plant's `bloomColor` (painted near their on-screen size, pooled rim, lighter heart); planned ones a
  broken ink outline; ended early and passed as ghosts with readable ink words. Month: a pigment dab per
  bloom, an ink ring per plan, minutes studied, today in a vermilion brush ring. A tap on an empty time
  or "Schedule a session" opens the editor (ADR 0177): name, date, time, length and plan open by
  default, repeat chips, "only this one / this and the following", Start now for today's plans.
- **Tip**: one quiet `schedule` tip by "Schedule a session" after the first bloom, until something is
  planned.
- **Dev API**: `sprout.schedule` (`add`, `list`, `occurrences`, `due`, `get`, `jumpToDue`, `jumpPast`,
  `edit`, `remove`, `check`, `fillHistory`, `demo`) and `sprout.calendar` (`state`, `setView`, `go`).
- **Studio**: section `calendar` (washes, day / week / month fixtures, the waiting card and slip).

Shared files touched outside `src/core/schedule*` / `src/ui/calendar*` / `src/ui/schedule*`:
`src/main.ts` (+5 lines: the scheduler on `surfaces.internals.ticker`, `schedules` into `createUI`, the
dev hook), `src/ui/index.ts` (fill the calendar, mount the card and slip, `openPlanting(opener, prefill)`,
link on Begin), `src/ui/types.ts` (`schedules?`, `PlantingDraft.link`, `UI.calendar`, state fields),
`src/ui/planting-sheet.ts` (`applyPrefill`, `clearPrefill`), `src/core/state.ts`, `persistence.ts`,
`events.ts` (`schedule:due`), `tips.ts`, `src/ui/format.ts` (tip priority), `src/widget/contract.ts` and
`notifications.ts`, and one line in `src/ui/ui.css`: the idle pill's "Start studying" no longer wraps on
phones (it was squeezed by `left: 50%`).

## Why / decisions
- Rule + notes instead of RRULE or stored occurrences: four repeat kinds, cheap expansion for any
  range, and edits that stay small.
- Status derived from the clock and the state: right after a closed tab without any writer, and it
  can never disagree with an edit.
- The link lives in the schedule's note, not on the session or the log: the session controller,
  `ActiveSession` and `SessionLogEntry` stay as they were.
- Grace window = length + 30 min: starting a little late still fits the time set aside; after that the
  next occurrence is the better invitation (ADR 0172 has the rejected alternatives).
- Card in the Study section (where starting lives) plus a slip by the pill, because the dock is below
  the fold when the moment comes.

## Tests
- Unit: `core/schedule` (20), `core/schedule-reducer` (12), `core/schedule-controller` (8),
  `core/persistence` (+8), `core/tips` (+1), `core/events` (count), `ui/calendar-model` (15),
  `ui/prefill` (4), `widget/notifications` (+3), `widget/ticker` (+1), `dev/fill-history` (1).
- E2E: `tests/e2e/calendar.spec.ts` (11): views and navigation (daily by default, remembered),
  schedule from the calendar + daily repeat, tap on an empty time, waiting card → prefilled sheet →
  begin → done after the bloom, missed and Not this time, the limit of three, edits by scope and
  removal, past sessions, the tip, the background notification, the phone layout. `ui-shell` now
  expects the calendar filled and full width.
- Screenshots reviewed (`artifacts/shots/`, `sprout.schedule.demo()`): `cal-day`, `cal-week`,
  `cal-month` at 1440×900 and 390×844, `due` / `due-dock` (the slip and the card, desktop and phone),
  `night` (slip and card under the night light), `sheet` (the editor, desktop and phone),
  `studio-calendar`. Iterations: first washes were stretched 1000-unit blots (torn-tape edges on wide
  bars) → painted near their size; blocks clipped their second line → 56 px hours, time and title on
  one line (stacked in the week); the now line struck out a growing block → a short stroke at the
  start and a whisper across, under the blocks; a day was a full-width bar chart → a 640 px notebook
  column; pale blooms vanished in the month → `washTone`; hour labels clipped on phones → wider rail;
  the week opened at night on empty hours → it opens at its earliest work.

## Left / for others
- Dragging a planned block to move it; editing from the month view directly (it opens the day).
- The tips system briefly showed the sound tip at a stale position right after an instant scroll in
  screenshots (it settles after a moment); not part of this task.
- No notification while the tab is closed (no server, by design).
- The week view on a phone is narrow (titles become a few letters); a day is one tap away.
