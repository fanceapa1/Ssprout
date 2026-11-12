# 171 · Olive (GP1)

## What
The Greek coast's signature tree: the **olive** (*Olea europaea*, ελιά / eliá). It is a tier-4
`tree` with the id `olive`. It adds only files, plus one id in a test pin:
- `src/plants/species/olive.ts`: the definition, the plan (`planOlive`) and the arrivals at a
  growth (`oliveArrivals`).
- `src/plants/lib/olive-paint.ts`: new helpers `trunkOutline`, `paintOliveTrunk` and
  `paintOliveLeaves`. No shared `lib/` helper was edited; `inUnits`, `stableLayer`, `softRes`,
  `paintSkeleton`, `visibleBranches`, `paintGroundShadow`, `paintSeed` and the tree-structure
  helpers are only imported.
- `src/plants/species/olive.test.ts`: `treeSuite('olive', planOlive)` plus the trunk (one short,
  fat trunk parting into 3–4 limbs; thin young, fat and flared old), the crown (≥ 6 clumps, wider
  than tall, inside the box over 12 seeds), the leaves (> 800, 10–40 % silver, all inside the box),
  flowers and fruit, the order of the stages, continuity over 400 growths, and where it is offered.
- `src/plants/notes/olive.ts`: the coast note, and an oasis note (`in.oasis`, zitoun in Darija).
- `src/scenery/flora.test.ts`: the oasis pin gains `olive` and its title says the olive is shared
  by biology.

Fields:
- tier 4, `tree`, box 380×460, anchor .5/.94; habitats `meadow` (the terrace) and `back` (the scrub
  and the back tree slots);
- `nativeName: 'Eliá'`, `nativeLang: 'el-Latn'` (the Greek script is in the note);
  bloomColor `#e8e0c4` (the cream flowers); `pollinators: false` (wind);
- the id sorts after `oleander`, not before `anemone`, so no other studio card changes.

## Range
`range: { realms: ['mediterranean'], biomes: ['coast'], climates: ['warm-temperate'], cultivatedIn: ['mediterranean', 'n-africa-arabia'] }`.
- **Cultivated round the Mediterranean**: the coast is a planted terrace garden, so a cultivated
  `mediterranean` scenery offers it whatever its wild words turn out to be.
- **The oasis offers it too, by biology.** The olive is the commonest middle-storey tree in the
  Moroccan oases (docs/research/oasis-biome.md §2: "best saved for a Mediterranean scenery and
  shared back"), and the oasis already paints olives under its palms. So `cultivatedIn` names
  `n-africa-arabia`, and the oasis pin in `flora.test.ts` gains `olive`. This also gives the olive
  a home today: without it, "each species is offered by at least one scenery" fails until the
  `coast` scenery lands.
- **Not offered** by the Japanese garden (realm `japan`) or the waterfall (wild, realm `japan`);
  tested.
- **The wild words are the closest honest ones, not exact.** The wild olive (oleaster) grows in
  lowland maquis under a Mediterranean climate. The vocabulary has no `scrub`/maquis biome and no
  Mediterranean climate, so the wild part says `coast` and `warm-temperate`. No released scenery
  matches it today, so it changes nothing. The coast scenery task settles the vocabulary; if it adds
  `scrub` or a Mediterranean climate, this range should take them.

## How it is painted
- **Trunk** (`paintOliveTrunk`): a short, fat trunk (54–64 units wide before fitting, about a
  third of the tree's height) with a waist above a flared foot and two or three concave buttress
  roots. Its flanks swell independently. Layers:
  - one source-over body wash that also holds the three or four scaffold limbs, each swelling out of
    the crotch, so the trunk parts into its limbs instead of ending in a cut;
  - a shaded right flank and limb undersides;
  - 14–18 grooves and pale lit ridges wound round the trunk by up to 2.4 rad, each turning at its
    own rate, drawn only on the front of the cylinder and thinned toward its edges;
  - one or two hollows with a lit upper lip, and a few knots.

  Young (age 0), the trunk is a smooth grey stem with no fluting; the grooves, roots, hollows and
  twist all grow with `age` (growth 0.38–0.95).
- **Limbs**: gnarled scaffold limbs (kinked and wandering) in the trunk's wash, then branches and
  twigs with the shared skeleton painter.
- **Crown**: clumps round the twig tips, with sky between them, and in each clump about one tuft
  per 26 square units. Each tuft is a short twig carrying 6–9 small narrow leaves at uneven angles
  and spacing (loose tufts, not pinnate fronds: the first rounds read as fern or ash fronds).
  - Under each tuft is a soft wash, pale grey-green on the lit side and cool beneath. Per-clump
    washes read as puffy cushions, so they were dropped.
  - Leaves come in three tones: shaded, grey-green and silver. The wind turns whole twigs over, more
    of them on the lit tops and the rim, and their silver undersides are painted source-over so
    they flash on the darker leaves.
- **Flowers and fruit**: small cream flower sprays on the upper twigs (growth 0.6–0.85), then a few
  olives (r 1.5–1.9 units) hung lower in the crown. They ripen green → purple → black-purple, about
  70 % fully. They share the silver leaves' layer, laid under them, so some are half hidden and they
  only show up close.
- **Growth** (every mark grows from its stage, tested):
  - 0–0.1: the seed, then a whip with paired silver-green leaves;
  - 0.1–0.5: the skeleton extends, a smooth grey young tree with leaves along its outer shoots;
  - 0.38–0.95: the trunk ages, fattening, twisting and hollowing;
  - 0.4–0.8: the crown's tufts arrive clump by clump;
  - 0.6–0.85: the flowers;
  - 0.8–1: the olives swell and ripen.
- **Cost**: at growth 1, 1.6×, seeds 2–9, on the main thread in headless Chromium against the dev
  server, on a machine at load 9–15:
  - first version: 160 ms median, against 87 ms for the date palm in the same run;
  - after the changes below: olive 77 ms median against 75 ms for the date palm (load ≈ 10), and
    98–100 ms against 91 ms (load ≈ 15). The max is 125–134 ms on the seeds with 12 clumps.

  So the olive costs about the same as the date palm, which measured 59 ms on a quieter machine in
  devlog 106: inside the 4–127 ms budget, at about the 85 ms aim. What got it there:
  - no bark strokes on limbs under 6 units;
  - the shaded and mid leaves in one layer;
  - the olives and flowers in the silver leaves' layer;
  - the grooves and ridges dried over the trunk's own box, not the crown's;
  - one tuft wash layer at soft resolution.

## Looked at
All shots are in `artifacts/gp1-olive/` (gitignored). Derived crops and sheets are in the session
scratchpad.
- Reference: the owner's photo (a Greek terrace olive above a cove: a fat fluted trunk, a broad,
  dense, grey-green crown).
- Round 1, `olive-r1-g1-1440x900.png`:
  - it read as a tree, but the trunk ended in a flat cut under the limbs;
  - the grooves were few wide bands, like a candy cane;
  - the crown was flat pale cushions with leaf sprays stuck on, and there were far too many black
    olives.
- Rounds 2–3, `olive-r2/r3-g1`: a broader crown and more upright limbs. The crown was still small
  against the box, and the sprays read as pinnate fronds (ash or mimosa).
- Rounds 4–6, `r4-g*`, `r5-g1`, `r6-g1` (zoomed crops):
  - the cushions' flat tops were the layer area clipping the blobs;
  - the limb roots in the crotch had square ends and darker overlaps. The scaffold limbs moved into
    the trunk's source-over wash, which fixed it.
- Round 7, `r7-g1`: per-tuft washes. The crown became broken, airy and silvery, which is the look.
- Rounds 8–11, the stages (`r8`–`r11`):
  - the whip read as a stump, so the young trunk is thinner and carries its own paired leaves;
  - young leaves sat on the trunk, so they are now on the shoots only;
  - the young tree's limbs were fatter than its trunk, so limb width grows with age.
- Round 12, `r12-s1..s4` (seeds 1–4): the structure holds. Every seed is broad, with a twisted
  trunk and a broken crown, and some have a long low limb.
- Line-up, `r13-lineup-1920x1080.png` (`plants-trees/lineup`): the olive is the only silver-grey
  crown and the only fat twisted trunk. It cannot be confused with the black pine, ginkgo, maples,
  cherry, katsura, tochinoki, pomegranate, palm or wisteria. It is lower and broader than they are.
- In the app (the oasis, since `coast` is not in this tree; light pinned to noon):
  - `r14-oasis-close-1440x900.png`, at `palm-1`: the twist, the hollows, the silver flecks and a few
    dark olives all read up close;
  - `r14-oasis-overview-1440x900.png`, at `palm-1` and `high-1`: both read as olives at overview size,
    a twisted trunk under a silver-green cloud, and they sit well among the palms.
- Final: `final-g*` and `final2-g1` (a fix for the notch at the foot).
- Not looked at: sunset and night, the phone view, the waterfall or garden (it is not offered
  there), and the coast scenery itself (not built yet).

## Left open
- **The coast.** Look again in front of the coast's terrace and sea once it lands, at sunset and
  on the phone. If the scenery adds a maquis biome or a Mediterranean climate, the wild range should
  use them.
- The fluting reads as twisted but a little graphic: long dark grooves and soft pale ridges. A
  real old olive has more broken, knotted ridges and deeper splits, and the trunk could split into
  two strands on some seeds.
- The crown is airy and silvery, but its tuft washes are many small soft blots, so up close it is
  slightly spotty. The leaves are drawn larger than life so they read.
- The young tree (0.3–0.55) is a bare grey tree with leaf pairs on the outer shoots. It could carry
  a first light crown earlier.
- Cost sits near the 85 ms aim at a quiet load, but some seeds with 12 clumps reach 125–134 ms.
  The trunk's body wash covers the scaffold limbs' whole box, so it is the next thing to batch.
- Not run while iterating, per the task's CPU rules: `npx playwright test tests/e2e/studio.spec.ts`
  on its own (it is in the final full run).

## For the orchestrator
- `src/scenery/oasis/flora.ts` still says in its comment that no species is shared by biology. The
  olive now is. The file belongs to the oasis, so it was left alone; `docs/systems/scenery.md ›
  Oasis` says it.
