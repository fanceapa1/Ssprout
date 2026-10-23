# ADR 0183 — Week blocks at their drawn size, short times, and a deliberate first day

- Status: accepted; amended by ADR 0210 (wall-clock face)
- Date: 2026-10-23
- Amends: ADR 0175 (calendar section)

## Context
In the weekly view:
- one-line planned blocks at the same time drew over each other ("Japanese kanji" and
  "Statistics pr…"), with the "now" seal drawn over the words;
- narrow blocks truncated to "Pia…" or "Jap…" and lost their time;
- the week starting on Sunday in en-US looked accidental.

## Decision
- **Layout at the drawn size.** Blocks are drawn at least `MIN_BLOCK_MS` long: 26 min in a day
  (one line) and 44 min in a week (time over title, two lines at 56 px per hour). The overlap
  layout uses the same minimum, so blocks that *look* concurrent share the column side by side.
- **The seal in the line.** The vermilion "now" seal (due, growing) sits before the time, never
  in a corner over the title.
- **Short times in a week.** "4:10" rather than "4:10 PM": the hour rail beside it already says
  which half of the day it is. 24-hour locales are unchanged (`shortTime`).
  - Every week block shows its time.
  - Long blocks wrap the title onto a second line.
  - Phones show the first letters fading out at the block's edge instead of "…".
- **Read it whole.** A hovered or focused narrow block grows to at least 10.5 em (8.5 em on
  phones), on its own paper above its neighbours. Week blocks are focusable. On the last two days
  of the week the block grows toward the left. The native tooltip keeps the full label.
- **First day of the week: the locale's, on purpose.** `localeWeekStart(navigator.language)` reads
  `Intl.Locale` week info: Sunday in en-US, Monday in en-GB and fr, Saturday in ar-EG, and Monday
  when unknown. The calendar agrees with the gardener's own system calendar. Unit tests cover
  several locales. E2E tests set the Playwright `locale` to en-US and en-GB and check the week and
  the month.
- The hour rail is wider (66 px, or 60 px under 860 px), so "10 AM" is never clipped.

## Rejected
- A cascade, with later blocks offset over earlier ones: at the same start time the earlier text
  is still hidden.
- A fixed Monday start: right for most of the world, wrong for the owner's en-US system calendar.
