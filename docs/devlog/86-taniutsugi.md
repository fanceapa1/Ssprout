# 86 · Taniutsugi (W10)

## What
A new tier-3 shrub for the rocky waterfall: **taniutsugi**, valley weigela (*Weigela hortensis*,
タニウツギ). It adds only files, plus one id in a test list:
- `src/plants/species/taniutsugi.ts`: the definition, the builder (`buildTaniutsugi`) and a pure
  pose at a growth (`poseTaniutsugi`), which the draw paints and the tests check.
- `src/plants/lib/taniutsugi-paint.ts`: new helpers `ovalBlade`, `paintOvalLeaves`, `paintWands`,
  `trumpetShape` and `paintTrumpets`. No shared `lib/` helper was touched, and nothing is imported
  from `yamabuki-paint.ts`, so the two species never change each other's pixels.
- `src/plants/species/taniutsugi.test.ts`: `shrubSuite('taniutsugi', buildTaniutsugi, …)` plus
  its own continuity, box, vase, trumpet and range checks.
- `src/plants/notes/taniutsugi.ts`: the note from the brief.
- `src/scenery/flora.test.ts`: `'taniutsugi'` added to the waterfall's pinned flora list, between
  `susuki-grass` and `violet`.

Fields:
- tier 3, `large`, box 200×220, anchor .5/.93;
- habitats `meadow`, `back`; `bloomColor` `#e992ab`; pollinators; nativeName "Taniutsugi" (the
  default `ja-Latn`);
- range: realms `japan`, biomes `montane-stream` and `temperate-forest`, climates
  `cool-temperate`, no `cultivatedIn`;
- description: "Taniutsugi — pink trumpets for the valley, when the snow is gone."

The Japanese garden's flora is only the `garden` biome, so taniutsugi does not leak there, and the
garden keeps its 25 species. At the waterfall it fits the large meadow slots (`bank-5`, `-6`, `-11`,
`-13`, `-14`) and the back slots `cliff-2` and `cliff-3`.

## How it is painted
- **Shape: an open vase.** 6–8 woody wands rise from a crown about 18 units wide.
  - Inner wands are tall (up to 205) and nearly upright. Outer wands are shorter and lean out
    (±0.36 rad).
  - Each wand has a belly: it leaves the crown a little splayed, curves back up through its
    lower third, then arches outward at the top (`tipBias` 0.8). This gives the vase. Yamabuki is
    a one-sided fountain whose tips nod down.
  - About half the tall wands carry one side wand from the middle, leaning outward. It is rebuilt
    on the parent's node at every growth, so it rides the parent as the parent arches.
  - Wands are grey-brown bark (`#87735f`). Side wands are greener. A broken darker line runs
    down one side of each wand.
- **Leaves:** opposite pairs at nodes 13–16 units apart, from a fifth of the way up the wand. The
  lowest stems stay bare, as on old weigela wood.
  - Pairs are decussate: every other pair faces the viewer and is drawn shorter and closer to the
    stem.
  - Each leaf is an oval outline (`ovalBlade`): a rounded base, widest a little below the middle,
    a short drawn-out point, and fine single teeth.
  - The shaded half is flooded wet-in-wet with a greyer green (`#a9b49a`), the downy underside of
    the brief. The midrib and four pairs of veins are lifted pale.
- **Trumpets:** 2–3 at a leaf pair, from both axils, at half the nodes along the upper wands.
  - `trumpetShape` is a pure projected funnel. A narrow tube flares into a mouth with five rounded
    lobes. The mouth is an ellipse whose roundness follows `tilt`, so a trumpet is side-on
    (0.2–0.6) or, one in three, looks into its mouth (0.85–1.15).
  - The outside is rose (`#d9708f`), with the narrow tube and the shaded side deeper.
  - The mouth is painted pale pink (`#f4bccb`) source-over. It has a rosier throat, faint lines to
    the lobe notches and a rose rim pooled along the scalloped edge. Side-on trumpets show the
    inside as a thin pale lip, and the turned ones show the whole pale mouth.
  - A short pedicel and three narrow green sepals hold each trumpet.
- **Growth:**
  - The seed mound comes first (0–0.12).
  - Wands rise from 0.1 to about 0.66, staggered, nearly straight while young, and arch as they
    lengthen. Side wands start once the parent has grown past their node.
  - Leaves unfurl as the tip passes their node.
  - Buds swell as slender deep-rose spindles (0.36–0.8, lower nodes first). They open into
    funnels (0.72–1), turning outward and toward the viewer as they open.
  - Every mark grows in from small. The species test checks this over 240 growth steps on the
    pose: no mark appears or vanishes larger than 1.2 % of the box, and none jumps more than 3 %.
  - The first version failed this test: leaf tips on the short side wands swung 9 units a step.
    The fix was slower side wands and a gentler leaf unfurl (wasabi's devlog 76 pitfall).
- **Cost:** 32–49 ms at growth 1 for seeds 1–6 at 1.6×, inside the 4–127 ms budget. It was timed
  on the main thread in a headless probe. Yamabuki measured 26–35 ms and the azalea 17–23 ms in the
  same probe. There are 3 bands × (wands, accent, 2 leaf layers, 2 trumpet layers, mouths, calyx),
  so up to 24 drying passes.

## Looked at
Images are in `artifacts/taniutsugi/`, taken with a small Playwright script (`shoot.ts`, one dev
server on port 5411) and `npm run shots` for the first studio card.
- **r1** (`tani-r1-1440x900.png`, `r1-seeds.png`, `r1-zoom.png`):
  - The trumpets read as flat pale-pink cones: inside and outside were the same value. There were
    far too many, and the shrub became a candy bouquet.
  - All the wands met in one point, like cut stems in a vase.
  - The leaves were pale tissue.
  - → A deeper tube, less centre lift, fewer and smaller trumpets, a wider crown, bigger leaves.
- **r2** (`r2-seeds.png`, `r2-zoom.png`):
  - The trumpets turned into funnels with a pale mouth.
  - The wands were stiff straight rods, like a hand fan.
  - Leaf pairs were rungs on a ladder.
  - → Arching tips, jittered and drooping leaf pairs, bare lower stems.
- **r3** (`r3-seeds.png`): an arching vase.
- **In the garden, round 1** (`g1-wf.png`, `g1-close.png` on `bank-6`):
  - Overview: "pink trumpets along upright wands". It reads at once and differs from its
    neighbours.
  - Close: the lower wands were long pale parallel sticks.
  - → The vase belly, darker and thicker bark, leaves lower down, more opaque leaves (r4,
    `r4-seeds.png`, `g2-close.png`).
- **Growth** (`r5-growth.png`, seeds 1 and 4 × 0.1 · 0.3 · 0.55 · 0.8 · 1): seedling, then rising
  wands, then a leafy vase, then deep-rose buds, then open trumpets.
- **Round 3, the full set:**
  - `g3-wf.png`: overview, noon. Planted on `bank-5`, `-6`, `-11`, `-13`, `-14` and `cliff-2`,
    with 22 other waterfall plants.
  - `g3-close.png`, `g3-close-zoom.png`: close on `bank-6`. The face-on mouths were flat pink
    discs.
  - `g3-sunset.png`, `g3-night.png`, `g3-phone.png`.
  - → Deeper lobes and a pooled rose rim on the mouth.
- **Final:**
  - `g4-close.png`, `g4-close-zoom.png`: five-lobed mouths with a rosy rim, pale inside and a deeper
    tube outside.
  - `g4-night.png`.
  - `flora-waterfall.png`: the line-up.

**What reads well:**
- **Overview and phone:** pink trumpets in pairs along leaning wands, an upright vase. It is
  unlike yamabuki's low gold fountain beside it in the line-up. It is unlike the azalea, a clipped
  mound evenly covered in open flowers, because here the wands and the air between them show.
- **Close:** funnel trumpets, some side-on and some looking into a pale, lobed mouth. The leaves
  are opposite, oval and pointed. The wands are woody.
- **Sunset:** the pink takes the warm light.
- **Night:** the trumpets hold as muted rose.

## Tests
- `npm run typecheck` passes.
- `VITEST_WORKERS=1 npx vitest run src/plants/species/taniutsugi.test.ts src/scenery/flora.test.ts`:
  2 files, 25 tests pass. That includes the pose continuity check and the garden's pinned 25.
- `VITEST_WORKERS=1 npx vitest run src/plants src/scenery`: 61 files, 455 tests pass.
- No local e2e, as briefed.

## For the orchestrator to place
- **docs/systems/plants-species-b.md** › Species:
  `| \`taniutsugi\` | Valley Weigela · Taniutsugi | meadow, back | large · 200×220 · (0.5, 0.93) | \`#e992ab\` | an open vase of 6–8 woody wands from a narrow crown, curving up from a splayed foot and arching out at the tips, some with a side wand; opposite, decussate, oval pointed leaves, finely toothed, the shaded half grey-green; pink funnel trumpets in twos and threes at the upper leaf pairs, rose outside, some turned to show a pale five-lobed mouth (waterfall only) |`
  and under helpers: `taniutsugi-paint.ts`: `ovalBlade` (a pure oval, finely toothed leaf outline
  with its shaded half and veins), `paintOvalLeaves` (leaves in one wet layer, underside flooded
  wet-in-wet, veins lifted), `paintWands` (woody wands plus a side accent), `trumpetShape` (a pure
  projected funnel: tube, lobed mouth, throat) and `paintTrumpets` (rose tubes source-over, pale
  mouths with a throat and rim, green calyx).
- **docs/TESTING.md** matrix:
  `| W10.1 | Taniutsugi: \`shrubSuite\` plus pose continuity over 240 growths, inside its box (16 seeds), an open vase (narrow crown, wide tips), opposite leaf pairs with 0, 2 or 3 trumpets that open after the leaves; offered only at the waterfall, the garden keeps its 25 | plants/species/taniutsugi; scenery/flora | studio › every entry renders | ✔ |`
- **Studio order:** `taniutsugi` sorts after `susuki-grass` and before `tree-peony`, so
  `allSpecies()[0]` is still the anemone. The tier-3 boards (`shrubs-b`) and the flora boards gain
  a card.

## Left open
- **Glassy leaves:** leaves of the two alternating groups overlap in the crowded middle into
  darker, cellophane-like patches. This is honest glazing, but busier than a painter would leave it.
- **Straight lower wands:** the vase belly is subtle. The lower wands still read as a sheaf of
  straight rods in the close view.
- **Mouth detail:** there are no stamens or style at the mouth, and the throat lines show only in
  close views.
- **Checks not made:**
  - the crown slot `cliff-3` (scale 0.6);
  - the worker paint time (measured on the main thread only);
  - the planting sheet preview;
  - `tests/e2e/studio.spec.ts` (the studio entries rendered without errors in every shot).
