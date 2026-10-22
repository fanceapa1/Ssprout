# Plant system

`src/plants/` (non-species files) — how species become living plants in the garden: cached
sprites, live growth, sway, the bloom, the wither, the watering moment, pond reflections, the
placement highlight, and the shared `renderPlantView` used by the widget and the planting sheet.
Species themselves (`species/*.ts`, `lib/*`) only paint; see `types.ts` and ARCHITECTURE › Species.

Look at it: studio sections **Plants · watering**, **· wither**, **· growth timelapse**,
**· reflections & placement** (`npm run shots -- --studio plants-watering --t 1.6`).

| File | What |
|---|---|
| `sprites.ts` | growth quantisation (24 steps), stage pairs, resolution buckets, sprite keys, `SpriteLru` (byte budget), `createSpriteCache` (priority queue → workers / idle callbacks), `paintSprite` |
| `sprite-worker.ts` | module worker: paints sprites into `OffscreenCanvas`, transfers `ImageBitmap`s (ADR 0111) |
| `draw.ts` | posed drawing: sway skew, tree bend (seamless slices), lift/droop scale, scratch buffers, exact cross-fade + morph |
| `system.ts` | `createPlantSystem` — the renderer `System` |
| `watering.ts` | the jōro: pure timeline + can pose + droplets, painted/cached can, droplet atlas, damp soil |
| `wither.ts` | wither timeline, ochre pixel pass, `drawWithering` |
| `reflection.ts` | shoreline axis maths, cached reflection images, wavering draw |
| `highlight.ts` | placement dabs and their breathing; the `PlacementSource` shape |
| `bounds.ts` | `plantWorldBounds` / `plantWorldEdges` — world box of a placed plant |
| `view.ts` | `renderPlantView` (widget, previews, studio; returns `false` for an unknown species or no 2D context), `plantLayout`, `setPlantViewSpecies` |
| `wind-adapter.ts` | the garden wind for sway: `src/ambience/wind.ts`'s `wind`/`windBoost` (picked up by glob; a local `createFallbackWind` stays as a stand-in if that module is absent) |
| `debug.ts` | `window.sprout.plants` (?dev) |
| `plants.studio.ts` | studio sections |
| `registry.ts` | auto-discovery of `species/<id>.ts` (file name = id): `getSpecies`, `allSpecies`, `speciesByTier`, `buildRegistry` |
| `types.ts` | `SpeciesDef`, `Tier`, `Habitat`, `SizeClass`, `TIERS`, `HABITATS`, `SIZE_CLASSES` |
| `species.studio.ts` | one studio section per registered species (`GROWTH_STAGES` + grow loop) |
| `test-canvas.ts` | test-only fake canvases (`FakeCanvas`, `fakeContext`, `installFakeOffscreenCanvas`) |
| `lib/` | shared species painting: `small-*` (tier 1–2 plants, `small-species-list.ts`), `shrub-*` (tier 3), `tree-*` (tier 4) |
| `plantable.test.ts` | every species has a compatible garden slot (tracked bug: `lotus`, size class `large`, while water slots are medium/small) |

## Wiring (`src/main.ts`)
```ts
setPlantViewSpecies(getSpecies);               // the view also knows ?fixtures species
const plants = createPlantSystem({ getSpecies });
void renderer.add(plants);
…
plants.connectPlacement(ui.placement);         // in-canvas placement highlight
if (speedClock) installPlantsDebug(plants);    // window.sprout.plants
```

## Pipeline
```
store (plants, session) ──sync──▶ records ──requests──▶ sprite cache ──▶ workers (OffscreenCanvas)
                                     │                       │                 │ ImageBitmap
                                     ▼                       ◀─────────────────┘
       update(f): growth target, eased growth, fades, watering/wither clocks, look-ahead requests
       draw('waterSurface'): reflections (pond clip)   draw('entities'): placement dabs
       entities(f): finished · growing · withering · ghost  (depth = slot y)
       draw('air'): the can + droplets
```
- **Records** are re-synced whenever `store.get().plants` or `.session` change: one per finished
  plant (`presence` fade, `appear` fade, `bloom`), one for the session's growing plant, a list of
  withering seedlings. A store listener sees the *action*: `session/cancel` starts a wither,
  `session/complete` hands the growing plant's displayed growth to the finished record (bloom),
  anything else (reset, import) just re-syncs.
- **Growth**: `sessionTimeline(session, f.now).growth` (what `controller.status().timeline.growth`
  returns). The displayed growth eases toward it (τ = 0.6 s) so a dev jump or a reload grows the
  plant in; frames with `dt = 0` (freeze, `renderOnce`) snap, so screenshots are exact.
- **Never paint in a frame**: drawables only `drawImage` cached sprites. A missing sprite is
  requested and the nearest cached one is drawn instead (another resolution, or a lower step).

## Sprites (ADRs 0110–0112)
- Key: `speciesId | seed | step | w×h`. `w×h = species.size × slot.scale × resolution`, where
  `resolution = resolutionBucket(viewport.pixelScale)` — quarter-octave buckets (≈19 %), capped at
  2.4 px per world unit. A resize inside the bucket reuses everything; a significant one queues
  re-renders (priority `rescale`) while the old resolution keeps drawing scaled.
- Growth is quantised to **24 steps** (`GROWTH_STEPS`). Finished plants use only step 24. The
  growing plant draws the two steps around its growth, **cross-faded exactly** (`lighter` into a
  scratch buffer = per-pixel lerp, no double darkening) and **morphed**: the lower step is scaled
  toward the upper one's painted size (measured content bounds) and vice versa, so tips travel
  instead of dissolving. The next two steps are queued ahead (`next`, `ahead`).
- Priorities: `now` (growing plant's current steps, bloom) < `next` < `visible` (finished plants,
  ghost) < `rescale` < `ahead`. Duplicate requests merge (priority raised).
- **Workers**: `min(2, cores − 1)` module workers paint with the same `paintSprite` and transfer
  `ImageBitmap`s. A species a worker doesn't know (runtime-injected) or a failure is retried on
  the main thread; a dead worker's jobs are requeued. Without Worker/OffscreenCanvas the queue is
  drained one sprite per `requestIdleCallback` (≥ 1, more if the idle period allows).
- **LRU**: 64 MB default budget (`budgetBytes`), `w × h × 4` bytes per sprite. Entries used in the
  current frame epoch are never evicted (the budget may overshoot instead); evicted bitmaps are
  `close()`d. 50 finished plants at desktop DPR 2 ≈ 15–25 MB.
- `init` (every resize) requests everything visible and waits for the queue (≤ 8 s), so
  `sprout.ready()` / `freeze()` screenshots show complete plants.

## Motion
- **Sway** (ADR 0113): `wind(t, x, y, boost)` → a horizontal skew about the base.
  Lean at the top = `amp × (sway + 0.18·gust·flutter)`; `amp` small 0.06 · medium 0.045 ·
  large 0.03 · tree 0.016 (fraction of height). Large plants and trees **bend** (`bend` 1.6 / 2.4:
  displacement ∝ heightᵇ) drawn as 6 slices with piecewise-linear skews that meet at every seam and
  clip bands snapped to device rows — the trunk stays, the crown moves, no seams. `boost` is
  `windBoost(phase)` (focus 1, break 0.5), so plants sway a touch more during sessions.
  Reduced motion: no sway, no reflection waver.
- **Displaced plant** (swap): fades out over 1.6 s at session start, back in over 2.4 s on cancel;
  on completion it is pressed (removed from state) while invisible.
- **Appear**: plants added while running (dev `addPlants`, import) fade in over 0.9 s once painted.
- **Bloom**: on completion the finished record continues from the displayed growth to 1 over
  2.6 s with the breath easing (no overshoot), through the same morphing cross-fade.
- **Wither** (ADR 0115): cancel captures the seedling's current image and over 3 s blends it to a
  dried-ochre twin (`witherPixels`), droops it sideways (bend 2) and squashes it toward the base,
  dissolves it from the top (`destination-out` gradient) and fades it out; then it is dropped.

## Watering (ADR 0114)
`session:water` (from the panel, the widget or the dev API) starts a 2.5 s animation at the growing
plant. `wateringTimeline(u)`: glide in 0–0.26 · tilt 0.2–0.37 · pour 0.29–0.74 · soil darkens
0.36–0.6 · leaves lift 0.42–0.62 (+4 % height, a small nudge) · straighten 0.68–0.84 · lift away
0.8–1. The **rig** is measured from the sprite's content bounds (plant top and width); the can's
body is `0.5 × visible height` (30–54 world units × slot scale, so it still reads on the far
bank), it comes from the right unless its path would cross the pavilion (`scene.pavilion.x`) or
leave the world, then from the left, and pours from above the plant on its own side.
- The **jōro**: copper drum with a domed shoulder, riveted hoops, a lifted highlight streak, a
  breath of verdigris, a brass filler cap, an arched bail handle and a long tapering spout ending
  in a brass rose — painted once per pixel-size bucket with the engine (`paintCan`, can units:
  body width 100).
- **Droplets**: 150 per watering, seeded; each leaves the rose at its emission time on a ballistic
  arc solved to land on the soil (72 %) or vanish into the foliage; elongated blue-grey dabs from
  a painted atlas (a quarter catching the light), never thinner than 1.6 device px. Soil landings
  splash (two micro-drops and a flattened crown).
- **Soil**: a painted damp-earth wash under the plant (not on `water` slots) that darkens with the
  pour and, in the garden, dries over 9 s after the can has gone (`gardenWetness`).
- The can and droplets draw on the `air` layer (never hidden behind a nearer plant); the damp soil
  and the lift are part of the plant's own drawable. Reduced motion: no can/droplets; soil + lift.

## Reflections (ADR 0116)
Plants on `shore`/`water` slots (or species with `reflect: true`) reflect when there is water
below them: `shoreAxis(pond, x, y, halfWidth)` is the base itself inside the pond, else the pond
edge straight below (checked across the foliage width) within 70 world units; front-bank plants
cast nothing (their reflection would fall on land). The reflection image (half resolution,
cached per sprite key) is the sprite flipped, blurred (`ctx.filter`, downscale fallback), tinted
toward celadon, fading with depth and broken by 4–6 ragged horizontal lift strokes. Each frame it
is drawn at 50 % in 7 wavering slices (amplitude grows away from the shore, ≤ 1.3 units) plus the
plant's sway, clipped to the pond polygon on `waterSurface`.

## Placement highlight (ADR 0117)
`connectPlacement(ui.placement)`: while placing, each compatible slot gets a pale sage-gold wash
dab breathing on a 4.2 s cycle (idle 0.2–0.34, focused 0.5–0.6, selected 0.62–0.74), drawn under
the plants; the focused (else selected) slot shows a **ghost** of the species at full growth at
34 % opacity. The DOM markers stay the source of truth for input; this is paint only.

## Plant view (ADR 0118)
`renderPlantView(canvas, { speciesId, seed, growth, watering, wilt? })` — unchanged signature.
Contains the species (base bottom centre), a soft ground wash, the morphing cross-fade between
the two nearest of 24 steps (lower step painted synchronously on first use, upper step queued for
idle time and faded in once ready), damp soil + the can + droplets for `watering` (the rig is
kept inside the canvas with `fitRigToCanvas`), and the wither for `wilt`. Its cache is a separate
24 MB main-thread `SpriteCache`. `setPlantViewSpecies(fn)` adds species the registry lacks.

## Bounds & labels
`plantWorldBounds(def, slot)` — `species.size × slot.scale`, anchored on the slot point; the exact
rect sprites are drawn into. The UI's label hit-test (`src/ui/plant-labels.ts › plantBox`) uses
it; `system.plantBounds(plantId)` returns it for finished plants and the growing one.

## How species integrate
Drop `species/<id>.ts` (see ARCHITECTURE › Species). The system relies only on: `size`/`anchor`
(box and base), `sizeClass` (sway), `habitats`/`reflect` (reflections) and `draw(p, rng, { w, h,
growth })` being **deterministic for (seed, growth, w, h)** and painting inside its box (anything
outside is clipped). `draw` must not touch `document`/`window` (it runs in workers). It is called
at growths `k / 24` only. Keep each call under ~100 ms at 600 px.

## Budgets
- Species: all 25 registered species (the 12 shrubs/trees and 13 tier 1–2 plants) paint in
  the worker, deterministically, without touching the box's sides or top, in 4–127 ms at 1.6×.
- Frame: < 2 ms for the plant system (update + all draws). Measured: 0.54 ms avg / 1.8 ms max in
  headless Chromium on the painted scene with 31 plants + 1 growing (e2e); the unit benchmark with 50 plants + 1
  growing (CPU side) passes the same bound.
- Painting: off the main thread with workers; the main-thread fallback paints one sprite per
  idle period (a single sprite can still exceed 8 ms there).
- Memory: 64 MB garden + 24 MB view LRU; reflections ≤ 48 cached images at half resolution.

## Debug API (`?dev`, `window.sprout.plants`)
`sprout.plantsReady()` resolves once every sprite the garden needs is painted, without snapping
growth or blooms; use it before a screenshot (`sprout.addPlants(25); await sprout.plantsReady()`).
`window.sprout.plants`:
`state()` (ready, resolution, finished [id, slot, alpha, drawn, blooming], growing [growth, shown,
lo, hi, weight, drawn], withering, watering [progress, wet, active], displaced, reflections,
highlight, cache stats), `settle()` (snap growth/fades, paint what is needed, resolve when idle),
`whenIdle()`, `bounds(id)`, `boundsFor(speciesId, slotId)`, `toDevice(rect)`, `perf()`,
`resetPerf()`, `ambienceWind()`.

## Tests
Unit: `sprites.test.ts` (quantisation, stage pairs, cross-fade weights, buckets, keys, content
bounds, LRU budget/epoch/best, scheduling, workers incl. fallback and death), `draw.test.ts`,
`watering.test.ts`, `wither.test.ts`, `reflection.test.ts`, `system.test.ts` (drawables, sizing,
growth + look-ahead, easing, displacement, wither, watering, bloom, bounds, reflections,
highlight, 50-plant budget, "finished plants sway with the wind, and hold still under reduced
motion"), `view.test.ts`, `registry.test.ts` (discovery, well-formed species, tiers, id/file
match), `plantable.test.ts`. E2E: `tests/e2e/plants.spec.ts` (watering, wither, bloom + reload,
reflection, placement highlight, bounds + budget; the growth test runs in a reduced-motion block
with the light pinned to noon).
