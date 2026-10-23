# ADR 0210 — The day timeline is a 24-hour wall-clock face

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0175 (the calendar section), ADR 0183 (blocks at their drawn size), ADR 0191 (the day view follows now)

## Context
The day and week timelines are 24 hour rows, labelled by the clock ("9 AM" at 9/24 of the
height). The opening window and the positions of blocks and the now line counted elapsed
milliseconds since midnight as a fraction of the day's length. Following counted wall-clock
minutes. On a daylight-saving day (23 or 25 hours) the two disagree by up to an hour. On Sunday
25 Oct 2026 at 09:00 in Europe/London the now line sat at 9:36, the window opened at 8:30 instead
of 7:30, and following waited too long to glide (devlog 31, TESTING.md gap 7). Schedules, the
editor and a tap on the timeline already used wall time (`HH:MM`).

## Decision
- **Every day is drawn as 24 wall-clock hours**, also when it is 23 or 25 hours long. An instant
  is placed at the minute the clock reads (`wallMinute`, `dayMinute`; 0 before the day, 1440
  after it). The hour labels, the now line, blocks, the opening window (`openingMinute`),
  following (lead, band, glide target) and a tap (`minuteAt`) all use these minutes.
- **The skipped hour (spring)** stays on the face as an empty band. Nothing can start in it. A
  block across it is drawn from the clock time it starts at to the clock time it ends at, so it
  spans the band. Its text keeps its real minutes.
- **The repeated hour (autumn)** is drawn once. Both passes fold onto the same band. Blocks are
  laid out by their drawn wall spans (`daySpan`, `layoutDay`), so a session in the first pass and
  one in the second pass sit side by side rather than on top of each other. A block that ends in
  the second pass at a clock time before its start is drawn at its elapsed length from its start.
- **The now line reads the clock.** When the clocks go back it moves up an hour once. Following
  does not glide back for it: an hour is 11 % of the 9-hour window, and now sits 17 % below the
  top after any glide. The band starts at 4 %, so now stays inside it.

## Alternatives rejected
- **Elapsed-time scale (the old behaviour, made consistent).** Labels would have to move (a 25 h
  day squeezes every hour), and taps, schedules and block times would no longer match the rail.
- **A 23- or 25-row face** with a skipped or repeated "1 AM" label. This is truer to elapsed time,
  but the grid height, week columns side by side, and every `HH:MM` conversion would depend on
  the day. It is a lot of layout for two days a year.

## Consequences
On any day, what the rail says, where the now line is drawn, and what a tap schedules agree.
Two days a year a block can look an hour longer (spring) or share its band with an hour-later
block (autumn). Covered by `calendar-model.test.ts` › daylight-saving days on the wall-clock face,
and by `calendar.spec.ts` › calendar · a daylight-saving day (pinned to 25 Oct in Europe/London).
