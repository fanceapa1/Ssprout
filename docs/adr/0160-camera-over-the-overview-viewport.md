# ADR 0160 — A camera over the overview viewport

- Status: accepted (amends ADRs 0123, 0130)
- Date: 2026-10-23

## Context
ADR 0005 asks for a camera: focus zoom on start and on click, gentle free zoom and pan, a "Whole
garden" control. Everything already draws through one `Viewport` (cover scaling over the
1600×1000 world, ADR 0123): the renderer's layer transforms, the DOM overlays (markers, labels),
pointer conversions. Systems size their caches from `viewport.pixelScale` in `init`, which runs
only on resize.

## Decision
- **The cover viewport is the overview** (zoom 1). The camera is a pose on top of it — `zoom ≥ 1`
  and the world point at the stage's centre — and `composeView(base, pose)` returns an ordinary
  `Viewport` (`src/render/camera.ts`). At the overview pose it *is* the base viewport.
- **The renderer owns the camera** (`renderer.camera`). `renderer.viewport` is the camera's view
  (so the UI's markers, labels and pointer mapping follow it unchanged); `renderer.baseViewport`
  is the overview. Every world layer is drawn through the view; `FrameInfo.view` says which view a
  draw is for. **The paper layer stays screen-fixed** (the washi grain is the sheet you look
  through; magnifying it would coarsen it).
- **`SystemContext.viewport` stays the overview** (camera moves never re-init systems);
  `SystemContext.camera` is a live `CameraView`: `view()`, `detailView()` (the glide's
  destination, else the view once it rests), `detailVersion`, `moving()`, `isOverview()`. Systems
  that keep caches poll `detailVersion` in `update`.
- **Limits.** `MAX_ZOOM = 3` (a tier-1 plant fills a good part of the stage; 2.5 left near ones
  small on wide screens). The view stays inside `reachRect(base, zoom)`: the overview's visible
  rect at zoom 1 (so zoom 1 is one view: "the overview"), widening to that rect ∪ the world by
  zoom 1.25 — a phone's overview crops the garden's sides and a wide stage its top and bottom, and
  a closer look may go there. On tall phones the rect includes the paper rows beyond the world
  (the light layer keeps them lit). A card on the stage adds `slack` on its side (ADR 0167).
- Time is the frame's `dt` (animation seconds), not the app clock: a `?speed=60` dev clock does
  not make glides 60× faster.

## Consequences
Old tests that construct `SystemContext` or `FrameInfo` without the camera still type-check
(both fields optional). Systems that culled by `ctx.viewport.visible` must use the camera's view
(the plant system does). Fauna and ambience draw in world units and follow the camera for free.
