# 15 — QA & docs: every rule traced to a test, a suite that holds under load

## What
- **Traceability**: `docs/TESTING.md` describes the four layers (unit, e2e via `?dev`, studio
  smoke, visual review), how to run them, and the conventions. Its requirements → tests matrix
  maps every SPEC rule (§1–§11) to unit and e2e tests and marks the gaps.
- **Gap tests**:
  - `tests/e2e/ui-start-flow.spec.ts`: an empty task becomes "Study session"; the
    slider is 10–180 in 5-min steps; the 25/50/90 picks work; the last total is remembered, also
    across a reload; plant cards show a preview, name, native name, line and habitat; locked
    cards show what they need.
  - `tests/e2e/session-rules.spec.ts`: block and session countdown; the plan line moves; an
    unwatered break ends on its own with no penalty; "Still with us?" → End session; a session
    that ended while the app was closed has bloomed on return; tapping a plant on a phone shows its
    label.
  - Studio controls (seed, play/pause, speed, background, scale).
  - Unit: finished plants sway and hold still under reduced motion (`src/plants/system.test.ts`).
    Every species has a compatible garden slot (`src/plants/plantable.test.ts`).
- **Flakiness** (root causes in TESTING.md › Flakiness, rules in ADR 0015):
  - The studio renders section by section in 4 parallel shards.
  - UI flows use the app's own reduced-motion CSS for the DOM UI.
  - Transient animations are read in-page.
  - Pixel checks pin the light.
  - Fauna loops run in-page with the renderer frozen, following creatures by id.
  - Frame waits replace the one sleep.
  - Timeouts are sized for load.
  - The stale "widget not wired" skip is gone.
  - Unit: the long fauna simulation asserts once instead of once per step, and Vitest gets a
    20 s ceiling (`vite.config.ts`).
  - Under extreme load (load average 70) the CPU-budget unit test
    `plants/system › stays within 2 ms a frame…` can still fail, because it measures wall time. CI
    runs unit tests on their own, before e2e.
- **CI**: the HTML report is always uploaded and traces are uploaded on failure. Retries happen
  in CI only (config). Pages deploys only after CI succeeded on `main`, building that commit
  (ADR 0014).
- **Docs audit**:
  - ARCHITECTURE (viewport floor, layers, events with payloads, controller return values and
    ticking, dev hooks incl. `plantsReady`/`frameStats`, ambience `onLight`/`revealLightAfter`,
    audio, studio contract; removed the non-existent `tests/visual` and the duplicate paragraph).
  - The system docs.
  - SPEC *Status* notes (plan examples, species list, title/notifications, tips one at a
    time, arrival on first sight, lotus).
  - ADR index (`docs/adr/README.md`) with status notes on 0001/0034/0054/0094; devlog index.
  - AGENTS.md (reading order, worktree workflow, pitfalls).
  - README with three screenshots in `docs/images/`.

## Why
The owner asked that every behaviour be tested and that a newcomer can pick up the work from the
docs. Under load (other agents, CI) the suite failed for test reasons, not app reasons, so a red
run carried no signal.

## Verification
Typecheck, 925 unit tests, and the 81-test e2e suite three times in a row with `E2E_PORT=4187`,
while other agents kept the machine's load average at 19–28. Stress runs with 10 workers passed after the fixes (earlier, 16
workers failed almost every UI test).

## Left / for others
- **Bug (src, plants/scene owners):** the **lotus** (`sizeClass: 'large'`) fits no water slot
  (all are medium or small), so it is offered in the sheet but cannot be planted. Fix it with a
  large water slot or a medium lotus, then remove it from `KNOWN_UNPLANTABLE` in
  `src/plants/plantable.test.ts`.
- No Firefox/WebKit e2e run (SPEC §10). The title/favicon fallback matters most there. Adding
  projects needs the PiP specs to skip outside Chromium.
- The audio is only verified as data (unit). The real PiP window is faked in e2e.
- `.gitignore` names the local tooling folder that holds the worktrees. It is functional, so it
  stays.
- No `src/` changes besides test files.
