# ADR 0202 — A guiding path from the stepping stones through the dock

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner ("a hand-inked line flows down from the garden's stepping-stone path and
  threads through the sections in order … only if you can make it responsive without too much of
  a hassle"), designed in dock wayfinding (devlog 25)

## Context
The garden's stepping stones lead from the bottom centre of the painting to the pond. The owner
wants that path to continue onto the page and lead the eye through the dock's sections in order.
It must look like the same painting continuing, never cross text, follow every change of layout,
and stay simple at every width.

## Options
- **The paint engine onto a canvas.** This is the richest look. But it needs a canvas the height of
  the page, repainted on every layout change, and a worker or main-thread cost on resize.
- **An SVG brush outline** (a filled, pressured stroke built from seeded geometry, like the
  scrollbar and the calendar's washes), multiplied into the paper. It is cheap to re-lay out,
  crisp at any zoom, and testable as numbers. **Taken.**

## Decision
- **Geometry** (`ui/wayfinding-path.ts`, pure, unit-tested). `layoutPath` starts where the stepping
  stones leave the painting: the nearest stone still clear of the stage's dissolving edge, mapped
  through the renderer's viewport. The line crosses the dock's empty top margin to the **lane**,
  arriving straight down at least 16 px above the first heading. It then walks down the lane from
  stop to stop, one stop per visible section at its heading's centre, and lifts off a short tail
  after the last one. Below the first heading it never leaves the lane (± `--path-sway`). The lane
  lies `--stop-gap` left of the content edge, so the line cannot cross text.
- **Drawing.** `brushOutline` draws a pressured brush: it emerges thin from the stones, swells and
  thins, has one dry break on a long stretch, stops short of each stone (it steps from stone to
  stone) and lifts off. `stonePath` draws each stop as a small flat stepping stone, the garden's own
  warm grey, never a round red dot (ADR 0194). The line is sumi ink at 0.42 alpha, multiplied,
  behind the sections (`z-index`). The stop of the section being read (the last heading above a
  quarter of the window) is a shade darker.
- **Registry hook** (`ui/wayfinding.ts`). The layer is an absolutely positioned `svg.wayfinding`,
  the dock's first child. It reaches `--path-rise` px up into the garden's dissolving edge. Its
  stops are `dock.sections()` that are visible, measured at their `heading`. It lays out again
  (coalesced in a frame) on `dock.onChange` (a section added, filled, hidden or removed), on
  ResizeObserver changes of the dock, the stage and every section and heading (content growing,
  the waiting card appearing, fonts), and on window resize. A feature that adds a section gets its
  stop for free.
- **Responsive, the same code everywhere.** Only custom properties change:
  - wide: an 84 px lane, a 12 px meander, a 23 px stone, rising 150 px into the garden;
  - under 860 px: a 64 px lane, an 8 px meander;
  - phones: a 38 px gutter, **no meander** (a straight line), a 17 px stone, starting at the
    garden's edge.
- **Motion.** A 2.6 s draw-in along the line (an SVG mask stroke), the stones settling in turn,
  once, the first time the dock enters the view. With `prefers-reduced-motion` it never plays and
  the path is simply there (`drawn: 'instant'`).
- **Debug.** `sprout.ui.wayfinding({ layout? })` returns the stops and the centre line in client
  coordinates, the stop being read, the draw state and the layout count.
  `sprout.ui.setSectionHidden(id, hidden)` exists for tests.

## Simplified for responsiveness (the owner's condition)
- **No weaving between two columns**, at any width. The spine (ADR 0200) makes one route right
  everywhere. The two-column weave needed a crossing past a heading (see ADR 0200, option 2).
- **Phones: a straight line** with no meander. In a 38 px gutter even a few pixels of sway came
  close to buttons whose boxes reach into the gutter.
- **Phones: the line starts at the garden's edge**, not over the painting. The timer pill sits at
  the bottom centre of a phone's stage, where the stones leave the painting.

## Consequences
The path is decoration (`aria-hidden`). It never takes pointer events and it never moves content.
