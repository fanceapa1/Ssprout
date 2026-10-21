# ADR 0002 — A pending reward must be planted or let go before a new session

- Status: superseded by ADR 0003
- Date: 2026-10-21
- Decided by: orchestrator

## Context
"Plant later" keeps a reward pending. The core reducer refuses `session/start` while a
reward is pending, so the gardener cannot study again until they place or discard it.
Alternative: a queue of pending rewards ("seed pouch").

## Decision
Keep a single pending reward and block starting. The UI makes this gentle rather than a dead
end: the idle timer panel shows a small seed-packet affordance ("A seedling is waiting") that
reopens the picker/placement, plus a confirmed "let it go" option.

## Consequences
- Simpler state and tests, no unbounded backlog of unplanted rewards.
- Planting stays a deliberate, savoured moment between sessions, matching the product's calm tone.
- If users find it blocking, switching to a queue is a contained change (`pendingReward` →
  `pendingRewards[]` + migration v1→v2).
