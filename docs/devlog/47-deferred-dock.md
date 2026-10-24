# 47 — P5: the dock draws after the garden, and only near the window

## What
The runtime profile (P0a "[High] 2" and "[High] 4", task A4) found dock work below the fold running
before the garden's first pixels, and "Your plant" painting a sprite synchronously in the Begin
click. This task holds that work back until the garden has painted, and then until each part
nears the window (ADR 0225).

- **`src/ui/near-view.ts`** (new): `createNearView({ ready })`. `request(el, task, { idle })`
  runs a task one frame after `ready` at the earliest. It runs when `el` nears the window (an
  IntersectionObserver, `100% 0px`) or, if `idle`, on an idle moment. Requests coalesce per element,
  and a task never runs inside the request. Elements are observed only after the gate opens.
  `flush()` runs everything now.
- **`src/ui/backdrop.ts`, `src/ui/dock.ts`**: `createBackdrop(host, { near })` and
  `createDock({ near })`. A sheet's drawing goes through the gate. The first drawing fades in
  (`ui.css`).
- **`src/ui/wayfinding.ts`**: `createWayfinding({ near })`. The layout goes through the gate, and
  the `document.fonts.ready` relayout is subscribed after it opens. Reading `fonts.ready` cost a
  13 ms style pass in the middle of boot.
- **`src/ui/plant-section.ts`**:
  - `render()` updates the caption and state at once and only requests the painting. A new look
    (mode, plant, seed, wilt) or a first painting may run on idle; growth alone waits to be near.
  - The painting uses `drawPlantView`, so sprites paint in the view's worker and the last painting
    stays until they land. `renderPlantView` is the fallback if the worker cannot paint.
  - Watering and wilt frames paint only while the section is near.
  - New: `settle()`, `data-paints` and `data-painted`. The plant frame fades in on its first
    painting.
- **`src/ui/index.ts`**: one gate, created from `whenGardenReady` (also reused for the preview
  prewarm), passed to the dock, the path and "Your plant". New `ui.dockReady()`.
- **`src/ui/types.ts`**: `UI.dockReady()`. **`src/dev/ui-debug.ts`**: `sprout.ui.dockReady()`
  calls it, so specs reading the dock after it still get a fully drawn dock.
- `src/main.ts` is unchanged (`whenGardenReady` was wired by P2).

## Timing (1×, p25 garden, 1440×900 at DPR 2, Chromium new headless, `nice -n 15`, shared laptop)
Scratch scripts `scratchpad/perf` (`load.mjs --plants`, `flow.mjs`), before and after served in
turn on :4325, back to back.

| | before | after |
|---|---|---|
| main thread busy before the first scene pixels (median of 3) | 1 689 ms | 1 551 ms |
| first scene pixels (`scenePainted`) | 1 709 ms | 1 569 ms |
| FCP | 889 ms | 729 ms |
| script in plant-section / backdrop / wayfinding before the scene (profile) | ~145 ms (plant 142) | ~1 ms |
| Begin click: Event Timing duration / processing | 160–168 / 133–144 ms | 48–64 / 30–32 ms |
| Begin click → camera glide starts | 141–151 ms | 37–39 ms |

The `dockReady` mark in the harness moves from 0.89 s to 1.87 s. `sprout.ui.dockReady()` now
waits for the garden and draws the dock, so the mark shows when the dock is drawn.

## Tests
- `src/ui/near-view.test.ts` (7, jsdom, hand-driven frames, idle periods and observer reports):
  nothing runs before the garden has painted, and nothing is observed then; near tasks run first,
  far ones on idle; nothing runs inside a request; a growth-only repaint waits for near; `idle`
  is kept across coalesced requests; idle periods respect their deadline; `flush`; the
  hidden-tab timer.
- `tests/e2e/deferred-dock.spec.ts` (3):
  - An init script samples every frame from the first script on. No sheet, path or plant
    painting exists in any frame before the garden is painted. Against the old build this test
    fails.
  - Scrolled to the bottom, every sheet, the path and the plant are drawn, and no section box
    moved.
  - Begin's click processing is < 100 ms (Event Timing), and once scrolled to, "Your plant" shows
    the new seedling (`data-painted`).
- `tests/e2e/ui-shell.spec.ts` › "Your plant"…: awaits `dockReady` before reading the canvas's
  pixels.
- The backdrops, wayfinding, ui-shell, parallel-sessions, v2-acceptance and offscreen specs pass
  unchanged otherwise (60 tests).
- Matrix rows P5.1–P5.3 in docs/TESTING.md.

## Left open
- The rest of the pre-scene UI work, outside this task's paths: `installPaper` / `grainDataUrl`
  (~6 ms), the stage edge mask (~10 ms), the calendar's first render, and the page paper's idle
  callback (~19 ms, which can land before the scene).
- The session list's "Growing now" thumbnails (Study section) still paint through
  `renderPlantView`. They are usually on screen when they change, so they were left alone.
- Not re-measured at 4× CPU throttle.
