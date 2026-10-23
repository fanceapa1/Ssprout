# Calendar & scheduling

Phase 8 (ADR 0005; ADRs 0170–0177). The dock's **Calendar** section shows what was studied, what is
growing and what is planned, by day, week or month; scheduled sessions wait for one-tap Start at their
time; nothing starts on its own.

```
core/schedule.ts             the model: a rule + per-occurrence notes; recurrence, status, prefill, validation (pure)
core/schedule-reducer.ts     schedule/* reducers; planEdit / planRemove ("only this one" / "this and following")
core/schedule-controller.ts  createScheduler: the API, the due tick, `schedule:due`
ui/calendar-model.ts         ranges, items, overlap layout, month marks, opening window (pure)
ui/calendar.ts · calendar.css · calendar-art.ts   the section, its look, the painted shapes
ui/schedule-sheet.ts         the editor (a washi sheet)
ui/pickers.ts                its painted day and time pickers, in the calendar's formats (ADR 0192)
ui/schedule-card.ts          the waiting card (Study section) and its slip above the pill
ui/planting-sheet.ts         applyPrefill / clearPrefill (the prefilled start)
widget/notifications.ts      the soft notification on `schedule:due`
dev/schedule-debug.ts · fill-history.ts            sprout.schedule, sprout.calendar
ui/calendar.studio.ts        studio section `calendar`
```

## Wiring (`main.ts`)
```ts
const surfaces = createTimerSurfaces({ controller, store, bus, clock });
const scheduler = createScheduler({ store, clock, bus, ticker: surfaces.internals.ticker }); // worker ticks (ADR 0174)
const ui = createUI({ …, schedules: scheduler });   // fills the calendar, mounts the card, links starts
```
Without `schedules` the UI keeps the calendar placeholder hidden (ADR 0130).

## The model (ADRs 0170–0171)
`state.schedules: Schedule[]` — `{ id, name, date: 'YYYY-MM-DD', time: 'HH:MM', lengthMinutes | null,
planId | null, repeat: 'none' | 'daily' | 'weekdays' | 'weekly', until | null, notes, createdAt }`.
Dates and times are local wall time. `notes[date]` records what happened to one occurrence: `skipped`,
`dismissed`, `sessionId` (started from it) or overrides (`name`, `time`, `lengthMinutes`, `planId`).
Occurrences are expanded on the fly: `expandSchedules(list, { from, to })` walks calendar days, so a
9:00 daily stays at 9:00 across DST. No schema bump: `schedules` is optional in v2 documents.

| Repeat | Occurs on |
|---|---|
| `none` | its date |
| `daily` | every day from its date |
| `weekdays` | Monday–Friday from its date (a weekend start first occurs the next Monday) |
| `weekly` | the weekday of its date |

Edits (`planEdit`, `planRemove`): one-offs change in place; "only this one" writes a note (a move to
another day skips this one and adds a one-off); "this and following" updates the rule at the first
occurrence and splits the series later (`until` + a new schedule carrying the later notes); a new
repeat always means "this and following".

## Status (ADR 0172)
`occurrenceStatus(o, { now, inProgress, log })`, derived, never stored:

| Status | When |
|---|---|
| `upcoming` | before its time |
| `due` | from its time until **its length (30 min when open) + 30 min** (`dueUntil`) |
| `missed` | after that, never started |
| `dismissed` | "Not this time" |
| `started` / `done` / `ended` | linked session in progress / bloomed / ended early |

A closed tab needs nothing: on return the card shows what is due and the calendar what passed.

## The scheduler (`createScheduler`)
`add(input)`, `edit(ref, edit, scope)`, `remove(ref, scope)`, `dismiss(ref)`, `link(ref, sessionId)`,
`get(ref)`, `occurrences(range)`, `due()`, `next()`, `check()`, `onChange(fn)`, `onTick(fn)`,
`setTicker`, `setSeed`, `dispose` — `ref = { scheduleId, date }`. Ticks only while a schedule exists;
`check()` emits `schedule:due { occurrence }` once per occurrence per page and calls `onChange` when
the set of due occurrences changes.

## At the scheduled time (ADRs 0173, 0174, 0176)
1. The worker tick finds it due → `schedule:due` → the notifier shows "It’s time for “<name>”." if the
   page is not attended (same policy as breaks, ADR 0091).
2. A **card** waits at the top of the Study section, and a **slip** above the pill on the garden:
   **Start** · **Not this time**.
3. **Start** opens the planting sheet with `startPrefill(o)` applied to the draft: the name; the
   length and plan when given (else the remembered total and the usual first plan); plant and spot are
   chosen now. The draft keeps `link`.
4. **Begin** → `controller.start(…)` → `scheduler.link(link, newSessionId)`. The occurrence is
   `started`, then `done` when the session blooms; the calendar draws it as that session's block with
   "as planned".
5. **At three in progress** the card says so and offers **See them** (the limit note and Switch).

## The calendar (ADR 0175)
- Views: **Daily** (default), **Weekly** (seven columns, the locale's first day — deliberately, as the
  gardener's own calendar: Sunday in en-US, Monday in en-GB, Monday when unknown; ADR 0183),
  **Monthly** (whole weeks). Prev / Today / next. The choice is remembered in `localStorage`
  (`studysprout:calendar-view`).
- Day and week: an hour timeline in a 9-hour window that opens near now (today, waking hours), at the
  first item, or at 8:00. **Today's day follows now** (ADR 0191): opened with now in the window, every
  redraw checks a band (4 %–72 % of the window) and glides (1.4 s; at once under reduced motion) back
  to now − 90 min when now leaves it. A wheel, a touch move, a scrolling key on the hours or a scroll
  we did not make stops following; Today, another day or another view resets it. Past midnight it
  turns to the new day, still following. Pure: `followTarget`, `glideScroll`, `FOLLOW`.
- The hours are redrawn every minute; keyboard focus on a block, a day or the hours is put back on
  the same control after a redraw.
- On a phone's day, sessions side by side (three in progress overlap) keep a short time and the
  first letters of the title, and a touched or focused one grows to read whole (leftwards in the
  last column); blocks sharing a column are focusable in a day too. Blocks are laid out side by side when they overlap (`layoutColumns`), at their
  drawn size: at least 26 minutes tall in a day, 44 in a week (`MIN_BLOCK_MS`, ADR 0183). In a week a
  block shows its short time ("4:10", `shortTime`) over its title (two lines when long; first letters
  fading out on phones), the "now" seal sits before the time, and a hovered or focused block grows to
  read whole (leftwards on the last two days). A tap on an empty time opens the editor there (snapped to 30 min).
- Blocks: washes in the plant's colour (bloomed), lighter (growing / waiting), faintest (ended early);
  planned as a broken ink outline; passed as a fainter outline with "passed".
- Month: a dab per bloom, an ink ring per plan (faint when passed), minutes studied; tap a day → daily.
- The summary line: blooms, time studied and plans in the range.

## The editor's pickers (ADR 0192)
The native `<input type=date|time>` followed the operating system's locale; the pickers speak the
calendar's (`Intl`, the browser's language). Each is a field button (named by its label and value,
`aria-expanded`, `data-value`) that unfolds a panel inline under the "When" row, one at a time:
- **day**: a month grid (`role=grid`, `aria-selected`, `aria-current="date"`, full-date names);
  arrows by day and week, Home / End, PageUp / PageDown by month (Shift: year), Enter or Space
  chooses, Esc folds; the chosen day has the brush ring, today the brush underline;
- **time**: radio groups of paper chips for Hour (12, 1 … 11 or 00 … 23), Minutes in fives (an
  odd one keeps its chip) and, on a 12-hour clock, the locale's AM / PM; arrows choose; Done or
  Esc folds.
Esc in a panel never closes the sheet. Values stay `YYYY-MM-DD` / `HH:MM`.

## Debug API (`?dev`)
`sprout.schedule`: `add(input?)` (defaults: "Planned session", the next minute, open length, once),
`list()`, `occurrences(from?, to?)` (dates or ms; default this week), `due()`, `get(key)`,
`jumpToDue(scheduleId?)` (jumps the dev clock to the next occurrence and runs the check), `jumpPast(key)`
(past its window → missed), `edit(key, edit, scope?)`, `remove(key, scope?)`, `check()`,
`fillHistory(days = 30, seed?)` (a realistic log), `demo({ days?, hour? })` (moves the dev clock forward to
the next 16:10, today or tomorrow, so it always opens at the same time of day with the 15:40 daily
due; adds 35 days of history and three schedules). `sprout.advanceTo('HH:MM')` pins the time of day
before anything else that depends on the hour (docs/TESTING.md › Conventions).
`sprout.calendar`: `state()` (`{ view, date, weekStartsOn, title, days, follow, items: [{ id, kind, status, date,
title, occurrence, occurrenceStatus }] }`), `setView(view)`, `go(date)`.
`sprout.ui.state()` also has `calendar`, `due` (`{ due: keys, mode: 'start' | 'limit' | null, slip }`) and
`scheduleSheet` (`{ mode, date, time, ask, occurrence }`).

Screenshots: `npm run shots -- --eval "sprout.reset(); sprout.schedule.demo(); sprout.setTime('noon'); sprout.calendar.setView('week'); await sprout.ui.scrollTo('calendar', { instant: true })"`.

## Tests
Unit: `core/schedule` (recurrence, exceptions, DST in Europe/London, due / missed / done, prefill,
validation), `core/schedule-reducer` (reducers, edits and removals by scope), `core/schedule-controller`
(due tick and event, closed-tab return, dismiss, link → done / ended, refs), `core/persistence` (schedules
round-trip, validation, v2 without schedules), `core/tips` (`schedule`), `ui/calendar-model` (ranges, DST
week, items and merging, overlap layout, opening window, taps, month marks), `ui/prefill`,
`widget/notifications` (scheduled), `widget/ticker` (the worker drives the scheduler), `dev/fill-history`,
`ui/calendar-model` › following now, `ui/pickers` (formats, time parts, grid keys, the pickers in
jsdom).
E2E: `tests/e2e/calendar.spec.ts`.
