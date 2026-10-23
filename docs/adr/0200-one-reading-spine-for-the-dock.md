# ADR 0200 — One reading spine for the dock

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner ("the UI feels a little too scattered and hard to follow"; chose "a
  painted path plus structure"), designed in dock wayfinding (devlog 25)
- Amends: ADR 0130 (page shell: "Desktop: two columns (Study, Your plant)"), ADR 0136 (type)

## Context
An audit of the dock at 1440 × 900, 1920 × 1080 and 390 × 844, idle, with one and three sessions,
in a break, with a planned session due and 25 plants (devlog 25, `artifacts/wayfinding/before/`),
found these root causes for "scattered":
- **A ragged two-column row.** Study (left, 1.08 fr) and Your plant (right, 0.92 fr) sat side by side.
  Their heights differ in every state: idle Study is short, three sessions make it three times
  taller than Your plant. One column always ended in a large empty area.
- **No shared edges.** The plant's round window was centred on phones while everything else was
  left-aligned. "Schedule a session" floated at the far right of the calendar's row while the day
  timeline stopped at 640 px. The Switch buttons sat at the far right of a 460 px list, away from
  their rows.
- **Headings weaker than content.** Section headings were 19 px letter-spaced soft ink. The content
  under them was larger: a 25 px task name, a 23 px plant name, a 68 px timer. The eye jumped from
  content to content instead of from section to section.
- **Two primaries at once.** A planned session's card had a vermilion Start, and the vermilion
  Start studying sat under it. The pill on the garden showed a third "Start studying" just above.
- **Nothing said what a section was for**, or what to do next.

## Options
1. Keep two columns and balance their heights (fixed heights, sticky plant view). Heights depend
   on state, so this only moves the empty area around. A sticky window also fights the guiding path.
2. Keep two columns and let the path weave between them. Visiting Study and then Your plant at the
   same height means the line runs from the left heading to the right one. Every route either
   crosses the Study heading or doubles back on itself above it (the stones are at the centre, so
   a stop left of "Study" is reached from the right and must turn back right). That is fragile, and
   it reads as a loop.
3. **One reading spine: every section takes the whole row, in order, on one left edge.** Inside a
   section, wide screens may set two tracks on shared proportions.

## Decision
Option 3.
- The dock is one column of sections: Study → Your plant → Calendar → Garden tools. They share one
  left content edge, with a lane to its left for the guiding path (ADR 0202).
- One rhythm (`.dock` custom properties): `--rhythm-section` between sections (104 px desktop,
  88 px under 860 px, 76 px on phones), `--rhythm-head` between the heading block and the content.
- One heading treatment: a `header.dock-head` with the `h2` at 27 px (25 px on phones) in the full
  ink, and the helper line in 20.5 px italic soft ink (ADR 0201). The old 84 px brush rule under the
  heading is gone, because the path's stone marks the heading now.
- Two tracks inside a section, on wide screens only: the Study controls (`--dock-main`) beside
  the sessions in progress (`--dock-aside`), and the plant's 300 px window beside its caption.
  Under 860 px everything stacks. On phones the plant view is left-aligned like the rest.
- Smaller fixes for edges: the Switch and Resume buttons follow their row's 200 px text column;
  "Schedule a session" sits beside the calendar's navigation.
- `DockSectionDef.span` stays in the contract. On the page every section now takes the row, so
  `half` and `full` look the same. A later feature may use `span` again for a section that should
  keep to the main track.

## Consequences
- The page is longer on wide screens (Your plant sits below Study, not beside it). The order now
  reads the same at every width. Starting a session puts the camera on the seedling in the garden,
  so the plant is never out of sight while you study.
- The tests that asserted "Study and Your plant side by side" now assert the spine
  (`ui-shell.spec.ts`, `wayfinding.spec.ts`).
