# 21 — v2 polish, part 1

## What
The orchestrator's screenshot review of v2 (ADR 0005), item by item. ADRs 0180–0184.

1. **Corner tools visible at rest** (ADR 0180). Resting is a small step back: the tools and the zoom
   chips rest at 0.88 (they faded to 0.32), the pill at 0.72 (it was 0.42), and the muted speaker's
   ink is 0.9. Measured from real pixels in all four lights, every resting chip's ink is now ≥ 3 : 1
   against its paper. The old values gave 1.7–2.3 : 1.
2. **Tips on a scrolling page** (ADR 0181).
   - Page notes live in document coordinates, so they ride with the page through the smooth scroll
     with no per-frame chase.
   - Placement is pure (`ui/tip-place.ts`). A note shows only when its control is wholly on screen
     and the note has room without covering other slips or the dock's headings. Otherwise it waits,
     or the other copy of the control (corner or dock) takes it.
   - A faded note stops painting, and a new note removes one still fading.
   - Notes step aside while a plant card is open.
   - Page notes are no longer dimmed by the garden's light. Notes were also swung sideways by the
     slip's rotation far down the page; they now use the `translate` property.
3. **Watering pour** (ADR 0182). A procedural `pour` recipe: swelling water noise, an airy top and
   rising bubbles, about 2 s at gain 0.06. It plays on every `session:water` (automatic or tapped),
   only when unmuted, one at a time. There is a studio entry `audio/pour`.
4. **Daylight art** (ADR 0184).
   - The midday sky is wet-in-wet cerulean with darker wet pools, and its whites are *lifted* from
     the wet blue in drifts (`liftedDrift`), so there are no cloud shapes.
   - In dark light, the night wash stops short of the stage's CSS dissolve with a ragged, pooled,
     granulated edge (`ambience/night-edge.ts`). The margin is paper instead of a grey haze; the
     daytime dissolve is unchanged.
   - Checked in all four phases and two blends at 1440×900, 1920×1080 and 390×844.
5. **Calendar week** (ADR 0183).
   - The overlap layout uses the drawn minimum (44 min in a week), so blocks that look concurrent
     share the column.
   - The "now" seal sits in the line before the time.
   - Week blocks keep a short time ("4:10"), long ones wrap their title, phones fade the first
     letters, and a hovered or focused block grows to read whole (leftwards at the week's end).
   - The first day of the week is the locale's, on purpose (en-US Sunday, en-GB Monday), and tested.
   - The hour rail is wider, so "10 AM" is not clipped.
6. **Your plant's window** (ADR 0184). One round puddle: a hand-made circle, sky blue let into
   celadon, a pooled rim, the bottom lost where the plant's ground sits (the window was moved a
   little lower for that). The first version was a lumpy blob with a second off-centre ring.
7. **Floating card type**. Bigger (task 17, time 38, state 15, buttons 15.5 px) in solid inks of
   the app's palette, all ≥ 4.5 : 1. The footer is 150 px, and the state line drops the session total
   when it would not fit. DOM card and studio preview share `CARD_FONTS`, `CARD_INK` and `LAYOUT`.
8. **Fresh-eyes pass** (see below): quieter native date/clock glyphs in the schedule sheet, rounder
   month rings on phones, a dead nested CSS rule removed, tips hidden under the plant card, the
   plant's ground in the window.

Shared files: none of `src/main.ts`. `src/ui/ui.css` carries the zoom chips' resting rule next to
the corner tools' (one `--rest-tools`), as the orchestrator asked ("match the zoom chips").

## Why / decisions
ADRs 0180–0184. The main trade-offs:
- Document-coordinate notes rather than chasing scroll frames: no lag by construction, and a
  full-page screenshot shows notes where they belong.
- The night edge is painted in the canvas (a lift to paper with a watercolour edge) rather than a
  per-phase CSS mask: two masks cannot be cross-faded by weight, and regenerating one at dusk would
  repaint the page.
- In a week, 44 drawn minutes is two lines. Laying out at the drawn size is what stops blocks from
  drawing over each other; hover and focus growth covers the cases where 2–4 blocks really
  coincide.

## Tests
- **Unit:**
  - `ui/tip-place` (7)
  - `ambience/night-edge` (4)
  - `widget/card-art` (10)
  - `audio/recipes` (pour, +1 and the generic checks)
  - `audio/garden-audio` (pours on every watering, only unmuted, one at a time)
  - `ui/calendar-model` (+2: week layout at the drawn size, short times; more locales for the first
    day)
- **E2E:**
  - `tips-scroll` (3): glued through a glide, one painting note per frame; waits off screen and
    picks the copy on screen; none over a plant card.
  - `tools-visibility` (1): ≥ 3 : 1 ink in four lights.
  - `calendar · week layout` (2) and `calendar · week start elsewhere` (1).
  - `studio › the round window` (1).
  - `daylight › at night the wash stops short of the margin…` (1).
  - `widget › opens in a (faked) PiP window…` now also checks that the type fits, in focus and in a
    break.
- **Changed tests:**
  - `ui-menu › the controls on the painting rest…` expects 0.72 / 0.88 and the zoom chips.
  - `daylight › each phase paints its own light…` measures the painting inside its margins (the
    night margin is now paper).
- **Suites:** `npm run typecheck`, `npm test` (97 files, 1242 tests), `E2E_PORT=4186 npm run e2e`
  (143) pass.

Screenshots reviewed (`artifacts/before`, `artifacts/after`, `artifacts/crops`, `artifacts/probe`,
`artifacts/fresh`):
- every phase at three sizes and the dusk and dawn blends;
- the resting corner in four lights;
- tips scrolled to the calendar and the tools;
- the week (desktop, phone, an expanded block);
- the round window;
- the widget studio;
- the plant card;
- the month, the schedule sheet and the planting sheet;
- full pages at night.

## Fresh-eyes pass: left for others
- **Camera / plants owner:**
  - On a phone the plant card cuts its last lines at the bottom ("25 minutes of study" half
    visible).
  - Zoomed in at sunset on a phone, the pond's near edge shows a crisp pink band (the warm water
    plate meets the shore hard).
  - In Your plant's watering animation, a small detached can or drop shows outside the frame to
    the upper right (`plants/view.ts`).
  - Seedlings at low growth are still tiny in the 64 px session thumbnails.
- **Weather:** the sun weather's light shafts read as pale vertical columns over the sky band at
  1440×900 (ambience `sun`, by design but generic).
- **Calendar:** the day timeline is centred near "now" only when first opened; after the dev clock
  (or a long-open tab) moves on, it stays where it was.
- **Planting sheet:** on desktop, the dock's text peeks out under the planting sheet's bottom edge
  (there is no backdrop under the top layer there).
- **Schedule sheet:** native date and time inputs follow the operating system's locale
  (dd/mm/yyyy, 24 h) while the calendar's labels follow `navigator.language` (12 h).
- **Your plant:** an empty window with only a seed reads a little bare.

## Left / known gaps
- The night edge assumes the stage's mask formulas (`edgeBand` mirrors `ui/stage-edge.ts`, and a
  unit test keeps them equal).
- Tips that wait for room may not show at all on very short windows. That is accepted under "one
  quiet thing at a time".
- The pour is verified as data and wiring. Hearing it is a manual check, as for all audio.
