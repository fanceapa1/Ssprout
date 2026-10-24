# ADR 0226 — Scene paint steps in parts the cooperative painter can pause between

- Status: accepted
- Date: 2026-10-24
- Amends: ADR 0041 (cached background, cooperative paint), cost only; applies to the detail repaint of ADR 0163

## Context
The scene painting runs cooperatively (`paintScene`): it yields to the browser once a slice has
run past 20 ms. But it could only yield *between* steps, and a step was one uninterrupted call.
The phase 9 runtime profile (P0a, "[High] 2" and "[High] 4") found steps of 70–175 ms: the boulders,
the meadow, the big tree, the banks, the pavilion. At load they became long tasks. They also ran in
the detail repaint after the camera comes to rest, where at 4× CPU throttle the frames after a
session's glide hit p95 133 ms / max 267 ms.

## Decision
- **Steps paint in parts.** A `PaintStep.run` may return `Strokes` (a generator, `paint-land.ts`)
  instead of painting at once. The scene's paint functions are generators that `yield` after each
  painter call (a wash, a stroke, a foliage clump, a stone) or batch of marks (a row of meadow
  cells, a tree's reflections). Boulder sprites (`paintRockSprite`) yield after the contact
  shadow, the stone and each base tuft, and return the sprite.
- **`paintJob` yields after every part** (the step's name each time). `paintScene` is unchanged:
  it checks the clock after each `next()` and yields once the slice is spent, so a slice now ends
  within one part of 20 ms, not one step. Nothing else paints on the job's canvas between parts,
  so the view transform stays put. A wet layer may stay open across a pause (the meadow's rows,
  the reflections). Its work canvas came out of the pool, so another job cannot get it.
- **Identical painting.** The same calls run in the same order with the same rng draws; a part
  only marks where the job may pause. A recording canvas (`paint-record.ts`, Vitest) hashes every
  canvas call and its exact arguments. The hashes for the overview and two close views were taken
  before the split and are unchanged. In Chromium the painted canvas and every sprite hash the
  same before and after, pixel for pixel.
- **Timings per part.** `StepTiming` gains `longestMs` and `parts`, `PaintResult` gains `longest`
  (the longest uninterrupted part), and both reach `sceneStats().longest` and
  `sceneDetail().longest`. The sprites' timing now counts painting only. Before, it included the
  time yielded to the browser between boulders.

### Rejected
- **Splitting a step's wet layers** (e.g. the meadow in horizontal bands, each dried apart): it
  would be cheaper per part, but the drying pass reads the whole layer (edge blur, flow anchored
  at its corner), so the painting would change.
- **A worker** (P0a's A8) moves all of it off the main thread. It is a larger change and still worth
  doing; the parts help either way.

## Consequences
- Load (1440×900 @2, world at 1.5 px/unit), browser, old and new interleaved on the same
  machine: the longest uninterrupted part went from 190–230 ms (meadow or big tree) to 100–130 ms
  (the meadow's drying pass), with total CPU the same. In a close view on the big tree it went from
  305–345 ms to 34–38 ms (a boulder's stone). See devlog 46 for every view.
- **What is left is one painter call** that the scene cannot split: the drying pass of a big wet
  layer (the meadow and its grass, the margins), the pond's `waterBody` recipe, one `wetInWet`
  bank or sky wash, a boulder's `stone`. These are in the paint engine (`src/paint/wet.ts`
  `WetLayer.dry`, `recipes.ts`). Drying in row bands as a generator would cut them further without
  changing a pixel. That is a separate task for the engine's owner.
- A job cancelled in the middle of a step (a newer view supersedes it) drops a suspended
  generator. A wet layer it had open never goes back to the work-canvas pool and is garbage
  collected, and the pool makes a new canvas when it needs one. Nothing is drawn from it.
- A new paint step should be a generator that yields between its marks. A step that paints one
  mark can stay a plain function.
