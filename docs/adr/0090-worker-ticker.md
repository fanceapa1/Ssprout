# ADR 0090 — Session ticks come from a dedicated Web Worker

- Status: accepted
- Date: 2026-10-22

## Context
The controller completes blocks and sessions on its tick (ADR 0032, 0036). In a background tab
Chrome throttles main-thread timers (1 s alignment at once, then intensive throttling to one wake
per minute after ~5 minutes hidden); Firefox and Safari do similar. A break, the next focus block or
completion could then be announced up to a minute late, and the notification with it (SPEC §6).

## Decision
- `createWorkerTicker()` implements the controller's `Ticker` with one dedicated worker created from
  an inline Blob URL (no extra Vite entry, works in dev, build and tests). The worker runs one
  `setInterval` per subscription id and posts `{ type: 'tick', id }`; the page forwards it to the
  subscriber. Timers in dedicated workers are not subject to the background throttling above, and
  messages from a worker wake the page's event loop.
- `createTimerSurfaces` installs it with `controller.setTicker`; `dispose()` puts an interval
  ticker back.
- Fallback to `setInterval` when `Worker`/`Blob` are missing, construction throws (e.g. CSP without
  `worker-src blob:`) or the worker reports an `error` — live subscriptions move over, `mode`
  becomes `'interval'`.
- The tick is only a wake-up: all time still comes from the `Clock`, so a late or extra tick never
  changes the maths.

## Rejected
- A `new Worker(new URL('./tick.worker.ts', import.meta.url))` module: an extra build artefact for
  ten lines of code, and harder to fake in unit tests.
- Silent audio / Web Locks keep-alive tricks: fragile, battery-hungry, against the calm product.
