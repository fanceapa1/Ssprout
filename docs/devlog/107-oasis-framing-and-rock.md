# 107: The oasis's framing and its rock (O2)

Lines for the orchestrator to place:

- Devlog index: `| 107 | [Oasis framing and rock](107-oasis-framing-and-rock.md) | O2: the oasis reframed so the whole ksar sits under open sky at every viewport (ksar right and down, basin narrower, focus and suns moved, the skyline traced from the painted silhouette, the near ground shaped); the bluff and the ksar painted in the same golden-red earth, in parts | Done |`
- TESTING, §1a, after O1.4:
  - `| O2.1 | Framing: every tower and house and ≥ 85% of the basin in the portrait crop with both suns; the ksar at y ≥ 150, clear of the corner controls, with ≥ 75 units of sky above it on a 16:9 screen; the skyline reaches the painted silhouette everywhere and follows it within 5 over the ksar | scenery/oasis › keeps the whole ksar…, › keeps the ksar clear of the top edge…, › runs the open sky down to the painted silhouette… | — | ✔ |`
  - `| O2.2 | Rock painting: the rock element is two steps (bluff, ksar), pinned recording hashes, the same crumbling per block, shapes exported for daylight with each foot in the bluff, no part over one big mark's work (overview and close view), both steps in many parts, flanks tucked under fronts, the hand-cut outline within the sky's hang | scenery/oasis/rock (all) | — | ✔ |`

## What
- **Framing first** (commit "reframe the oasis…", already on main). The owner's notes: the crop
  was "really bad", and "if I can't see the top of the ksar it looks super awkward".
  - Ksar: the old blocks spanned x 256–836 with tops at y 26–56 and horns above the top edge.
    Now x 430–898, base y 318, tallest horn tip y 152. The blocks moved to `ksar.ts` as pure
    shapes: houses, tapering towers with stepped corner pinnacles, ruined curtain walls.
  - Basin: far rim 540–1150 → 560–1060, near rim 476–1214 → 506–1114.
  - FOCUS: (800, 640) → (730, 520). A 16:9 screen now shows y 70–970, so it keeps about 80 units
    of sky over the horns. The phone crop is x 430–1030.
  - Suns: sunset x 872 → 920, sunrise x 980 → 990, horizon y 340. The moon's arc and the stars'
    gap moved with them (ADR 0300 updated).
  - Bluff: the flat box is now a rounded ridge on the left, broken down to the ksar's seat, with
    a rounded, broken shoulder on the right (x 900–1022).
  - Skyline: no longer a hand-drawn box. It is sampled from the painted silhouette (bluff, each
    block's front and flank, the far range), so the sky fills the gaps between towers.
  - Near ground (layout only, painted simply by the draft's `ground` step until O4): plots either
    side of the footpath, low bunds, wet sand along the seguia, the footpath's trodden band.
  - Slots moved: `basin-4` (1010→975), `basin-5` (1128,584 → 1040,582), `rim-5` (1254,604 →
    1236,622), `talus-1` (y 462 → 470), and `talus-2` (944,474 grove → 1040,472 on the basin
    terrace, at the shoulder's foot).
  - Shore: `oued-1` and `oued-3` are now large, for the oleander on the oued bank.
  - The draft's painters now read the live `layout.ts`. Its own bluff and ksar only paint in the
    draft's studio.
- **Rock** (`paint-rocks.ts`): see docs/systems/scenery.md › Oasis › Rock. Studio `oasis-rock`
  (whole rock, ksar close up, shoulder, scene). The composition map draws the ksar's blocks, the
  plots and the bunds. `light.ts`'s placeholder warm dabs moved onto the new towers.

## Looked at
Shots are in `artifacts/shots/` (in the worktree).
- **Round 1** (`o2-r1-*`: 1440×900, 1920×1080, 1536×864, 390×844, 820×1180): the framing reads at
  every size, with the whole ksar and sky above it, and on the phone the ksar sits over the basin.
  What was wrong: the conglomerate looked like polka dots (dark, even, too many). The towers' lit
  flanks were pale slabs standing apart. The near plots were boxy.
- **Round 2** (`o2-studio-r2`, ksar close up): the horns read as cat ears. The flanks rose above
  the front's parapet (wrong for an eye below the ksar) and left a paper line at the corner. The
  wall feet showed through the semi-transparent lip as pillowy bottoms. The diamonds' dark centres
  read as eyes. Fixes: conglomerate lenses close in tone to the rock, stepped blunt pinnacles,
  flanks sloping down and tucked under the front, no eyes, smaller lintels.
- **Round 3** (`o2-ksar-r3`, `o2-ksar-r4`): the lip, now paper-filled, left white slivers. It
  became a solid band in the bluff's tone with a gradient, which seats every foot. It was too red
  and ended in a hard edge, so I lightened it, faded it out at both ends, and started the runnels
  again under the walls. I also filled the parapet between the horns with taller stepped merlons.
- **Round 4** (`o2-r2-*`, `o2-r3-*` with the date palms from main, `o2-r3-empty-1920x1080`,
  `o2-r3-sunset-*`): the ksar now grows out of the bluff in the same earth, and the shoulder reads
  round and lit. At sunset the sun stands in the notch right of the east tower, and the sky plate
  fills every gap between the towers with no paper holes. Next to the waterfall and garden
  references, the rock holds up at app scale. The foreground is still the weakest part (O4).

## Left open
- The near ground's plots and bunds still read boxy. O4 paints the foreground properly.
- Close up, the seat band is still a slightly different tone from the bluff under it. It doesn't
  show at app scale.
- The conglomerate is still a little dotty at the bluff's lower left.
- Palm crowns are not cut out of the open sky; the sky wash tints them lightly. O5 can mask them
  if the night plate shows it.
- The draft's studio (`oasis-draft-a`) now paints the draft's old bluff and ksar over the new
  basin and terraces. It is a record only.
- Not run: the full unit and e2e suites (CPU rule). Run: typecheck, `src/scenery/oasis/`
  (40 tests), and `tests/e2e/sceneries.spec.ts` once with `E2E_WORKERS=1`.
- `src/main.ts` is unchanged.
