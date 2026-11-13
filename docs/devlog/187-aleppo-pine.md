# 187 · Aleppo pine (GP15)

## What
The pine of the Greek coast's cliff tops: the **Aleppo pine** (*Pinus halepensis*, πεύκο / péfko),
a tier-4 `tree` with the id `aleppo-pine`. It only adds files:
- `src/plants/species/aleppo-pine.ts`: the definition, the plan (`planAleppoPine`), the arrivals at
  a growth (`aleppoArrivals`), the painter of a plan (`paintAleppoPine`), `ALEPPO_COLOURS` and
  `ALEPPO_TIMING`.
- `src/plants/lib/aleppo-pine-paint.ts`: new helpers `paintPineWash`, `paintPineNeedles`,
  `paintPineCones` and `paintPineBark`. No shared `lib/` helper was edited.
- `src/plants/species/aleppo-pine.test.ts`: `treeSuite` plus the trunk, the forced lean, the crown,
  the cones, the order of the stages, continuity over 400 growths, the four gardens and the slot.
- `src/plants/notes/aleppo-pine.ts`: one note (retsina, the cones a fire opens).

Fields:
- tier 4, `tree`, box 380×460, anchor .5/.94; habitat `back` only (the cliff top and the scrub);
- `nativeName: 'Péfko'`, `nativeLang: 'el-Latn'`; the Greek script is in the note;
- bloomColor `#b9b060` (the research's young male cones); `pollinators: false` (wind).

**The id sorts first.** `aleppo-pine` comes before `alfalfa`, so it is now `allSpecies()[0]`: the
studio's `ui-shell` and `widget` cards draw a young Aleppo pine instead of alfalfa, and the family
boards and `flora` list it first. No test pins those cards.

## Range, gardens and slots
`range: { realms: ['mediterranean'], biomes: ['coast', 'scrub'], climates: ['mediterranean'] }`,
wild only (no `cultivatedIn`).
- **The coast offers it** (realm, `coast`/`scrub` and climate all match).
- **The Japanese garden and the waterfall do not** (realm `japan`).
- **The oasis does not, by biology.** The Aleppo pine grows in the Maghreb's coastal hills and
  mountains (the Rif, the Tell and Middle Atlas), which the `mediterranean` realm covers, not in
  the Saharan oases of the `n-africa-arabia` realm: the oasis profile is desert and wetland under an
  arid climate.
- It is never offered in one garden with the black pine (tested over all four).
- **Slots.** The coast has two tree slots: `top-1` (habitat `meadow`, the terrace bed) and `scrub-1`
  (`back`). With `back` only, the pine fits **`scrub-1`** alone, at the promontory's foot behind
  the top terrace; the terrace bed stays the olive's. Tested.

## How it is painted
- **Structure** (`planAleppoPine(rng, { lean? })`):
  - one slender trunk (13–16 units wide, 300–340 long) leaning 0.16–0.28 rad to a side the seed
    picks, or the caller forces with `lean`; its foot stays within 12 units of the anchor;
  - 6–8 short sapling whorls (tag `whorl`) on its lower two thirds;
  - 3–4 sinuous limbs part high up (0.58–0.9 of the trunk), long and low downwind, short and
    steep upwind, with two levels of spreading branches, and 1–3 side branches just below the fork;
  - a crown wider than the box is narrowed toward the trunk (down to 0.45) before `fitTree`, so a
    wide seed keeps its height.
- **Crown**: clouds (rx 26–38, ry 0.6–0.78 of rx) at every twig tip and along the limbs, merged
  where they crowd, with sky between. Each cloud holds about one tuft per 22 square units, a
  tuft being a twig end with its lit value (top-left lit, undersides shaded).
  - One soft wash per tuft (`paintPineWash`), pale yellow-green lit, grey-green shaded, dried soft,
    so the tufts run together into clouds.
  - Each tuft is then a fan of 7–9 fine needle strokes brushing forward and out from the twig
    (`paintPineNeedles`), so the cloud edges break into needles.
  - The first round had flat clouds stacked in tiers: it read as the black pine's pads. The clouds
    are now rounder, filled evenly, and do not follow branch tiers.
- **Bark** (`paintPineBark`): the skeleton in silver grey, then over the lower 62 % of the trunk
  seven red-brown washes to staggered heights (no hard band where the colour stops) and broken
  dark fissures beside lit plate edges, all growing with age.
- **Cones**: 13–35 per tree, in ones and twos on outer branches, pointing back along them and down,
  30 % old and grey, each with two dark scale bands, painted under the needles.
- **Growth** (`ALEPPO_TIMING`: the skeleton completes at 0.6, from 0.3 scale):
  - 0–0.1: the seed, then a seedling with a brush of blue-green needles;
  - 0.1–0.35: a slim conical sapling, its leader and whorls dressed in needle brushes;
  - 0.35–0.6: a young tree with an open pointed crown; the whorls are shed from the bottom up
    (0.5–0.82); the brushes hand over to the crown (0.68–0.86);
  - 0.4–0.82: the crown's clouds arrive, branch by branch;
  - 0.3–0.92: the bark ages; 0.8–0.98: the cones.
- **Cost**: growth 1 at 1.6×, seeds 2–9, `def.draw` on the main thread in headless Chromium
  against the dev server (the olive's method, devlog 171), load 3–5: **52 ms median**, 47–55 ms;
  the olive measured 56 ms median in the same run. At 1× it is 29–44 ms.

## For the scenery's pine
The coast's left-edge pine can become this species' tree as the olive did (ADR 0367):
- `planAleppoPine(createRng(seed), { lean: 1 })` leans it right, out of the frame's edge; the plan
  is in box units (380×460, base at `plan.tree.base`).
- `paintAleppoPine(p, plan, 1, rng)` paints the whole tree in box units under whatever transform the
  caller sets (the species wraps it in `inUnits`); map the base onto `PINE.base` at a scale of about
  1.15.
- To paint it in parts, call the layers one by one, as `paintAleppoPine` does: `paintSkeleton`
  (skip tag `whorl`), `paintPineBark` on the trunk's visible path, then `paintPineWash`,
  `paintPineCones` and `paintPineNeedles` on `plan.tufts`/`plan.cones` mapped with `viewPt` (split
  the tufts left and right of the trunk for smaller parts), with `aleppoArrivals(1)`,
  `ALEPPO_COLOURS` and `treeView(1, base, ALEPPO_TIMING)`.
- As with the olive, the paint version will then hash these files, so a later change to the
  species repaints the cached coast once.

## Looked at
Shots are in `artifacts/gp15/` (gitignored); probe sheets in the session scratchpad.
- Reference: the owner's photo (a lone pine on a Corfu-like headland: a slim leaning trunk, a light
  clumpy crown with sky through it).
- Round 1, `ap-r1` (studio section): a small tree in a big box; stiff starburst needle fans like
  palm or agave rosettes; a hard band where the red bark stopped.
- Round 2, `ap-r2`: the right height and lean; crown too thin and pale mint.
- Round 3, `ap-r3-s1..s3`: side branches and stronger greens; the clouds were flat and stacked, so
  seed 2 read as a black pine. Rounder clouds, narrowing wide crowns instead of shrinking them.
- Round 4–5, `r4`, `r5` (probe sheets with the black pine, the olive and the katsura): the young
  stages were bare sticks, so the young tree got needle brushes along every shoot.
- Close at 1.6× and 2.6× (`close1`, `r6-close`, `r8-close`): needle fans and cones read; the wash
  blobs were angular, now smoother. The foot sat 50 units off the anchor; fixed.
- Final: `r7` (stages and seeds), `ap-lineup2` (`plants-trees/lineup`): first in the row, beside
  the black pine, it is the only light yellow-green, airy crown on a slim red-and-silver trunk;
  nothing like the black pine's dark tiered pads, the olive's fat trunk or the palm.
- The coast at 1440×900 and 1920×1080, noon and sunset (`g1`, `g3`): the pine on `scrub-1` is
  lighter and yellower than the scenery's dark pines and reads as another tree; at sunset its crown
  takes the warm light.

## Left open
- **`scrub-1` is at the world's right edge.** A tree there has its trunk at the frame's edge and
  most of its crown cut off at the overview, and the close view cannot centre it (the camera stops
  at the world's edge). A slot further left, or one on the cliff top, would show it. Scenery code,
  not touched.
- At thumbnail size the clouds are slightly pom-pom-like, round tufted balls on a stick; a
  mature crown could flatten more into one broken umbrella.
- Around growth 0.6 the young brushes and the arriving clouds overlap, and the outer limbs look
  spotty for a few steps.
- Bare twig ends poke out of some clouds.
- Not looked at: the phone view and night.

## Tests
- Typecheck passes. Unit suite: see the final run below.
