# 132: The oasis's falls (O11)

Lines for the orchestrator to place:

- Devlog index: `| 132 | [O11: Oasis falls](132-oasis-falls.md) | The seguia's drops painted as falling water: a glassy tongue over the lip, a sheet breaking into strands over the wet wall, a churned pool and foam at the foot, a damp halo with a little moss; runs that sit in lined cuts and meet the lip; the last fall's water through the coping into the basin; the gate's spill with a tongue and foam; the motion's streaks and splash flicker matched | Done |`
- TESTING, §1a, after O6.2:
  - `| O11.1 | Oasis falls: each fall spills from its run's end, the tongue nearly the channel's width and spreading, onto the next run or the inlet, which reaches the basin's water; new water recording pins; within the per-part budget | scenery/oasis/water (spills each fall…, is deterministic…, no part…) | — | ✔ |`
  - `| O11.2 | The oasis's falls and gate read as small falling water (tongue, strands, foam, wet wall) at noon, sunset and night, overview and close, desktop and phone; the falls' motion streaks down the strands and flickers at the foot | — | studio oasis-water/fall, /falls, /gate; oasis-motion/falls, /falls-frames (renders; looked at) | ✔ |`

## What
- `paint-water.ts`, the seguia step (owned paths only; no slot, basin or layout point moved):
  - **Falls** (`paintFallStain` before the runs, `paintFall` after them): a damp halo on the
    pisé, narrow under the lip and widest past the foot; the face soaked dark either side of the
    sheet, a little greened moss low down, a faint runnel. The sheet is reserved whole for the
    tongue (top 45 %) and then as 3–5 tapering strands with the wet wall glimpsed between them.
    The tongue is glazed turquoise and fades as it thins, with a teal roll under the brink and the
    shaded left side; the sky is lifted in a bowed line along the brink, plus a gleam down the
    tongue's lit side. Thin streaks run down the strands. At the foot: a churned turquoise pool,
    a row of white foam lifts, a few thrown drops and a faint spray haze. `fallHalf(k)` (6.5 at
    the lip, 9.5 at the foot; it was 5.5–9) is exported, and motion uses it.
  - **Runs**: the far bank's face gets a few lining joints, the water the far bank mirrored dark
    under it, and the near bank a lit, broken lip lying over the water's edge, so the water sits
    in the cut. A run that ends at a fall is clipped at its wall's top edge (`aboveWall`,
    `FALL_WALLS`), so it meets the lip instead of ending square. Every wash overruns the run's
    ends (`extend`), which closes the paper wedges at the runs' and the sluice's heads.
  - **Inlet**: the last fall's water runs on in a short lined cut (`BASIN_INLET`) and alone
    through the coping's notch into the basin. Before, only a dark notch was painted there.
  - **Gate**: the cut's outer half holds turquoise. The spill over the board is reserved, with a
    teal roll and the sky along its top, and broken white foam lies at the sluice's head, kept off
    the posts.
- `motion.ts`: lanes narrower (0.28–0.32 of the sheet, like the strands), four threads spread
  across, and four splash puffs a foot that flicker up out of the foam (0.7–1.1 s, was three at
  1.3–2 s). The worst frame stays within the tested 110 blits and 7 clips.
- Studio: `oasis-water/falls` (both drops and the run between them) and `oasis-water/gate`;
  new labels on `oasis-water/fall`, `oasis-motion/falls` and `/gate`.
- Tests: a new water test (O11.1). The water hash pins are now `edeeab25` (overview) and
  `1365a7a9` (detail), taken from a fresh process. Motion and daylight pins did not move.

## Why
- **The tongue makes the fall.** The old falls were a lifted column with straight sides and no
  brink, so they read as glass tumblers or pasted strips. A drop reads by its brink: the water
  darkens as it bends over, the sky catches on the curve, and the sheet only breaks up below.
  The bright bow along the brink also joins the run to the sheet.
- **Wet wall between strands.** Paper between the strands read as more water. Letting the soaked
  pisé show through makes the lower sheet thin and broken.
- **No lining stones at the lip.** Round 2 had a dressed stone either side of the lip. Close up
  they read as posts or a lintel (a T over the fall), so a soaked coping edge replaced them.
- **Halo as a glaze, not a wash.** A hard wet band either side of the sheet read as a dark
  doorway round the fall (round 2), so it is now a soft glaze that is lost toward the top.

## Timings
About 55 minutes of art in 6 rounds, then tests and docs. Each close-view shot took about 40 s on the shared laptop
(dev server, Chromium with Metal, DPR 2). The water test's per-part budget (130 000 calls,
400 000 pixels) passes at the overview and in the basin-corner detail. The motion's frame cost
was not benched again: its blit count stays under the old cap and the sprites are the same size.

## Looked at
In `artifacts/o11/` (gitignored), noon unless named. `falls` and `gate` are zoom-3 close views
at 1440 × 900, DPR 2.
- **Before**: `before-falls-noon-1440x900.png`, `before-gate-noon-1440x900.png`,
  `before-overview-noon-1440x900.png`. The falls were pale tumblers, the runs ended square with a
  paper wedge, the inlet was a dark slot, and the gate's spill was a teal strip.
- **Round 1** (`r1-falls`, `r1-gate`): the tongue and strands read, but the lining stones and the
  dark wet bands framed each fall like a doorway, and the lip gleam was a flat ellipse (a
  cylinder's top).
- **Round 2–3** (`r2-falls`, `r3-*`): softer halo, a bowed brink gleam, no stones. The inlet as a
  bare ribbon read as a pipe, so it became a lined cut. The gate's foam was lost on the pale
  coping.
- **Round 4** (`r4-*`): the tongue is as wide as the channel, so run and fall read as one water.
  The roll is softer. The cut holds turquoise under the gate's foam.
- **Motion** (`r5-fall0-noon-1440x900-f0..3.png`, montage `m-r5-fall0.png`, 150 ms apart): the
  surges and threads slide down the strands and the foot flickers.
- **After**: `after-falls-noon-1440x900.png`, `after-falls-sunset-1440x900.png`,
  `after-gate-noon-1440x900.png`, `after-overview-{noon,sunset,night}-{1440x900,1920x1080,390x844}.png`.
  Before and after at the overview in all three lights: `m-overview-falls.png`. Studio:
  `studio-water-1440x900.png`, `studio-motion-1440x900.png`. At the overview the drops read as
  small white-footed falls in lined cuts. At night they stay pale and moonlit, and on the phone
  they still read.

## Left open
- **The gate is still cramped.** The posts, board, spill and foam fit in about 20 units, so close
  up the foam crowds the near post. A wider cut or a slightly larger gate (geometry, O3's
  `SLUICE_GATE`) would let the spill read as a drop.
- **A paper triangle at the basin's near-right corner**, below the gate, is painted by neither the
  rim nor the seguia. Devlog 110 noted the same kind of corner wedges. It needs tracing.
- **The motion covers the gaps between strands.** It is clipped to the whole `fallSheet`, so close
  up its surges also pass over the wet wall between strands, and in motion the lower sheet reads
  a little more solid than the still painting. Clipping to the strands would need them exported.
- **Close-view motion frames were taken in the app** (zoom 3 without freeze), not as studio
  `falls-frames` at exact t.
- **Not run this time**: `tests/e2e/sceneries.spec.ts` (CPU) and the frame-cost bench.
