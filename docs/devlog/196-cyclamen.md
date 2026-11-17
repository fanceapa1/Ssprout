# 196 · Ivy-leaved cyclamen (GP8, phase 15)

## What
The Greek coast's autumn woodland flower: the **ivy-leaved cyclamen** (*Cyclamen hederifolium*,
kyklamino), a tier-1 `small` plant. It adds only files:
- `src/plants/species/cyclamen.ts`: the definition, the plan (`buildCyclamen`), the pose
  (`poseCyclamen`, pure, every mark at a growth value) and `cyclamenReach` (for the box test).
- `src/plants/lib/cyclamen-paint.ts`: new helpers (the marbled leaf, the nodding flower, stalks,
  the coiled seed stalk). Only `ribbonInto` is imported from a shared helper; nothing shared was edited.
- `src/plants/species/cyclamen.test.ts`, `src/plants/notes/cyclamen.ts`.
- Rows in `docs/TESTING.md` (GP8.1), `docs/systems/plants-species-a.md` and the devlog index.

The first pass was written by an agent that was cut off before its shots. This round rendered it,
looked at it and repainted it (below).

Definition: tier 1, `small` (86×86, drawn in the 70-unit design box, anchor .5/.8), habitats
`['rock', 'meadow', 'back']`, bloomColor `#d98aa6`, pollinators yes, `nativeName: 'Kyklamino'`
(`el-Latn`, to check with a speaker).

## Range, size and slots
`range: { realms: ['mediterranean'], biomes: ['coast', 'scrub'], climates: ['mediterranean'] }`
(ADR 0361's words), wild. The unit test uses the coast's real profile (`COAST_FLORA`): the coast
offers it; the Japanese garden, the waterfall and the oasis profiles do not.

A `small` plant fits every slot of its habitats in `src/scenery/coast/slots.ts` (a slot takes its
maximum size and anything smaller): the 11 `rock` slots (walls, cracks, three splash rocks, the
shelf), the 12 `meadow` terrace beds and the 6 `back` scrub slots, 29 in all. Seen in the garden at
noon and sunset: `crack-1` (a wall crack), `wall-1` (a wall top) and `mid-2` (a terrace bed). The
other slots were not rendered.

## How it is painted
- **Leaves:** 11 to 13 heart-shaped leaves: an outer ring of eight or nine and a flatter inner ring
  of three or four. Each is a polar outline with a deep basal notch. A dark green wash, a shaded
  flank, a thin darker rim, the silver zone lifted to near paper and glazed grey-green, a darker
  green core round the midrib, a few silver flecks. Some outer leaves roll up one margin and show a
  red-wine underside. The back 60 % of the leaves is painted first, then the stalks, then the front
  leaves, so the stalks rise out of the rosette.
- **Flowers:** 12 or 13 thin reddish stalks of different heights, each ending in a hook with the
  flower hanging from it. Five narrow petals start at the dark mouth and sweep back and up: a pale
  pink wash, a deeper base, a lifted twist stripe, then the deep magenta V and a dark dot at the
  mouth. A bud is the same five petals closed into a hanging spindle.
- **Seed stalks:** from growth 0.76 two thin stalks rise and loop into a small spring that ends in a
  tan capsule near the ground.
- **Growth:** earth and a flat tuber with a first leaf (0.1), a few marbled leaves unfurling (0.3),
  the full rosette with buds on tall bent stalks (0.55), open flowers (0.8), coils last.

## Cost
`paintSprite` (the worker's own function, run on the main thread of headless Chromium against the
dev server, a throwaway probe) at 1.6× (138 px), growth 1, seeds 2 to 10 after a warm-up: 11.8 to
15.5 ms (first of the nine), median 12.6 ms. Rock samphire in the same probe: median 12.1 ms. Under the 50 ms limit.

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged.

## Looked at
Scratchpad `gp8-cyclamen-stages.png`, `-close.png`, `-lineup.png`, `-garden.png` (stages 0.1, 0.3,
0.55, 0.8, 1; seeds 1 to 6 at growth 1; the tier 1 line-up; the garden at noon and sunset).
- **Inherited look (seeds 1 to 6):** the leaf pad was pale, see-through green glass with no
  visible marbling, the stalks showed through the leaves, the flowers were big and bunched into a
  tall bouquet on long straight canes, and the seed coils read as the digit 3 with a dark capsule
  like an eye.
- **Round 1 (changed):** darker green and more opaque leaves, a darker core round the midrib so the
  silver zone reads as a pattern inside a dark margin, a leaf pad that covers the stalk bases,
  smaller flowers (size 0.66 to 0.82), stalks 10 to 35 units long leaning outward, a flatter inner
  leaf ring, smaller coils and capsules.
- **Round 2:** the stalks and flowers read as dainty arching flames of different heights; at
  sunset in a wall crack, on a wall top and in a terrace bed the plant keeps its read against the
  sand and stone. In the tier 1 line-up it is the only plant with a dark marbled leaf pad under
  pink swept-back flowers: not the iwakagami, kurinsou, violet, white clover or the ice plant.
- The test limits moved with the painting (stalk lengths, leaf size, the box check at 24 seeds);
  the 11 unit tests in `cyclamen.test.ts` pass.

## Left open
- The middle of the rosette is a dark tangle of overlapping rims and midribs; the real leaves
  are softer and flatter.
- The flowers still overlap in the middle of the clump.
- The coiled seed stalks are a small squiggle with a tan dot at overview size.
- At growth 0.55 the stalks stand tall and bare with tiny buds.
- Not checked: night, the phone view, the slots other than the three above.
