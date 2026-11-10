# 139: The basin's near-right corner and the sluice gate (O14)

Lines for the orchestrator to place:

- Devlog index: `| 139 | [O14: Basin corner and gate](139-oasis-basin-corner.md) | The paper triangle at the basin's near-right corner traced to washes whose resampled outlines cut the stone's short corners; the coping, face and water washes now run past every corner (also closes the water's near-right corner and the sluice head's paper wedge); the gate's cut widened and its foam moved downstream into the sluice, the motion's flicker with it | Done |`
- TESTING, §1a, after O11.2:
  - `| O14.1 | Oasis basin corners: the coping's, near face's and water's washes cover the stone's, face's and water's corners after a wash's outline resampling (from any start); the old face wash fails it; the gate's posts stand apart and its foam lies in the sluice, off the stone and the posts; new water recording pins | scenery/oasis/water (paints the basin's corners…, gives the sluice gate room…, is deterministic…) | — | ✔ |`
  - `| O14.2 | The basin's near-right corner is painted (no paper) and the gate reads with room (posts, board, spill, foam downstream) at noon, sunset and night, overview at 1440 × 900 and 1920 × 1080 and close at the gate and the corner | — | app shots in artifacts/o14 (looked at) | ✔ |`

## Cause
A wash (`p.parts.wash`, `wetInWet`) turns its polygon into an organic outline by resampling it
every 1/24 of its perimeter (`organicOutline` in `src/paint/geometry.ts`), which drops the
vertices. The near face is 608 × 24, so samples fall about 53 apart, and the chord between the last
sample on its top edge and the first on its bottom cut straight across the face's 24-unit end.
`insetPolygon(face, -5)` did not help: it offsets each vertex along its neighbours' chord, which at
the face's ends is level, so the ends were never pushed outward. The coping wash over the whole
stone had the same cut at the near-right corner. The stone was reserved as paper first
(`fillPaper(BASIN_STONE)`), so the triangle between the chord and the corner stayed paper. The
left end of the face had the same cut, hidden by the seguia's spout. The same mechanism left a
smaller paper triangle in the water's near-right corner and a sliver at the sluice's head (the
channel's water reserve against its wash's cut corner).

## What
- `paint-water.ts`:
  - `RIM_WASHES`: the coping's, near face's and water's wash polygons run 36 units past every
    corner (clipped to the stone or the water as before), so resampling never reaches inside.
    Before, they were the shapes grown by 6, 5 and 10.
  - `paintChannel`: the water's wash runs 12 past the reserve's ends.
  - `SLUICE_GATE`: the cut spans 0.78–0.955 along the right wall (was 0.84–0.96), so the posts
    stand about 25 units apart along the wall (was 19) and the board and spill have room. The cut
    now matches the sluice's width at its head. The new `foam` line lies 10 downstream of the
    board, across the sluice's head, from 5 % to 80 % of the board, away from the near post. The
    foam is reserved paper flecks and streaks round a softly lifted patch. As lifts it read
    pink-grey over the turquoise.
- `motion.ts`: the spill-foot flicker sits on the painted foam, and the gate's box includes it.
- No slot, layout point or geometry file moved. The basin's perspective is unchanged.
- Tests: two new water tests (O14.1). The water pins are now `adb32980` (overview) and `b1374c56`
  (detail), taken from a fresh process. Motion and daylight pins did not move.

## Looked at
In `artifacts/o14/` (gitignored), zoom-3 close views at 1440 × 900 (DPR 1):
- **Before**: `before-corner-noon-1440x900.png`, showing the paper triangle at the face's right
  end under the near post, a pale wedge in the water's corner and the gate's foam against the near
  post. In `artifacts/o11/after-gate-noon-1440x900.png` (main checkout) the same triangle shows.
- **Rounds**: `r1-corner-noon` (corner painted, gate widened, foam as lifts, grey), `r2-corner-noon`
  (water corner painted, foam reserved).
- **After**: `after-corner-{noon,sunset,night}-1440x900.png`, `after-gate-{noon,sunset,night}-1440x900.png`,
  `after-overview-{noon,sunset,night}-{1440x900,1920x1080,390x844}.png`. The face ends cleanly at
  the corner in all three lights, and the gate reads as two posts with the board between them and
  white foam in the sluice.
- Probe renders at 8–12× of the corner, step by step (land, + basin, + seguia, all), showed the
  triangle was already bare after the basin step. That pointed at the rim's washes.

## Left open
- **On the phone (390 × 844) the corner is off screen** at the overview, so it was checked only
  on desktop. The near-left end of the face reads fine there.
- **The near post's cast shade** reads as a soft pink stain on the face below it close up. It was
  there before.
- **Other washes with short corners** elsewhere in the oasis (paint-rocks, paint-land) may cut
  corners the same way. A `detail` option on `p.parts` washes would fix it at the source. It is
  in `src/paint`, outside this task's paths.
- **Not run**: `tests/e2e/sceneries.spec.ts` and the frame-cost bench (CPU). The motion's gate
  frames were not shot in motion.
- **Commits**: the corner fix and the gate's room went in as one code commit, because they share
  the same files and the new tests.
