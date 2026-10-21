# ADR 0011 — Store: tiny synchronous store with queued re-entrant dispatch

- Status: accepted
- Date: 2026-10-21

## Context
State is a single serialisable `GardenState` changed by pure reducers. UI, systems and
persistence all need change notifications. No framework is used.

## Decision
`createStore(initial, reducer, onChange?)` in `src/core/state.ts` →
`{ get, dispatch, subscribe }`.
- Reducers must be pure; **all impure inputs are in the action** (`now`, ids, seeds, weather,
  reward options), so the same action sequence always yields the same state.
- Returning the same reference means "no change": no `onChange`, no subscriber calls.
- `onChange(next, prev, action)` runs before subscribers and is the persistence hook.
- Subscribers get `(next, prev, action)` so they can diff cheaply.
- A dispatch issued from inside a listener is **queued** and applied after the current change
  has reached every listener — listeners never observe states out of order, and there is no
  nested reducer execution.
- If a reducer throws, the error propagates to the caller and the queue is cleared; the store
  stays usable.

## Rejected
- Event-sourced log or immer-style drafts: unnecessary weight for a few dozen actions.
- Emitting domain events from the store: events stay on the separate typed `EventBus`, emitted
  by the controller code that dispatches, so the store remains generic and testable.
