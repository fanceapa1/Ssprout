# ADR 0194 — Marks, not dots: an inked sprout and a brush mark

- Status: accepted
- Date: 2026-10-23
- Decided by: project owner ("get rid of the circle next to the start studying, that's an AI
  generated website trope i hate. find another design"), designed in polish 2
- Amends: ADR 0133 (the timer pill), ADR 0156 (sessions in progress), ADR 0175–0177 (calendar,
  waiting card, editor), ADR 0053 (planting sheet)

## Context
A small round vermilion dot stood beside "Start studying" on the garden, beside "Plant another" and
"Schedule a session", before "growing now", "Planned for …" and "now" blocks in the calendar, at the
head of the calendar's now line, and after the chosen chip, plan and pressed tool. A tier word also
had a coloured dot. The owner reads this as the generic "recording / live" dot of AI-made websites.
It does not belong to a watercolour garden.

## Options
- Typography alone with a stronger brushed chip edge. This is calm, but "Start studying" and "growing
  now" lose their quiet sign.
- A non-circular hanko seal. It is still an abstract badge, and a red stamp beside every action
  shouts.
- **A tiny hand-inked sprout from the app's own icon set, and a brush stroke for chosen things.**
  This option was taken.

## Decision
- **The sprout mark** (`sproutMarkSvg`, `drawSproutMark` in `ui/icons.ts`) is the sprout icon's own
  sumi strokes (stem, two leaves, a ground stroke) with its leaves washed in sap green
  (`#8b9c5a`). It is cropped to the glyph and drawn in the soft ink at 12–22 px. It marks only what
  begins a planting or is growing:
  - the pill's idle "Start studying" and the dock's "Start studying" (drawn in the seal's cream on
    vermilion);
  - "Plant another" and "Schedule a session";
  - "growing now" in the sessions list;
  - "Planned for …" on the waiting card;
  - due and growing blocks in the calendar.
- **The brush mark** (`--brush-mark`, a short vermilion brush stroke from `brushStrokePath`)
  replaces the dot after anything chosen. It runs under the words of a chosen schedule chip,
  picker chip, plan card, a tool that is on, and the current tier word. This is the same language
  as the calendar's chosen view.
- **The now line** loses its round head. It starts with a firm brush stroke loaded at the rail
  and thinning out.
- No pulsing, no glow, no emoji, and no round red dot anywhere. The month view's pigment dabs (one
  per bloom, in the plant's own colour) stay: they are paint, not a status dot.
- `TIER_SWATCH` and every dot rule are removed.

## Consequences
- The marks look like the painting's own ink and pigment: a seedling where something will grow, a
  brush stroke under a choice. They are checked in all four lights on desktop and phone.
- `tests/e2e/marks.spec.ts` scans the page, the dock, the calendar and a sheet. It checks for any
  small, rounded, vermilion-filled element or pseudo-element, and checks that the sprout marks sit
  where a planting begins or grows. The week-layout test now measures the sprout mark.
- Studio: `ui-shell/marks`, plus `ui-shell/pill`, `ui-shell/session-rows` and the calendar fixtures,
  redrawn with the sprout.
- ART_DIRECTION lists the round "recording" dot among the anti-tropes.
