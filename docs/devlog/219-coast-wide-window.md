# 219 · The coast in a wide window (GL1b, phase 15)

The owner looks at the Greek coast in a 1470 × 750 window (DPR 2). The overview covered it round
the focus (760, 600): the world showed y 209–991. The chapel's dome sat under "Start studying", the
temple's columns touched the top edge, the sky and its new clouds were gone, and the bottom of the
window was a band of near-empty paper with the seven foreground slots and the rock pools fading in
it. At 1440 × 900 (the agents' screenshots) the top was fine, so nobody saw it.

## Measured (stage = window − 28 px wide, 94 % high; ADR 0130)
| Window | World rect, before → after (y) | Bottom dissolve starts, before → after | Dome top (y ≈ 288) under the buttons' band |
|---|---|---|---|
| 1470 × 750 | 209–991 → 179–961 | ≈ 873 → ≈ 844 (117 units) | 13 units into it → 37 units clear |
| 1440 × 900 | 41–1000 → unchanged | ≈ 856 (144 units) | far clear |
| 1920 × 1080, 1280 × 720, 1366 × 768 | ≈ 135–1000 → ≈ 135–1000 (1920: 141 → 141–999) | ≈ 870 | far clear |
| 390 × 844 | −136–1136, x 460–1060 → unchanged | ≈ 945 | outside the phone's crop |

782 units of height cannot hold the sky over the hill (from y ≈ 200), the buttons' band (60 CSS px
into the stage) and the dissolve (15 % of the stage) and still show y 900–1000 clearly: the clear
band is about 595 units. The other gardens show the same: the Japanese garden and the waterfall
(focus y 560) and the oasis (520) all give up their bottom strip at 1470 × 750; their lowest slots
(y 950–980) stand in the dissolve or below the window.

## What changed (ADR 0384)
- **The view**: the coast's focus is (760, 570). Only the coast's: the fit rule, the camera and the
  other gardens are unchanged.
- **The slots**: the foreground under the lowest wall is now the painting's foot, with no slot. Ids,
  habitats, sizes and sites are kept; the moved slots take their terrace's lift.
  `path-1` (790, 975) → (1040, 822) lower · `path-2` (990, 950) → (940, 684) middle · `path-3`
  (846, 946) → (846, 822) lower · `scrub-3` (1300, 965) → (1508, 510) top · `scrub-4` (1580, 960)
  → (1480, 822) lower · `scrub-5` (700, 985) → (752, 838) lower · `scrub-6` (1180, 960) →
  (1300, 834) lower. To make room: `path-4` (870, 792) → (882, 822), `low-1` (812, 826) →
  (812, 822), `mid-1` (880, 684) → (860, 684). Neighbours closer than half a box share a y.
  The terraces are full near the path: only two places on them are 50–120 from it and clear of
  every rule, so the path slots stand in a tight row on the lower terrace's front.
- **The painting**: the pools rise to y 866/874/874 (from 892/902/886) and the beach's back to
  y 822–852 (from 840–852); their slots follow (`pool-1…3` at 868/876/876), `beach-2` (300, 822) →
  (300, 814). The phrygana cushion and the grass tuft at the promontory's foot moved left for
  `scrub-3`. The shelf, pool rims, shingle, pool water, wildlife regions (`pool-1…3`), the crab's
  rims and the octopus's pools follow `POOLS`, `BEACH` and `SHELF`; `paint-rocks.ts` is not edited.
- **Wildlife**: `COAST_SEEN` (ADR 0382) is x 60–1530, y 210–960; the coping perches skip the moved
  slots by themselves (130 perches).

## Pins updated
`rock.test.ts` (the shelf and the pool rims), `water.test.ts` (the beach's back and the pools),
`veg.test.ts` (the cushion and the tuft). `land.test.ts`, `daylight.test.ts` and `motion.test.ts`
did not move.

## Looked at
STATUS_LOOKED

## Tests
STATUS_TESTS

## Left open
- `low-4` (1560, 812, medium): a full medium box reaches x 1638; no place further left clears the
  middle beds behind it. The sprites painted there so far are narrower than the box.
- The pools' slots stand at the top of the dissolve at 1470 × 750 (about 30 % in); fully clear
  would need a thinner beach.
- The fauna's `path-foreground` ground spot (y 940) stays in the strip under the lowest wall.
