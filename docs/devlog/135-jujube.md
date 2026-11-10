# 135 · Wild jujube (OP16, phase 13)

## What
The oasis's wild thorn shrub: **wild jujube** (*Ziziphus lotus*, sedra in Darija), the lotus of the
Lotophagi. A tier-3 `large` shrub for the oued banks and the back. It adds only files, plus one id in
a pinned test list:
- `src/plants/species/jujube.ts`: the definition, the plan (`buildJujube`) and the pose
  (`poseJujube`, pure, every mark at a growth value).
- `src/plants/lib/jujube-paint.ts`: new helpers `paintStems` with `thornShape` (pale dry-brush
  stems, a broken dark underside, paired thorns), `leafOval`/`paintLeaves` (small glossy ovals with a
  lifted gleam), `floretShape`/`paintFlorets` (tiny green-gold stars), `fruitOutline`/`paintFruits`
  with `skinOf` (glossy drupes with a reserved highlight and a shade crescent), `driftShape`/`paintDrift`
  (the sand caught at the foot) and `paintHaze` (the grey of the massed twigs). No shared `lib/`
  helper was edited; `ribbonInto`, `groundShadow`, `seedAndShoot`, `inPlantSpace`, the
  `shrub-growth` maths and `UP` are only imported.
- `src/plants/species/jujube.test.ts`: `shrubSuite` plus the checks below.
- `src/plants/notes/jujube.ts`: the Note (the Lotophagi of the Odyssey; the thorns cut and piled into
  hedges round the plots; the mounds catching sand).
- `src/scenery/flora.test.ts`: `'jujube'` added to the pinned oasis list (sorted, one per line).
  The garden keeps its 25 and the waterfall its own list. `jujube` sorts after `anemone`, so no
  shared studio card changes.

Fields:
- tier 3, `large`, box 200×220, anchor .5/.93 (like the oleander and the Damask rose);
- habitats `shore` and `back`. In the oasis that is the large oued-bank slots **`oued-1` and
  `oued-3`** (the sedra's real place, the oued terraces) and the two back tree slots `high-1` and
  `palm-1`. It was planted and looked at on `oued-1`, `oued-3` and `palm-1`. No large `path` slot
  exists (`walk-3`/`walk-4` are medium), and the rock slots are small, so neither is listed;
- `range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert'], climates: ['arid'] }`,
  wild, like the caper. The Japanese gardens' realm is `japan`, so they do not offer it;
- `nativeName: 'Sedra'`, `nativeLang: 'ary-Latn'`; `pollinators: true` (bees work its small
  nectar-rich flowers);
- `bloomColor: '#c4472f'`, the ripe fruit's red, not the flowers' green-gold: the fruit is the
  reward and the swatch should say so. Bees target this colour; it was not looked at;
- description: "Wild jujube — sweet red lotus fruit in a tangle of thorns." (59 characters).

## How it is painted
- **Mound:** 11–14 main stems fanned from a crown about 30–50 units wide in a ragged dome (a dome
  76×100 units or so whose edge swells and dips in three harmonics per seed), wider than tall.
  Stems that meet the edge bend down once and stop, so the outline is a rounded-to-sprawling mound.
  A quarter of the side branches may bristle a little past it.
- **Stems:** each internode swings to the other side of the heading, so every stem zigzags (the
  test checks the turn flips side at more than 70 % of nodes). Side branches leave most nodes on
  the outer side of the zig, and short spurs leave the side branches: 150–220 stems in all. Pale
  silver-grey (`#ada798`) in one dry-brush layer per depth band with granulation, a broken darker
  underside (`#7d7568`), and a faint grey wash of the massed twigs behind them (`paintHaze`) so the
  shrub reads grey at the overview.
- **Thorns:** a pair at most nodes: a slim straight spine on one side and a short hook bent back on
  the other, red-brown (`#8a6a50`).
- **Leaves:** 0–2 small glossy ovals (4–5.4 units) at a node, bright to deep green
  (`#6b973f`…`#3f6a2c`), with the shaded half deepened and a lifted gleam on the lit half. About
  450–580 per plant: sparse enough that the grey tangle shows between them.
- **Flowers:** tiny five-pointed green-gold stars (`#d8cc64`) at the fruiting nodes and some
  others, from 0.58; each shrinks away as its fruit sets.
- **Fruit:** 45–75 small round drupes (radius 2.2–2.8) on short stalks, mostly on the outer, upper
  twigs. They set at 0.74–0.86 as small green beads, swell, and ripen from 0.82 through gold and
  orange to red; four in five end red to rust-red, the rest stay gold or orange. A glossy body
  (source-over, so the red stays clean over leaves), the gleam on the lit shoulder left as paper,
  and a shade crescent.
- **Sand:** a low drift (a little nebkha) builds round the foot from 0.18 to 0.8: a pale sand wash
  that fades downward, and its shaded flank.
- **Growth:** seed and shoot (to 0.22) → a few zigzag thorny shoots (0.3) → the leafy tangle
  (0.55) → tiny flowers (0.6–0.8) → green fruit (0.75–0.86) → ripening to red (0.82–1). Branches
  extend from their tips along a fixed path, so nothing jumps; every mark starts below 1.2 % of
  the box.
- **Colours** are under the ART_DIRECTION ceilings: leaves ≤ 0.128 OKLab chroma, the fruit red
  0.165 and orange 0.143 (the scarlet accent ceiling is 0.17).
- **Cost:** 60 ms median and 73 ms max at growth 1, 1.6×, seeds 2–9, on the main thread in headless
  Chromium against the dev server, on a loaded machine (load average about 16). In the same run the
  Damask rose took 73/77 ms, the pomegranate 57/70 ms and the oleander 98/99 ms. That is inside the
  4–127 ms budget. An earlier version with three leaves at most nodes (about 1,500 leaves) was cut
  for both the look (a green hedge) and the cost.

## Tests
`src/plants/species/jujube.test.ts` (9 tests):
- `shrubSuite`: tier 3, habitats, native name, determinism, rng use independent of growth;
- pose continuity over 240 growths (no mark jumps, appears large or vanishes large), seeds 1, 3, 8;
- inside its box at growth 1, clear of the sides and top (16 seeds), with thorns, leaves, fruit and
  the drift;
- a low, wide, tangled mound: width/height > 1.2, under 135 tall, more than 100 stems, main stems
  zigzag (turns flip side > 70 %), thorns in straight/hooked pairs (> 200 pairs);
- small leaves (< 6) and many small fruit (≥ 35, radius < 3), most ripe red but not all;
- stage order: shoots without flowers or fruit at 0.3, leaves without fruit at 0.55, more than 20
  open flowers at 0.72, fruit at 0.88, riper fruit and the full drift at 1;
- the wild range, bees, description under 80.

`npx vitest run src/plants src/scenery`: 88 files, 737 tests pass. `npm run typecheck` passes.
`tests/e2e/studio.spec.ts` (`E2E_PORT=4193`, one worker): 11 of 12 passed on the first run; shard 1
timed out at 60 s on the "UI · camera controls" section with the machine at load 16 (another agent
running). Re-run alone it passed in 55.8 s, close to the 60 s limit on this loaded machine.

## Looked at
All in `artifacts/op16/` (crops in the session scratchpad).
- Round 1, `jujube-r1-1440x900.png`: read as a cherry shrub: airy, fruit too big and uniformly
  dark, pale outlined leaves like polka dots, stems a smooth vase of rods.
- Round 2, `jujube-r2-1440x900.png`: dense, but the fruit overwhelmed (a berry bush) and the
  outline was a hard geometric half-dome.
- Round 3, `jujube-r3-1440x900.png`: a ragged outline, but a dense green hedge, not a grey tangle.
- Round 4, `jujube-r4-1440x900.png`: sparse leaves; it reads as a thorny twiggy tangle with red
  fruit. The stems were dark brown (heavy wet edges) and the flowers did not show.
- Round 5, `jujube-r5-1440x900.png`: pale grey zigzag stems; tiny gold stars at 0.8; warmer sand.
- Round 6, `jujube-r6-oasis2-1440x900.png`: in the oasis overview on `oued-1`, `oued-3` and
  `palm-1`, beside the pomegranate on the left. The jujube reads as a low twiggy mound dotted with
  small red fruit, clearly apart from the pomegranate's round leafy crown with big crowned fruit,
  the rose's soft pink cups and the oleander's dark fountain. The grey nearly vanished on the sand,
  hence the twig haze. (`jujube-r6-oasis-1440x900.png`, the brief's random tier-3 fill, did not
  happen to pick the jujube.)
- Round 7, `jujube-r7-close-noon-1440x900.png`: up close the paired thorns, the zigzag and the paper
  gleams read; the stalk ran into the fruit's centre like a tomato's calyx, and the drift was a dark
  flat plate with a hard lower edge.
- Round 8, `jujube-r8-close-noon-1440x900.png`, `jujube-r8-close-sunset-1440x900.png`,
  `jujube-r8-close-night-1440x900.png`: stalks stop at the fruit's rim, the drift is a soft
  hump. At sunset the rim light gilds the leaves and the fruit glows orange; at night the fruit is
  the brightest note without glowing.
- Round 9 (after bringing the colours under the ceilings): `jujube-r9-1440x900.png` (every growth
  stage reads in order: seedling, thorny zigzag shoots, the leafy tangle, gold stars among the
  leaves, the fruited mound) and `jujube-r9-phone-390x844.png` (the phone close view; the ground
  shadow and the drift together still made a grey plate under the foot).
- Round 10, `jujube-r10-phone-390x844.png`: a smaller, fainter ground shadow; the foot sits in soft
  shade on its drift.

## Left open
- The seed shown in a close view changes from session to session, and some seeds are a taller,
  more triangular mound than others; all stay low and wide by test, but the flattest seeds look
  most like a sedra.
- At the overview the grey of the stems is carried by the haze more than by the stems themselves.
- The three-veined leaves show only as a gleam; veins are too small to paint at this scale.
- The flowers are tiny by design and only read in the studio and close views.
- No fallen fruit or leaves at the foot.
- `bloomColor` is the fruit's red; bee targeting on it was not looked at.

## For the orchestrator to place
`| 135 | [OP16: Jujube](135-jujube.md) | A low, ragged mound of pale silver-grey zigzag stems with paired straight and hooked thorns, sparse small glossy leaves, tiny green-gold flowers, and many small round fruit ripening from green through gold and orange to red, over a little drift of sand |`

`| \`jujube\` | Wild Jujube · Sedra | 200×220 · large | shore, back | \`#c4472f\` | yes | a low, wide, ragged mound of 11–14 pale silver-grey zigzag stems from a broad crown, side branches and spurs at the nodes, paired thorns (a straight spine and a short hook) at most nodes, a faint grey haze of massed twigs; 0–2 small glossy oval leaves per node; tiny green-gold star flowers; 45–75 small round glossy drupes on short stalks on the outer twigs, ripening green → gold → orange → red/rust with a paper gleam; a drift of sand at the foot (oasis only) |`

`| OP16.1 | Wild jujube: \`shrubSuite\` plus pose continuity of every stem, thorn, leaf, flower and fruit over 240 growths, inside its box (16 seeds), a low wide tangled mound (width/height > 1.2, > 100 stems, zigzag main stems, thorns in straight/hooked pairs), small leaves and ≥ 35 small fruit mostly ripe red, shoots → leaves → flowers → fruit → ripening; wild range, bees; the oasis pin gains \`jujube\`, the garden keeps its 25 and the waterfall its own | plants/species/jujube; scenery/flora | studio › every entry renders | ✔ |`
