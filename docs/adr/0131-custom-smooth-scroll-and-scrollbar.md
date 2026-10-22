# ADR 0131 — Custom smooth scroll over native scrolling; a brush scrollbar

- Status: accepted
- Date: 2026-10-23
- Context: ADR 0005 (custom smooth scroll and scrollbar, touch native, reduced motion)

## Decision
- **The document scrolls natively**; `src/ui/smooth-scroll.ts` only decides how inputs move it.
  No transformed wrapper, no virtual scroll: focus, find-in-page, `scrollIntoView`, anchors,
  sticky/fixed elements and test tools keep working.
- **Wheel and arrow keys** (`follow`): `preventDefault`, push a target, ease toward it every frame
  with a frame-rate-independent exponential approach (τ = 120 ms, at least ~1 px a frame so the
  rounded scroll offset never looks stuck). **Page keys, Space, Home/End, `scrollTo`,
  `scrollToElement`, in-page anchors** (`glide`): a timed cubic in-out, 420–1100 ms by distance.
  Maths in `scroll-math.ts`, unit-tested.
- **Native wins.** A scroll position we did not set (scrollbar drag, focus, touch, find, tests) is
  adopted at once: any animation stops and the next input starts from there.
- **Left alone:** touch (native momentum), sideways wheels, wheels inside a scrollable inner
  element (sheets), anything while a modal dialog is open, keys in editable fields or in controls
  that use arrows (radios, sliders), Space on buttons/links, and **ctrl/⌘ + wheel** (trackpad
  pinch) — reserved for the camera via `ui.stage.onZoomGesture` (ADR 0130).
- **`prefers-reduced-motion: reduce`:** every input lands at once (we still handle the wheel, so the
  browser's own smooth wheel animation does not sneak back in). Follows the media query live.
- **Scrollbar** (`scrollbar.ts`): native bar hidden (`scrollbar-width: none`,
  `::-webkit-scrollbar`). A faint hand-ruled track and a sumi brush-stroke thumb
  (`brush-path.ts`, regenerated only when its length changes) sit in the right page margin. The
  thumb is proportional (min 48 px), drags 1:1 with the pointer, a track click glides there; it
  wakes on scroll or when the pointer nears the right edge and fades after 1.3 s. It is
  `aria-hidden` and never focusable: keyboard scrolling and focus order stay the browser's.

## Rejected
- Smoothing by translating a wrapper (Lenis-style "virtual" scroll): breaks fixed positioning,
  focus scrolling and assistive tech, and would move the canvas through transforms every frame.
- `scroll-behavior: smooth`: no control over the curve, and it would also animate programmatic
  scrolls from focus and tests.
