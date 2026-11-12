# 157 · Z16: The night edge freed by day

## What
The night edge's two canvases (ADR 0184) used to stay alive all day once a dark frame had built
them. Now they are freed while the light does not need them and built again on idle, in parts,
before the evening (ADR 0350):
- `night-edge.ts`:
  - `edgeFieldBuild`: the field a band of rows at a time. `nightEdgeFields` runs it in one go,
    with the same arithmetic.
  - `edgeWanted(light, at)`: true for any dark weight, or within `EDGE_LEAD_MS` (30 min) before
    the evening's blend out of midday begins.
  - `NightEdge.keep(wanted, canvas)`: frees the canvases (backing set to 0×0), or builds them for
    the canvas's size on idle, `EDGE_PART_PX` field pixels per part.
  - `NightEdge.stats()`.
  - A draw that finds the edge missing still finishes the build in that frame.
- `ambience.ts`: `edgeWanted` on every update. `keep` at the top of `drawLighting` (before the
  reveal's alpha check). `debug().nightEdge`.
- `system.ts`: `AmbienceFrame.at`, the light's clock time: the frame's, an hour override's, or
  null when pinned.

## Why
Phase 14's memory audit counted ~9.5 MB of canvases for an effect that only shows from the
evening blend to the end of the morning blend.

## Numbers
Production build, `?dev`, 1440×900 window (stage 1412×846), headless Chromium under `nice -n 19`
with another agent running. Canvas backing bytes come from `sprout.ambience().nightEdge.bytes`
(width × height × 4 of both canvases).

| | before | after |
|---|---|---|
| noon, after a night in the page | 9,556,416 B (9.56 MB) | 0 |
| noon, fresh load | 0 (never built) | 0 |
| night | 9.56 MB | 9.56 MB |

The field is one CSS px per pixel, so the bytes are the same at DPR 1 and DPR 2.

Rebuild before dusk, at DPR 2: 10 idle parts, the longest 19–29 ms (the last one puts both
images), 101–108 ms in all, over three runs. The build at once (a jump to night, or a load at night, as before)
is one task of 105–154 ms on the same loaded machine (devlog 143: 40–60 ms quiet).

## Tests
- `src/ambience/night-edge-schedule.test.ts`:
  - The field is the same whole or in bands.
  - `edgeWanted`: pinned lights, and a London midsummer day (freed at noon, wanted from 30 min
    before the evening blend, freed after the morning blend).
  - The idle build: a part per callback, the same images as a build at once.
  - A free cancels a half-done build.
  - A jump to night mid-build finishes it in that frame.
  - A whole day at one frame a minute: no bytes at noon, and no build at once except the first
    frame (it opens before dawn).
- `tests/e2e/night-edge.spec.ts`:
  - A load at 13:00 holds no edge. Night builds it, noon frees it, and night again gives the same
    frame, which is also a fresh load's at night (reduced motion, so the lantern's flame does not
    flicker between loads).
  - At DPR 2, 15 min before the evening blend: built on idle (`sync: false`, more than one part),
    and the sunset then builds nothing.
- Run: those two (unit; e2e `--repeat-each=2`, 4 passed), `night-edge`, `switch-parts`, `lazy-sprites`,
  `lighting`, `daylight` unit tests, `switch-light.spec.ts`, `ambience.spec.ts`, `typecheck`.

## Found on the way
Two fresh loads' night hashes (`switch-light.spec.ts`'s method) can differ in one 64-px tile
around the lantern. The flame flickers with `flameT`, which runs with real frame time and is
not reset by `settleAmbience()`. The new spec uses reduced motion to avoid it.
`switch-light.spec.ts` may flake on it in the same way.

## Left open
- A load at night still builds the edge in one task: the reveal reaches a visible strength
  before the idle parts have run. Starting the parts on a non-idle timer once the light is
  needed now would close it.
- After a resize at night the edge keeps up to three sizes (as before). Freeing the other sizes
  in `keep` is possible once nothing else draws the lighting into a canvas of another size.

## Index rows
`| 157 | [Z16: Night edge freed by day](157-night-edge-by-day.md) | The night edge's 9.56 MB of canvases freed by day and built again on idle in ~10 parts (≤ 29 ms) 30 min before the evening blend; a jump to the dark still builds it in that frame; ADR 0350 | Done |`

`| Z16.1 | Night edge freed by day (no canvases at noon), built on idle in parts before the evening blend, built at once on a jump to the dark; the night frame unchanged | unit: src/ambience/night-edge-schedule.test.ts | e2e: tests/e2e/night-edge.spec.ts | ✔ |`

`| [0350](0350-night-edge-by-day.md) | The night edge is freed by day and built again on idle before the evening | accepted | `edgeWanted` (dark weight, or 30 min before the evening blend) each frame; freed (0×0) when not wanted, built a band of rows per idle callback when wanted; a draw that finds it missing builds it at once; −9.56 MB by day |`
