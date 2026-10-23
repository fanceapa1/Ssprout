# ADR 0175 — The calendar section: a painted timeline and a month of dabs

- Status: accepted; amended by ADRs 0183, 0191, 0194, 0210 (wall-clock face)
- Date: 2026-10-23

## Context
The dock reserves a full-width Calendar section (ADR 0130). The owner wants Daily / Weekly / Monthly
views, daily by default, showing past sessions (cancelled faintly), sessions in progress and
scheduled ones (ADR 0005). It must stay paper and ink — not a SaaS calendar widget.

## Decision
- **Data is pure** (`ui/calendar-model.ts`): `viewRange(view, t, weekStartsOn)` (a day, a week, the
  whole weeks of a month grid), `shiftAnchor` (calendar days / weeks / months, DST-safe),
  `calendarItems(state, occurrences, range, now)` (logged sessions, sessions in progress, occurrences;
  an occurrence started as a session is merged into that session's item), `layoutColumns(items,
  minMs)` (clusters of transitively overlapping blocks share a column count; each takes the first
  free column; short blocks count as `minMs` so they never draw over each other), `dayFraction`,
  `dayMarks` (the month's marks), `openingMinute` (where the timeline opens), `minuteAt` (a tap,
  snapped to 30 min), `localeWeekStart` (from `Intl.Locale` week info, Monday when unknown).
- **Day and week** are one hour timeline in a scrolling window (9 hours tall; its edges fade like the
  garden's): hour numerals with a small ink tick and a whisper of dotted guide, not a ruled grid. A
  day opens 90 min before now on today in waking hours, else half an hour before its first item, else
  8:00; a week opens at its earliest item. The window keeps the reader's scroll on re-render; a new
  day or view (or `go`) opens it afresh. One day is a notebook column (≤ 640 px), not a full-width bar.
- **Blocks**: a past session is a soft wash in its plant's `bloomColor` — a deckled blot with a
  lighter heart and a pooled rim (`washSvg`), painted near its on-screen size (size buckets) so a long
  bar and a small square have the same edge. Pale blooms are pulled toward a grey-green
  (`washTone`). Ended early: the faintest wash, the title in muted italic. Growing: a lighter wash and
  a vermilion dot; waiting: desaturated. Planned: paper with a broken ink outline (`planSvg`): not yet
  painted. Passed (missed / let pass): the same outline, fainter, "passed". Text stays in the ink
  tokens (≥ 4.5:1) — faintness is in the paint, never in the words.
- **The now line** is a short vermilion stroke and dot at the start of today, and a 22 % line across,
  under the blocks: it never strikes a block out.
- **Month**: a grid of whole weeks; each day has its numeral (today in a vermilion brush ring), one
  pigment dab per bloom in the plant's colour (up to five, then "+n"), an ink ring per plan still to
  come (faint when passed), a hollow vermilion dab for a session growing, and the minutes studied in
  small italics. Tapping a day opens it in the daily view; so does a week's day head.
- **Head**: "Daily · Weekly · Monthly" as ink words, the chosen one with a vermilion brush underline;
  brush chevrons, "Today"; the range as a title with a quiet summary ("3 blooms · 2 h 15 studied · 1
  planned"); "Schedule a session" with a small seal dot.
- **The chosen view is remembered per viewer** in `localStorage` (`studysprout:calendar-view`,
  guarded; private mode keeps it for the page), not in the garden state: it is a preference of this
  browser, not of the garden.

## Consequences
- The calendar renders from the store, the scheduler's due changes and a 15 s check of the minute
  (the clock is read, never stored); it re-renders the whole view (tens of nodes).
- Studio section `calendar` redraws the same paths on canvas (`paintWash`, `paintPlan`).

## Rejected
- A canvas-drawn calendar: inaccessible and harder to test; the DOM with painted backgrounds reads
  the same.
- Full-width ruled hour lines and coloured event chips: the Google-Calendar look the owner ruled out.
