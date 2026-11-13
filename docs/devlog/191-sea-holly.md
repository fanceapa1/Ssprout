# 191 · Sea holly (GP9, phase 15)

## What
The Greek coast's frosted beach thistle: **sea holly** (*Eryngium maritimum*, eryngio), a tier-2
`small` plant for the beach sand. It adds only files:
- `src/plants/species/sea-holly.ts`: the definition, the plan (`buildSeaHolly`), the pose
  (`poseSeaHolly`, pure, every mark at a growth value) and `seaHollyReach` (for the box test).
- `src/plants/lib/sea-holly-paint.ts`: new helpers (the spiny blade shared by leaves and bracts,
  stems, the heads). Only `ribbonInto`, `inPlantSpace`, `groundShadow`, `seedMound`, `shadowSide`
  and the stem helpers are imported; no shared helper was edited.
- `src/plants/species/sea-holly.test.ts`, `src/plants/notes/sea-holly.ts`.
- Rows in `docs/TESTING.md` (GP9.1) and `docs/systems/plants-species-a.md`.

Definition: tier 2, `small` (86×86, anchor .5/.92), habitats `['shore']`, bloomColor `#8fa6c4`,
pollinators yes, `nativeName: 'Eryngio'` (`el-Latn`, to check with a speaker).

## Range, size and slots
`range: { realms: ['mediterranean', 'europe'], biomes: ['coast'], climates: ['mediterranean'] }`
(ADR 0361's words), wild. The test uses the coast's real profile (`COAST_FLORA`) and shows that the
Japanese garden, the waterfall and the oasis do not offer it; the coast does.

**Small, so the beach has a real choice.** The sea daffodil is `medium` and fits `beach-2` (large)
and `beach-3` (medium) only. A medium sea holly would compete for those same two slots and leave
the three small ones (`beach-1`, `beach-4`, `beach-5`) with nothing. As `small` it fits all five,
and in the two big slots the player picks between the tall white umbel and the low blue clump.
It is also the plant's real habit: a low rounded clump, wider than tall, which suits a square box.
(The other tier-2 species are mostly medium; `caper` shows tier 2 may be small.)

## How it is painted
- **Leaves:** 6–7 rounded, leathery blades with 4–5 spiny teeth a side, glaucous silver-blue
  (`#a4b9b4` to `#8aa6a8`), a cooler shaded half, and the midrib and side veins *lifted back to
  paper* so they read as chalk. The wet layer dries with a high sharpness and a small edge width,
  so the spine tips stay crisp. Pairs of smaller stem leaves sit at the three nodes and turn bluer
  with height.
- **Stems:** a short trunk and three branch levels (side branches, low outward arms, short twigs),
  silver-green at the foot and flushing blue towards the top and with growth.
- **Heads:** seven. Each is an amethyst knob (two washes, a cool shaded underside, tiny florets
  lifted out of it as pale facets, a highlight) in a fan of 7–8 broad spiny blue-grey bracts with
  a lifted midrib. Bracts behind the knob are painted before it, the outer ones after. A bud has a
  small knob with its bracts nearly closed, in a grey-green that turns blue as it opens.
- **Cast shadow:** a cool blue-grey wash (`#8aa0b4`, opacity .3) under the clump, wider than the
  sea daffodil's, plus the leaves' own deep half, so the pale plant holds against the pale sand
  without any outline.
- **Growth:** seed mound, rosette of leaves (0.05-0.3), trunk (0.26-0.46), branches and stem
  leaves (0.44-0.72), heads from buds (0.6) to open (to ~0.97), florets last.
- **Cost:** `def.draw` at 1.6×, growth 1, seeds 2–9, main thread in headless Chromium on the dev
  server (a throwaway probe): 10–15 ms, median 11 ms (first run warms up). Under the 60 ms aim.

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged.

## Looked at
Scratchpad `gp9-sea-holly-stages.png`, `-close.png`, `-lineup.png`, `-garden.png`
(`-garden-sunset.png`, `-garden-overview.png`).
- **Round 1:** leaves, veins and heads already read; but it was a tall candelabra, heads in a
  flat row with dark indigo knobs hidden by front bracts, buds like green peas.
- **Round 2:** shorter trunk, wider arms; the bracts became a 2D fan around the head's axis, so
  the knob shows (a 3D ring projected to the screen flipped bracts when one pointed at the viewer,
  which the continuity test caught); smaller heads, bigger leaves; bud bracts spiky.
- **Round 3:** lighter knobs and more, larger lifted florets; fainter bract veins.
- In the coast beside a sea daffodil at noon and at sunset it is the only cool blue plant and
  holds against the sand, the sea behind it and the daffodil's white. In the tier-2 line-up it
  stands apart from the lavender (soft violet dome, fine spikes), the balloon flower and the iris
  (smooth bells, strap leaves).

## Left open
- The branching is still tidy and almost symmetrical (a candelabra of seven heads); a real clump
  is more irregular and some heads are lower and hidden by leaves.
- The knobs are a little dark at their centre and the florets read as facets, not as tiny flowers
  with stamens; no bee was painted on it (pollinators come from the flag).
- Stems are dark where the leaves overlap them (multiply); the stem-leaf pairs are small.
- Not checked: night, the phone view, the plant card text in the garden.
- Not run: the full e2e suite (the task's CPU rules); only `planting-previews`, `plants`,
  `plant-card-phone` and `lazy-species-painters`.
