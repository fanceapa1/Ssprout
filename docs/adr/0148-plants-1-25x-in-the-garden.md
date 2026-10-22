# ADR 0148 — Plants 1.25× bigger in the garden

- Status: accepted (amends ADR 0043)
- Date: 2026-10-23

## Context
ADR 0005: "plants about 1.25× bigger everywhere in the garden"; slot spacing re-checked so
neighbours still read.

## Decision
- `GARDEN_PLANT_SCALE = 1.25` and `plantScale(slot) = slot.scale × 1.25` (`src/scene/slots.ts`).
  `Slot.scale` stays the ground plane's perspective (fauna perches and creatures use it); a
  garden plant's box is `size × plantScale(slot)`.
- `plantWorldBounds` (the box the plant system draws into) uses it, so hover labels, reflections,
  the placement ghost, watering, fauna flower targets and lily pads, mote emitters and the slot
  overlay all follow. **Sprites are painted at the larger pixel size** (`spritePixelSize` gets the
  plant scale), never upscaled.
- Slots re-checked with geometry tests at the new size: no plant stands on a stepping stone, no
  plant box lies more than a fifth over the engawa's wall and deck or over the lantern, and plants
  at the same depth overlap by at most half their footprint (trees and rock-crevice plants
  excepted). `meadow-11` moved to (1490, 772) and became `medium` (a large plant hid the deck);
  `meadow-7` moved to (528, 796).
- The widget card and the planting-sheet / plant-view previews keep their own framing.

## Consequences
Sprites use ~1.56× the pixels (the LRU budget is unchanged and ample). A finished large plant
already in `meadow-11` keeps rendering; new sessions offer that slot to medium plants only.
