# ADR 0153 — Automatic focus watering on the focus-time axis

- Status: accepted (implements ADR 0005 › Watering during focus)
- Date: 2026-10-23

## Context
During focus the active plant should be watered "every now and then": at random intervals of
4–10 minutes of focus time, in the garden, Your plant and the widget, with nothing to tap; never
while paused or in a break (breaks keep tap-to-water). It must be deterministic and testable.

## Decision
- **Schedule** (`core/session.ts`): `focusWateringTimes(seed, focusTotalMs)` — offsets on the
  *focused-time* axis, the first after 4–10 min and each next 4–10 min later, drawn from
  `createRng(seed).fork('focus-water')` (the session's own seed, so a reload or another device gives
  the same moments), none in the last minute of focus (the bloom comes then). Pauses and breaks do
  not advance focused time, so they never bring a watering closer.
- **State:** `ActiveSession.focusWaterings` counts the scheduled waterings already done.
  `session/focusWater { now }` (pure) raises it to `dueFocusWaterings(session, now)`.
- **Controller** (`check()`, every tick): when the active session is running and more are due than
  done, it records them all and emits **one** `session:water { blockIndex, sessionId, auto: true }`
  — but only if the current block is focus. One that came due in the very last tick of a focus
  block (seen first in the break) is recorded silently. After a long gap (a reload, a throttled
  tab) the missed ones collapse into a single watering. `nextFocusWatering()` gives the focused
  time to the next one (dev hooks, tests).
- **Presentation:** the existing listeners of `session:water` play it: the plant system's painted
  jōro over the session's own seedling, Your plant, the widget card. No notification, no tip, no
  chime; the planting tip about watering stays about breaks. A tap watering emits
  `auto: false`.

## Consequences
- An hour of focus brings 5–14 automatic waterings, typically about eight (mean interval 7 min).
- The audio has no pour sound yet: watering is silent (a soft sound when unmuted is left for the
  audio system).

## Rejected
- Wall-clock timers: would fire during pauses and drift across reloads.
- Replaying every missed watering after a gap: a burst of animations on return is the opposite
  of gentle.
