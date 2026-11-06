# 122 · Barley (OP6, phase 13)

## What
The oasis's grain: **barley** (*Hordeum vulgare*, shʿir in Darija). It is a tier-2 `medium` crop
for the plots on the basin terrace and the middle terrace. It adds only files, plus one id in a
pinned test list:
- `src/plants/species/barley.ts`: the definition and the plan (`planBarley`, `culmNow`,
  `culmReach`).
- `src/plants/lib/barley-paint.ts`: new helpers `barleyEar` (the bearded ear), `earAxis`,
  `grainLayout`, `awnLines` (pure geometry, tested) and `grassBlade`. No shared `lib/` helper
  was edited. `paintStem`, `plantFrame`, `groundShadow`, `seedMound`, `dabAxis`, `makeStem`,
  `bendProfile`, `stemPoints`, `pointAt` and the growth easings are only imported. No scene or
  scenery painter imports the new file.
- `src/plants/species/barley.test.ts`: `smallSuite('barley')`, plus plan checks.
- `src/plants/notes/barley.ts`: the Note from the brief, without its "(verify)" flag.
- `src/scenery/flora.test.ts`: `'barley'` added to the pinned oasis list (sorted, one per line).
  The garden keeps its 25 and the waterfall its own (both pinned lists still pass).

Fields:
- tier 2, `medium`, box 120×160, anchor .5/.92; habitats `meadow` only (the brief's plots). The
  oasis has medium-or-larger meadow slots at plot-4, -5, -6, -7 and -9;
- `range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] }`, a crop
  as the task gives it (the research brief also lists `mediterranean`; no scenery has that realm
  yet, so leaving it out changes nothing today);
- `nativeName: 'Shʿir'`, `nativeLang: 'ary-Latn'`; bloomColor `#e2bd62` (the brief's gold);
  `pollinators: false` (barley self-pollinates);
- description: "Barley — the spring's gold, cut by hand before the heat." (the brief's Line).
- The id sorts after `anemone`, so `allSpecies()[0]`, `ui-shell` and `widget` are unchanged. It
  lands first in the oasis's tier-2 row and between the balloon flower and the cattail in
  `plants-a-review/lineup-t2`.

## How it is painted
- **Stand:** 6–9 culms (stems) from a tight base, spread a little. About one in five leans well
  out. The stalk is a thin straw-green stroke with a sparse ink line and two small dark nodes. It
  turns straw from green as the ear ripens.
- **Blades:** 7–10 narrow basal blades (40–64 units) arch out from the base, and every culm has
  two leaves leaving at its nodes. Each is a tapered stroke in a blue-green made from the brief's
  `#a6b56a` and a grey teal, with a fine darker crease down one side. Some lower blades dry
  toward straw at the end.
- **Ear:** 19–23 units, in one wet layer. It is a faint body wash narrowing to the tip, with
  14–18 slim pointed grains alternating up the axis in a chevron (the plait). Grains on the
  shaded side are deeper, and a broken fine line runs down the shaded flank so the ear holds
  against sand. It goes from green `#a6b56a` to gold `#e2bd62`, with shade `#b98d3e`. The ear
  nods a little more as it ripens, toward the side the culm leans.
- **Awns (the beard):** one per grain, 30–38 units long (about 1.6 times the ear), straight,
  fanning 0.16–0.28 rad wider at the foot of the ear. They are fine needle dabs in their own
  layer: pale straw on the lit side and umber-gold on the shaded side, so the beard reads as
  hatching. Before ripening they stay fresh pale green. Behind each beard is a very faint gold
  haze that fades toward the tips; it is what makes the "tuft of gold whiskers" read in the
  overview. The engine's rim light (ADR 0146) catches the lit awns at sunrise and sunset.
- **The green ear:** one culm per plant (a late tiller, a little shorter) ripens only to
  0.08–0.2, so it stays green among the gold ones.
- **Growth** (tested continuous over 200 steps):
  - from 0: the seed mound;
  - 0.03–0.42: the blades, from the middle out;
  - 0.18–0.62: the culms lengthen (centre first) and their leaves leave at the nodes;
  - culm past half-height: the boot (the swollen flag-leaf sheath) at the top;
  - 0.46–0.74: the green ear pushes out of the boot, which slims to a sheath;
  - 0.54–0.86: the awns lengthen;
  - 0.68–1: the ears ripen to gold and nod, the stalks go straw, some blades dry.
- **Fit:** each culm, its ear and its awn tips are kept inside x ±54, y ≥ −140. A culm that
  overflows is shortened and stood up a little straighter.

## Budget
Paint time at 1.6×, growth 1, 6 seeds, in Chromium on a loaded machine (two agents running):
median 82–105 ms, max 108–134 ms over four runs. Cattail measured 27–32 ms in the same runs. It
is inside the 4–127 ms range at the median, but near its top. Fewer haze layers and single-layer
grain dabs made no measurable difference, so the cost is in the number of marks: about 30 blade
strokes, each with an ink crease, and two wet layers per culm.

## Tests
- `src/plants/species/barley.test.ts` (8): the `smallSuite` (definition, determinism, seed
  variety, more marks as it grows, continuity over 200 growths); a medium meadow crop without
  pollinators, with its cultivated range; 6–9 culms with exactly one staying green, and awns longer
  than 1.2 times the ear (60 seeds); every culm, ear and awn tip inside the box (60 seeds).
- `src/scenery/flora.test.ts`: the oasis pin gains `barley`; the garden's 25 and the
  waterfall's list are unchanged.
- `npx vitest run src/plants src/scenery/flora.test.ts` and `npm run typecheck` pass. No e2e
  was run (the task says not to).

## Looked at
All in `artifacts/op6-barley/`:
- **Round 1:** `barley-r1-1440x900.png` (studio section), `barley-r1-g1-s1-1440x900.png`.
  Wrong: the grains read as separate beads on a string, the haze showed as pale blotches at the
  awn tips, the boot below each ear read as a second small ear, and the nodes read as floating
  rice grains.
- **Round 2:** `barley-r2-g1-s1-1440x900.png`. A body under the grains made them dense, but the
  ears turned into rectangular blocks with sawn edges.
- **Round 3:** `barley-r3-g1-s1-1440x900.png` (narrower spindle body), `barley-r3-lineup-1440x900.png`,
  `barley-r3-flora-1440x900.png`, `barley-r3-overview-1440x900.png`. The line-ups read as gold
  bearded ears, clearly apart from the susuki's silver plumes, the cattail's brown cigars and
  the desert hyacinth's candle. Wrong in the oasis: gold ears on gold sand lost their edge, the
  awns vanished, and the stand looked leggy (long bare stalks over a low tuft).
- **Round 4:** `barley-r4-overview-1440x900.png`, `barley-r4-close-1440x900.png`. Shorter
  culms, larger ears and longer awns, 2 leaves on every culm, longer blades, darker shaded awns
  and a shaded flank line. In the overview it now reads as a tuft of gold whiskered ears. Wrong at
  close range: the grains were round pebbles in a honeycomb, not pointed grains.
- **Round 5:** `barley-r5-close-1440x900.png` (slim pointed grains in a chevron: reads as
  barley), `barley-r5-sunset-1440x900.png` (the rim light picks out the lit awns and edges),
  `barley-r5-night-1440x900.png` (muted, still readable), `barley-r5-phone-390x844.png` (a
  gold bearded tuft on the plot).
- **Round 6:** `barley-r6-studio-1440x900.png`, `barley-r6-lineup-1440x900.png`. Wrong: at
  growth 0.8 the awns of the still-green ears were a dark olive-brown and looked dead.
- **Round 7:** `barley-r7-studio-1440x900.png`. Unripe awns are now fresh pale green.

## Left open
- **Paint time** is the heaviest of the tier-2 set (about 100 ms median, the top of the range).
  If the budget tightens, start with the per-blade ink creases and merge the two wet layers per
  culm.
- **Crowding:** where three or four culms stand together, their ears and beards merge into one
  broom (seed 1 at growth 1). That is true of a real stand, but a little more spacing between the
  ears would read cleaner.
- **The green ear** is sometimes half hidden behind gold ones, or in shade, where it reads olive
  rather than green (seed 1 studio card).
- **The blades** are a fairly dark, dense clump at full growth; a lighter, more glaucous grey
  would set them further apart from the susuki's blades in the garden line-up.
- The basin perspective was being reworked (O2d) while this was shot, so the oasis shots judge
  only the plant.
- The range leaves out `mediterranean` (task over brief); add it if a Mediterranean scenery
  arrives.

## For the orchestrator to place
`| 122 | [OP6: Barley](122-barley.md) | A small stand of upright culms with narrow blue-green blades, each ending in a dense plaited ear with long straight awns fanning up and out; the ears push green out of their sheaths, grow their beards, then ripen to straw gold and nod a little, and one stays green |`

`| \`barley\` | Barley · Shʿir | 2 | meadow | 120×160 · .5/.92 | \`#e2bd62\` | no | small stand of 6–9 culms with two node leaves each over 7–10 narrow arching blue-green blades; each culm ends in a dense ear of 14–18 slim pointed grains in a chevron, every grain with a long straight awn (about 1.6 times the ear), pale on the lit side and umber-gold on the shaded one, over a faint gold haze; the ears push out of their boots green and ripen to straw gold, nodding a little, and one late ear stays green (oasis only, cultivated) |`

`| OP6.1 | Barley: \`smallSuite\` (determinism, seed variety, continuity over 200 growths) plus a medium meadow crop without pollinators and with its cultivated range; 6–9 culms with exactly one staying green, and awns longer than 1.2 times the ear (60 seeds); every culm, ear and awn tip inside the box (60 seeds); the oasis pin gains \`barley\`, the garden keeps its 25 and the waterfall its own | plants/species/barley; scenery/flora | studio › every entry renders | ✔ |`
