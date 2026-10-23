# ADR 0164 — Zoom gestures and controls on the stage

- Status: accepted (implements ADR 0005's orchestrator decisions; amends ADR 0130)
- Date: 2026-10-23

## Context
The page scrolls as a document (ADR 0130): a plain wheel over the garden must keep scrolling it.
ADR 0005 decided zoom by pinch, ctrl/⌘ + wheel, double-click/tap and on-canvas buttons; drag pans
only when zoomed; touch: one finger scrolls unless zoomed, two fingers pinch.

## Decision
`src/ui/stage-camera.ts`, created by `createUI` when `main.ts` passes a `camera` integration:
- **Wheel**: plain → the page (unchanged); ctrl/⌘ (and trackpad pinch, which arrives as ctrl +
  wheel) → `ui.stage.onZoomGesture` → zoom about the pointer, `exp(−deltaY · 0.005)` with deltas
  clamped to 60 (a notch ≈ ×1.35).
- **Pointer**: a press that moves more than 6 px is a drag; it pans **only when zoomed** (pointer
  capture, `grabbing`). Two touch pointers pinch (zoom about their centre and pan with it). A press
  that does not move is a click/tap (ADR 0167). Double-click (mouse) / double-tap (touch, 320 ms,
  30 px) on bare garden zooms ×2 about the point; at the closest view it returns to the whole
  garden; on a plant it does nothing more (the first click went to the plant).
- **`touch-action`** on the canvas: `pan-x pan-y` at the overview (a finger scrolls the page
  natively, the browser does not page-zoom on pinch, so the pinch reaches us), `none` when zoomed
  (a finger pans the painting).
- **Controls**: + / − chips (the corner tools' paper chips and ink) stacked at the stage's bottom
  right, with a "Whole garden" slip beside them only while zoomed; above the centred pill on
  narrow stages (< 900 px or portrait), so they never clash with the pill (bottom left on wide
  stages) or the corner icons (top right). − at the overview and + at the closest view are
  disabled. They rest (fade) with the other controls while studying and stay usable in placement.
- **Keyboard**: the canvas is a tab stop (`role="img"`, a label that says what the keys do):
  + / = and − / _ step ×1.6, 0 shows the whole garden, the arrows look around when zoomed, Enter /
  Space open the card of the plant nearest the view's middle.
- The cursor is a pointing hand over plants, `grab` while zoomed.

## Consequences
`camera.spec.ts` covers ctrl+wheel about the pointer (no scroll), plain wheel scrolling, drag only
when zoomed, the touch-action switch, a synthetic two-finger pinch, double-click, the buttons and
keys. Real touch devices still need a hand check (a browser may claim a two-finger gesture as a
pan before both fingers land).
