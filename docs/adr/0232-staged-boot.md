# ADR 0232 — Boot in stages: the landscape first

- Status: accepted
- Date: 2026-10-25

## Context
`main.ts` set everything up in one synchronous task: the paper, the scene, plants, fauna and the
ambience were registered before `renderer.start()`, so all their `init`s ran in that same task. The
UI, the timer surfaces and the dev API came after them. Measured on the production build (1440×900
@2, 25 plants, 1×), this first task took 320–350 ms. About 120 ms of it was the ambience engine
building every weather sprite, the sun's two glaze sprites among them (~50 ms), even at night, plus
the cast-light field. Nothing showed until the task ended.

On a first visit the plants also appeared on bare paper: their sprites came from the workers
(~950 ms) long before the landscape had painted (~1650 ms). The owner asked for the garden layout to
be drawn first, because everything else stacks on it and makes no sense without it.

On a repeat visit the landscape comes from the paint cache (ADR 0228). The cache's IndexedDB store
was opened inside that long task, so it could only answer after it, and the lookup took about
300 ms.

## Decision
- **`boot()` is async and runs in stages**, each marked with `performance.mark('sprout:boot:<stage>')`:
  1. `start`: the paint cache's store is opened first (`paintCache()`). Then state, store and
     controller, the renderer, the paper and scene systems, `renderer.start()`. The scene's
     `init` looks the landscape up in the cache or starts painting it. → `scene`
  2. After a frame and a task (`afterPaint`: `requestAnimationFrame` then `setTimeout 0`, or a
     100 ms timer when frames stall, as in a background tab): the plant system object (not yet
     registered), the timer surfaces, the service worker registration, the scheduler, audio and
     the UI. → `ui`
  3. Once the landscape is ready (the `renderer.whenReady()` taken after stage 1: paper and
     scene) → `landscape`. Then, each after a frame and a task: `renderer.add(plants)` →
     `plants`, `createFauna` → `fauna`.
  4. In one last task: `window.sprout` with every extension, then `addAmbience` → `ambience`,
     the light reveal → `done`.
- **The dev API appears whole.** `window.sprout` is assigned in the last task, after every system
  is registered and in the same task as all its extensions. Fauna's debug is now installed
  explicitly (`installFaunaDebug`), not from a microtask after `createFauna`. `sprout.ready()`,
  `plantsReady()` and `ui.dockReady()` keep their meaning.
- **"The garden is ready" waits for every system.** The dock (`whenGardenReady`, ADR 0225) and
  the service worker (ADR 0230) wait for a promise that resolves after the last stage has
  registered every system, followed by `renderer.whenReady()`. That is what they waited for
  before.
- **The ambience builds on first use.** `buildSprites` returns an object whose groups (sun,
  rain, ripples, glints, leaf glints, motes, mist, flame) are painted the first time a frame reads
  them. Each group draws from its own fork of the seed, so the pixels do not depend on the order.
  A night without sun weather never paints the sun. The cast-light field and plates are made on
  the first frame that lights the garden, not in `init`. `sprout.ambience().sprites` lists the
  groups built so far.

## Consequences
- The first task is 185 ms instead of 321 ms. What remains is the scene's sky plate (~93 ms,
  `scene/sky-light.ts`, P18) and the paper texture (~46 ms). FCP comes at 260 ms instead of 430 ms.
  The landscape shows at 1403 ms instead of 1653 ms on a first visit, and at 308 ms instead of
  523 ms on a repeat visit (the lookup now takes about 100 ms, not 300). Numbers are in devlog 56.
- On a first visit plants, fauna and the ambience start only once the landscape is painted. Their
  sprites are therefore ready later (`plantsReady` 946 → 1823 ms with 25 plants), but they never
  show on bare paper. On a repeat visit `plantsReady` is earlier (795 → 714 ms).
- `window.sprout` appears later on a first visit (after the landscape, about 1.4 s at 1440×900).
  Specs already wait for it and then for `sprout.ready()`, which includes the landscape.
- An error thrown during boot is now an unhandled rejection instead of an uncaught exception.
  Playwright reports both as page errors.
- Rejected: registering every system up front and hiding them until the landscape is ready. This
  starts the plant workers earlier, but it needs a draw gate in the renderer or in every system.
  The init work would also stay in the first task.
