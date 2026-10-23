# ADR 0124 — One tip at a time

- Status: accepted; amended by ADR 0181, ADR 0211
- Date: 2026-10-22

## Context
A fresh garden showed two notes at once ("Tap the speaker…" and the notifications note), during a
break the widget and watering notes both spoke, a sheet note stayed pinned in place while the
sheet scrolled under it, and on phones the speaker note landed on the bloom line.

## Decision
- `pickTips` shows **one** tip by default, by `TIP_PRIORITY` (placement, swap, water, task,
  duration, plan, notifications, widget, pressed, sound) among those whose control is in view.
  On first load that is the note by Start studying; the speaker's waits its turn.
- Sheet notes retire when their control is used — a task named, a time committed, a plan picked —
  so the next one can speak (they used to retire only at session start, so with one at a time the
  later ones would never have shown).
- A control counts as in view only while it is scrolled into its sheet's visible area; notes
  re-layout on scroll.
- Notes step aside while the quiet line is showing.

## Consequences
The ⓘ list still lists every tip; retirement rules for state-driven tips are unchanged (core).
