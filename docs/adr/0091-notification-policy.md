# ADR 0091 — When to ask for notification permission and when to notify

- Status: accepted
- Date: 2026-10-22

## Context
SPEC §2 / §6: the first start asks gently for permission; breaks, the next focus block and
completion notify, also with the tab in the background. Browsers require the permission request
inside a user gesture (Safari and Firefox strictly), and repeated prompts get auto-blocked.
Notifications on top of a page the user is looking at would be noise.

## Decision
- **Ask** at the first `session:start` when `settings.notifications === 'unasked'` and the browser
  permission is `default`. `controller.start()` emits `session:start` synchronously from the
  caller, so when the UI starts a session from the Begin click the request runs inside that
  gesture. `requestPermissionFromGesture()` is exported too, for a UI that prefers to ask
  explicitly (shared pending promise; a second call does not prompt again).
- **Store** the answer via `controller.updateSettings({ notifications })`. A dismissed prompt
  (`default`) leaves `unasked` and is not repeated in the same page load. Passive sync mirrors
  browser grants/denials, re-arms `unasked` when the browser permission was reset, but never turns
  an in-app `denied` into `granted` (that would undo an opt-out); an explicit request does.
- **Notify** only if permission is `granted`, the setting is not `denied`, the page is not
  *visible and focused* (`visibilityState === 'visible' && hasFocus()`), and this moment
  (session × kind × block index) was not notified before. When the user is looking at the page,
  the garden, chime and widget already show the moment; this is deliberate.
- One tag (`study-sprout-session`) with `renotify`, so break → focus → bloom replace each other
  instead of stacking.

## Consequences
With the PiP widget focused, the main document is not focused, so a notification is shown even
though the widget also shows the moment — acceptable (the widget may be on another screen).
