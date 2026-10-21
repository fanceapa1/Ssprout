# ADR 0036 — Plan-based sessions in core: plan position, live growth, block events

- Status: accepted (implements ADR 0003; supersedes ADR 0031, amends ADRs 0030 and 0032)
- Date: 2026-10-22

## Context
ADR 0003 moved the plant choice to the start of a session and added study plans whose breaks
are watering moments. Core needs one time model that the garden, the UI and the floating widget
all read the same way, and events the UI/widget can notify on.

## Decision
- **Plans** (`core/plans.ts`): `recommendPlans(total)` is a fixed set of recipes with total-minute
  windows — `unbroken` (always, first), `pomodoro` (~25/5, from 30 min), `long-focus` (~50/10, from
  60), `deep-work` (long block · 15 · shorter block, 75–115), `two-deep` (two halves around 20, from
  120). Focus time is split on the 5-minute grid (larger blocks first). Every plan sums exactly to
  the total, starts and ends with focus, and a recipe that duplicates another's shape is dropped.
  Below 30 min only Unbroken; otherwise 2–4 plans.
- **Two time axes** (`core/session.ts`): *session time* = wall time minus pauses; *plan position* =
  session time + `skippedMs`, capped at the total. Blocks, growth (`focusDone ÷ focusTotal`),
  progress and completion are all measured on the plan position, so a skipped break simply moves
  the position forward and the session ends that much sooner. `sessionTimeline(s, now)` is the one
  read model; a block boundary belongs to the next block.
- **The plant id is the session id**; `session/complete` needs no extra payload. The displaced plant
  (`displacedPlantId`, computed by the reducer from the slot at start) stays in `plants` during the
  session (the renderer fades it), returns untouched on cancel, and is pressed on completion. Any
  other plant that ended up in the slot is pressed too, keeping one plant per slot.
- `session/start` validates the plan against the total (`planProblem`), and — with a world — the
  species' tier against `tierForMinutes(total)` and the slot's habitat/size.
- `session/water` must name the *current* break (so a stale tap after the break ended is a no-op);
  watering is optional and changes nothing about the outcome. `session/skipBreak` adds the current
  break's remainder to `skippedMs`.
- `stats.totalMinutes` counts **focused** minutes; `PlantInstance.sessionMinutes` keeps the total
  (the tier basis).
- `PressedFlower` gains `taskName` so the herbarium can show what the plant was for.
- **Block events**: the controller remembers the last block it announced per session and, on each
  tick, emits `session:break` / `session:focus` for the *current* block only when it changed. Block 0
  is covered by `session:start`. After a reload the current block is announced once (unless it is
  block 0); blocks passed while throttled or closed are never replayed.
- Completion emits `plant:swapped` (per pressed plant), then `plant:placed`, then `session:complete`.
- Validation (ADR 0034) keeps "lenient on absence": a plant without `taskName`/`completedAt` gets
  "Study session"/`plantedAt`; a session without `skippedMs`/`waterings`/`displacedPlantId` gets
  0/[]/null. A leftover `pendingReward` key is dropped. Schema stays `version: 1` (ADR 0003).

## Rejected
- Storing the current block index in state: derivable from time; storing it would need a tick to
  keep it right and could disagree after a reload.
- Making skipped breaks shrink the plan (rewriting blocks): loses the record of the planned shape the
  widget draws.
- Penalising unwatered breaks: against the product's tone (ADR 0003).
