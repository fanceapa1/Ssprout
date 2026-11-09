# 133 · Grapevine arbour (OP14, phase 13)

## What
The oasis's 90-minute showpiece: a **grapevine arbour** (*Vitis vinifera*, dalia in Darija, the
trained vine). In the Draa palmeraies a vine climbs the palms or a treille of palm-trunk posts and
cross-poles in the middle storey, where water allows (research §1, "the three storeys"). It is a
tier-4 `large` sprite and adds only files, plus one id in a pinned test list:
- `src/plants/species/grapevine.ts`: the definition, the plan (`planGrapevine`) and the growth
  windows (`grapevineArrivals`).
- `src/plants/lib/grapevine-paint.ts`: new helpers `vineLeafRadius`, `vineLeafOutline`,
  `paintVineLeaves`, `paintBunches`, `paintFrame`, `tendrilPath`, `paintTendrils` and
  `paintArbourShade`. No shared `lib/` helper was edited. `paintBlots` and `paintShaggyBark` are
  imported from `katsura-paint.ts`, and the tree helpers (`paintSkeleton`, `paintTipLeaves`,
  `paintSeed`, …) from `tree-paint.ts`, so a change to the katsura's blots or bark would also
  change the vine.
- `src/plants/species/grapevine.test.ts`: `treeSuite('grapevine', planGrapevine)` plus the checks
  below.
- `src/plants/notes/grapevine.ts`: the Note.
- `src/scenery/flora.test.ts`: `'grapevine'` added to the pinned oasis list (sorted, one per line).

Fields:
- tier 4, `large`, box 320×330 (a little wider than the pomegranate's 300×340: an arbour is
  wider than tall), anchor .5/.94;
- habitats `meadow` and `back`: in the oasis the large plots `plot-3`, `plot-5`, `plot-6` and the
  tree slots `high-1` and `palm-1`, so it does not compete only for the two tree slots;
- `range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] }`, like the
  pomegranate and the date palm. `sprout.flora()` offers it in the oasis and not in the garden or
  the waterfall (checked in the dev server);
- `nativeName: 'Dalia'`, `nativeLang: 'ary-Latn'` (Darija دالية, the trellised vine; grapes are
  ʿneb). *Verify with a speaker*, as for the other oasis names;
- bloomColor `#6a4f78` (the dusky purple bunches); `pollinators: true` (bees visit the flowers);
- description: "Grapevine — a green roof on palm posts, sweet bunches in its shade."
- The id sorts after `desert-hyacinth`, not before `alfalfa`, so `allSpecies()[0]`, `ui-shell` and
  `widget` are unchanged.

## How it is painted
- **Frame:** two front palm-trunk posts (`#a28c6e`) with a shaded flank and broken ring scars of
  the old leaf bases, two paler back posts offset up and right for depth, a front and a paler back
  crossbar, 7–9 palm-rib poles laid across from one to the other, and rope lashings where the beam
  crosses the posts. The frame stands from growth 0, like the wisteria's trellis.
- **Vine:** two or three old trunks (`#857565`) at the posts' feet, sinuous and twisting, 9–11.5
  units wide, with the katsura's shaggy strips. Cordons run along the beam from each trunk top;
  canes rise into the roof (painted pale, behind the roof's leaves) or flop over the front edge.
  At the roof's ends, curtains hang down outside the posts.
- **Roof:** a deep band of leaves over the beam, domed and uneven on top and sloping down at the
  ends. A soft body wash in pads (bluer at the back) sits under five-lobed, toothed leaves
  (`vineLeafOutline`: five lobes round a petiolar sinus, 17–22 teeth, foreshortened across the
  axis). The leaves are in three passes: the roof's back half (paler, bluer, one layer), the front
  half (two alternating layers, pale veins lifted out of the lit ones) and the hanging curtains and
  front edge (crisp, source-over, half hiding the beam). Light comes from the upper left: sun-lit
  yellow-green (`#c4c46a`) on the top left down to deep olive (`#42592f`) along the beam. About
  8 % of the lit leaves turn amber (`#cc9a48`) at the end.
- **Bunches** (10–14, purple and amber-green, at least two of each): conical clusters with a
  shoulder and sometimes a wing, 18–36 units long, hanging under the front edge at varied depths.
  The berries alternate between two wet layers so neighbours keep their edges, and each has a
  shade crescent and a reserved-paper glint. Purple `#5f4a6e` with a grey-violet bloom
  (`#958fae`); amber-green `#bfc382`/`#d2b467`, painted thinner so it reads translucent.
- **Tendrils:** 8–12 fine coils on the roof's top and front edge.
- **Shade:** dapples of cool violet-green (`#8c89a1` into olive) under the roof, thinning toward
  the ground, and a soft pool on the ground with flecks of light lifted out.
- **Growth** (tested continuous over 400 steps):
  - 0–0.55: the trunks climb the posts, then the cordons run along the beam and the canes grow;
  - 0.4–0.82: the leaves, from the posts and the beam outward and up (the roof's top last);
  - 0.42–0.8: the body wash; 0.45–0.85: the shade deepens;
  - 0.6–0.8: small green flower clusters;
  - 0.72–0.95: the berries swell; 0.84–1: they ripen to purple or amber;
  - 0.86–1: a few leaves turn amber.
- **Cost:** in headless Chromium on the main thread against the dev server, growth 1, 1.6×, seeds
  2–9, on a loaded machine: grapevine 138 ms median and 152 ms max; in the same run the
  pomegranate took 93 ms, the katsura 135 ms and the plum blossom 57 ms. Scaled by the
  pomegranate's and katsura's quiet-machine numbers (60 and 82 ms, devlog 115) that is about
  85 ms, like the katsura, inside the 4–127 ms budget. Batching the stalks, poles, lashings and
  tendrils into one wet layer each (81 → 48 dry passes) and painting the back and curtain leaves
  in one layer brought it from about 1.9× to 1.4× the pomegranate.

## Looked at
All shots are in `artifacts/op14/` (gitignored). The garden shots plant a grapevine into `plot-6`
(plus a pomegranate in `plot-5` and a date palm in `palm-1`) with `sprout.start(120, …)` and
`completeSession()`, then pin the time.
- Round 1, `gv-r1-1440x900.png` (the studio section) and `gv-r1-g1-1440x900.png`:
  - it read as an arbour at once, but the shade under the roof was a grey sheet with jagged
    "mountain" bands, like a tarp;
  - the bunches hung in one even fringe, and the amber ones were opaque yellow, like corn cobs;
  - the posts' ring scars were as regular as a ruler, and the canes poked through the roof as dark
    sticks.
- Round 2, `gv-r2-growth-1-sheet.png` (seeds 1–6): the structure holds on every seed; the beam was
  a hard dark line and the shade still showed as shapes.
- Round 3, `gv-r3-growth-sheet.png`, `gv-r3-oasis-1440x900.png`, `gv-r3-close-1440x900.png`:
  - the stages read in order (bare trunks on the frame, leafing, green flower clusters, full
    canopy with ripe bunches);
  - in the oasis it is unmistakably the showpiece: a green roof on posts with purple and gold
    bunches, unlike the round pomegranate and the palms;
  - the ground pool was a hard grey puddle in the close view, and the seed sat in the middle of
    the ground rather than at a trunk's foot.
- Round 4, `gv-r4-growth-1-sheet.png`, `gv-r4-oasis-noon-1440x900.png`,
  `gv-r4-close-noon-1440x900.png`, `gv-r4-close-sunset-1440x900.png`,
  `gv-r4-close-night-1440x900.png`, `gv-r4-oasis-noon-390x844.png`, `gv-r4-contexts.png`:
  - the front leaves now half hide the beam, the dapples are soft and the ground pool fades;
  - at sunset the roof warms and the grapes hold their colour; at night everything fades under the
    indigo without going muddy;
  - on the phone `plot-6` is at the right edge, but the leafy roof and the bunches still read.
- Round 5, `gv-r5-lineup-1440x900.png` (`flora/oasis`) and `gv-r5-growth-sheet.png` (seed 2): on the
  tier-4 row it stands between the date palm and the pomegranate, distinct from both.
- Round 6, `gv-r6-growth-sheet.png`: the leaves now start at the posts and the beam, so the
  leafing stage no longer shows leaves floating over bare canes.

## Left open
- The roof's top leaves read more as soft scalloped discs than as five-lobed leaves at app scale;
  the lobes show on the front and curtain leaves.
- The bunches hang in a band under the front edge; none hang deeper inside the arbour.
- The tendrils are small and only visible up close.
- The close view on `plot-6` cuts the roof at the top of the frame (the camera's framing of a
  large slot, as for the pomegranate, devlog 115).
- The cost is the highest of the oasis species (about the katsura's). If the budget tightens, the
  vein lifts and the mid leaves' second layer are the next things to trim.
- No autumn: the sprite shows late summer, with a few amber leaves.
- Not run per the CPU rules: the full e2e suite. `tests/e2e/studio.spec.ts` was run on port 4192.

## For the orchestrator to place
`| 133 | [OP14: Grapevine](133-grapevine.md) | A grapevine arbour: two or three old twisting trunks trained over palm-trunk posts and a lashed crossbar, a deep roof of five-lobed toothed leaves (sun-lit yellow-green, a few amber), tendrils, purple and amber-green bunches hanging in its dappled shade |`

`| \`grapevine\` | Grapevine · Dalia | 320×330 · large | meadow, back | \`#6a4f78\` | yes | an arbour: 2–3 old twisting shaggy trunks at the feet of two palm-trunk posts with a lashed crossbar, paler back posts and rib poles across the top; cordons along the beam and canes into a deep, domed roof of five-lobed toothed vine leaves (sun-lit yellow-green to deep olive, a few turning amber), curtains at the ends, tendrils; 10–14 conical bunches, dusky purple with bloom and translucent amber-green, hanging in dappled shade (oasis only) |`

`| OP14.1 | Grapevine: \`treeSuite\` plus continuity of every pad, leaf, tendril, flower cluster, berry swell and ripening, the amber turn and the shade over 400 growths, bare trunks then leaves then flower clusters then swelling then ripening grapes, 2–3 trunks, > 150 leaves, ≥ 8 bunches with both purple and amber, a few amber leaves, every leaf, berry and post inside the box (12 seeds), the leaf outline's five lobes, cultivated range; the oasis pin gains \`grapevine\` | plants/species/grapevine; scenery/flora | studio › every entry renders | ✔ |`
