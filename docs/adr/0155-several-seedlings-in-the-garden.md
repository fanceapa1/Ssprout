# ADR 0155 — Several seedlings in the garden; the waiting ones stand calm

- Status: accepted (amends ADRs 0114, 0115)
- Date: 2026-10-23

## Context
With parallel sessions (ADR 0150) up to three seedlings grow in the garden at once, each at its own
growth. Only the active one is being studied for; the others are paused and should look it.

## Decision
- The plant system keeps one growing record per session in progress (`inProgressSessions(state)`),
  keyed by session id, each at `sessionTimeline(session, now).growth` (eased, snapped on `dt = 0`).
  After a reload every seedling appears at its own growth; a new session's seedling grows in from
  seed.
- A **waiting** seedling is calm: no session wind boost and its sway scaled by `CALM_SWAY = 0.6`
  (a plant at rest sways at 1). Its growth holds because its session is paused. Nothing else marks
  it — no dimming or label in the painting; the dock and the pill say which sessions wait.
- Only the active seedling asks for the growth steps ahead (`next`, `ahead`); waiting ones keep
  their two current steps.
- Every in-progress session's displaced plant stays aside; on a cancel of any session its seedling
  withers and its displaced plant returns; a completion blooms that seedling in place.
- `session:water` waters the seedling of the session it names (`sessionId`; the active one when
  absent); one watering animation plays at a time.
- `debugState().growing` stays the active seedling (existing tests and tools); `seedlings` lists all.

## Consequences
- Frame cost grows by at most two more cached-sprite draws (no painting in a frame).
- The camera task can use `plants.plantBounds(sessionId)` for any seedling.
