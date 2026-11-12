# 163 · Z28: The lantern flicker follows the clock

## What
The lantern flame's flicker no longer leaks real time into a settled still frame.
- Cause: `ambience.ts` kept `flameT`, summed from every frame's `dt` (the renderer's rAF time,
  seconds since the last frame) since the engine was made. `settle()` reset the sim but not
  `flameT`, and `freeze()` only stops the frames. Two fresh loads froze at different flame
  brightness: one 64-px square around the lantern differed (devlog 157).
- `flameT` is now the ambience's own time like `sim.t`: the settle frame sets it to 0 (and does not
  add its `dt`), and the frames after it add `dt` as before. Live, the flicker looks the same; it
  starts over on a settle, which is also when the sim's rain and motes are laid down again.
- `flameFlicker(t)`: the flicker's formula, unchanged, as a pure export.
- `sprout.ambience().flame`: the flame's time since the last settle (s).

The clock (`f.now`) was not used: two loads open at different clock times, so a flame on the
clock would still differ between them. The settle is the existing pin for the ambience's motion.

## Checked the same way
- Ambience: the sim's time (`sim.t`: rain, motes, drips, dew twinkle, the sun's breath) starts over
  on settle already. `sinceLight` only schedules recomposes, and a settle marks the light dirty.
  Nothing else reads real time.
- Not fixed (not owned): the pond's shimmer, ripples and glints (`scene/water.ts`) run on the
  renderer's `f.t`, real time since the page opened, passed in by `scene/system.ts` (Z15's file).
  A still frame with the `waterSurface` layers shown differs between loads. The hashing specs
  mute those layers. A fix: a time in the scene system that its settle (or a dev hook) resets.
- Fireflies are fauna, stepped with real `dt` like every creature; specs mute the fauna.

## Tests
- `src/ambience/flame-flicker.test.ts`: the flicker's range (0.88–1, 0.94 at 0); live the flame's
  time follows frame time and its alpha changes; after 37 uneven frames a settle (with a real `dt`
  on the settle frame) draws the flame alpha of a fresh engine, and a `dt` 0 frame keeps it; reduced
  motion stays at 0. Without the reset the settle case fails.
- `tests/e2e/lantern-flicker.spec.ts`: normal motion (asserted), the Japanese garden at night at
  22:00; two fresh loads, the second run 30 frames longer (its flame time > 0 before the settle),
  hash the same settled frozen frame (`switch-light.spec.ts`'s method), flame time 0.
- Run: `flame-flicker`, `lazy-sprites`, `switch-parts` unit tests; `typecheck`;
  `lantern-flicker.spec.ts --repeat-each=3` (3 passed); once with the reset disabled (fails: the
  settled frame's flame time is 1.88 s, not 0);
  `switch-light.spec.ts`, `night-edge.spec.ts`.

## Left open
- The pond's `waterSurface` time (above).
- `night-edge.spec.ts` still emulates reduced motion for its hashes; that is no longer needed for
  the flame, but it does no harm.

## Index rows
`| 163 | [Z28: The lantern flicker follows the clock](163-lantern-flicker.md) | The lantern flame's time starts over on settle like the sim's, so two fresh loads at night freeze to the same frame with motion; the pond's shimmer still runs on real time (muted in specs) | Done |`

`| Z28.1 | The lantern flame flickers with the ambience's own time, which a settle starts over: two fresh loads at night, with motion, freeze to the same frame | unit: src/ambience/flame-flicker.test.ts | e2e: tests/e2e/lantern-flicker.spec.ts | ✔ |`
