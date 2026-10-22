# ADR 0130 — The page: a garden stage on top, a dock of sections below

- Status: accepted; amended by ADR 0156 (the Study section lists the sessions in progress)
- Date: 2026-10-23
- Context: ADR 0005 (owner's v2 requests); amends ADR 0050 (the UI is no longer only an overlay)

## Context
v1 was a full-window canvas with a fixed overlay: the timer slip, the corner icons and the
planting sheet all lay on the painting. The owner wants a page: a small margin around the
garden, the garden ~88 % of the window on first load, the UI below it, scrolling as a document,
and a UI that later features (calendar, parallel sessions, …) can grow into.

## Decision
- **Markup.** `index.html` holds `#ui` (the page) with `section#stage.stage` and the canvas inside
  it. `createUI` finds the stage (or `deps.stage`), adds the stage overlay `.stage-ui`, and puts
  the dock right after the stage. Tips, the scrollbar, the live region and the dialogs stay at the
  end of `#ui` (fixed / top layer).
- **Stage sizing.** `.stage { height: 88svh }` (88vh fallback, min 320 px) below a 14 px margin
  (8 px under 600 px wide; the sides use the same margin, which also hosts the scrollbar). `svh`,
  not `dvh`: a phone's address bar showing or hiding must not resize the garden. The canvas fills
  the stage; the renderer already measures the canvas's own box and observes it with a
  `ResizeObserver` (`src/render/renderer.ts`), so the viewport follows the stage, not the
  window. `src/render/viewport.ts` needed no change: cover scaling and the ADR 0123 phone floor
  work on whatever box they are given.
- **Overlay coordinates.** Everything that sits on the painting (pill, corner tools, quiet line,
  placement markers and bar, plant labels) is absolutely positioned inside `.stage-ui`, whose
  CSS pixels *are* the viewport's (`viewport.worldToScreen`). Page scroll therefore never enters
  the maths; pointer hit-tests use the canvas's `getBoundingClientRect()` (client coordinates).
- **Dock contract** (`src/ui/dock.ts`, docs/ARCHITECTURE.md › Dock): `addSection({ id, title,
  order?, span?, mount? })`, `fill(id, mount)`, `removeSection`, `get`, `sections`, `onChange`.
  Sections sort by `order` then registration; `span: 'full'` takes the whole row on wide screens;
  under 860 px everything is one column. A section without `mount` is a hidden placeholder.
- **Sections now:** `session` "Study" (10, the former timer panel), `plant` "Your plant" (20),
  `calendar` "Calendar" (30, full, **placeholder hidden until filled** — an empty heading
  promising a calendar would be noise), `tools` "Garden tools" (90, full).
- The dock is plain paper and ink: section headings with a short brush rule, no cards or boxes.
  While a spot is being chosen the dock is `inert` and faded, as the panel was.

## Consequences
- The calendar task fills its section with `ui.dock.fill('calendar', mount)`; others add their
  own with `ui.dock.addSection` from `src/ui` or `main.ts`.
- E2E selectors: `.panel` is now the dock's session controls; buttons that exist twice (Start
  studying, tools) are scoped (`.panel`, `.pill`, `.menu`, `.tool-list`).
- Short landscape windows crop a little more of the sky than before (the stage is 88 % tall).
