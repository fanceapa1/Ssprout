# 130: The oasis ksar finished (O9)

Lines for the orchestrator to place:

- Devlog index: `| 130 | [O9: Oasis ksar](130-oasis-ksar.md) | The ksar on the bluff painted as a Draa-valley ksar in watercolour: tapering pisé towers with rounded horns and worn merlons, houses stepping back, broken curtain walls, wet-in-wet granulating fronts with lit gold flanks and cool shaded edges, the carved bands as loose brushwork, a few varied openings, the walls clipped into the rock at a seat line with outcrops | Done |`
- TESTING, §1a, after O2.2:
  - `| O9.1 | Ksar finished: a few varied openings inside each face (towers ≤ 5, houses ≤ 3, none on curtain walls, none in the band; slits, squares, arches, some lintels); the far houses taller than the near ones and painted first; tower sides broken into nudged points and tapering; the seat line within 24 of each base and rising into the walls in places | scenery/oasis/rock › the ksar finished (O9) (all) | — | ✔ |`

## What
The owner said the background castle was not finished: flat cut-paper boxes, uniform salmon
fills, rows of identical black window dots, a stamped zigzag frieze, ruler edges, towers pasted on
the bluff. The footprint and silhouette stay as O2 fixed them (x 430–898, every top at y ≥ 152,
the skyline traced from the shapes).

- **Shapes** (`ksar.ts`):
  - Towers taper 9 % a side (was 6 %).
  - Their corners end in blunt horns with a worn, round head and a low shoulder inside, not the
    stepped boxes that read as cat ears. The merlons between are rounded caps with clear dips,
    some worn low.
  - Every side is broken into points nudged by a slow bulge and a little crumble, so no edge is
    ruled.
  - Houses end in a low parapet of small rounded merlons with higher corners. Their flanks are a
    plain slope; the tower flank shape folded over itself at a 5-unit side.
  - Curtain walls end in an eroded crest: a breach worn down to a saddle, sharp notches where
    chunks came away, and a few stubs of merlon.
  - Three far houses (`*-back`) stand behind the near ones, taller, so the town steps up between
    the towers.
  - `house-east` is 4 wider, so its corner hides behind the east tower. A 1-unit notch there was
    narrower than the skyline's sampling.
  - The courtyard palms moved a little so the far houses don't cut their trunks.
  - `windows` now returns a few `Opening`s (slit, square or round-headed, with or without a
    lintel), placed loosely: 3–5 on a tower below its band, 1–3 on a house.
- **Painting** (`paint-rocks.ts` › ksar; see docs/systems/scenery.md › Oasis › Rock):
  - Each block has its own earth (`tintOf`). The towers vary a little warmer or redder; the
    houses are paler and cooler as they step back.
  - Lit gold flank. The front is a wet-in-wet wash from warm upper right to cooler lower left,
    with granulation and pooled edges.
  - The underlayer is opaque and sits just inside each outline. A paper fill left white rims
    wherever the wash stopped short, and that rim was much of the cut-paper look.
  - The parapet gets its own small wash: the big wash's outline is too coarse for the merlons,
    which is why the old tower tops read flat.
  - Over the wash: soft patches of mud, a cool shade at the left edge and the foot, short broken
    formwork courses, rain streaks and broken lit touches along the tops. Each tower and near
    house throws its shade left onto the houses behind it.
  - The band is brushwork: broken fillets, one flick per zigzag edge, lozenges in four flicks
    (some faint or missing), and blind niches on the two tall towers.
  - Openings are soft, darkest at the top, with a lintel and a lit sill on some.
  - Curtain walls get `paintRuin`: a lit crest, a shade under it, rain gullies and a couple of
    holes.
- **Seat**:
  - Before, an opaque band in one flat tone covered the wall feet and read as a tray under the
    ksar.
  - Now `SEAT_LINE` runs just above each base, and the rock swells up into the walls in a few
    outcrops. Every block is clipped above it, so the bluff's own beds and runnels run right up
    to the walls.
  - The outcrops above the bluff's top get an underlayer and a granulating wash in the bluff's
    tone, lost downward.
  - Over that: the rock's tone creeping up the feet, a broken seam, short beds, fallen pisé and a
    soft shade.
  - The seat's own runnels went: they hung under the ksar like teeth.
- Studio `oasis-rock`: the `ksar` label is refreshed, and a new `tower` entry shows the tallest
  tower and its seat close up.

## Looked at
Shots are in `artifacts/o9/` in the worktree.
- **Before** (`o9-before-{noon,sunset,night}-{1440x900,1920x1080,390x844}`,
  `o9-before-studio-1440x900`).
- **Round 1** (`o9-r1-studio`): greyish and uniform, a sandpaper granulation, the merlons
  invisible, a straight seat line (the outcrops were capped by `bluffTopAt`), the fallen pisé as
  dark blobs, and loaf-shaped curtain walls.
- **Round 2** (`o9-r2-studio`): the bands now read as brushwork, not a stamp. The zigzag was a
  smoothed "w", so it became single flicks.
- **Rounds 3–4** (`o9-r3/r4-studio`): with an earth-coloured underlayer the merlons showed as
  pale floating blobs, which proved that the wash had never reached them. The fix was a parapet
  wash.
- **Rounds 4–10** (`o9-r4..r10-noon`, crops in the scratchpad): the seat was a pedestal, then a
  tray, then went into the rock with the clip.
- **Rounds 11–13** (`o9-r11/r12-studio`, `o9-r12-*`, `o9-r13-noon`): cooler far houses, stronger
  tower shadows, ruin wear, fewer and larger outcrops.
- **After** (`o9-after-{noon,sunset,night}-{1440x900,1920x1080,390x844}`, studio
  `o9-r12-studio-1440x900`).
  - At sunset the gold flanks catch the daylight's warm dabs. At night the towers' carved bands
    and openings stay readable but soft.
  - On the phone the ksar reads as towers, houses and walls over the bluff.

## Timings
- About 60 minutes of art iteration in 13 rounds, then tests and docs.
- Paint cost of the `rock` element, measured with the recorder in Vitest (not a browser):
  - The ksar step's parts went from 2.0 s to 4.1 s in all (overview) and 2.1 s to 4.3 s (close
    view), with about 2.2× the parts.
  - The largest part is 82.6k calls / 311k pixels, within the asserted 130k / 400k budget (it was
    76k / 343k).
  - The bluff step is unchanged (about 1 s).

## Tests
- `rock.test.ts` › "the ksar finished (O9)": openings, stepped houses, unruled tapering sides,
  and the seat line.
- Recording-hash pins were re-taken from a fresh process, because the ksar's shapes reach other
  steps:
  - rock (`f1596bec` / `fe2353de`);
  - water, which reflects the ksar (`7b77ebb3` / `b2109bc3`);
  - daylight, which lights the ksar's shapes (all four phases).
- Run: `npm run typecheck` and `src/scenery/oasis` (124 tests).
- `tests/e2e/sceneries.spec.ts` was run with `E2E_PORT=4191`.
- Not run: the full unit and e2e suites (CPU rule).

## Left open
- The fronts are still a little even in value at app scale. A stronger light-to-shade turn across
  each front would model them more, but it fights the "backdrop, lower contrast" brief.
- At sunset the pooled edges read slightly inky round the blocks.
- The far houses are a touch grey at noon.
- The curtain walls' wear is subtle at app scale; they still read a little soft and rounded.
- The outcrops are small. O10 (the bluff) could carry the rock further up into the ksar at its
  two ends.
- The ksar step costs about twice what it did in total. Each part stays within the budget, but if
  the oasis's first paint feels slow, the patches and the per-house cast shades are the first
  things to cut.
- `src/main.ts` is unchanged.
