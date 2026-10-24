# ADR 0224 — No frames while the garden stage is off-screen

- Status: accepted
- Date: 2026-10-24

## Context
The phase 9 runtime profile (P0a, "[Medium] 5") found the garden drawing every frame while the
gardener reads the dock with the stage scrolled fully out of view: 1.05–1.7 ms of main thread and
1.4–1.9 ms of GPU per frame at 1×, 3.1–4.6 ms of main thread at 4× CPU throttle (19–28 % of a
core). `renderer.ts`'s loop had no visibility gate. A background tab already gets no
`requestAnimationFrame`, so only the scrolled-away case cost anything.

## Decision
- **A renderer visibility switch.** `renderer.setVisible(false)` cancels the pending frame and keeps
  the loop paused; no system is updated or drawn. `setVisible(true)` reschedules it. `visible` reads
  it; the dev API exposes it as `sprout.stageVisible()`.
- **Driven by an IntersectionObserver on `#stage`.** `renderer.pauseWhenOffscreen(target, margin)`
  observes the stage with a `160px 0px` root margin, so the loop starts again a little before the
  stage scrolls back in and the first visible frame is fresh, not the last frame from before. It is
  one line in `main.ts`. No separate `document.hidden` gate: rAF already stops in a hidden tab.
- **Resume continues, it does not restart.** The first frame back takes `dt` from the last drawn
  frame, clamped to `maxDt` (0.1 s), like any long gap. It does not start at `dt = 0`, because
  systems read `dt = 0` as a still frame and snap their fades and growth. Caches made dirty while
  hidden (a resize re-init, a new painting) are rebuilt by that frame, as on any frame.
- **Explicit frames still draw while hidden.** `renderOnce()`, `freeze()` and the resize re-init's
  repaint for a frozen or stopped renderer are unchanged. `unfreeze()` and `start()` while hidden
  wait for `setVisible(true)`. The dev `camera.settle()` draws one still frame when the stage is
  hidden, so the systems see the resting view (scene, plants and light detail). Without it, the
  light-detail wait would time out after 6 s.
- **Fully paused, no update-only tick.** What the per-frame `update`s advance was checked for
  anything seen outside the canvas:
  - *Sessions, the title and favicon, the widget, notifications, scheduled sessions*: the clock
    and the worker ticker (`widget/`, `core/schedule-controller.ts`). They never read the renderer.
  - *Audio*: bus events and the store, never the frame loop.
  - *The dock* ("Your plant", calendar, backdrops, wayfinding): their own `requestAnimationFrame`
    and the store.
  - *Plant growth, watering, wither*: canvas-only state. `plants.ready()` syncs with the store
    itself. The first frame back eases the shown growth to its target.
  - *`fauna:arrived`*: the only bus event a canvas system emits. SPEC §4 says it announces a
    creature "the first time it is actually in view". With the garden scrolled away nothing is in
    view, so waiting until the stage is back is more right than announcing it unseen.
  - *The UI light* (`--ui-dab`/`--ui-dim`, ADR 0121) reaches only things on the stage (corner
    slips, zoom buttons, the plant card, the due slip), which are off-screen with it. The first
    frame back brings it up to date.
  - *The camera*: a glide started while hidden plays when the stage comes back, where it can be
    seen.

  An update-only tick would buy nothing visible and would announce fauna to nobody, so there is none.

## Consequences
- Scrolled to the dock, the garden costs nothing per frame (the e2e counts 0 frames over 20
  browser frames). Coming back costs one normal frame, plus any cache rebuild that was pending anyway.
- `waitFrames(page, n)` in the e2e fixtures counts browser frames when the stage is off-screen, so
  specs that scroll the dock and wait a few frames do not hang. `waitBrowserFrames` always counts
  browser frames.
- A future system whose state matters outside the canvas must not advance it in `update`. It runs
  on the clock, the ticker or the store instead (ARCHITECTURE › Rendering pipeline).
