# 36 — Q15: audio follows the active session

## What
The garden soundscape's weather bed and session activity now follow the **active** session
(SPEC §2 › Parallel sessions, ADR 0150). This fixes bug 1 from devlog 35:
- there was no `session:switch` handler, so the weather kept the session started last;
- `session:cancel` / `session:complete` cleared weather and activity whichever session ended, so
  ending a *waiting* session silenced the active one.

`src/audio/garden-audio.ts` no longer tracks event order or payloads. On `session:start`, `pause`,
`resume`, `switch`, `cancel` and `complete` it re-reads `getState().session` and takes the weather
and activity from it (nothing active: a clear, idle garden). The session controller always emits
after the store changed, so the state is the truth at that moment. Cancelling a waiting session
gives the same mix, and the `sameMix` check drops it, so nothing is re-applied. Muted by default,
the gate and the 1.5 s mix fades are unchanged; complete still plays the phrase.

## Tests
`garden-audio.test.ts` drives the audio through the **real** session controller and store (fake
backend, manual timers), so events arrive in the app's order. A helper pins each session's weather
with a `state/replace`. Cases: a switch between sessions with different weather (and a switch from
nothing active), cancelling a waiting session (also while the active one is paused, with no mix
re-applied), cancelling or completing the active one with others waiting (clear and idle, with the
phrase), pause/resume (also across a switch), muted by default with a fade-in on the current state,
and waiting-only state at load. On the old code, 6 of these fail. TESTING rows 2.25, 2.28, 2.29
and 2.36 list them.

## Docs
`docs/systems/audio.md` (the follow-the-active table and the known gap removed), the SPEC §2 status
note removed, and SPEC §8 says rain is the active session's weather.

## Left
- `state/replace` (import) and `state/reset` emit no session event, so the bed changes only on the
  next session event (as before; noted in the system doc).
- No e2e: audio stays data-only (TESTING › 8.1); the full suite passes unchanged.
