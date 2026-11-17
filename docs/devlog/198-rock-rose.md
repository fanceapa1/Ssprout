# 198 · Pink rock rose (GP12, phase 15)

## What
The cistus of the Greek phrygana and maquis: the **pink rock rose** (*Cistus creticus*, kistos), a
tier-2 `small` plant. It adds only files:
- `src/plants/species/rock-rose.ts`: the definition, the plan (`buildRockRose`), the pose
  (`poseRockRose`, pure, every mark at a growth value) and `rockRoseReach` (for the box test).
- `src/plants/lib/rock-rose-paint.ts`: new helpers (the wavy felted leaf, the broken wash, twigs,
  the crumpled five-petal flower with its boss, buds, fallen petals). Only `ribbonInto` is
  imported from a shared helper; nothing shared was edited.
- `src/plants/species/rock-rose.test.ts`, `src/plants/notes/rock-rose.ts`.
- Rows in `docs/TESTING.md` (GP12.1), `docs/systems/plants-species-a.md` and the devlog index.

Definition: tier 2, `small` (86×86, anchor .5/.92), habitats `['back', 'path']`,
bloomColor `#c9609a`, pollinators yes (bees work cistus), `nativeName: 'Kistos'` (`el-Latn`, to
check with a speaker). The research doc also lists cliff-top ledges (`rock`), but the coast's
`rock` habitat is walls and splash rocks in the sea (a bush on a rock in the water looked wrong
at noon), so `rock` is left out; `meadow` is not in the doc's list either.

## Range, size and slots
`range: { realms: ['mediterranean'], biomes: ['scrub', 'coast'], climates: ['mediterranean'] }`
(ADR 0361's words), wild. The unit test uses the coast's real profile (`COAST_FLORA`): the coast
offers it; the Japanese garden, the waterfall and the oasis profiles do not.

**Small, because the path is.** The five `path` slots of the coast are all `small`, so a medium
rock rose (the research's size) could never stand on the gravel edge, one of its two habitats.
As `small` it fits all five path slots and the five scrub slots that are not the tree's
(`scrub-2` to `scrub-6`; a medium plant would fit only `scrub-3`). It is also the habit: a low mound wider than tall, which suits a squat box. A test pins the slot counts.

## How it is painted
- **Mound:** a broken grey-green wash of seven soft lumps, seven grey-brown twigs fanning from the
  base to the rim of a dome (each forking twice), and about 140 opposite pairs (10 on each main twig, 5 on each fork) of small wavy-edged,
  felted grey-green leaves (a wash, a cooler shaded half, a faint midrib lifted).
- **Flowers:** 13 flat flowers scattered over the mound's top and sides, each five crumpled petals
  (a rippled, faintly notched rim; rose pink to mauve; a deeper base; one soft crease lifted to
  paper per petal), a lifted centre and a yellow-orange boss with stamen dots. Paper is lifted
  from the leaves and twigs under each open flower so the pink stays clean.
- **A day's flowers:** two flowers stay fat reddish buds with a green calyx, one stays half open,
  seven fallen petals lie on the ground.
- **Growth:** seed mound; two or three grey-leaved twigs (0.07-0.35); the leafy bush (0.3-0.6) with
  buds from 0.45; flowers opening from 0.56 to 1, staggered; fallen petals last (0.62-0.92).

## Cost
`def.draw` at 1.6× (138 px), growth 1, seeds 2 to 11, main thread of headless Chromium on the dev
server (a throwaway probe), first run 46 ms, then 20 to 27 ms, median 21 ms. Under the 60 ms aim.

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged.

## Looked at
Scratchpad `gp12-rock-rose-stages.png`, `-close.png`, `-lineup.png`, `-garden.png`.
- **Round 1:** a bunch of dark sticks with a few big pointed leaves; flowers read as daisies with
  ray stripes (three creases a petal); big ghost lumps of wash.
- **Round 2:** many smaller, blunter leaves, thinner pale twigs, one crease a petal, paper lifted
  under the flowers (first as a white halo, then smaller), flowers spread over the whole mound
  rather than a crown on top, a round dome with low side twigs, fainter wash lumps.
- In the line-up it is the only low grey mound with flat pink flowers: the oleander is tall
  with tubular clusters, the damask rose has full double cups on arching canes, the azalea is a
  pink-magenta cloud with no leaf structure, the taniutsugi has bells on straight stems.

## Left open
- The twigs still show as straight dark spokes through the translucent leaves (multiply); a real
  cistus is a tangle of crooked twigs, mostly hidden.
- The petals read as softly rippled discs; the crumpled-silk look (creases and a ruffled rim)
  only shows in a close view.
- The seedling (0.25) is a tidy upright fan of twigs, not yet a rounded tuft.
- The ladanum and goats' beards line of the card note is a well-known fact (Herodotus,
  Dioscorides) that the research doc does not carry; it should be checked.
- Not checked: night, the phone view, the plant card in the garden, slots other than those shot.
- Not run: the full e2e suite (the task's CPU rules); only `planting-previews`, `plants`,
  `plant-card-phone` and `lazy-species-painters`.
