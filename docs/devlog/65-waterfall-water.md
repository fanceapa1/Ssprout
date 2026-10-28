# 65 — S7: the waterfall's water

**Status: done**, with the open points below.

## What
- `src/scenery/waterfall/paint-water.ts`: `paintFalls` (the falling sheet, still), `paintPool`
  and `paintStream`, generators that yield after each mark (ADRs 0226, 0238), on white (ADR 0021),
  in the neutral daytime painting only (daylight plates are S10).
  - *Falls*: the sheet's paper is reserved by two lifts. Broken `WET_ROCK` runs down both edges
    show the cliff through the thinnest water, and a glaze shades the left half. Vertical streaks
    follow the widening sheet (`sheetAt`) and leave white paper between them. Lifted threads, a
    glassy lip with a gleam, and a foam mass at the foot with a cool shade under it and mist
    over it.
  - *Pool*: a rim reserved like the garden's pond, then the garden's `waterBody` recipe in a cooler,
    bluer palette. Then a deep heart under the falls, warm shallows at the near edge, the cliff's
    broken dark reflection and soft boulder reflections. The reserves are the falls' pale
    reflection and the sky band. Churn rings and foam flecks drift toward the outflow.
  - *Stream*: a rim reserved outside the pool only, a wet-in-wet body that pales toward the viewer,
    a deeper channel ribbon and warm shallows inside the bends. Short level ripple marks (dark
    strokes and lifts), and pale collars and wakes round the three stream rocks.
- `src/scenery/waterfall/index.ts`: the water steps replace the placeholders. The order is
  unchanged: the pool and the stream after the ledges, then the falls, then the trail stones. The
  boulders are sprites over the whole background, so they all sit on the water.
- Studio `waterfall-water` (106): `water-falls`, `water-pool`, `water-stream`, `water-scene`. It
  reuses `region` from `rocks.studio.ts`, which is now exported.
- Tests: `water.test.ts` (step order, the sheet's edges, quantised hash pins of the overview and
  a close view on the foot, slice bounds, many parts per step). In `waterfall.test.ts` the
  step-order test is renamed and also covers the `falls` filter. TESTING rows S7.1–S7.4, and
  S4.1 reworded.
- `src/main.ts` untouched. Nothing changed outside `src/scenery/waterfall` and the docs.

## Why
- The water is cooler and bluer than the garden's pond: it is deep, moving water under a cliff,
  and the garden's warm green celadon would read as still pond water.
- The falls are mostly reserved paper with streaks, not a pale wash. White water in watercolour
  is the paper left alone.
- The stream's ripples are level marks, not strokes along or across the current. The stream lies
  on the ground plane seen from above, so slanted cross-stream strokes read as scratches or birds
  in the shots.
- The stream's rim lift is clipped to outside the pool, so no white rim line crosses the
  outflow.

## How it looks
Shots: `artifacts/shots/entry-waterfall-water_water-falls-1440x900.png`, `…_water-pool-…`,
`…_water-stream-…`, `…_water-scene-…`. Compared with the garden's pond:
`artifacts/shots/entry-scene_pond-1440x900.png`.
The sheet reads as falling water: streaked, mostly white, darker at the thin edges. The pool is
deep in the middle and lighter at the edges and the outflow. The stream is pale and shallow.
The wet streaks S6 painted beside the falls now show at both edges.

## Left open
- The lip is a slightly blocky, level top. A rounder roll over the edge would help, and S9
  animates the sheet anyway.
- The foam's lifts read a little like separate cloud shapes at close range. They could merge into
  one softer mass with spray.
- The pool's `waterBody` leaves a darker oval right of centre that reads as a second deep spot.
- The boulder reflections hardly show under the wet sprites' waterlines.
- The riffle collars mostly hide under the rock sprites. Over S8's banks they may need to be
  stronger.
