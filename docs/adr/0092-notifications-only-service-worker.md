# ADR 0092 — A notifications-only service worker

- Status: accepted; amended by ADR 0229 (the build writes a precache list and version into it); amended by ADR 0230 (it now precaches the build and has a fetch handler)
- Date: 2026-10-22

## Context
`new Notification()` throws on Android Chrome and is less reliable than
`ServiceWorkerRegistration.showNotification`; a click on a page notification also cannot reopen
the app once the tab is gone. There is no server (SPEC non-goals), so no push.

## Decision
- `public/sw.js` (served at `${BASE_URL}sw.js`, scope `BASE_URL`): `install` → `skipWaiting`,
  `activate` → `clients.claim`, `notificationclick` → close, focus an open app window (same path as
  the notification's `data.url` preferred) or `openWindow` the app. **No fetch handler, no
  caching** — it can never serve stale app code.
- Registered lazily, only once permission is `granted` (no SW for people who never allowed
  notifications). `show()` waits up to 4 s for an active worker, then falls back to
  `new Notification` (with an `onclick` that focuses the page).
- Plain JS in `public/` (not bundled): it must live at a stable URL at the base path.

## Consequences
Offline support, if ever wanted, needs a separate decision (cache versioning). The SW only wakes
for notification clicks.
