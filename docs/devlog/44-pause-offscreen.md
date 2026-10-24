# 44 — P4: no garden frames while the stage is off-screen

The P0a profile ("[Medium] 5") found the garden drawing every frame with the stage scrolled fully
out of view: 1.05–1.7 ms of main thread and 1.4–1.9 ms of GPU per frame at 1×, 19–28 % of a core
at 4× throttle. The renderer's loop had no visibility gate.

**What changed** (ADR 0224):
- `render/renderer.ts`: `setVisible(bool)` and a `visible` getter. Hidden, the pending frame is
  cancelled and nothing is updated or drawn. Visible again, the loop continues from the last
  frame's timestamp, so the first frame back gets `dt = maxDt` (0.1 s). It does not get `dt = 0`,
  which systems read as a still frame that snaps fades. That frame also rebuilds any cache that went
  stale while hidden (a resize, a new painting). `renderOnce()`, `freeze()` and resize re-inits
  still draw while hidden. `pauseWhenOffscreen(target, margin = '160px 0px')` drives the switch
  from an IntersectionObserver and resumes just before the stage scrolls back in.
- `main.ts` (shared file, one line plus a comment): `renderer.pauseWhenOffscreen(#stage)`.
- `dev/debug.ts`: `sprout.stageVisible()`. `dev/camera-debug.ts`: `camera.settle()` draws one
  still frame when the stage is hidden, so the systems pick up the resting view. Without it, the
  light-detail wait would time out after 6 s.
- `tests/e2e/fixtures.ts`: `waitFrames` counts browser frames while the stage is off-screen, so
  specs that scroll the dock and wait a few frames (backdrops) do not hang. New `waitBrowserFrames`.
- No `document.hidden` gate: a background tab gets no `requestAnimationFrame` anyway.

**What keeps running while hidden, and why no update-only tick:** sessions, the title and favicon,
the widget, notifications and scheduled sessions run on the clock and the worker ticker. Audio
runs on bus events and the store. The dock sections have their own rAF and read the store. The
per-frame `update`s only advance canvas state: plant growth easing, watering, fades, fauna, the
camera glide. Two outputs leave the canvas:
- `fauna:arrived` should wait until the garden is in view (SPEC §4, "actually in view").
- The UI light reaches only things on the stage.

So the loop pauses completely. Everything catches up on the first frame back.

**Tests:** `render/renderer.test.ts` › off-screen stage (5 tests): no frames while hidden; resume
with a clamped dt; renderOnce and freeze while hidden; a resize while hidden is repainted on the
first frame back; the IntersectionObserver wiring. `tests/e2e/offscreen.spec.ts` (3 tests):
- At the dock bottom, 0 garden frames over 20 browser frames; back at the top, frames again.
- `freeze` and `camera.settle()` still draw while off-screen.
- At `speed=60`, a running session's title and elapsed time keep moving while scrolled away, with
  0 garden frames.

TESTING row 12.35. The full run passed: typecheck, 1400 unit tests, 233 e2e tests.

**Left open**
- Not re-measured with P0a's `frames.mjs` (scrolled-away window). The e2e proves 0 frames, so
  the per-frame cost there should be 0, but the GPU figure is unconfirmed.
- The light idle work (the next phase's sky `prepare`, cast `prepare`) is scheduled from
  `update`, so it also stops while hidden. That is fine for cost but untested for a phase change
  that happens entirely while scrolled away. It runs on the first frame back, where any long idle
  task belongs to A10.
- A garden that loads with the page already scrolled down (scroll restoration) fades its painting
  in only once the stage is visible. This is intended, but not covered by a test.
