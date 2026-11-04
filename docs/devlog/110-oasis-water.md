# 110: The oasis's water (O3)

Lines for the orchestrator to place:

- Devlog index: `| 110 | [Oasis water](110-oasis-water.md) | O3: the oasis's water painted in parts: the stone basin (lime-washed coping, wet-stained inner faces, turquoise into green-brown depths, the bluff and ksar reflected, steps, sluice gate), the clay-lined seguia with a small fall over each terrace wall, and the braided oued over gold sand | Done |`
- TESTING, §1a, after O2.2:
  - `| O3.1 | Water painting: the water element is three steps (basin, seguia, oued), pinned recording hashes, no part over one big mark's work (overview and the basin's corner close up), every step in many parts; the steps in the water and the sluice gate across the coping; each fall off a wall's coping inside its box; the oued's bars in its water, the big one the layout's bar and none on the shallows' slots; the boxes exported for daylight and motion | scenery/oasis/water (all) | — | ✔ |`

## What
- `src/scenery/oasis/paint-water.ts` replaces the draft's `basin`, `seguia` and `oued` steps
  (wired in `index.ts` like O2's rock). The shapes stay the layout's; nothing in `layout.ts` or
  `geometry.ts` moved, so every slot and framing test is unchanged.
- **Basin**: coping, near face and inner faces; joints square to each wall; a wet, algae-tinged
  stain at the waterline; turquoise into deep teal and green-brown; the reflection of the bluff
  and ksar squeezed to 0.36 about the far waterline (the teal lifted first so the red reads warm),
  broken by slow lifts; inlet ripples; five steps down the right wall (two dry, three under
  water); a sluice gate (cut, two posts, board, thin spill) near the overflow corner.
- **Seguia**: clay-lined cuts with a shaded far face and broken dark wet edges; a small fall over
  each terrace wall (lifted spill, thin threads, wet pisé, churn, spray haze); the sluice channel.
- **Oued**: damp banks lost into the dry sand, gold sand under milky blue-green water, braided
  threads round three bars (the big one is the layout's `BAR`), riffles, flow marks,
  lost-and-found edges, pebbles. No reeds.
- **Seams**: `WATER_BOXES` and `WATER_SHAPES` for O5's basin plate and O6's falls and glints;
  `ouedAt(s, u)` to place things along and across the oued.
- Studio `oasis-water`: the whole element, the basin's corner (steps, gate), a fall, the oued's
  bar, the scene. Details in docs/systems/scenery.md › Oasis › Water.

## Looked at
Shots in `artifacts/o3-water/` (in the worktree). References: the waterfall's and the garden's
1440×900 shots.
- **Round 1** (`o3-s1` studio, `o3-r1-1440x900`): paper gaps round the basin's water; the coping
  joints were long diagonal slashes (they followed the rim's foreshortening); the sluice gate was
  two rotated teal squares; the falls read as glass tumblers; the oued was olive-green, the bars
  hard-edged potatoes with dark seed-like pebbles; the reflection invisible.
- **Round 2** (`o3-s2`, `o3-r2-*` at 1440, 1920, 390): water filled to its edges; joints upright
  or level; gate redesigned in the right coping; oued bluer. Still: the reflection was a grey,
  hard-edged band (red multiplied over teal goes grey); falls still boxy; the oued's banks left a
  paper line; pebbles too dark.
- **Round 3** (`o3-s3`, `o3-r3-*`, close view `o3-r3-close`, sunset `o3-r3-sunset`): the teal is
  now lifted under the reflection before the warm glaze; falls are a lifted spill with thin
  threads; pebbles fewer, larger, paler. Still: paper wedges at the basin's corners and at the
  channels' starts; the steps' cast shade was a grey box; the reflection's lower edge was crisp.
- **Round 4** (`o3-r4-*`, `o3-r4-close`, `o3-r4-close-fall`): washes run past the stone and the
  channels and are clipped, so the corners fill; the reflection is warm on top with the ksar's
  battlements broken and lost below. The basin reads as the scene's heart at the overview, on
  the phone and close up; the falls read as small spills.

## Left open
- The oued at the overview is pale and flat next to the basin; its braids only read close up.
  O5's daylight or a stronger thread could lift it.
- At sunset (`o3-r3-sunset`) the basin turns grey-green under the sky plate's multiply. O5's
  basin plate should keep it turquoise.
- Paper wedges where the middle terrace wall's end, the basin's near-left corner and the last
  run's start meet (`o3-r4-close-fall`), and at the left end of the grove wall by the basin's
  far-right corner (`o3-r4-close`). The walls are O4's; check them there.
- The falls are still a little cylindrical close up (straight sides, no lip roll). O6 animates
  them and may want a lip and a darker inside curve.
- The sluice gate is small at the overview (a few pixels); it reads only in close view.
- The last seguia run is a clean ribbon; stones or a broken clay lip would make it less even.
