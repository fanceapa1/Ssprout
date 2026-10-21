# 13 — Plant system

## What
- `src/plants/` (non-species): the plant system that turns species into a living garden
  (docs/systems/plants.md).
  - **Sprite cache** (`sprites.ts`, `sprite-worker.ts`): 24 growth steps, sprites sized
    `species.size × slot.scale × resolution bucket`, a priority queue painted by module workers
    (OffscreenCanvas → ImageBitmap; idle-callback fallback), byte-budgeted LRU (64 MB).
  - **PlantSystem** (`system.ts`): finished plants and the session's growing plant as entities
    (depth = slot y); growth from the session timeline, eased, drawn as a morphing exact
    cross-fade between the two nearest steps with the next steps painted ahead; displaced plant
    fades out/in; bloom-in on completion; sway (skew, bends for trees) from the wind.
  - **Wither** (`wither.ts`), **watering** (`watering.ts`: the painted copper jōro, droplet arcs,
    splashes, damp soil, leaves lift), **reflections** (`reflection.ts`), **placement highlight**
    (`highlight.ts`: breathing dabs + ghost), **bounds** (`bounds.ts`).
  - `renderPlantView` (`view.ts`) rebuilt on the same pieces with the same signature, plus a
    soft ground wash; `setPlantViewSpecies` so fixtures render in the widget and the sheet.
- `src/main.ts`: five lines (register, connect placement, debug, view species).
- `src/ui/plant-labels.ts`: `plantBox` now delegates to `plantWorldEdges` (one-line change; the
  label hit-test and the sprites share one box). UI owners: nothing else changed.
- `window.sprout.plants` (?dev), studio sections Plants · watering / wither / growth timelapse /
  reflections & placement.
- Tests: 70 unit tests in `src/plants` (+ the system's 50-plant CPU budget), 7 Playwright specs in
  `tests/e2e/plants.spec.ts` (growth by pixel diff, watering, wither + displaced return, bloom
  persists after reload, reflection, highlight, bounds/label + frame budget).

## Why (non-obvious)
ADRs 0110–0118. Highlights: 24 steps + morphing cross-fade instead of 5 stages (live growth must
be continuous); painting in workers because a species `draw` can't be chunked; wither/bloom
driven by the store *action* so reset/import don't animate; reflections about the pond edge
below each plant; the can on the `air` layer so it is never hidden.

## Review rounds
- Watering, round 1: can too boxy, starkly striped highlight, drops fell vertically like rain.
  → feathered lift, shadow flank inside the silhouette, finer elongated drops, aim further out
  so the stream arcs. Round 2 (garden, DPR 2 sequence): stream turned to dust at garden scale →
  minimum drop width in device px; can a touch smaller. Round 3: spout showed through the
  translucent body and ended square → spout painted after the body with a soldered collar;
  lower handle; no damp soil on pond slots.
- Growth smoothness: mid-fade showed double tips → morph between steps (tips travel).

## Measurements
Plant system 0.54 ms/frame avg, 1.8 ms max (headless Chromium, painted scene, 31 plants + 1 growing, e2e log);
CPU-side benchmark with 50 + 1 plants < 2 ms in node.

## Coordination / left
- **Wind**: `src/ambience/wind.ts` was not on main; `wind-adapter.ts` uses a local field with the
  same signature and picks the ambience one up automatically (eager glob) once merged —
  `sprout.plants.ambienceWind()` tells which is live.
- **Scene** (checked after rebasing onto `gardenScene`): far-shore iris/susuki and water lilies
  reflect, front-bank plants correctly don't; the 70-unit shore gap suits the real far bank.
  The can now avoids the pavilion (side from `scene.pavilion.x`) and is a little larger so it
  reads on the far bank. Depth sorting with the scene's boulders looks right.
- **Species**: all 26 real species verified in the sprite worker (deterministic, inside their
  box, no DOM, ≤ 127 ms per full-grown sprite at 1.6×). No species changes needed.
- UI could use `sprout.plants`' content bounds for tighter label hit areas later.
