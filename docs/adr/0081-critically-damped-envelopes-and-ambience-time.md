# ADR 0081 — Critically damped envelopes and "ambience time"

- Status: accepted
- Date: 2026-10-22

## Context
SPEC: breaks soften the weather, a pause fades to stillness ("a held breath", ~3 s, not abrupt),
session start/end crossfade in 3–5 s. Linear ramps start and stop with a visible kink; exponential
easing jumps at the start. Screenshots and e2e freeze the renderer (dt = 0), so transitions must be
skippable.

## Decision
- One channel per weather plus `motes`, `motion` (animation speed) and `boost` (wind). Targets are a
  pure function of phase and weather (`targetsFor`): focus 1, break 0.55, paused 0.3 with motion 0.
- Each channel follows a **critically damped spring**, solved exactly per step (frame-rate independent,
  no overshoot from rest, zero initial slope). Settle times: 4 s weather, 3 s motion and motes.
- Particles advance on ambience time `dt × motion`: pausing slows rain, mist drift and breathing to a
  stop together instead of freezing them.
- On load, on `setWeather` previews and on `settleAmbience()` the envelope snaps to its targets and
  the particle sim is pre-run (12 s) so the first frame is already at steady state.

## Consequences
Envelopes are unit-tested without a canvas. A reload mid-session shows the weather immediately
(no fade-in), which is the calmer behaviour for a page you return to.
