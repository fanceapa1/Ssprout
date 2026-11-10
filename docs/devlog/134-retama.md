# 134 · White broom (OP15, phase 13)

## What
The oasis's desert broom: **White broom** (*Retama raetam*, rtem in Darija), a leafless shrub of
the sandy oued banks and sand margins. It is a tier-2 `medium` plant for the sand, the banks and
the back. It adds only files, plus one id in a pinned test list:
- `src/plants/species/retama.ts`: the definition, the plan (`buildRetama`), the pose
  (`poseRetama`, pure, every mark at a growth value) and `retamaReach` (every painted point, for
  the box test).
- `src/plants/lib/retama-paint.ts`: new helpers `paintRods` (thin tapered ribbons with a light
  dry-brush break), `hazeShape`/`paintHaze` (the soft grey-green body under the rods) and
  `peaShape`/`paintPeas` (a pea flower: violet calyx, round white standard, small keel). No shared
  `lib/` helper was edited. `ribbonInto` and `inPlantSpace` (`shrub-paint`), `groundShadow` and
  `seedMound` (`small-paint`) and the stem helpers (`small-structure`) are only imported. It copies
  no code from henna's helper, so the two species' pixels stay independent.
- `src/plants/species/retama.test.ts`: `smallSuite('retama')`, plus pose continuity over 240
  growths (3 seeds), inside the box (24 seeds), a leafless weeping fountain foaming with flowers, the
  growth order, the definition, and the oasis slots it fits.
- `src/plants/notes/retama.ts`: the Note. It covers the desert broom of the sandy oueds, its scent,
  the roots that hold the drifting sand, and the Bible's *rotem*, the "juniper" under which Elijah rested
  (1 Kings 19). It says nothing about eating or collecting it.
- `src/scenery/flora.test.ts`: `'retama'` added to the pinned oasis list (sorted, one per line).

Definition:
- tier 2, `medium` (120×160, anchor .5/.92), habitats `path`, `shore` and `back`;
- `range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'coast'], climates: ['arid'] }`.
  It is wild, declared like the desert hyacinth: the sands, dunes and wadi banks of North Africa,
  Sicily, Sinai, the Levant and Arabia. The oasis offers it. The Japanese gardens (realm `japan`)
  do not;
- name "White Broom", `nativeName: 'Rtem'` (`ary-Latn`, to verify with a speaker like the other
  Darija names);
- bloomColor `#f6f2ea`, pollinators yes;
- description: "White broom — a fountain of silver rods that foams white in spring."

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged. The oasis flora board and
the tier-2 boards gain a card.

**Slots.** All path slots but two are small. The oasis slots it really fits are:
- path: `walk-3`, `walk-4` (medium, the sand either side of the footpath);
- shore: `oued-1`, `oued-3` (large) and `oued-2` (medium) on the oued banks, which is where it
  grows; also `rim-1`, `rim-4` and `seguia-2`;
- back: `high-2` (under the bluff) and `grove-1`.

The test pins `walk-3`, `walk-4`, `oued-1..3`, `high-2` and `grove-1`. `shore` also lets it
onto the basin rim and the seguia bank, which is a little wetter than its real home. Habitats cannot
pick out the oued slots alone.

## How it is painted
- **Shape:** 4–6 short grey-brown woody stems fan from the crown. From them spring 30–38 rods,
  rising almost straight up (a lean of at most 0.35 rad) and bending evenly along their length
  (`tipBias 0`). Inner rods are long (≈ 100) and bend little, so they stand over the crown and nod.
  Outer rods are shorter (≈ 60) and bend up to ≈ 2.9 rad, so they arch out and weep back toward
  the sand. Each rod has 1–3 fine twigs from its outer half, curving the same way. The result is a
  loose mound wider than it is tall.
- **Fitting the box:** a rod is first shrunk about its base to stay under the top. Then it is
  *squashed sideways* (`sx`) to stay inside ±51, so the heights and the weeping tips survive.
  Scaling uniformly instead stopped every arching rod at the side wall before it could turn down,
  and the bush read as straight spokes (found by a probe in round 8).
- **Colour:** rods are grey-green `#9aa58e` mixed toward silver `#c3c8b6`. Rods in the back band
  are cooler, glazed toward the violet-grey shadow. Young rods start fresh green `#8fac68` and turn
  grey as they ripen. There is a faint wet-in-wet grey-green body under them, so the bush reads as
  one mass at garden scale. Light comes from the upper left, so the body is darker on the lower right.
- **Flowers:** clusters of 2–4 sit every 5.5–8 units along the outer 70% of each rod and twig
  (82% of the nodes). Each flower hangs from the rod's underside on a short stalk: a small violet
  calyx `mix(#8d6a86, #a2967f)`, a round white standard `#fcf9f2`, a faintly violet keel, and a
  violet-grey shade on its lower side, wet in the same layer. They are painted `source-over`, so
  the white stays white over the green and on the sand. A thin rim keeps them visible on paper.
  Flowers on back rods are greyed. About 10% stay buds.
- **Growth:** seed mound → a few inner rods, fresh green and straight (0.08–0.3) → more rods
  rise and arch as they lengthen (their bend grows with them, until 0.85), the body fills in → buds
  appear along the rods (0.5–0.78) as small violet-grey beads with a cream tip → the standards open
  white (0.74–0.99). No mark pops in.
- **Cost:** draw at 1.6×, growth 1, seeds 2–9, on the main thread in headless Chromium against the
  dev server (`artifacts/op15/time-probe.mjs`). The machine was loaded (a second agent was running),
  so read the numbers as ratios. Each pair is median / max in one run:

  | Run | White broom | Henna | Pomegranate |
  |---|---|---|---|
  | 1 | 104 / 126 ms | 113 / 203 ms | 130 / 311 ms |
  | 2 | 102 / 124 ms | 62 / 77 ms | 121 / 182 ms |

  It costs about 1–1.6× henna and less than the pomegranate. Henna measured 29 ms on a quieter
  machine (devlog 124), which puts the white broom at roughly 30–50 ms, inside 4–127 ms. Moving
  the petal shade into the flower layer (two fewer drying passes) cut it from 143 to 108 ms in
  the loaded runs.

## Looked at
All in `artifacts/op15/`.
- **Round 1** (`r1-studio-1440x900.png`): the rods made a straight V broom, not a fountain. The
  flowers read as lilac bells: the calyx was too dark, and the shade glaze and keel too violet.
  The body showed as separate green discs, the woody stems were heavy trunks, and the buds were
  dark violet dots.
- **Round 2** (`r2-studio`, `r2-s2/s3`): the flowers turned white and the foam read. But the
  bush was two splayed fans with a gap in the middle, and the body patches stained past the rods.
- **Round 3** (`r3-studio`, `r3-s2/s3`, `r3-oasis-1440x900.png`): a fuller fountain. In the
  oasis it read at once as a white-flowering broom, clearly not henna (green dome, cream sprays),
  barley or the cattail. But the silhouette was a fan on a pinched stalk, and the ground shadow
  was a grey puddle.
- **Round 4–5** (`r4-*`, `r5-oasis-1440x900.png`): the flanks came lower, the rods got thinner
  and more silver, and the flowers a little smaller. Henna next to it in the oasis is plainly
  different.
- **Round 6** (`r6-close-noon-1440x900.png`, `r6-close-sunset-1440x900.png`): the close view on
  `walk-3` reads as a mound of rods with white clusters. At sunset the flowers take the warm light
  and the scene's long shadow falls to the left.
- **Round 7–8** (`r7-studio`, `r8-studio`, `r8-s2`): the probe found that most rods ended level
  (tip = their highest point). Fitting by uniform scale was the cause, which led to the sideways
  squash and even bending. After that the outer rods weep 10–20 units.
- **Round 9** (`r9-studio-1440x900.png`, `r9-seeds.png`, `r9-oasis-1440x900.png`,
  `r9-oasis-390x844.png`, `r9-close-night-crop.png`): a rounded fountain with a full crown and
  weeping flanks, foaming white over grey-green. The growth stages read: a few green rods (0.3) →
  a fuller mound of rods (0.55) → a grey-green mound beaded with buds (0.8) → white bloom (1). In
  the overview and on phone the white brooms stand apart from the henna, the gold desert hyacinth
  and the barley. At night the bloom is a pale moonlit foam.

## Left open
- **Flowers up close** are white ovals with a calyx dot. The pea shape (standard over keel)
  only shows at the close view, and some clusters look a little like popcorn.
- At growth 0.55 the young rods are straight and green, more like a grass clump than a broom.
  They arch only as they lengthen (that is the intent, but the stage is grassy).
- The rods converge into a narrow base. A real old rtem has a short gnarled trunk and a broader
  crown at the foot.
- `shore` also admits the basin rim and the seguia bank, which are wetter than its real home.
- The white edge of the bloom is a little dusty grey at overview scale (it comes from the thin
  rim that keeps flowers visible on paper).
- Bee targeting on the white clusters was not looked at.
- "Rtem" needs checking with a speaker, as do the other Darija names.
- Not run here (per the task's CPU rules): `npx playwright test tests/e2e/studio.spec.ts` and the
  full suites.

## For the orchestrator to place
`| 134 | [OP15: White broom](134-retama.md) | A leafless desert broom: a loose fountain of fine grey-green to silver rods that rise from a few short woody stems, arch over and weep at the flanks, foaming in bloom with small white pea flowers in violet calyces hung along the rods |`

`| \`retama\` | White Broom · Rtem | 120×160 · medium | path, shore, back | \`#f6f2ea\` | yes | leafless desert broom: 4–6 short grey-brown woody stems, 30–38 fine grey-green to silver rods that rise nearly straight, bend evenly and weep at the flanks (squashed sideways to stay in the box), 1–3 fine weeping twigs each, a faint wet-in-wet grey-green body; clusters of 2–4 small white pea flowers (violet calyx, round white standard, faintly violet keel) hang along the outer rods, source-over so they stay white; young rods fresh green and straight, then arching, then budded with violet-grey beads, then a white haze (oasis only, wild) |`

`| OP15.1 | White broom: \`smallSuite\` plus pose continuity of every rod, twig, body patch and flower over 240 growths (3 seeds), inside its box (24 seeds), a leafless weeping fountain (≥ 30 rods, ≥ 30 twigs, > 1/3 of the rods with tips hanging below their highest point, wider than 0.75 × its height) with > 300 open flowers and some buds; a few rods → a fuller mound with no flowers → buds only → open bloom; tier 2, medium, path, shore and back, wild range, white bloomColor, bees; fits \`walk-3\`, \`walk-4\`, \`oued-1..3\`, \`high-2\` and \`grove-1\`; the oasis pin gains \`retama\` | plants/species/retama; scenery/flora | studio › every entry renders | ✔ |`
