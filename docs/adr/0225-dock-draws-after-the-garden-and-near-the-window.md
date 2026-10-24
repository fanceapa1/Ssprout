# ADR 0225 — The dock draws after the garden, and only near the window

- Status: accepted
- Date: 2026-10-24

## Context
The phase 9 runtime profile (P0a, "[High] 2" and "[High] 4") found dock work running before the
garden's first pixels and inside clicks, all of it for parts of the page below the fold:
- "Your plant" painted its plant at load (113–142 ms at 1×, a main-thread `paintSprite` through
  `renderPlantView`'s synchronous lower step), with its round window (16 ms).
- The dock's sheets and the guiding path laid out in the first frame. ADR 0223 made the sheets
  cheap (about 2 ms of script), but the layout reads still came before the garden.
- "Begin" refreshed the UI in the click, and "Your plant" painted the new seedling's sprite
  synchronously: 160–190 ms of the click, for a section that is off-screen while the camera glides.

The owner wants the garden drawn first, and only what is visible drawn.

## Decision
- **A gate, `createNearView({ ready })`** (`src/ui/near-view.ts`). `request(el, task, { idle })`
  runs a task when it is due. No task runs before `ready` (main passes `renderer.whenReady()`
  through `whenGardenReady`, which resolves once the scene's first painting is done) and one frame
  after it, so the frame that shows the painting goes out first. A 500 ms timer stands in for that
  frame in a hidden tab. After that, a task runs:
  - when its element nears the window: an IntersectionObserver with a `100% 0px` root margin, so
    one window height above or below counts as near;
  - or, if it allows `idle` (the default), on an idle moment (`requestIdleCallback`, 2 s timeout).
    An idle period runs at least one task, and more only while it has 6 ms left.
  Requests for one element coalesce: the latest task wins, and `idle` stays on if any request
  asked for it. A task never runs inside `request`, so a click only marks work. Elements are
  observed only once the gate opens, because observing a connected element (like reading
  `document.fonts.ready`) can force a style pass in the middle of boot. `flush()` runs every
  waiting task at once.
- **The sheets** (`createBackdrop(host, { near })`, through `createDock({ near })`) request their
  drawing from the gate instead of the next frame. They stay invisible until drawn, as before, and
  the first drawing fades in over `--ui-mid`. Because a sheet is absolute and behind its section, a
  late drawing moves nothing.
- **The guiding path** (`createWayfinding({ near })`) requests its layout on the dock element. Its
  `document.fonts.ready` relayout is subscribed after the gate opens.
- **"Your plant"** (`createPlantSection(ctx, { near })`):
  - `render()` (a tick, a refresh, Begin) re-reads the session and its caption at once, but only
    requests the painting.
  - A new look (mode, plant, seed, a wilt), a first painting or a resize may paint on an idle
    moment. Growth alone waits until the section is near the window.
  - The watering and the wilt animate only while the section is near the window.
  - The painting uses `drawPlantView` (ADR 0221): a sprite that is not cached is painted in the
    view's worker, and until it lands the last painting stays. If the worker cannot paint it, the
    section falls back to `renderPlantView` on the main thread. The frame is transparent until the
    first painting, then fades in, and its square size is fixed by CSS.
  - `.plant-view[data-paints]` counts paintings, and `[data-painted]` names what the painting shows.
- **Readiness**: `ui.dockReady()` waits for the gate and the fonts, flushes, waits a frame (so
  resize observers report), flushes again, and settles "Your plant" (paints, awaits its worker
  sprites). `sprout.ui.dockReady()` calls it, so specs that awaited it keep reading a fully drawn
  dock. `sprout.ui.wayfinding()` still lays the path out synchronously.

## Consequences
- Before the scene's first pixels, no dock part draws. The p25 load, 1×, interleaved runs on a
  shared laptop: main-thread busy before the first scene pixels went from 1 689 to 1 551 ms
  (median of 3), scene pixels arrived at 1 569 ms instead of 1 709, and FCP at 729 ms instead of
  889. Script in plant-section, backdrop and wayfinding before the scene went from about 145 ms to
  about 1 ms.
- The Begin click went from 160–168 ms duration (133–144 ms processing) to 48–64 ms (30–32 ms
  processing). The camera's glide starts 37–39 ms after the click instead of 141–151.
- A section scrolled to faster than one window height per idle period can show its sheet or
  plant fading in. With the idle fallback this has not been seen at normal scrolling speed.
- `sprout.ui.dockReady()` now forces the dock's drawing, so the perf harness's `dockReady` mark
  comes after the scene (about 1.87 s instead of 0.89 s). It measures when the dock is drawn, not
  when the script started.
- A new part below the fold takes the gate as an option, as the dock, the path and "Your plant"
  do, and draws through `request`.
