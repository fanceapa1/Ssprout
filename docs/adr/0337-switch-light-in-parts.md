# ADR 0337: A switched garden's light is got ready in parts, under the renderer's cover

- Status: accepted
- Date: 2026-11-10
- Amends: ADR 0236 (daylight plates from the paint cache), ADR 0243 (switching the garden on view)

## Context
A warm switch between gardens (the new garden already in the paint cache) blocked the main
thread for 90–205 ms in one task (runtime report, phase 14; devlog 143). The profile put most of
it in the ambience: the switch made a new engine at once, and its first frame drew the lighting.
That draw needs the composite, and the composite paints any plate whose paint-cache lookup has
not answered yet (ADR 0236: "a draw never shows a stale composite"). So every first switch into
a garden in a page painted its light plates again with the wash's noise fields (50–80 ms).
At night the new engine also built its own night edge (40–60 ms), which depends only on the
canvas size and is the same for every garden.

## Decision
- **The night edge is one per seed for the page** (`nightEdgeFor`). It keeps its canvases for the
  last three sizes, so the studio's several sizes do not rebuild each other. A switch never builds
  it.
- **A switch gets the new engine ready before it takes over.** The ambience system's `init` keeps
  the old engine updating and drawing and makes the new one. Then it awaits `engine.prepare(light,
  warm)`, which:
  1. looks up the light plates for the current blend (`cast.lookup`), and waits for the answers
     (polled every 16 ms, for at most 1 s);
  2. paints what is still missing after a miss, one part per idle callback: the wash field, then
     each plate (`cast.paintPart`);
  3. builds the sprite groups the old engine had built, one per idle callback.

  After that the new engine takes over, and its first frame composes from plates that are
  already there. `init` returns this promise, so the renderer's `ready` waits for it. Its cover
  (the last frame of the old garden, ADR 0243) stays over everything until then. The old light
  under the cover is never seen.
- **The boot path is unchanged.** There is no old engine at boot, and the reveal still waits up
  to 0.3 s for the lookups (ADR 0236). A resize or a scene without a switch rebuilds at once, as
  before.
- **Readiness**: `sprout.lightReady()` resolves once a switch's light is in place, and
  `sprout.ambience().switching` is true while it is not. `showScenery` already waits for it,
  through the renderer's `ready`.

## Consequences
- Warm switches at 1440×900 @2, all six ordered pairs of the three gardens: the longest task
  from the ambience went from 50–129 ms to under 50 ms (no long task at night). The ambience no
  longer shows in the switch profile. At midday a switch into the waterfall still has 90–100 ms
  tasks, from the fauna's first sprite (the dipper) and the falls' `prepare`, which are outside
  the ambience. Numbers: devlog 143.
- The settled frame after a switch is pixel for pixel what a fresh load of that garden shows
  (`tests/e2e/switch-light.spec.ts`).
- A switch whose plates miss the paint cache paints them in parts, each part still one task (the
  wash field ~40 ms, a plate ~30–60 ms). This is the cold path, where the landscape paint takes
  seconds anyway.
- `showScenery` resolves when both the landscape and the light are ready. The light's lookups run
  alongside the landscape's, so a warm switch did not get slower (ready 70–170 ms, was 120–270 ms).
