# 106 · Date palm (P12)

## What
The oasis's signature tree: the **date palm** (*Phoenix dactylifera*, nkhla in Darija). It is a
tier-4 `tree`, and the palm the oasis's background palms will be repainted to match (O4). It adds
only files, plus one id in a test list:
- `src/plants/species/date-palm.ts`: the definition, the plan (`planDatePalm`) and the arrivals at
  a growth (`datePalmArrivals`).
- `src/plants/lib/date-palm-paint.ts`: new helpers `rachisPath`, `along`, `pinnaOutline`,
  `paintFrondPass`, `paintCrownWash`, `paintTrunkBody`, `paintLeafBases` and `paintDates`. No
  shared `lib/` helper was edited; `inUnits`, `stableLayer`, `softRes`, `paintGroundShadow`,
  `paintSeed`, `partialPath`, `ramp`, `stagger` and `clamp01` are only imported.
- `src/plants/species/date-palm.test.ts`: `treeSuite('date-palm', planDatePalm)` plus continuity
  of every arrival over 400 growths, the stages in order, the crown (22–27 fronds, gold only at the
  very bottom, offshoots, 3–5 date clusters), every frond inside the box (12 seeds) and the rachis
  arch.
- `src/plants/notes/date-palm.ts`: the Note from the brief.
- `src/scenery/flora.test.ts`: the "offered by at least one scenery" check skips the ids in a short,
  sorted `awaiting` list (`['date-palm']`). The palm has no home until O1 registers the oasis.
  Once O1 lands, the list may be emptied. O1's own test "offers no species yet" will then fail and
  must pin `['date-palm']`.

Fields:
- tier 4, `tree`, box 380×460, anchor .5/.94;
- habitats `meadow`, `back`, `shore` (O1's two tree slots, `high-1` and `palm-1`, are both `back`);
- `range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] }`. This is
  the research's call (§2 › 12): every palm in a palmeraie is planted, and its wild ancestor is
  uncertain. A cultivated scenery of the realm (the oasis, `cultivated: true`) offers it, and no
  wild scenery does. It differs from the task's suggested wild fields on purpose. Adding
  `realms: ['n-africa-arabia'], biomes: ['desert'], climates: ['arid']` would make no difference
  today, but it would claim the palm grows wild;
- `nativeName: 'Nkhla'`, `nativeLang: 'ary-Latn'`; bloomColor `#d99a3e` (amber dates);
  `pollinators: false` (wind and the farmer's hand).
- The id sorts after `daimonjiso` and `dandelion`, not before `anemone`, so no other studio card
  changes.

## How it is painted
- **Trunk:** a quadratic curve with a slight lean (0.05–0.12 rad) that straightens toward the crown,
  17–20 units wide in a 380 box. Light comes from the upper left, as for the other trees. The body is
  one wet layer with the right flank shaded. On top is the **diamond lattice** of old leaf bases:
  rows 8.6 units apart, alternate rows offset half a step, each stub foreshortened round the
  cylinder. Each stub is a dark crescent under its lip plus a pale facet on top, the facets on the
  lit side only.
- **Crown:** 22–27 fronds in age order. The spear stands upright, the middle fronds rise stiffly
  and the oldest reach out level and arch down. About 30 % point at the viewer (foreshortened and
  arched, always in front), so the crown is a starburst and not a flat fan. Each frond is:
  - a rachis that turns toward the ground along its length (`rachisPath`, never past straight down);
  - leaflets set in a V at two alternating angles, short spines near the base, longest mid-frond;
  - one soft wash per frond under its leaflets (half width 0.5× the leaflet length, so no halo).

  Back fronds are bluer and paler and painted before the trunk; front fronds come after it. A few
  sheath strokes make the crown's heart. Only fronds of age > 0.92 dry to gold (45–80 %), so there
  is no brown skirt: a tended grove cuts its dead fronds.
- **Offshoots:** 1–3 small fans of 5–7 fronds at the foot, leaning away from the trunk, in a
  slightly deeper green.
- **Dates:** 3–5 clusters under the crown, varying in side, length and droop. A trunk-tinted orange
  stalk arches out and down, and 8–11 faint strands hang from it with 4–7 dates each. The dates
  alternate between two wet layers, so neighbours keep their edges and read as a bunch of beads.
  They ripen from yellow to amber, with a few going brown.
- **Growth** (every mark grows from its stage, tested):
  - 0–0.06: the seed;
  - 0.02–0.32: a fan of fronds from the ground, no trunk (fronds rise in a V and open from a closed
    spear);
  - 0.32–0.66: the trunk rises, with lattice rows appearing as it passes them;
  - 0.34–0.72: the fronds take their arch and droop;
  - to 0.8: the upper fronds fill the crown;
  - 0.55–0.86: the offshoots;
  - 0.62–0.86: the oldest fronds turn gold;
  - 0.76–1: the date stalks, then the dates swell and ripen.
- **Cost:** 59 ms median and 67 ms max at growth 1, 1.6×, seeds 1–12, on the main thread in headless
  Chromium. That is inside the 4–127 ms budget. Katsura measured 90 ms on the same loaded machine.

## Looked at
All shots are in `artifacts/p12-date-palm/` (gitignored).
- Setting and reference: `setting-1440x900.png` (draft A: its palms are inky herringbones, which
  this species replaces as the reference) and `katsura-ref-1440x900.png`.
- Round 1, `r1-1440x900.png` (the studio section) and `r1-g1-1440x900.png`:
  - it read as a palm already, but the crown was a flat peacock fan;
  - three gold fronds read as a dry skirt;
  - the offshoots were invisible, and the orange date stalks read as claws;
  - the wash dried as stiff translucent paddles, and the lattice was too even.
- Round 2, `r2-seeds.png` (seeds 1–6):
  - the structure holds across seeds, but there was a ghost halo from the wash, the trunk was too
    thick and every seed had the same two symmetric clusters;
  - the offshoots were still invisible: a fit bug (the ground point always failed the floor check,
    so offshoots shrank to 0.2×).
- Round 3, `r3-growth.png` (growth 0.1, 0.3, 0.55, 0.8, 1):
  - the stages read in order;
  - a trunk stub showed at 0.3, so the trunk was moved later;
  - the offshoots looked like grass and the dates like lampshades.
- In the app (the palm planted with `setState`, since no released garden offers it):
  - `r3-wf-overview-noon.png` / `r4-wf-overview-noon.png`: in the waterfall overview at `bank-16`
    and `cliff-1` it is unmistakable even small, and it sits in the same register as the other
    trees;
  - `r4-wf-close-noon.png` and `r4-wf-close-night.png`: both waterfall tree slots are at the
    world's edges, so the close view clamps. They still show the lattice and offshoots up close;
    the lattice was too heavy, so it was softened;
  - `r4-jg-overview-noon.png` and `r4-jg-close-noon.png`: the Japanese garden at `back-4`, overview
    and close;
  - `r5-jg-close-noon.png` and `r5-jg-close-sunset.png`: the sunset rim light suits it;
  - `r5-phones.png`: on the Japanese-garden phone view it reads as a slim stalk, a starburst and
    amber clusters. On the waterfall phone view, `cliff-1` falls outside the crop.
- Round 6, `r6-dates-crop.png` (before and after): overlapping dates merged into one pale shell, so
  they now alternate between two layers and read as separate amber-brown dates.
- Not looked at: the oasis itself (O1 has not merged), and the line-up studio boards (`flora/…`,
  the tree review board).

## Left open
- **The oasis.** The palm has not been seen in front of the oasis's golden ground; look again
  once O1 lands. Empty the `awaiting` list in `flora.test.ts` then, and pin `['date-palm']` in O1's
  "offers no species yet" test.
- The crown reads a little dense and even next to the airy Japanese trees. A gap or two in the
  crown, and more variety in frond length per seed, would help.
- At close view the dates are a touch brown. The leaf-base lattice is still regular in rhythm, and
  rows could vary in spacing.
- There are no cream flower sprays (spring); the bloom is the dates.
- Not run per the task's CPU rules: `npx playwright test tests/e2e/studio.spec.ts` and the full e2e.

## For the orchestrator to place
- **docs/devlog/README.md:**
  `| 106 | [P12: date palm](106-date-palm.md) | A slim leaning trunk with a diamond lattice of leaf bases under a starburst of grey-green pinnate fronds; offshoots at the foot, amber date bunches under the crown |`
- **Species table** (`docs/systems/plants-species-c.md`, or the oasis species doc):
  `| \`date-palm\` | Date Palm · Nkhla | 380×460 · tree | meadow, back, shore | \`#d99a3e\` | no | a tall slender trunk with a slight lean, wrapped in a diamond lattice of old leaf bases; a starburst crown of 22–27 stiff grey-green pinnate fronds with V-set leaflets, upper ones rising, lower ones arching down, the oldest one or two dry gold; 1–3 offshoots at the foot; amber date bunches hanging on orange stalks under the crown (oasis only) |`
- **docs/TESTING.md:**
  `| P12.1 | Date palm: \`treeSuite\` plus continuity of every frond, stalk and fruit arrival over 400 growths, a fan from the ground before the trunk and dates last, 22–27 fronds with gold only at the bottom, offshoots and 3–5 clusters, every frond inside the box (12 seeds), the rachis arch; the garden keeps its 25 and the waterfall its own | plants/species/date-palm; scenery/flora | studio › every entry renders | ✔ |`
