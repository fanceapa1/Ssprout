# ADR 0051 — Native `<dialog>` for sheets; placement is a non-modal mode

- Status: accepted; amended by ADR 0190
- Date: 2026-10-21

## Decision
- Sheets (planting, pressed flowers, garden data, hints) are native `<dialog>` opened with
  `showModal()`: focus is trapped and Escape works for free; the backdrop is a faint paper wash
  (no blur). Opening one closes any other; on close, focus returns to the control that opened it.
  Closing fades for 360 ms (instant with reduced motion); `openDialogs()` ignores closing ones.
- Each sheet focuses its heading (`tabindex=-1`) on open, so screen readers hear the title and Tab
  reaches the first control without a focus ring landing on an arbitrary card.
- Placement is **not** a dialog: the garden must stay visible and the markers clickable. The panel
  and menu become `inert` and dim; Escape and "Back" return to the planting sheet with the draft
  intact.
- Tooltips for controls inside an open dialog are rendered inside that dialog (the top layer);
  with a sheet open, only its controls carry tips.

## Rejected
- A custom modal with a manual focus trap: more code, worse with assistive tech.
- A stepwise wizard of dialogs for planting: see ADR 0053.
