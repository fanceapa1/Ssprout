# 88 · Katsura (W11)

## What
A new tier-4 tree for the rocky waterfall: **katsura** (*Cercidiphyllum japonicum*, カツラ). It
adds only files, plus one id in a test list:
- `src/plants/species/katsura.ts`: the definition, the plan (`planKatsura`), the pad colour arc
  (`katsuraPadColour`) and the arrival of every mark at a growth (`katsuraArrivals`). The draw
  uses all three, and the tests check them.
- `src/plants/lib/katsura-paint.ts`: new helpers `heartOutline`, `paintHearts`, `paintTipHearts`
  and `paintShaggyBark`. No shared `lib/` helper was touched.
- `src/plants/species/katsura.test.ts`: `treeSuite('katsura', planKatsura)` plus its own checks.
- `src/plants/notes/katsura.ts`: the note from the brief (riparian, ring of trunks, the burnt-sugar
  smell of maltol), with the wine-red to blue-green leaf.
- `src/scenery/flora.test.ts`: `'katsura'` added to the waterfall's pinned flora list, after
  `japanese-maple`.

Fields:
- tier 4, `tree`, box 380×460, anchor .5/.94;
- habitats `back` and `meadow`: `cliff-1` and `bank-16`, the waterfall's two tree slots;
- `bloomColor` `#e3a24c`; no pollinators (it is wind-pollinated, and the brief has none);
  nativeName "Katsura";
- range: realms `japan`, biomes `montane-stream` and `temperate-forest`, climates
  `cool-temperate`, no `cultivatedIn`;
- description: "Katsura — round hearts that turn gold and smell of caramel."

The Japanese garden's flora is only the `garden` biome, so katsura does not leak there, and the
garden keeps its 25 species.

## How it is painted
- **Stems:** a ring of 4–6 stems from one base, spread across 10–16 units. The centre stems are
  tall and upright, the outer ones lean out by up to 0.46 rad and turn back up (negative
  gravity), so the clump opens like a vase. The stems come up one after another
  (t0 0 … 0.3).
  - Alternate stems are "back" stems, painted first in a paler grey (`#7e7a6e` toward stone), so
    the ring reads as having depth.
  - The bark is grey `#7e7a6e`. `paintShaggyBark` adds short vertical strips in two shared
    layers: dark furrows, and pale flakes source-over, each with a hairline of shadow along its
    lower edge. The strips fade in with the stem's width.
  - The limbs and twigs are a separate, paler and more transparent pass (opacity 0.5), so the
    crown is not crossed by ink.
  - 1–3 short wine-tinted suckers at the foot carry pairs of young wine-red hearts. Katsura
    sprouts freely from its base.
- **Crown:** a broad, lobed dome around the limb tips.
  - It is wide: 6th to 94th percentile of the tips, plus 16 units. Its height is capped at 0.75
    of the half-width.
  - The top uses a superellipse with exponent 1.65, which cuts the shoulders so the top mounds
    instead of going flat. The underside is a flatter ellipse.
  - The top is set halfway between the highest tip and the 8th-percentile tip, so one tall stem
    makes a bump, not a turret.
  - It is filled with a hex grid of overlapping pads (`paintPadMass`, flatness 0.7, 9 scallops,
    one body group). Limbs that reach past the dome carry pads out along them, so they make a
    lobe instead of a lone pompom.
- **Leaves:** round hearts (`heartOutline`): cordate, with a sinus at the base, a softly crenate
  margin and a small blunt tip, about as wide as long. They come in pairs on short spurs and are
  thick on the rim, facing out from the dome's centre, sparse inside.
  - Hearts of back pads are multiplied. Hearts of front pads are a separate source-over layer,
    so lit leaves cover the twigs behind them.
  - Fallen hearts in gold and pink lie around the foot.
- **Colour (the app has no seasons, so the growth arc carries them):**
  - The young growth is wine-red `#b5525c`: the sapling's tip hearts, then a clear rosy wash as
    each pad unfurls. The wash is light on purpose: a darker wine went mauve-grey mud while it
    greened.
  - Each pad then turns blue-green (`#8ea870`, cool blue-green shadow `#5f8a7c`).
  - From 0.74 the crown turns to the mature state: apricot-gold `#e3a24c` / `#e9b46a` with
    patches of pink `#e38f7e`. The patches come from a smooth noise over the crown, so they are
    pink areas, not an even salmon. The top and the outside turn first.
- **Growth:**
  - The seed mound comes first.
  - 0.1–0.5: the stems rise one by one with wine-red heart pairs at their tips.
  - 0.46–0.76: the pads unfurl rosy and green over, staggered per pad, while the tip hearts fade.
  - 0.74–1: the crown turns gold and pink.
  - 0.8–1: hearts fall.
  - Every mark grows in from nothing. The species test samples every pad and heart over 400
    growth steps.
- **Cost:** 80 ms median and 88 ms max at growth 1, 1.6×, seeds 1–12. That was timed on the main
  thread in headless Chromium, inside the 4–127 ms budget. The ginkgo measured 42 / 51 ms in the
  same run.
  - Almost all of it is the pad mass over a broad crown: about 50 pads. Without the pads it is
    42 ms.
  - Larger pads on a coarser grid, `density: 0.8` and one body group brought it down from
    100 / 114 ms. Batching the bark strips into two layers made no measurable difference.

## Looked at
All images are in `artifacts/katsura/`. They come from my own dev server on port 5413 and small
Playwright probes: a studio contact sheet (seeds × growths, with crops) and a garden probe that
runs an eval file. `npm run shots` was used for r1.
- **r1** (`r1-1440x900.png`, `r1-g1-1440x900.png`): the crown was two flat horizontal bands with
  a paper gap between them, which reads as maple tiers. The hearts were dark orange polka dots,
  and the twigs lay across the crown like ink. → An explicit dome filled with a pad grid.
- **r2–r3** (`r2-seeds.png`, `r3-seeds.png`): a broad, rounded crown on a ring of stems, but the
  colour was an even salmon and dark twigs crossed the whole crown. → Pink in patches, a paler
  limb pass.
- **r4–r5** (`r4-growth.png`, `r4-zoom.png`, `r5-zoom.png`): the growth arc works: wine,
  blue-green, gold. Close up, the stems ended in blunt stubs inside the crown. → The stems taper
  to 0.9, and front hearts are painted source-over.
- **In the garden, r1** (`katsura-r1-wf.png`, `katsura-r1-close.png`): it framed the scene well,
  but the bare stems took over half the height (a vase of wires with a crown on top). One outer
  limb ended in a lone pompom tuft. → Shorter, thicker stems, lower and wider limbs, lobes along
  outer limbs.
- **r6–r10** (`r6-seeds.png` … `r10-seeds.png`, `r10-growth.png`): a full, round, multi-stemmed
  cloud. Flat tops were fixed with the superellipse, and leader turrets in seeds 1, 6 and 12 with
  the blended top.
- **r11** (`r11-growth.png`): the wine-to-green crossover had gone mud; now it is a clean rosy
  wash. Bark crops: `r11-bark.png` to `r14-bark.png`.
- **In the garden, r2–r3:**
  - `katsura-r2-wf.png`: overview, planted on `cliff-1` and `bank-16`.
  - `katsura-r2-close.png`: close on `cliff-1`.
  - `katsura-r2-sunset.png`, `katsura-r2-night.png`.
  - `katsura-r2-phone.png`, `katsura-r3-phone.png`: phone, close on `cliff-1`, two seeds.
  - `katsura-r3-flora.png`: the flora line-up beside the maple.
- **r3, final** (after the last change):
  - `r15-seeds.png`: seeds 1–6 at growth 1.
  - `katsura-r3-wf.png`: noon overview on `cliff-1` and `bank-16`.
  - `katsura-r3-close.png`: close on `cliff-1`, beside a yamabuki.
  - `katsura-r3-night.png`: night overview.

**What reads well:**
- **Overview:** two broad, rounded gold-and-pink clouds on clusters of grey stems frame the
  falls. They are clearly not the green maple or the pines.
- **Line-up:** a rounded multi-stemmed dome beside the maple's single trunk and tiered red pads.
  It is unlike the ginkgo's single column.
- **Close and phone:** round leaf dabs in gold, apricot and pink. The suckers' wine hearts and
  the fallen hearts read as heart shapes.
- **Sunset:** the gold takes the warm light.
- **Night:** the crowns hold as muted apricot domes.

## Tests
- `npm run typecheck` passes.
- `VITEST_WORKERS=1 npx vitest run src/plants/species/katsura.test.ts src/scenery/flora.test.ts`:
  2 files, 27 tests pass. That includes the waterfall's pinned list and the garden's pinned 25.
- `katsura.test.ts`, beyond `treeSuite`:
  - a ring of at least 4 stems from one base;
  - a broad crown: at least 0.9 as wide as tall for every seed, median above 1.1, wider than 60 %
    of the box, inside the box;
  - every pad, heart, sucker leaf and fallen leaf arrives from 0, with no jump above 0.05 between
    400 growth steps. This caught the first fallen leaves, which arrived within about 0.03 of
    growth, inside one of the app's 24 growth steps.
  - the colour arc, wine (r ≫ g) → green (g > r) → gold (r > g ≫ b);
  - the heart outline is round (width/length 0.8–1.2) with a notched sinus.
- No local e2e, as briefed.

## For the orchestrator to place
- **docs/systems/plants-species-c.md** › Species:
  `| \`katsura\` | Katsura · Katsura | 380×460 · tree | back, meadow | \`#e3a24c\` | no | a ring of 4–6 grey, slightly shaggy stems from one base, opening like a vase, with wine-red suckers at the foot; a broad, lobed, rounded dome of round heart leaves in pairs; wine-red young growth, then blue-green, maturing to apricot-gold with patches of pink; fallen hearts (waterfall only) |`
  and under Helpers: `katsura-paint.ts`: `heartOutline` (a pure round cordate leaf outline with a
  sinus, crenate margin and blunt tip), `paintHearts` (hearts in one wet layer, sized by
  arrival), `paintTipHearts` (wine heart pairs at growing tips), `paintShaggyBark` (stem furrows
  and pale lifted flakes in two shared layers). Under Performance: `katsura | 608×736 (1.6×) |
  80 / 88 ms`, a main-thread probe, not comparable with the table's DPR-2 worker numbers.
- **docs/TESTING.md** matrix:
  `| W11.1 | Katsura: \`treeSuite\` plus a ring of ≥ 4 stems, a broad crown (w/h ≥ 0.9 per seed, median > 1.1) inside its box, every pad and leaf growing in with no jump over 400 growths, the wine → blue-green → gold arc, round heart leaves; offered only at the waterfall, the garden keeps its 25 | plants/species/katsura; scenery/flora | studio › every entry renders | ✔ |`
- **Studio order:** `katsura` sorts after `anemone`, so `allSpecies()[0]` is unchanged. The
  tier-4 boards (`plants-trees`) and the waterfall flora board gain a card between
  `japanese-maple` and the next id.

## Left open
- **Twigs through the crown:** like the other trees (multiplied pads), the limbs and the upper
  stems still show through the foliage as thin grey lines, most visibly on the phone close view.
  The front hearts cover only some of them.
- **Bark:** the shaggy strips are subtle. At the close view the stems read as smooth grey
  watercolour with faint furrows, not peeling bark.
- **Heart shape at garden scale:** in the crown the hearts read as round dabs, as the brief asks.
  Only the sucker and fallen leaves show the heart outline.
- **Tops:** seeds 5 and 12 still have a slightly square top or a small leader bump.
- **Cost:** at 80–88 ms it is the costliest tree in this probe, about twice the ginkgo.
- **Checks not made:**
  - the worker paint time (measured on the main thread only);
  - the planting sheet preview;
  - `tests/e2e/studio.spec.ts`;
  - the close view frames the tree's foot, so the crown is cropped at the top. The slot focus is
    not the species' to change.
