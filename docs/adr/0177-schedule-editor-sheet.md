# ADR 0177 — The schedule editor: a washi sheet, open by default

- Status: accepted; amended by ADRs 0192, 0194
- Date: 2026-10-23

## Context
A scheduled session needs a name, a date and a time, and optionally a length and a plan (left open
to choose at start); repeats; edit, delete, and "this one only" versus "all following" (ADR 0005).

## Decision
- A modal washi sheet (`createSheet`, like the herbarium and garden data; `ui/schedule-sheet.ts`),
  opened from "Schedule a session" (today at the next half hour, or the shown day at 9:00), a tap on
  an empty time (that day, snapped to the half hour), or a planned block (edit).
- Fields: name (≤ 40, empty → "Study session"), native date and time inputs (accessible, the phone's
  own pickers), length as chips **Choose when I start** (default) · 25 · 50 · 90 · "or __ min"
  (10–180 in fives), plan (only with a length) as chips **Choose when I start** · the recommended
  plans, repeat as chips **Once · Every day · Weekdays · Every week**. Chip groups are radio groups
  with arrow keys.
- Saving an edit of a repeat asks inline: "Change only this one, or this and the following?"; a new
  repeat always applies from that day on (no question); a one-off just changes. Remove asks the same
  for a repeat ("Remove only this one, or this and the following?") and confirms a one-off. The
  actions are planned by `planEdit` / `planRemove` (ADR 0171).
- A plan for today that is upcoming or due offers **Start now** (the same prefilled start, ADR 0173).
- No plant or spot is asked for, ever.

## Rejected
- An inline popover anchored to the block: cramped on phones and fiddly to keep in view while the
  timeline scrolls.
- A free-text recurrence ("every other Tuesday"): beyond the four repeats the owner asked for.
