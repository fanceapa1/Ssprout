# 64 — S6: the waterfall's rock

**Status: done**, with the open points below.

## What
- `src/scenery/waterfall/paint-rocks.ts`: the gorge behind the lip, the cliff (reserved paper,
  wet-in-wet mass, strata blocks, bedding scumbles, cracks, the alcove behind the falls, lit
  faces, wet streaks, seeps), the buttress and the ledges with moss cushions. Every painter is a
  generator that yields after each mark (ADRs 0226, 0238).
- `src/scenery/waterfall/sprites.ts`: wet boulders in and by the water, mossy ones on the banks.
- Contract: `SceneArt.rockSprites?: RockSprites` (`box`, `paint`), used by the sprite pass and the
  atlas layout, default `GARDEN_ROCKS`. The garden's paintings and keys are unchanged.
  ARCHITECTURE › Sceneries and docs/systems/scenery.md were updated in the same commit.
- `waterfallSteps`: the rock steps sit between clearly marked placeholders for S7 (pool, stream,
  falls) and S8 (far ridge, banks; comments mark where the crown woods, ledge ferns and near banks
  go). The trail's stones use the garden's `paintStones`.
- Studio `waterfall-rocks` (cliff, ledges, boulders, scene). Tests: `rocks.test.ts` (steps,
  wet/mossy boulders, quantised hash pins, slice bounds, parts); TESTING rows S6.1–S6.5.
- `src/main.ts` untouched.

## Why
- The rock is lit from the upper right: the sun sets and rises right of the buttress
  (`WATERFALL_SKY_LAYOUT`), so the garden's upper-left light would fight the daylight plates.
- The cliff reserves its paper, so S8 can paint what lies behind it in any order without the
  cliff's multiply turning muddy over it.
- The notch is cut out of the cliff's body down to the lip, so the gorge reads as a recess, not
  a darker patch on the cliff.

## How it looks
Shots: `artifacts/shots/wf-cliff-1440x900.png`, `wf-ledges-…`, `wf-boulders-…`, `wf-scene-…`.
The strata, wet streaks and moss read as watercolour, and the boulders match the garden's.

## Left open
- The ledges' undercut glaze still dries with a visible lower edge, so the shelves read a little
  like trays. It should die away into the face.
- The buttress's right flank is a smooth convex curve in `CLIFF` (layout), so the buttress reads
  as a rounded mass at the overview. It needs a more broken flank in the layout, or S8's far plain
  and woods overlapping it.
- The gorge is small at the overview scale and reads only as a pale notch.
- Wet streaks beside the falls are mostly hidden under the falls placeholder. Check them again
  once S7 paints the sheet.
