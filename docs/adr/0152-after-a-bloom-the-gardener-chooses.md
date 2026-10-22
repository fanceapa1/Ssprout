# ADR 0152 — After a bloom or an end, nothing resumes on its own; the dock offers the last one left

- Status: accepted
- Date: 2026-10-23

## Context
With other sessions waiting, the active one can complete (or be ended). ADR 0005 and the phase 7
brief: the others stay paused; do not auto-resume another, let the gardener choose.

## Decision
- Completing or cancelling the active session leaves **no active session** (`session: null`); the
  waiting ones keep their pause. The garden is calm (`phase: 'idle'`): the bloom has its moment —
  the quiet line, the chime, the widget's and tab's "Bloomed", Your plant showing the new bloom.
- **The dock suggests** the waiting session left most recently (`lastLeftSession`,
  `status().sessions[i].lastLeft`): in the Study section's list its row carries the seal-styled
  **Resume** (the others a quiet **Resume**), and the idle line reads "Two sessions are waiting
  for you." No timers, no guilt copy. Resume calls `switchTo(id)`.
- Tab title and favicon follow the active session only, so with none active they rest (or show
  "Bloomed" until seen).

## Consequences
- Starting another session from this state is allowed (fewer than three in progress).
- The camera task can listen to `session:switch` (`from: null` here) to glide to the resumed plant.

## Rejected
- Making the last-left session active but still paused: the pill, widget and title would jump to
  "Paused" at the very moment the plant blooms, and its long-pause clock would already be running.
