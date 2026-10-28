# 66 — S3: switch the garden on view at runtime

Phase 10's gardens could be stored (S1, devlog 63) and painted (S2, S4, S6) but not shown one
after another. This task switches the garden on view without a reload (ADR 0243).

## What
- **Renderer** (`render/renderer.ts`, `render/types.ts`):
  - `SystemContext.scenery?`, and `scene` is its geometry.
  - The `scenery` option sets the first scenery and the focus.
  - `setScenery(s)` copies the canvas, sets the focus from `s.view.focus`, re-inits every system
    through `resize()` and cuts the camera to the overview.
  - The copy covers the stage until the new generation is ready, then fades out over
    `SCENERY_FADE_S` (0.9 s). Reduced motion, a frozen, stopped or hidden renderer cut, and
    `freeze()` ends a fade under way.
  - `scenery` and `sceneryFade()` report the switch.
- **Host** (`scenery/host.ts`, new): follows `state.scenery` and calls `setScenery`. When a session
  from another garden becomes active (start or switch), it dispatches `scenery/view` to that garden
  inside the same store dispatch. The cut therefore comes before the controller's
  `session:switch`, and the glide to the seedling (ADR 0168) follows the cut.
- **Scene** (`scene/system.ts`): a new scenery drops the paintings, jobs, sky and water, then
  paints `art` with that scenery's `sky`. Init blocks until the painting is ready, as on boot. The
  first painting shows without the paper fade-in, because the renderer does the cross-fade.
- **Ambience** (`ambience/system.ts`): builds the engine again with the scenery's light art,
  sky layout and ambience numbers. Weather, the time override and the reveal carry over.
- **Plants** (`plants/system.ts`): `gardenOnView(state, id)` gives the finished plants and the
  seedlings of the garden on view. Switching clears the records and syncs again; the sprite
  cache stays warm. A session in the other garden keeps counting in state.
- **Fauna** (`fauna/system.ts`, `fauna/sim.ts`): `resetResidents()`. Unlocks and targets come
  from the garden on view (`plantsIn`, `unlockedFauna(state, lookup, id)`). Until S11 there are no
  creatures outside the Japanese garden, so no koi swim in the waterfall's rock.
- **`main.ts`** (+11 lines):
  - `sceneries(params)` is the list of available gardens; `pickScenery(id)` falls back to the
    first of them.
  - The renderer, the scene system and the ambience get the initial scenery.
  - The host is created, and `installSceneryDebug` is added to the dev block.
- **Dev API** (`dev/scenery-debug.ts`):
  - `sprout.scenery()` returns `{ viewed, available, fade }`.
  - `sprout.showScenery(id)` dispatches `scenery/view` and resolves when the garden is ready.
    It rejects an unavailable id.

## Tests
- Unit tests:
  - `render/renderer › switching the scenery`: re-init with the scenery, geometry, focus and
    overview, and a no-op for the same scenery; the cover until ready, then the fade; freeze ends
    the fade; reduced motion cuts.
  - `scenery/host`: follows `state.scenery`, and a switch to a waterfall session brings the
    waterfall into view.
  - `plants/on-view`: the filter.
- e2e `sceneries.spec.ts` (6):
  - the flag offers the waterfall, and the unavailable id is rejected;
  - to the waterfall and back: cross-fades, the camera is at the overview, and the still frame
    returns pixel for pixel without a reload;
  - the second switch is a paint-cache hit with no repaint;
  - each garden shows only its own plants;
  - a Japanese-garden session keeps counting while the waterfall is on view, and switching back to
    it brings its garden back;
  - reduced motion cuts.
- Screenshot `artifacts/shots/switch-waterfall-*.png`, taken after a runtime switch: the waterfall
  with its three plants, and nothing left of the Japanese garden.

## Left open
- **S5:** the UI still uses the Japanese garden's slots in four places: placement markers, the
  planting sheet, the camera's seedling framing in `ui/stage-camera.ts` (`deps.slots`), and the dev
  `slots()`/`boundsForSlot` hooks. Planting in the waterfall from the UI, and the glide to a
  waterfall seedling, need the viewed scenery's slots. The Gardens dock section is S5.
- **S11:** per-scenery wildlife rosters. Today the fauna system shows creatures only in the
  Japanese garden (`wild()`).
- **S15:** the waterfall sound. Audio keeps the pond bed in every garden.
- `moteEmitters` and the audio still read every plant. Motes look up slots in the viewed
  geometry, so plants of the other garden find no slot and emit nothing.
- `sprout.slots()` returns the Japanese garden's slots.
