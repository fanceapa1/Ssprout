# 46 — P6: scene paint steps in parts

The P0a profile ("[High] 2", "[High] 4", task A6) found the cooperative scene painter yielding
only between steps. Some steps were 70–175 ms each: the boulders, the meadow, the big tree, the
banks, the pavilion. They became long tasks at load and in the detail repaint after the camera
rests (ADR 0163).

**What changed** (ADR 0226):
- `paint-land.ts`: `Strokes`, the generator type of a step painted in parts. `paintSky`,
  `paintHills`, `paintBanks`, `paintPath`, `paintStones`, `paintTufts` yield after each painter
  call. `paintMargins` yields after its field grid and its fill, before the drying pass.
- `paint-trees.ts`: `paintTree` (and its `barkDetail`) and `paintShrub` yield after each stroke,
  ink line, dry-brush mark and foliage clump.
- `paint-ground.ts`: the meadow's patches and grass yield after each row of cells. The wet layer
  stays open between rows and is dried once, as before.
- `paint-pond.ts`: reflections yield after each tree, after drying and after each lifted stroke.
  The water detail yields after each mark.
- `paint-pavilion.ts`: yields after each of its ~35 marks.
- `sprites.ts`: `paintRockSprite` is a generator that yields after the contact shadow, the stone
  and each base tuft, and returns the sprite.
- `background.ts`: `PaintStep.run` may return `Strokes`. `paintJob` yields after every part and
  times them: `StepTiming` has `ms`, `longestMs` and `parts`, and `PaintResult` has `longest`. The
  sprites' timing counts painting only. It used to include the time yielded between boulders, so
  P0a's "sprites 157 ms" was partly wall time.
- `system.ts`: `sceneStats().longest` and `sceneDetail().longest`. No scheduler change:
  `paintScene` already checked the slice after every `next()`.

**Parity first.** `paint-record.ts` is a test-only recording `OffscreenCanvas`. It folds every
context call and property set, with exact arguments, into one hash. Pixel reads return a pattern
seeded by that hash, so the drying passes run on varied data, and their output is hashed too.
The hashes of the overview (scale 0.6) and two close views (2.8: the near meadow and big boulder,
the big tree's trunk) were pinned against the old code first (commit "pin the scene painting's
canvas calls"). They are unchanged after the split. In Chromium (Vite dev server, the job driven
part by part) the painted canvas and all 17 sprites hash identically before and after: load view
`1407a362`, close views `41476053` and `49a1b497`.

**Measured** (Chromium, 1440×900 @2, `paintJob` driven a part at a time, old and new modules
interleaved in one page, three runs each; the machine was shared, load average 9–10, so absolute
ms are ~1.7× P0a's). Longest uninterrupted part, before → after:
| view | before | after |
|---|---|---|
| load (world @1.5) | 192–233 ms (meadow; big tree 175–228; banks 134–170; pavilion 109–118) | 103–128 ms (meadow drying pass); water 55–68, grass 40–48, sky/banks ≤ 34 |
| close view: near meadow, big boulder (@2.8) | 109–121 ms (banks); tree 77–98; water 77–92 | 84–100 ms (`waterBody`); meadow 41–50; boulders 34–42 |
| close view: big tree trunk (@2.8) | 305–346 ms (big tree) | 34–38 ms (a boulder's stone) |
CPU per paint is unchanged: load 1.43–1.85 s → 1.37–1.64 s, close views ~1.0–1.2 s both.

In the app (production build, `sceneStats().longest` / `sceneDetail().longest`, load average
~17): at 1× the longest part at load is the meadow's drying pass at 134–139 ms, and in the detail
repaint after a zoom-3 rest it is the water at 88–98 ms. At 4× those are 278–280 ms and 170 ms.
The other heavy steps run in parts of a few ms each.

**Tests:** `scene/paint-slices.test.ts` (6): pinned call hashes for three views; per view, no part
does more than 320 k canvas calls or 0.9 Mpx of pixel passes (the old code fails both: meadow 1.3 M
calls, big tree 5.1 Mpx, banks 0.81 M); the heavy steps come in parts; `paintScene` yields between
the parts of a step (fake clock). `tests/e2e/scene.spec.ts` › paints in short parts: tree, pavilion,
stones, banks and meadow come in parts, and the tree's, pavilion's and stones' longest part is under
half the step; the detail repaint reports its longest part. TESTING row P6.1. The full run passed:
typecheck, 1418 unit tests, 235 e2e tests.

**Left open**
- **The engine calls that can't pause** are now the long parts: the meadow's and grass's drying
  passes (one wet layer over the whole visible meadow), the margins' drying pass, the pond's
  `waterBody`, the sky and bank `wetInWet` washes and a boulder's `stone`. They are 40–130 ms at
  1× on a busy machine. All are in `src/paint` (`WetLayer.dry`: `getImageData` → `dryPixels` with
  its edge blur → `putImageData` → `drawImage`; `recipes.ts`), outside this task's paths. Drying in
  row bands as a generator (`dryPixels`' passes are row loops over one buffer), and recipes that
  yield between their layers, would take them under ~20 ms with the same pixels. Suggested as the
  next task. A worker (A8) would take all of it off the main thread.
- Not re-measured with P0a's `flow.mjs` (frames after the Begin rest at 4×). The machine was at
  load average 9–17 during this task, so frame numbers would not compare with P0a's. The detail
  repaint's longest part is now the water's 85–100 ms (1×, loaded) instead of the big tree or banks,
  so frames after rest should improve, but not to ~33 ms until the engine calls are split.
- Probe scripts (not in the repo): `scratchpad/perf/p6-probe.mjs`, `p6-ab.mjs` (old vs new from a
  copy of the old `src/scene`) and `p6-app.mjs` (the app's `longest` at 1×/4×).
