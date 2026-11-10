# 138: The oasis bluff, second pass (O13)

Lines for the orchestrator to place:

- Devlog index: `| 138 | [O13: Oasis bluff, second pass](138-oasis-bluff-2.md) | The bluff repainted as bedded sandstone by plane: beds and overhanging caprock shared across the face instead of per-buttress ledges, buttresses of uneven width with flat shade planes and stepped arrises (some faceted, some fluted, two merged), V gullies tapering onto their scree cones with no hanging clefts, softer and more visible varnish, the left ridge holding its form at sunset | Done |`
- TESTING, §1a, after O10.2:
  - `| O13.1 | Bluff second pass: every gully a V narrower than 0.6 of its rim width half way down and under 4 at its tip; at least one shallow crease stopping above the deep gullies' feet; buttress widths varying by more than 1.4×; ≥ 10 soft beds shared by the face, at uneven spacing, none within 6 of a hard bed | scenery/oasis/rock › the bluff, second pass (O13) (all) | — | ✔ |`

## What
The orchestrator's notes on devlog 131's bluff at noon: under the ksar the buttresses read as a
row of evenly spaced rounded loaves, each with the same two or three short ledge marks (a quilted
wall); the gullies' dark clefts hung below the buttresses like stems; every ledge was about the
same length; the left ridge lost its form at sunset; the varnish only showed close up. The outline,
the framing and the bluff's foot line are unchanged; the ksar's painting is untouched.

- **Why the loaves**: each buttress was shaded by three stacked bands that faded away from both
  gully walls, so each one was modelled as a cylinder. The ledges were drawn per buttress at their
  own offset, so the beds didn't line up and every buttress carried its own small set of marks.
- **Form** (`BLUFF_FORM`): seven gullies (was eight), each a V that tapers to under 1 at its tip
  over the scree. Two are shallow creases that stop 24–50 short of the scree, so their buttresses
  read as merged. The widths of the gullies vary more, and the buttresses between them are 89–162
  wide. Under the ksar the Vs are wider at the top than before (0.55 of their width, was 0.4).
  Seventeen soft beds at uneven heights are now part of the form (`soft`), shared by the face.
- **Painting** (docs/systems/scenery.md › Oasis › Rock):
  - Strata across the whole face: thin broken soft-bed lines that run on over several buttresses
    and fade, and broad faint bands of redder or paler rock between beds.
  - Caprock: each hard bed, and a cap just under the rim, as long bands broken where stretches have
    fallen. A lit top of varying thickness sits over a dark undercut that is lost downward, and the
    lip stands proud of each gully wall. The rim cap squares off the buttress tops under the ksar.
    It stops at the shoulder: following the rim there, it drew a diagonal line down the prow.
  - Buttresses by plane: a flat shade plane on the west side with a crisp arris that leans and
    jogs back at some beds (not every bed, or the face reads as boxes), lost toward the foot; a
    narrow lit plane on the east side. Some faces are two facets, some are fluted by long soft
    grooves.
  - Gullies: the shade is darkest high up where the V bites deepest, with no cleft stroke down the
    chute. The tip runs into the scree, where the cone (now paler and more visible) takes over.
  - Varnish: soft sheets that taper and are lost downward, with fewer, broader streaks through
    them.
  - The scree apron gets a pale source-over wash first, so the foot reads as sand fallen from the
    cliff, not as more cliff.
  - The left ridge: a deeper body on the left, a cool shade plane with an edge on its west face
    (was a soft ellipse) and a stronger lit east side, so its planes survive the sunset light. The
    global grade and `light.ts` are unchanged.

## Looked at
Shots are in `artifacts/o13/` in the worktree; crops and comparisons in `artifacts/o13/crops/`.
- **Before** (`before-{noon,sunset,night}-{1440x900,1920x1080,390x844}`,
  `before-studio-1440x900`, `crops/b-noon`, `crops/b-sunset`): the quilted wall, as described.
- **Round 1** (`r1-rock`, `crops/r1a`, `crops/r1b`): the loaves were gone and the beds ran across,
  but the shade planes ran down to the foot as heavy violet columns (a grid with the caprock), the
  thin bed lines were ruled, the alcoves read as dark half-moons, and the rim cap drew a line down
  the prow.
- **Round 2** (`r2-rock`, `crops/r2a`): calmer, but short flutes read as rows of windows, the shade
  planes ended in a hard line at the scree, and the foot was a flat rusty band.
- **Rounds 3–4** (`r3-rock`, `r3-noon`, `r4-noon`, `r4-sunset`, `crops/cmp-sunset`, `crops/r4-phone`):
  a pale scree apron and long soft flutes. Under the ksar the gullies hung as dark fangs until
  their shade was lightened, their tips carried into the scree and their west walls lit. Stronger
  planes. On the phone some shade planes read as boxes.
- **Round 5** (`r5-{noon,sunset,night}-*`, `crops/r5-three`): jogs at some beds only, leaning
  arrises, a stronger ridge. At sunset the ridge keeps its planes, and at night the forms read.
- **Rounds 6–7** (`r6-noon`, `r6-rock`, `r7-noon`, `crops/r7-noon`): more visible varnish. As hard
  trapezoids it read as dark blocks, so the sheets became soft and lost downward.
- **After** (`after-{noon,sunset,night}-{1440x900,1920x1080,390x844}`, `after-studio-1440x900`,
  taken after rebasing onto main with O12 and O14): at app scale the face reads as bedded sandstone,
  with caprock lines running across several buttresses and stepping, buttresses of different widths
  shaded by plane on their west side, V gullies with scree cones, and soft varnish under the lips.

## Timings
- About 60 minutes of art iteration in 7 rounds, then tests and docs.
- Paint cost of the `rock` element at the overview, measured in Vitest (not a browser), in one
  session on a shared, busy laptop. These are noisy, so the best of three runs is given:
  - The bluff step took 0.51 s, against 0.81 s for devlog 131's painter in the same session.
    Devlog 131 measured 0.52 s on a quieter machine.
  - The largest part of the bluff step went from 11.3k to 20.9k calls (145k pixels either way),
    well within the 130k / 400k the tests assert.

## Tests
- `rock.test.ts` › "the bluff, second pass (O13)": V gullies tapering to a point, at least one
  shallow crease, buttresses of uneven width, shared soft beds at uneven spacing.
- The O10 form test still holds: ≥ 6 gullies ≥ 80 apart, each wider at the rim than half way down
  and inside the bluff, none on the prow, ≥ 3 hard beds.
- Rock recording-hash pins re-taken from a fresh process (`59fcb2af` / `94c1b4e4`). Water and
  daylight are unchanged: they read the rock's shapes, not its paint.
- Run: `npm run typecheck` and `src/scenery/oasis` (137 tests), after rebasing onto main.
- Not run: the full unit and e2e suites (CPU rule), and `tests/e2e/sceneries.spec.ts` (the
  outline, framing and foot line are unchanged).

## Left open
- One or two shade planes still read a little as rectangular recesses at 1440×900 (on the ridge
  between the 290 and 342 beds, and one under the west house). Fewer jogs, or a slanted top edge,
  would help.
- The face is a little mauve compared with devlog 131's warmer orange. The shade planes and the
  red bands cool it; a warmer `PLANE` would bring some warmth back.
- At the far left the ridge still fades into the page's vignette at every phase. That is the
  frame, not the rock.
- The alcoves are small at app scale and mostly show close up.
- `src/main.ts` is unchanged.
