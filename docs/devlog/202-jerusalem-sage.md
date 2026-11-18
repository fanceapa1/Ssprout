# 202 · Jerusalem sage (GP14, phase 15)

## What
The phlomis of the Greek phrygana: **Jerusalem sage** (*Phlomis fruticosa*), a tier-3 `medium`
shrub. It adds only files:
- `src/plants/species/jerusalem-sage.ts`: the definition, the plan (`buildJerusalemSage`), the
  pose (`poseJerusalemSage`, pure, every mark at a growth value) and `jerusalemSageReach` (box test).
- `src/plants/lib/jerusalem-sage-paint.ts`: new helpers (the felted ovate leaf with lifted midrib
  and wrinkle veins, the broken wash, pale woolly stems, the whorl of hooded flowers). Only
  `ribbonInto` is imported from a shared helper; nothing shared was edited.
- `src/plants/species/jerusalem-sage.test.ts`, `src/plants/notes/jerusalem-sage.ts`.
- Rows in `docs/TESTING.md` (GP14.1), `docs/systems/plants-species-b.md` and the devlog index.

Definition: tier 3, `medium` (120×160, anchor .5/.94), habitats `['back', 'meadow']`, bloomColor
`#e6c040`, pollinators yes (bees work it hard). Range per ADR 0361: `realms ['mediterranean']`,
`biomes ['scrub', 'coast']`, `climates ['mediterranean']`, wild (no `cultivatedIn`). Not `marine`:
it is a land shrub. The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged.

**Native name.** The research doc gives φλόμος (flomos) only as *(verify)* (it is also the modern
Greek word for mullein), so as with the peacock's tail the native name is the Latin,
`Phlomis fruticosa` (`la`), and the card note opens with *Phlomis*.

## Slots: kept out of the sea
The research doc lists `meadow`, `back` and `rock`. As a `medium` plant on the coast:
- `rock` would give only `splash-1` (a rock standing in the sea) and `shelf-1`: the medium rock
  slots. A felted land shrub growing out of the sea looks wrong (the rock rose's problem), and a
  species cannot take one slot of a habitat without the other, so **`rock` is left out**.
- `back`: `scrub-1` (the cliff top right of the olive, a tree slot) and `scrub-3` (the foreground).
- `meadow`: `top-1` (tree slot), `top-2`, `mid-1` (large), `low-3`, `low-4` on the terraces.
Seven slots in all, none in or at the edge of the water; a test pins the list. The slots and the
scenery were not changed.

## How it is painted
- **Mound:** a broken grey-green wash (six soft lumps and a cooler lump low down), then 30 leafy
  shoot tips over a dome, each three opposite pairs of ovate, blunt, softly wrinkled leaves (a
  wash, a lighter cooler shade, midrib and four wrinkle veins lifted, strong granulation for the
  felt); about a quarter show their pale woolly underside. No twigs inside the mound, so nothing
  shows as dark spokes through the translucent leaves.
- **Flower stems:** four to six pale grey-green woolly stems rise from the mound's top (their foot
  painted over the leaves), nearly upright, of varied height.
- **Whorls:** two or three per stem, about 15 to 18 units apart, the top one smaller: a green
  calyx ball, 10 to 17 two-lipped hooded flowers round it (an arched golden hood, a paler lower
  lip, a dark mouth; back flowers deeper ochre), and a pair of drooping leaves under each.
  Paper is lifted from the mound under a whorl so the yellow stays clean.
- **Growth:** seed mound; a grey tuft of shoot tips from the base (0.05); the mound fills out by
  0.5; stems rise 0.46-0.8 with green budding whorls; the whorls open from the lowest up
  (0.64-0.98).

## Cost
`def.draw` at 1.6× (192×256), growth 1, seeds 1 to 11, main thread of headless Chromium on the
dev server (a throwaway probe): 46, 30, 41, 36, 34, 32, 25, 24, 24, 25, 31 ms, median 31 ms
(rock rose 21, sea lavender 12), inside the 4–127 ms range.

## Looked at
Scratchpad `gp14/`: the studio section (rounds 1 to 4), the coast at noon with the sage in all
seven of its slots, and close views of `low-3` and `scrub-3` (rounds 4 and 5).
- **Round 1:** whorls were flat yellow discs in a level row across all stems, like sunflowers;
  stems long, bare and fanned; leaves spiky and holly-like.
- **Round 2 and 3:** broader, blunter felted leaves; shorter, more upright stems; rounder whorls
  (the ring seen less flat, the hoods rising less); smaller, drooping bracts.
- **Round 4 and 5:** stem heights and spacing varied so the tiers do not line up across stems;
  the green calyx eye fades as the whorl opens; front flowers less foreshortened, so a whorl
  reads as a ball of hoods; the mound greyer and more silver.
- At overview size it is a grey-green mound with stacked golden pompons on upright stems: not
  the tree spurge's lime dome of forked stems, not the rock rose (pink, low), not the lavender
  (violet spikes).

## Left open
- In the studio a whorl still reads a little like a fan of petals from the side; the two-lipped
  hood shape only shows in a close view.
- The stems are a little even, like a bunch; a real plant has more, crowding stems, some leaning.
- The scene light makes the mound greener than the studio card; it could go greyer still.
- The broken wash shows as a pale ghost lump beside the mound on some seeds.
- Not checked: sunset and night, the phone view, the plant card in the garden.
- Not run: the full e2e suite (the task's CPU rules); only `planting-previews`, `plants`,
  `plant-card-phone` and `lazy-species-painters`.
