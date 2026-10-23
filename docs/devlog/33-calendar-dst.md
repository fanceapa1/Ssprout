# 33 — The calendar day view on a daylight-saving day (Q13)

## What
This task fixed the two calendar bugs found in devlog 31 (TESTING.md gaps 7 and 8). The European
clocks go back on Sunday 25 Oct 2026.

1. **The day view opened an hour off on a DST day.** `openingMinute`, the block positions and
   the now line (`dayFraction`) placed time as elapsed ms since midnight over the day's real
   length. Following (`nowOffset`) and the hour labels used wall-clock minutes over 24 hours. At
   09:00 on 25 Oct (London), 10 h of a 25 h day put the now line at 9:36, and the window opened
   at 8:30. Five hours later, now still sat inside the band, so the window never glided.
2. **Following stopped after a redraw mid-glide.** All timelines shared one `lastSet`. When a
   redraw (`go`, a view change) replaced a timeline mid-glide, the old timeline's scroll event
   arrived after the new timeline had set `lastSet`. The listener read that event as the
   gardener's scroll.

## Changes
- `ui/calendar-model.ts`: `wallMinute`, `dayMinute`, `daySpan`, `layoutDay`. `dayFraction` and
  `openingMinute` now count wall minutes. The day's blocks are laid out by their drawn wall
  spans. `ui/calendar.ts` uses `layoutDay`, `wallMinute`, and a single `minuteOffset` for the
  opening scroll, the now offset and following.
- `ui/calendar.ts`: `setScroll` records each timeline's position in a `WeakMap`. The scroll
  listener ignores events from a detached or replaced timeline and from our own glides.
- **Decision (ADR 0210):** every day is a 24-hour wall-clock face. The skipped spring hour is an
  empty band. Both passes of the repeated autumn hour fold onto one band and sit side by side. The
  now line moves up an hour once at the autumn change, and following does not glide back for it.
- No styling or layout changed (`calendar.css` untouched). `main.ts` is untouched.

## Tests
- Unit, `calendar-model.test.ts` › daylight-saving days on the wall-clock face (Europe/London,
  29 Mar and 25 Oct 2026): day lengths against wall minutes, the now line and blocks on the clock's
  hour, the skipped band, the folded hour, side-by-side layout, and the opening window on both changes.
- E2E, `calendar.spec.ts` › calendar · a daylight-saving day (ADR 0210):
  - `timezoneId: 'Europe/London'`.
  - The dev clock jumps to the next last Sunday of October, which is 25 Oct 2026. A run after that
    date lands on a later year's change.
  - Covers: the view opens at the clock's hour with the now line on it; the window keeps up later
    in the day; following survives a redraw mid-glide (both `go` and a plain refresh); and only a
    wheel or a key on the hours stops following.
- The follow-now specs' `openAt` no longer waits for the hours to rest before redrawing.
- Proof:
  - Against the original code, three of the four new e2e tests fail: now line at 9.6 h, no glide,
    following lost.
  - With only fix 1, the mid-glide test still fails.
  - With both fixes, `calendar.spec.ts` (26 tests) passes with `E2E_CLOCK` = 00:30, 09:00, 17:00
    and 23:50.

## Left
- An hour-proof CI job (devlog 31) is still not added.
- The face is drawn as 24 rows in every time zone. A zone whose midnight is skipped starts the day
  with an empty band, which is consistent with the rule but not checked against such a zone.
