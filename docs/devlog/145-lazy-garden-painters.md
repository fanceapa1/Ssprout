# 145 · Z7: Lazy garden painters

Phase 14, optimisation pass. ADR 0341.

## What
- **One painter chunk per garden.** Each scenery's `painters.ts` holds what only paints:
  - the landscape's steps;
  - its boulder and tuft sprites;
  - its sky plates;
  - its own marks on the light plates.

  One `lazyPainters` handle (`src/scenery/painters.ts`) sits on `Scenery.painters`, `art.painters`,
  `sky.painters` and `light.painters`. The contract keeps only data eager.
- **Moves.**
  - The Japanese garden's `gardenSteps` moved from `scene/background.ts` to
    `japanese-garden/painters.ts`.
  - Its sky and light data (`GARDEN_SKY`, `GARDEN_LIGHT_ART`) moved to `japanese-garden/art.ts`.
  - `SKY_RECT`, `SKY_SCALE`, `farRidge` and `skyShape` moved to `japanese-garden/sky.ts`.
    `paint-sky.ts` re-exports them.
  - In the oasis, `OASIS_GRADES` and `OASIS_SKY_RECT` moved to `layout.ts`. In the waterfall,
    `WATERFALL_SUN_SKY`, `WATERFALL_SKY_RECT` and `WATERFALL_SUNSET_X` moved to `layout.ts`. The
    old modules re-export them.
- **Rock and tuft sprites.** They are `GardenPainters.rock` and `tuft` now. `SceneArt.rockSprites`
  is gone, and the atlas layout uses `scene/sprite-boxes.ts`.
- **Motion** is its own chunk: `Scenery.motion()` returns a promise. The scene system guards it
  with a token across switches.
- **When the painters load.**
  - `paintScene` loads the painters itself.
  - The scene's cache lookup starts the load as soon as `PaintCache.has` reports a miss.
  - The sky and light plates start it on a lookup miss. Until the painters land, they draw a plate
    without the scenery's marks. That plate is neither kept nor stored, and it is recomposed once
    the painters are there.
- **The studio** loads every scenery's painters (top-level `await`) before it mounts its cards.
  Unit tests that paint load them in a `beforeAll`.
- **Outside the owned paths:**
  - `src/ambience/ambience.ts`: one line, the default light takes `GARDEN_PAINTERS`.
  - `src/scene/background.ts`, `sprites.ts`, `paint-sky.ts`, `src/studio/main.ts`: part of the
    contract change.

  `src/main.ts` is unchanged.

## Numbers (main @ e69c708, production build, source-map attribution)
| | before | after |
|---|---|---|
| First-view JS (everything `index.html` reaches statically) | 1,416 kB raw / 500 kB gzip, 2 files | 1,324 kB raw / 476 kB gzip, 8 modulepreloaded files |
| Scene + scenery code in it | 228 kB | 142 kB |
| Japanese garden painters | in the shared chunk | lazy, 34 kB |
| Waterfall painters / falls | in the shared chunk | lazy, 58 kB / 26 kB (19 kB of it is its `paint-water`, shared with the painters) |
| Oasis painters / motion | in the shared chunk | lazy, 19 kB / 13 kB |

A warm repeat visit to the Japanese garden (the default) loads −92.5 kB of JS (−24 kB gzip), and
none of the garden's painter chunk. A cold first visit adds the 34 kB chunk back, so it loads
−58 kB.

**Timings.** 1440×900, median of 5 runs, the load average above 30 (another agent's suites):

TIMINGS

## Why not −150 kB
The oasis's `paint-land`, `paint-water`, `paint-veg` and `paint-rocks` (about 76 kB) are still in
the first view:
- `oasis/wildlife.ts` (the fauna habitat data, kept eager) reads `WALL_FACES`, `FALLEN_STONES`,
  `NEAR_STONES`, `BASIN_STEPS`, `SLUICE_GATE`, `BIG_PALM_SHAPES` and `GROVE_PALMS` from the first
  three;
- `paint-land` and `paint-water` take `EARTH` from `paint-rocks`.

Those files belong to the paint-parts task running at the same time, so they were not edited.

## Left open
- Move the oasis's shared shapes and `EARTH` into a data module once that task lands. The oasis
  chunk would then take about 76 kB more out of the first view.
- The first view is now 8 files. A `codeSplitting` group in `vite.config.ts` could merge the small
  eager ones back, if the extra requests ever show up in a trace.
- Species painters (P16f, 433 kB) and creatures per garden (P16a′, 190 kB) are the larger shares
  left in the shared chunk.
