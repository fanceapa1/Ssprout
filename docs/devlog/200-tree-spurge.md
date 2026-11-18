# 200 · Tree spurge (GP13, phase 15)

## What
The lime dome of the Greek sea cliffs: the **tree spurge** (*Euphorbia dendroides*), a tier-3
`large` shrub. It adds only files:
- `src/plants/species/tree-spurge.ts`: the definition, the plan (`buildTreeSpurge`), the pose
  (`poseTreeSpurge`, pure, every mark at a growth value) and `treeSpurgeReach` (for the box test).
- `src/plants/lib/tree-spurge-paint.ts`: new helpers (the haze, the stems, the leaf tufts, the
  bract heads). Only `ribbonInto` is imported from a shared helper; nothing shared was edited.
- `src/plants/species/tree-spurge.test.ts`, `src/plants/notes/tree-spurge.ts`.
- Rows in `docs/TESTING.md` (GP13.1), `docs/systems/plants-species-b.md` and the devlog index.

Definition: tier 3, `large` (200×220, anchor .5/.93), habitats `['back']`, bloomColor `#c6cd5e`
(the research's bract colour), pollinators yes (small flies and ants, weak). Range
`{ realms: ['mediterranean'], biomes: ['coast', 'scrub'], climates: ['mediterranean'] }`
(ADR 0361's words), wild. The unit test uses the coast's real profile (`COAST_FLORA`): the coast
offers it; the Japanese garden, the waterfall and the oasis profiles do not.

**Native name.** Both Greek names in the research (δενδρώδης ευφορβία, and the folk γαλατσίδα for
spurges) are marked *(verify)*, so the card shows the Latin `Euphorbia dendroides` (`la`), as the
peacock's tail does. The note states the irritant latex as a fact and suggests no touching.

## Where it grows
The research lists the cliff-top scrub (`back`) and cliff ledges (`rock`). In the coast:
- **`rock`: kept off.** Every coast `rock` slot is `small` or `medium` (wall copings and cracks,
  the splash rocks standing in the sea, the bastion shelf), so a large plant fits none of them,
  and listing `rock` would only matter if a large rock slot were added later: a splash rock in the
  sea is exactly where a land shrub must not grow (the rock rose's reason too).
- **`back`: only `scrub-1`**, the promontory's cliff top right of the olive (a `tree` slot, which
  takes a large plant). The other scrub slots are small or medium. So the tree spurge has **one
  slot** in the coast, the one the Aleppo pine and the olive (both `back`) also compete for. The research says
  "on the cliff, never in the terrace", so `meadow` (the terrace beds, `mid-1` is large) is left
  out, and the pebble beach (`beach-2`, `shore`) is not its place either.
- A test pins it: the only coast slot it fits is `scrub-1`, and no splash rock fits it.

## How it is painted
- **Skeleton:** a short foot that forks in twos seven times (a fifth of the sixth-level limbs stop a
  fork early), the tips spread over a dome (about 172 wide, 160 tall). Each stem leaves its fork
  along the parent's line and bends out, so every fork reads as a soft Y, not a spoke. Red-brown
  at the foot (`#8a5a44`), paler and greyer towards the tips, thin and at 0.78 opacity.
- **Depth:** from the third fork on, the limbs alternate between the near side of the dome (their
  tips inside the outline, painted over the stems) and the far side (on the rim, cooler, painted
  under the stems). That keeps the inside of the dome leafy and lets the forks show between tufts.
- **Leaves:** a tuft of 10–14 narrow blue-green leaves (a deeper lower half) at every tip; the
  last two forks keep part of their tuft when they branch, the older ones drop theirs.
- **Haze:** a broken wash over the dome (a large one behind the trunk's first fork, mid lumps on
  the fourth forks, small ones on the sixth), blue-green, turning lime as it blooms.
- **Bloom:** a flat head of 4–6 lime-yellow bracts round a small gold heart on every tip, opening
  from the top of the dome outward between growth 0.6 and 0.96.
- **Growth:** seed and shoot (to 0.2); a leafy fork with tufts on its tips (0.2–0.35); the
  forks multiply and the whole plant scales up to a blue-green dome (0.55, the winter leaves); the
  lime heads and haze (0.6–1).

## Cost
`def.draw` at 1.6× (320×352), growth 1, seeds 1 to 11, main thread of headless Chromium on the dev
server (a throwaway probe in the shot's eval): 53 to 61 ms, median 55 ms. Inside the 4–127 ms
range; the leaf tufts are the bulk of it.

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged.

## Looked at
Scratchpad `gp13-studio-stages.png`, `gp13-studio-seed3.png`, `gp13-close.png`, `gp13-overview.png`.
- **Round 1:** a small tree on a long trunk with a ring of dark starry tufts on the rim only; the
  dome was hollow, the stems a fan of spokes.
- **Round 2:** seven forks, a shorter foot, wider dome; tufts still only on the rim (an umbrella).
- **Round 3:** near and far limbs, tufts kept on the last forks, a haze behind the first fork:
  a full lime dome with the forking visible between the tufts. In the close view on `scrub-1`
  it is a lime cushion on the cliff edge beside the olive; at the overview a small lime dome at
  the top right of the cliff.
- Against the oleander: no pink, no knife leaves, a dome not a fountain.

## Left open
- A short Y of trunk shows under the dome; a real tree spurge is often bushier at the foot.
- The summer-dormant look (leaves gone, red stems bare) is not painted; growth 1 is spring.
- One slot only in the coast (`scrub-1`); if the orchestrator wants it more often, a large slot on
  the cliff top would be a scenery change.
- Not checked: night, sunset, the phone view, the plant card in the garden.
- Not run: the full e2e suite (the task's CPU rules); only the planting-related specs below.
