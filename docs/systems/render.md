# Render system

`src/render/` — one visible `<canvas id="garden">`, a fixed 1600×1000 world, eight layers.

## Viewport (`viewport.ts`)
- `WORLD_W = 1600`, `WORLD_H = 1000`. All geometry is in world units.
- `createViewport(cssW, cssH, dpr, focus = DEFAULT_FOCUS)` uses **cover** scaling:
  `scale = max(cssW / 1600, cssH / 1000)` (CSS px per world unit). The overflowing axis is
  cropped around `focus` (pond centre, `{x: 800, y: 560}`), clamped so nothing outside the world
  is ever shown. Portrait phones therefore crop the sides; wide screens crop top/bottom.
- Exception (ADR 0123): a tall portrait screen always shows at least `MIN_VISIBLE_W = 600` world
  units of width (`scale ≤ cssW / 600`), so phones see the banks; the painting then sits mid-screen
  with bare paper above and below.
- DPR is clamped to `[1, MAX_DPR]` (`MAX_DPR = 2`). `pixelW/pixelH` is the backing-store size, `pixelScale` the device
  pixels per world unit (use it to size sprite caches).
- `worldToScreen` / `screenToWorld` convert between world units and CSS px relative to the
  canvas (use for DOM overlays such as slot markers and for pointer input).
- `visible` is the visible world rectangle `{ x, y, w, h }` (on tall phones it extends past the
  world's top/bottom). `applyTo(ctx)` sets a world-unit transform.

## Camera (`camera.ts`, ADRs 0160–0162; docs/systems/camera.md)
- The cover viewport above is the **overview** (zoom 1). `renderer.camera` holds a pose (zoom
  1–3, the world point at the stage's centre); `composeView(base, pose)` is the view.
  `renderer.viewport` is the camera's view (DOM overlays and pointer mapping follow it);
  `renderer.baseViewport` is the overview.
- `camera.update(dt)` runs at the top of each frame (glides, gesture follow); `FrameInfo.view` is
  the view a draw is for. `SystemContext.viewport` stays the overview; `SystemContext.camera`
  (`view`, `detailView`, `detailVersion`, `moving`, `isOverview`) is live.
- World layers are drawn through the view; the paper stays screen-fixed.
- Background caches (ADR 0161): the overview cache (blitted as a sub-rect while the camera moves),
  a resting-view cache (built once when it rests; reused until invalidated), and a direct draw
  while moving outside the overview's crop.

## Layers
Back → front: `background`, `underwater`, `waterSurface`, `entities`, `air`, `ambience`,
`lighting`, `paper` (`LAYERS` in `types.ts`).

- `background` and `paper` are **cached**: painted into offscreen canvases on init/resize (and
  after `renderer.invalidate(layer)`), then blitted each frame. `paper` is composited with
  `globalCompositeOperation = 'multiply'`.
- Every other layer is redrawn every frame by calling each system's `draw(layer, ctx, f)` in
  registration order. `ctx` is already in world units and wrapped in `save()/restore()`.
- `entities`: systems' direct `draw('entities')` calls first, then all `Drawable`s returned by
  `entities(f)` from every system, **stable-sorted by `depth`** (base y), each drawn inside its
  own `save()/restore()`.
- Clipping (e.g. `underwater` to the pond) is the system's own job.

## Frame loop (`renderer.ts`)
- `requestAnimationFrame`; `FrameInfo = { t, dt, now }`: `t` is animation seconds (does not
  advance while frozen), `dt` is clamped to `maxDt` (0.1 s) so a background tab doesn't jump,
  `now` comes from the injected `Clock` (accelerated in `?dev&speed=N`).
- Each frame: `update(f)` for every ready system, then compositing.
- A system is only called (update/draw/entities) after its `init` has resolved. `init` runs on
  `add()` (if sized) and again on every resize (debounced 200 ms, window `resize` +
  `ResizeObserver`); systems keep drawing with their old caches until re-init completes.
- The renderer measures the **canvas's own box**, not the window. In the app the canvas fills the
  garden stage (`#stage`, ~88 % of the window under a small margin, ADR 0130), so the viewport
  is the stage; scrolling the page moves the canvas element and never re-inits or repaints.
- A system that throws is isolated: the error is logged once per system+phase
  (`onSystemError` to override) and the rest of the frame continues.
- `freeze()` stops the loop and draws one frame with `dt = 0`; `unfreeze()` resumes;
  `renderOnce()` draws a frame now. `whenReady()` resolves after all inits for the current size.

## Renderer API (`createRenderer({ canvas, store, bus, clock, scene, reducedMotion?, … })`)
- `viewport` (the camera's view), `baseViewport` (the overview), `camera`, `frozen`, `running` (getters).
- `add(system)` → Promise (rejects if a system with that `id` is already registered);
  `remove(id)` (disposes it); `systems()`.
- `start()` / `stop()` (rAF loop plus resize listeners), `freeze()` / `unfreeze()`, `renderOnce()`,
  `resize()` (re-measure and re-init now), `invalidate(layer?)`, `whenReady()`, `dispose()`.
- `frameStats()` → `{ frames, workAvg, workP95, workMax, intervalAvg, intervalP95 }` in ms over
  the last 600 frames (main-thread update + composite cost, and frame intervals);
  `resetFrameStats()`.

`SystemContext` (passed to `init`): `{ viewport /* overview */, camera /* live CameraView */, store, bus, clock, scene, reducedMotion }`.

## Adding a system
```ts
import type { System } from '../render/types';

export function createKoiSystem(): System {
  let scene!: SceneGeometry;
  return {
    id: 'koi',
    init(ctx) { scene = ctx.scene; /* prerender caches at ctx.viewport.pixelScale */ },
    update(f) { /* advance simulation by f.dt; use Rng, never Math.random */ },
    draw(layer, ctx, f) { if (layer === 'underwater') { /* world-unit drawing */ } },
    entities(f) { return [{ depth: 640, draw: (ctx) => { /* ... */ } }]; },
    dispose() {},
  };
}
// main.ts
void renderer.add(createKoiSystem());
```
Rules: never touch the DOM from a system; time via `f.now`/`f.t`; randomness via `Rng`; add a
`*.studio.ts` entry for anything you paint; document the system in `docs/systems/<name>.md`.

## Testing
`renderer.test.ts` drives the renderer with fake canvases and an injected frame scheduler
(`measure`, `createCanvas`, `requestFrame`, `cancelFrame` options) to cover layer order,
caching, depth sort, async init, resize re-init, dt clamping, freeze and error isolation.
`viewport.test.ts` covers cover scaling, focus clamping, `MIN_VISIBLE_W`, DPR cap and conversions.
`camera.test.ts` covers composing, clamping and reach, zoom about a point, pan, framing, the glide
path, easing and durations, and the controller; `renderer.test.ts` the camera's caches.
Visuals are checked with `npm run shots` and the studio.
