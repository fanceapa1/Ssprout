# Testing

How Study Sprout is tested, how to run the tests, the conventions every test follows, and a
**requirements → tests matrix** that maps each rule in `docs/SPEC.md` to the tests that cover it.
The owner's rule is "every behaviour is tested". When you add or change a behaviour, add the test
**and** a row (or a test name) here in the same change.

## The layers

| Layer | Where | Runs with | What it is for |
|---|---|---|---|
| Unit | `src/**/*.test.ts`, colocated with the code | Vitest (`npm test`) | Pure logic: core rules, session maths, plans, persistence, schedules, envelopes, geometry, paint maths, widget/notification policy. Node by default. DOM tests opt in with `// @vitest-environment jsdom`. Canvas code is tested through recording fakes (`src/plants/test-canvas.ts`). |
| End-to-end | `tests/e2e/*.spec.ts` | Playwright, Chromium (`npm run e2e`) | User-visible behaviour in the **production build** served by `vite preview` (ADR 0010), driven through the real UI or the `?dev` debug API (`window.sprout`, docs/ARCHITECTURE.md › Dev / test hooks). |
| Studio smoke | `tests/e2e/studio.spec.ts` | Playwright | Every studio entry renders without errors and paints something; controls (seed, play/pause, speed, background, scale, `#section`, `?entry`); lazy painting (only cards near the screen hold pixels, ADR 0006). |
| Visual review | `npm run shots`, the studio | a person (or agent) looking | Art quality: does it look like watercolour, is it subtle. Screenshots go to `artifacts/` (gitignored); nothing is asserted. |

Helpers:
- `tests/e2e/fixtures.ts` — the `test` used by every spec. It **fails a test on any console error
  or uncaught page error**. Also `openDev(page, query)`, `waitFrames(page, n)`, `canvasStats(page)`.
- `tests/e2e/ui-helpers.ts` — `openUi` (garden with `?dev&fixtures&uitime=0.02`, reset, seeded),
  `plantSession` (the full start flow through the UI, from the dock's Start studying, or with `another: true` from the Study section's "Plant another"),
  `setMinutes`, `reloadUi`, `calmUiMotion`.
- Controls that exist twice since the app shell (ADR 0130) are scoped: `.panel` (the dock's session
  controls), `.pill` (the timer pill on the garden), `.menu` (corner tools), `.tool-list` (dock
  tools). Scrolling is read in-page, frame by frame (`ui-shell.spec` › `wheelAndSample`), and
  `sprout.ui.scrollTo(…, { instant: true })` puts the page where a test needs it.
- `src/core/testing.ts`, `src/widget/test-helpers.ts`, `src/plants/test-canvas.ts` — unit fakes.

## Running

```sh
npm run typecheck                      # also type-checks tests/ and scripts/
npm test                               # Vitest, all unit tests (a few seconds)
npx vitest run src/core                # one folder
npm run e2e                            # build + preview on :4173 + Playwright
E2E_PORT=4187 npm run e2e              # another port (several checkouts at once)
E2E_PORT=4187 E2E_REUSE=1 npx playwright test plants   # reuse a running preview (fresh build!)
npx playwright test --repeat-each=3 --workers=4        # hunt flakiness under load (CI-like box only)
E2E_CLOCK=17:00 npx playwright test calendar marks    # run as if the page opened at 17:00 local
npx playwright show-trace test-results/<test>/trace.zip
```
To reuse a server: `npm run build && npx vite preview --host 127.0.0.1 --port 4187 --strictPort`,
then `E2E_REUSE=1`. Rebuild after every `src/` change, or you test the old build.

Vitest (`vite.config.ts`): 20 s per test. A few tests simulate hours of garden time or paint
every growth step and take 1–4 s on an idle laptop. Long loops collect problems and assert once
instead of calling `expect` per step (`src/fauna/sim.test.ts`).

`playwright.config.ts`: 60 s per test, 10 s per `expect`, fully parallel, 2 workers locally
(`E2E_WORKERS`; the owner's laptop runs two agents' suites at once, so run them under `nice -n 15`,
AGENTS.md › CPU budget). In CI (`CI=true`): one retry, 2 workers, `github` + `list` + HTML reporters. Traces and screenshots are kept for failed
tests (`test-results/`).

## Conventions

- **Never wait for wall-clock time.** Session time moves with the dev clock: `sprout.advance(ms)`,
  `toBreak()`, `skipToBlock(i)`, `completeSession()` jump it (ADR 0035). Rendering is awaited with
  explicit signals:
  - `sprout.ready()`: every system initialised.
  - `sprout.freeze()`: a stable frame is drawn.
  - `sprout.plantsReady()`: plant sprites painted, nothing snapped.
  - `sprout.plants.settle()`: growth and fades snapped, sprites painted.
  - `sprout.scenePainted()`: no background repaint pending.
  - `waitFrames(page, n)`: n renderer frames, via `sprout.frameStats().frames`.
  - `window.studio.ready`: the studio is mounted. It paints lazily: `await window.studio.settle()` before reading pixels (ADR 0006).

  The one deliberate `setTimeout` is the smoke test that *measures* the speed clock against real
  time.
- **Sample transient animations inside the page.** Watering lasts 2.5 s. A one-shot read in
  a later round trip can miss it on a loaded machine. Read it in the same task as the action
  (`widget.spec.ts`), or record it on every `requestAnimationFrame` (`plants.spec.ts`).
- **A reload restarts the dev clock at real time.** Jumps made with `sprout.advance` before a reload
  are lost (the saved timestamps are ahead of the new clock), so a reload test jumps only after it
  (`parallel-sessions › a reload continues every session…`).
- **Never depend on the hour the suite runs at.** The dev clock starts at the real time, so
  anything that reads the time of day (what is due, the day view's window, "today", the week, the
  lighting) changes with it. A test that needs an hour pins it first: `sprout.advanceTo('HH:MM')`
  jumps the dev clock forward to the next local `HH:MM` (today or tomorrow).
  `sprout.schedule.demo()` always lands on the next 16:10 with the 15:40 daily due, so a demo that
  needs sessions growing starts them *after* the demo (a jump of up to a day would end them).
  Count days in calendar days, never in `86_400_000` ms steps: a daylight-saving day is 23 or 25 h
  (`dayKeyIn` in `calendar.spec.ts`). Read time in the page with `sprout.now()`, never
  `Date.now()`. Prove a spec is hour-proof with `E2E_CLOCK=HH:MM` (the fixture jumps the clock
  there once the page is ready; a reload starts at real time again): try 00:30, 09:00, 17:00 and
  23:50 (devlog 31).
- **Pin what is not under test.** Lighting follows the app clock: advancing the dev clock moves
  the time of day. Use `sprout.setTime('noon')` and `settleAmbience()` for pixel comparisons.
  A session start glides the camera to its seedling (ADR 0168): a test that reads the garden at
  the overview calls `sprout.camera.autoFocus(false)` first; one that hovers or taps a plant after
  a start calls `await sprout.camera.settle()` (it also waits for the close view's detail). Use
  `reducedMotion: 'reduce'` when sway would add noise. Clear fauna before reading a region.
- **Drive simulations in one round trip.** Fauna loops run inside one `page.evaluate`, with the
  renderer frozen, so the frame loop does not compete with `fauna.step()`.
- **Prefer the dev fixture species** (`?fixtures`, `fx-*`, ADR 0055) for UI flows. Their names,
  tiers and habitats are stable. Never assert on the `placeholder-sprout`; it is a unit-test fixture
  only (`src/dev/placeholder-sprout.ts`). Real species appear in e2e tests only where the test is
  about real species (e.g. white clover in the studio).
- **Assert on SPEC behaviour, not tuning.** Tips: which tip is shown and when it retires, not
  pixel positions or exact delays (ADR 0124 may be retuned). Slots: pick them through
  `sprout.placementOptions(speciesId)` or geometry helpers rather than coordinates. Several older
  plant tests still use stable ids such as `meadow-1` and `shore-1`.
- **UI motion in tests.** `openUi` calls `calmUiMotion`. It applies the app's own reduced-motion
  stylesheet to the DOM UI only: no CSS animations, 1 ms transitions. `?uitime` scales the UI's JS
  delays, but CSS keeps real durations. Playwright also waits for a clicked element to stop
  moving. The garden is not put into reduced motion.
- **CPU budget.** Local e2e runs 2 workers by default (`E2E_WORKERS`); iterate on single specs and
  run the full suite once per task, niced, because two agents share the owner's laptop.
- **Heavy pages are scoped.** The studio is checked one section at a time in 4 parallel shards
  (`#<section>`), never all at once. Tests that paint 30+ sprites call `test.slow()`.
- Budgets (`plants.perf().avgMs < 2`, `ambience().ms < 1.5`, `fauna.bench().total < 8`) are
  generous ceilings for CI. The real numbers live in the system docs.

## Flakiness: what was fixed and why (2026-10-22)

Under machine load (several agents, 8–16 Playwright workers, load average 50–70) these failed. Root
causes and fixes:

| Symptom | Root cause | Fix |
|---|---|---|
| Studio "every entry renders" timed out | One page rendered every entry of every section synchronously (all species stages, full scene, fauna sheets). 15 s idle, over 30 s under load. | One section at a time via `#<section>`, in 4 parallel shards. A separate test checks the nav lists every section. |
| UI flows (cancel, breaks, …) timed out; every click took about 1 s | The planting sheet's 900 ms `sheet-rise` animation. Playwright waits for a clicked card to be stable, which stretches under load. The sheet also paints ~37 previews synchronously. | `calmUiMotion` (app's reduced-motion CSS for the UI); timeouts sized for load (60 s / 10 s). |
| Widget "card waters the plant" read `null` | Read a 2.5 s rAF animation in a separate round trip after the click. | Click and read in the same task. |
| Plants watering poll missed the middle of the pour | Same, polling a transient. | Per-frame sampling in the page. |
| "the seedling grows" pixel diff inverted | `advance(15 min)` moved the time of day, so lighting changed between captures. Sway and passing creatures added noise. | Pin noon, settle the ambience, reduced motion, clear fauna before each capture. |
| Birds "fly away" saw a bird at the end | With 8 plants a scheduled bird visited during the 70 simulated seconds. | Follow the spawned bird by id. Run the loop in-page with the renderer frozen. |
| Fauna bounds walk timed out | 80 round trips while the page also rendered at 60 fps. | One in-page loop, renderer frozen. |
| Ambience budget slept 1.5 s | Fixed sleep. | `waitFrames(page, 90)`. |
| Unit: fauna "never leave the pond" timed out (12 s) | One `expect` per creature per simulated step (≈ 1 M calls), with the 5 s default timeout. | Problems are collected and asserted once; Vitest gets a 20 s ceiling. |

## CI

`.github/workflows/ci.yml` (push to main, pull requests) runs: typecheck → unit → build →
install Chromium → e2e (`CI=true`: retries 1, 2 workers). The HTML report is uploaded on every run
that was not cancelled. `test-results/` (traces, screenshots) is uploaded on failure.
`.github/workflows/pages.yml` deploys to GitHub Pages **only after CI succeeded** for a push to
`main` (`workflow_run`), building exactly that commit. It can also be run by hand
(`workflow_dispatch`, deploys the current `main`).

## v2 acceptance (ADR 0005 and later owner requests)

Every owner request and decision in ADR 0005, and the owner's later requests, mapped to the code
that does it and the tests that prove it (devlog 30). Names as in the matrix below: unit tests as
`folder/file › test` under `src/`, e2e as `spec › test` under `tests/e2e/`. New checks live in
`tests/e2e/v2-acceptance.spec.ts` (`v2-acceptance › …`) and `src/ui/plant-card.test.ts`.
**Status:** ✔ covered · ◐ the rest by visual review only (or a stated headless limit) · ✘ gap.
A known gap is kept as a `test.fail()` test: it passes while the bug is there and fails once it is
fixed, as a reminder to drop the marker. None is open now (the two found in devlog 30 were fixed
in Q8a and Q8b).

**Summary: 41 rows — 38 ✔, 3 ◐, 0 ✘.**

### Owner requests (ADR 0005)

| # | Owner request | Implemented in | Test(s) | Status |
|---|---|---|---|---|
| R1a | The page is no longer just a canvas: the garden is the centrepiece and the GUI sits below it | `ui/stage.ts`, `ui/dock.ts` (ADR 0130) | ui-shell › the garden stage fills ~94 % of the window under a small margin; the dock peeks out below; › sections in order on one reading spine: Study, Your plant, the calendar, the tools (ADR 0200) | ✔ |
| R1b | Custom smooth scroll and a custom scrollbar | `ui/smooth-scroll.ts`, `ui/scroll-math.ts`, `ui/scrollbar.ts` (ADR 0131) | ui/scroll-math (all); ui/smooth-scroll (all); ui-shell › wheel over the garden scrolls the page with an eased glide; ctrl+wheel zooms the garden instead; › keyboard scrolls the page: Page Down glides, End and Home reach the ends; › the custom scrollbar shows the position and drags; the native bar is hidden | ✔ |
| R1c | A small margin between the tab's edge and the canvas | `ui/stage.ts`, `ui/ui.css` | ui-shell › the garden stage fills ~94 % of the window under a small margin… | ✔ |
| R1d | The canvas passes seamlessly into the UI | `ui/stage-edge.ts`, `ui/page-paper.ts` (ADR 0132) | ui/stage-edge (all); ui-shell › the garden stage fills… (`data-edge="masked"`); polish › the canvas edges dissolve into paper (no dark frame line) | ◐ the look by shots and studio `ui-shell/stage-edge` |
| R1e | A view of the plant being watered | `ui/plant-section.ts` (ADR 0134) | ui-shell › "Your plant" shows the session plant growing, plays watering, then the latest bloom; automatic focus watering › plays in Your plant and the garden every few focused minutes, with nothing to tap | ✔ |
| R1f | A calendar of study sessions, daily / weekly / monthly, daily by default | `ui/calendar.ts`, `ui/calendar-model.ts` (ADR 0175) | ui/calendar-model › ranges and navigation (all); calendar › daily by default; toggle views, navigate, and the choice is remembered | ✔ |
| R1g | Built to grow: later features plug into the UI | `ui/dock.ts` registry (ADR 0130) | ui/dock › orders sections by order, then registration…; › mounts content into the body and labels the section…; › keeps a placeholder hidden until it is filled; › runs cleanups on remove and on refill, and notifies listeners | ✔ |
| R2 | Switch between sessions; one active; switching pauses the other | `core/state.ts` (reducer), `core/controller.ts` (`switchTo`), `ui/session-list.ts` (ADRs 0150, 0156) | core/parallel › session/switch (all); core/controller-parallel › switchTo pauses the current one and resumes the chosen one…; parallel-sessions › start two, switch between them; the waiting one’s time does not advance; camera › switching sessions glides to the newly active seedling; v2-acceptance › the switch tip: one quiet note by Switch while another session waits, retired by switching | ✔ |
| R3a | The canvas zooms onto the plant when a session starts; the gardener can zoom back out | `ui/stage-camera.ts`, `render/camera.ts` (ADR 0168) | render/camera › framePose (all); camera › a session start glides the camera onto its seedling, a little off-centre; › double-click zooms in about the point; + / − and Whole garden | ✔ |
| R3b | A watering animation every now and then | `core/session.ts` (`focusWateringTimes`), `core/controller.ts` (ADR 0153), `plants/watering.ts` | core/focus-watering (all); automatic focus watering › plays in Your plant and the garden every few focused minutes, with nothing to tap; › never while paused or during a break | ✔ |
| R3c | Click any plant to zoom onto it and read its description | `ui/stage-camera.ts`, `ui/plant-card.ts`, `plants/hit-test.ts`, `plants/notes.ts` (ADRs 0166, 0167) | plants/hit-test (all); plants/notes (all); ui/plant-card (all); camera › click a plant: the camera glides onto it and its card tells its story; Esc closes it; › a growing seedling’s card shows its progress and time to go; v2-acceptance › a finished plant’s card names the plant it replaced, now pressed; a seedling’s, the plant stepping aside | ✔ |
| R4 | Schedule study sessions from the calendar | `core/schedule*.ts`, `ui/schedule-sheet.ts` (ADRs 0170, 0177) | core/schedule (all); core/schedule-controller (all); calendar › schedule a session from the calendar; it shows, and a daily repeat shows on the following days; › a tap on an empty time opens the editor at that time; › edit only this one, or this and the following; remove | ✔ |
| R5 | The garden follows the system clock in four phases: sunrise, midday, sunset, night | `ambience/solar.ts`, `ambience/daylight.ts`, sky and light plates (ADRs 0140–0147) | ambience/solar (all); ambience/daylight (all); daylight › follows the clock: the location is guessed from the time zone, sun times are real; › each phase paints its own light: night darkest and blue, sunset warm, midday richest; › blends sit between their phases and the sky follows setTime at once | ✔ (how each phase is painted: shots, studio `daylight`) |
| R6 | Better, more visible top-right icons, duplicated in the UI below | `ui/tools.ts` (ADRs 0135, 0180) | ui-shell › garden tools exist twice, with visible names in the dock, and share one state; tools-visibility › corner tools and zoom chips read clearly while resting, in all four lights | ✔ |
| R7 | Slightly bigger, higher-contrast fonts everywhere | `ui/ui.css` tokens (ADR 0136), `widget/card-art.ts` | ui/ink (all); widget/card-art (all); v2-acceptance › bigger, higher-contrast type: base ≥ 20 px at weight ≥ 500, headings ≥ 24 px, every dock text ≥ 4.5:1 on its sheet | ✔ |
| R8 | Plants about 1.25× bigger | `scene/slots.ts` (`GARDEN_PLANT_SCALE`), `plants/bounds.ts` (ADR 0148) | scene/geometry › plants at the garden scale (1.25×, ADR 0148) (all); plants/system › sizes sprites by species size × slot scale × viewport pixel scale…; v2-acceptance › plants are 1.25× the species box at their slot, and paint past the box a v1 plant had | ✔ |
| R9 | More saturated colours everywhere, tied to the day cycle | `paint/pigments.ts` (ADR 0144), light plates (ADR 0147) | paint/pigments › is richer than v1 but stays watercolour, never neon (ADR 0144); › raised the chroma of greens, water, stones and flowers; v2-acceptance › more saturated colour: the painted garden’s OKLab chroma clears fixed floors at midday and stays watercolour; daylight › each phase paints its own light… (midday richest) | ✔ |

### Interview decisions (ADR 0005)

| # | Decision | Implemented in | Test(s) | Status |
|---|---|---|---|---|
| D1 | The stage is ~94 % of the viewport (ADR 0212) and the UI peeks out | `ui/stage.ts` (ADR 0130) | ui-shell › the garden stage fills ~94 %…; ui · phone › the garden fills the screen, the controls stack below it, menu reachable, planting works by touch | ✔ |
| D2 | All session controls in the UI below; the canvas keeps a small timer pill (pause/resume), and a Start pill when idle | `ui/timer-panel.ts`, `ui/pill.ts` (ADRs 0133, 0203) | ui-shell › the session controls work from the dock and the pill shows the same session; › the pill pauses and resumes, and glides down to the controls; › idle, the pill is a small Start studying that opens the planting sheet | ✔ |
| D3 | Up to three sessions in progress; exactly one active; switching pauses the previous one; each holds its own spot | `core/state.ts` (reducer, `inProgressSessions`, `heldSlotIds`), `core/controller.ts` (ADRs 0150–0156) | core/parallel (all); core/controller-parallel (all); parallel-sessions › three can grow at once; a fourth is refused gently with an offer to switch; › a bloom leaves the others paused; the dock offers Resume on the one left last; › a reload continues every session: the active one ran while away, the waiting ones did not; v2-acceptance › cancelling one session leaves the others untouched: their time, spots and seedlings | ✔ |
| D4 | Camera: focus plus gentle free zoom; glide to the session's plant and to a clicked plant; pinch / zoom gestures; drag to pan within limits; "Whole garden" | `render/camera.ts`, `ui/stage-camera.ts` (ADRs 0160–0168) | render/camera (all); camera › ctrl+wheel zooms about the pointer and never scrolls; a plain wheel still scrolls the page; › drag pans only while zoomed in; the canvas lets the page scroll by touch at the overview; › a two-finger pinch zooms the garden; › keyboard on the focused garden: + − 0 and the arrows; › placement works at any zoom…; camera · reduced motion › glides become cuts; v2-acceptance › a double tap zooms in about the point; two taps apart do not; the browser’s dblclick after it adds nothing | ✔ (a real finger pinch: by hand, below) |
| D5 | A planned session has a name, optionally a length and plan; plant and spot are chosen at start | `core/schedule.ts` (ADR 0170) | core/schedule › validation (all); calendar › schedule a session from the calendar…; › at the scheduled time a card waits with one-tap Start; the sheet is prefilled; the bloom marks it done | ✔ |
| D6 | At the time: a soft notification and a waiting card with one-tap Start (prefilled); never auto-starts; quietly missed | `core/schedule-controller.ts`, `ui/schedule-card.ts` (ADRs 0172–0176) | core/schedule › due, missed, done (all); widget/notifications › createNotifier · scheduled sessions (ADR 0174) (all); calendar › at the scheduled time a card waits…; › not started within its window, it passes quietly into missed; "Not this time" lets one pass; calendar · notification › the scheduled time brings a soft notification while the page is in the background | ✔ (the OS notification itself: by hand, below) |
| D7 | Repeats: one-off, daily, weekdays, weekly | `core/schedule.ts` (ADR 0171) | core/schedule › recurrence (all); calendar › schedule a session… (daily repeat); › edit only this one, or this and the following; remove | ✔ |
| D8 | Automatic watering at random 4–10 min of focus, in the garden and the plant view, nothing to tap; breaks keep tap-to-water | `core/session.ts` (`focusWateringTimes`), `core/controller.ts` (ADR 0153) | core/focus-watering (all); automatic focus watering › plays in Your plant and the garden…; › never while paused or during a break; ui-session › breaks: water the plant, then skip the rest of the break | ✔ |
| D9 | Real sunrise and sunset at a location guessed from the time zone; no prompt; ~40-min blends | `ambience/solar.ts`, `ambience/zones.ts`, `ambience/daylight.ts` (ADRs 0140, 0141) | ambience/solar (all); ambience/zones (all); ambience/daylight › phase windows (all); daylight › follows the clock…; › blends sit between their phases… | ✔ |
| D10 | Plant description: species, Japanese name, its place in Japanese gardens, its poetic line, and the plant's own history | `ui/plant-card.ts`, `plants/notes.ts` (ADR 0167) | plants/notes (all); ui/plant-card (all); camera › click a plant…; › a growing seedling’s card…; plant-card-phone › a growing spider lily that replaced a plant can be read whole, its last fact included; v2-acceptance › a finished plant’s card names the plant it replaced… | ✔ |

### Orchestrator decisions (ADR 0005)

| # | Decision | Implemented in | Test(s) | Status |
|---|---|---|---|---|
| O1 | A wheel over the canvas scrolls the page; zoom by pinch, ctrl/⌘+wheel, double-click/tap, + / − / Whole garden; drag pans only zoomed in; touch: one finger scrolls unless zoomed in, two fingers pinch | `ui/stage-camera.ts` (ADR 0164) | ui-shell › wheel over the garden…; camera › ctrl+wheel…; › drag pans only while zoomed in…; › a two-finger pinch zooms the garden (synthetic touch pointers); › double-click zooms in…; v2-acceptance › a double tap zooms in… | ◐ real fingers on a touch screen by hand |
| O2 | Touch scrolling stays native; the smooth scroll drives wheel, keys and scrollbar; reduced motion → no smoothing | `ui/smooth-scroll.ts` (ADR 0131) | ui/smooth-scroll (all); ui-shell › keyboard scrolls the page…; app shell · reduced motion › no smoothing: the wheel moves the page at once | ◐ native touch momentum by hand |
| O3 | The UI is a dock of sections registered by features | `ui/dock.ts` (ADRs 0130, 0200) | ui/dock (all); ui-shell › sections in order on one reading spine…; wayfinding › lays itself out again when a section appears or goes, when content grows, and on resize | ✔ |
| O4 | The calendar shows past sessions (completed; cancelled faintly) and planned ones | `ui/calendar-model.ts` (ADR 0175) | ui/calendar-model › calendarItems (all); calendar › past sessions show in the calendar: completed in their plant’s colour, ended early faintly | ✔ |
| O5 | A session log, through a v1 → v2 migration (chained to schema v3) | `core/session-log.ts`, `core/persistence.ts` (`migrateV1toV2`) (ADRs 0151, 0154, 0213) | core/session-log (all); core/migration-v2 › v1 → v2 migration (all); core/migration-v3 (all); smoke › ?dev exposes window.sprout and renders a stable frame (schema 3) | ✔ |
| O6 | Plants 1.25× in the garden, slot spacing re-checked so neighbours still read | `scene/slots.ts` (ADR 0148) | scene/geometry › plants at the garden scale (1.25×, ADR 0148) (all) | ✔ |
| O7 | Saturation raised in the shared pigments and species palettes, balanced per daylight phase | ADRs 0144, 0147 | as R9; daylight › each phase paints its own light… (midday most saturated, night least); v2-acceptance › more saturated colour… (night < 0.7 × midday) | ✔ |

### Later owner requests

| # | Owner request | Implemented in | Test(s) | Status |
|---|---|---|---|---|
| L1 | Replace the round red dot (ADR 0194) | `ui/icons.ts` (sprout mark, brush mark), `ui/calendar-art.ts` | marks › the sprout marks what begins a planting and what grows now; no round red dot anywhere; calendar · week layout (ADR 0183) › concurrent blocks share the column, the seal never covers words, a narrow block reads whole on hover | ✔ |
| L2 | The studio paints lazily (ADR 0006) | `src/studio/` | studio · lazy painting (ADR 0006) › the whole studio paints only what is near the screen, and the rest on scroll; studio › every entry renders without errors and paints something (shards 1–4) | ✔ |
| L3 | Dock wayfinding: a guiding path (ADR 0202) | `ui/wayfinding.ts`, `ui/wayfinding-path.ts` | ui/wayfinding-path (all); wayfinding · desktop › the path leaves the stepping stones and passes every heading in order, beside it; › never crosses text, with three sessions growing and a planned session waiting; › lays itself out again…; › the stop of the section being read is a little stronger as the page scrolls; wayfinding · phone › a straight line down the left gutter, a stop beside each stacked heading, never over text; wayfinding · motion › a gentle draw-in on first view; none with reduced motion | ✔ |
| L4 | Dock wayfinding: helper lines under one reading spine (ADRs 0200, 0201) | `ui/dock.ts`, `ui/dock-guide.ts` | ui/dock › gives every section a helper line under its heading…; ui/dock-guide (all); wayfinding · desktop › one reading spine: every section on one left edge, in order, with a heading and a helper line; › the helper lines follow the state | ✔ |
| L5 | Dock wayfinding: hover effects, one hover language, the same on keyboard focus (ADR 0204) | `ui/hover.css` | wayfinding · desktop › controls answer the pointer and the keyboard in one calm way; wayfinding · motion › with reduced motion the path is simply there, and nothing moves on hover; v2-acceptance › seals, sprout marks, tools, corner and zoom chips, calendar words, the pill and sheet cards each answer the pointer; › keyboard focus shows the hover state: a seal, a calendar word, a corner chip, a quick pick; › keyboard focus lifts the dock tools and the sheet’s plan and plant cards too | ✔ |
| L6 | Dock wayfinding: the two Start buttons no longer side by side; one primary action (ADRs 0201, 0203) | `ui/timer-panel.ts`, `ui/pill.ts`, `ui/schedule-card.ts` | wayfinding · desktop › one primary action in each state; › the garden pill sits in the top-left corner and steps aside while the Study controls are on screen; wayfinding · phone › the pill keeps its place on the garden and steps aside in the dock; v2-acceptance › a planned session due during a long pause: its Start is the one marked primary; › a planned session due during a long pause: only one vermilion seal in Study, and Resume is the seal again once the card goes | ✔ (the seal follows `data-primary`: the long pause's Resume steps back to an ink slip while the due card's Start leads) |
| L7 | The lotus dead end (ADR 0205) | `ui/planting-sheet.ts`, `scene/slots.ts` (two large water slots) | plants/plantable › lotus (Q1) › fits the two large open-water slots; › has no spot only when seedlings… hold both; lotus › choose Lotus, a large open-water spot glows, Begin plants its seedling in the pond; › when seedlings hold both large water spots, the sheet shows the lotus has no spot instead of a dead end | ✔ |
| L8 | A backdrop on each UI section, especially the calendar (ADR 0208) | `ui/backdrop.ts`, `ui/backdrop-sheet.ts`, `ui/dock.ts`, `ui/calendar-art.ts` | rows 12.30–12.34; backdrops (all) | ✔ |
| L9 | No round red dot in the favicon either: an unseen bloom closes the ring around the sprout mark (ADR 0194, Q16) | `widget/favicon.ts` (`drawFavicon`, 64 px PNG) | widget/favicon › never paints vermilion: a bloom closes the ring around the sprout mark; › drawFavicon pixels (bloomed while away) (all: 16 / 32 / 64 / 96 px on light and dark strips, rasterised by `rasterContext`); marks, not dots: the favicon › a bloom while away closes the favicon ring around the sprout, with no red dot at any tab size | ✔ (look: studio `widget/favicon-sizes`) |

### Needs a human (not automatable headless)
- **Real touch:** a finger pinch, one-finger scrolling with native momentum, double tap on a phone
  or tablet (O1, O2, D4). The e2e tests use synthetic touch pointer events.
- **Audio:** data tests and real offline graph renders check levels and isolation (8.1, 8.5). Timbre, café realism and musical taste still need listening on real devices.
- **Real devices and browsers:** iOS Safari, Android Chrome, Firefox (§10.2); e2e runs Chromium
  with device emulation.
- **Real notifications with the tab closed or in the background**, and a real Picture-in-Picture
  window (D6, §6.1, §6.3): headless runs fake `Notification` / the service worker's
  `showNotification` and `documentPictureInPicture`.
- **The look:** watercolour quality of each phase, the seamless stage edge, the 1.3× species
  colours, neighbours reading at 1.25× (shots and the studio).

## Requirements → tests matrix

Legend: unit tests as `folder/file › test`, under `src/` (`.test.ts` omitted). E2E as
`spec › test`, under `tests/e2e/` (`.spec.ts` omitted). Test names are abbreviated where long.
**Status:** ✔ covered · ◐ partly (the rest by visual/aural review or a stated limit) ·
✘ gap.

### §1 The garden

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 1.1 | One fixed scene: sky, hills, two tree groups, pavilion, banks, pond with boulders, stepping-stone path to the pond | scene/geometry › rings the pond with 8–12 boulders…; › runs the stepping stones from the bottom centre up to the pond…; › keeps the lantern under the pavilion and the sky band in the sky; › keeps the painted trees and foreground tufts inside the world; › has a simple … pond polygon | scene › paints the garden: pale paper sky, celadon pond, varied painted marks | ◐ look by studio `scene/full` + shots |
| 1.2 | Barren start: a few tufts, a couple of shrubs, no flowers | core/state › builds an empty, muted garden | smoke › ?dev exposes window.sprout and renders a stable frame (no plants) | ◐ tufts/shrubs by review |
| 1.3 | Responsive: landscape shows the scene, portrait crops around the pond without distortion | render/viewport › maps the whole world exactly…; › covers a wide screen…; › crops the sides on portrait screens…; › shows tall phones at least MIN_VISIBLE_W…; › clamps the focus… | polish · phones › a tall phone sees a wider slice…; scene › small resizes rescale…; big ones repaint | ✔ |

### §2 Study sessions: planting

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 2.1 | Task name ≤ 40, suggestion placeholder, empty → "Study session", kept forever | core/session › normalizeTaskName (both); core/reducer › normalises the task name; › finalises the plant with its task name… | ui-start-flow › an empty task name plants a "Study session"…; ui-session › sheet… (maxlength 40); ui-session › completion… (label shows the task) | ✔ |
| 2.2 | Total time 10–180 in 5-min steps, chips 25/50/90, remembers last value; total decides tier | core/session › clampGoalMinutes (all); core/rewards › tierForMinutes; core/reducer › plants a seedling session… | ui-start-flow › total time: a 10–180 slider…; › the last total is remembered…; ui-session › sheet… (tier words at 25 and 90) | ✔ |
| 2.3 | 2–4 plans per total, breaks inside, always Unbroken, sums exactly, ends with focus, < 30 min only Unbroken; shown as a segmented brush line | core/plans › %i min: sums exactly…; › offers only Unbroken below 30…; › offers 2–4 plans…; › has the expected shapes…; ui/plan-line (all) | ui-session › sheet…; core-loop › plant at start → … (plans(60)); ui-session › begin → focus panel… (plan line) | ✔ |
| 2.4 | Plant choice: tier ≤ earned selectable; higher tiers visible but locked ("needs 50 min+"); earned highlighted; card = preview, name, native name, poetic line, habitat | core/rewards › selectableSpecies (all); core/controller › selectableSpecies marks locked and earned species; core/reducer › only allows species whose tier is earned… | ui-session › sheet…; ui-start-flow › plant cards…; polish › the placeholder sprout is not a plant you can pick | ✔ |
| 2.5 | Choose its spot (placement mode); occupied = swap | core/placement (all); core/controller › placementOptions lists compatible slots with occupants; plants/plantable › has a compatible slot for each species; › lotus (Q1) › fits the two large open-water slots; › has no spot only when seedlings… hold both | ui-session › sheet… (only compatible markers); › swap into an occupied spot…; › keyboard: Tab to a marker…; plants › placement shows an in-canvas highlight…; lotus › choose Lotus, a large open-water spot glows, Begin plants its seedling in the pond; › when seedlings hold both large water spots, the sheet shows the lotus has no spot… | ✔ |
| 2.6 | Begin; first start asks gently for notification permission | widget/notifications › asks at the first session:start…; › stores a denial…; › a dismissed prompt leaves the setting unasked… | widget › completion notifies… (permission granted at start); widget › denied permission is respected | ✔ |

### §2 During the session

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 2.7 | Seedling at the spot grows live (garden + widget); growth = focused ÷ total focus; breaks don't grow it | core/session › grows only during focus…; plants/system › draws the growing plant at its slot…; › eases the displayed growth…; widget/view › focus: … growth from the timeline; plants/sprites › growth quantisation (all) | plants · growth › the seedling appears at its slot and grows…; widget › the card renders the plant… | ✔ |
| 2.8 | Timer shows block remaining and session remaining; plan segments show position | core/session › tracks the current block, its remaining time and the total remaining; ui/plan-line › maps elapsed minutes to x piecewise; widget/view › focus: block time big, session total small… | session-rules › the timer shows the current block and the whole session…; ui-session › begin → focus panel… | ✔ |
| 2.9 | Break: soft notification "Time for a break — your <plant> is thirsty." | widget/notifications › notificationText names the plant and the task; › break, back to focus and bloom, while the page is not attended | widget › break and back-to-focus notify while the page is in the background | ✔ |
| 2.10 | Watering: UI and widget show a can; tap → can tilts, droplets arc, soil darkens, leaves lift | plants/watering (all); plants/system › plays the watering animation on session:water…; plants/view › adds the watering can, droplets and damp soil…; widget/pip › plays a watering animation once at a time…; › a water event from the garden plays the animation in the widget too; core/reducer › session/water (all) | ui-session › breaks: water the plant…; plants › break → water plays the watering animation…; widget › in a break the card waters the plant… | ✔ |
| 2.11 | Not watering has no penalty | core/reducer › not watering changes nothing about the outcome | session-rules › an unwatered break simply ends… | ✔ |
| 2.12 | Skip break removes the rest of that break; ends sooner; tier unchanged | core/reducer › session/skipBreak (all); core/controller › skipBreak() jumps…; core/session › a skipped break jumps straight to the next focus block | ui-session › breaks: … skip the rest of the break; core-loop › plant at start → …; widget › in a break the card … skips the break | ✔ |
| 2.13 | Next focus block starts automatically with a soft notification | core/controller › announces each block transition once from the tick; widget/notifications › break, back to focus and bloom… | session-rules › an unwatered break simply ends…; widget › break and back-to-focus notify… | ✔ |
| 2.14 | Pause: unlimited; paused time doesn't count | core/session › excludes previous pauses…; › pauses freeze the timeline; core/reducer › pause/resume (all); core/controller › excludes paused time… | ui-session › begin → … pause/resume; widget › opens in a (faked) PiP window, updates, pauses… | ✔ |
| 2.15 | After 30 min paused: "Still with us?" with Resume / End session | core/session › detects a long pause at 30 minutes | ui-session › long pause shows "Still with us?"; session-rules › "Still with us?" can end the session too | ✔ |
| 2.16 | Cancel: light confirmation; seedling withers and fades; replaced plant returns; no penalty, counted in stats | core/reducer › session/cancel (all); core/controller › cancel withers the seedling; a displaced plant stays; plants/system › withers the seedling…; › fades a displaced plant out … and back in on cancel; plants/wither (all) | ui-session › cancel needs a gentle confirmation naming the plant; plants › cancel withers the seedling away and returns the plant it replaced; core-loop › cancel… | ✔ |
| 2.17 | Complete: full bloom, notification + chime (if unmuted), quiet line, permanent plant with task/minutes/date; a replaced plant is pressed into the herbarium | core/reducer › session/complete (all); core/controller › completion (all); plants/system › blooms the completed plant in place…; audio/garden-audio › plays a bloom chime on plant:placed…; › plays nothing while muted… | ui-session › completion: the plant blooms, a quiet line names it…; › swap … pressed into the herbarium; plants › a completed plant blooms in place and persists…; widget › completion notifies… | ✔ (chime: unit only) |
| 2.18 | Persistence: timestamp-based; reload continues; completes if the plan ended while away | core/controller › completes on startup a session that finished while the app was closed; › on startup mid-break…; core/persistence › round-trips an active session… | ui-session › a session survives a reload mid-way; core-loop › … persisted across reloads; session-rules › a session that ended while the app was closed has bloomed on return | ✔ |

### §2 Parallel sessions & focus watering (ADRs 0150–0157)

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 2.23 | Up to three in progress; a fourth start is refused | core/parallel › allows up to three in progress…; core/controller-parallel › up to three in progress: a fourth start is refused quietly… | parallel-sessions › three can grow at once; a fourth is refused gently… | ✔ |
| 2.24 | Starting another makes it active and pauses the previous one | core/parallel › makes the new session the active one and pauses the previous one…; › keeps a session the gardener had already paused…; core/controller-parallel › starting another session pauses the active one… | parallel-sessions › start two, switch between them… | ✔ |
| 2.25 | Switching pauses the current one and resumes the chosen one; paused time never counts | core/parallel › session/switch (all); core/controller-parallel › switchTo pauses the current one…; › switchTo the active session resumes it…; audio/garden-audio › a switch brings the weather of the session switched to; › a switch from nothing active (after a bloom)…; › pause and resume follow the active session, also across a switch | parallel-sessions › start two, switch between them; the waiting one’s time does not advance | ✔ |
| 2.26 | Each session keeps its plant, spot, plan position, break/watering state and pause time | core/parallel › each session keeps its own plant, spot, plan position…; core/controller-parallel › switching into a session mid-break does not announce that break again… | parallel-sessions › start two… | ✔ |
| 2.27 | At the limit, a gentle explanation and an offer to switch; no guilt copy | — | parallel-sessions › three can grow at once… (note text, focus on Switch, no sheet) | ✔ |
| 2.28 | Cancelling one leaves the others untouched | core/parallel › cancelling the active session leaves the waiting ones untouched…; › a waiting session can be ended by id…; core/controller-parallel › cancel() ends the active session only…; plants/system › cancelling the waiting session withers only its seedling…; audio/garden-audio › cancelling a waiting session leaves the active one sounding as it was; › cancelling a waiting session while the active one is paused…; › cancelling the active one with others waiting goes quiet… | v2-acceptance › cancelling one session leaves the others untouched: their time, spots and seedlings | ✔ |
| 2.29 | Completing one blooms it; the others stay paused; nothing resumes on its own; the dock suggests the one left last | core/parallel › completing the active session blooms it…; core/controller-parallel › completion blooms the active session…; widget/view › none active: says who is waiting and offers Resume…; audio/garden-audio › completing the active one with others waiting goes quiet, with the phrase… | parallel-sessions › a bloom leaves the others paused; the dock offers Resume… | ✔ |
| 2.30 | Spots of sessions in progress are occupied (no planting, no swap) | core/parallel › treats the spots of sessions in progress as occupied…; core/controller-parallel › placementOptions leaves out the spots… | parallel-sessions › three can grow at once… (placement options) | ✔ |
| 2.31 | Every seedling grows at its own growth; waiting ones look calm | plants/system › several sessions in progress (all) | — (screenshots: `three-*`, devlog 18) | ✔ |
| 2.32 | "Still with us?" only for the active session the gardener paused | core/parallel › "Still with us?" and waiting sessions (all); core/controller-parallel › “Still with us?” is only for the active session… | parallel-sessions › start two… (no long pause after switching) | ✔ |
| 2.33 | Reload continues every session; only the active one ran while away | core/controller-parallel › reload with several sessions…; plants/system › after a reload every seedling shows at its own growth | parallel-sessions › a reload continues every session… | ✔ |
| 2.34 | Automatic focus watering every 4–10 focused minutes, seeded; in the garden, Your plant and the widget; nothing to tap; a soft pour when unmuted | core/focus-watering (all); core/controller-parallel › waters the active plant when focused time reaches each scheduled moment…; › several due at once (a long gap) water once; core/parallel › session/focusWater (all); plants/system › waters the seedling the event names… | parallel-sessions › plays in Your plant and the garden…; › the floating card and the tab title follow the active session… (card watering) | ✔ (pour: audio/garden-audio › pours softly on every watering…; audio/recipes › the watering pour is a gentle two-second trickle…) |
| 2.35 | Never while paused or in a break; breaks keep tap-to-water | core/focus-watering › a pause holds…; › a break holds them too…; core/controller-parallel › never while paused…; › never during a break… | parallel-sessions › never while paused or during a break | ✔ |
| 2.36 | Pill shows the active session and "+N"; Your plant, widget, title, favicon, notifications and the sound's weather follow the active session; the widget can switch | widget/view › several sessions in progress (all); widget/pip › with other sessions in progress the card offers Switch…; audio/garden-audio › follows the active session (all); › the sound mixes follow the active session too (all); › waiting sessions alone are silent at load… | parallel-sessions › start two… (pill "+1"); › three… (pill "+2"); › the floating card and the tab title follow the active session… | ✔ |
| 2.37 | One quiet switch tip | core/tips › has the contract ids… (`switch`) | v2-acceptance › the switch tip: one quiet note by Switch while another session waits, retired by switching | ✔ |
| 2.38 | Session log of completed and cancelled sessions, day/week/month queries | core/session-log (all); core/parallel › log ids; core/migration-v2 › back-fills the log… | parallel-sessions › a bloom leaves the others paused… (`log()`) | ✔ |

### §2 Active-session ambience

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 2.19 | Weather per session: sun (most common), soft rain, mist | core/session › pickWeather (all); ambience/envelope › focus: the session weather at full…; ambience/motes › rain: count tracks the level; ripples stay on the pond; › sun glints are rare and bounded… | ambience › a session brings its weather; every weather and night render… | ◐ look by review |
| 2.20 | Photosynthesis motes rise from plants; plants sway a touch more | ambience/motes › moteEmitters (all); › motes: few at a time…; › no motes outside focus; ambience/wind › is a touch stronger during a session; › windBoost maps phases | ambience with reduced motion › … no motes (the negative case) | ✔ |
| 2.21 | Paused: ambience fades to stillness, not off abruptly | ambience/envelope › paused: a faint still trace; › pause: motion eases to stillness…; › session end: fades out over 3–5 s | ambience › pause eases the weather to a still trace; ending the session fades it out | ✔ |
| 2.22 | Low-contrast and slow; never competes with plants | ambience/envelope › session start: crossfades in over 3–5 s… | ambience › a session brings its weather… ("stays subtle": frame delta < 40) | ◐ by review |
| 2.22a | Sun weather: a thin warm glaze with soft diagonal light lifted out of it, nothing over the sky; warm glints on the pond and sunlit leaves; fades on pause and at the end (ADR 0193) | ambience/sun (all: sky unglazed, lifted bands, diagonal fall, pooled edge, half lift, leaf glints on the sunlit side only in sun, still while paused) | ambience › the sun weather (ADR 0193) › a warm glaze with light lifted out of it… | ✔ (the look by shots and studio `ambience-weather/sun`) |

### §3 Rewards and placement

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 3.1 | Tier by total: 10–24 · 25–49 · 50–89 · 90–180 | core/rewards › %i min → tier %i; › TIER_MIN_MINUTES are the tier thresholds | ui-session › sheet… (perennial at 25, centrepiece at 90) | ✔ |
| 3.2 | Species per tier (examples) | plants/registry › every species is well formed; › filters by tier | — | ◐ list differs from the examples (SPEC status note) |
| 3.3 | Chosen at start; no end-of-session picker | core/reducer › session/start (all) | ui-session (all flows) | ✔ |
| 3.4 | ~50–60 slots, each with a habitat | scene/geometry › has 50–60 slots with unique ids; › has %s slots in the planned range; › uses only known habitats and size classes; › puts every water slot on the pond…; › puts shore slots at the pond edge… | scene › exposes 50–60 slots across all habitats; › ?dev&slots draws the slot overlay | ✔ |
| 3.5 | Only compatible slots shown (habitat + max size class) as glowing markers | core/placement › isCompatible (all); › compatibleSlots (all); scene/geometry › only offers tree-sized slots on the far bank…; plants/plantable | ui-session › sheet… (iris: shore/water markers only); plants › placement shows an in-canvas highlight…; lotus › choose Lotus… (only `water-1`/`water-3` glow) | ✔ |
| 3.6 | Swap: old plant steps aside, pressed into the herbarium on completion, returns on cancel | plants/system › fades a displaced plant out…; core/reducer › records the finished plant in the chosen slot as displaced…; › presses the displaced plant… | ui-session › swap into an occupied spot…; plants › cancel withers … returns the plant it replaced; core-loop › cancel… | ✔ |
| 3.7 | Upgrades = a higher tier into an occupied slot | core/reducer › records the finished plant in the chosen slot as displaced… | ui-session › swap into an occupied spot… | ✔ |
| 3.8 | Finished plants sway gently | plants/draw › sway maths (all); plants/system › finished plants sway with the wind, and hold still under reduced motion | — | ✔ |
| 3.9 | Hover a finished plant → ink label: task · minutes · date; a tap opens its card | ui/plant-labels (all) | ui-session › completion… (hover); plants › plant bounds drive the hover label…; session-rules · phone › tapping a finished plant opens its card… | ✔ |
| 3.10 | Plants 1.25× bigger in the garden, painted at that size; neighbours read; nothing on the stones or over the engawa | scene/geometry › plants at the garden scale (all); plants/system › sizes sprites by species size × slot scale × viewport pixel scale (× the garden scale); › reports world bounds…; ui/plant-labels › computes sprite boxes… | plants › plant bounds drive the hover label…; v2-acceptance › plants are 1.25× the species box at their slot, and paint past the box a v1 plant had | ✔ |

### §4 Wildlife

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 4.1 | Unlock table (always … 25 plants) | core/fauna-unlocks (all); fauna/schedule › roster (all) | fauna › a new garden has water striders…; koi arrive with plants; › the unlock table drives the roster… | ✔ |
| 4.2 | Real behaviour: koi drift and turn, bees visit pollinator flowers, birds land then leave, dragonflies over water | fauna/sim › FaunaSim (all); fauna/targets (all); fauna/math (all) | fauna › every creature can be spawned and stays within bounds…; › birds land on perches … then fly away; › at night birds, bees and butterflies rest… | ◐ motion quality by studio review |
| 4.3 | Rare at first, one at a time, never more than a handful | fauna/schedule › caps visitors and per-kind maxima; › nothing comes at once…; › later visits are separated by long quiet gaps; fauna/sim › … visitors never exceed the cap | fauna › … visits are scheduled, not immediate | ✔ |
| 4.4 | First appearance → one quiet line (ADR 0120) | fauna/arrivals (all); core/fauna-unlocks › newlyArrived (all); ui/format › reads arrival lines… | ui-menu › a creature arrival gets one quiet line and is recorded | ✔ |

### §5 Time of day

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 5.1 | Real sun times for today at a location guessed from the time zone; no prompt | ambience/solar (all: London, New York, Tokyo, Sydney ±3 min; polar day, polar twilight, deep polar night, poles; moon phase); ambience/zones (all) | daylight › follows the clock: the location is guessed from the time zone, sun times are real | ✔ |
| 5.2 | Four phases (sunrise, midday, sunset, night) on civil dawn, sunrise + 60, sunset − 60, civil dusk; 40-min blends | ambience/daylight › phase windows (all); › unusual days (all); › weights always sum to 1 and change smoothly…; ambience/daylight-source (all) | daylight › each phase paints its own light…; › blends sit between their phases… | ✔ |
| 5.3 | Each phase painted: sunrise (peach horizon, cool hills, mist on the pond, long shadows, dew), midday (clear, most saturated, short shadows, sparkle), sunset (amber/crimson, rim light, long shadows the other way, warm pond, lantern), night (indigo, moon, stars, moonlit water, lantern and window) | ambience/sky-layout (all: sun side and height, moon arc, shadows away from the sun, rims, stars); ambience/timeofday › phase grades (all); scene/sky-light (all); plants/shadow (all); paint/rim (all) | daylight › each phase paints its own light: night darkest and blue, sunset warm, midday richest; › the moon is a light in the night sky and the sun a light low over the hills | ◐ look by review (studio `daylight`, shots; midday sky of lifted whites, ADR 0184) |
| 5.3a | At night the wash stops short of the stage's dissolve with a watercolour edge; the margin is paper, not a grey haze (ADR 0184) | ambience/night-edge (all) | daylight › at night the wash stops short of the margin and the margin is paper… | ◐ look by shots + studio `ambience-lighting/night-edge` |
| 5.3b | The night keeps its depth: the lower frame (thin paint: the meadow, the path) is glazed indigo to the reference weight by the night grade, not left milky and not greyed (ADR 0206, devlog 29) | ambience/timeofday › night is the darkest but plants stay readable… (ground > 1, the bottom still lighter than the sky) | daylight › the night keeps its depth… (lower frame 0.60–0.665 of midday's luminance, reference 0.63, milky 0.69; ≥ 0.36 of its saturation; b > r + 10) | ✔ (before/after/reference by shots, devlog 29) |
| 5.4 | Plants readable at all times | ambience/timeofday › night is the darkest but plants stay readable… | daylight › each phase… (night luminance ≥ 45 % of midday) | ✔ |
| 5.5 | `setTime` phases, blends, v1 aliases, hours, null | ambience/daylight › setTime overrides (all) | ambience › setTime accepts phases, v1 names, blends, hours and null…; daylight › blends sit between their phases and the sky follows setTime at once | ✔ |
| 5.6 | Fauna follows the phases (diurnal creatures rest at night) | fauna/schedule › rests diurnal creatures at night but not leaves | daylight › fauna rests at night by the daylight phases | ✔ |
| 5.7 | No per-frame repainting of large layers; frame budget | — | daylight › stays inside the frame budget at night with the full light; ambience › stays inside the frame budget | ✔ |

### §6 Timer visibility & notifications

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 6.1 | Floating widget (Document PiP): the session's plant growing live; task, remaining, plan progress, pause/resume, watering in breaks; opened by a button | widget/pip (all); widget/view (all); plants/view (all) | widget › support follows Document Picture-in-Picture; › opens in a (faked) PiP window…; › the card renders the plant and blooms…; › in a break the card waters…; ui-menu › floating timer button follows the widget integration | ◐ a real PiP window cannot open headless (faked `documentPictureInPicture`) |
| 6.2 | Tab title countdown and filling favicon | widget/title (all); widget/tab (all); widget/favicon (all) | widget › tab title counts down, the favicon fills…; › breaks show in the title and favicon | ✔ |
| 6.3 | Notifications via the service worker; background only; closed tab → none, the reward waits | widget/notifications › decideNotification (all); › session moments (all) | widget › completion notifies when the page is in the background (via sw); › no notification while the page is visible and focused; › denied permission is respected; session-rules › … ended while the app was closed… | ✔ |
| 6.4 | Ticks from a Web Worker (no background throttling) | widget/ticker (all) | widget › ticks come from a Web Worker | ✔ |
| 6.5 | The card's type is bigger and in solid ink (≥ 4.5:1) and fits the 260 × 340 window | widget/card-art (all) | widget › opens in a (faked) PiP window… (no line cut, buttons inside, in focus and in a break) | ✔ |

### §7 Tooltips / onboarding

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 7.1 | Subtle hints near non-obvious controls; one at a time (ADR 0124) | core/tips › tip registry; › activeTips (all); ui/format › pickTips (all) | ui-menu › tips show near their control…; polish › one tip at a time…; tips-scroll › a note rides with its control through a smooth glide… (one painting note per frame) | ✔ |
| 7.2 | A tip retires when its mechanism is first used | core/tips › tipsRetiredBy (all); core/controller › retires the start-flow tips; core/reducer › tip/retire | ui-menu › tips … retire when used (sound); polish › one tip at a time… (task); ui-menu › floating timer button… (widget); ui-session › swap… (pressed); core-loop › … (task, duration, plan, water) | ✔ |
| 7.4 | Notes stay on their control through every scroll, wait while it is off screen or has no room, pick the copy on screen (corner or dock), never paint faded, step aside for a plant card (ADR 0181) | ui/tip-place (all) | tips-scroll (all) | ✔ |
| 7.3 | ⓘ lists every tip, the learned ones marked | core/tips › allTips lists every tip with its retired flag | ui-menu › tips … stay listed under ⓘ | ✔ |
| 7.5 | A small inked × (a real, named button with a ≥ 32 px target; only it takes the pointer) dismisses a tip: retired for good and saved, listed as learned under ⓘ, the next tip speaks after the fade (ADR 0211) | core/tips › dismissing a tip (all); core/controller › retireTip with reason dismissed… | tips-dismiss › a click retires the tip for good: the next one speaks, ⓘ lists it, a reload keeps it gone | ✔ |
| 7.6 | Keyboard: Tab from the tip's control reaches its ×, Tab moves on past the control, and Shift+Tab walks the same order back (× before the control); Enter dismisses and focus returns to the control; Esc in a note dismisses it and not the sheet around it (ADR 0211) | — | tips-dismiss › keyboard: Tab reaches the ×…; › Esc inside a note dismisses that tip, not the sheet around it | ✔ |
| 7.7 | Touch: a tap on the × dismisses the tip on a phone; the next tip still waits while the quiet line speaks (ADR 0124, 0211) | — | tips-dismiss › a tap on the × dismisses the tip (390 × 844, touch); › the next tip still waits while the quiet line speaks | ✔ |

### §8 Sound

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 8.1 | Procedural Web Audio: water, wind, distant birds, rain in rain sessions, bloom chime, a watering pour (ADR 0182) | audio/recipes (all); audio/noise (all); audio/planner (all); audio/params › rain brings patter and drips…; audio/garden-audio › reacts to session events: rain during a session… | — | ◐ audible result by ear (headless output not asserted) |
| 8.2 | Muted by default; speaker toggle; remembered | audio/garden-audio › is muted by default…; audio/gate (all); core/controller › updateSettings … retires the sound tip | ui-menu › sound toggle persists across reloads | ✔ |
| 8.3 | Standard travels across sceneries; each scenery restores its own palette and mix; Follow the garden is reversible | core/soundscape (all); audio/params › personal mixes; audio/garden-audio › personal soundscapes; › the sound mixes follow the active session too (all) | sound-mixer › two collections retain their mixes…; › scenery changes…; › layer toggles… | ✔ |
| 8.4 | Levels, volume and collection persist and export; v2 gardens migrate without changing content/mute; editing never unmutes; imports/reset reach the audio gate | core/soundscape › merges only valid changes…; › round-trips mixes…; core/migration-v3 (all); core/controller › restoring and resetting…; audio/garden-audio › personal soundscapes | sound-mixer › a saved v2 garden migrates…; › Standard levels, overall volume and the selected collection persist…; › two collections…; › importing and resetting settings… | ✔ |
| 8.5 | Standard beds are deterministic and quiet; channels mute scheduled events; real graph has headroom | audio/standard-loops (all); audio/params › silences all ambience… | sound-mixer › real audio graph: every Standard layer is audible, quiet, and zero channels silence scheduled birds | ✔ levels/isolation; listening still by ear |
| 8.6 | Mixer supports keyboard, reduced motion and narrow phones; sticky playback clears focused controls | — | sound-mixer › layer toggles…; › phone 390…; › phone 320… | ✔ |
| 8.7 | Every new Standard bed paints and plays in the studio; all ink icons fit its sheet | — | sound-mixer-studio (all) | ✔ |

### §9 Persistence

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 9.1 | localStorage `studysprout:v1`, versioned schema, migrations, safe recovery | core/persistence › migrate (all); › validateState (all); › loadState (all); › saveState / createSaver (all) | core-loop › a corrupt save is backed up and the garden starts fresh | ✔ |
| 9.2 | Export `study-sprout-garden-YYYY-MM-DD.json`; validated import | core/persistence › export / import (all) | ui-menu › export downloads the garden; import validates, confirms and restores | ✔ |
| 9.4 | Schema v2: a v1 garden and a v1 session in progress (running or paused) survive; history back-filled; v1 exports still import | core/migration-v2 (all); core/persistence › migrate (all) | smoke › ?dev exposes window.sprout… (version 2) | ✔ |
| 9.3 | `?dev` debug API and `?speed` | core/clock › createSpeedClock (all) | smoke › app loads… (no API without ?dev); › ?dev exposes window.sprout…; › ?speed accelerates the app clock… | ✔ |

### §10 Platforms

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 10.1 | Phones: touch, portrait crop, controls reachable | render/viewport (portrait cases) | ui-menu · phone › the garden fills the screen, the controls stack below it…; polish · phones; session-rules · phone › tapping a finished plant… | ✔ |
| 10.2 | Modern evergreen browsers | — | Chromium only | ✘ **gap:** Firefox/WebKit are not run (the title/favicon fallback matters most there). Adding Playwright `firefox`/`webkit` projects needs the widget specs to skip PiP outside Chromium. |
| 10.3 | `prefers-reduced-motion`: ambience/fauna reduced, no sway | ambience/envelope › reduced motion keeps the weather but freezes motion…; fauna/sim › reduced motion…; fauna/schedule › reduced motion…; widget/pip › skips the watering animation with reduced motion; plants/system › … hold still under reduced motion | ambience with reduced motion › rain is still…, no motes… | ✔ |

### §11 Developer tools

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 11.1 | Studio shows every sprite, creature, effect and paint primitive | studio/registry › discovers the real *.studio.ts files; › flattens…; › rejects duplicate…; › finds entries… | studio › lists every section in the nav…; › every entry renders without errors and paints something (4 shards) | ◐ "every sprite has an entry" is a convention (AGENTS.md), not machine-checked |
| 11.2 | Seed/reseed, play/pause, speed, background, scale; URL `#section`, `?entry`, `?seed`, `?t` | — | studio › reseed re-renders with a new seed; › #section shows only that section; › ?entry shows a single entry large; › ?seed and ?t start paused…; › speed, background and scale controls | ✔ |
| 11.3 | The dev clock pins a time of day (`sprout.advanceTo`, forward only, daylight saving included); `schedule.demo()` opens at the same hour whenever it runs, with a session due; e2e never depends on the hour it runs at | dev/local-time (all) | marks › the sprout marks what begins a planting…; calendar · a planned slip on a phone’s garden…; calendar · the day follows now (all); calendar › schedule a session…; › edit only this one…: all pass with `E2E_CLOCK` = 00:30, 09:00, 17:00, 23:50 (devlog 31) | ✔ (hour-proofing is a run, not a CI job) |

### §12 The app page

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 12.1 | Stage ~94 % of the window under a small margin; the dock peeks out; the renderer sizes to the stage | stage-edge › sizes the dissolve to the stage… | ui-shell › the garden stage fills ~94 %…; ui-menu · phone › the garden fills the screen… | ✔ |
| 12.2 | The garden dissolves into the page's paper (no hard line); the page is the garden's washi | ui/stage-edge (all) | ui-shell › the garden stage fills… (`data-edge="masked"`) | ◐ look by shots + studio `ui-shell/stage-edge` |
| 12.3 | Smooth scroll: wheel (also over the garden) and keys ease, jumps glide; no repaint on scroll | ui/scroll-math (all) | ui-shell › wheel over the garden scrolls the page with an eased glide…; › keyboard scrolls the page… | ✔ |
| 12.4 | ctrl/⌘ + wheel and pinch over the garden never scroll the page (they zoom the garden) | — | ui-shell › wheel over the garden… ctrl+wheel zooms the garden instead; camera › ctrl+wheel zooms about the pointer… | ✔ |
| 12.5 | Touch native; reduced motion: no smoothing | — | ui-shell · reduced motion › no smoothing… | ◐ touch momentum is the platform's (not asserted) |
| 12.6 | Custom scrollbar: shows the position, drags, fades, native bar hidden, not a focus stop | ui/scroll-math › scrollbar thumb (all) | ui-shell › the custom scrollbar shows the position and drags… | ✔ |
| 12.7 | Pointer mapping stays right when scrolled | — | ui-shell › pointer mapping stays right on a scrolled page… | ✔ |
| 12.8 | Dock: sections in order on one reading spine (one left edge, each below the last) at every width; two tracks inside Study on wide screens; the calendar once filled (a placeholder stays hidden) (ADR 0200) | ui/dock (all) | ui-shell › sections in order on one reading spine…; ui-menu · phone › the garden fills the screen…; wayfinding › one reading spine… | ✔ |
| 12.9 | Session controls work from the dock; the pill shows the same session | — | ui-shell › the session controls work from the dock…; ui-session (all flows); session-rules (all) | ✔ |
| 12.10 | Pill: pause/resume, glide to the controls; idle Start studying | — | ui-shell › the pill pauses and resumes…; › idle, the pill is a small Start studying… | ✔ |
| 12.11 | Your plant: live growth, watering animation (hook), latest bloom / empty bed when idle; a soft round window wash (ADR 0184) | — | ui-shell › "Your plant" shows the session plant growing…; studio › the wash is round with a pooled rim, and lost at the bottom | ◐ look by studio `ui-shell/plant-view-*` |
| 12.12 | Tools twice (corner + dock), visible names, one shared state; icons ≥ 22 px, targets ≥ 44 px, labelled | — | ui-shell › garden tools exist twice…; ui-menu (sound, widget, data, hints) | ✔ (night legibility: tools-visibility › corner tools and zoom chips read clearly while resting, in all four lights) |
| 12.13 | Bigger, darker type: base ≥ 20 px, text ink ≥ 4.5:1 | ui/ink (all) | v2-acceptance › bigger, higher-contrast type: base ≥ 20 px at weight ≥ 500, headings ≥ 24 px, every dock text ≥ 4.5:1 on its sheet | ✔ |
| 12.14 | Tips point at the controls' new homes | ui/format › pickTips (all) | ui-shell › tips point at the controls in their new homes | ✔ |
| 12.15 | The controls on the painting rest while focusing (a small step back: tools 0.88, pill 0.72, ADR 0180); the dock does not | — | ui-menu › the controls on the painting rest while studying…; tools-visibility › … ≥ 3:1 ink in all four lights | ✔ |
| 12.16 | Sheets sit on a leaf of the page's washi (no dock text beside or below them); the page is locked under every sheet (wheel, keys, smooth scroll); the torn edge stays whole over a sticky footer (ADR 0190) | ui/smooth-scroll › a focused inner scroller… keeps its keys; › at its end, or on the page itself… | overlays › the planting sheet: paper behind it, the page locked…; › every other sheet locks the page too… | ✔ |
| 12.17 | No round red "recording" dots: the inked sprout marks what begins a planting or grows now (pill, dock, Plant another, Schedule a session, growing now, the waiting card, due/growing blocks, the bloomed favicon); a brush stroke marks what is chosen (ADR 0194) | widget/favicon › drawFavicon pixels (no red in the bloomed favicon) | marks › the sprout marks what begins a planting…; marks, not dots: the favicon › a bloom while away closes the favicon ring around the sprout…; calendar · week layout (the mark never covers words) | ✔ (all four lights by shots; studio `ui-shell/marks`, `widget/favicon-sizes`) |
| 12.18 | On a phone a planned session's slip and the zoom chips never overlap | — | calendar · a planned slip on a phone's garden… | ✔ |
| 12.19 | Every section: the same heading and a helper line under it (what it is for, what next), following the state; short, no exclamation marks, no guilt, no tip repeated (ADR 0201) | ui/dock › gives every section a helper line…; ui/dock-guide (all) | wayfinding › one reading spine…; › the helper lines follow the state | ✔ |
| 12.20 | One primary action in Study per state: Start studying, Pause, Water then Skip break, Resume, a due card's Start (ADR 0201) | — | wayfinding › one primary action in each state; v2-acceptance › a planned session due during a long pause: its Start is the one marked primary; › …only one vermilion seal in Study, and Resume is the seal again once the card goes | ✔ |
| 12.21 | A guiding path from the stepping stones passes every visible heading in order, a stone beside each, on desktop and on a phone (a straight gutter line) (ADR 0202) | ui/wayfinding-path (all) | wayfinding › the path leaves the stepping stones…; wayfinding · phone › a straight line down the left gutter… | ✔ (look: shots in four lights, studio `ui-wayfinding`) |
| 12.22 | The path never crosses text (all text line boxes in the dock), also with three sessions and a waiting card | ui/wayfinding-path › never crosses a heading or helper line… | wayfinding › …passes every heading…; › never crosses text, with three sessions…; wayfinding · phone › … never over text | ✔ |
| 12.23 | The path lays out again when a section appears or goes, when content grows (the waiting card) and on resize; the stone of the section being read is darker | ui/wayfinding-path › re-lays out when a section appears or goes… | wayfinding › lays itself out again…; › the stop of the section being read… | ✔ |
| 12.24 | The path draws in once on first view; never with reduced motion | — | wayfinding · motion › a gentle draw-in…; › with reduced motion the path is simply there… | ✔ |
| 12.25 | The pill sits top-left on wide screens (bottom on phones) and steps aside while the dock's Study controls are on screen: one Start studying on screen (ADR 0203) | — | wayfinding › the garden pill sits in the top-left corner…; wayfinding · phone › the pill keeps its place… | ✔ |
| 12.26 | One hover language: ink deepens with a brush stroke drawing in, slips lift, the same on keyboard focus; colour only with reduced motion (ADR 0204) | — | wayfinding › controls answer the pointer and the keyboard…; wayfinding · motion › …nothing moves on hover; v2-acceptance › seals, sprout marks, tools, corner and zoom chips, calendar words, the pill and sheet cards each answer the pointer; › keyboard focus shows the hover state: a seal, a calendar word, a corner chip, a quick pick; › keyboard focus lifts the dock tools and the sheet’s plan and plant cards too | ✔ |
| 12.27 | Sessions in progress keep a stable order (by start, ties by name), in Study and in the calendar | ui/session-list › compareSessionRows (all); ui/calendar-model › sessions started in the same instant… | parallel-sessions › start two, switch… | ✔ |
| 12.28 | A just-planted seed reads in Your plant and the 64 px thumbnails (growth framing up to 8×; a flat seed on a soil mound) | plants/view › a seed lies on its bed…; › can enlarge a seed… | — | ◐ look by studio `ui-shell/seed-bed` |
| 12.29 | Keyboard focus in a sheet reveals the whole control: never under the planting sheet's sticky footer or the torn edge (`scroll-padding` sized to the footer, an instant reveal in every motion setting; Q14) | — | overlays › keyboard focus clears a sheet’s sticky parts › the planting sheet: tabbing to the last plant card at 1440×900; › …at 390×844; › the schedule sheet with its pickers open at 390×844… | ✔ |
| 12.30 | Every visible dock section lies on its own seeded, torn sheet of the page's washi (lighter than the page, a wash pooled under its lower and right edges) that holds its heading, helper line and content (ADR 0208) | ui/backdrop-sheet › the torn edge (all); › the pooled wash under it (all); › the images (all); ui/backdrop (all) | backdrops · desktop › every visible section lies on its own sheet, which holds its heading, helper line and content | ✔ (look: `artifacts/backdrops/after/`, studio `ui-backdrop`) |
| 12.31 | The calendar's sheet is the strongest: firm, lifted furthest; every view (day, week, month), empty or full, lies on it, at phone width too (ADR 0208) | ui/backdrop-sheet › the calendar’s firm sheet is lifted further…; ui/backdrop › every dock section gets one by default… | backdrops · desktop › the calendar’s sheet is the strongest…; backdrops · phone › each view of the calendar, empty or full, lies on its sheet… | ✔ |
| 12.32 | Sheets lay out again when a section grows, the window resizes or the calendar changes view; never on a tick or a scroll; a sheet that grows keeps its top and sides | ui/backdrop › draws once per size…; ui/backdrop-sheet › keeps its edges when the sheet grows taller… | backdrops · desktop › sheets lay out again when a section grows or the window resizes, never on a tick or a scroll | ✔ |
| 12.33 | The path's lane and its stones stay outside the sheets, a stone beside each heading on its sheet | ui/backdrop-sheet › lies under the lower and right edges, never out to the left… | backdrops · desktop › the path’s lane and its stones stay outside the sheets…; backdrops · phone › each view of the calendar… (the lane); wayfinding (all, stops measured outside the sheet's margin) | ✔ |
| 12.34 | Text on the sheets reads at ≥ 4.5 : 1, measured from the pixels under it, in all four lights (desktop), at hd, and on phones (midday, night) | — | backdrops · desktop › every text on the sheets reads at ≥ 4.5 : 1 from its pixels · sunrise / midday / sunset / night; backdrops · hd › …; backdrops · phone › … midday / night; v2-acceptance › … every dock text ≥ 4.5:1 on its sheet | ✔ |

### §12a Camera & plant cards (ADRs 0160–0168)

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 12a.1 | The overview is the stage's framing (zoom 1); zoom up to 3×; views never leave the painting (overview ∪ world, wider only past a zoom of 1.25; lit paper rows on tall phones) | render/camera › composeView (all); › clampPose (all); › inset slack (all) | camera › double-click zooms in…; › drag pans only while zoomed in… | ✔ |
| 12a.2 | The camera composes with the cover viewport; every world layer follows it, the paper stays fixed | render/camera › composeView…; render/renderer › camera (all) | camera › ctrl+wheel… (point under the pointer stays); ui-shell › pointer mapping stays right on a scrolled page… | ✔ |
| 12a.3 | ctrl/⌘ + wheel / trackpad pinch zoom about the pointer and never scroll; a plain wheel scrolls | render/camera › zoomAbout and panBy (all); › createCamera › a gesture zoom eases toward its target about the pointer | camera › ctrl+wheel zooms about the pointer and never scrolls; a plain wheel still scrolls the page | ✔ |
| 12a.4 | Double-click / double-tap zooms in; + / − / Whole garden; keys + − 0 arrows Enter | — | camera › double-click zooms in about the point; + / − and Whole garden; › keyboard on the focused garden…; v2-acceptance › a double tap zooms in about the point; two taps apart do not… | ✔ (synthetic touch pointers; a real finger by hand) |
| 12a.5 | Drag pans only while zoomed; touch: one finger scrolls the page at the overview, pans when zoomed; two fingers pinch | render/camera › a drag moves the painting… | camera › drag pans only while zoomed in…; › a two-finger pinch zooms the garden | ◐ real touch devices by hand (the pinch is synthetic pointer events) |
| 12a.6 | Glides: eased, never linear, pull back on long moves; input interrupts; reduced motion cuts | render/camera › glides (all); › user input interrupts a glide…; › cuts instead of gliding under reduced motion | camera · reduced motion › glides become cuts | ✔ |
| 12a.7 | A session start glides to its seedling (off-centre, garden around it); a switch glides to the new active one; nothing re-zooms on its own | render/camera › framePose (all) | camera › a session start glides the camera onto its seedling…; › switching sessions glides… | ✔ |
| 12a.8 | Placement works at any zoom; entering it glides to the whole garden | — | camera › placement works at any zoom… | ✔ |
| 12a.9 | Click/tap a plant → glide onto it + a card: species, Japanese name, note, poetic line, task, minutes, date; a seedling's progress and time to go; replaced plant | ui/plant-card (all); plants/notes (all) | camera › click a plant: the camera glides onto it and its card tells its story…; › a growing seedling's card shows its progress…; session-rules · phone › tapping a finished plant opens its card; v2-acceptance › a finished plant’s card names the plant it replaced, now pressed; a seedling’s, the plant stepping aside | ✔ |
| 12a.10 | The hit-test is the front-most painted plant; transparent parts miss; the cursor offers plants | plants/hit-test (all); plants/system › hit-tests the front-most plant, finished or growing | camera › click a plant… (cursor `pointer`) | ✔ |
| 12a.11 | The card closes by Esc, the close mark, a click elsewhere; keyboard focus in and back; a named dialog; docked at the bottom on phones with the plant framed above | — | camera › click a plant… (Esc); › the card opens from the keyboard…; camera · phone › the card docks at the bottom… | ✔ |
| 12a.12 | A note for every species (2–3 quiet sentences) | plants/notes (all) | — | ✔ |
| 12a.13 | Close views stay sharp: scene detail painting, sky detail (moon, stars), light-plate marks repainted, sprites at the zoomed resolution for plants in view; far-off high-res sprites evicted | plants/sprites › follows the zoomed scale…; › evicts what a predicate picks…; plants/system › the camera (all) | camera › close views are painted in detail… | ◐ the look by shots and studio `camera-detail/*` |
| 12a.14 | Camera moves never repaint in a frame; glides stay smooth | render/renderer › while the camera moves the background is the overview cache scaled up… | camera › a glide stays smooth: main-thread frame cost while the camera moves | ✔ |
| 12a.22 | A close view at rest costs about what the overview costs: sprites blit only their ink, the resting light plate is laid 1:1 at device resolution (ADR 0207) | plants/sprites › finds the ink…; plants/draw › ink crop (all); plants/system › a close view blits only the painted part of each sprite; ambience/device-plate (all) | camera · cost at rest › a close view at rest costs about what the overview costs (main-thread time per frame from CDP, raster included, ≤ 1.75 × the overview) | ✔ (pixels by a before/after compare at a pinned view, devlog 28) |
| 12a.15 | No seams in a close view at any zoom, pan or phase: the paper margins are one continuous ragged lift; the detail painting is the overview resolved (world-anchored flow, rng in step) and cross-fades in as an exact lerp; the reflected sky fades inside the pond's rim (ADR 0185) | scene/margins › is a continuous ramp…; › wanders…; › cuts deeper at the bottom corners… | close-view › the meadow has no seams where the paper margin used to band, zoomed | ◐ pans, the pond edge and the cross-fade by shots and studio `close-view/margin` |
| 12a.16 | The near ground and trunks hold watercolour detail close up (patches, back-runs, granulation, grass; bark), seeded, the same marks in the overview and the detail (ADR 0186) | scene/paint-ground › stay on the grass… | — | ◐ the look by shots and studio `close-view/ground`, `close-view/trunk` |
| 12a.17 | Plants read as solid paint at every zoom and match the 1× look; rims keep their place on a sharper sprite (ADR 0187) | — | close-view › a plant is as solid at 3× as at 1× | ◐ the look by shots and studio `close-view-plants/solid` |
| 12a.18 | Creatures near the focused plant are sharp in a resting close view, painted in idle time, never stalling a frame; memory bounded (ADR 0188) | fauna/art-cache (all) | — | ◐ the look by shots and studio `close-view-fauna/*` |
| 12a.19 | A phone's first glide toward its cropped sides finds them painted; a strip painting's cut sides fade to paper (ADR 0189) | — | — | ◐ by shots (mid-glide on a 390×844 phone) |
| 12a.20 | The plant view: the can never shows a sliver at the frame's edge; thumbnails frame what has grown (ADR 0189) | plants/watering › the can in a small frame…; plants/view › growth framing (all) | — | ◐ the look by the plant view sheet in shots |
| 12a.21 | On phones (390×844, 360×740) the whole card can be read: the longest note and a growing plant fit or scroll inside the card with a mark at the cut; the scrolling part is a keyboard region (ADR 0190) | — | plant-card-phone › the longest note (lotus)…; › a growing spider lily that replaced a plant…; › the mark at the cut reads on | ✔ (studio `ui-camera/plant-card-docked-long`) |
| 12a.22 | At night (and in the blends into and out of it) a close view has no straight line where the sky plate stops at y 500: the night's saturation glaze only takes colour out, over a white-backed frame, so the meadow and the plants on it are not cut (ADR 0206) | — | close-view › no hard line where the sky plate ends, at night, zoomed on the meadow (row step < 3 levels; 9.7 before the fix) | ✔ (before/after by shots, devlog 27) |

### §13 Calendar & scheduling (ADRs 0170–0177)

| # | Rule | Unit | E2E | Status |
|---|---|---|---|---|
| 13.1 | Daily / Weekly / Monthly, Daily by default, remembered per viewer; prev / next / Today | ui/calendar-model › ranges and navigation (all) | calendar › daily by default; toggle views, navigate, and the choice is remembered | ✔ |
| 13.2 | Weekly: seven columns from the locale's first day (Monday when unknown); DST weeks are seven days | ui/calendar-model › the week starts as the locale says… (en-US Sunday, en-GB/fr Monday, ar-EG Saturday); › a week across the autumn DST change… | calendar › daily by default… (7 heads, first day = weekStartsOn); calendar · week layout › the week starts on Sunday in en-US; calendar · week start elsewhere › … Monday in en-GB | ✔ |
| 13.3 | Monthly: whole weeks, a dab per bloom, minutes, rings for plans (faint when passed); tap a day → daily | ui/calendar-model › month marks (all); › the month grid’s whole weeks | calendar › daily by default… (tap a day) | ◐ look by shots + studio `calendar/month` |
| 13.4 | Past sessions (completed in the plant's colour, cancelled faintly), sessions in progress, planned, a now line | ui/calendar-model › calendarItems (all) | calendar › past sessions show in the calendar…; › at the scheduled time… (growing block) | ◐ look by shots + studio `calendar/*` |
| 13.5 | Overlapping blocks side by side, laid out at their drawn size; tiny blocks keep a readable height; a week's blocks keep their short time and grow to read whole on hover/focus (ADR 0183) | ui/calendar-model › timeline layout (all); › in a week, a plan and a session half an hour apart share the column…; › a week shows short times | calendar · week layout › concurrent blocks share the column, the seal never covers words… | ✔ |
| 13.6 | The day opens on a sensible window; a tap on an empty time opens the editor there (half hour) | ui/calendar-model › opens an hour and a half before now…; › a tap snaps to the half hour | calendar › a tap on an empty time opens the editor at that time | ✔ |
| 13.7 | Schedule: name, date and time, length and plan optional (open), no plant or spot | core/schedule › validation (all); core/schedule-controller › adds schedules… | calendar › schedule a session from the calendar… | ✔ |
| 13.8 | Repeats: once, daily, weekdays, weekly; exceptions; DST-safe | core/schedule › recurrence (all, Europe/London DST) | calendar › schedule a session… (a daily repeat on the following days) | ✔ |
| 13.9 | Edit / remove: only this one vs this and the following; a new repeat applies from that day | core/schedule-reducer › edits… (all); › split…; core/schedule-controller › edit and remove through occurrence refs | calendar › edit only this one, or this and the following; remove | ✔ |
| 13.10 | Stored in the garden (pure reducers), export/import validated; v2 documents without schedules load | core/schedule-reducer › schedule reducers (all); core/persistence › scheduled sessions (all) | — | ✔ |
| 13.11 | At the time: soft notification while the page is in the background, once | widget/notifications › createNotifier · scheduled sessions (ADR 0174) (all); core/schedule-controller › announces an occurrence once… | calendar · notification › the scheduled time brings a soft notification… | ✔ |
| 13.12 | Background tabs: the worker ticker drives the due check | widget/ticker › the same worker drives the scheduler… | — | ✔ |
| 13.13 | A waiting card (and a slip by the pill) with one-tap Start; never auto-starts | core/schedule › due… | calendar › at the scheduled time a card waits… (no session after 5 min) | ✔ |
| 13.14 | Start opens the planting sheet prefilled (name, length, plan when given) | core/schedule › prefill; ui/prefill (all) | calendar › at the scheduled time… (sheet prefilled) | ✔ |
| 13.15 | A session started from a plan links back; done when it blooms | core/schedule-controller › a session started from an occurrence links back…; › … ended; ui/calendar-model › a started occurrence is merged… | calendar › at the scheduled time… (data-occurrence-status done) | ✔ |
| 13.16 | Missed after length (30 when open) + 30 min, shown faintly, no guilt; "Not this time" | core/schedule › due, missed, done (all); core/schedule-controller › dismiss…; › …notices it pass into missed | calendar › not started within its window… | ✔ |
| 13.17 | Closed tab: no notification; on return due / missed are right | core/schedule-controller › an occurrence that came due while the app was closed…; core/schedule › dueOccurrences… (closed tab) | — | ✔ |
| 13.18 | Limit of three: the card says so gently and offers the sessions | — | calendar › with three sessions in progress the card says so gently… | ✔ |
| 13.19 | One quiet scheduling tip | core/tips › planning a session retires schedule | calendar › one quiet tip points at Schedule a session… | ✔ |
| 13.20 | Phone layout | — | calendar · phone › one column, nothing wider than the screen… | ✔ |
| 13.21 | Today's day view follows now while the tab stays open, gliding; a scroll by the gardener stops it until Today; it turns to the new day at midnight (ADR 0191) | ui/calendar-model › following now (all) | calendar · the day follows now › while the tab stays open…; › once the gardener scrolls the hours…; › past midnight… | ✔ |
| 13.24 | A daylight-saving day (23 or 25 h) is drawn as 24 wall-clock hours: it opens at the clock's hour, the now line and blocks sit where the clock reads, the skipped hour is an empty band, both passes of the repeated hour share one band side by side; following survives a redraw mid-glide and only the gardener's own scroll stops it (ADRs 0191, 0210) | ui/calendar-model › daylight-saving days on the wall-clock face (all: spring forward and fall back 2026, Europe/London) | calendar · a daylight-saving day (ADR 0210) › the day opens at the hour the clock reads…; › later in the day the now line stays on the clock's hour…; › following survives the hours being redrawn while they glide; › only the gardener's own scroll stops following… (pinned to 25 Oct 2026, Europe/London) | ✔ |
| 13.22 | The editor's day and time are painted pickers in the calendar's own formats (12 h in en-US, 24 h in en-GB), by keyboard and screen reader (ADR 0192) | ui/pickers (all: formats, time parts, grid keys, the day and time pickers in the page, Esc) | calendar · the editor speaks the calendar's clock › en-US, en-GB…; calendar › schedule a session… (pickDay, pickTime) | ✔ (studio `calendar/pickers`) |
| 13.23 | A phone's day keeps sessions side by side readable (short time, first letters) and grows a focused one; keyboard focus survives the minute's redraw | — | calendar · a phone's day with sessions side by side…; calendar · keyboard focus survives the minute's redraw… | ✔ |

### Beyond the SPEC (covered, listed for completeness)
Rendering contracts (render/renderer), paint engine (paint/*), species growth continuity
(plants/lib/*), sprite workers and LRU (plants/sprites), reflections (plants/reflection),
UI light under the garden's lighting (ui/ambient-light), canvas edges (polish › the canvas edges
dissolve into paper), keyboard flow (polish › keyboard…, ui-session › keyboard…), frame budgets
(plants, ambience, fauna e2e), richer pigments (paint/pigments › is richer than v1 but stays
watercolour…; › raised the chroma…), `sprout.plantsReady()` waits for a just-made store change, the
sprites and the fade-in (plants/system › ready() waits…; › ready() before the first init…;
daylight › plantsReady waits for plants added just before it…).

### Open gaps (for the orchestrator)
1. ~~Lotus is offered but cannot be planted~~: plantable since two water slots became large;
   proven through the real flow (`tests/e2e/lotus.spec.ts`), and a species with every spot held
   by growing seedlings is marked full in the sheet (ADR 0205).
2. **Cross-browser**: no Firefox/WebKit e2e run (10.2).
3. **Audio** has data and offline real-graph checks (8.1, 8.5); **real PiP** is faked (6.1). Both are headless
   limits.
4. ~~Automatic focus watering is silent~~: a soft pour plays on every watering since v2 polish (2.34, 8.1).
5. ~~Two seals during a long pause~~ (12.20, v2 acceptance L6): fixed. A seal-style control is a
   seal only while it holds `data-primary`, so the long pause's Resume steps back to an ink slip
   beside a due card's Start; the test passes for real.
6. ~~Keyboard focus on tools and sheet cards~~ (12.26, v2 acceptance L5): fixed. The dock's tools,
   plan cards and plant cards lift on `:focus-visible` as on hover (ADR 0204); the test passes for
   real.
7. ~~The day window is an hour off on a daylight-saving day~~: fixed (ADR 0210, devlog 33). The
   timeline is a 24-hour wall-clock face. The opening window, blocks, the now line and following
   all count local wall minutes. Proven across both 2026 changes (unit) and on 25 Oct 2026 in
   Europe/London (e2e), 13.24.
8. ~~Following stops when the hours are redrawn mid-glide~~: fixed (devlog 33). Scroll events
   from a detached or replaced timeline, or during our own glide, are ignored. Each timeline
   remembers where we put it. The follow-now specs no longer wait for the hours to rest before
   redrawing. `calendar · a daylight-saving day › following survives the hours being redrawn
   while they glide` redraws mid-glide on purpose, 13.24.
