# 181: The stray sky timer

## What
CI on `main` failed its unit step although every test passed: Vitest reported an unhandled
`makeCanvas: no OffscreenCanvas or document available` from `scene-cache.test.ts`, and Pages did not deploy.

## Why
`update()` in `src/scene/system.ts` queues `whenIdle(() => sky.prepare([next]))` to paint the coming
phase's sky. Outside a browser `whenIdle` is a 1.5 s timer. A close-view test never disposed its
system, so the timer fired after the test's canvas environment was removed, and Vitest fails a run on
an unhandled error. It is a race (the test file finishes before or after the timer), so most runs passed.

## Fix
- `system.ts` (2 lines): the idle callback prepares only if the sky is still the one it was queued
  for, and `dispose()` drops the sky. A switch to another scenery already did.
- `scene-cache.test.ts`: the close-view test disposes its system; a new test (fake timers) disposes a
  system after an update and counts the canvases made when the timers run: 2 before the fix, 0 after.

## Checked
Twenty runs of `scene-cache.test.ts`: see the results in the commit message of the task's report.
The extend timer already checks `current`, which `dispose()` clears.

## Left open
`sky-light.ts` queues one more idle paint (a plate whose cache lookup missed, after the painters
load). It has no dispose of its own and is not reachable after the system drops its sky in the
ordinary flow; left alone to keep the change small.
