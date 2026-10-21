# ADR 0032 — The session controller is the single UI-facing API

- Status: accepted; API revised by ADR 0036 (start with plan/species/slot, water, skipBreak, block events; no choose/place/offer)
- Date: 2026-10-21

## Context
Reducers are pure (ADR 0011), so something must supply time, ids, seeds, weather and offers,
decide when a session completes, and announce events. The UI, the floating widget and dev tools
all drive the same flows; if each dispatched actions directly they would each re-implement id
generation, offer generation and event emission.

## Decision
`createSessionController({ store, clock, bus, species, slots?, ticker?, seed? })` in
`src/core/controller.ts` (no DOM) is the only thing in the app that dispatches session, reward and
placement actions. It:
- turns intents into actions (`start`, `pause`, `resume`, `cancel`, `choose`, `place`, `discard`,
  `retireTip`, `updateSettings`, `announceFauna`) and returns a result (`null`/`false` = nothing
  happened), emitting the matching bus event only when the state changed;
- ticks through an injectable `Ticker = { start(tick): stop }` (default `setInterval` 1 s; the
  widget task can pass a Web Worker ticker via `setTicker`), **only while a session exists**;
- calls `check()` at creation, so a session that finished while the app was closed completes on
  boot, stamped with the real completion moment (`completionTime`), and the reward waits;
- draws every random input from one seeded rng (`setSeed` for tests and `?dev`);
- subscribes to the store and dispatches automatic tip retirements (`tipsRetiredBy`) for any
  applied action, whoever dispatched it;
- exposes read helpers for the UI: `status()` (phase, remaining, progress, long pause),
  `onTick(fn)`, `offer()`, `placementOptions()`.

`plant:swapped` is emitted before `plant:placed`, so removal handlers run before bloom handlers.

## Rejected
- A tick bus event: not in the `EventMap` contract and only the UI needs it; `onTick` keeps the
  bus for domain events.
- Completing inside the reducer when `now` passes the goal: the reducer would have to generate
  the offer, which needs randomness and the species list.
