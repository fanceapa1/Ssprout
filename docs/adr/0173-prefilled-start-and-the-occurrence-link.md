# ADR 0173 — One-tap Start: the prefilled start flow and the occurrence link

- Status: accepted
- Date: 2026-10-23

## Context
The waiting card's Start opens the existing start flow (planting sheet) prefilled with what the
schedule knows; it never starts on its own (ADR 0005). A session started from a schedule must link
back so the calendar shows that occurrence as done.

## Decision
- **Prefill** is a pure mapping, `startPrefill(occurrence)` (`core/schedule.ts`):
  `{ taskName, goalMinutes | null, planId | null, link: { scheduleId, date } }`. A length that is
  not a valid total, or a plan not recommended for the length, is left open (`null`).
  `applyPrefill(draft, prefill, recommendPlans)` (`ui/planting-sheet.ts`) writes it into the shared
  planting draft: the name always; the total only when given (otherwise the remembered last total
  stays); the plan only when given and offered for that total (otherwise the sheet's usual first
  plan). Species and spot are cleared — they are chosen now.
- The UI opens the sheet with `openPlanting(opener, prefill)`; a normal "Start studying" clears a
  leftover link and its name. Closing the sheet keeps the draft (Back works as before).
- **The link** is a note on the occurrence, not a field on the session: after `controller.start`
  succeeds, the UI calls `scheduler.link(prefill.link, newSessionId)`, which stores
  `notes[date].sessionId` (and drops a `dismissed`). The occurrence's status then follows that
  session (ADR 0172): `started` → `done` when it blooms (`state.log` has it as `completed`).
- **The limit of three** (ADR 0150): at three in progress the card does not open the sheet; it
  says so gently and offers to go to the sessions (the Study section's rows with Switch and its
  limit note). The occurrence stays due.

## Consequences
- `ActiveSession` and `SessionLogEntry` are unchanged; the session controller does not know about
  schedules. The calendar merges a linked occurrence into its session's block.
- Deleting a schedule loses the link, never the session (it stays in the log).

## Rejected
- `scheduleRef` on `ActiveSession` and `SessionLogEntry`: a contract change across the session
  controller, persistence and every fixture, for information the schedule can hold.
- Auto-starting with a guessed plant and spot: the owner chose "never auto-starts".
