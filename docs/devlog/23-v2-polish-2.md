# 23 — v2 polish, part 2

## What
The orchestrator's list from devlog 21's "Left for others", plus a second fresh-eyes pass. ADRs
0190–0194.

1. **Sheets over the page** (ADR 0190).
   - Every sheet sits on a leaf of the page's own washi (`::backdrop`, 0.965), so no dock text reads
     beside or under it.
   - The page is locked while a sheet is open (`html:has(dialog.sheet[open])`). The wheel beside the
     sheet, PageDown, Space and End no longer move it.
   - The slip's torn edge is drawn over the content (`dialog.sheet::after`), so the planting sheet's
     sticky footer no longer erases its bottom edge.
   - This applies to planting, schedule, pressed flowers, garden data and hints.
2. **The plant card on phones** (ADR 0190).
   - The docked card may take 62 % of the stage, with a tighter phone layout (facts as one
     sentence).
   - When it is still taller than its room, the name stays and the rest scrolls inside. The words
     thin at the cut under a small ink chevron, and a tap on it reads on. The body is a focusable,
     named region, but only while it scrolls.
   - At 390 × 844 the longest note (lotus) and the longest growing card now fit. At 360 × 740 they
     scroll with the mark.
3. **The calendar's day follows now** (ADR 0191).
   - Opened with now in the window, today's day view glides on (1.4 s) whenever now leaves the
     4–72 % band. A scroll by the gardener stops it; Today brings it back. Past midnight it turns to
     the new day.
   - Stepping to another day resets it. The first version kept following and pulled "Previous day"
     back to today, which a test caught.
4. **Painted day and time pickers** (ADR 0192). They replace the native date and time inputs.
   - They use the calendar's own `Intl` formats, so "4:30 PM" in en-US and "16:30" in en-GB read the
     same in the editor and the calendar.
   - Each is a field that unfolds a panel inline: a month grid, or hour / minutes / AM-PM chips.
   - Keyboard: a grid with arrows, Home/End and PageUp/PageDown; radio chips; Esc folds the panel,
     not the sheet.
   - Screen reader: named fields, a grid with selection and today marked, named radio groups.
5. **The sun weather** (ADR 0193).
   - The pale screen shafts (columns over the sky) are gone. In their place is a thin raw-sienna
     glaze over the garden, mottled and fading out above the hills, with four soft diagonal bands
     of light **lifted out** of it.
   - The lifted pigment pools slightly at each band's edge. The groups take turns on a 13 s breath,
     so the light comes and goes as under drifting cloud.
   - Pond glints are warm, and new leaf glints are warm dabs on the sunlit side of the crowns.
   - It is still subtle: about 6 levels per channel between light and glaze. It fades with the
     envelope on pause and at the end.
6. **Marks, not dots** (ADR 0194, an owner request added mid-task: "get rid of the circle next to
   the start studying, that's an AI generated website trope i hate").
   - Every small round red dot is gone.
   - A hand-inked **sprout mark** (the sprout icon's own strokes, leaves washed in sap green) sits
     beside what begins a planting or is growing:
     - the pill's and the dock's Start studying (on the seal, in its cream);
     - Plant another and Schedule a session;
     - growing now and the waiting card's "Planned for";
     - due and growing calendar blocks.
   - A short vermilion **brush stroke** runs under anything chosen: schedule and picker chips, the
     plan, a tool that is on, the current tier word.
   - The calendar's now line starts with a brush stroke instead of a round head.
   - Checked in all four lights on desktop and a phone.
7. **Fresh-eyes pass** (below):
   - a phone's day with sessions side by side now keeps short times and grows one when focused;
   - keyboard focus in the calendar survives its minute redraw;
   - a focused inner scroller (the calendar's hours, a card's story) keeps its arrow/page keys
     instead of scrolling the page.

Shared files: none of `src/main.ts`. In `src/ambience` only the weather files changed: `sprites.ts`
(sun sprites), `ambience.ts` (the sun branch of `drawAir` and `LOOK`), `sim.ts` (leaf glints),
`system.ts` (a comment) and `ambience.studio.ts` (a label). The light plates were not touched.
Rebased on main after close-view art (ADRs 0185–0189) with no conflicts.

## Why / decisions
- **A sprout, not a seal.** Typography alone loses the quiet sign on "Start studying". A
  non-round hanko is still a red badge beside every action. The sprout is already the app's own
  glyph ("Name a task, choose a plant…") and says what the action does: something will grow.
  Chosen states get the brush stroke the calendar already used for its chosen view.
- **ADR numbers.** The marks request came after 0190–0194 were written. The phone card was folded
  into 0190 (both are about overlays reading cleanly) and 0191–0193 renumbered, so the marks could
  take 0194 inside the range.
- **Paper, not a scrim.** A grey or blurred scrim is the generic overlay look (ART_DIRECTION
  anti-tropes). The page's own washi at 0.965 makes the sheet the only thing on the page and keeps a
  ghost of the garden. At 0.9 the dock's text was still legible, so the veil was raised.
- **The card scrolls inside, not into the dock.** Growing into the dock would cover the Study
  heading, and half the card would scroll off with the page. Smaller type would break the
  readability floor.
- **Inline panels, not popovers.** Inline panels need no positioning or clipping inside a scrolling
  sheet, behave the same on phones, and keep focus order natural.
- **The sun is lifted, not added.** On white pre-paper a screen shaft cannot lighten the sky.
  Watercolour light is paper left or lifted. Each sprite lifts every band (one group fully, the
  other by half), so the breath moves the light without halving its contrast. The first version
  lifted each band in one sprite only, and the cross-fade washed the bands out.

## Tests
- **Unit:**
  - `ui/smooth-scroll` (3, new)
  - `ui/pickers` (10, new)
  - `ui/calendar-model` › following now (4)
  - `ambience/sun` (7, new)
- **E2E:**
  - `overlays` (2, new)
  - `plant-card-phone` (5, new)
  - `calendar`:
    - the day follows now (3)
    - the editor speaks the calendar's clock (en-US, en-GB)
    - a phone's day with sessions side by side
    - focus survives the redraw
  - `ambience` › the sun weather (1)
  - `marks` (1, new): no small round vermilion element or pseudo-element on the page, the dock, the
    calendar or a sheet; sprout marks where a planting begins or grows
  - `calendar · a planned slip on a phone's garden` (1)
- **Changed:** `calendar` › schedule a session…, a tap on an empty time…, and edit only this one…
  now use the pickers (`pickDay`, `pickTime`, `data-value`) instead of `fill()` on native inputs.
- **Studio:**
  - `ui-camera/plant-card-docked-long`
  - `calendar/pickers` (en-US and en-GB)
  - `ui-shell/marks`, plus `ui-shell/pill` and `ui-shell/session-rows` and the calendar fixtures,
    redrawn with the sprout
  - `ambience-weather/sun` (relabelled)
- **Suites:** `npm run typecheck`, `npm test` (103 files, 1281 tests) and `E2E_PORT=4188 npm run e2e`
  (RESULT) pass after the rebase.

Screenshots reviewed (`artifacts/polish2/{before,after,fresh,dots}`, gitignored):
- the card at 390 × 844 and 360 × 740 (top, scrolled to the end, lotus);
- the planting sheet on desktop (top, page scrolled, wheel) and on a phone;
- the schedule editor with each picker open (en-US, en-GB, phone);
- the sun at noon at 1440, 1920 and 390, plus an amplified sun − no-weather difference map;
- the studio entries;
- three sessions + `schedule.demo()` + 25 plants: full pages (desktop, phone), sunset and sunrise
  overviews, night zoomed in, phone night;
- keyboard-only tab order through the page (reduced motion);
- the sprout and brush marks: the pill in four lights (desktop and phone), the dock, the sheets, the
  tools, the now line and the studio entry.

## Fresh-eyes pass
**Fixed here:**
- On a phone's day the three sessions in progress showed as "4:10 PM T·". They now keep "4:10" and
  the first letters of the title, and a touched or focused one grows to read whole.
- The calendar redraws every minute and dropped keyboard focus to `<body>` (seen as a lost Tab stop
  on the hours). Focus is now put back on the same block, day or hours.
- Arrow, Page and End keys on the focused calendar hours (and a plant card) scrolled the page
  instead.
- On a phone, zoomed in with a planned session due, the "Whole garden" chip lay on top of the
  planned slip above the pill. The zoom chips now step up over the slip.

**Left for others:**
- **Close-view art / render** (night, zoomed onto the seedling, 1440 × 900, after the rebase):
  - a lighter rectangle with a hard vertical edge at the upper left of the view (≈ x 40–470,
    y 40–110 on screen);
  - a plant sprite (chrysanthemum-like clump at the bottom) cut off by a hard vertical edge, as if
    clipped to its box.

  See `artifacts/polish2/fresh/desktop-night-zoom3.png` (and `-zoom.png` before the rebase, with a
  larger light rectangle).
- **Plants:** the 64 px "Growing now" thumbnails and the Your plant window still read as nearly
  empty for a just-planted seed (pale circles). Close-view art changed the framing; not rechecked
  in depth.
- **Session list order** differed between two runs of the same setup (Task 1, 3, 2 on the phone
  versus 1, 2, 3 on desktop). It may be by design (switch order), but it is worth a look.
- **Lotus** is still offered in the planting sheet but cannot be planted (known, `plantable.test`).

## Left / known gaps
- Pickers: no typing a date or time by digits (choose with keys or taps instead). There are no
  `min` dates; a planned session in the past is allowed, as before.
- Following now only applies to the day view; weeks and months keep their window, though their now
  line moves.
- The sun's look was judged at noon. At sunrise and sunset its glaze adds to the warm light plates.
  That is subtle and checked by eye only.
- On touch devices the page lock relies on `overflow: hidden` on the root, which iOS Safari may not
  fully honour. The sheet's `overscroll-behavior: contain` covers most of it. Not tested on a device.
