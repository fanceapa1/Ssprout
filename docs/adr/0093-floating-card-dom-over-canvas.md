# ADR 0093 — Floating card: DOM text over a painted canvas, mountable in any window

- Status: accepted
- Date: 2026-10-22

## Context
The floating widget is a Document Picture-in-Picture window (Chromium only) showing the session's
plant, the time, a plan progress line and a few buttons. It has to be testable in headless
browsers where PiP cannot really open, it must look like a painted object, and it must keep
working when the user closes and reopens it.

## Decision
- **Canvas for the painting** (washi paper cached per size, backdrop, soil, plant, progress line);
  **real DOM for text and buttons** (crisp at any zoom, selectable, accessible: `role="timer"`,
  `aria-live` state line, focusable buttons, clickable by Playwright). Shared layout numbers
  (`LAYOUT`) keep the studio's canvas-painted preview faithful to the DOM.
- `mountCard(window)` works in **any** window. `createFloatingWidget` asks a `HostOpener` for a
  window: the default calls `documentPictureInPicture.requestWindow` synchronously inside
  `open()` (user gesture); dev/tests use `iframeHostOpener` (same code path) or a faked
  `documentPictureInPicture`.
- The PiP document starts empty: the app's `@font-face` rules are copied with absolute URLs; the
  card CSS is injected as a `<style>`.
- Closing = the PiP window's `pagehide` → tear down subscriptions; `open()` again creates a fresh
  card. Bus subscriptions that remember the session (for the bloom after completion) live outside
  the window, so a widget opened later still knows.
- The widget reads the controller through a small structural interface (`WidgetController`) so it
  could be built in parallel with the core rework; a type test checks `SessionController`
  satisfies it.

## Rejected
- Painting text on the canvas in the real widget: blurry when the window is resized, invisible
  to assistive tech and tests.
- `window.open` popups as a fallback floating window: blocked by default, and not always-on-top.
