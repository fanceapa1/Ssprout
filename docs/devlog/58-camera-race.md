# 58 — P26: camera glides read from a log, not caught mid-flight

`camera › a session start glides the camera onto its seedling, a little off-centre` failed in 3
full runs this week at load average 20–50 (`gliding` false right after the start), and once
`camera › switching sessions glides…` found the camera's `target` null right after the switch.
Both passed every time alone.

**Cause (test, not app):** the start (or the switch) and the read of `camera.state()` were two
`page.evaluate` round trips. `stage-camera` starts the glide synchronously inside `start()` /
`switchTo()`, and a glide lasts 0.75–1.9 s of frames (`dt` clamped to 0.1 s). A loaded machine
spent that between the two round trips, so the glide had already ended. With a 2.5 s wait put
between the two round trips (a local copy, not committed) both old tests failed every time, with
the same messages as in the full runs; the new ones passed.

**What changed:**
- **`src/dev/camera-debug.ts`:** `sprout.camera.glides()` and `clearGlides()`. `recordGlides(cam)`
  subscribes to the camera's existing `onChange` and keeps the last 20 animated glides, one record
  each when it starts: `{ reason, from, target, startedAt, endedAt, end }`. A glide is announced
  before its first step, so `from` is where it left. `end` is `arrived` (reached its target, by
  frames or by `settle()`), `interrupted` (stopped short) or `replaced` (another glide took over).
  Cuts, reduced motion and gestures are not glides and are not logged. Clearing the log keeps
  following a glide under way, so it does not come back as a new one. No change to
  `src/render/camera.ts`.
- **`tests/e2e/camera.spec.ts`:**
  - *A session start glides…:* clears the log, starts, and reads the log in one task. Exactly one
    glide, reason `session`, from zoom 1 (the overview), target zoom > 1.5. After `settle()` the
    same glide `arrived` and the pose is its target (zoom, x, y). The seedling checks are as before.
    After zooming out, 5 minutes pass with no glide logged at all (was: the view is still the
    overview).
  - *Switching sessions glides…:* clears the log, switches, and reads the log in one task. Exactly
    one glide, reason `switch`, from the second seedling's zoom, to a different pose. After
    `settle()` it `arrived`, the pose is its target, and the first seedling is in view.
- **Other specs:** nothing else reads `gliding` or `target` mid-flight. `close-view.spec.ts` only
  cuts (`animate: false`) and settles. The `reason` reads in `camera.spec.ts` and
  `v2-acceptance.spec.ts` are safe because `reason` keeps its value after the glide ends. The frame
  cost test waits for `!gliding`. The reduced-motion test reads right after a cut, which is
  synchronous.
- **Docs:** TESTING.md (the convention under "Sample transient animations inside the page", a
  P26 row in the flakiness section, the 12a.7 matrix row), docs/systems/camera.md (Dev API, Tests),
  ARCHITECTURE › Dev/test hooks. No ADR: no product decision.

**Tests:**
- Unit: `src/dev/camera-debug.test.ts` (4 tests). A glide is logged as it starts and is closed on
  arrival; `settle()` counts as arrived, `interrupt()` as interrupted, a new glide as replaced;
  cuts, reduced motion and gestures log nothing; clearing, the cap of 20, and copies.
- Fault injection: a 2.5 s wait between the action and the read fails both old tests (`gliding`
  false; `target` null) and passes both new ones.
- Stress, with CPU throttling ×4 in every page (a local fixture switch, not committed), niced:
  - `camera.spec.ts` + `close-view.spec.ts`, `--repeat-each=5`, 2 workers, while another agent's
    suite also ran (load average 11–29): stopped after 50 of 95 to spare the CPU. Every test it
    reached passed (start 3/3, switch 3/3, close-view 6/6) except `cost at rest` (0/2, see Left open).
  - The glide tests (start, switch, click a plant, placement, close views painted in detail) and
    `close-view.spec.ts`, `--repeat-each=5`, 1 worker: **40/40 passed** (start 5/5, switch 5/5).
- Full suite (niced, 2 workers, no throttling): typecheck clean, unit 1551/1551 (130 files),
  e2e 261/261.

**Left open:**
- `camera · cost at rest › a close view at rest costs about what the overview costs` timed out
  (60 s) under CPU throttling ×4 in both stress rounds it reached. It waits for 40 frames twice
  per view, and throttled frames are slow. It is a cost budget, not a race. It passes without
  throttling.
- The throttle switch used for the stress runs (`E2E_THROTTLE`, CDP
  `Emulation.setCPUThrottlingRate` in the fixture) stayed local. If load runs become routine, it
  could be a documented fixture option.
