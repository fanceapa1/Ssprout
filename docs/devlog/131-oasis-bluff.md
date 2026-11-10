# 131: The oasis bluff finished (O10)

Lines for the orchestrator to place:

- Devlog index: `| 131 | [O10: Oasis bluff](131-oasis-bluff.md) | The bluff under the ksar painted as a Draa sandstone cliff: buttresses between funnel gullies lit east and shaded violet-brown west, caprock ledges over dark undercuts, varnish curtains, scree cones at the foot, clear ridge and prow ends, the rock carried up into the ksar's two ends; the pale sky wedge right of the east tower closed; the step at half its old cost | Done |`
- TESTING, §1a, after O9.1:
  - `| O10.1 | Bluff finished: a fixed form of ≥ 6 gullies at least 80 apart, each a funnel wider at the rim than half way down, inside the bluff and clear of the shoulder's prow; ≥ 3 hard beds at uneven spacing; the seat line carried > 26 up into the ksar at both ends (≤ 56 there, ≤ 24 between) | scenery/oasis/rock › the bluff finished (O10) (all), › seats the walls in the rock… | — | ✔ |`
  - `| O10.2 | No pale wedge in the sky right of the east tower: the sky wash runs 120 deeper right of the ksar, so the wash's rounded corner falls under the plate's clip | — (looked at: o10 after shots; daylight pins re-taken) | — | ✔ |`

## What
The owner said the background cliffs were not finished: a flat salmon wash with vertical drip
streaks and dark speckle dots, no rock form. The bluff's outline and the framing are unchanged.

- **Form** (`BLUFF_FORM`, seeded by name, so the cliff is the same for every art seed and only the
  brushwork varies): eight gullies along the face, each a funnel notched into the rim that
  narrows to a chute and opens onto the scree. Under the ksar the funnels start below the seat
  and are narrower at the top, so the rim reads as one caprock edge. The shoulder's prow has none.
  Four hard beds at uneven heights (236, 290, 342, 386) and five soft ones.
- **Painting** (`paintBluff`, docs/systems/scenery.md › Oasis › Rock):
  - The body is a red-ochre wash, rosier on the left and golden toward the shoulder. Shade is
    glazed over it, and light is laid source-over, so the lights read as lights rather than as a
    darker gold.
  - Each buttress has its west face in cool violet-brown shade along the gully wall (strongest at
    the wall, lost away from it) and its east face catching the sun. A joint or two splits the
    wider ones.
  - Ledges per buttress at their own small offset: soft beds as faint broken lines; hard beds as
    a lit lip and pale face over a dark undercut that tapers at its ends, now and then a weathered
    recess, sometimes missing.
  - Gullies in shade, deeper on the east wall, the west wall lit, a dark cleft down the deep ones.
  - Desert varnish: loose curtains of tapering stains under the lips and the rim, darkest where
    they hang from, of varied length and width (no rows of drips).
  - Scree: an apron along the foot, a cone at each gully mouth (pale on its sun side, shaded on
    its west side), pebbles, a few fallen blocks with a lit top, and scree spilling onto the
    terrace.
  - The left end: the ridge's west face turned away in cool shade, the crown and the stepped east
    side lit, the ledges stepping down to the ksar. The right end: the prow lit to the sun with a
    core shade further in, the ledges dipping round it.
  - The old runnels and conglomerate dot lenses are gone.
- **The ksar's ends**: `SEAT_LINE` now rises about 30 more at the west curtain wall and at the
  east tower's foot. `paintEndOutcrops` models those outcrops as the bluff (shade west, sun east,
  two ledges, a lit crest). The ksar painting is otherwise as devlog 130 left it.
- **Sky wedge** (`sky.ts`): right of the east tower the open sky turns a convex corner down onto
  the bluff. The phase wash rounds that corner off, so the corner was left almost paper (about 25
  levels lighter than the sky round it at noon). The wash now runs 120 deeper right of x 893, and
  the plate's clip (unchanged) cuts it at the skyline. Measured at noon: next to the tower the strip
  was 15–25 levels lighter than the sky beside it; now it is about 5 lighter at 1440×900 and
  within 4 on the phone, inside the wash's own granulation.
- **Cost**: a glaze per mark dried each mark alone. Marks of a kind (shades, lights, undercuts,
  stains, cones, blocks) are now filled into one wet layer and dried once (`wetBatch`). Stacked
  fills of decreasing size stand in for a glaze's lost edge.
- Studio `oasis-rock`: the `rock` and `shoulder` labels are refreshed, and a new `ridge` entry
  shows the left end.

## Looked at
Shots are in `artifacts/o10/` in the worktree.
- **Before** (`before-{noon,sunset,night}-{1440x900,1920x1080,390x844}`,
  `before-studio-rock-1440x900`). The wedge is plain on the phone.
- **Round 1** (`r1-studio-rock`): a fence. Even vertical panels, gullies as thin dark spikes,
  ruled bands across the whole face, everything beige.
- **Round 2** (`r2-studio-rock`): reads as a cliff, but the gullies were dark pipes of one width
  and the ledges planks.
- **Rounds 3–4** (`r3-studio-rock`, `r4-noon-*`): funnel gullies, scree cones, a cooler shade.
  The wedge was gone in the app. Lit glazes laid source-over read chalky on the phone, and under
  the ksar the funnels made the buttresses look like pillows.
- **Rounds 5–7** (`r5-studio-ksar`, `r6-noon-*`, `r7-studio-rock`): the end outcrops, first as box
  glazes with a hard edge, then as blobs. The ledges' undercuts read as floating slots until they
  tapered at their ends. The fallen blocks read as holes until their shade was lightened.
- **Rounds 8–11** (`r8`–`r11-studio-rock`): the fixed form, then the batched painting, which came
  out weaker until its alphas went up.
- **After** (`after-{noon,sunset,night}-{1440x900,1920x1080,390x844}`, `r11-studio-rock`): at app scale
  the bluff reads as a cliff: buttresses lit on the right and shaded violet-brown on the left,
  ledges stepping across them, gullies with scree cones, the ridge stepping down to the ksar on
  the left and the prow turning to the sun on the right. At sunset the ridge pales under the
  daylight's warm dabs, and at night the forms stay readable. On the phone the wedge is gone and
  the ledges and gullies read. Studio: `after-studio-oasis-rock-1440x900` (all entries, with the
  new `ridge`).

## Timings
- About 60 minutes of art iteration in 11 rounds, then tests and docs.
- Paint cost of the `rock` element, measured with the recorder in Vitest (not a browser), at the
  overview:
  - The bluff step went from 0.98 s to 0.52 s.
  - The ksar step went from 3.65 s to 3.73 s (the end outcrops).
  - Each part stays within the asserted 130k calls / 400k pixels. Before batching, the first
    version's parts reached 270k calls and the step 2.6 s.

## Tests
- `rock.test.ts` › "the bluff finished (O10)": the fixed form (gullies, funnels, hard beds) and
  the rock carried up at both ends. The O9 seat test allows the ends to rise to 56.
- Recording-hash pins re-taken from a fresh process:
  - rock (`d4aa4d70` / `0e4b8aa9`);
  - daylight, all four phases (the sky plate's wash changed).
  - Water is unchanged (it mirrors the rock's shapes, not its paint).
- Run: `npm run typecheck` and `src/scenery/oasis` (126 tests).
- Not run: the full unit and e2e suites (CPU rule).

## Left open
- Under the ksar the buttresses still read a little like rounded loaves at phone size, and the
  chutes' dark clefts hang below them like stems. Squarer tops (a flatter caprock between the
  funnels) would help.
- The ledges are close to the same length on each buttress; a few longer ledges running across
  two buttresses would break the rhythm.
- At sunset the left ridge goes pale under the daylight's warm dabs and loses some of its form.
- The varnish is subtle at app scale; it shows close up and on the phone.
- A faint residue of the sky wedge (about 5 levels at 1440×900) is still measurable but not
  visible.
- Not run: `tests/e2e/sceneries.spec.ts` (the framing and the shapes are unchanged).
- `src/main.ts` is unchanged.
