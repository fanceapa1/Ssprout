# ADR 0101 — Audio gating: muted by default, gesture unlock, 2 s fades, suspend when muted

- Status: accepted; amended by ADR 0104 (user-selected overall volume scales the gated master)
- Date: 2026-10-21

## Context
SPEC §8: muted by default, setting remembered. Browsers block audio until a user gesture
(Safari requires creating/resuming the context inside the gesture handler). Sound must never
start or stop abruptly, and a muted page should cost nothing.

## Decision
- A pure state machine (`gate.ts`) over `{ muted, unlocked, disposed }`; audible only when
  unmuted **and** unlocked and not disposed. Each input yields commands for the controller.
- `unlock()` (called from a gesture) creates the AudioContext lazily and resumes it. If the
  garden is muted at that moment, the context is suspended again after the fade window —
  nothing is played, but the gesture requirement has been satisfied.
- Unmute → resume + start beds + master ramps to `MASTER_LEVEL` over `FADE_S = 2` s.
  Mute → master ramps to 0 over 2 s, scheduling stops, then the context is suspended
  (a pending suspend is cancelled by a quick unmute).
- `dispose()` closes the context and unsubscribes from the bus; later calls are no-ops.

## Consequences
Integration must call `unlock()` inside a gesture handler: the speaker toggle, and a one-time
`pointerdown`/`keydown` listener when the persisted setting is unmuted (docs/systems/audio.md).
