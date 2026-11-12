# 158: Close-view buffers freed at the overview (Z15)

## What
Back at the overview after a close view, the buffers the close view used are freed at once
instead of staying allocated until the garbage collector runs (or for good):
- **Renderer, resting-view background cache** (`src/render/renderer.ts`): one screen-sized canvas
  (2824×1692 at DPR 2, 19 MB) was kept forever once a close view had rested. It is now freed
  (width 0, dropped from the caches) on the first frame drawn at the overview, and built again on
  the next rest, which repainted it anyway (a new view). This was the only true leak.
- **Scene detail painting** (`src/scene/system.ts`): dropped at the overview as before, but its
  canvas and sprite canvases are now set to width 0. A fresh painting is put in the paint cache
  without a copy, so it is freed only once its put has settled (encoded and written); a cached
  one is a copy and is freed at once. A detail replaced by another, a finished detail whose job
  was cancelled, and the detail on a switch or `dispose` are freed the same way. The sprite atlas
  made for the store is freed once encoded. `store()` now returns its puts' promise.
- **Sky detail composite** (`src/scene/sky-light.ts`): freed when `setDetail(null)` drops it.
- **Wet-layer work canvases** (`src/paint/canvas.ts`, the pool `wet.ts` borrows from): once no
  layer was released for `WORK_QUIET_MS` (4 s), the up-to-4 pooled canvases shrink to 1×1
  (`trimWork`). One timer per quiet period, not per layer. `acquireWork` sets the size (and so
  clears) on every borrow, so drying output and the recording pins are unchanged; devlog 156's
  cropped drying is untouched.

A repeat rest takes the detail painting from the paint cache (this already worked); the e2e checks
that the close-view frame is the same pixels as the first painted one.

`src/render/renderer.ts` is outside the paths this task listed. The 19 MB the audit counted was mostly
there, so I made the smallest change: a `releaseViewCache` helper, one call, and a
`frameStats().cachePixels` readout. `src/main.ts` is not touched.

## Numbers
Production build, headless Chromium, 1440×900 at DPR 2, the Japanese garden, a rest at zoom 3 on
(300, 300), then `overview({ animate: false })`. Every canvas made on the main thread is tracked
(`OffscreenCanvas` and `createElement('canvas')` wrapped in an init script, `WeakRef`s), and the sum
of `width × height × 4` of the live ones is read. Worker canvases (plant sprites) are not counted.

| canvas backing at the overview | before | after |
|---|---|---|
| before any close view | 116–119 MB | 116–119 MB |
| after a close view, no GC forced (what the page holds) | 174–178 MB (+55–59) | 128 MB (+9) |
| after a close view, after a forced GC (`--expose-gc`) | 136.5 MB (+23.5) | 118.2 MB (+5) |

What is left after the change: the light plate's detail plates (two 1188×760, 7 MB, in
`src/ambience/cast.ts`, outside this task's paths) until the GC, and the next phase's sky and light
plates, which the time of day asks for anyway.

Re-entering the close view (glide without animation to `camera.settle()`, a paint-cache hit):
1.3–1.8 s before, 0.95–1.7 s after (three runs each; noisy, the machine was shared with another
agent). The time is the cache read and decode plus the sky's and light's detail, as before. The
renderer's view cache costs one canvas allocation on the rest, which repainted it anyway.

## Tests
- `src/paint/work-pool.test.ts`: the pool shrinks after a whole quiet period with no release, a
  release just before the period ends postpones it, and a trimmed canvas is sized again on borrow.
- `src/scene/scene-cache.test.ts` › close-view buffers: the detail is dropped at the overview but
  freed only once the store settles, then taken from the cache on the next rest (same view and size).
  A cached detail is freed at once, and `dispose` frees it too. The test cache double now stores a
  copy, like the real store's encoded image.
- `src/render/renderer.test.ts`: the resting-view cache is freed at the overview (its canvas 0×0,
  `cachePixels` back to the overview's) and built again on the next rest.
- `tests/e2e/scene-cache.spec.ts` › close-view buffers freed at the overview: `sceneDetail().pixels`
  is 0 and `freed` is 1 at the overview, `frameStats().cachePixels` is back to the overview's, and
  the next rest is a cache hit whose frame hash equals the first painted one.

Run with one worker each (`VITEST_WORKERS=1`, `E2E_WORKERS=1`, `E2E_PORT=4192`, `nice -n 19`):
the unit files above plus `paint/parts`, `paint/wet`, `paint/dry-crop`, `paint/primitives`,
`scene/system`, `scene/sky-light`, `scene/paint-record` and `scene/paint-slices` (105 tests, the
recording pins unmoved); `scene-cache.spec.ts` and `close-view.spec.ts`. With a load average of 70–80
from other agents, the waterfall and oasis repeat-visit tests ran past the 60 s timeout. They passed
alone with `--timeout` raised (57 s and 2.1 min, 0 differing pixels).

## Paint version
`src/paint/canvas.ts` changed, so the paint version changes: cached paintings repaint once to the
same pixels.

## What's left
- The light plate's detail plates (`cast.ts`, 7 MB at DPR 2) could be freed the same way when
  `setDetail(null)` drops them. That is in the ambience paths.
- The paint cache keeps an un-copied detail canvas until it encodes it in idle time. On a slow
  machine the detail stays allocated that long.

## Index rows
`| 158 | [Z15: Close-view buffers freed at the overview](158-close-view-buffers.md) | back at the overview the resting-view background cache, the detail painting (once stored), its sprite atlas and the sky detail are freed at once, and the wet-layer work pool shrinks after 4 s quiet; DPR 2 overview after a close view 174–178 → 128 MB without GC (136.5 → 118.2 MB after GC); re-entry from the cache unchanged (~1–1.7 s) |`

`| Z15.1 | Back at the overview the close view's detail painting is freed once stored and the resting-view background cache at once; the next rest takes the same detail from the cache; the work-canvas pool shrinks after a quiet period | `src/scene/scene-cache.test.ts` › close-view buffers; `src/render/renderer.test.ts` › frees the resting close view's background cache; `src/paint/work-pool.test.ts` | `scene-cache.spec.ts` › close-view buffers freed at the overview |`
