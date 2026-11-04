# 113 · Southern cattail (OP5, phase 13)

## What
The oasis's water plant: **southern cattail** (*Typha domingensis*, berdi in Darija). It is a
tier-2 `medium` plant for the basin's water slots and the shore by the oued and the seguia. It
adds only files, plus one id in a pinned test list:
- `src/plants/species/cattail.ts`: the definition and the plan (`planCattail`, `leafPath`).
- `src/plants/lib/cattail-paint.ts`: new helpers `strapLeaves` (the flat twisting leaves in one
  wet layer), `strapEdge` (a fine ink margin), `cattailSpikes` (the spike pair on a stalk),
  `spikeLayout` and `slicePath`. No shared `lib/` helper was edited. `paintStem`, `plantFrame`,
  `groundShadow`, `bendProfile`, `makeStem`, `stemPoints`, `pointAt`, `pathLen` and the growth
  easings are only imported.
- `src/plants/species/cattail.test.ts`: `smallSuite('cattail')`, plus plan checks (habitats and
  reflection, 2–4 stalks each with a gap and a male spike thinner than the cigar, 1–2 broken
  leaves, every leaf and stalk inside the box over 60 seeds).
- `src/plants/notes/cattail.ts`: the Note from the brief, without its "(verify)" flag.
- `src/scenery/flora.test.ts`: `'cattail'` added to the pinned oasis list (sorted, one per line).
  The garden keeps its 25 and the waterfall its own (both pinned lists still pass).

Fields:
- tier 2, `medium`, box 120×160, anchor .5/.92;
- habitats `water`, `shore`; `reflect` is left at its default (true);
- `range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['wetland'], climates: ['arid',
  'warm-temperate'] }`, wild only, as the brief gives it. The realm keeps it out of the Japanese
  garden and the waterfall (it is not a Japanese plant). The oasis offers it;
- `nativeName: 'Berdi'`, `nativeLang: 'ary-Latn'`; bloomColor `#8a5a3a`; `pollinators: false`
  (wind);
- description: "Cattail — brown velvet candles where the basin spills over." (the brief's Line).
- The id sorts after `anemone`, so `allSpecies()[0]`, `ui-shell` and `widget` are unchanged. It
  lands between the balloon flower and the cosmos in `plants-a-review/lineup-t2`.

## How it is painted
- **Leaves:** 10–13 flat straps fanned from a ±9-unit clump, 85–136 units long and 2.9–3.8 wide
  (narrow for their length, unlike the iris's swords). Most stand nearly straight; the outer ones
  are more likely to arch over in their top half. Each is a polygon ribbon, parallel-sided and
  narrowing to a point only in its last third. Its width breathes with a slow twist (0.35–1.1
  half-turns): where it turns edge-on it narrows to a third, and where its back faces us that run
  is glazed a deeper, cooler green. Straw (`#d8c38a`) creeps down from the tips. The grey-green is
  the brief's `#9aa86a`. All the back leaves share one wet layer and the front ones another, so
  they overlap as glazes. A fine broken ink line runs down one margin: it is what makes a strap
  read flat, not as a brush stroke (susuki) or a dab (iris).
- **Broken leaves:** 1–2 per clump dry to straw and fold over at a point 40–65 % up, the rest
  hanging back down.
- **Stalks:** 2–4 stiff, nearly straight stalks, 118–138 units, spread a little apart. The stalk
  is painted below the cigar and through the gap only, so the cigar is never crossed by a line.
- **Female spike (the cigar):** 26–33 units long, 5.6–6.4 wide: a cylinder with rounded caps
  round the stalk, in one wet layer dried source-over. Its body is the brief's brown `#8a5a3a`,
  the flank away from the light is the shade `#6a4430`, a narrow sheen is lifted on the lit
  flank, and light granulation gives the velvet.
- **The gap:** 2.4–5 units of bare stalk, or nearly closed (0.6–1.2) on about 15 % of stalks, as
  the brief says the species sometimes is.
- **Male spike:** 15–21 units, under half the cigar's width, gold-green then straw (`#c9b07a`).
  As it frays, short pale needles stand off it and a few grains of shed pollen drift beside it.
- **Late season:** on about a third of the stalks a faint dry-brushed halo of fluff lifts off
  the lit side of the cigar at the very end.
- **Water:** a faint celadon glaze and two ripple rings from growth 0, a darker glaze over the
  feet and two short ripple strokes either side, like the mizubashō. The scene adds the
  reflection on water slots (ADR 0116).
- **Growth** (tested continuous over 200 steps):
  - from 0: the still water and its rings;
  - 0.02–0.6: the blades rise one after another, middle first, straight at first and taking
    their arch as they lengthen;
  - 0.3–0.7: the stalks rise, fading in;
  - 0.42–0.82: the spikes swell at the stalk tops, green;
  - 0.45–0.9: straw creeps down the leaf tips; 0.5–0.95: the broken leaves dry and fold over;
  - 0.72–0.98: the cigars turn brown and the male spikes gold; 0.84–1: the male spikes fray
    and shed; 0.9–1: the fluff on some cigars.
- **Cost:** 20 ms median and 22 ms max at growth 1, 1.6×, seeds 2–9, on the main thread in
  headless Chromium against the dev server. In the same run the iris took 23 ms, the mizubashō
  39 ms and the susuki 58 ms. Inside the 4–127 ms budget.

## Looked at
All shots are in `artifacts/op5-cattail/` (gitignored). The app shots plant the cattail into
`basin-2`, `basin-4` (water), `oued-2` and `rim-1` (shore) with
`sprout.start(30, { speciesId: 'cattail', sceneryId: 'oasis', slotId })`, `completeSession()` and
`sprout.plants.settle()`, then pin the light. The oasis background was not judged (O4 is
repainting it).
- Round 1, `cattail-r1-1440x900.png` (studio section) and `cattail-r1-g1-1440x900.png`:
  - there were no cigars at all, only a scatter of brown specks: the spike layer dried with
    `speckle`, which keeps the granules and drops the body;
  - the leaves read as a snake plant (sansevieria): far too wide, stiff and mottled;
  - the stalks were lost behind the leaves.
- Round 2, `cattail-r2-seeds.png` (seeds 1–6; `granules` in place of `speckle`, leaves narrowed
  to 2.9–3.8, less flow mottle, taller stalks):
  - it read as a cattail at once: green straps and brown sausages on stalks, a gap and a thin
    frayed spike above;
  - but the cigars had faceted, hexagonal ends and a dark line down their middle (the stalk
    and its ink line showing through), and they were short and fat, a pinkish granite rather
    than velvet;
  - the broken leaves read as straw blades bent over; on some seeds they cross the clump like
    sticks.
- Round 3, `cattail-r3-seeds.png`, `r3-spike-crop` (a 3× crop, scratchpad) and the app set
  `cattail-r3-{overview,close-basin,close-oued,sunset,night}-1440x900.png`,
  `cattail-r3-phone-390x844.png` (22-point caps, source-over, less granulation):
  - rounded caps now, but the stalk still showed through the cigar, so the stalk is now
    painted only below the cigar and through the gap; the cigar is slimmer and longer;
  - the male-spike needles were dark barbs, like a thistle: now more, shorter and paler;
  - in the overview the clumps read clearly as cattails in the basin and by the oued: green
    blades with brown sausages, as the brief asks;
  - the celadon water glaze made a pale disc round the foot, like a decal: softened;
  - against the ochre cliff at sunset the cigars lose some contrast: the shade flank and edge
    are now deeper.
- Round 4, `cattail-r4-lineup-t2-1920x1080.png`, `cattail-r4-strip-1440x900.png` and the app set
  `cattail-r4-*`:
  - in the tier-2 line-up it is as tall as the susuki and taller than the iris, and nothing
    like either: the susuki has silver plumes and arching thin blades, the iris has a fan of
    swords with violet flowers;
  - the growth strip goes water → blades → stalks → green spikes → brown cigars with no pop;
  - with 4 stalks the cigars bunched and overlapped like a bundle of sausages: the stalks now
    spread wider.
- Round 5, `cattail-r5-seeds.png`, `cattail-r5-studio-1440x900.png` and
  `cattail-r5-{overview,close-basin,close-oued,sunset,night}-1440x900.png`,
  `cattail-r5-phone-390x844.png`:
  - all six seeds differ in stalk count, spread, leaf arch and broken leaves, and the cigars
    stand apart;
  - the close views in the basin and on the oued shore, sunset, night (cigars stay dark and
    readable, the reflection holds) and the phone all read.

## Left open
- **No oued shallows slot fits it.** `shallows-1`/`shallows-2` take only `small`, so a medium
  cattail can stand in the basin (`basin-1`…`basin-5`) but by the oued only on the shore
  (`oued-1`, `oued-2`, `oued-3`), not in its water. A medium shallows slot (or the brief's basin
  overflow corner) is for the scenery owner.
- On shore slots it still paints its little celadon pool, as the mizubashō does. On sand by the
  oued that reads as a wet hollow, but a draw that knew its habitat could drop it.
- The broken leaves fold at a single sharp point and some seeds lay one across the clump like a
  stick. Real ones crease and hang more softly.
- The fluff halo is very faint and shows only in studio cards.
- Against the ochre cliff (close view, sunset) the brown cigars are quieter than on water.
- The twist is a width change and a face glaze only; the strap's midline does not shift as it
  turns.
- The native name `Berdi` follows the brief, which flags it "(verify the Darija)". No Tamazight
  name.
- Not run, per the task's CPU rules: `npx playwright test tests/e2e/studio.spec.ts` and the full
  e2e. Ran: `npx vitest run src/plants src/scenery` (73 files, 592 tests, all pass) and
  `npm run typecheck`.

## For the orchestrator to place
- **docs/devlog/README.md:**
  `| 113 | [OP5: southern cattail](113-cattail.md) | A clump of flat twisting grey-green straps going straw at the tips, stiff stalks with a velvet brown cigar, a bare gap and a thin fraying straw male spike, a few broken dry leaves, standing in still water | — |`
- **Species table** (`docs/systems/plants-species-a.md`):
  `| \`cattail\` | Southern Cattail · Berdi | 2 | water, shore | 120×160 · .5/.92 | \`#8a5a3a\` | no | clump of 10–13 flat, twisting grey-green strap leaves going straw at the tips, 1–2 dry and broken over; 2–4 stiff stalks each with a velvet chocolate cigar, a bare gap and a thin straw-gold male spike that frays and sheds; in still water (oasis only, wild) |`
- **docs/TESTING.md:**
  `| OP5.1 | Southern cattail: \`smallSuite\` (determinism, seed variety, continuity over 200 growths); 2–4 stalks with a gap and a thin male spike, 1–2 broken leaves, inside the box; the oasis offers it, the garden keeps its 25 and the waterfall its own | plants/species/cattail; scenery/flora | studio › every entry renders | ✔ |`
