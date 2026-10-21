# ADR 0102 — Audio scheduling runs on the AudioContext clock; Clock only sets the hour

- Status: accepted
- Date: 2026-10-21

## Context
Project rule: time only via the injected `Clock`. But the dev clock can run 60× (`?speed=60`);
birds chirping 60× faster would be wrong, and Web Audio events must be scheduled on
`AudioContext.currentTime` anyway.

## Decision
- The planner advances by the audio clock delta (`backend.now()`), sampled by a 250 ms timer
  (injected `Timers`), and events are scheduled 120 ms ahead (`LOOKAHEAD_S`). The step is
  capped at 1 s, so after background throttling the soundscape skips rather than bursts.
- The injected `Clock` is used only for the time-of-day hour (`localHour(clock.now())`), which
  the dev clock may accelerate; `setTimeOfDay(hour)` overrides it (dev `setTime`).
- All randomness is seeded (`createGardenAudio({ seed })`, forks for planner and chimes; each
  planned event carries its own seed for its recipe).

## Consequences
Sound always runs in real time; tests drive time through a fake backend clock and manual timers.
