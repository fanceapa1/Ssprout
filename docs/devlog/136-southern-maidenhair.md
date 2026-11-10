# 136 · Southern maidenhair (OP17, phase 13)

## What
The oasis's fern: the **southern maidenhair** (*Adiantum capillus-veneris*, the Venus-hair fern),
a tier-1 `small` plant of wet walls, springs and wells. It spills from a damp seep on a wall
coping or a wet bank. It only adds files, plus one id in the pinned oasis list:
- `src/plants/species/southern-maidenhair.ts`: the definition, the plan
  (`planSouthernMaidenhair`) and a pure pose function (`frondPose`) that the tests use.
- `src/plants/lib/southern-maidenhair-paint.ts`: new helpers `fanOutline`, `fanLeaflets`,
  `wireStalks` and `dampSeep`. No shared `lib/` helper was edited.
- `src/plants/species/southern-maidenhair.test.ts`: `smallSuite` plus plan, box, continuity, sori
  and garden tests (below).
- `src/plants/notes/southern-maidenhair.ts`: the Note.
- `src/scenery/flora.test.ts`: `'southern-maidenhair'` added to the pinned oasis list.

Fields:
- tier 1, `small`, box 86×86 drawn in the 70-unit design box, anchor .5/.6. The root sits a little
  high, so the fronds can hang over a coping or a bank lip.
- habitats `rock` and `shore`. The wall copings `wall-1…5` and the talus take it, and so do the
  basin's near rim (`rim-2`, `rim-3`, `rim-5`) and the seguia and oued banks (`seguia-1`,
  `seguia-3`, `oued-4`, `bar-1`). The test pins `wall-2…4`, `rim-2`, `rim-3` and `seguia-1`, the
  wettest of them. The talus and the sand bar also take it, because they share those habitats.
  They are less wet, but nothing in the slot model separates them.
- `range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['wetland', 'wet-cliff'],
  climates: ['arid', 'warm-temperate'] }`. The oasis offers it, and the Japanese garden and the
  waterfall do not (tested). *A. capillus-veneris* is nearly cosmopolitan and also grows wild in
  warm southern Japan. `japan` is left out on purpose, as the cattail leaves out its other realms:
  - both Japanese sceneries already have their own maidenhair (`maidenhair-fern`, *A. pedatum*),
    and a second one there would blur the two;
  - the waterfall is cool-temperate, where this warm-climate fern does not belong anyway.
- `nativeName: 'Qesbour l-bir'` ("the well's coriander", Arabic *kuzbarat al-biʾr*),
  `nativeLang: 'ary-Latn'`. **Verify the Darija spelling with a speaker.** It was simplified from
  the Arabic, as the oasis research does for the other names.
- bloomColor `#a2c46e` (it has no flowers, so the swatch is the frond green); `pollinators: false`.
- The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged. By id it sorts
  just before `spearmint`, so it joins the tier-1 boards there.

## How it is painted
- **Root:** a faint cool damp stain, a small dark wet hollow, flat soft glazes of moss and, at
  first, the tiny heart-shaped prothallus a fern starts as (it fades by growth 0.3). It is unlike
  the caper's broken crack seam.
- **Fronds:** 7–9 hair-fine black-purple stipes (`#3b2a35`, an ink line 0.26 wide), fanned out
  from the seep. Each one arches out and droops under a gravity bend. The later and outer fronds
  hang furthest, and some late fronds leave almost level and spill straight over the edge. Every
  frond, with its leaflets, is fitted into the box at its young, mid and full droop.
- **Pinnae:** 4–7 alternate wiry branches on the upper 60 % of each stipe, long at the bottom and
  short at the tip. Each drapes toward the ground. The drape turns by `cos(angle)`, so a branch
  pointing straight up never flips side between growth steps; a `lerpAngle` toward "down" did,
  and the continuity test caught it.
- **Leaflets:** wedge fans cut into 2–4 lobes, finely toothed on sterile fronds and shallowly cut
  on fertile ones. Each hangs on a hair stalk from its branch, plus one leaflet at each branch tip
  and one at the frond tip. They are custom polygons (`fanOutline`), laid down as two thin
  transparent fills plus a denser fill at the stalk end, in one wet layer per frond. Where they
  overlap the wash builds up, which gives the translucency. Some leaflets get a small soft lifted
  light, and the drying pass pools a darker rim. The green is a fresh pale `#a4cc68`, cooler on
  the back fronds.
- **Sori:** on about half of the grown fronds, half their leaflets roll their lobe tips over as
  short pale-brown strokes (`#bc9b6c`) at growth 0.84–1. Every third lobe is skipped, so the rims
  don't read as brackets.
- **Growth** (24 steps, continuous; frond windows staggered over 0.03–0.9):
  - 0–0.3: the prothallus, then the first croziers stand up tightly rolled;
  - each crozier unrolls as its stipe lengthens and droops, and its pinnae open behind the
    uncurling tip;
  - 0.5–0.8: a fuller hanging clump;
  - 0.84–1: the full cascade with sori on the rolled margins.
- **Cost:** 10 ms median and 11 ms max at growth 1, 1.6×, seeds 1–8, on the main thread in headless
  Chromium against the dev server (second round of the probe). These ran in the same probe:
  - spearmint: 51 ms median, 56 ms max;
  - caper: 26 / 32 ms;
  - maidenhair fern: 17 / 23 ms.

  It is cheap because the leaflets are plain polygon fills in one layer per frond, not multi-layer
  dabs.

## Tests
- `smallSuite('southern-maidenhair')`: definition, determinism, seed variety and keyed-mark
  continuity over 200 growths (the stipes, seep and moss).
- Plan: 7–9 fronds, and at least two hang leaflets below the root at full growth (40 seeds).
- Every stipe point and leaflet stays inside the design box at extents 0.3, 0.6, 0.8 and 1
  (40 seeds).
- Leaflet continuity, keyed per leaflet over 200 frond extents: a leaflet only appears small, never
  jumps or vanishes, and changes size gradually.
- Sori only show when the sori phase is on.
- In the gardens: the oasis offers it, the garden and the waterfall do not, and it fits `wall-2…4`,
  `rim-2`, `rim-3` and `seguia-1`.
- Ran: `npx vitest run src/plants src/scenery` (88 files, 739 tests pass) and `npm run typecheck`.
  Not run, per the task's CPU rules: `tests/e2e/studio.spec.ts` and the full e2e.

## Looked at
All shots are in `artifacts/op17/` (gitignored).
- `base-ctx-1440x900.png`: capers on the walls and spearmint on the rims, to judge the slots
  before drawing.
- Round 1, `sm-r1-1440x900.png` (studio section):
  - it read as a maidenhair at once;
  - no croziers showed at 0.1–0.3;
  - the stipes were heavy umbrella spokes;
  - the sori edged every leaflet in brown, which read as dying;
  - the seep was a grey puddle.
- Rounds 2–3, `sm-r2…r3`: thinner stipes, fewer sori, more droop, a longer crozier phase. The
  croziers still flashed by too fast.
- Round 3–4 close-ups, `sm-r3-g1`, `sm-r4-g1`:
  - the lifted lights were hard white D-shaped holes, so they became small soft ellipses;
  - the sori were brackets on every lobe;
  - the moss read as olives.
- Round 5, `sm-r5-g1`, `sm-r5-oasis`:
  - the moss glazes were too dark;
  - at garden scale the clumps read as dark, olive spiders, not fresh green.
- Round 6, `sm-r6-oasis`, `sm-r6-close`:
  - a brighter green, larger leaflets, a softer rim and lighter stems;
  - on the copings it sits on the edge and spills down the wall face;
  - cool and fresh against the pisé, and clearly apart from the caper's blue-grey with white
    stars and the spearmint's upright lilac spikes.
- Round 7–8, `sm-r7-1440x900.png`, `sm-r8-seeds.png` (seeds 2 and 5 at growth 1):
  - after the cos drape fix, the pinnae stood up too much, so the droop was raised;
  - the leaflets now hang from their branches;
  - lobed fans, translucent overlaps and pale-brown rolled margins.
- Final, `sm-final-overview-1440x900.png`, `sm-final-close-sunset-1440x900.png` (`rim-2`,
  `rim-3`) and `sm-final-night-phone-390x844.png` (`wall-3` under a caper): it reads in all three.
  At sunset the leaflets stay green and airy, and at night it stays readable beside the caper.

## Left open
- The fronds still fan out from one point, so at phone and close sizes some seeds look a little
  like a spider (the caper has the same note). Splitting the seep into two or three rhizome points
  would help.
- A few pinna branches that leave pointing straight up keep a bare upward twig with the leaflets
  hanging below it.
- There are no fine fan veins in the leaflets. They would only show in the close view.
- The green pigment `#a4cc68` was not run through `pigments.test.ts`, which only checks the shared
  pigments. By eye it sits within the species' chroma range.
- The final studio-section shot was taken before the last droop change (r7). The seeds sheet (r8)
  and the oasis shots show the final state.
- Verify `Qesbour l-bir` with a Darija speaker.

## For the orchestrator to place
- **docs/devlog/README.md:**
  `| 136 | [OP17: Southern maidenhair](136-southern-maidenhair.md) | The Venus-hair fern of wet walls: hair-fine black-purple stalks arching from a damp seep and hanging, many lobed translucent fan leaflets, croziers that unroll, pale-brown rolled sori at full growth; oasis only, rock and shore |`
- **docs/TESTING.md:**
  `| OP17.1 | Southern maidenhair: \`smallSuite\` (continuity over 200 growths) plus 7–9 fronds with at least two hanging below the root, every stipe and leaflet inside the design box at four extents (40 seeds), keyed leaflet continuity over 200 frond extents (appear small, never jump or vanish), sori only in their phase; the oasis offers it and the garden and the waterfall do not; it fits wall-2…4, rim-2, rim-3 and seguia-1 | plants/species/southern-maidenhair; scenery/flora | studio › every entry renders | ✔ |`
- **Species table** (`docs/systems/plants-species-c.md` column format):
  `| \`southern-maidenhair\` | Southern Maidenhair · Qesbour l-bir | 86×86 · small (anchor .5/.6) | rock, shore | \`#a2c46e\` | no | Venus-hair fern spilling from a damp seep: hair-fine black-purple stipes arching over and hanging, alternate wiry pinnae with many lobed, finely toothed fan leaflets on hair stalks in a fresh translucent pale green; croziers unroll from a heart-shaped prothallus; pale-brown rolled margins (sori) at full growth (oasis only; not the garden's A. pedatum) |`
