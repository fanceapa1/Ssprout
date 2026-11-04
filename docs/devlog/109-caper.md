# 109 · Caper (P3, phase 13)

## What
The oasis's first wall plant: the **caper** (*Capparis spinosa*, kebbar in Darija). It is a tier-1
`small` plant that roots in a crack in an old wall and spills down over the edge. It adds only
files, plus one id in two test files:
- `src/plants/species/caper.ts`: the definition and the plan (`planCaper`).
- `src/plants/lib/caper-paint.ts`: new helpers `wallCrack`, `fleshyLeaves`, `stipuleSpines`,
  `caperBuds` and `caperFlower`. No shared `lib/` helper was edited; `paintStem`, `plantFrame`,
  `groundShadow`, `shadowSide`, `petalPose`, `stemPoints`, `pointAt`, `subPath` and the growth
  easings are only imported.
- `src/plants/species/caper.test.ts`: `smallSuite('caper')` plus the plan (5–7 long shoots, at
  least two of them ending well below the root, 1–3 flowers, never on the short crown shoots) and
  every shoot inside the design box at full growth (60 seeds).
- `src/plants/notes/caper.ts`: the Note from the brief.
- `src/scenery/flora.test.ts`: `'caper'` added to the pinned oasis list (sorted, one per line).
  The garden keeps its 25 and the waterfall its own (both pinned lists still pass).
- `src/scenery/oasis/oasis.test.ts` (**outside my species files, O2's path**): the test "offers
  only its own species so far" checked that every oasis species is *cultivated* in
  `n-africa-arabia`. The caper is the first oasis species that grows wild there, so the check now
  also accepts a species whose wild `realms` include `n-africa-arabia`. It is a one-line change,
  in its own commit. The oleander (P9) would hit the same check.

Fields:
- tier 1, `small`, box 86×86 drawn in the 70-unit design box, anchor .5/.42 (the root sits high,
  so the shoots can hang down the wall face below it);
- habitats `rock`, `path`;
- `range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert'], climates: ['arid'],
  cultivatedIn: ['mediterranean'] }`, from the brief. The oasis offers it; the waterfall and the
  Japanese garden (realm `japan`) do not;
- `nativeName: 'Kebbar'`, `nativeLang: 'ary-Latn'`; bloomColor `#f4ece6`; `pollinators: true`.
- The id sorts before `daimonjiso`, so the caper is now the **first card of the tier-1 line-up
  board** (`plants-a-review/lineup-t1`). It sorts after `anemone`, so `ui-shell` and `widget` are
  unchanged.

## How it is painted
- **Root:** a short dark broken seam (the crack) with a cool hollow round it, a seed in it at
  first, and a small olive-brown crown where the shoots meet. A faint cool shadow sits under the
  mat.
- **Shoots:** 5–7 long zigzag shoots plus 3–4 short crown shoots that fill the mound. Each long
  shoot is a turtle stem whose turn alternates at each node (the zigzag) on top of a gravity
  droop. 2–3 of them start downward and hang down the wall; the rest rise out sideways and arch
  over and down. Every shoot is fitted into the box with its leaves, capers and flowers padded,
  at both its young (stiff) and its full (drooping) bend. Shoot bases spread a little, so they
  don't all leave one point.
- **Leaves:** alternate, round and fleshy (`#8ea47a`), on the outside of each zigzag kink,
  shrinking toward the tip. Each shoot's leaves are one wet layer, with a faint midrib. A second
  source-over pass lays a pale blue-grey bloom on each leaf's lit flank, which gives the glaucous
  look.
- **Stipule spines:** a pair of small tan hooked needles at every node. They read only in the
  close view.
- **Capers:** green balls (`#8a9a52`) on short stalks in the outer axils (about half the outer
  nodes).
- **Flowers:** 1–3 per plant, at an outer node of a long shoot, on a long stalk that lifts them
  clear of the leaves. Each flower has three parts:
  - a cool cast shadow, because white reads only by its edge;
  - four broad crinkled white petals. On about 60 % of plants the upper two carry a pink flush
    (`#e8c4cc`);
  - the fountain: 22–32 filaments drawn as raw curves in one wet layer. They are pale near the
    centre and violet (`#a35a8c`) on their outer 40 %, and they arch outward. They burst wider
    the more face-on the flower is. Gold anthers (every third one violet) and a green pistil on
    its stalk finish it.
- **Growth** (tested continuous over 200 steps):
  - 0–0.14: the seed in the crack;
  - 0.05–0.56: the shoots trail out one after another, stiff at first, drooping as they lengthen;
  - leaves unfurl just behind each tip and swing out from along the stem;
  - 0.42–0.78: the capers and the flower buds swell, and the flower buds whiten at the tip;
  - 0.74–1: the flowers open, then the stamens draw out of the centre.
- **Cost:** 27 ms median and 45 ms max at growth 1, 1.6×, seeds 1–8, on the main thread in
  headless Chromium against the dev server. Iwatabako measured 14 ms in the same run. Both are
  inside the 4–127 ms budget.

## Looked at
All shots are in `artifacts/p3-caper/` (gitignored). The close and overview shots plant capers
into `wall-1..5`, `talus-1`, `talus-2` and `walk-3` with `sprout.start(…, { sceneryId: 'oasis',
slotId })` and `completeSession()`. The oasis background was not judged (O2 is repainting it).
- Round 1, `caper-r1-1440x900.png` (the studio section) and `caper-r1-seeds.png` (seeds 1–6):
  - it read as a caper at once;
  - the petals were almost invisible, so each flower was a violet pom;
  - the plant was a flat Y-shaped spray, not a mound.
- Round 2, `caper-r2-seeds.png` (with short crown shoots, bigger and more opaque petals):
  - the petals now read white;
  - the crown went near-black where translucent leaves stacked;
  - the stem ink made the crown a dark knot, and a grey shadow blob sat beside it.
- Round 3, `caper-r3-seeds.png`, `caper-r3-close.png` and `caper-r3-overview.png`:
  - lighter crown leaves, less ink and a softer shadow; the stamens arch;
  - on the walls it sits on the coping and spills down the face, as it should;
  - at overview size the flowers read mauve rather than white.
- Round 4, `caper-r4-seeds.png`, `caper-r4-studio-1440x900.png`, `caper-r4-close.png`,
  `caper-r4-sunset.png`, `caper-r4-night.png`, `caper-r4-phone.png`,
  `caper-r4-lineup-1440x900.png` (`flora/oasis`) and `caper-r4-lineup-t1-1440x900.png`
  (`plants-a-review/lineup-t1`):
  - with paler filaments and violet only at the tips, the flowers read white with violet fuzz;
  - the capers were too small to see at growth 0.8, so they were made bigger and more frequent;
  - the zoomed crop of the close view looks right: round leaves, pink flush, gold anthers, the
    pistil;
  - sunset glows, and at night the flowers stay pale and readable;
  - on the phone the mat reads, but at 3× the shoots fan like a spider from the root;
  - in the line-ups the caper matches its tier-1 neighbours' scale, a little heavier.
- Round 5, `caper-r5-seeds.png`: shoot angles, lengths and bases were varied, so the X fan
  breaks up. The sideways-facing flowers' stamens all pointed one way, like a comb.
- Round 6, `caper-r6-seeds.png` and `caper-r6-studio-1440x900.png`:
  - the stamens now burst all round, like a firework;
  - at overview size that hid the white again, so the burst was narrowed a little and the violet
    kept to the outer 40 %.
- Round 7, `caper-r7-overview.png`, `caper-r7-close-sunset.png` and `caper-r7-phone-night.png`:
  - at overview: blue-green trailing mats with white stars fringed violet;
  - the close view at sunset and the phone at night both read.
- `caper-r6-overview.png`: plumbing, not art. On two runs the overview showed only the cracks. My
  probe awaited `plantsReady()`, which does not wait for the growth to ease in after
  `completeSession()`. With `sprout.plants.settle()` the plants show (rerun as r7).

## Left open
- At phone and close sizes the long shoots still fan a little evenly from one root (an X or Y on
  some seeds). More length variety or a few shoots crossing back over the mound would help.
- Where many leaves stack in the crown it is still darker than the outer leaves.
- No elongated fruit late in the season (optional in the brief).
- Each plant has only open flowers or green buds. There is no spent, withered day-old flower
  (the "single day" of the Line).
- The spines are visible only in the close view and in studio cards. At garden scale they are
  sub-pixel, as expected.
- Not run per the task's CPU rules: `npx playwright test tests/e2e/studio.spec.ts` and the full
  e2e. Ran: `npx vitest run src/plants src/scenery` (all pass after the oasis test change) and
  `npm run typecheck`.

## For the orchestrator to place
- **docs/devlog/README.md:**
  `| 109 | [P3: caper](109-caper.md) | A trailing mound of zigzag shoots spilling from a wall crack, round glaucous leaves with hooked stipule spines, green capers, and big white flowers with a fountain of violet-tipped stamens | — |`
- **Species table** (`docs/systems/plants-species-a.md`):
  `| \`caper\` | Caper · Kebbar | 1 | rock, path | 86×86 · .5/.42 | \`#f4ece6\` | yes | trailing mound of zigzag shoots spilling down a wall from a crack; alternate round glaucous blue-green leaves with a pair of hooked spines at each base; green capers in the axils; 1–3 big four-petalled white flowers, upper petals flushed pink, with a fountain of violet-tipped stamens (oasis only) |`
- **docs/TESTING.md:**
  `| P13.3 | Caper: \`smallSuite\` (continuity over 200 growths) plus 5–7 long shoots with at least two hanging below the root, 1–3 flowers only on long shoots, every shoot inside the design box (60 seeds); the oasis offers it, the garden keeps its 25 and the waterfall its own; the oasis may offer species wild in its realm | plants/species/caper; scenery/flora; scenery/oasis | studio › every entry renders | ✔ |`
