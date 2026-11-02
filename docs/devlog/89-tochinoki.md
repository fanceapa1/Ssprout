# 89 · Tochinoki (W12)

## What
A new tier-4 tree for the rocky waterfall: **tochinoki**, the Japanese horse chestnut
(*Aesculus turbinata*, トチノキ). It adds only files, plus one id in a test list:
- `src/plants/species/tochinoki.ts`: the definition, the plan (`planTochinoki`) and a pure pose at
  a growth (`poseTochinoki`). The draw paints the pose, and the tests check it.
- `src/plants/lib/tochinoki-paint.ts`: new helpers `handShape`, `paintHands`, `paintPetioles`,
  `paintCrownShade`, `candleShape` and `paintCandles`. No shared `lib/` helper was edited. The
  shared tree helpers (`treeView`, `fitTree`, `paintSkeleton`, `visibleBranches`, …) are only imported.
- `src/plants/species/tochinoki.test.ts`: `treeSuite('tochinoki', planTochinoki)` plus checks for
  continuity, the box, the trunk and dome, the hands and candles, and the range.
- `src/plants/notes/tochinoki.ts`: the note from the brief. The tochi-mochi line is kept, and its
  *(verify)* mark is dropped, because tochi-mochi is a well-known mountain-village sweet.
- `src/scenery/flora.test.ts`: `'tochinoki'` added to the waterfall's pinned flora list, between
  `taniutsugi` and `violet`.

Fields:
- tier 4, `tree`, box 380×460, anchor .5/.94;
- habitats `back`, `meadow` (the waterfall's tree slots `cliff-1` and `bank-16`);
- `bloomColor` `#f1e6d2`, pollinators true, nativeName "Tochinoki" (the default `ja-Latn`);
- range: realms `japan`, biomes `montane-stream` and `temperate-forest`, climates
  `cool-temperate`, no `cultivatedIn`;
- description: "Tochinoki — great green hands, and white candles over the water."

The Japanese garden's flora is only the `garden` biome, so tochinoki does not leak there, and the
garden keeps its 25 species.

## How it is painted
- **Trunk:** one straight trunk, 20–24 units wide at the foot. That is about twice the ginkgo's
  width. It has a strong base flare and heavy bark texture, in wood into sumi (`#8e7960` →
  `#4a443c`).
  - 7–9 stout limbs climb out of its upper 60 %, with two more orders of shoots.
  - The limbs are painted in their own skeleton pass at 0.62 opacity, after the trunk pass. This
    lets the crown read as leaves, not as an X-ray of wood through the multiplied leaflets.
- **Crown:** an envelope is fitted around the shoot tips. It is wider than the tips and hangs
  lower than them, so it makes a broad dome over a short bare trunk. Hands fill it on a jittered
  grid (17 units, about 90–150 hands per tree).
  - Each hand belongs to its nearest twig, with a short petiole (at most 13 units).
  - Hands on the rim face outward and droop. Inner hands hang down.
  - On the upper dome, and on the outer shell down to its middle, some hands are **rosettes**:
    near-full stars seen edge-on (squash 0.38–0.52).
- **Hands** (`handShape`): 5–7 leaflets fanning from one point. The middle leaflet is longest,
  21–28 units, and the outer ones are half that.
  - Each leaflet is obovate: a narrow wedge at the base, widest past the middle, and a short
    drawn-out point. Each leaflet droops a little to its own side.
  - Leaflets are filled twice in their band's wet layer. The shaded half of the midrib is flooded
    darker wet-in-wet, and the midrib is lifted pale. The lift starts away from the centre, so
    hands don't show a white star.
  - There are three depth bands, all multiplied:
    - back: deep olive with celadon;
    - middle: `#7e9550` toward `#6d7c44`;
    - front: `#7e9550` lifted a little.
  - A soft, greener shade (`paintCrownShade`, at reduced resolution) fills the crown's interior
    under the hands.
- **Candles** (`candleShape`): upright cone panicles, 22–29 units tall, on about 70 % of the
  rosettes. They lean a little outward with the side of the crown they stand on.
  - A cone of 7 rows of cream florets (`#f4ecd8`) is painted source-over, so the candles sit pale
    on the dark hands.
  - Then a multiplied pass adds a cool shade down one side and blotches at the florets' hearts.
    The blotches are pink (`#d47a6a`) low on the cone and mostly yellow higher up.
- **Growth (tier-4 family windows):**
  - The seed and mound come first, then the shared skeleton growth (0.015–0.5, scaling up from
    32 %).
  - The sapling carries its own small palmate hands at its growing tips. They grow with the tip
    and fade from 0.5 to 0.68 (the trunk's own tip hands fade earlier, with τ).
  - Crown hands open from 0.44 to 0.84, staggered by twig and by distance from the crown centre.
    Each emerges limp, folded and bronze-green (petiole short, leaflets hanging and close
    together), then lifts, spreads and darkens.
  - The shade arrives with the hands (0.52–0.86).
  - Candles rise from 0.7 to 1 as green buds, lengthen, turn cream, and take their blotches last.
- **Seasons:** the garden has no seasonal logic, so the mature state stays summer green with
  candles. The brief's autumn ochre and husks are not painted.
- **Cost:** 63–88 ms at growth 1 for seeds 1–6 at 1.6×. It was timed on the main thread in a
  headless probe under `nice`, warm, on a loaded machine. The cold first draw was 115 ms. Both are
  inside the 4–127 ms budget. There are 9 drying passes: ground, skeleton ×2, shade, 3 hand bands,
  petioles and 2 candle layers.

## Looked at
Images are in `artifacts/tochinoki/`. They were taken with a probe that paints seeds × growths in
the browser (`sheet.ts`), a garden probe (`garden.ts`, waterfall, both tree slots plus 22 plants,
light pinned), and `npm run shots` for the flora line-up. All ran against my own dev server on
port 5414.
- **r1** (`r1-growth.png`, `r1-seeds.png`, `r1-zoom.png`):
  - The crown was a narrow, pale cloud of generic pad blobs, with a few hands on the rim like
    decorations.
  - The trunk ran on as a thin leader to the top.
  - The candles were invisible.
  - → Bigger, longer and more numerous candles, more hands, a broader skeleton.
- **r2–r3** (`r2-zoom.png`, `r3-zoom.png`):
  - The candles began to read.
  - The crown was still mostly pale pad wash, lopsided, and too few hands survived the overlap
    rule.
  - → Fill a crown envelope with hands on a grid, each on its nearest twig.
- **r4** (`r4-seeds.png`, `r4-zoom.png`): "dark hands with white candles" read at once.
  - But the dome was a lollipop on a stick.
  - The limbs showed through the leaves like an X-ray.
  - Grey interior pads poked out.
  - The candles were stacked on the top like a birthday cake.
  - It took 158 ms (cold).
  - → The pads were replaced by one soft crown shade, candles were allowed on the outer shell, and
    an opaque front band was tried (`r5-zoom.png`). It turned the leaves milky over the trunk and
    was reverted (`r6-zoom.png`).
- **Growth** (`r6-growth.png`, `r7-growth.png`, final `r10-growth.png`, seeds 2 and 5 × 0.05–1):
  - At first, 0.6 was a bare tree and 0.7 suddenly a full one, and grey shade showed before the
    leaves. → A wider hand window, a later shade, and a later fade of the tip hands.
  - Now it runs smoothly: seedling, then sapling hands, then a bare skeleton with tip hands, then
    limp bronze hands, then a dark dome, then green buds, then cream candles.
- **In the garden, round 1** (`g1-wf.png`, `g1-crop.png`): it read, but light yellow-green and airy.
  → Darker bands, a denser grid (`r8-seeds.png`), and the shade kept inside the crown.
- **Round 2** (`g2-wf.png`, `g2-close.png`, `g3-close.png`, `g3-close2.png`):
  - `focusSlot` frames the foot, so the crown is cut off. Both tree slots sit at the scene's
    edges, so the close views use `zoomTo` near each tree.
  - The hands read as palmate leaves with veins.
  - White midrib stars sat at the hand centres.
  - The limbs were too dark. → Softer lifts, paler limbs (`r9-zoom.png`).
- **Round 3** (`g3-wf.png`, `g3-sunset.png`, `g3-night.png`, `g3-phone.png`,
  `g3-phone-close.png`, `flora-waterfall-1440x900.png`):
  - In the line-up it was still a ball on a stick. → A wider, lower envelope (`r10-seeds.png`).
- **Final:**
  - `g4-wf.png`: overview, noon;
  - `g4-close.png`: close on `cliff-1`;
  - `g4-night.png`: night, close on `bank-16`;
  - `r10-seeds.png`: seeds 1–6;
  - `r10-growth.png`: growth stages.

**What reads well:**
- **Overview and line-up:** a broad dark-green dome of palmate hands studded with cream candles
  on one massive straight trunk. It is unmistakably not the maple's red tiers. It is not the
  ginkgo's column of small fans, and not the pine's dark pads.
- **Close:** 5–7 leaflet hands with a pale midrib. The candles are cones of cream florets with
  pink blotches. The trunk has a flared, textured foot.
- **Sunset:** the candles take the warm light.
- **Night:** dark hands and pale candles, just as the brief's "small size" read.

## Tests
- `npm run typecheck` passes.
- `VITEST_WORKERS=1 npx vitest run src/plants/species/tochinoki.test.ts src/scenery/flora.test.ts`:
  2 files, 27 tests pass. That includes hand and candle continuity over 240 growths, and the
  garden's pinned 25.
- No local e2e, as briefed.

## For the orchestrator to place
- **docs/systems/plants-species-c.md** › Species:
  `| \`tochinoki\` | Japanese Horse Chestnut · Tochinoki | 380×460 · tree | back, meadow | \`#f1e6d2\` | yes | one massive straight trunk with a flared foot; stout climbing limbs under a broad low dome filled with huge palmate hands of 5–7 obovate leaflets fanning from one point (rim hands drooping outward, rosettes on top); upright cream candle panicles with pink and yellow blotches standing on the outer rosettes (waterfall only) |`
  and under helpers: `tochinoki-paint.ts`: `handShape` (pure palmate hand: obovate leaflets,
  their shaded halves and midribs, foreshortened), `paintHands` (a band of hands in one wet layer,
  shaded half wet-in-wet, midribs lifted), `paintPetioles`, `paintCrownShade` (soft interior
  shade at reduced resolution), `candleShape` (pure cone of florets and blotches) and
  `paintCandles` (cream florets source-over, shade and blotches multiplied).
- **docs/TESTING.md** matrix:
  `| W12.1 | Tochinoki: \`treeSuite\` plus hand and candle continuity over 240 growths, every leaflet and candle inside its box (16 seeds), one massive straight trunk under a broad dome of 60+ hands, hands of 5–7 leaflets, candles only on top rosettes that open after the hands; offered only at the waterfall, the garden keeps its 25 | plants/species/tochinoki; scenery/flora | studio › every entry renders | ✔ |`
- **Studio order:** `tochinoki` sorts after `taniutsugi` and before `tree-peony`, so
  `allSpecies()[0]` is still the anemone. The `plants-trees` boards and the flora boards gain a card.

## Left open
- **Seed variety in the garden:** the seeds the garden picked came out narrower than the best
  seeds in the sheets. The crown width follows the limb spread per seed, and a narrow seed reads
  taller and airier.
- **Glassy overlaps:** where leaflets of one band overlap in the crowded middle, they glaze into
  darker cellophane-like patches. This is honest multiply glazing, but busier than a painter would
  leave it.
- **Grid regularity:** hands come from a jittered grid. Up close the crown's texture is a little
  even, and there are no deliberate clumps or holes of sky through the dome.
- **No autumn:** the brief's autumn ochre and husks wait for a seasons system.
- **Framing:** both waterfall tree slots sit at the scene's left and right edges. On a phone the
  overview crops both trees out, and `focusSlot` frames the foot rather than the crown.
- **Checks not made:**
  - the worker paint time (measured on the main thread only);
  - the planting sheet preview;
  - `tests/e2e/studio.spec.ts` (the flora studio entry rendered without errors in its shot).
