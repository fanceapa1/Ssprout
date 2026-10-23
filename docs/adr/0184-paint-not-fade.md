# ADR 0184 — Paint, don't fade: lifted midday whites, the night edge, the round window

- Status: accepted
- Date: 2026-10-23
- Amends: ADR 0145 (painted sky plates), ADR 0132 (the garden's edge), ADR 0134 (Your plant)

## Context
The orchestrator's review found three places that still read as generic graphics rather than
watercolour:
1. The midday clouds were recognisable cartoon puffs: a domed mass with a flat glazed belly.
2. At night the paper margins around the garden looked milky. The stage's CSS mask fades the
   painting's opacity into the page, and a dark colour fading in opacity over cream paper *is* a
   grey haze.
3. The "Your plant" window wash was lumpy: an 8 % irregular blob, deformed again by every layer,
   plus an off-centre second wash that made a lumpier inner ring.

## Decision
1. **Midday sky** (`scene/paint-sky.ts`).
   - Wet-in-wet cerulean deepening to the zenith, with more flow and granulation.
   - A second thin pass dropped in while wet: darker pools, no edges.
   - The whites are *lifted* out of the wet blue by `liftedDrift`: several soft, overlapping lifts
     of uneven strength strung along a slightly tilted drift. Most have lost edges; now and then
     one dries with a long, thin crisp edge or a crinkled bloom; torn wisps trail off.
   - No outline, no belly, no puff.
2. **Night edge** (`ambience/night-edge.ts`). In dark light the lighting layer lifts the painting
   back to white in a band just inside the stage's dissolve. Paper is multiplied last, so the white
   becomes the page's paper.
   - The night wash stops at a ragged line with a thin pooled rim. Past the line it thins into
     paper over a width that varies along the edge, breaking up on the grain. The bottom thins more
     slowly than the sides.
   - Strength = night + 0.35 · sunset + 0.15 · sunrise. It is 0 at midday, so the soft daytime
     dissolve is unchanged.
   - The band geometry matches `ui/stage-edge.ts` (tested).
   - Two screen-sized fields are built once per canvas size. Drawing them costs two blits, only in
     dark light.
3. **Round window** (`ui/plant-section.ts`). One round puddle:
   - a hand-made circle (two slow harmonics under 1.5 %), painted in many layers that barely
     wander;
   - sky blue let into celadon wet-in-wet from the top;
   - a fine pooled rim and a lifted heart;
   - the bottom lost into the paper where the plant stands. The window sits a little low, so the
     plant's ground is in that lost edge.

   `studio.spec` measures the roundness (rim deviation under 2.5 %) and the lost bottom.

## Rejected
- Changing the CSS mask per phase: two masks cannot be cross-faded by weight in CSS, and
  regenerating the mask on every light change would repaint the page at dusk.
- Darkening the page itself at night: the page is the dock's paper and must stay readable.
