# 82 · Hototogisu (W8)

## What
A new tier-2 species for the rocky waterfall: **hototogisu**, the toad lily (*Tricyrtis hirta*,
ホトトギス). It adds only files, plus one id in a test list:
- `src/plants/species/hototogisu.ts`: the definition and the plan/draw (`planHototogisu`).
- `src/plants/lib/hototogisu-paint.ts`: new helpers `freckledStars` and `freckledBud`. No
  shared `lib/` helper was touched.
- `src/plants/species/hototogisu.test.ts`: `smallSuite('hototogisu')`.
- `src/plants/notes/hototogisu.ts`: the note from the brief.
- `src/scenery/flora.test.ts`: `'hototogisu'` added to the waterfall's pinned flora list, at
  its sorted place after `daimonjiso`.

Fields:
- tier 2, `medium`, box 120×160, anchor .5/.9;
- habitats `rock` and `back`; `bloomColor` `#d9c7dc`; pollinators; nativeName "Hototogisu";
- range: realms `japan`, biomes `montane-stream` and `temperate-forest`, climates
  `cool-temperate` and `warm-temperate`, no `cultivatedIn`.

The Japanese garden's flora is only the `garden` biome, so the toad lily does not leak there,
and the garden keeps its 25 species. The waterfall offers it, and it fits the medium ledges
(`ledge-3`, `ledge-8`) and the cliff foot (`cliff-2`, `bank-18`).

## How it is painted
- **Stems:** 2–4 per clump, each 12 turtle segments with the bend weighted toward the tip.
  Each stem rises nearly upright and then arches over, so its tip leans out level or nods.
  - Most stems lean one way. Sometimes one leans back the other way, which gives a V.
  - A clump whose stems all lean one way roots 20 units across from the anchor. Its arch then
    has the whole box to lean across. Before this, those seeds read as a cramped bouquet.
  - Each stem is shortened until its full arch fits 46 units either side of the anchor.
  - The stem is a purplish-sage stroke under a pale dry-brush halo, which gives the hairiness.
- **Leaves:** 8–11 per stem, alternate, unevenly spaced. Each is a lance-shaped `paintLeaf`
  (`#8b9c5a` toward olive), longest a little below the middle of the stem and small at the tip.
  Each leaf points toward the stem's tip and starts a little across the stem. A faint round dab
  at its base gives the clasping base.
- **Flowers:**
  - **Where:** in some upper axils (t ≥ 0.3, about one in three, now and then a pair) and 1–2 at
    each stem's tip. Each stands upward on a short pedicel, as a six-tepalled star seen from the
    front and above (tilt .55–.8).
  - **One shared layer each, for all flowers:**
    1. a faint cool shadow;
    2. white tepals source-over, with a pale violet flush bled in at the base and half of the
       freckles bled in soft (wet-in-wet);
    3. crisp freckles dropped on once dry, in `#6b4a8c`, a little deeper on some.
  - **Freckles:** 1–5 per tepal around two clusters, of varied size, so some tepals are heavy
    and some bare: dabbed, not evenly stippled.
  - **Column:** a short pale lilac column of styles with three arms arching out, dotted purple.
- **Growth:**
  - The seed mound comes first.
  - The stems lengthen (0.06–0.6, staggered per stem). They come up nearly straight and arch
    as they lengthen.
  - Each leaf unfurls as the tip passes its node.
  - The buds form in the axils and turn white and freckled (0.46–0.84). They open from the
    base of each stem outward (0.74–1). The tepals swing out from the bud.
  - Every mark grows in from small. The family suite's continuity test passed on the first run.
- **Cost:** 17–37 ms at growth 1 for seeds 1–6, at 1.6×. That was timed on the main thread in a
  headless probe, inside the 4–127 ms budget.

## Looked at
Probe sheets: growth × seeds 1–6 at 1.6× on a pale rock-green ground, plus 5–6× zooms. The
sandbox refused `npm run shots`, so these come from small Playwright scripts against my own dev
server on port 5407. Shots in the waterfall are in `artifacts/shots/`.
- **r1 sheet:** the flowers were dark purple clumps like buddleja. The freckles were far too many
  and too big, and the white was lost. The stems were straight rods in a V. → Fewer and smaller
  freckles; the bend weighted to the tip.
- **r2 zoom:** the arch read. The stars did not: they were small, faint, grey-flushed smudges.
  The column was a dark purple candelabra. The clasp dabs read as beads on the stem.
  → Bigger, whiter, more face-on stars; a pale stroked column; quieter clasps.
- **r3 zoom:** six-pointed white stars, freckled. But each one had a grey ghost double (its
  shadow), and the flowers crowded into masses at the tips. → A fainter, closer shadow; flowers
  spread down the stem.
- **r4 zoom** (`hototogisu-r4-zoom.png`): "freckled stars along a leaning stem", but
  over-flowered → fewer axil flowers.
- **In the garden, r1** (`hototogisu-r1-close.png` on `ledge-3`, `-r1-wf.png`, `-r1-sunset.png`,
  `-r1-night.png` on `ledge-8`): on `ledge-8` a one-sided seed was a stubby bouquet, not stems
  leaning out → the off-centre foot.
- **r2, final:**
  - `hototogisu-r6-growth.png`: growth 0.2–1 × seeds 1–6.
  - `hototogisu-r2-close.png`: noon, close on `ledge-3`, beside the violet.
  - `hototogisu-r2-night.png`, `hototogisu-r2-phone.png` (390×844).
  - `hototogisu-r2-wf.png`: overview, planted on `ledge-3`, `ledge-8`, `cliff-2` and `bank-18`.
  - `hototogisu-r2-flora.png`: `flora/waterfall`.

**What reads well:**
- **Close and phone:** white six-pointed stars dabbed with purple freckles along arching,
  leafy, leaning stems. This is unlike the daimonjisō, a low rosette with white 大 flowers and
  no spots, and unlike any garden lily: nothing else in either garden is speckled.
- **Night:** the stars hold as pale freckled specks.
- **Sunset:** they take the warm light.
- **Line-up:** it is the only leaning spray among the tier-2 plants.

## Tests
- `npm run typecheck` passes.
- `VITEST_WORKERS=1 npx vitest run src/plants/species/hototogisu.test.ts
  src/scenery/flora.test.ts`: 2 files, 22 tests pass. That includes continuity over 200 growths
  and the garden's pinned 25 species.
- No local e2e, as briefed. `tests/e2e/studio.spec.ts` was not run.

## For the orchestrator to place
- **docs/systems/plants-species-a.md** › Species:
  `| \`hototogisu\` | Toad Lily · Hototogisu | 2 | rock, back | 120×160 · .5/.9 | \`#d9c7dc\` | yes | hairy stems leaning out and arching over, alternate clasping lance leaves; upward-facing white six-tepalled stars in the upper axils and at the tips, wet-in-wet, dabbed with purple freckles round a pale spotted column; a one-sided clump roots off-centre (waterfall only) |`
  and in the helper list: `hototogisu-paint.ts`: `freckledStars` (star flowers in shared
  layers: shadow, white source-over with soft freckles bled in, crisp freckles, then pale
  freckled columns) and `freckledBud` (a greenish spindle that whitens and freckles before it
  opens).
- **docs/TESTING.md** matrix:
  `| W8.1 | Hototogisu: \`smallSuite\` (deterministic, seeded, grows continuously, fits its box); offered only at the waterfall, the garden keeps its 25 | plants/species/hototogisu; scenery/flora | studio › every entry renders | ✔ |`
- **Studio order:** `hototogisu` sorts after `daimonjiso` and before `hydrangea`, so
  `allSpecies()[0]` is still the anemone. The tier-1–2 boards and the flora boards shift by one
  card.

## Left open
- **At overview size** the flowers read as pale lilac-white sprays: the freckles average into a
  tint. "White with spots" needs the close or phone view.
- **On a medium ledge** (scale ≈ 0.68) it is a slender plant, a little smaller on screen than
  the violet beside it. The box's width limits how far an arch can reach.
- **Hairs:** the dry-brush halo stands in for them; there are no real hair ticks.
- **The off-centre foot** puts a one-sided clump's base up to 20 units from its slot point. That
  is fine on the ledges seen; it was not checked against a slot edge.
- **The tepal bases** have no yellow, though real *T. hirta* often has it there.
- **Checks not made:** the worker paint time (measured on the main thread only) and the
  planting sheet preview.
