# 123 · White water lily (OP13, phase 13)

## What
The oasis's second water plant (owner decision, 2026-11-06: a released garden needs at least two
species per habitat): the **white water lily**, *Nymphaea lotus*, the white Egyptian lotus. It is a
tier-2 `medium` plant for water slots only. It adds only files, plus one id in a pinned test list:
- `src/plants/species/white-water-lily.ts`: the definition and the plan (`planWhiteWaterLily`).
- `src/plants/lib/white-water-lily-paint.ts`: new helpers, imported only by this species:
  `toothedOutline` and `paintToothedPad` (the saw-edged pad) and `paintStarFlower` (sepals, two
  rows of narrow pointed petals, the stamen crown), plus `paintPointedBud`. No shared `lib/`
  helper was edited. `paintPetal`, `petalPose`, `plantFrame` and the growth easings are only
  imported.
- `src/plants/species/white-water-lily.test.ts`: `smallSuite('white-water-lily')`, plus plan
  checks: water only, medium, reflects; every pad has 14 or more teeth and a toothed outline; at
  least one open flower held more than 8 units above the water with 9 or more outer petals; pads
  and flowers inside the box over 60 seeds.
- `src/plants/notes/white-water-lily.ts`: the Note below.
- `src/scenery/flora.test.ts`: `'white-water-lily'` added to the pinned oasis list (sorted, one per
  line). The garden keeps its 25 and the waterfall its own: both pinned lists still pass.

Fields:
- **Tier 2**, `medium`, box 130×96, anchor .5/.68. The tier follows the recipe: it is a
  small-family painter (`smallSuite` takes tiers 1–2), and it is as rich as the garden's tier-2
  water lily and the cattail. That gives the oasis two tier-2 water plants for 25–49-minute
  sessions. The basin's large slots take it too.
- `habitats: ['water']`. `reflect` is left at its default (true).
- `range: { realms: ['n-africa-arabia'], biomes: ['wetland'], climates: ['arid'] }`, wild only.
  The realm keeps it out of the Japanese garden and the waterfall.
- `nativeName: 'Nilufar'`, `nativeLang: 'ar-Latn'`. bloomColor `#f8f4ea`. `pollinators: true`.
- The description is the Line below.
- The id sorts last, so `allSpecies()[0]`, `ui-shell` and `widget` are unchanged. It is the last
  card in `plants-a-review/lineup-t2`, right after the garden's water lily, so the two sit side
  by side there.

## Spec: White water lily — *Nymphaea lotus* — nīlūfar (نيلوفر) *(verify the Darija)*
- **Range:** wild: `{ realms: ['n-africa-arabia'], biomes: ['wetland'], climates: ['arid'] }`.
  Kew (POWO) lists it as native across tropical Africa and on the Sahara's edges: Egypt (the Nile
  valley and Delta), Mauritania, Mali, Niger, Chad and Sudan. It grows in still, warm,
  fresh water: pools, swamps, the edges of slow rivers and seasonal Sahelian ponds.
  - **Flag for the owner:** I found no record of it wild in Morocco or the Draa, and none in a
    named Saharan guelta.
  - §6 Pitfalls says "No papyrus and no blue lotus. Both are Nile plants. Moroccan palmeraie
    basins hold water for irrigation". This plant is the blue lotus's white Nile sister.
  - It is in the basin by the owner's decision. The Note names the Nile and the Sahel, not the
    Draa, and nothing claims it grows wild in the palmeraie.
  - The European thermal population (Băile Felix, Romania) is not a relict, and the range ignores it.
  - If a strictly Moroccan second water plant is wanted later, *Nymphaea alba* is native to North
    Africa's mountain lakes. It has smooth pads and would blur with the garden's water lily.
- **Habitat and slot:** open still water: `basin-1…5` and `shallows-3` (medium). It never takes
  the small `shallows-1/2`.
- **Tier and size:** 2, medium. Water plant. Pollinators: yes (beetles at night, bees in the
  morning).
- **Bloom:** in the warm season, and in the Sahel through and after the rains, roughly July to
  November.
  - It blooms at night: each flower opens at dusk, stays open through the night and closes by
    late morning, for 3–4 nights.
  - bloomColor `#f8f4ea`.
- **Names:**
  - Arabic: *nīlūfar* (نيلوفر, "nilufar"), the classical name for water lilies, which is where
    "nenuphar" comes from. An Arabic encyclopedia page gives the species as نيلوفر اللوتس, also
    "white Egyptian water lily".
  - Egyptian Arabic: *bashnīn* (بشنين). An old source attaches it to the blue lotus, so it is
    not used *(unverified for the white)*.
  - No Darija or Tamazight name was found *(verify with a speaker)*.
- **Illustrator:**
  - **Pads:** round, floating, sharply **toothed** all round, with a deep narrow sinus.
    - Dark green (`#55764c`, deep `#3f5d41`), with a bronze (`#7d5a3c`) or purple (`#634457`)
      flush toward the far rim.
    - Some pads have a few dark mottles. Faint pale radiating veins.
  - **Flower:** a large white star (`#f8f4ea`) held a hand above the water on its stalk.
    - 4 green-backed sepals (`#7d8f5a`), then 9–11 outer and 7–9 inner narrow, pointed petals.
    - A pale pink-cream blush (`#efd6cb`) at the petal bases.
    - A crown of incurved golden stamens (`#d8ab4c`, deep `#b9832e`).
  - **Bud:** pointed, slim, green, on a short stalk.
  - **Small size:** white stars on dark round pads in the turquoise.
  - **Unmistakable:** the saw-toothed pad rim, and the flower raised above the water with many
    narrow petals. The garden's water lily has smooth, paler sage pads and a pink-tipped cup
    lying on the water. The lotus has raised cupped leaves, a pink flower on a tall stalk and a
    seed pod.
- **Note:** The white Egyptian lotus opens at dusk and closes again by late morning, so its
  stars are seen at night and in the early light. It grows wild in the still pools of the Nile
  and the Sahel; its saw-toothed pads tell it from the smooth-edged water lilies.
- **Line:** "White water lily — night stars on saw-edged pads, shut by noon."

## How it is painted
- **Pads:** 4–6 pads, r 12–16, squashed to 0.32 (the low eye-level basin, devlog 121). They are
  laid back to front and kept inside the box.
  - The body is a `wetInWet` wash of the toothed outline, its deep side mixed with the pad's
    flush, then a flush glaze fading from the far rim.
  - The wash smooths the outline, which loses the teeth. So the teeth are put back as 25–32
    small forward-raked `needle` dabs in one wet layer on the rim.
  - Teeth on the near rim are a shade darker, and those on the far rim take the flush.
  - Mottles show on about 45 % of seeds. Faint pale veins.
- **Flowers:** 1–2 open flowers, plus a bud on 60 % of seeds.
  - The stalk rises 9–14 units (6–9 for the bud) from a dark collar on the water. It stops
    under the front petals, so no line shows through the white.
  - Each petal is a `paintPetal`, white source-over, its base blushed and its tip faintly
    shaded. The order is: back inner petals, the stamen crown (22 gold strokes round a pale
    disc), then the front inner petals.
- **Time of day:** not supported. `SpeciesDrawOptions` has no time, and sprites are cached per
  growth step, so it always shows open. Showing it closed at noon would need a contract change,
  which the brief ruled out.
- **Growth** (tested continuous over 200 steps):
  - from 0: a ripple ring and a faint water glaze;
  - 0.02–0.55: the pads unroll from rolled spikes, one after another, and their teeth sharpen
    from 0.3 of each pad's own growth;
  - 0.42–0.74: the stalks rise, each with a pointed green bud;
  - 0.7–1: the buds part and the petals swing open while the bud fades. The crown rises from
    a quarter open.
  - The late bud only loosens (0.82–1), showing a white slit.
- **Cost:** at growth 1 and 1.6×, seeds 2–9, measured on the main thread in headless Chromium
  against the dev server, on a loaded machine:
  - first version: 104 ms median, 112 ms max (cattail 26 and water lily 51 in the same run);
  - after cutting the tooth layer to one fill: 64 ms median, 68 ms max (cattail 18).
  - That is inside the 4–127 ms budget, but it is one of the heavier tier-2 species.

## Looked at
All shots are in `artifacts/op13-lily/` (gitignored).
- The app shots plant the lily into `basin-1`, `basin-3`, `basin-4` and `shallows-3` and a cattail
  into `basin-2`. Each uses `sprout.start(25, { speciesId, sceneryId: 'oasis', slotId })` and
  `completeSession()`, then `sprout.plants.settle()` and `plantsReady()`.
- Round 1, `r1-1440x900.png`, `r1-g1-s1/s2-1440x900.png`:
  - the white star reads well;
  - the pads are near-black, and black knots form where they overlap;
  - the teeth do not show: the wash smooths them into a soft grey fringe under each pad;
  - the stalk shows through the front petals and the bud;
  - the stamens read as a crown of flames;
  - the flush is invisible.
- Round 2, `r2-g1-s1/s2`:
  - the pads are lighter and more spread out;
  - the stalk now stops under the petals;
  - the crown is finer: 22 thin incurved strokes;
  - the ink saw line I tried on the near rim hangs below the pad as a lace edge, not teeth.
- Round 3:
  - `r3-g1-s1` has the teeth as `leaf` dabs: fat lobes, so the pads look like cogs, and they
    darken where they overlap the pad;
  - `r3b-g1-s1` has the teeth as small `needle` dabs: they read as a saw. I then made them
    more numerous and finer.
  - In the app: `r3-oasis-close` (noon), `r3-oasis-overview`, `r3-oasis-sunset`,
    `r3-oasis-night`, `r3-oasis-phone`, `r3-oasis-phone-overview`. White stars on dark toothed
    pads read in the turquoise at every one. Night is its best moment: the white holds against
    the violet water.
  - Beside the cattail the scale is right.
  - `r3-lineup-t2` (crop in my scratchpad) shows it next to the garden's water lily: darker
    saw-edged pads and a raised white star, against smooth pale pads and a pink cup lying on the
    water. They are clearly different, and the lotus (tier 3) shares nothing with it.
  - `r3-flora-oasis` is the oasis's tier board. `r3-growth` is the stage cards: pads first,
    then a bud at 0.55, half open at 0.8, open at 1.
- Round 4, `r4-g1-s3`, `r4-oasis-close`:
  - one fill layer for the teeth (cost);
  - a stronger flush, which now shows as a bronze-violet far rim at close range;
  - the gold is softened to `#d8ab4c` (it was at the 0.135 chroma ceiling).
  - `r5-1440x900.png` is the final studio section.

## Left open
- **Range against §6 Pitfalls:** it is a Nile and Sahel plant, not a Draa one. This is the
  owner's call (see the Spec flag).
- **No Darija name found.** `Nilufar` (`ar-Latn`) is classical Arabic and needs a speaker's check.
- **No time-of-day pose:** it is always open, even at noon, when the real flower is shut. It
  would need time in `SpeciesDrawOptions` or a per-time sprite: a contract change.
- **At studio-card size** (growth 0.3) the teeth read as a dotted rim rather than a saw. In the
  app they read as a fine serration.
- **The teeth sit a hair outside the wash's soft edge**, so at full close-up some look like separate
  thorns rather than the rim's own points.
- **A stalk can rise from a spot that a nearer pad covers.** It is then painted on top of that
  pad, as if it came through it. Flowers are always drawn after pads.
- **Cost is 64 ms**, mid-budget but heavy for tier 2. The next cut would be fewer petal layers.

## For the orchestrator to place
`| 123 | [OP13: white water lily](123-white-water-lily.md) | Nymphaea lotus for the oasis basin: dark round pads with saw-toothed rims, a narrow sinus and a bronze-violet flush, white many-petalled stars held above the water round a gold stamen crown, pointed green buds; the second water species | Nile/Sahel range vs §6 pitfall; Darija name unverified; no time-of-day pose |`

`| \`white-water-lily\` | White Water Lily · Nilufar | 2 | water | 130×96 · .5/.68 | \`#f8f4ea\` | yes | 4–6 dark round floating pads with sharply toothed rims, a narrow sinus and a bronze or violet flush; 1–2 white stars of many narrow pointed petals held above the water round a crown of golden stamens, a pale pink blush at the base; a pointed green bud (oasis only, wild) |`

`| OP13.1 | White water lily: \`smallSuite\` (determinism, seed variety, continuity over 200 growths); water only, medium, reflects; toothed pads (≥ 14 teeth), an open flower held above the water with ≥ 9 outer petals, inside the box; the oasis offers it, the garden keeps its 25 and the waterfall its own | plants/species/white-water-lily; scenery/flora | studio › every entry renders | ✔ |`
