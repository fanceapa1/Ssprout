# 25 — Dock wayfinding

## What
The owner said: "i feel like the UI feels a little too scattered and hard to follow. you can add
some guiding lines". Asked to choose, they picked "both: a painted path plus structure", with one
condition: "only if you can make it responsive without too much of a hassle". ADRs 0200–0204.

### Audit (before: `artifacts/wayfinding/before/`)
Screenshots at 1440 × 900, 1920 × 1080 and 390 × 844. The states were idle, one session, three
sessions and a break, with `schedule.demo()` and 25 plants. What made the page feel scattered:
1. **A ragged two-column row.** Study and Your plant sat side by side, and their heights differ in
   every state. With three sessions Study was about three times taller than the plant's column,
   which ended in a large empty area.
2. **No shared edges.**
   - On phones the plant's window and caption were centred while everything else was left-aligned.
   - "Schedule a session" floated at the far right of the calendar's row, past the 640 px day
     timeline.
   - The Switch buttons sat at the far edge of the sessions list, away from their rows.
3. **Headings weaker than their content.** Section headings were 19 px letter-spaced soft ink with
   an 84 px rule. The content under them was larger: a 25 px task, a 23 px plant name, a 68 px
   timer. The eye hopped between content.
4. **Two or three primaries at once.**
   - With a planned session due, the card's vermilion Start sat above the vermilion Start
     studying.
   - The pill's "Start studying" sat on the garden just above both.
   - While a session ran, Pause and End were the same quiet words.
5. **Orphaned controls.** "Plant another" sat alone at the foot of a long column.
6. **Nothing said what a section was for**, or what to do next.
7. A tip ("When you begin, we'll ask…") overlapped the planned-session slip on the garden. This
   cleared when the pill moved.

### Changes, by finding
1. **One reading spine** (ADR 0200). Every section takes the row, in order, on one left edge, with
   one rhythm. On wide screens, two tracks live only *inside* a section: the Study controls beside
   the sessions in progress, and the plant's window beside its caption. (1, 2, 5)
2. **Edges.**
   - The plant view is left-aligned on phones.
   - Schedule a session sits beside the calendar's navigation.
   - A session row's Switch follows its 200 px text column. (2)
3. **One heading treatment.** 27 px full ink, then a **helper line** (20.5 px italic) under every
   heading. The copy follows the state and lives in `ui/dock-guide.ts`; there is no guilt copy and
   no tip is repeated. (3, 6; ADR 0201)
4. **One primary action** (`data-primary`):
   - idle: Start studying;
   - focus: Pause, as a calm slip;
   - a break: Water, then Skip break;
   - paused: Resume;
   - a planned session due: its card's Start.
   Secondary words recede to the soft ink. (4; ADR 0201)
5. **The guiding path** (ADR 0202).
   - A hand-inked SVG brush line starts below the last stepping stone still clear of the stage's
     dissolving edge.
   - It crosses the dock's empty top margin to a lane left of the content, then walks down the
     lane.
   - A small flat stepping stone sits beside each visible heading, in order. The stone of the
     section being read is a shade darker.
   - It sits behind the content, multiplied, at 0.42 ink.
   - It re-lays out from the dock registry (`onChange`), ResizeObserver (dock, stage, sections,
     headings), window resize and fonts.
   - It draws in once (2.6 s) the first time the dock is seen, never with reduced motion.
6. **Added mid-task by the owner (orchestrator message 1).**
   - The pill moves to the top-left on wide screens, mirroring the tools. It steps aside (fades,
     inert) while the dock's Study controls are on screen (ADR 0203). (4, 7)
   - One hover language for every control (ADR 0204, `ui/hover.css`).
7. **Bugs from the last polish pass.**
   - *"Growing now" order.* Rows were sorted by start, then by id. Sessions started in the same
     instant tie (the dev API starts several on a frozen clock), and an id ends in a random tail, so
     the order changed between runs. Ties now fall back to the task name (numbers in order), then the
     id. The same fix applies to the calendar's items.
     - I kept start order rather than "active first", so a row never jumps under the pointer when
       you press Switch. The panel above already shows the active session.
   - *Seed views.* Growth framing may enlarge up to 8× (it was 4×). A seed painted as a flat dab
     (pine, maple, ginkgo, …) is raised onto a small soil mound with a furrow, which eases away by
     its first leaves. Your plant now uses growth framing too. Studio: `ui-shell/seed-bed`.

### Simplified for responsiveness (the owner's condition)
- **No weave between two columns, at any width.** Visiting Study and then Your plant side by side
  either crosses the Study heading or loops back on itself above it, because the stones are at the
  centre. The spine makes one route right everywhere. See ADR 0200, option 2.
- **Phones: a straight line, no meander.** In a 38 px gutter even a few pixels of sway came close
  to button boxes that reach into it.
- **Phones: the line starts at the garden's edge**, not over the painting, because the pill sits at
  the bottom centre of a phone's stage.
- Everything that differs by width is a custom property on `.dock`. The layout code is the same.

### Shared files
`src/main.ts` is untouched. In `src/plants`, only `view.ts` changed (the seed bed and an 8× zoom
cap).

## After (`artifacts/wayfinding/after/`)
- All four lights (`sprout.setTime`) at desktop and phone, idle and with three sessions.
- At midday: one session, a break and a fresh seed at 1920, 1440 and 390.
- Hover crops: `artifacts/wayfinding/hover/`, `hover-montage.png`.
- Studio: `artifacts/wayfinding/studio-ui-wayfinding-1440x900.png`,
  `entry-ui-shell_seed-bed-1440x900.png`.

The dock is not dimmed by the garden's light (ADR 0121), so the path and stones read the same in
every phase. Only the line's first ~150 px lies over the garden's dissolving edge. At night that
edge is paper, so the line reads the same there too.

## Tests
- **Unit:**
  - `ui/wayfinding-path` (10)
  - `ui/dock-guide` (4)
  - `ui/dock` › helper line
  - `ui/session-list` (3, new)
  - `ui/calendar-model` › sessions started in the same instant
  - `plants/view` › the seed bed (2)
- **E2E:** `wayfinding.spec.ts` (13, new):
  - the spine;
  - the path at desktop and phone;
  - never over text (all text line boxes);
  - with three sessions and a due card;
  - re-layout on a waiting card, a hidden section and a resize;
  - the stop being read;
  - helper lines by state;
  - one primary per state;
  - the pill stepping aside;
  - hover and focus;
  - the draw-in;
  - reduced motion.
- **Changed:**
  - `ui-shell › sections in order…` now asserts the spine;
  - `ui-shell › the session controls work from the dock…` checks the pill back at the top of the
    page;
  - `tips-scroll › a note rides with its control…` runs at 860 px, where the pill still sits at the
    bottom of the garden.
- **Studio:**
  - `ui-wayfinding/{path-wide, path-phone, stops, draw-in}`;
  - `ui-shell/seed-bed`;
  - `ui-shell/session-thumbs` and `plant-view-growing` now show growth framing.

## Suites (after rebasing on main at e2b0faf)
- `npm run typecheck` passes, and `npm test` passes (106 files, 1303 tests).
- `E2E_PORT=4191 E2E_WORKERS=2 npm run e2e`, niced: 174 of 176 passed in 38.8 min, at a load
  average of about 60.
  - The two that failed timed out at 60 s: `core-loop › plant at start…` and `wayfinding › one
    primary action in each state`. Run alone, both pass (41 s and 43 s).
  - The wayfinding test is now `test.slow()`.

## Left open
- A due card's Start and the long pause's Resume can both be seals if a planned session comes due
  during a long pause. This is rare; the helper line speaks to the long pause.
- On wide screens Your plant now sits below Study rather than beside it, so the page is longer.
  The camera still glides to the seedling on start.
- The path does not follow the camera: when zoomed in, the stones on screen move, but the line
  keeps to where they leave the overview.
- `span` stays in the dock contract but no longer changes the page.
