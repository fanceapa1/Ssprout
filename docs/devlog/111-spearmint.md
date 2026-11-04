# 111 · Spearmint (P1, phase 13)

## What
The oasis's mint bed: **spearmint** (*Mentha spicata*, naʿnaʿ in Darija), the mint of Moroccan
tea. It is a tier-1 `small` plant for the seguia's lip and the footpath. It adds only files, plus
one id in a pinned test list:
- `src/plants/species/spearmint.ts`: the definition and the plan (`planSpearmint`).
- `src/plants/lib/spearmint-paint.ts`: new helpers `mintLeaves` (the leaves of one stem in one
  wet layer), `mintSpike` (the whorled flower spike) and `dampSoil`. No shared `lib/` helper was
  edited; `paintStem`, `plantFrame`, `groundShadow`, `dabAxis`, `shadowSide`, `makeStem`,
  `stemPoints`, `pointAt`, `subPath` and the growth easings are only imported.
- `src/plants/species/spearmint.test.ts`: `smallSuite('spearmint')`.
- `src/plants/notes/spearmint.ts`: the Note from the brief.
- `src/scenery/flora.test.ts`: `'spearmint'` added to the pinned oasis list (sorted, one per
  line). The garden keeps its 25 and the waterfall its own (both pinned lists still pass).

Fields:
- tier 1, `small`, box 86×86 drawn in the 70-unit design box, anchor .5/.88;
- habitats `shore`, `path` (the oasis has `seguia-*`, `rim-*`, `bar-1`, `oued-4` and `walk-*`
  small slots for it);
- `range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] }`, as the
  task says. The brief also lists `mediterranean`; I left it out so no other scenery starts
  offering it. The oasis offers it; the waterfall and the Japanese garden do not;
- `nativeName: 'Naʿnaʿ'`, `nativeLang: 'ary-Latn'`; bloomColor `#b9a0c8`; `pollinators: true`.
- It lands between the rock tobacco and the violet in `plants-a-review/lineup-t1`. The id
  sorts after `anemone`, so `allSpecies()[0]`, `ui-shell` and `widget` are unchanged.

## How it is painted
- **Patch, not plant:** 8–11 upright stems at uneven spacing along a ±18-unit mat, with the
  middle ones tallest and the outer ones leaning out. Each stem has its own depth: the far ones
  start a little higher, are a touch paler and are painted first. 2–3 **runners** creep out
  sideways over the soil, each with a small new leaf pair at its tip.
- **Stems:** thin, light green with a faint mauve cast and a faint ink line on the lower part.
  Every stem is fitted into the box with its spike and its widest leaf.
- **Leaves:** 5–7 opposite pairs per stem, decussate. The pairs alternate between spread to the
  sides and one leaf toward us and one away (shorter, the far one darker). They are largest
  mid-stem. Each leaf is a narrow lance in the brief's fresh green (`#86a75a`, lifted a little
  toward sage-light because the paper's multiply dulls it in the garden). It has 4–7 small
  forward teeth per margin and a sunken midrib and 2–4 side veins per side in the deep green
  (`#5f7d45`). A stem's leaves share one wet layer, dried source-over with a fine mottle for the
  crinkle, so the leaves merge instead of stacking into mud.
- **Spikes:** the 4 tallest stems always end in a spike; the rest do on about a third of
  seeds. A spike is a slender tapering axis with 6–9 whorls of 4–6 tiny round florets. The lower
  whorls stand apart and the upper ones crowd into the tip. They are grey-green calyces first,
  then lilac (`#b9a0c8`) with the pale (`#d6c6dc`) on the front florets. All in one wet layer.
- **Growth** (tested continuous over 200 steps):
  - from 0: a faint patch of damp soil;
  - 0.02–0.32: the runners creep out and their tip pairs unfold;
  - 0.06–0.6: the stems rise one after another, straight at first, taking their lean as they
    lengthen. The leaf pairs unfold just behind each tip, from upright along the stem to spread;
  - from about 0.5 to 0.86: the spikes push up from the stem tips as green calyces;
  - 0.72–1: the flowers open from the base of each spike up, the spikes one after another.
- **Cost:** 50 ms median and 54 ms max at growth 1, 1.6×, seeds 1–8, on the main thread in
  headless Chromium against the dev server. Caper measured 26 ms and iwatabako 13 ms in the same
  run. All three are inside the 4–127 ms budget.

## Looked at
All shots are in `artifacts/p1-spearmint/` (gitignored). The app shots plant spearmint into
`seguia-1`, `seguia-3`, `rim-2`, `rim-3`, `walk-2`, `walk-3`, `walk-5` and `bar-1` with
`sprout.start(20, { speciesId: 'spearmint', sceneryId: 'oasis', slotId })` and
`completeSession()`, then `sprout.plants.settle()`. The oasis background was not judged (O3 is
repainting the water).
- Round 1, `spearmint-r1-1440x900.png` (the studio section) and `spearmint-r1-seeds.png` (seeds
  1–6):
  - it read as mint at once: paired leaves and lilac spikes;
  - but it was a sparse, evenly spaced row of tall stalks, like a fence, not a cushion;
  - the stems were thick dark spears with a bare pointed top;
  - the leaves were too round and pale, and the teeth were detached dark dots;
  - the spikes were blobby, lupin-like;
  - the runners were heavy dark dashes and the soil a grey blob.
- Round 2, `spearmint-r2-seeds.png`, `spearmint-r2-overview-1440x900.png`,
  `spearmint-r2-close-{noon,sunset,night}-1440x900.png` and `spearmint-r2-phone-390x844.png`
  (denser and shorter stems at uneven spacing, more leaf pairs up to the spike, narrower leaves,
  finer teeth, slimmer spikes, lighter stems and runners):
  - the studio cards now read as a leafy patch;
  - at overview size: green cushions with lilac spires, the freshest green in the gold;
  - in the close view the leaves went dull olive under the paper. The stems still made vertical
    dark lines, like a barcode, and the spikes read grey-violet;
  - sunset and night both read, and on the phone it is a green tuft with lilac candles by the
    seguia.
- Round 3, `spearmint-r3-close-noon-1440x900.png`, `spearmint-r3-lineup-t1-1440x900.png`,
  `spearmint-r3-flora-oasis-1440x900.png` and `spearmint-r3-studio-1440x900.png` (fresher leaf
  tone, lighter thinner stems, more lean variety, paler spikes):
  - the 2× crop of the close view reads clearly as mint: square stems, paired toothed lance
    leaves, lilac whorled spikes;
  - in the tier-1 line-up it matches its neighbours' scale, a little taller. It looks nothing
    like the violet, forget-me-not or iwakagami beside it;
  - the growth cards (0.1, 0.3, 0.55, 0.8, 1) go soil → runners and shoots → leafy cushion with
    green spikes → spikes opening → full bloom, with nothing popping in;
  - the runners were still straight lines on the ground, so they now curve.
- Round 4, `spearmint-r4-seeds.png`, `spearmint-r4-overview-1440x900.png`,
  `spearmint-r4-close-{noon,sunset,night}-1440x900.png` and `spearmint-r4-phone-390x844.png`:
  - all six seeds differ in spread, height and spike count, and all read as one mint bed;
  - the overview, sunset, night and phone hold. At night the spikes stay lilac-blue and
    readable.
- No look-alike in the set: the only other whorled flower is the kurinsō (tier 2, one stout
  scape with flat magenta primroses over a basal rosette). The alfalfa (lilac, tier 1) is not
  painted yet; the brief's line (paired leaves and tapering spikes vs leaves of three and round
  clusters) holds for this side.

## Left open
- The spikes read as dotted strings at studio size. Real spearmint whorls are denser, and the
  lowest, separated whorls can look like stray dots.
- Where leaves of near and far stems overlap, the source-over layers show each other's edges a
  little (a translucent look). The crinkle and sunken veins read only in the close view and in
  studio cards.
- On some seeds the stems still stand too evenly upright (a slight fence).
- The facing leaf pairs are a simple shortened pair, not a true foreshortened leaf.
- The runners are faint and read only in studio cards.
- `cultivatedIn` lists only `n-africa-arabia` (task) and not also `mediterranean` (brief).
- The native name `Naʿnaʿ` follows the brief. The pitfalls ask for a check with a speaker, and
  for a Tamazight name where known; neither is done.
- Not run per the task's CPU rules: `npx playwright test tests/e2e/studio.spec.ts` and the full
  e2e. Ran: `npx vitest run` on spearmint, the plants registry, notes and draw tests,
  `src/scenery/flora.test.ts`, `src/scenery/oasis` and `src/core` (33 files, 561 tests, all
  pass), and `npm run typecheck`.

## For the orchestrator to place
- **docs/devlog/README.md:**
  `| 111 | [P1: spearmint](111-spearmint.md) | A patch of upright square stems from runners, opposite crinkled toothed lance leaves in the freshest green, and slender spikes of lilac whorls | — |`
- **Species table** (`docs/systems/plants-species-a.md`):
  `| \`spearmint\` | Spearmint · Naʿnaʿ | 1 | shore, path | 86×86 · .5/.88 | \`#b9a0c8\` | yes | patch of 8–11 upright square stems risen from runners; opposite decussate pairs of crinkled, toothed, bright fresh-green lance leaves with sunken veins; slender tapering spikes of tiny lilac whorls opening from the base up (oasis only, cultivated) |`
- **docs/TESTING.md:**
  `| P1.1 | Spearmint: \`smallSuite\` (determinism, seed variety, continuity over 200 growths); the oasis offers it, the garden keeps its 25 and the waterfall its own | plants/species/spearmint; scenery/flora | studio › every entry renders | ✔ |`
