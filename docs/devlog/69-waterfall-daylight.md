# 69 — S10: the waterfall's daylight

**Status: done**, with the open points below.

## What
- `src/scenery/waterfall/sky.ts`: `WATERFALL_SKY`, the four sky plates and the pool's mirrored
  sky, in the garden's watercolour language (`scene/paint-sky.ts`), on white.
  - *Sunrise*: violet-blue overhead into peach, an apricot glow round the sun over the far ridge
    (x 1270), violet banks with rose-apricot undersides, a cool violet ridge.
  - *Midday*: wet-in-wet cerulean, darker pools, soft whites lifted out (ADR 0184), a pale ridge.
  - *Sunset*: rose-violet into crimson and ochre, the glow just right of the buttress (x 1040),
    crimson and gold banks, a violet ridge.
  - *Night*: granulating indigo, a paler ultramarine horizon, a dark ridge, 30 stars from the
    waterfall's band.
  - The washes are clipped to `plateSky()`: 14 units under the crown, the notch and the buttress,
    40 over the flank and the ridge. The ridge glaze is painted after the clip.
  - *Pool*: the mirrored sky darkens toward the back edge (it mirrors the cliff, not the horizon),
    broken by lifted streaks.
- `src/scenery/waterfall/light.ts`: `WATERFALL_LIGHT_ART` with the `shadows` and `lights` hooks:
  shade under the ledges and along the cliff foot; at a low sun the notch and the falls' right
  half under the buttress and the left cliff, always to the left; feathered warm paper on the
  buttress's crown and flank, the crown's edge, the ledges' tops and the ridge under the sun at
  sunrise and sunset; at night cool paper down the falls and over the spray (no lantern).
- `src/scenery/waterfall/index.ts`: the placeholder `sky` step and the flat placeholder plates
  are gone; the scenery takes `WATERFALL_SKY` and `WATERFALL_LIGHT_ART` (re-exported).
- Studio `waterfall-daylight` (109): the four phases over the painting the way the renderer
  layers them, dusk, and each phase's sky, water and light plate.
- Tests: `daylight.test.ts` (wiring, sun, moon and stars in open sky per phase, the washes'
  outline clear of the plate's lower edge, `waterfall` in both plate keys); `waterfall.test.ts`
  step list; e2e `sceneries.spec.ts` › the waterfall has its own daylight. TESTING rows
  S10.1–S10.3, S4.1 reworded.

## Why / decisions
ADR 0247. In short:
- **Clip, short hang.** With the garden's 40-unit hang and no clip, the washes' spread laid a
  pink band over the pale cliff top and the falls' lip at sunset (seen in the app at 1920×1080).
- **Shadows to the left.** Both low suns stand right of the buttress, so the hook ignores the
  sign of the global `dx`.
- **Grades global.** All four phases read right over the waterfall with `PHASE_GRADES`.

## How it looks (looked at)
- `artifacts/shots/entry-waterfall-daylight_waterfall-sunrise-1440x900.png`: peach sky, the sun
  half over the far ridge, cool violet banks; the left cliff in soft shade, the notch shaded under
  the buttress, warm light on the buttress's flank. Reads as early light.
- `…_waterfall-midday-1440x900.png`: cerulean with lifted whites, pale ridge, short shade under
  the ledges and along the cliff foot. Clean.
- `…_waterfall-sunset-1440x900.png` and `artifacts/shots/app-waterfall-sunset-1920x1080.png`
  (the real composite): orange-crimson sky, the sun just right of the buttress, a violet ridge.
  The cliff stays pale stone under the clip.
- `…_waterfall-night-1440x900.png`: indigo with stars only in the open sky, the moon over the
  ridge, the falls and spray glowing pale. The strongest of the four.

## Results
- Typecheck clean; `npx vitest run` (see the task report for counts); e2e `studio.spec.ts` and
  `sceneries.spec.ts` (port 4363, 1 worker) pass.

## Left open
- **Boulder shadows and rim light** still follow the global `castShadow` / `rimLight`: to the
  right and lit from the left at sunset, while this sky's sunset is on the right. A per-scenery
  direction needs a `SkyLayout` or `LightArt` field (a contract change).
- **The far ridge's top**: a soft step where the clip (40 under the skyline) meets the ridge
  glaze, visible on wide screens at sunset.
- **The buttress's right flank** reads translucent against the ridge in every phase. It is the
  rock painting's edge (S6), not the daylight.
- No close-view (ADR 0163) shots of the waterfall's plates were taken.
- `main.ts` untouched.
