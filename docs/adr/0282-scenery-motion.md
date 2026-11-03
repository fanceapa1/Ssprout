# ADR 0282: A scenery's moving water is an optional motion over its painting

- Status: accepted
- Date: 2026-11-03
- Builds on: ADRs 0021 (paint on white, paper last), 0226 and 0238 (painting in parts), 0241
  (the scenery contract), 0245 (the waterfall)

## Context
The waterfall's painting is still: streaks, white paper, the lip and the foam are painted once,
cached and drawn as a bitmap (S7). A waterfall that never moves reads as a picture of one. The
scenery contract left a per-frame water animator out until S9 set its shape (docs/systems/scenery.md
› The contract). The first attempt drew a full-sheet cover over the painting's streaks each frame
and blitted large mist sprites. That looked flat and white, doubled the lip, and cost about 40 ms a
frame in software raster in the close view, against a baseline of about 15 ms.

## Decision
- `Scenery.motion?: () => SceneryMotion`, with `SceneryMotion = { prepare(): Generator; draw(ctx, t) }`
  (`scenery/types.ts`). `prepare` paints the sprites in parts, and the scene system runs them
  between frames with the same 12 ms budget as a painting. `draw` blits them at animation time `t`,
  in world units, as a pure function of `t`.
- The scene system creates the motion in `init` unless reduced motion is on, and draws it on
  `waterSurface` after the water, under the light plate, once its sprites are ready. The first
  paint's `ready()` and `whenPainted()` wait for it. A scenery switch drops it. Without `motion`,
  nothing changes.
- The motion goes **over** the still painting and never covers it. The painting stays the
  structure, and the motion adds pale surges, lifted lights and threads falling down it, a
  churning foam and a faint mist. Under reduced motion the motion is not created, so the painting
  is exactly what it was.
- Sprites are sealed into `ImageBitmap`s (`transferToImageBitmap`). The painter reads canvases
  back, and a canvas source like that would be uploaded on every blit.
- The motion skips its draw when the context's transform shows the view misses `MOTION_BOUNDS`.

## Consequences
- One optional field on the scenery contract and about 30 lines in `scene/system.ts`
  (docs/ARCHITECTURE.md › Scenery). The Japanese garden is unchanged.
- Cost at 1440 × 900, DPR 2, in the close view: about 0.05 ms of main-thread time per frame on the
  GPU path. It still holds 60 fps at 96 draws per frame. With software raster (SwiftShader) it
  adds about 14 ms a frame. Devlog 93 has the bench numbers.
- `scenery/waterfall/index.ts` imports `falls.ts`, so the computed paint version changes once and
  cached paintings repaint on the next load.
- `freeze()` holds `t`, so the motion holds too. The tests check purity in `t`, the reduced-motion
  stillness and the off-screen skip (`scenery/waterfall/falls.test.ts`).
