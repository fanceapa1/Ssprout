# ADR 0050 — The UI is plain DOM over the canvas, driven only by the session controller

- Status: accepted
- Date: 2026-10-21

## Context
The garden is one canvas. Controls, sheets, slot markers and tooltips need to be accessible
(focus, labels, live regions), clickable by Playwright and styled like paper and ink. The core
already owns every rule (ADR 0032).

## Decision
- `src/ui` builds plain DOM (no framework, a small `h()` helper) into `#ui`, a fixed overlay with
  `pointer-events: none`; each control opts back in.
- The UI never dispatches session actions or recomputes session maths. It calls the controller
  (`start`, `pause`, `resume`, `cancel`, `water`, `skipBreak`, `updateSettings`, `retireTip`,
  `announceFauna`, …) and reads `controller.status()`; `session-view.ts` is the single place that
  maps the status to what the panel shows. The only direct store write is `state/replace` for a
  validated import (core.md › Persistence).
- Store listeners never call the controller synchronously (dispatches inside a delivery are
  queued, ADR 0011): state changes are coalesced into one microtask `refresh()`.
- Slot markers are DOM buttons (`button[data-slot-id]`) positioned with the renderer's
  `viewport.worldToScreen`; they follow the viewport object (replaced on resize) with a rAF check
  while placement is open. A small observable (`ui.placement.subscribe`) lets the renderer add an
  in-canvas highlight later.

## Rejected
- Drawing controls into the canvas: no accessibility, no e2e selectors, re-implementing text.
- A UI framework: the surface is small; the controller already holds the state.
