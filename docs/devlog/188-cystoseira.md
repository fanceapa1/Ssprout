# 188 · Cystoseira (GP10, phase 15)

## What
The Greek coast's second water plant: **cystoseira** (*Cystoseira*, the Mediterranean "forest"
brown alga), tier 2, `medium`, habitat `water`. It adds only files:
- `src/plants/species/cystoseira.ts`: the definition, the plan (`planCystoseira`), the pose
  (`poseCystoseira`, pure: every mark at a growth value) and `cystoseiraReach` (for the box test).
  It imports `ribbon` from `lib/baikamo-paint` and the growth and frame helpers; no shared helper
  was edited.
- `src/plants/species/cystoseira.test.ts`: `smallSuite('cystoseira')` plus pose continuity over 240
  growths (3 seeds), inside the box (30 seeds), the bush's shape, bladders and fertile tips, the three
  growth stages, the definition, the range against all four gardens and the coast's slots.
- `src/plants/notes/cystoseira.ts`: an alga with a holdfast, not a plant in the strict sense; small
  golden forests shelter young fish and mark clean water (two sentences, within 330 characters).
- Docs: the row in `docs/systems/plants-species-a.md`, `GP10.1` in the `docs/TESTING.md` matrix.

Definition:
- box 120×92, anchor .5/.74, bloomColor `#b9a35a`, `pollinators: false`, `nativeName: 'Cystoseira'`
  (`la`: no common Greek name found);
- `rimLight: false` and no ground shadow, as the Posidonia (the system casts none on `water`);
  the default reflection stays;
- `range: { realms: ['mediterranean'], biomes: ['marine'], climates: ['mediterranean'] }`
  (ADR 0361's words), wild only. The coast offers it; the Japanese garden, the waterfall and the
  oasis do not (tested against each).

**Slots.** As a `medium` water plant it fits `shallows-1` (large, but held by the Posidonia
meadow in practice), `shallows-2`, `shallows-4`, `shallows-6` and the rock pool `pool-2`
(tested with `compatibleSlots`). `pool-1` and `pool-3` are small and cannot take it; making it
`small` would fit all nine water slots but a 86×86 box is too tight for a bush. No scenery
code was touched.

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged. The tier-2 boards and the
coast's flora line-up gain a card.

## How it is painted
- **Plan**: a main bush and two smaller satellite tufts (scale .36–.62) on three stones. Each bush
  is a short stalk, 8–10 primary branches fanning round it, 5–7 secondaries on each, 3–5 branchlets
  on each secondary and one more on its tip: about 150 branches for the main bush. A branch is a
  path in 3D on the bed (curling over, pulled toward the current), projected for the cliff's view
  (bed squashed by .42, rise by .78). Children sprout from a fixed point of the parent's full
  path and start growing when the parent has reached it.
- **Layers**: the stones (shade, body, lift, a warm underside, granulated) → a wet bloom of amber
  blobs under the primaries and secondaries (edge pooling, flow) → far branches (cooler, softer) and
  near branches in two wet layers, level by level, each with a pale golden tip and, on the two
  middle levels, a blue-green sheen glazed along the upper edge → a detail layer: bead-like bladders
  with a lifted glint, swollen fertile tips, pale epiphyte flecks close up, and the sea's surface
  glints lifted out of it.
- **Under the water**: the turquoise is mixed into every pigment (27 % low down, 14 % high), the
  branch layers dry at .56–.7 opacity so the sea shows through.
- **Growth**: stones and stalk first (0–0.1), the primaries fan out (0.05–0.5), secondaries and
  branchlets follow their parent, bladders from 0.5, fertile tips from 0.82, the satellites from 0.3
  and 0.46: a stalk and a few fronds on a stone, a small tuft, the full bush.

## Cost
`def.draw` at 1.6×, growth 1, seeds 1–12, main thread in headless Chromium on the dev server (a
throwaway probe): median 21 ms, 19–23 ms. Under the 60 ms aim.

## Looked at
Studio entries and the app at `?dev&scenery=coast` (plants in `shallows-2/4/6` and `pool-2`):
- **r1** (growth 1): the structure read as a heather sprig, but the fertile tips and bladders looked
  like leaves, the amber bloom was polygonal, the colour a grey olive. → smaller beads and tips,
  28-point soft blobs, warmer pigments, a denser, rounder canopy.
- **r2** (garden, noon): gold-orange and a little loud on the water, standing above it. → more sea
  in the pigments, lower layer opacity.
- **r3**: the bush read as a tree with a long bare stalk → stalk shortened, primaries from the stalk's
  upper half, lower elevation for a wider dome.
- Final: stages (`gp10-cystoseira-stages.png`), the line-up on a sea gradient beside the baikamo,
  lotus, water lily, white water lily, cattail, mizubasho and Posidonia (`gp10-cystoseira-lineup.png`:
  the only low golden bush, nothing above the water, no ribbons), the garden overview at noon with
  the shallows and the rock pool (`gp10-cystoseira-garden.png`), a close view at sunset
  (`gp10-cystoseira-close.png`). The sea's glints and swell pass over it as over the Posidonia.

## Left open
- At growth 0.1 only the stalk shows on the stone; the "few short fronds" start at about 0.2.
- In the rock pool (`pool-2`, medium) the three tufts spill a little over the pool's rim onto the
  rock; it is fine at the overview but looks crowded close.
- At sunset the plant goes a cool olive; it does not pick up the warm light as the sea does.
- The blue-green sheen only shows close up; at the overview it is lost in the amber.
- Bladders, fertile tips and epiphytes are sub-pixel at the overview (the golden mass carries it).
- Not looked at: night, phone, the planting-sheet preview card (covered by the e2e specs only).
- A peacock's-tail task (pale chalky fans) should be compared with it in the shallows.

## Tests
- `npm run typecheck` passes.
- Unit and e2e results are in the task report.
