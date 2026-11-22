# 216 · Coast plant polish (GP17, phase 15)

## What
The owner liked the coast and asked for it to look better and more real. Five species had been
merged with weaknesses the reviews wrote down. Each was looked at first, in the studio (every
stage) and in the coast at noon (close and at the overview), then repainted, one commit each.
Ids, sizes, habitats, ranges and card texts are unchanged. Only species files, their own helper
libs and the species rows in `docs/systems/plants-species-a.md` / `-c.md` changed. Nothing under
`src/scenery/` or `src/fauna/`, and no shared helper.

## Per plant
- **Peacock's tail** (`peacocks-tail.ts`). Before, it read as a beige bracket fungus or a scallop
  shell sitting on the water: opaque buff fans that were nearly symmetric, on a dark stone.
  - Now each frond is a thin, pale wash the water shows through.
  - Fronds are lopsided: three shallow funnels with dark throats and two ears. Rims are split into
    lobes, and the bands break off before the edges.
  - The broad olive-brown zones among the chalk bands still read from afar.
  - The foot of each frond is lifted back into the water's colour.
  - The plant sits in a cool hollow with a soft shadow on the bottom. A slight sideways waver
    reads as refraction, and broken light lines cross the fronds.
  - `reflect: false`: an alga under the water mirrors nothing.

  Close, it reads as a cluster of banded funnels under water. At the overview it is a small pale
  banded clump in the pool, no longer a beige shell.
- **Cyclamen** (`cyclamen.ts`, `lib/cyclamen-paint.ts`). Before, the centre was a dark tangle of
  inner leaves, dark rims, midribs and curled red margins seen edge-on.
  - The inner ring of leaves is gone, and each leaf now has its own pale stalk from the tuber.
  - Leaves facing the viewer arch down to the ground, so none turns edge-on into a dark bar. The
    far margin lifts a little.
  - Rims and shading are lighter.
  - Flower stalks rise from the tuber and are a little thinner.

  The swept-back flowers already read as shuttlecocks, so they were left alone. The marbling is
  kept.
- **Olive** (`olive.ts`). Before, growth 0.3–0.55 was a bare grey frame with a few leaf pairs at
  the shoot tips.
  - Paired leaves now run all the way up every shoot, seeded per shoot and pair so they do not
    shift as the shoot grows. Some pairs are missing, and they vary in angle and size.
  - A tuft of leaves sits at every tip, over a soft grey-green wash, so the young tree has a
    small bushy head.
  - The young leaves fade out over 0.62–0.8 instead of 0.52–0.7, so they last until the crown
    has filled.

  `planOlive` and the growth-1 arrivals are untouched. The studio's growth-1 card is pixel for
  pixel the same, and the coast's pinned olive hashes (`veg.test.ts`: overview `11a3e672`,
  detail `6644a587`) did not move.
- **Rock rose** (`rock-rose.ts`, `lib/rock-rose-paint.ts`). Before, the twigs showed as straight
  dark spokes through the translucent leaves.
  - The twigs are crooked (more wobble) and start from a spread foot. As the mound fills they are
    cut back to their feet and painted under the felted wash.
  - The leaves on the mound's underside and flanks are darker.
  - The felt lumps stay inside the leaf cloud, since lumps beyond it drew a pale bowl round the
    bush.
- **Sea lavender** (`sea-lavender.ts`, `lib/sea-lavender-paint.ts`).
  - Before: dark stems ran through the froth, the flowers were round blobs, and all the stems
    left from one point.
  - The stems now leave the rosette from different places. Above the first sprays a stem thins
    and pales into the froth, and the twigs are lilac-grey.
  - The florets sit in one-sided rows along the upper side of each twig. Each is a pale funnel
    with a lilac mouth turned outward, smaller and more numerous (340–440).
  - The haze is fainter and has no rim.
  - Florets open later (+0.06), so the stems stand bare for a while.
  - It has no spike anywhere and does not read as the lavender.

## Cost
`def.draw` at 1.6×, growth 1, seeds 1–12, main thread in headless Chromium against the dev
server. The two runs were at different loads, so the olive's growth 1 (unchanged) is the yardstick:
94 ms before and 60 ms after, a factor of 0.63.

| Species | Before | Before ×0.63 | After |
|---|---|---|---|
| Peacock's tail | 9.1 | 5.7 | 5.7 |
| Cyclamen | 23 | 14.5 | 11.6 |
| Rock rose | 28 | 18 | 15.9 |
| Sea lavender | 21 | 13.3 | 14.3 |

All are well inside the 4–127 ms budget. The young olive's added leaves and wash only paint
before growth 0.8.

## Tests
- The species tests keep their rules. One is affected by the change: the sea lavender's rosette
  still has no flowers at growth 0.4 (`opens` moved later, as noted above).
- Test results are in the report of this task.

## Looked at
Images are in the session scratchpad (`gp17/`):
- each plant before: studio stages, and in the coast (pool-1, shallows-3, low-1, wall-3, top-1,
  scrub-3, path-4, splash-1, shelf-1);
- rounds r1–r8 (peacock's tail), r1–r7 (cyclamen), r1–r3 (olive), r1–r4 (rock rose) and r1–r3
  (sea lavender), as stage cards, crops and close views;
- the after overview with all five planted.

## Left open
- **Peacock's tail**: at the overview it is still a small pale clump. Its bands only read close
  up. Fan shapes come from five templates, so seeds vary but stay alike.
- **Cyclamen**: the leaves still overlap where the ring is crowded. The flowers still overlap a
  little in the middle of the clump.
- **Olive**: the young tree's trunk is still a smooth grey cylinder until it ages.
- **Rock rose**: the twig feet are a little regular, like a fan. The seedling (0.3) is still an
  upright fan of twigs.
- **Sea lavender**: the haze still shows as a faint pale cloud over the sea.
- **Not looked at**: night, sunset, the phone view and the planting-sheet cards (the e2e specs
  only).
