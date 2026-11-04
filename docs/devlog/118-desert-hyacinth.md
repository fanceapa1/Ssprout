# 118 · Desert hyacinth (OP7, phase 13)

## What
The oasis's leafless candle: **Desert hyacinth** (*Cistanche phelypaea*, danun in Darija), a
broomrape that lives on the roots of tamarisk and saltbush. Only its golden spike comes up through
the sand. It is a tier-2 `medium` plant for the sand and the back. It adds only files, plus one id in
a pinned test list:
- `src/plants/species/desert-hyacinth.ts`: the definition, the plan (`planDesertHyacinth`) and the
  pose (`poseSpike`: axis, stem split, every flower's opening at a growth value).
- `src/plants/lib/desert-hyacinth-paint.ts`: new helpers `crackedMound` (the sand mound, its
  shaded lip and the cracks round each foot), `scaledStem` (the cream column, its buff flank, the
  violet-brown flush at the foot and the overlapping scales) and `flowerSpike` (the gold column,
  bracts, tubes, two-lipped lobes and throats in one wet layer). Only the species imports it. No
  shared `lib/` helper was edited. The `small-*` growth and structure helpers are only imported.
- `src/plants/species/desert-hyacinth.test.ts`: `smallSuite` (continuity over 200 growths and the
  rest), plus the habitats and range, one to three spikes with the first the tallest and > 25
  flowers each, flowers opening bottom-up (all closed when opening starts, all open at growth 1),
  and inside the box (60 seeds).
- `src/plants/notes/desert-hyacinth.ts`: the brief's Note, unchanged. It says nothing about
  digging or collecting (§6 Pitfalls).
- `src/scenery/flora.test.ts`: `'desert-hyacinth'` added to the pinned oasis list (sorted, one
  per line). The garden keeps its 25 and the waterfall its own list.

Fields:
- tier 2, `medium`, box 120×160, anchor .5/.92 (like the cattail);
- habitats `path` and `back`;
- `range: { realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'coast'], climates: ['arid'] }`,
  wild, as the brief gives it;
- `nativeName: 'Danun'`, `nativeLang: 'ary-Latn'` (the brief asks to verify the local name);
- bloomColor `#e5b63c`; `pollinators: true`; description: the brief's Line.

**All six oasis `path` slots are `small`**, so in the oasis today a medium plant only takes the two
medium `back` slots, `high-2` and `grove-1`. `path` stays in the habitats as the brief asks: it is
right for the plant, and it starts to count once a garden has a medium sand slot.

## How it is painted
- **No green anywhere.** Stem cream `#e8d9b0` with a buff shaded flank on the right. The scales
  are pale cream-tan (toward `#b39a6a`) pointed dabs with a darker edge, overlapping round the
  column on a golden-angle spiral. On 70% of seeds the foot is flushed violet-brown, a glaze that
  is lost upward.
- **Spike:** a dense column, full in its lower half and a blunt cone at the top. It holds about
  0.85 flowers per unit of length (≈ 45–60 on the main spike) on a golden-angle spiral. Each
  flower is a pale bract, a tube that starts as a bud pressed up the axis then turns out (up to
  ~45°) and goes gold, and five lobes (`#efd27a`). Seen side-on they are two lips; flowers facing
  out show a rosette, and only those get a faint warm throat. The column under the flowers turns
  deep gold below the opening front, so the gaps read as shade, not paper.
- **One to three spikes** (1: 1/6, 2: 1/2, 3: 1/3). The first is tallest (112–130) and nearly
  central. The others stand 13–18 to either side, 70–100 tall, leaning out a little, painted
  behind it.
- **Ground:** a low gold sand mound with a soft shaded lip, fine cracks radiating from each foot,
  and pale sand lying over the foot of each stem.
- **Growth:** the mound and the cracks open first (0–0.18). Then a stubby scaly bud cone pushes up
  (the main spike rises over 0.08–0.6, slow at first). The bare stem lengthens under the tight bud
  cone. From about 0.48 the flowers open from the bottom up, and the last open at 1. Side spikes
  start later (0.18–0.74). Every mark grows from zero in place, so nothing pops in.
- **Budget:** 42 ms median, 52 ms max at 1.6× over 8 seeds (cattail 19/27 and caper 28/37 in the
  same probe), inside 4–127 ms.

## Looked at
All in `artifacts/op7-hyacinth/` (crops in the session scratchpad).
- Round 1, `r1-studio-1440x900.png`, `r1-s1..s3-1440x900.png`: the gold candle shape read at
  once. But the flowers jutted out like dog-bones with round blobs on the ends (popcorn), brown
  throat dots everywhere looked like eyes, the scales were dark beads like a pine cone on a thin
  stem, there was a brown coin at the foot, and grey patches showed inside the spike.
- Round 2, `r2-s1/s2-1440x900.png`: denser, and a candle from a distance. But the flowers were
  uniform round splodges, the stem was a hard rectangle with a flat purple block at the foot, the
  scales looked like grey cellophane, and there was still a tan lens at the foot.
- Round 3, `r3-s1/s2-1440x900.png`, `r3b-s2-1440x900.png` (and its crops): the spike now reads
  as a dense column of gold flowers, but the mouths were four-blob clovers and the scales poked
  out past the stem. The lens was the foot dab: a dab grows from its point to one side.
- Round 4, `r4-s2-1440x900.png`, `r4-studio-1440x900.png`, `r4-lineup-t2-1440x900.png`,
  `r4-flora-oasis-1440x900.png`: five-lobed star flowers on a gold column, pale scales hugging a
  fleshy stem. On the tier-2 board it is the only leafless plant, a gold candle as tall as the
  cattail. There is no yellow lupin- or loosestrife-like spike to confuse it with, and the
  cattail is brown and leafy. In the growth stages the tip at 0.3 was a thin rod already two
  thirds high.
- Round 5: `r5-studio-1440x900.png` (a stubby scaly cone at 0.3, a tall closed cone at 0.55,
  opening bottom-up at 0.8); `r5-overview-1440x900.png` (small gold candles on `high-2` and
  `grove-1`, read at once against the terraces); `r5-close-1440x900.png` (grove-1, two spikes);
  `r5-sunset-1440x900.png` and `r5-night-1440x900.png` (`high-2`: still a gold candle in the warm
  light, and at night an ochre one); `r5-phone-390x844.png` (two spikes in the sand, clear).

## Left open
- **Flower spike up close:** at the close view the flowers merge into a crumpled gold mass. Side
  tubes are only a hint, and the two-lipped profile is not clearly drawn.
- The closed bud cone (0.45–0.55) is pale and a little cocoon-like. Its overlapping bracts read as
  mottling rather than scales.
- The stem's flat dark bottom edge shows where the sand glaze is thin. On some seeds the
  violet flush is faint.
- The close view of `grove-1` frames the plant at the edge behind the palm trunks. That is the
  camera's framing of an edge slot, not the plant.
- With no medium `path` slot in the oasis it only grows on `high-2` and `grove-1`. A medium sand
  slot (or a sand bar near tamarisk) would put it where the brief says it lives.
- Bees are allowed (`pollinators: true`), but bee targeting on the spike was not looked at.
- `Danun` and the bloom months are still marked *(verify)* in the brief.

## For the orchestrator to place
`| 118 | [OP7: Desert hyacinth](118-desert-hyacinth.md) | A leafless golden candle from the sand: one to three fleshy cream stems clad in pale overlapping scales and flushed violet-brown at the foot, each carrying a dense cylindrical spike of gold two-lipped flowers that open from the bottom up, rising from a little cracked mound |`

`| \`desert-hyacinth\` | Desert Hyacinth · Danun | 2 | path, back | 120×160 · .5/.92 | \`#e5b63c\` | yes | leafless, no green: 1–3 fleshy cream stems clad in pale tan overlapping scales, often flushed violet-brown at the foot, from a low cracked sand mound; each carries a dense cylindrical spike of ~45–60 gold tubular two-lipped flowers with paler lobes on a golden-angle spiral, a blunt bud cone at the top; the tip pushes up through the sand, then the flowers open from the bottom up (oasis only, wild; in the oasis only the medium back slots, as every path slot is small) |`

`| OP7.1 | Desert hyacinth: \`smallSuite\` (continuity over 200 growths, determinism, seed variety) plus path and back habitats, medium, the wild range; one to three spikes with the first the tallest and > 25 flowers each; flowers opening bottom-up (all closed when opening starts, all open at growth 1); inside its box (60 seeds); the oasis pin gains \`desert-hyacinth\`, the garden keeps its 25 and the waterfall its own | plants/species/desert-hyacinth; scenery/flora | studio › every entry renders | ✔ |`
