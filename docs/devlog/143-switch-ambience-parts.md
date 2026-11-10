# 143 · Z5: A garden switch's light in parts

## What
Switching gardens blocked the main thread while the ambience rebuilt the light (runtime report,
phase 14, T4). Now the new garden's light is got ready in parts, under the renderer's cover
(ADR 0337):
- `night-edge.ts`: `nightEdgeFor(seed)`, one edge per seed for the page, which keeps its canvases
  for the last three sizes. The edge depends only on the canvas size, so a switch never builds it.
- `cast.ts`: `missing`, `lookup`, `looking` and `paintPart` (the wash field, then a plate).
- `ambience.ts`: `prepare(light, warm)`. It looks the blend's plates up and waits for the answers
  (at most 1 s). It paints what missed one part per idle callback, then builds the old engine's
  sprite groups, one per callback. `sprites()` lists the built groups.
- `system.ts`: on a switch the old engine keeps drawing, and `init` returns the new engine's
  `prepare`. When it resolves, the new engine takes over. Boot and resize are unchanged.
  `lightReady()`, `debug().switching`.
- `dev.ts`: `sprout.lightReady()` (docs/ARCHITECTURE.md › Ambience).

## Why
Profile (production build, `?dev`, 1440×900 @2, a fresh page booted on garden A, then a switch to
B; the gardens are already in the paint cache). The first draw of the new engine composed the
light, and that painted the blend's plates with the wash's noise fields (50–80 ms), because their
lookups had not answered yet. At night it also built a night edge for the new engine (40–60 ms).

## Numbers
Longest long task / longest frame gap (ms), the first switch in a page, all six pairs. Scripts:
the runtime report's `switch.mjs`, adapted as `fresh.mjs` (scratchpad).

| Pair | night before | night after | noon before | noon after |
|---|---|---|---|---|
| garden → waterfall | 99 / 129 | 0 / 35 | 173 / 188 | 102 / 117 * |
| waterfall → oasis | 100 / 126 | 0 / 30 | 202 / 221 | 93 / 109 * |
| oasis → garden | 129 / 138 | 0 / 28 | 93 / 88 | 0 / 27 |
| garden → oasis | 103 / 116 | 0 / 24 | 205 / 211 | 95 / 123 * |
| oasis → waterfall | 104 / 119 | 0 / 28 | 177 / 184 | 103 / 118 * |
| waterfall → garden | 121 / 130 | 0 / 29 | 122 / 125 | 0 / 28 |

Repeat switches in the same page: before, up to 73 ms (night) and 105 ms (noon); after, 0 at night.
`showScenery` resolves sooner: 70–170 ms, was 120–270 ms.

\* Not the ambience: the profile puts these tasks in the fauna's first sprite of a creature
(`paintBunting` in the oasis, `paintDipper` at the waterfall, ~100 ms) and the falls' `prepare`.
The ambience no longer shows in any switch profile.

## Tests
- `src/ambience/switch-parts.test.ts`: a cache hit paints nothing. After a miss the wash field
  and the plate are painted in separate idle callbacks. The sprite groups are built one per
  callback.
- `night-edge.test.ts`: one edge per seed.
- `tests/e2e/switch-light.spec.ts`: a warm switch paints no light plate, and its settled night
  frame is pixel for pixel a fresh load's. `switching` is true during the switch, and
  `lightReady` resolves when the new light takes over.

## Left open
- The fauna's first sprite of a creature on a switch (~100 ms at noon) and the waterfall's
  `prepare`: separate tasks, outside the ambience.
- On the cold path (a plate not in the cache), each part is still one task: the wash field
  ~40 ms, a plate 30–60 ms.
