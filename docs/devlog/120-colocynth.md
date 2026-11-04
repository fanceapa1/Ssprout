# 120 · Colocynth (OP4, phase 13)

## What
The oasis's trailing desert gourd: the **colocynth** (*Citrullus colocynthis*, lḥdej in Darija).
It is a tier-1 `small` vine that lies flat on the sand. It adds only files, plus one id in the
pinned oasis list:
- `src/plants/species/colocynth.ts`: the definition and the plan (`planColocynth`).
- `src/plants/lib/colocynth-paint.ts`: new helpers `lobedLeaves`, `tendrils`, `gourd`, `flowers`
  and `sandBed`, plus the ground view (`SIN_E`, `COS_E`, `toScreen`). It is imported only by the
  species. No shared `lib/` helper was edited. `plantFrame`, `groundShadow`, `shadowSide`,
  `petalPose`, `makeStem`, `stemPoints`, `pointAt`, `subPath` and the growth easings are only
  imported.
- `src/plants/species/colocynth.test.ts`: `smallSuite('colocynth')` plus two plan checks over 60
  and 30 seeds:
  - at least 5 runners;
  - 2–3 gourds, each on its own runner, the first ripening fully and the others below 0.7;
  - at least 2 male flowers;
  - for each gourd, the flower opens after the first runner starts and before the gourd swells,
    and the gourd has swelled before it ripens.
- `src/plants/notes/colocynth.ts`: the Note from the brief.
- `src/scenery/flora.test.ts`: `'colocynth'` added to the pinned oasis list (sorted, one per
  line). The garden keeps its 25 and the waterfall its own.

Fields:
- tier 1, `small`, box 86×86 drawn in the 70-unit design box, anchor .5/.62. The crown sits a
  little below the middle so the vine can lie all round it, behind and in front.
- habitats `path`, `rock`;
- `range: { realms: ['n-africa-arabia'], biomes: ['desert'], climates: ['arid'] }` (wild, from the
  brief). Only the oasis offers it.
- `nativeName: 'Lḥdej'`, `nativeLang: 'ary-Latn'`; bloomColor `#e8c75a`; `pollinators: true`.
- The id sorts after `caper` and before `daimonjiso`, so it is the **second card of the tier-1
  line-up board**. `ui-shell` and `widget` (anemone) are unchanged.

## How it is painted
- **The ground view:** everything is planned on the ground plane, then foreshortened. Depth shrinks
  to 0.42 on screen (about 25° up), and heights to 0.91. So the vine is a wide, low ellipse, and
  nothing stands up but a leaf held on its stalk and the flowers.
- **Runners:** 5–7 hairy runners radiate from the crown at uneven angles and lengths (17–31
  units), with wavy bends. About half of them fork part-way, so the mat is a tangle, not a star.
  Each runner is fitted inside the box with its leaves padded. A runner is one pale grey-green
  stroke, painted back to front.
- **Leaves:** one per node, alternating, on a short stalk, lifted a little off the sand. Each is a
  watermelon leaf:
  - a long end lobe, one pair of side lobes, and on about 70 % of leaves a second, smaller pair;
  - the big lobes lobed again (lobules) and rounded at the tips;
  - grey-green `#93a067` with some deeper tones, a thin deep rib in each lobe and strong
    granulation for the rough surface;
  - all of a runner's leaves in one wet layer, so the lobes merge at the base.
  Leaves shrink toward the runner's tip.
- **Tendrils:** fine coiled ink springs at about two-thirds of the outer nodes, opposite the leaf.
- **Flowers:** small, five-lobed, pale yellow (`#e8c75a` lightened 30 % toward petal white, so they
  stay paler than the gold gourds). They face up and are seen at the garden's angle (`petalPose`).
  - 2–4 male flowers stand on short stalks at nodes clear of the gourds.
  - Each gourd has a female flower first, which shrivels as its ovary swells.
  - They are painted over the leaves (source-over), so they don't go muddy.
- **Gourds:** 2–3, lying on the sand on the near side of the mat when there is room, each beside a
  node with a short stalk. A gourd has three parts:
  - a cool cast shadow to the lower right;
  - a ball of a few slightly wandering round fills in one source-over wet layer. Ten stripes are
    wrapped round the sphere along its lying axis (a projected sphere: they narrow to the poles,
    and the far side is dropped), with a few mottles;
  - a stepped shade on the flank away from the light, and a pale reserved light on the near
    shoulder.
  Young gourds are green (`#7f9a52`) striped with pale yellow (`#e3d38a`). Ripening turns the
  ground to gold (`#e9c150`, chroma 0.137, under the 0.145 gold ceiling) and the stripes to a
  faint ochre. At growth 1 the first gourd is fully gold, and the others are at 0.45–0.65 and
  0–0.12 (three gourds) or 0.1–0.4 (two). So two or three ripeness stages always show.
- **Growth** (tested continuous over 200 steps; nothing pops in):
  - 0–0.14: a seed in a small dimple of sand;
  - 0.06–0.4: the root crown;
  - 0.03–0.62: the runners creep out one after another, with the forks following their parents;
  - leaves unfold just behind each tip and swing out from along the runner, and the tendrils coil
    out;
  - ~0.36–0.8: each gourd's female flower opens and then shrivels;
  - 0.46–0.84: the male flowers open;
  - 0.5–0.86: the gourds swell, starting at the node and rolling out to their place on the sand;
  - ~0.8–1: they ripen to gold.
- **Cost:** 40.5 ms median and 46.8 ms max at growth 1, 1.6×, seeds 2–9, in headless Chromium
  against the dev server. The caper measured 34.1 / 40.6 ms in the same run. Both are inside the
  4–127 ms budget.

## Looked at
All shots are in `artifacts/op4-colocynth/` (gitignored). The garden shots plant through
`sprout.start(25, { speciesId, sceneryId: 'oasis', slotId })` and `completeSession()` into
`walk-1..6` and `talus-2`, with capers in `wall-3`, `wall-4` and `talus-1` to compare against. They
use `sprout.plants.settle()`, `setTime` and `camera.settle()`. The oasis background was not judged
(O1b is polishing it).
- Round 1, `colocynth-r1-1440x900.png` (the studio section) and `colocynth-r1-seeds.png` (seeds
  1–6):
  - it read at once as gourds on a vine;
  - the balls had a pointed top, like lemons (the `round` dab's tip);
  - the sand bed was a wide whitish cloud;
  - the crown dab read as a small grey ball;
  - the flowers were as big and as gold as the ripe gourds;
  - the half-ripe gourd looked fully gold.
- Round 2, `colocynth-r2-seeds.png` and `colocynth-r2-growth.png` (growth 0.1, 0.3, 0.55 and 0.8):
  - round balls and three clear ripeness stages;
  - the growth arc reads (seed, runners and leaves, flowers, green balls, gold);
  - the flowers were now too small to find;
  - the dry-brushed runners read as dashed chains;
  - gourds placed behind the mat seemed to float above it.
- Round 3, `colocynth-r3-seeds.png`, `colocynth-r3-overview.png` (with
  `colocynth-r3-overview-crop.png`) and `colocynth-r3-close.png` (with
  `colocynth-r3-close-crop.png`):
  - gourds now prefer the near side, and the flowers are visible;
  - the solid runners were too dark, so they were softened;
  - at overview: green vine mats with yellow and green balls on the sand, clearly not the caper's
    blue-green mounds with white-violet flowers;
  - close: lobed leaves, tendrils and striped balls all read;
  - but a grey halo (sand bed plus ground shadow) sat round the mat, and the ripe gold was a flat
    lemon.
- Round 4, `colocynth-r4-seeds.png`, `colocynth-r4-close-crop.png`,
  `colocynth-r4-lineup-t1-s1.png` (with `colocynth-r4-lineup-t1-crop.png`, beside the caper),
  `colocynth-r4-light.png` (sunset over night, from `colocynth-r4-close-sunset.png` and
  `colocynth-r4-close-night.png`), `colocynth-r4-phone.png` and
  `colocynth-r4-phone-overview-night.png`:
  - brighter gold with a shaded flank, and no grey halo;
  - in the line-up it is clearly apart from the caper, but lighter in weight than its upright
    neighbours;
  - at sunset the gold glows;
  - at night the balls stay pale and readable, but male flowers on nodes beside a gourd were
    painted over the ball as extra pale spots;
  - on the phone: gold, half-ripe and green balls, lobed leaves, tendrils and flowers all read.
- Round 5, `colocynth-r5-seeds.png`, `colocynth-r5-studio-crop.png` (the studio section) and
  `colocynth-r5-close-night-crop.png`: male flowers now keep clear of the gourds.

## Left open
- In the close view at night one male flower on its stalk can still touch the top edge of a green
  gourd. Spacing is checked on the ground, not on screen.
- On some seeds (seed 3) there is no room on the near side, and one gourd lies behind the mat,
  where it reads a little as floating above it.
- Where the leaves of several runners stack at the crown, the mat goes darker olive than the outer
  leaves.
- Being flat, it uses only the lower third of its box. In the line-ups and the close view it looks
  smaller and lighter than the upright tier-1 plants.
- No hairs are painted on the runners. At garden scale they would be sub-pixel. The rough look
  comes from granulation only.
- No withered vine with dry gourds left on the sand (the Note's late season).
- Not run per the task's CPU rules: `npx playwright test tests/e2e/studio.spec.ts` and the full
  e2e. Ran: `npx vitest run src/plants src/scenery` (81 files, 662 tests, all pass) and
  `npm run typecheck` (clean).

## For the orchestrator to place
- **docs/devlog/README.md:**
  `| 120 | [OP4: Colocynth](120-colocynth.md) | A prostrate desert gourd vine lying flat on the sand: forked hairy runners with deeply lobed grey-green watermelon leaves and coiled tendrils, a few small pale yellow five-lobed flowers, and two or three round gourds on the sand, green striped with pale yellow, the oldest ripened to gold |`
- **Species table** (`docs/systems/plants-species-a.md`):
  `| \`colocynth\` | Colocynth · Lḥdej | 1 | path, rock | 86×86 · .5/.62 | \`#e8c75a\` | yes | prostrate vine seen flat on the ground (depth foreshortened to 0.42): 5–7 forking hairy runners radiating from the crown, deeply lobed grey-green watermelon leaves on short stalks, coiled tendrils; 2–4 small pale yellow five-lobed flowers; 2–3 round tennis-ball gourds lying on the sand beside the nodes, green striped with pale yellow, ripening to gold, the oldest fully gold at growth 1 (oasis only, wild) |`
- **docs/TESTING.md:**
  `| OP4.1 | Colocynth: \`smallSuite\` (continuity over 200 growths, determinism, seed variety) plus at least 5 runners, 2–3 gourds each on its own runner with the first ripening fully and the others below 0.7, at least 2 male flowers (60 seeds); for each gourd, the flower opens before it swells and it swells before it ripens (30 seeds); the oasis pin gains \`colocynth\`, the garden keeps its 25 and the waterfall its own | plants/species/colocynth; scenery/flora | studio › every entry renders | ✔ |`
