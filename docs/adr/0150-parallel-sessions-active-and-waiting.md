# ADR 0150 — Parallel sessions: one active session and up to two waiting

- Status: accepted (implements ADR 0005 › Parallel sessions; amends ADRs 0032, 0036); amended by ADR 0205
- Date: 2026-10-23

## Context
ADR 0005: up to three study sessions in progress, exactly one active; switching pauses the one
left; paused time never counts; each session keeps its own spot. Until now `GardenState.session`
held the one session, and about a hundred readers — the ambience, motes, fauna, audio, plants, the
widget, the UI, e2e specs — read "the session" from it. The brief suggested "a collection plus an
active id".

## Decision
- **State shape:** `session: ActiveSession | null` keeps its meaning — *the active session*, the
  one the timer, weather, motes, audio and widget follow — and a new `waiting: ActiveSession[]`
  holds the other sessions in progress, all paused, in the order they were left. Together they are
  the collection; the active id is `session?.id`. Selectors in `core/state.ts`:
  `inProgressSessions(state)` (oldest start first), `canStartSession`, `lastLeftSession`,
  `heldSlotIds`, `MAX_SESSIONS = 3`.
  - Chosen over `sessions[] + activeId` because the invariant "only the active session can run"
    is then structural (a waiting session is paused by construction, checked on load), every
    existing reader keeps working unchanged (no edits in the ambience/fauna/audio systems another
    agent is changing), and "is there an active session" stays `state.session !== null`.
- **Reducers** (pure, every input in the action):
  - `session/start` refuses at three in progress and in a slot held by another session; the
    active session (if any) moves to `waiting`, paused at `now` (one already paused keeps its own
    pause start).
  - `session/switch { id, now }` resumes a waiting session (its paused span goes into
    `pausedTotalMs`, so the waiting time never counts) and moves the active one, paused, to
    `waiting`.
  - `session/cancel` and `session/complete` take an optional `id` (default: the active session)
    and touch nothing else. Pause, resume, water, skip break and the automatic watering act on the
    active session only.
- **"Still with us?"** follows from the shape: only the active session can be paused by the
  gardener; a session left for another one waits in `waiting` and is resumed by `switchTo`, so it
  never shows as a long pause. No `pausedBy` field is needed.
- **Placement:** the slots of sessions in progress are *held* — `compatibleSlots(…, held)` leaves
  them out (not even as a swap) and `session/start` rejects them. A finished plant is still a swap.
- **Ids** are unique across the active and waiting sessions, finished plants and the log.
- **Controller:** `start` (now allowed while others are in progress), `switchTo(id)`, `cancel(id?)`;
  `status()` adds `sessions` (each with its timeline, `active`, `running`, `pausedForMs`, `lastLeft`),
  `canStart`, `maxSessions`. It ticks only while an active session exists (waiting ones need no
  ticks). Block announcements follow the active session; switching into a session does not
  re-announce its current block.
- **Events:** `session:start` carries `pausedId` (the session that now waits); a session left by a
  start or a switch emits `session:pause` with `reason: 'switch'` (the gardener's own pause:
  `'user'`); `switchTo` emits `session:pause` (if the left one was running), `session:resume`, then
  the new `session:switch { from, to, at }`. Block and watering events carry `sessionId`.

## Consequences
- A completed or cancelled active session leaves no active session (ADR 0152).
- Persisted schema v2 (ADR 0154). The plant system draws every in-progress seedling (ADR 0155).

## Rejected
- `sessions[] + activeId`: equivalent information, but every reader of "the session" would need a
  selector and a waiting session could be stored running.
- Auto-pausing on switch with a separate "switch" pause type in each session (`pausedBy`): the
  shape already tells the two apart.
