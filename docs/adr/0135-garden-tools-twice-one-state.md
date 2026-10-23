# ADR 0135 — Garden tools: one implementation, two views; icons redrawn

- Status: accepted; amended by ADR 0180
- Date: 2026-10-23
- Context: ADR 0005 (icons not intuitive or visible enough; duplicate them below the canvas)

## Decision
- `src/ui/tools.ts` replaces `menu.ts`. Each tool (sound, floating timer when supported, pressed
  flowers, garden data, hints) is defined once — accessible name, icon and labels as functions of
  state, pressed state, action — and rendered twice: the corner view (`nav.menu`, on the garden)
  and the dock view (`ul.tool-list`, "Garden tools", icon + visible name + a short note). One
  `render()` updates both after any click or state change, so they cannot disagree (mute state,
  widget open). Both copies carry `data-anchor`; a tip goes to the dock's copy when it is in view, else
  to the corner's (`resolveAnchor` in `index.ts` returns both, `tips.ts` takes the first visible).
- **Visibility:** 24 px glyphs, 48 px hit targets, ink `#3b352e` with 1.65 px strokes, each on a
  torn round paper chip (`--slip-chip-*`, 94 % paper) that dims with the garden's light like the
  other slips (ADR 0121) but never below 0.8, so the ink reads over sky, foliage or the night wash.
  Labels show on hover and keyboard focus; every button has an `aria-label`.
- **Metaphors:** the speaker keeps its waves (and a clear cross when off); pressed flowers is an
  open book with a flower pressed on its page (was a leaf); garden data is an arrow into a tray
  (save a copy); the floating timer is a small card with a clock leaving a window; hints is ⓘ.
- Icons are data (`ICON_STROKES`): the same strokes are inline SVG in the page and Path2D drawings
  in the studio (`drawIcon`).
