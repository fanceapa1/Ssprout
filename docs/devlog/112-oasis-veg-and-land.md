# 112: The oasis's vegetation and land (O4)

Lines for the orchestrator to place:

- Devlog index: `| 112 | [Oasis vegetation and land](112-oasis-veg-and-land.md) | O4: the oasis's last draft steps replaced: lilac ranges and gold dunes, the sand with ripples and damp banks, terraces of worked soil, curved pisé walls, soft near plots with a bund and a stone channel, the footpath with footprints, the grove in three storeys and four big date palms drawn as the date-palm species | Done |`
- TESTING, §1a, after O3.1:
  - `| O4.1 | Vegetation painting: the grove and big palms as their own steps, pinned recording hashes (overview, grove close up), no part over one big mark's work, both steps in many parts; the big palms planned from the layout, crowns round their tops and within the sheet's sides; the grove right of the notch on its floor; the palms' trunks off the palm-1 slot | scenery/oasis/veg (all) | — | ✔ |`
  - `| O4.2 | Land painting: the land's nine steps in order, pinned recording hashes (overview, the middle wall and basin corner close up), no part over one big mark's work, each step in several parts; each wall's face down from the layout's coping by its height and every wall slot on a painted face; the near plots and bunds in the world and off the oued, the footpath off the plots | scenery/oasis/land (all) | — | ✔ |`

## What
- `src/scenery/oasis/paint-land.ts` and `paint-veg.ts` replace every remaining draft step. The
  draft (`drafts/a`) stays as a record: nothing in the app imports it (only its own studio entry).
  `OASIS_ELEMENTS` now runs `far` (ranges, dunes), `ground` (ground, terraces, plots, footpath),
  `grove`, `rock`, `walls`, `water`, `palms` (big-palms) and `near` (foreground, margins).
- **Far**: lilac-to-rose flat-topped ranges lost into haze, a nearer rose band; gold dunes with
  rose lee flanks on the west and faint ripples.
- **Ground**: gold sand in one wet-in-wet pass with warm and cool passages, the pale trodden basin
  terrace, damp sand along the seguia's last run, a dark damp band, a cut-bank shade and a lit lip
  along both oued banks, and sets of wind ripples on open sand (wider apart near the viewer).
- **Terraces**: worked soil between each wall's foot and the next coping, greener toward the
  seguia, wavy contour furrows and faint cross-bunds. **Walls**: pisé faces on the layout's
  copings (curved by smoothing), formwork courses, rain streaks, a damp foot, a cast shade, a
  broken lit cap and fallen lumps. The grove wall now starts 44 further left, tucked under the
  basin's far-right corner (the O3 paper wedge there is gone).
- **Near plots**: `NEAR_PLOTS` and `BUNDS` in `layout.ts` were reshaped (only the map studio
  used them): soft, hand-cut outlines with furrows toward a vanishing point, rows of seedlings
  and a greener watered side. The bund curves across in three pieces, broken by the seguia and
  the footpath. **Foreground**: a small stone-lined channel where the bund meets the seguia, a
  broken water jar, stones, dry halfa tufts (scenery, not species), and earth fallen into the
  basin's near-left corner, over O3's other paper wedge.
- **Footpath**: lifted and paled, scuffed edges, sparse footprints in two lanes, three stones.
- **Grove**: a shaded floor, two rows of palms (hazy back row, nearer row) painted in batched
  wet layers, fig, pomegranate and olive masses lit from the right, and crops as soft bands.
- **Big palms**: four date palms planned like the species (`planPalm`, the species' `rachisPath`,
  `along`, `pinnaOutline`, `paintLeafBases` and `paintDates`): a wet crown wash under back and
  front frond passes, a few gold old fronds, a flared trunk on reserved paper with the diamond
  lattice and the sun on its right flank, a ground shadow cast left, and date bunches on the
  three near ones.
- **Seams for O5**: `VEG_SHAPES` (`bigPalms` with trunk, width and crown outline, `grovePalms`,
  `groveTrees`, `grove` outline), `WALL_FACES`, `PALM` and `LAND` palettes, `haze()`.
- Studio `oasis-veg` and `oasis-land`. Tests `veg.test.ts` and `land.test.ts`; `oasis.test.ts`
  now checks the oasis's own step list instead of the draft's.

## Looked at
Shots in `artifacts/o4/` (in the worktree), against the garden's and the waterfall's 1440×900.
- **r0** (the draft, `o4-r0-1440x900`): boxy near plots and bunds, flat sand, inky stroke palms.
- **r1** (`o4-r1-bare-1440x900`): the grove reads in storeys and the palms are the species' tree,
  but the big trunks were thin, the near plots were still dark boxes with hard edges, the
  footprints a regular ladder, the terrace furrows and cross-bunds a grid, the ripples invisible.
- **r2** (`o4-r2-*`, three viewports, `o4-r2-close-grove`, `o4-r2-close-corner`): plots soft
  and calm under plants, trunks thicker. Close up the trunks were see-through (the grove showed
  through), cut flat at the foot, the walls' notch dabs read as dark "eyes", the path a hard
  strip, and the paper wedge at the basin's near-left corner was still there.
- **r3** (`o4-r3-*`, `o4-r3-sunset-1440x900`): trunks opaque with flared feet and shadows, wedge
  covered, path softer. The sunset holds together, the grove's palms reading against the sun.

## Left open
- Close up (`o4-r3-close-grove`) the big trunks' lattice reads as regular stamped chevrons and
  the trunks are a little grey and columnar; the grove palms' crowns repeat one shape. Vary the
  lattice rows and warm the trunk body.
- The 120 ms per part at 1.6× budget is held by the tests' call and pixel caps, not timed.
- The terraces still read as fairly straight bands at the overview: the walls follow the
  layout's nearly straight copings. Bending `WALLS` more would move the wall and terrace slots.
- The near plots' top edges, along the bund, show as straight lines under the warm sunset plate.
- The big palms' crowns sit mostly above y 100, so at 16:10 only their lower fronds and dates
  show; the top margin also hazes them. They read best on taller screens.
- The near sand is calm but still plain between the plots; the ripples are faint at the overview.
- The rubble over the basin's near-left corner is a small pale patch at the overview. O3's rim
  could close that corner itself.
- No e2e or full suite was run (CPU rule for this task): targeted vitest and typecheck only.
