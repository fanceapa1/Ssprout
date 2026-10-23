# 34 — Keyboard focus clears a sheet's sticky footer (Q14)

Tabbing through the planting sheet's plan and plant cards could leave the focused card half under
the sticky footer (at 390 × 844 a focused card's bottom sat 131 px below the footer's top), because
no `scroll-padding` was set anywhere. `.sheet-inner` now has `scroll-padding-block` made of a 14 px
clearance for the torn edge and focus ring, plus `--sheet-foot-h` / `--sheet-head-h`. `createSheet`
(`src/ui/sheet.ts`) measures a sticky `.sheet-foot` (or a `.sheet-head-sticky`) with a
`ResizeObserver` when the sheet opens, so the padding follows the footer as its summary wraps on
phones. Only the planting sheet has a sticky part today. The schedule sheet with its pickers, the
herbarium, garden data and hints share the rule and get the edge clearance, and any sticky
`.sheet-foot` added to them later is measured too. The reveal stays the browser's instant scroll
(`scroll-behavior: auto`), so nothing glides and reduced motion is respected by construction.
`tests/e2e/overlays.spec.ts` › *keyboard focus clears a sheet's sticky parts* tabs through every
control to the last plant card at 1440 × 900 and 390 × 844 and checks each focused rect against
the footer and the sheet's top. It also walks the schedule sheet with both pickers open at
390 × 844 (TESTING.md 12.29). Both planting cases failed before the fix. Nothing is left open, and
`src/main.ts` is untouched.
