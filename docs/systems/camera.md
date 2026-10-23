# Camera

`src/render/camera.ts` (maths and controller), `src/ui/stage-camera.ts` (gestures, controls,
focus), `src/ui/plant-card.ts` (the plant card), `src/plants/hit-test.ts`, `src/plants/notes.ts`,
`src/dev/camera-debug.ts`. ADRs 0160–0168; SPEC §12a.

## Model
- The renderer's cover viewport (`createViewport`) is the **overview**, zoom 1.
- A **pose** is `{ zoom ≥ 1, x, y }`: the world point at the stage's centre.
  `composeView(base, pose)` returns an ordinary `Viewport` (scale × zoom, the pose at the stage's
  centre); at the overview pose it is `base` itself.
- **Limits**: `MAX_ZOOM` = 3. `clampPose` keeps the view inside `reachRect(base, zoom)`: the
  overview's visible rect at zoom 1, widening to that rect ∪ the world by `FULL_REACH_ZOOM` (1.25)
  — a phone can look at the garden's sides its overview crops, a wide stage at the sky's top. On
  tall phones the rect includes the lit paper rows above and below the world. `slack` (CSS px per
  side) lets the view go past the edge under a card (`camera.setInset`).
- `zoomAbout(base, pose, zoom, screenPt)` keeps the world point under the pointer still;
  `panBy(base, pose, dx, dy)` moves the painting with the hand; `framePose(base, rect, opts)`
  frames a plant box: about 46 % of the frame's height (0.9 × of its width at most), zoom
  1.6–3, its centre at 42 % / 58 % across (the side of the garden it stands on) and 54 % down,
  in the stage minus `inset`.

## Glides (`createCamera`)
- `glideTo`, `focusRect`, `overview`, `zoomTo`: van Wijk & Nuij's path (`glidePath`, ρ 1.35)
  timed by `glideSeconds(length)` (0.75–1.9 s) and eased with `easeGlide` (half a cosine). Poses
  are clamped every frame.
- `zoomBy(factor, about)`: gesture follow — the target zoom accumulates, the pose approaches it
  with τ = 75 ms; `{ instant: true }` (touch pinch) applies it at once. `panBy` is immediate.
- Input interrupts (`interrupt()`); `settle()` finishes a glide or follow now.
- Reduced motion: every glide and follow is a cut.
- `update(dt)` is called by the renderer at the top of every frame with the frame's `dt`.
- `moving()`: a glide or follow, or less than `REST_S` (0.25 s) since the pose last changed.
  `detailView()` is the glide's destination (or the follow's target), else the view once it
  rests; `detailVersion` bumps whenever it changes. Caches key off it (below).
- `onChange(fn)` after every pose change and when a move starts or rests.

## Renderer integration (ADRs 0160, 0161)
- `renderer.camera`; `renderer.viewport` = the camera's view; `renderer.baseViewport` = overview.
- `SystemContext.viewport` stays the overview (init is not re-run on camera moves);
  `SystemContext.camera` is the live `CameraView` (`view`, `detailView`, `detailVersion`,
  `moving`, `isOverview`). `FrameInfo.view` is the view a draw is for.
- World layers are drawn through the view; the **paper is screen-fixed**.
- Background: overview cache (blitted as a sub-rect while moving), resting-view cache (built when
  the camera rests), direct draw while moving outside the overview's crop.

## Detail for a close view (ADRs 0163, 0165)
Systems poll `camera.detailVersion` in `update` and, **once the camera rests**:
| System | What | Cap |
|---|---|---|
| Scene | repaints the view's rect (+40 units) cooperatively, cross-fades it in; detail boulders/tufts; extends the overview painting to the whole world the first time a view leaves it | 2.8 px/unit (`maxDetailScale`) |
| Sky (`SkyLight.setDetail`) | upscaled plates under the view + sun, moon, stars punched sharp | 3 px/unit |
| Light plate (`CastLight.setDetail`) | grade wash upscaled, marks (shadows, crown lights, window light, stars) repainted, one phase per idle callback | 2 px/unit |
| Plants | plants in the view (+12 %) at `resolutionBucket(detailView.pixelScale)` (requested at the glide's start), others at the overview's; far-off high-res sprites evicted at rest | 6 px/unit, 2048 px per side |
A layer uses its detail only when it covers the whole visible world rect of the draw, so a seam is
never on screen. Back at the overview the scene's detail painting and the detail plates go.

## When the camera moves by itself (ADR 0168)
`session:start` → frame the seedling; `session:switch` → frame the new active seedling; entering
placement → the whole garden. Completion and cancel leave it where it is. Nothing else re-zooms.

## Gestures and controls (ADR 0164)
Plain wheel scrolls the page; ctrl/⌘ + wheel or trackpad pinch zoom about the pointer
(`ui.stage.onZoomGesture`); double-click / double-tap ×2 (at 3×: the whole garden); drag pans only
when zoomed; two-finger touch pinch; `touch-action: pan-x pan-y` at the overview, `none` zoomed.
+ / − chips and "Whole garden" (only when zoomed) at the stage's bottom right (above the pill on
narrow stages); + / = / − / _ / 0 / arrows / Enter on the focused canvas. Cursor: a hand over
plants, `grab` when zoomed.

## Plant card (ADRs 0166, 0167)
A click/tap hit-tests painted pixels (front-most wins). The card (`.plant-story`, a dialog named
after the plant) shows species, Japanese name, the poetic line, `SPECIES_NOTES[id]`, and the
plant's story (`plantStory()` / `storyLines()`, pure). Wide stages: on the side away from the
plant, the camera frames the plant beside it (inset + slack); phones (< 640 px): docked at the
bottom, the pill and zoom chips step back. Esc, the close mark, bare garden, or anywhere else on
the page close it; focus returns to the garden. The camera stays. The hover label stays for
desktop and shares the hit-test; taps open the card.

## Dev API (`?dev`, `window.sprout.camera`)
`state()` (pose, target, moving, gliding, overview, reason, detail, view, autoFocus,
touchAction, cursor), `focusSlot(id)`, `focusPlant(id)`, `zoomTo(z, about?)`, `glideTo(pose)`,
`overview()` (all take `{ animate: false }` to cut), `settle()` (finish, then wait for the scene
detail, the sprites and the light plate's detail), `autoFocus(on)`, `toClient(world)`,
`openCard(id)`, `closeCard()`. Also `sceneDetail()`, `lightDetail()`, `skyStats().detail`,
`plants.hitTest(world, tol)`, `ui.state().plantCard`.

## Studio
`camera/playground` (map + stage through the camera, gliding between poses), `camera-detail/moon`
and `camera-detail/shadows` (overview plate vs detail), `ui-camera/*` (zoom chips, the card beside a
plant and docked, a seedling's card; the seed picks the species, so every note can be read).

## Tests
`camera.test.ts` (compose, clamp, reach, slack, zoom about a point, pan, framing, path, easing,
durations, controller), `renderer.test.ts` (camera views, caches), `hit-test.test.ts`,
`notes.test.ts`, `sprites.test.ts` / `system.test.ts` (resolution, eviction, culling, hit-test),
`tests/e2e/camera.spec.ts` (focus on start and switch, ctrl+wheel about the pointer, plain wheel,
drag only zoomed, pinch, double-click, controls, keys, the card, placement while zoomed, detail
painted, glide frame cost, reduced motion, the docked card).
