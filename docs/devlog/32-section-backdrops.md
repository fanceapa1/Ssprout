# 32 — Section backdrops (Q11)

## What
The owner said: "i want a backdrop on each UI component, especially the calendar". ADR 0208.

Each dock section now lies on its own leaf of washi, as if the painting went on over separate
sheets laid on the page:
- **The leaf.** The page's own paper tile (`--page-paper`, the garden's texture) at a seeded offset,
  under a thin lift of white, so it is a little lighter than the page. Lifting is reserved paper,
  so no second tint is multiplied in (ADR 0021).
- **The torn edge.** An SVG mask drawn for the section's size in CSS pixels: three octaves of value
  noise per side, chipped corners, a slight lean, a translucent fringe and loose fibres. Each side's
  tear depends only on the position along it, so a section that grows keeps its top and sides.
- **The wash under it.** Nine jittered glazes of a cool violet grey, deepest at the edge and soft at
  the end, pooling unevenly, with a broken rim. It lies under the lower and right edges only, away
  from the path's lane. This is the paint engine's wet-edge method, done in SVG.
- **The calendar's sheet is `firm`.** It has a stronger lift and a deeper wash. On it the washes,
  a plan's broken outline and the hour dots are a shade firmer, so planned, past and growing blocks
  stand out.
- **From the registry.** `DockSectionDef.backdrop` (`leaf` by default, `firm`, `none`), so a section
  added later gets a sheet with no other change. The sheet is drawn again only when the section's
  size changes (ResizeObserver, one frame later), never per frame, on scroll or on a tick.

### Design choices
- **Headings on the sheet.** The heading and helper line are the top of the leaf, and the stone sits
  just outside its left edge, level with the title. The path steps from leaf to leaf. With the
  heading above the sheet instead, a section's title sat on one paper and its content on another,
  and the stone sat beside a heading floating between two sheets.
- **SVG over canvas.** Painting each sheet with the engine onto a canvas would repaint a
  section-sized canvas on every height change and re-tear the whole edge, because the engine's rng is
  sequential. SVG is cheap, crisp and testable, and works like the path, the slips and the
  calendar's washes.
- **Rhythm.** The sheet's margin now separates sections, so the gaps shrink: 64 / 56 / 40 px (was
  104 / 88 / 76). On phones the sheet's margin is 20 px, and the dock's right padding goes to the
  sheet (14 → 4 px). The quiet buttons' −13 px text alignment stays inside the sheet.
- **The path.** Its lane is measured from the section's box, which is now the sheet's edge. The
  crossing from the garden reaches the lane above the first sheet's top. The tests' stop-to-heading
  gap grew to include the sheet's margin.
- **A bug the pixel test found.** After rebasing on main, the phone contrast tests failed on the
  due card's Start and the plant's caption. The wash layer reached 36 px past the sheet's right
  edge, and that widened a phone's layout viewport to 414 px. Only lines over uneven ground (a seal,
  the plant) showed the shift in sampling. The wash now reaches less far right, the page clips
  sideways overflow, and the phone test asserts there is no sideways scroll.
- Tried and dropped: a warmer "today" column on the calendar's sheet. It read as a stain on the
  light paper.

## Screenshots
- Before: `artifacts/backdrops/before/` (desktop and phone at midday and night, idle and busy; every
  calendar view at desktop, hd and phone).
- After: `artifacts/backdrops/after/` has the whole matrix: desktop 1440, hd 1920 and phone 390 ×
  sunrise / midday / sunset / night × idle / busy (three sessions + `schedule.demo()`), and the
  calendar's day / week / month, idle (empty) and busy, at the three sizes. Contact sheets:
  `contact-lights.png`, `contact-calendar-desktop.png`, `contact-calendar-phone.png`.
- Studio: `artifacts/backdrops/studio-ui-backdrop-1440x900.png`.

The dock is not dimmed by the garden's light (ADR 0121), so the sheets read the same in the four
phases. Only the garden's edge above the first sheet changes.

## Tests
- **Unit:**
  - `ui/backdrop-sheet` (10): the tear stays in the box, wanders without zig-zag, is seeded per
    section and keeps its edges when the sheet grows; the fibres; the wash under the lower and right
    edges only; firm deeper than leaf; the images at pixel size, glazes and no blur; the data URL;
    the grain offset.
  - `ui/backdrop` (3): drawn once per size, the strength and the offset, sections get one by default
    (`firm`, `none`).
- **E2E:** `tests/e2e/backdrops.spec.ts` (12):
  - each visible section's sheet holds its heading, helper, body and controls;
  - the calendar's sheet is the strongest, measured as its lift over the page in pixels;
  - re-layout on growth, resize and a view change, but not on a tick or a scroll;
  - the lane and the stones stay outside the sheets;
  - every text on the sheets is ≥ 4.5 : 1 against the pixels under it, in four lights at desktop,
    at hd sunset, and on the phone at midday and night;
  - on a phone, every calendar view, empty or full, lies on its sheet.
- **Changed:**
  - `wayfinding.spec` measures the stop-to-heading gap across the sheet's margin;
  - `v2-acceptance › … every dock text ≥ 4.5:1 on its sheet` reads text against the sheet's lift.
- **TESTING.md:** rows 12.30–12.34 and L8.

## Shared files
`src/main.ts` and `src/paint` are untouched. The sheet reads `createValueNoise2D` and the page's
paper tile. The dock contract gains `backdrop` (docs/ARCHITECTURE.md › Dock).

## Suites
SUITES

## Left open
- The due card's slip is darker than the Study sheet it lies on. It reads as a slip on a leaf, which
  is intended, but a lighter slip may suit it better.
- The sheets are not dimmed at night, like the rest of the dock (ADR 0121).
