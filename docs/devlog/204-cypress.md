# 204 · Mediterranean cypress (GP16, phase 15)

## What
The dark spire of Greek terraces and chapel yards: the **Mediterranean cypress** (*Cupressus
sempervirens*), a tier-4 `large` plant. It adds only files:
- `src/plants/species/cypress.ts`: the definition, the plan (`planCypress`), the pose
  (`poseCypress`, pure, every mark at a growth value), the painter (`paintCypress`) and
  `cypressReach` (for the box test). No new lib helper; nothing shared was edited.
- `src/plants/species/cypress.test.ts`, `src/plants/notes/cypress.ts`.
- Rows in `docs/TESTING.md` (GP16.1), `docs/systems/plants-species-c.md` and the devlog index.

Definition: tier 4, `large` (200×220, anchor .5/.94), habitats `['meadow']`, bloomColor `#4a6454`
(the research's foliage colour: it has no flower), no pollinators, no reflection. Range
`{ realms: ['mediterranean'], biomes: ['scrub', 'coast'], climates: ['mediterranean'],
cultivatedIn: ['mediterranean'] }` (ADR 0361's words; wild in Crete's hills, planted everywhere
else). Native name `Kyparíssi` (`el-Latn`). The card note mentions the chapel-yard and churchyard
link in one plain sentence, as the research's §16 supports. The id sorts after `anemone`.

## Where it grows
The research puts it in the terrace beds (`meadow`) and sizes it `large`, a tall narrow box
rather than a tree box. In the coast:
- **`meadow`: `mid-1` (large) and `top-1` (tree)**, the two terrace beds that take a large
  plant. The other ten terrace beds are small or medium.
- **Kept off `back`**: `scrub-1` (the cliff top) would take it, but the research does not list
  the scrub, and that slot is already contested by the Aleppo pine, the tree spurge and the olive.
- Never water or shore: no such habitat. A test pins the two slots and that none is water or beach.

## How it is painted
- **Shape:** a spindle (`flame(t)`: widest about a third up, narrowing a little to the foot and
  tapering to a point), 166–179 units of foliage on a 7–10 unit bare foot, half-width 17–20.5, so
  4:1 and narrower. The axis sways a couple of units; the outline is ragged per side.
- **Sprays:** 52 rows of small upswept sprays across the column, each a cluster of four round
  scale-leaf fronds leaning up and out (the rim ones out more), toned by side: lit on the left
  (sun side), mid, and shade on the right. One or two longer sprays break the outline low to
  mid height on a thin twig.
- **Washes:** a soft green under-wash a little inside the sprays (so the gaps read as light
  inside the column, not paper), and a dark glaze down the right half after the sprays.
- **Foot and cones:** a short grey-brown trunk with a darker right side; 3–5 tight clusters of
  2–4 small round grey-brown cones low on the column, near the rim.
- **Growth:** the flame scales from a tiny seedling flame (8 % at growth 0) with an ease-out to
  full size at 0.92; width grows a little faster than height, marks shrink less than the shape,
  so the sapling is a small feathery flame, not a stick. The colour starts fresher and darkens by
  0.6; the foot bares from 0.35 to 0.85; the breakout sprays reach out from 0.3; cones from 0.78.

## Cost
`def.draw` at 1.6× (320×352), growth 1, seeds 1 to 9, main thread of headless Chromium on the dev
server (a throwaway probe in the studio shot's eval): 12–18 ms after the first (32 ms, warm-up).
Well inside the 4–127 ms range and under the Aleppo pine's 52 ms.

## Looked at
Shots in the session scratchpad (`gp16shots/`):
- **Round 1** (`cyp-r1`): reads as a cypress, but the sprays were big three-leaf tridents (a fir
  of leaves), the trunk showed through the whole column (multiply), the under-wash showed as a
  hard pale cone outside the sprays, and the shape was a cone widest at the foot.
- **Round 2** (`cyp-r2`): small round scale fronds, wash inset, trunk only at the foot. The
  breakout sprays were pale blobs and the shade glaze stuck out past the right edge.
- **Round 3–6** (`cyp-close-r3`, `cyp-over-r4`, `cyp-r5`, `cyp-close-r6`): breakouts in the
  column's own greens, shade glaze inside, a spindle with a narrower foot, darker greens, a shorter
  foot and more lit sprays on the left. At the overview two planted cypresses (`mid-1`, `top-1`)
  are dark exclamation marks on the terraces beside the olive, the same dark green as the
  village's far cypresses; in the close view it is a dense textured column of sprays.

## Left open
- The young plant (0.3–0.55) is a little plump for a cypress (about 3:1).
- The lit side is subtle; the sun-side sprays read as a slight lightening, not distinct sprays.
- Not checked: night, sunset, the phone view, seeds beyond the studio's.
- Not run: the full e2e suite (the task's CPU rules); only the planting-related specs below.

## Tests
After the rebase on `main` with the Jerusalem sage merged: typecheck clean; the unit suite 275
files, 2904 tests passed (2 workers); `cypress.test.ts` 8 tests. E2E one file at a time, one
worker: `planting-previews` 2 passed, `plants` 8 passed, `plant-card-phone` 5 passed,
`lazy-species-painters` 1 passed. Not run: the studio spec and the rest of the e2e suite.
