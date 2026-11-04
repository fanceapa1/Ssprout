# 102: Oasis draft A, "Ksar & palmeraie"

Index line for the orchestrator:

`| 102 | [Oasis draft A: Ksar & palmeraie](102-oasis-draft-a.md) | Phase 13 rough draft: a red-ochre bluff crowned by a crumbling ksar, palm terraces held by pisé walls, a seguia into a stone basin and an oued bend in front | Draft only |`

## The idea
A Draa-valley palm grove that people built. A red-ochre bluff on the left carries a mud-brick ksar
with horned corner towers that catch the warm light. Below it the grove steps down in terraces to a
stone basin fed by a seguia, and a natural oued bends across the foreground. Of the three drafts,
this is the built, terraced, red-earth one.

## What's in it
Everything is in `src/scenery/oasis/drafts/a/`. The steps, back to front, are in `paint.ts` › `STEPS`:
- **Sky**: a temporary wash, pale cerulean over an apricot glow. The upper right is left open for the sun.
- **Ranges**: lilac flat-topped mesas with their rims lit, and a rosier nearer range with shaded steps.
- **Dunes**: a golden strip with a shaded lune on the west side of each crest, and ripples.
- **Ground**: a golden sand and soil wash, furrowed plots in a patchwork of damp and dry earth, and
  pale young barley at the grove's edge.
- **Grove**: dusty understory clumps, then two rows of date palms: a hazy far row and a sparser
  near row.
- **Bluff**: a red-ochre face, with a lit right flank kept as paper and then painted, broken strata,
  and gullies cut from the rim. A grainy talus at its foot.
- **Ksar**: 10 pisé blocks with towers, houses, ruined curtain walls and rock in front of their
  feet. Each tower has its lit flank, corner horns, a band of Draa chevrons, window slits,
  formwork lines and rain streaks. Palms show behind it.
- **Walls**: low pisé terrace walls with a lit coping, a shaded face and a cast shadow at the foot.
- **Seguia and basin**: a slim channel between mud lips. The basin has a limestone coping and deep
  teal water, and an overflow runnel goes down to the oued.
- **Terrace palms**: big palms at the bluff's foot and on the upper terrace, plus three young offshoots.
- **Oued**: the bend (low on the left, rising to the right), warm shallows, two sand bars, the
  bluff's red reflection and lifted streaks of sky.
- **Edges and margins**: a few reeds and stones, and the paper vignette (shared `paintMargins`).

Studio: `oasis-draft-a` in `draft.studio.ts`, with four entries: the whole world, the phone crop,
the composition map and a close view of the ksar.

## Plantable ground (25 slots)
The zones are in `layout.ts` › `ZONES`, outlined and labelled on the map:
- upper plots W (4), plots by the basin (3) and upper plots E (3), all on the terrace that holds the basin
- the lower terrace (4) and river bank E (3), between the big wall and the oued
- shallows (2) and the sand bar (1) in the oued
- the near sand bank (5) in the foreground

Everything is below y ≈ 560, in the lower 45 % of the world.

## Focus
The focus is at (750, 640), the basin's near left corner. The 600-wide phone crop (450–1050)
holds the two right ksar towers and the lit flank of the bluff, the grove, the basin with its
seguia and overflow, and the oued.

## Looked at
- **r1**: the palms were dark umbrellas, the dune shadows read as pyramids, the curtain wall looked
  like a tray, the terrace walls ran like roads, the cross walls looked like sticks, and there was
  a blot in the sky. Fixed: palm fronds rewritten (stiff upper fronds, drooping lower ones,
  V-set leaflets), the dune shade is now a lune, the sky glow is a soft band, the cross walls are gone.
- **r2**: the ksar was bigger but the bluff looked like a brick grid, the plots looked like
  rounded puddles, the seguia looked like a pipe and the grove understory was a flat strip.
  Fixed: strata broken up, gullies cut from the rim, plots set in perspective, a slimmer seguia with
  mud lips, the grove procedural in two rows, understory clumps.
- **r3/r4**: the middle ground still looked like a diagram, so the plots and walls are softer and
  the palms lighter. Added palms between the terraces and the grove, and barley tints. The
  phone crop missed the ksar, so the focus moved left.
- **r5/final**: towers with horned corners, warmer lit flanks, and the ruined curtain walls now sink
  into the rock lip.

## Left open
- The middle ground is still banded: the terrace walls run nearly level across the width. A
  real build wants the terraces to step down visibly (walls following the contours, the seguia
  dropping in small falls) and more depth from shadows cast by the palms.
- The palms are drawn with strokes and are still a little inky and alike. They need wet-in-wet
  crown masses and more variety in lean and height.
- The bluff reads as a block. It needs a rounded shoulder, a less straight top line and more
  colour variety (ochre and rose drops).
- The basin is a clean trapezoid. It could do with steps down into it, a sluice and wet stone.
- The sky is a placeholder (no daylight plates). There is no reflection of the ksar in the oued.
- Not a scenery: no contract, slots, flora, fauna, motion or sound.

## Round 2: a closer view (owner feedback)
The owner found round 1 too zoomed out for planting. Now the viewer stands on the basin's terrace.
- **Basin**: a large stone basin in the middle (x 476–1214, near rim at y 640, 46 % of the width).
  It reflects the red bluff and the palms. A sluice runs from it into the oued.
- **Bluff and ksar**: the bluff now rises close behind on the left and fills the upper-left third.
  It has a high cliff on the left, and the ksar sits on its shoulder at about twice round 1's size
  (towers 190–250 tall). Its details (horns, chevrons, slits, formwork lines) are scaled with
  `KSAR_DETAIL`.
- **Big palms**: four on the right (sizes 2–3.5, up to about 570 tall), with crowns cut by the
  top edge. A two-row grove and only a sliver of lilac range and dunes sit behind them.
- **Terraces and seguia**: on the left, the terraces step down toward the viewer with 34–36-unit
  pisé drops. The seguia runs along each terrace and falls over each wall, the last fall into the
  basin. A wider channel runs from the basin's near-left corner down to the bottom-left, so the
  foreground isn't an empty plain.
- **Oued**: it bends in from the right edge, behind the palms, down past the viewer's right foot,
  around a sand bar.
- **Slots**: 25 `SLOTS` with size classes. The map draws them as true-size, base-anchored boxes
  (`PLANT_SIZES × perspectiveScale × GARDEN_PLANT_SCALE`) and shows the UI corners. The new
  `ghosts` entry paints them as faint silhouettes over the painting. With them in, the plants
  dominate the lower 55 %.

Looked at (2 rounds, 20-minute timebox):
- **v2r1**: the composition reads close, but the foreground was an empty plain and the basin had
  blocky tower reflections. Fixed: a foreground channel, stronger plots, soft reflections and
  shorter coping joints.
- **v2-final**: checked against the two reference shots.

Left open after round 2:
- The ksar's ruined curtain walls still float slightly above the rock lip.
- The big palms' crowns are thin for their size and need wet-in-wet masses.
- The foreground channel is a plain ribbon.
- The terrace walls are still straight bands, and the tree slot on the left covers part of them.
