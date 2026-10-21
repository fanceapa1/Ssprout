# ADR 0035 — Dev completion jumps the clock instead of forcing the reducer

- Status: accepted
- Date: 2026-10-21

## Context
E2E tests and screenshots need `window.sprout.completeSession()`. The reducer refuses to complete
a session before its goal (ADR 0030), so the debug API either needs a bypass or needs time to pass.

## Decision
`SpeedClock` gains `advance(ms)` (jump virtual time forward; finite, ≥ 0). `completeSession()`
resumes a paused session, advances the dev clock by the remaining time and calls
`controller.check()`. (ADR 0036 adds `toBreak()`/`skipToBlock(i)`, which jump the same way to a block start.) Everything that reads the clock (widget countdown, title, lighting) sees a
consistent world, exactly as if the time had really passed.

## Rejected
- A `force` flag on `session/complete`: a production action with a "skip the rules" switch.
- Rewriting `startedAt` via `setState`: works, but hides the real code path from e2e tests.

## Consequences
After `completeSession()` the dev clock is ahead of wall time by the jumped amount; time-of-day
lighting follows it (use `setTime` for lighting shots).
