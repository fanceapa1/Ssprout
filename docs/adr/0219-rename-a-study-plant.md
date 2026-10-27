# ADR 0219 — Rename a study plant

- Status: accepted
- Date: 2026-10-25

## Context
The gardener wants to rename a plant (its study session) after planting it.

## Decision
Offer Rename in the plant card for both seedlings and finished garden plants, editing the
existing task name rather than the species name. Use an inline labelled field with Save / Cancel,
Enter to save and Escape to cancel. Progress updates leave drafts alone; closing or switching
cards discards them. Follow the existing 40-character normalization and blank-name default.
The field is the planting sheet's italic ink line, not a boxed form field, so it reads as
writing on the card's paper; in a card that scrolls inside, the whole form is scrolled into view.

Rename is also placed beside the active session name in the Study panel. A control confined to
the plant card was too difficult to discover, especially for a newly planted seedling. The Study
editor uses the same controller and name rules, keeps drafts through ticks, and discards a draft
if the active session changes or ends. The plant card remains available for waiting and completed plants.

The UI calls `controller.rename(id, taskName)`, which dispatches `session/rename`. The reducer
updates the active or waiting session, or the finished plant, and its matching log entry. All
other session and plant data stay unchanged. Unknown ids and unchanged names are no-ops.
The existing persistence saves the updated fields; no schema migration is needed. Later bloom
and pressing carry the edited name forward. Pressed flowers have no card or stable session id
and are outside this edit flow.

## Consequences
The card, session controls, widget and calendar read the current task name through existing
store subscriptions. `core/rename.test.ts` covers state, history, normalization, lifecycle and
persistence; `rename.spec.ts` covers desktop and phone Save / Cancel / Escape, draft stability
across ticks, and reloading.
