# 18 — Parallel sessions & focus watering

## What
Phase 7 (ADR 0005): up to three study sessions in progress, exactly one active, and the active
plant watered on its own every 4–10 focused minutes.

- **State** (ADR 0150): `session` stays *the active session*; a new `waiting` array holds the others,
  always paused. Start and `session/switch` pause the active one; `session/cancel` / `complete` take an
  optional `id` and leave the others alone. Slots of sessions in progress are held (no planting, no
  swap). Selectors: `inProgressSessions`, `canStartSession`, `lastLeftSession`, `heldSlotIds`,
  `MAX_SESSIONS`.
- **Session log** (ADR 0151): `state.log`, append-only history of completed and cancelled sessions
  (wall times, focused minutes, plan, plant, slot, task), with pure local-calendar queries in
  `core/session-log.ts` for the calendar task.
- **Schema v2** (ADR 0154): `migrateV1toV2` through the existing chain — the v1 session stays active
  exactly as it was, nothing waits, the log is back-filled from the finished plants. Real v1 fixtures
  in `src/core/fixtures/`.
- **Controller**: `switchTo(id)`, `cancel(id?)`, `nextFocusWatering()`; `status()` lists every session
  with its timeline (`sessions`, `canStart`, `maxSessions`). Events: `session:switch { from, to, at }`,
  `session:start { pausedId }`, `session:pause { reason: 'user' | 'switch' }`, and `sessionId` on
  block and watering events.
- **Focus watering** (ADR 0153): a seeded schedule on the focused-time axis; the tick records due
  waterings and emits one `session:water { auto: true }`, only in focus. Garden, Your plant and the
  widget already played `session:water`.
- **Garden** (ADR 0155): a seedling per session in progress, each at its own growth; waiting ones
  stand calm (no session breeze, sway × 0.6); watering goes to the session the event names.
- **Dock** (ADR 0156): the Study section lists the sessions in progress under the controls — a 64 px
  live plant on a small round-window wash, task, thin plan line, time left, Switch / Resume ("growing
  now" on the active row); "Plant another"; at three a gentle note and focus on the first Switch.
  After a bloom nothing resumes on its own: the idle line says who is waiting and the one left last
  gets a small Resume seal (ADR 0152). The pill shows "+N". One quiet `switch` tip.
- **Widget** (ADR 0157): follows the active session (it reads `status()`); the card offers Switch
  (cycling in start order) in focus/paused, and Resume when nothing is active. Title, favicon and
  notifications follow the active session with no change.
- **Dev API**: `startSessions`, `sessions`, `switchTo`, `log`, `nextFocusWatering`, `focusWater`,
  `cancel(id)`.
- `src/main.ts` is unchanged. Outside the owned paths, only test fixtures in
  `src/ambience/motes.test.ts` and `src/audio/garden-audio.test.ts` gained `focusWaterings: 0`.

## Why / decisions
- `session` + `waiting` instead of `sessions[] + activeId`: same information, but "only the active one
  runs" is structural, and the ~100 readers of `state.session` (ambience, motes, fauna, audio, widget,
  e2e) keep working — no edits in the systems the daylight agent is changing. It also makes the
  "Still with us?" rule fall out: only the active session can be paused by the gardener.
- After a bloom no session is active, rather than the last one becoming active-but-paused: the bloom
  keeps its moment in the widget, title and Your plant, and no long-pause clock starts.
- The list lives in the Study section rather than a new dock section, keeping Study | Your plant side
  by side.

## Tests
- Unit: `core/parallel`, `core/controller-parallel`, `core/focus-watering`, `core/session-log`,
  `core/migration-v2` (fixtures), updates in reducer/controller/persistence/events/tips;
  `plants/system › several sessions in progress`; `widget/view` and `widget/pip` (Switch, Resume).
- E2E: `tests/e2e/parallel-sessions.spec.ts` (8 tests): two sessions and switching with the waiting
  one's time frozen, the limit of three, after a bloom, reload, automatic watering in Your plant and the
  garden, never while paused or in a break, the widget card and the title follow the active session and
  the card switches. `smoke` expects schema 2.
- Studio (`ui-shell`): `pill-more`, `session-thumbs`, `session-rows`; `widget`: `card-switch`,
  `card-waiting`.
- Screenshots reviewed (`artifacts/shots/`): `three-1440x900`, `three-390x844` (three in progress,
  full page), `waiting-1440x900`, `waiting-390x844` (after a bloom, two waiting), `limit-390x844`
  (the note at three), the studio entries `ui-shell/session-rows` and `ui-shell/pill-more`. First
  pass had boxed Switch buttons, a stray brush rule under rows and seedlings lost in a 64 px blank;
  now quiet text buttons, no rules, a round-window wash behind each thumbnail, the list aligned with
  the plan line, a smaller suggested seal.

## Left / for others
- **Camera:** listen to `session:start` (new active plant; `pausedId` = the one left),
  `session:switch` (`from` may be null after a bloom) — glide to `plants.plantBounds(sessionId)`; also
  `session:complete`, `session:cancel`, `session:water` (`auto`).
- **Calendar:** read `store.get().log` with `entriesOnDay` / `entriesInWeek` / `entriesInMonth`,
  `groupByDay`, `focusedMinutes` (ADR 0151); sessions still growing are `inProgressSessions(state)`.
  Back-filled entries have `plan: null` and `backfilled: true`.
- **Audio:** the automatic watering is silent; a soft pour (only when unmuted) belongs in `src/audio`
  on `session:water`.
- Seedlings at low growth are tiny in the 64 px thumbnails (they are drawn at true scale); a zoomed
  thumbnail would need a crop option in `renderPlantView`.
- The `switch` tip is covered by unit tests and review, not its own e2e.
