# 125 · Alfalfa (OP2, phase 13)

## What
The oasis's lowest storey: **alfalfa** (*Medicago sativa*, fessa in Darija), the forage crop sown
in the plots under the palms. It is a tier-1 `small` plant for the plots and the footpath. It adds
only files, plus one id in a pinned test list:
- `src/plants/species/alfalfa.ts`: the definition and the plan (`planAlfalfa`).
- `src/plants/lib/alfalfa-paint.ts`: new helpers `trefoils` (leaves of three in one wet layer),
  `racemes` (the short dense flower clusters), `coiledPod` and `plotSoil`. Imported only by the
  species. No shared `lib/` helper was edited; `paintStem`, `plantFrame`, `groundShadow`,
  `dabAxis`, `shadowSide`, the `small-structure` stem helpers and the growth easings are only
  imported.
- `src/plants/species/alfalfa.test.ts`: `smallSuite('alfalfa')`.
- `src/plants/notes/alfalfa.ts`: the Note from the brief (citation marker dropped).
- `src/scenery/flora.test.ts`: `'alfalfa'` added to the pinned oasis list (sorted, one per line).
  The garden keeps its 25 and the waterfall its own (both pinned lists still pass).

Fields:
- tier 1, `small`, box 86×86 drawn in the 70-unit design box, anchor .5/.88;
- habitats `meadow`, `path`, as the brief says (oasis small slots `plot-1`, `plot-2`, `plot-8`,
  `walk-1`, `walk-2`, `walk-5`, `walk-6`);
- `range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] }`, as the
  task says. The brief also lists `mediterranean`; I left it out so no other garden starts
  offering it;
- `nativeName: 'Fessa'`, `nativeLang: 'ary-Latn'`; bloomColor `#8f6fb3`; `pollinators: true`;
- description: the brief's Line, "Alfalfa — the lowest storey, cut and cut again, and still in flower."

**The id sorts before `anemone`**, so `allSpecies()[0]` is now alfalfa. The `widget` studio cards
and the `ui-shell` entries now draw an alfalfa instead of an anemone (seen in
`alfalfa-r5-widget-1440x900.png`); nothing else reads the first species. It also leads the tier-1
line-up board and the family boards.

## How it is painted
- **Clump, not mat:** 13–17 slender stems fan out of one crown (feet within about ±7 units). The
  middle ones are tallest and upright; the outer ones are shorter and lean out, so the outline is
  a rounded, upright bush. Each stem has a depth, and the stems are painted back to front in three
  depth bands. Each band paints its stems, then all its leaves in one wet layer, then all its
  flowers in one wet layer. The back band is a little deeper in tone.
- **Leaves:** 6–9 alternate leaves per stem on short petioles. Each leaf has three narrow oblong
  leaflets: the middle one on a short stalk, the two side ones spread 0.7–1 rad. A leaflet is a
  `petal` dab (widest near its blunt tip), with three small tooth dabs across the tip and a faint
  midrib. The colour is the brief's `#8aa65e` pulled toward celadon for the blue-green, varied per
  leaf toward sage-light and the deep green.
- **Flowers:** most stems end in a short dense raceme on a short stalk, and some have one more on
  a longer stalk from an upper leaf. A raceme is a pale, soft body with 12–16 tiny pea flowers
  crowded round it. Each flower is a rounded violet (`#8f6fb3`) standard over a darker indigo-violet
  keel, and a quarter of the flowers lean to lilac (`#b39ccc`). A quarter of the clusters are older
  and go bluish.
- **Pods:** one or two small coiled pods (`#a8a06a`, lightened) on short stalks, sticking out from
  the middle of an outer stem. Each is a straw disc with a fine spiral of 2–3 turns drawn on it.
  They are painted after their band's leaves so they stay visible.
- **Ground:** a faint wash of watered earth and a light, warm ground shadow.
- **Growth** (tested continuous over 200 steps):
  - from 0: the earth;
  - 0.04–0.6: the stems rise one after another, straight at first and taking their lean as they
    lengthen. The trefoils unfold just behind each tip, from folded to spread;
  - from about 0.46 to 0.84: the clusters push out of the stem tips and axils as grey-green buds;
  - 0.7–1: the flowers open from the base of each cluster to its tip, the clusters one after
    another;
  - 0.82–1: the pods coil out.
- **Cost:** 51 ms median and 68 ms max at growth 1, 1.6×, seeds 2–9, on the main thread in
  headless Chromium against the dev server. Spearmint measured 54/59 ms, white clover 27/42 and
  caper 27/33 in the same run. All are inside the 4–127 ms budget.

## Looked at
All shots are in `artifacts/op2-alfalfa/` (gitignored). The app shots plant alfalfa into the seven
small meadow and path slots with `sprout.start(20, { speciesId: 'alfalfa', sceneryId: 'oasis', slotId })`
and `completeSession()`, then `sprout.plants.settle()` and `plantsReady()`, with the light pinned.
- Round 1, `alfalfa-r1-1440x900.png` (studio section) and `alfalfa-r1-seeds.png` (seeds 1–6):
  - it read as a leafy legume clump at once, and the trefoils with toothed tips read at the edges;
  - but the flowers were loose sprays of separate florets, like lavender or vetch, not short
    dense clusters, and violet dominated the top half;
  - the stems were thick dark spokes meeting at one point, like a whisk;
  - the earth was a heavy grey blob.
- Round 2, `alfalfa-r2-seeds.png`, `alfalfa-r2-oasis-noon-1440x900.png`,
  `alfalfa-r2-close-walk-1-noon-1440x900.png`:
  - compact clusters (shorter, narrower, smaller florets, a soft body under them), fewer
    clusters, thinner and lighter stems, a wider crown, lighter earth;
  - it reads as "a green tuft dotted with violet" in the overview, and as alfalfa in the close
    view;
  - but in the close view the clusters were flat violet lumps, and the pods could not be seen
    (painted under the leaves).
- Round 3, `alfalfa-r3-seeds.png`, `alfalfa-r3-close-walk-1-noon-1440x900.png`:
  - paler cluster bodies with stronger keels, so single pea flowers show; the pods now stick out
    from outer stems and are painted after the leaves;
  - but the pods read as dark snails, so I made them smaller and paler, with a finer spiral.
- Round 4, `alfalfa-r4-lineup-t1-1440x900.png` (tier-1 line-up), `alfalfa-r4-flora-oasis-1440x900.png`,
  `alfalfa-r4-studio-1440x900.png` (growth stages), `alfalfa-r4-oasis-noon-1440x900.png`,
  `alfalfa-r4-close-walk-1-sunset-1440x900.png`, `alfalfa-r4-close-walk-1-night-1440x900.png`,
  `alfalfa-r4-oasis-noon-390x844.png`, `alfalfa-r4-close-plot-2-noon-390x844.png`:
  - on the line-up it stands at the far left. It is the bushiest tier-1 plant, about the height of
    the spearmint. It does not look like the white clover (a low mat with white pompoms) or the
    spearmint (lilac spikes on paired-leaf stems);
  - growth reads in order: earth, stems with trefoils, grey-green bud clusters, then violet;
  - sunset gives warm leaves and long shadows; at night the clusters stay a clear violet; on the
    phone it reads as a green tuft with violet dots.
- Round 5 (after the continuity fix), `alfalfa-r5-seeds.png`, `alfalfa-r5-widget-1440x900.png`.

## Left open
- The clusters sit mostly at the stem tips, at much the same height, so some seeds look a little
  like a vase of flowers. More axillary clusters lower in the foliage would make it bushier.
- The buds at growth 0.7–0.85 mix green and violet into a slightly dead grey.
- The coiled pod reads as a small round seed head at garden scale; you only see the coil in the
  close view.
- The grey contact shadow under each plant in the app comes from the scene's plant shadow, not
  from this sprite.
- At night the violet clusters stay quite saturated next to the dimmed sand.
- The brief's `mediterranean` cultivated range is left out (see above).
- Darija `fessa`: please check the spelling with a speaker (oasis brief §6).

## For the orchestrator to place
`| 125 | [OP2: Alfalfa](125-alfalfa.md) | An upright bushy clump of 13–17 slender stems fanning from one crown, with alternate leaves of three narrow blue-green leaflets toothed at the blunt tip, short dense clusters of tiny violet pea flowers (a few lilac, older ones bluish) at the tips and upper axils, and one or two small coiled seed pods; stems, then trefoils, then grey-green buds, then flowers | allSpecies()[0] is now alfalfa (widget, ui-shell); clusters mostly at the tips; Darija name unverified |`

`` | `alfalfa` | Alfalfa · Fessa | 1 | meadow, path | 86×86 · .5/.88 | `#8f6fb3` | yes | upright bushy clump: 13–17 slender stems fanning from one crown, painted back to front in three depth bands; alternate leaves of three narrow oblong blue-green leaflets with small teeth across the blunt tip; short dense racemes of tiny violet pea flowers with darker keels (a few lilac, a quarter of the clusters older and bluish) at the tips and upper axils; one or two small straw coiled pods on outer stems (oasis only, cultivated) | ``

`` | OP2.1 | Alfalfa: `smallSuite` (determinism, seed variety, continuity over 200 growths: stems, trefoils, cluster buds, flowers and pods all grow from nothing); meadow and path, small, inside the box; cultivated in n-africa-arabia only: the oasis pin gains `alfalfa`, the garden keeps its 25 and the waterfall its own | plants/species/alfalfa; scenery/flora | studio › every entry renders | ✔ | ``
