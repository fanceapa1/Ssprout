# ADR 0168 — When the camera moves by itself

- Status: accepted
- Date: 2026-10-23

## Context
"More focus on the plant being grown": the canvas zooms onto it when a session starts; the user
can zoom back out. With parallel sessions (ADR 0150) a switch changes which plant is grown. The
camera must not fight the gardener.

## Decision
The camera glides by itself only on these events (`stage-camera.ts`):
- **`session:start`** → frame the new seedling (`framePose`: about 46 % of the frame's height,
  between 1.6× and 3×, its centre on the side of the stage it stands on, a little low, garden
  around it).
- **`session:switch`** → frame the newly active seedling (`to`).
- **Entering placement** → glide back to the whole garden: the garden is the map for choosing a
  spot. The markers follow any zoom, so the gardener may zoom in again while choosing (+, pinch),
  and choosing works at any zoom.
- Completing or cancelling a session leaves the camera where it is (the bloom or the withering is
  worth watching up close); nothing returns on its own.
- Nothing else re-zooms: after the gardener zooms out (or pans, or opens a card elsewhere), the
  camera stays until the next start or switch. A card open for another plant closes when the
  camera follows a start or switch.
- `sprout.camera.autoFocus(false)` (dev) pins the overview for tests that compare pixels there.

## Consequences
Tests that measured the garden at the overview right after a dev `start` pin the camera
(ambience reduced-motion, plant growth region); tests that hover a plant after a session settle
the camera first (`sprout.camera.settle()`).
