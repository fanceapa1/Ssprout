# ADR 0244: The Gardens section, and the UI reads the garden on view

- Status: accepted
- Date: 2026-10-28
- Builds on: ADR 0240 (a garden per scenery), ADR 0243 (switch the scenery at runtime), ADRs 0130–0135 and 0200–0204 (the dock), ADR 0208 (section sheets)

## Context
Since ADR 0243 the garden on view can change at runtime, but the UI was given the Japanese
garden's slot list once, at boot: placement markers came from the controller (already per garden),
but the habitat words, the camera's seedling framing, the plant labels and the dev
`slots()`/`slotScreen`/`boundsForSlot` hooks kept the Japanese garden's slots. There was also no
way to choose a garden from the page.

## Decision
- `UIDeps.slots` is a getter, `slots(): readonly Slot[]`, read at each use; `main.ts` passes the
  viewed scenery's `geometry.slots`. `UIDeps.habitatWords?()` gives the viewed garden's words
  (`WATERFALL_HABITAT_WORDS` in the waterfall, `HABITAT_WORDS` otherwise); the planting sheet's
  habitat line and the placement prompt and markers use it.
- The camera frames a seedling only when its `sceneryId` is the garden on view; plant labels hit
  only plants of the garden on view.
- `UIDeps.sceneries?` (id, name, blurb of each available scenery). With two or more, the UI adds a
  **Gardens** dock section (`gardens`, order 25, full span, `leaf` sheet, helper "Each garden keeps
  its own plants."). A card per garden is a toggle button (`aria-pressed` marks the garden on
  view) with a thumbnail, its name, its blurb and a short mark ("On view" / "Go here"). Choosing
  one calls `controller.showScenery(id)` (`scenery/view`); the host and renderer do the rest.
  With one garden there is no section, so the page without the dev flag is unchanged.
- Thumbnails are **stills of the stage canvas**: the garden on view is copied after the garden's
  first paint, and a garden is copied again just before you leave it. A garden not seen yet shows
  a pale waiting wash. The canvas is cover-cropped into 192×120 and the card fades its edge with
  an elliptical mask, like a wash on the sheet.

## Consequences
- The thumbnail is honest (what you last saw) and costs one `drawImage`, but a garden you have not
  visited has no picture, and a still taken at the first paint may be at a zoomed camera or before
  the light eases in. A painted thumbnail from the scenery's cached overview is left for later.
- The section has one action per card and no primary seal (ADR 0201): choosing a garden is a
  navigation, not a commitment.
- Studio: `ui/garden-thumbs`. e2e: `tests/e2e/gardens.spec.ts`.
