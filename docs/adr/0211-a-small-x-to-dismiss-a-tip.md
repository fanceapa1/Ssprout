# ADR 0211 — A small × to dismiss a tip

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner ("i want the user to be able to dismiss the tooltips with a small x")
- Amends: ADR 0124 (one tip at a time), ADR 0181 (tips ride with the page)

## Context
A tip used to retire only when the gardener used its mechanism. Someone who already knows the
garden, or who does not want sound or notifications, had no way to quiet a note. It stayed until
they did the thing it described. Notes also never took pointer events, so nothing on a note could
be clicked.

## Decision
- **Every note has a small hand-inked ×.** It is a real `<button class="icon-btn tip-x">` named
  "Dismiss tip: <the tip's words>". It draws the `close` icon from the tool set (14 px, stroke
  2.5) in the soft ink, so it is not an icon font or a red circle (ADR 0194). It sits in the note's
  right padding, beside the first line and never over the words. Its hit target is 32 × 32 px and
  lies inside the slip. The slip and the `.tips` layer still take no pointer events. Only the × of a
  note that is showing (`.tip.is-in`) does, and not while the notes step aside for the resting
  garden or the quiet line.
- **Hover language** (ADR 0204, chip family): the ink deepens, and a paper dab lifts under the ×
  with a soft wash. The focus-visible state looks the same and adds the ink ring (drawn inside the
  target). Pressing it sinks the dab back. With reduced motion only the colour changes.
- **Dismissing is retiring.** Clicking or tapping the ×, or pressing Esc anywhere in the note,
  calls `controller.retireTip(id, 'dismissed')`. The reducer's `tip/retire` stores the same
  `tips[id] = 'seen'` as when the mechanism is used. The reason travels only on the action and on
  the `tip:retired` event (`{ id, reason: 'used' | 'dismissed' }`). The document shape does not
  change (no schema v3, ADR 0154), and the ⓘ list marks a dismissed tip as "learned", as it does a
  used one. A dismissal is not a use: dismissing the notifications tip does not ask for permission,
  and dismissing the sound tip does not unmute.
- **One quiet thing at a time.** The dismissed note fades as usual. No new note shows until it has
  faded (`FADE_MS`, scaled by `?uitime`; at once with reduced motion). Then the next waiting tip
  takes its turn under the usual rules. It still waits while the quiet line speaks, while a plant
  card is open, or while its control is off screen.
- **Keyboard.** The notes live in their own layer at the end of the page (or of the sheet), far from
  their controls in the page's order. So Tab is threaded by hand. From a note's control (its last
  focusable part), Tab goes to the note's ×. From the ×, Tab carries on after the control: focus is
  put back on the control, and the browser's own Tab moves on from there. Shift+Tab goes back to
  the control. After a keyboard dismissal, focus returns to the control the note was about. Inline
  notes on phones (inside a sheet's step) already follow their control in the page's order and are
  left alone. Esc in a note is the note's own: it stops there, so the sheet, the placement or the
  plant card around it stays.

## Consequences
- Tips can no longer be counted on to teach every mechanism. A gardener who dismisses one can still
  read it in the ⓘ list.
- The UI cannot tell "dismissed" from "learned" after a reload. If that difference is ever needed,
  it means a schema v3 (`'seen' | 'dismissed'`).
- `tests/e2e/tips-dismiss.spec.ts` covers the mouse, Tab and Enter, Esc in a sheet, a tap on a
  phone, the reload, the ⓘ list, the next tip and the quiet line. The studio entry is
  `ui-shell/tip-note`.
