# ADR 0208 — A leaf of washi behind each dock section, the calendar's the firmest

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner ("i want a backdrop on each UI component, especially the calendar"),
  designed in Q11 (devlog 32)
- Amends: ADR 0130 (the dock was "plain paper and ink … no cards or boxes"), ADR 0200 (the rhythm
  between sections), ADR 0202 (where the path's crossing reaches the lane)

## Context
The dock's sections sat straight on the page's paper. Only the headings and the path's stones told
one section from the next, and the calendar's grid, blocks and toolbar floated on the same washi as
everything else. The owner asked for a backdrop on each section, the calendar most of all. The
art direction rules out the usual answers: no cards with rounded corners, no flat drop shadows, no
glassmorphism or blur, no gradient cards, no borders everywhere, and no second paper tint (ADR 0021).

## Options
- **CSS boxes** (a background colour, a border-radius, a box-shadow). These are the app-template look
  the art direction forbids.
- **Paint each sheet with the paint engine onto a canvas.** It is the richest look, but it needs a
  canvas as big as each section, repainted on every height change (the session list, the waiting
  card, the calendar's views), and the engine's sequential rng would re-tear the whole edge each
  time the section grew.
- **SVG drawn for the section's size: a torn mask over the shared paper tile, and a glazed wash
  under it.** It is cheap to draw again, crisp at any zoom, testable as numbers, and the same way the
  path, the slips and the calendar's washes are made. **Taken.**

## Decision
- **One sheet per section, from the registry.** `DockSectionDef.backdrop?: 'leaf' | 'firm' | 'none'`
  (default `leaf`). `createDock` puts a `div.backdrop` (`aria-hidden`) first in every section, so a
  section added later gets a sheet with no other change. The calendar registers `firm`.
- **The leaf** (`backdrop.ts`): the page's own paper tile (`--page-paper`, ADR 0132) at a seeded
  offset, so its grain never lines up with the page's, under a thin lift of white (0.44; 0.74 for
  `firm`). Lifting is reserved paper, not a second tint, so nothing turns muddy. The shape is a CSS
  mask: an SVG of the torn outline, a translucent fringe 1.4 px outside it, and loose fibres.
- **The torn edge** (`backdrop-sheet.ts`, pure): three octaves of value noise per side (a slow wave,
  the tear, the fibres), a chip at each corner, and a lean of up to 3 px along the top and lower
  edges. Each side's tear is a function of the position along it, measured from its top or left
  end, so a section that grows keeps its top and sides exactly. The tear stays inside the box (at
  most 10 px in), so the box is the sheet's bounds for layout and tests.
- **The wash under it**: nine jittered glazes of a cool violet grey (`#5d5b7e`, the art direction's
  shadow colour, never a grey drop shadow), each reaching a little less far, so the wash is deepest
  at the edge and soft at its end. It pools unevenly along the edge, ends in a broken rim, and lies
  under the lower and right edges only, never out to the left (the path's lane) or above. A narrow
  sheet (phones) casts two thirds of the depth. The page clips sideways overflow (`.ui-root { overflow-x: clip }`), so the wash past
  a phone's right edge never widens the page (it once made a 390 px phone 414 px wide).
- **When it is drawn.** A ResizeObserver on the section, coalesced into a frame. The images are drawn
  for the section's size in CSS pixels, and drawn again only when that size changes (content growing,
  the waiting card, a resize). Nothing repaints per frame, on scroll or on a tick.
- **Headings on the sheet.** The section's padding is the sheet's margin (38 px, 28 px under 860 px,
  20 px on phones), and the heading and helper line are the first thing on the sheet. Considered:
  the heading on the page just above the sheet. That splits a section in two (a title on one paper,
  its content on another) and leaves the stone beside a heading that floats between two sheets.
  On the sheet, each stone sits just outside a leaf's left edge, level with its title: the path
  steps from leaf to leaf.
- **The path stays in its lane.** The lane is measured from the section's box, which is now the
  sheet's left edge, so the stones sit `--stop-gap` outside it. The crossing from the garden reaches
  the lane above the first sheet's top, not only above its heading (`wayfinding.ts`).
- **Rhythm.** The padding now separates content from the next section, so the gap between sheets
  is 64 px (was 104), 56 px under 860 px (was 88) and 40 px on phones (was 76). Phones give the
  dock's right padding to the sheet (14 → 4 px).
- **The calendar's sheet is the firmest.** It has a stronger lift (0.74) and a deeper wash, so the
  toolbar, the grid and the blocks share one clear surface. On it the washes are a little firmer
  (bloom 0.30, growing 0.21, ended early 0.08), a plan's broken outline is darker (0.60, passed
  0.28), the hour dots are darker (0.25). Today's column keeps its faint warmth (a stronger one read as a stain on the light sheet). A week block that
  grows to read takes the sheet's paper.
- **Light.** The dock is read like a sheet and is not dimmed by the garden's light (ADR 0121), so
  the sheets read the same in all four phases. All text on them is ≥ 4.5 : 1, measured from pixels
  (`tests/e2e/backdrops.spec.ts`).
- The hover language (ADR 0204) and the one primary action (ADR 0201) are unchanged. A slip lifting
  on a lighter sheet still shows its wash, and the seal reads more strongly on the lighter paper.

## Consequences
- Each section reads as its own leaf laid on the page. The page is a little shorter on wide screens.
- Phones lose a few pixels of width inside sections (the sheet's margin). The phone week view still
  fits seven columns.
- Contract: `backdrop` in `DockSectionDef` and `DockSection` (docs/ARCHITECTURE.md › Dock).
- Studio: `ui-backdrop` (a leaf, the calendar's firm sheet, the edge close up, a sheet that grows).
- `src/paint` is unchanged; the sheet reads `createValueNoise2D` and the page's paper tile.
