# ADR 0204 — One hover language for every control

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner ("give me hover effects on the UI buttons"), designed in dock
  wayfinding (devlog 25)

## Context
Hover states had grown one control at a time. Quiet buttons got a faint text underline. The seal
dimmed. The corner chips rotated and scaled up 4 %. The pill buttons got a grey disc. Some
controls had nothing. Keyboard focus showed an outline only, and touch kept hover states stuck
after a tap.

## Decision
One stylesheet, `ui/hover.css`, imported last, with shared tokens (`--hover-ms` 360 ms,
`--hover-ease`, `--hover-lift` −1 px, `--press-sink` 0.5 px, `--hover-wash`, `--hover-tint`) and
three families:
- **Ink: words that act.** This covers quiet buttons, calendar views and steps, picker steps and
  the pill's "+N". The ink deepens to `--ui-ink`, and a short brush stroke (`--brush-rule`) draws
  in under the word from the left. A word with a sprout before it gets the stroke under the word
  only. The chosen calendar view keeps its vermilion stroke.
- **Chip: things on a slip of paper.** This covers seals, the calm lead, Water, ink slips, the
  corner and zoom chips, the plant card's close mark, sheet cards and chips, the pickers' fields
  and chips, and the dock's tools. The slip lifts by one pixel, and a soft wash of shadow follows
  its deckled edge (a small `drop-shadow` that takes the slip's own alpha, so it is ragged like
  the paper). The seal's vermilion deepens a touch. On the painting the chip keeps its light
  dimming. The old rotate-and-scale on the corner chips is gone.
- **Sprout.** A sprout mark in a control (Start studying, Plant another, Schedule a session) opens
  its two leaves by 9°.

Every family has the same `:focus-visible` state (with the existing ink focus ring) and an
`:active` press (the slip sinks back, ink words lighten).

The rules for hover sit inside `@media (hover: hover)`, so a tap on a touch screen never leaves
a stuck state. Nothing is shown only on hover. The corner chips' labels also show on focus, as
before.

With `prefers-reduced-motion` only colour changes: no lift, no drawing stroke (it appears in
place), no leaves moving.

No glow, no scale-up, no gradient sweep (ART_DIRECTION anti-tropes).

## Consequences
Secondary words in the dock rest in the soft ink (≥ 4.5 : 1, `ink.test.ts`) and deepen on
hover. The primary action keeps the full ink (ADR 0201).
