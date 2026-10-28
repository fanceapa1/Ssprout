# 68 · S5: the Gardens section

## What
Users can switch gardens from the page and plant in the garden on view (ADR 0244).

- **The UI reads the garden on view.**
  - `UIDeps.slots` is now a getter, `slots()`. `main.ts` passes the viewed scenery's
    `geometry.slots`.
  - `UIDeps.habitatWords?()` gives `WATERFALL_HABITAT_WORDS` in the waterfall and
    `HABITAT_WORDS` otherwise. The planting sheet's habitat line, the markers' names and the
    placement prompt use it ("will grow in the plunge pool").
  - The camera's seedling framing (`ui/stage-camera.ts`) uses the viewed slots and frames only a
    seedling in the garden on view. Plant labels hit only that garden's plants.
  - The dev hooks follow the viewed garden too: `sprout.slots()`, `sprout.ui.slotScreen(id)` and
    the camera's `boundsForSlot`.
  - The placement markers already came from `controller.placementOptions`, which uses the viewed
    garden (S1).
- **The Gardens dock section** (`ui/gardens-section.ts`):
  - It appears when `UIDeps.sceneries` lists two or more gardens: order 25, full span, helper
    "Each garden keeps its own plants.".
  - Each garden has a toggle card with a thumbnail, its name and blurb, and "On view" or "Go here".
    Choosing a card calls `controller.showScenery`.
- **Thumbnails** are stills of the stage canvas. The garden on view is copied after the first paint,
  and a garden is copied again just before you leave it. A garden you haven't seen yet shows a pale
  waiting wash.
- **The timer pill** says "Growing in the rocky waterfall · Go" when the active seedling grows in
  the other garden. On phones it shortens to "Waterfall · Go". Clicking it brings that garden into
  view.
- **Studio:** `ui/garden-thumbs`. **Dev:** `sprout.ui.gardenStills()`.
- **`main.ts`** (a few lines): `viewedSlots`, the `habitatWords` and `sceneries` deps, and the
  viewed slots for the scene, UI and camera dev hooks.

## Why
The owner asked for users to switch between the two sceneries from the page. Since S3 the garden
could change at runtime, but the UI still held the Japanese garden's slots from boot.

## Tests
- e2e `tests/e2e/gardens.spec.ts` (5), under `?dev&scenery=waterfall`:
  - with one garden there is no section;
  - both gardens are listed and the one on view is marked; choosing the waterfall switches, and
    the garden left behind keeps a still;
  - planting in the waterfall through the real flow: the habitat words, every marker and the
    session's slot are the waterfall's, and the seedling shows there. Switching back hides it while
    the session keeps counting. The pill's offer leads back to the waterfall;
  - the cards work from the keyboard (Tab, Enter, Space);
  - phone width: the cards stack inside the page.
- TESTING.md rows S5.1–S5.5.

## Look
Shots: `artifacts/shots/gardens-{1440x900,390x844}.png` (the section) and
`gardens-pill-{1440x900,390x844}.png` (the pill's offer).
- The stills read as the paintings and fade at their edges into the sheet.
- On phones the still sits beside the words, so both gardens fit on one screen.
- The Japanese garden's still is taken at the first paint, so it is a pale centre crop of the
  pond. The waterfall's was taken after the glide onto the seedling, so it is a close view of rock
  and bank.

## Left open
- **The thumbnail is a still of what you last saw.** That can be a zoomed view, or the light before
  it eases in, and an unvisited garden has only the waiting wash. A thumbnail painted from the
  scenery's cached overview would be better.
- The camera dev hook's `slots` field is taken once at boot. Nothing reads it.
