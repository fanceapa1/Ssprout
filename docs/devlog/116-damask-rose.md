# 116 · Damask rose (OP10, phase 13)

## What
The oasis's hedge rose: **Damask rose** (*Rosa × damascena*, lward lbeldi in Darija), the rose of
the Dadès valley's harvest around Kelaat M'Gouna. It is a tier-3 `large` shrub for the plots and
the back. It adds only files, plus one id in a pinned test list:
- `src/plants/species/damask-rose.ts`: the definition, the plan (`buildDamaskRose`) and the pose
  (`poseDamaskRose`, pure, every mark at a growth value).
- `src/plants/lib/damask-rose-paint.ts`: new helpers `leafletBlade`/`paintLeaflets` (small
  toothed ovate leaflets), `paintCanes` with `prickleShape` (canes, a broken dark underside, the red
  flush of young tips and hooked prickles), `roseShape`/`paintRoses` (the cups, buds and sepals) and
  `fallenShape`/`paintFallen`. No shared `lib/` helper was edited; `ribbonInto` from `shrub-paint`
  and the stem helpers from `small-structure` are only imported.
- `src/plants/species/damask-rose.test.ts`: `shrubSuite` plus pose continuity over 240 growths
  (3 seeds), inside the box (16 seeds), an arching mound, leaves of 5 or 7 leaflets, clusters with
  open cups and buds, the growth order, and the range.
- `src/plants/notes/damask-rose.ts`: the Note from the brief, naming Kelaat M'Gouna (§6 Pitfalls).
- `src/scenery/flora.test.ts`: `'damask-rose'` added to the pinned oasis list (sorted, one per
  line). The garden keeps its 25 and the waterfall its own list.

Fields:
- tier 3, `large`, box 200×220, anchor .5/.93 (like the oleander and the yamabuki);
- habitats `meadow` and `back`. In the oasis that is the large plots `plot-3`, `plot-5`, `plot-6`;
- `range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] }`, as the task
  asked. The brief also lists `'mediterranean'`; that was left out so no other garden offers it;
- `nativeName: 'Lward lbeldi'`, `nativeLang: 'ary-Latn'`; bloomColor `#e2899b`; `pollinators: true`;
- description: the brief's Line.

## How it is painted
- **Canes:** 8–10 from one crown. Inner canes rise near-vertical (some cross over the crown) and
  outer ones lean out; every cane's bend is set so its tip ends near level and nods a little, which
  makes the mound. Grey-brown, a broken darker underside, the top third flushed red while young
  (fading as the cane matures), and hooked prickles that point back toward the foot.
- **Leaves:** alternate compound leaves, 2 or 3 pairs of leaflets and one at the tip (5 or 7), on
  a fine rachis that droops a little. The leaflets are small, ovate and finely toothed, matte
  grey-green (`#8ea064` toward `#9aa38a`), with a greyer underside flooded into the shaded half and
  only a faint midrib.
- **Flowers:** clusters of 3–4 on short reddish laterals, at the upper arch of most canes and
  midway on some. Clusters keep 27 px apart, so the shrub reads as green dotted with cups. The
  central flower opens first; the others open later or stay buds. Each cup is three rings of
  petals with ruffled rims (5 pale guard petals, then 6 and 7 deeper ones), each ring its own wet
  layer so the rims keep an edge, a few crease marks, and two near "lip" petals painted last over
  the cup. About a third are semi-double and show a small golden eye. Buds are pink teardrops in
  five green sepals with feathery side lobes; the sepals fall back as the flower opens.
- **Fallen petals:** 4–7 small pink petals at the foot, from growth 0.93.
- **Pink:** the brief's `#e2899b` with a paler `#f2c0c8` rim. The task asked for a softer,
  cooler pink than the oleander's `#d9708f` "if the brief allows"; the brief calls the rose's pink
  warm and the oleander's cooler, so the hue stays the brief's. It is softer and lighter than the
  oleander's, and the two read apart on screen.
- **Growth:** the canes rise straight and arch over as they lengthen (0.06–0.64), the compound
  leaves unfurl along them, the laterals and buds come from 0.5, the cups open from 0.7 to 1, and
  the petals fall last. Nothing pops: every mark starts below 1.2 % of the box.
- **Cost:** 76 ms median and 79 ms max at growth 1, 1.6×, seeds 2–9, on the main thread in
  headless Chromium against the dev server. In the same run the oleander took 98 ms and the
  yamabuki 45 ms. That is inside the 4–127 ms budget.

## Looked at
All in `artifacts/op10-rose/` (derived crops and contact sheets in the session scratchpad).
- Round 1, `rose-r1-1440x900.png`: it read as roses already, but the shrub was a V of two fans
  with an empty middle, far too many cups merged into pink masses, the buds were brown-green
  blobs, and the creases looked like rings of dashes.
- Round 2, `rose-r2-studio-1440x900.png` (every growth stage): the middle filled and the
  growth order was right, but the canes were straight dark sticks fanning out (twiggy, not a
  mound), the foliage was sparse, and leaves glazed over cups turned them brown.
- Rounds 3–4, `rose-r3-*` and `rose-r4-1440x900.png`, `rose-r4-s3-1440x900.png`: real arches now,
  but outer canes bent so far that the fit loop shrank them to stubs (seed 3 was one tall arch). The
  fix was to set the bend so that each tip ends near level. The tier-3 board
  `rose-r4-board-1440x900.png` showed the rose too dark and twiggy, with too few cups at that
  size.
- Round 5, `rose-r5-oasis-1440x900.png`: in the oasis beside the oleander on `oued-1`, the two
  read apart at once (a fountain of dark knives with magenta heads vs a loose arching shrub with
  soft cups), but the rose was thin and its canes were dark.
- Rounds 6–7, `rose-r6-close-noon-1440x900.png`, `rose-r7-close-noon-1440x900.png`: in the
  close view the cups were see-through (canes and leaves showed through the petals) and the
  foliage was a mid green. After round 7 the petals cover the foliage, the leaves are greyer, there
  are more cups, and the fallen petals show at the foot.
- Round 8: `rose-r8-close-sunset-1440x900.png` and `rose-r8-close-night-1440x900.png` (the warm
  rim light catches the leaflets; at night the cups go mauve and still read);
  `rose-r8-phone-390x844.png` (an arching green shrub dotted with pink at the bottom of the
  overview); `rose-r8-oasis-1440x900.png`; `rose-r8-board-small-1440x900.png` (at garden scale,
  a loose round shrub with pink dots, distinct from the oleander's upright dark fountain and the
  tree peony's low mound with three big cups).
- The oasis daylight is being redone (O5), so only the plant was judged, not the sky.

## Left open
- Some seeds are lopsided (seed 3 leans right, with one long low cane on the left). This reads
  as "loose", but it is the least hedge-like silhouette.
- At the overview the canes are still a little dark, and the leaves read mid green on the sand
  rather than clearly grey-green.
- The cups mostly face the viewer at similar tilts. A few side-on or nodding cups would make the
  clusters livelier.
- Fallen petals are tiny at the overview scale.
- Bees are allowed (`pollinators: true`), but bee targeting on the cups was not looked at.
- No hips: the sprite shows the May flush only.

## For the orchestrator to place
`| 116 | [OP10: Damask rose](116-damask-rose.md) | A loose mound of arching prickly grey-brown canes with red-flushed tips, matte grey-green leaves of 5–7 toothed leaflets, loose clusters of ruffled rose-pink cups paler at the rim (some with a golden eye), buds in feathery sepals, and petals fallen at the foot |`

`| \`damask-rose\` | Damask Rose · Lward lbeldi | meadow, back | large · 200×220 · (0.5, 0.93) | \`#e2899b\` | a loose arching mound of 8–10 prickly grey-brown canes from one crown, inner ones rising and bowing over, outer ones leaning out, every tip nodding near level, young tips flushed red, hooked prickles; alternate compound leaves of 5 or 7 small toothed matte grey-green leaflets on a drooping rachis; clusters of 3–4 on short reddish laterals, kept apart: ruffled cups in three rings of petals (pale guard petals, deeper ruffled inner rings, two near lip petals), about a third semi-double with a golden eye, and pink buds in five feathery sepals; 4–7 petals fallen at the foot; bees visit (oasis only) |`

`| OP10.1 | Damask rose: \`shrubSuite\` plus pose continuity of every cane, prickle, leaflet and flower over 240 growths, inside its box (16 seeds), an arching mound (≥ 8 canes from narrow feet, every tip near level, tips spread both ways, ≥ 60 prickles), compound leaves of 5 or 7 leaflets, open cups and buds on every seed, canes → leaves → buds → cups → fallen petals; cultivated range, pink bloomColor, bees; the oasis pin gains \`damask-rose\`, the garden keeps its 25 and the waterfall its own | plants/species/damask-rose; scenery/flora | studio › every entry renders | ✔ |`
