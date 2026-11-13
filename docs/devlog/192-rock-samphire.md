# 192 · Rock samphire (GP6, phase 15)

## What
The Greek coast's succulent of sea-sprayed rock: **rock samphire** (*Crithmum maritimum*, kritamo), a
tier-1 `small` plant. It adds only files:
- `src/plants/species/rock-samphire.ts`: the definition, the plan (`buildRockSamphire`), the pose
  (`poseRockSamphire`, pure, every mark at a growth value) and `rockSamphireReach` (for the box test).
- `src/plants/lib/rock-samphire-paint.ts`: new helpers (the fat finger, stalks, umbels). Only
  `ribbonInto` is imported from a shared helper; nothing shared was edited.
- `src/plants/species/rock-samphire.test.ts`, `src/plants/notes/rock-samphire.ts`.
- Rows in `docs/TESTING.md` (GP6.1) and `docs/systems/plants-species-a.md`.

Definition: tier 1, `small` (86×86, drawn in the 70-unit design box like the other tier-1 ground
plants, anchor .5/.8), habitats `['rock', 'shore']`, bloomColor `#cfd28a`, pollinators yes,
`nativeName: 'Kritamo'` (`el-Latn`, to check with a speaker).

## Range, size and slots
`range: { realms: ['mediterranean', 'europe'], biomes: ['coast'], climates: ['mediterranean'] }`
(ADR 0361's words), wild. The test uses the coast's real profile (`COAST_FLORA`): the Japanese
garden, the waterfall and the oasis do not offer it; the coast does.

`small` fits every coast `rock` slot (walls, cracks, the three splash rocks, the bastion shelf)
and the five `beach` slots. Checked in the garden at noon (`splash-1..3`, `crack-1/2`, `wall-3`,
`beach-2/4`): on a splash rock it sits on the boulder's top and reads against the turquoise sea; in
a wall crack it grows out of the stone; on shingle it reads against the pebbles.

## How it is painted
- **Fingers:** 12–14 stems from a short stretch of the crack, each forking twice (sometimes into
  three) into blunt cylinders a little fatter at the tip: 80–110 per plant. Glaucous sea-green
  (`#8cb08c` to `#a7c6a4`), a cooler shaded flank, a stripe on the lit side lifted back to paper
  (the gloss of a fleshy leaf). Some terminal fingers get a yellow tip and some basal ones a
  red-purple flush, growing in with age.
- **Umbels:** 6–7 pale stout stalks, each ending in a flat plate: a soft wash, thin rays to rounded
  clusters of tiny flowers (a shaded underside, pale pips lifted out). Lime-cream when fresh; a
  per-plant share (always one) ripens to olive and purple at the end of growth.
- **Crack and ground:** a thin dark rift under the cushion and a faint cool shadow.
- **Growth:** seed mound, a few forked fingers from the crack (0.05-0.35), the spreading cushion
  (to ~0.6), stalks from 0.58, plates opening from buds to ~0.95, ripening last.
- **Cost:** `def.draw` at 1.6× (138 px), growth 1, seeds 2–9, main thread in headless Chromium on
  the dev server (a throwaway probe): 11–16 ms, median 12 ms. Under the 60 ms aim.

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged.

## Looked at
Scratchpad `gp6-rock-samphire-stages.png`, `-close.png`, `-lineup.png`, `-garden.png`.
- **Round 1:** a tulip of big striped leaves under bamboo-like poles and foamy clouds. Fixed:
  smaller, more numerous fingers spreading sideways, a lower cushion, thin pale stalks.
- **Round 2:** sparse spidery umbels; **round 3:** one merged lime canopy. Fixed: fewer, smaller,
  separate plates of different heights on stalks of different lengths.
- In the tier-1 line-up it is the only glaucous mound with lime plates: not the ice plant (magenta),
  the caper (round leaves, white flowers) or the spearmint. At sunset in a wall crack it holds.

## Left open
- The plates are lumpy blobs; the thin rays are almost lost at overview size.
- All fingers share one blunt shape; a real plant is more irregular, with some stems hidden.
- The bluish bloom is only the colour; no separate glaucous glaze.
- The close crop was shot before the last lime lightening (`#d6d98f` to `#dde19b`).
- Not checked: night, the phone view.
- Not run: the full e2e suite (the task's CPU rules); only `planting-previews`, `plants`,
  `plant-card-phone` and `lazy-species-painters`.
