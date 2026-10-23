# ADR 0203 — The timer pill moves to the top-left and steps aside for the dock

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner ("the two 'start studying' buttons are really close to each other and it
  looks dumb, think of another placement"), designed in dock wayfinding (devlog 25)
- Amends: ADR 0133 (the timer pill), ADR 0176 (the planned session's slip)

## Context
When idle, the pill sat in the lower left of the garden on wide screens, and at the bottom centre
on phones. That put it just above the dock's Study section, so scrolling a little showed two
identical "Start studying" buttons a few hundred pixels apart. The lower edge of the stage is also
where the stepping stones leave the painting and the guiding path begins (ADR 0202).

## Options
- Hide the pill's Start entirely when idle. But on first load the garden fills the screen and the
  dock's button is below the fold, so the garden would have no way to begin.
- Move the pill to the top-left only. On phones the top edge already holds five 46 px tool chips.
  There is no room for the pill beside them.
- Fade the pill only while the dock's controls are visible. This works at every width, but on wide
  screens the pill still sits in the path's way at the bottom.
- **Both: the top-left corner on wide screens, and stepping aside everywhere.** Taken.

## Decision
- **Wide screens** (≥ 900 px and landscape ≥ 5:4, the same query as before): the pill sits in the
  **top-left corner**, mirroring the garden tools in the top right. The garden's own controls share
  its top edge, the farthest point from the dock. The lower edge is left to the stones and the
  path. A planned session's slip sits under the pill, and the quiet line narrows to stay clear
  between them.
- **Phones and narrow screens** keep the pill at the bottom centre, where the thumb is.
- **Everywhere, the pill steps aside** while the dock's Study controls are on screen
  (IntersectionObserver on the Study body; on screen means clear of the window's lower 12 %).
  - It fades over `--ui-slow`, then becomes `visibility: hidden`.
  - It is `inert`, so tips and the keyboard skip it.
  - The planned-session slip goes with it.
  - There is no movement and no layout change. `ui.state().pillAside` reports it.
  So "Start studying", the timer and Pause appear once on screen: on the garden while you look at
  the garden, in the dock while you are in the dock.

## Consequences
- Tests that clicked the pill do so with the page at the top, where it shows. The pill-position
  tests moved to `wayfinding.spec.ts`.
- Tips anchored to the pill fall back to the dock's copy while the pill is aside (`isVisible`
  ignores inert controls).
