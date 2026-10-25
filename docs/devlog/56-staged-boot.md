# 56 — P14: boot in stages, the landscape first

The owner asked for the garden layout to be drawn first, since everything else stacks on it. Before
this task the whole startup ran as one task of about 320 ms, and nothing showed until it ended.
Plants, fauna and the ambience were set up before the landscape had started painting. On a first
visit the plants even appeared on bare paper, about 700 ms before the landscape. This task also
covers P25: open the paint cache's store at the very start of boot. ADR 0232.

**What changed:**
- **`src/main.ts`** (shared file; most of the diff moves lines):
  - `boot()` is async and runs in stages, each with a `sprout:boot:*` performance mark:
    `start` → `scene` (first task) → `ui` (after a frame) → `landscape` → `plants` → `fauna` (a
    frame and a task each) → `ambience` and `done` (last task).
  - `paintCache()` is the first call of the boot, so the store is open by the time the scene looks
    the landscape up.
  - The plant system object is made in the UI stage (the UI's hit test and placement need it) but
    is registered only after the landscape.
  - `window.sprout` is assigned in the last task with every extension, before `addAmbience`, as
    before. Fauna's debug is installed explicitly (`installFaunaDebug`) instead of from
    `createFauna`'s microtask, which would now run before `window.sprout` exists.
  - The dock (`whenGardenReady`) and the service worker (`afterPaint`) wait until every system is
    registered, then for `renderer.whenReady()`.
- **`src/ambience/sprites.ts`**: `buildSprites` returns lazy getters. Each group is painted on its
  first read, from its own fork of the seed, so the pixels do not depend on the order.
  `builtSprites()` lists the groups built so far.
- **`src/ambience/ambience.ts`**: the cast light (field and plates) is made on first use. The dew
  reads `SPRITE_VARIANTS` instead of `sprites.glints.length`. `debug().sprites` lists the built
  groups, so `sprout.ambience().sprites` does too.
- No change was needed in `src/render/renderer.ts` or `src/paint/persist.ts`. A system registered
  after `start()` is initialised at once, and its `init` joins `whenReady()`.

**Measured** with `scratchpad/perf/p14.mjs`. Production build, 1440×900 @2, new-headless
Chromium on the M3, 25 plants plus history, 1×, medians of 3 runs. The first visit has an empty
paint cache; the repeat visit reloads in the same context, so the cache hits. In ms from
navigation:

| | first visit, before | first visit, after | repeat, before | repeat, after |
|---|---|---|---|---|
| FCP | 430 | **260** | 404 | **252** |
| landscape on screen | 1653 | **1403** | 523 | **308** |
| first long task (all of the boot before) | 321 | **185** | 294 | **172** |
| main thread busy before the landscape | 1555 | 1237 | 519 | 294 |
| cache lookup | — | — | ~310 | ~110 |
| `plantsReady` | 946 | 1823 | 795 | 714 |
| `ready()` (every system) | 1653 | 1823 | 795 | 714 |
| `ui.dockReady()` | 2004 | 2143 | 1082 | 1012 |
| `window.sprout` | 352 | 1442 | 333 | 353 |

- **The first task** is now 185 ms. About 93 ms of it is the scene's synchronous sky plate
  (`scene/sky-light.ts`, owned by P18) and about 46 ms is the paper texture. Before, it also held
  the ambience engine (~118 ms: every weather sprite and the cast field) and the plant and fauna
  inits.
- **The cache lookup** takes about 110 ms instead of about 310, because the store is opened first
  and the first task is shorter.
- **Plants on a first visit** are ready later, by design: their sprites start painting in the
  workers only once the landscape is there, and they no longer show on bare paper. On a repeat
  visit they are ready earlier.
- **After the landscape**, the stacked stages take about 10–30 ms each. The ambience's first frame
  (cast field and plate, ~58 ms) and its idle prepare of the next phase (~52 ms) come after it.
- **Kept**: splitting the UI stage from the first task (FCP −170 ms) and splitting plants, fauna
  and the ambience into tasks of their own (cheap, and none of them is a long task now).

**Tests:**
- `src/ambience/lazy-sprites.test.ts` (5): no sprite or light plate when the engine is made; a
  group is built once and only when read; a night without sun weather builds the flame but no sun;
  sun weather builds the glaze. A counting fake OffscreenCanvas stands in, and the cast light is a
  stub.
- `tests/e2e/boot-order.spec.ts` (3): the marks come in stage order on a first visit and on a
  repeat visit (`cacheHits` 1). `landscape` comes before `plants`, `fauna` and `ambience`.
  `window.sprout` is assigned after the stacked systems and has the whole API a task later. No sun
  sprites are built at night until sun weather shows.
- TESTING.md rows P14.1 and P14.2. The final run of `npm run typecheck && npm test && npm run e2e`
  passed: 1547 unit tests in 129 files and 261 e2e tests.

**Docs:** ARCHITECTURE.md › Boot order (new) and the dev-hook note; docs/systems/ambience.md
(built on first use, `sprites` in `sprout.ambience()`); docs/systems/fauna.md (how main.ts installs
the fauna debug now); ADR 0232.

**Left open:**
- The sky plate (~93 ms) is the biggest part of the first task. Caching it (P18) or painting it
  in parts would bring the first task under 100 ms.
- The paper texture (~46 ms) could come from the paint cache too, or be painted after the first
  frame. The landscape needs it to look right, so it stayed in stage 1.
- Plant sprites could start painting in the workers while the landscape paints, then show only
  once it is there. That needs a plants-side "request without drawing" API or a renderer draw gate.
  It would bring a first visit's `plantsReady` back to about 1.4 s without plants on bare paper.
- The numbers are 1× on the M3. A throttled (4×) and an empty-garden pass were not repeated.
