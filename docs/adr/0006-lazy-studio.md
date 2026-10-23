# ADR 0006 — The studio paints lazily

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner (request), implemented by the orchestrator

## Context
The studio (`studio.html`) mounted every section and painted every entry synchronously on load:
all species growth stages, the full scene, the daylight plates, the close-view detail, fauna
sheets — several hundred canvases, each with a full backing store. The owner reported that
opening it was "killing my computer".

## Decision
- A card's canvas is laid out at its size but holds a 1×1 backing store until it **nears the
  screen** (600 px margin). Then the frame loop paints it, on-screen cards first, within a
  **10 ms per-frame budget** (at least the first card of a frame always runs).
- Cards more than about **three screens away give their pixels back** (1×1 again) and repaint
  when they return, so scrolling the whole studio keeps memory bounded.
- Animated entries animate only while on screen, round-robin within the same budget.
- Seed, scale and `setT` changes mark cards dirty instead of repainting everything at once.
- `window.studio.settle()` paints every shown card and keeps them painted (tests and the
  full-page `npm run shots -- --studio`); `window.studio.pending()` counts cards still to paint.

## Consequences
Opening the studio costs about one screenful of painting. Tests and screenshots that read
pixels must `await studio.settle()` first (the studio spec's `openStudio` does).
