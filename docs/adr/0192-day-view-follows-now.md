# ADR 0192 — Today's day view follows now

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0175 (the calendar section)

## Context
The day timeline opened near now (an hour and a half before it, in waking hours) but was never
moved again. A tab left open, or the dev clock, let now walk out of the window. The view also stayed
on yesterday after midnight.

## Decision
- When today's day view **opens with now in its window**, it *follows*. Every redraw (each minute,
  and on any refresh) checks a comfortable band (4 %–72 % of the window). When now leaves it, the
  window **glides** (1.4 s, sine in-out; at once under reduced motion) back to now minus 90
  minutes, the lead it opened with. Pure helpers: `followTarget`, `glideScroll`, `FOLLOW`.
- **The gardener's scroll wins.** A wheel, a touch move, a scrolling key on the hours, or any
  scroll we did not make stops the following. The view stays where they put it while the now line
  keeps moving. **Today**, opening a day, changing the view or stepping to another day resets it.
  Today's window then follows again if now is in it.
- **Past midnight**, a following day view turns to the new day and keeps following. It opens at now
  minus 90 minutes rather than at 8:00.
- Weeks and months do not follow (their now line still moves).
- `sprout.calendar.state().follow` reports it.

## Consequences
The calendar keeps up with a long-open tab without yanking a view someone is reading. Covered by
`calendar-model.test.ts` (band, target, clamping, glide) and three e2e tests in
`calendar.spec.ts` (keeps up, stays where scrolled, turns at midnight).
