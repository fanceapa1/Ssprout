# 37 — Q12: a small × to dismiss a tip

## What
The owner asked: "i want the user to be able to dismiss the tooltips with a small x". Every tip
note now has one (ADR 0211).

- **Core.** `tip/retire` and `controller.retireTip(id, reason)` take an optional reason, `'used'`
  (the default, and every automatic retirement) or `'dismissed'`. It travels on the `tip:retired`
  event only. The stored value stays `tips[id] = 'seen'`, so there is no schema change, and the ⓘ
  list marks a dismissed tip as learned. A dismissal is not a use: dismissing the notifications
  tip asks nothing, and dismissing the sound tip leaves the garden muted.
- **UI** (`ui/tips.ts`, `ui.css`, `hover.css`). The note is `span.tip-copy` plus a
  `button.icon-btn.tip-x` named "Dismiss tip: …". The × draws the `close` icon from the tool set
  at 14 px in the soft ink. It has a 32 px target in the slip's right padding (the note's max width
  grew by the same 20 px, so the words keep their measure). Only a showing note's × takes the
  pointer, and not while the notes step aside. Clicking it, or pressing Esc anywhere in the note,
  dismisses the tip. Esc stops at the note, so the planting sheet around it stays open. Focus goes
  back to the control the note was about. The next tip waits for the dismissed note's fade. Hover
  and focus use the chip family: deeper ink on a lifted paper dab, and the ink ring.
- **Keyboard order.** The notes live at the end of the page (or sheet), far from their controls in
  the tab order: before this change, reaching a × meant tabbing through the whole dock, which
  scrolled the note's own control out of view. Tab is now threaded: control → its × → whatever
  follows the control, and the same order backwards. The first version only threaded forwards, so
  Shift+Tab then Tab from the next control landed on the × instead of returning
  (`v2-acceptance › keyboard focus shows the hover state` caught it). A Shift+Tab that lands on a
  note's control now stops at its × first.
- **Studio.** `ui-shell/tip-note` shows the note at rest, pointed at or focused, and the 32 px
  target.
- **Tests.** Unit: `core/tips › dismissing a tip` (retires like a use, a no-op twice, persists
  through a save and a load, not counted as a use) and `core/controller › retireTip with reason
  dismissed…`. E2E: `tests/e2e/tips-dismiss.spec.ts` covers the click (target size, pointer
  events, beside the words, the next tip, ⓘ, the reload), Tab and Enter (threaded order, focus
  back on Start studying), Esc in the planting sheet, the quiet line, and a tap at 390 × 844 with
  touch. The clock is pinned at 10:00. TESTING rows 7.5–7.7.

## Screenshots looked at
`artifacts/shots/tipx-noon-*`, `tipx-night-*` (desktop 1440×900 and phone 390×844),
`tipx-focus-night-*` (the focus ring), `tipx-sheet-*` (a floating note in the sheet on desktop,
an inline one on the phone) and `studio-tip-note-*`. The × reads as ink on the slip in both lights,
and it dims with the note on the painting at night.

## Left open
- A dismissed tip cannot be told from a learned one after a reload. That would need a schema v3.
- A note that leaves (scrolled off screen, the quiet line) while its × has focus drops focus to the
  page, as any removed control does.

`src/main.ts` is untouched.
