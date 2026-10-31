# 76 · Wasabi (W4)

## What
A new tier-1 species for the rocky waterfall: **wasabi** (*Eutrema japonicum*, ワサビ). Only
added files, plus one id in a test list:
- `src/plants/species/wasabi.ts`: the definition and the plan/draw (`planWasabi`).
- `src/plants/lib/wasabi-paint.ts`: new helpers `heartShape`, `heartLeaf` and `crossFlowers`.
  No shared `lib/` helper was touched.
- `src/plants/species/wasabi.test.ts`: `smallSuite('wasabi')`.
- `src/plants/notes/wasabi.ts`: the brief's note.
- `src/scenery/flora.test.ts`: `'wasabi'` added to the waterfall's pinned flora list.

Fields: tier 1, `small` (86×86 box, drawn in the 70-unit design box, anchor .5/.88), habitats
`shore` only (the brief names stream banks and the pool rim; the waterfall's water slots are the
plunge pool, where wasabi does not grow), `bloomColor` `#f6f2e6`, pollinators, nativeName
"Wasabi". Range: realms `japan`, biomes `montane-stream`, climates `cool-temperate`, no
`cultivatedIn`, so only the waterfall offers it.

## How it is painted
- **Leaves**: 6–8 long-stalked blades in a fountain. The inner leaves stand tallest and the outer
  ones arch out and down. Each blade is a heart-to-kidney outline (`heartShape`): a circle set
  forward of the sinus and pulled into a deep notch at the stalk, with a shallow, wavy-toothed
  margin. It is placed in perspective (foreshortened 0.62–0.95, turned partway up from the
  stalk's tip). A blade is one wet layer: four wandering fills, a soft cool pool toward the
  sinus (clipped to the outline), and fine palmate veins from the sinus. It dries **source-over**
  so a front blade covers the one behind it, as if painted around it. Multiply made the
  overlaps look like cellophane. Then a soft, ragged paler patch on the lit flank reads as wet
  gloss.
- **Colour**: the brief's `#7f9a52` on the outer leaves and `#a8b572` on the young inner ones,
  both pulled 25 % toward a cool clean green (`#6fa35c`) so the clump stays crisp beside the
  meadow grass. The stalks are pale green, flushed purple (`#8a5d82`) where they leave the
  rhizome.
- **Rhizome and water**: a short, knobbly green-brown rhizome at the waterline, with leaf scars
  on its shaded side. Its foot is lost in a celadon glaze, and two thin current lines part
  around it.
- **Flowers**: 1–3 slender racemes rise a little above the leaves, each with 1–2 small heart
  bracts. 7–10 pedicels carry small white four-petalled crosses (`crossFlowers`: a cool shadow
  layer offset down-right, then petal white source-over, a yellow-green eye). They open from
  the bottom up, and the top 2–3 stay as pale green buds.
- **Growth**: seed mound 0–0.12. The rhizome swells from 0.1 to 0.55. The leaves unfurl one
  after another from 0.08 to 0.65, each blade unrolling across from a narrow fold. The racemes
  rise from 0.42, the buds swell from 0.5 to 0.8, and the flowers open from 0.74 to 1. The
  family suite's continuity test passes.
- **Cost**: 13.5–22.8 ms on the main thread at 1.6× (12 seeds, headless Chromium, machine under
  heavy load; daimonjisō measured 7.9–17.1 ms in the same run), inside 4–127 ms.

## Looked at
Probe sheets (growth 0.1/0.3/0.55/0.8/1 × seeds) in the scratchpad per round, then in
`artifacts/shots/`:
- r1 (grid): overlapping blades multiplied into dark cellophane (an X-ray look). The blades were
  plain discs with no notch (pennywort on sticks). The rhizome was a post stuck down through the
  water, the gloss lift read as a pale scribble, and the buds were dark grey like seed heads.
  → Blades source-over, a deeper sinus, the rhizome above the waterline, a separate gloss, pale
  buds.
- r2–r3: a hard-edged dark "shade half" crossed every blade and filled the notch (the shade
  polygon skipped the sinus) → a soft pool clipped to the outline. The veins were spiky stars →
  finer, shorter and paler. The gloss became a cartoon "smile" glint → a soft, ragged patch. The
  rhizome looked like a coiled spring → three squat knobs, scars on one side only.
- r4–r5: the notch now reads, but the bracts showed as dark disc blots inside the clump → they
  cover too. Stalks shortened and blades enlarged a little, so it reads as leaves, not sticks.
- In the waterfall, `wasabi-r1-wf.png` (overview, noon) and `wasabi-r1-close.png`: the leaves
  were matte and olive-dull, close to the grass → a cooler, fresher green and stronger gloss
  (`wasabi-r2-close.png`).
- Final: `wasabi-r1-wf.png` (overview, noon; taken before the colour change), `wasabi-r2-close.png`
  (close view of `stream-3` and its neighbours), `wasabi-r2-sunset.png`, `wasabi-r2-night.png`,
  `wasabi-r2-phone.png` (390×844), `wasabi-r2-flora-1440x900.png` (`flora/waterfall`
  line-up), `wasabi-r3-growth.png` (growth × seeds 1–6). Planted on `bank-1..4` and
  `stream-1/3/5`.

What reads well: at overview and phone size it is "a clump of bright round heart leaves at the
water's edge, with tiny white flowers". It is the only round-leaved clump in the waterfall's
line-up, unlike the violet (small leaves, purple flowers), the daimonjisō (low lobed rosette)
and the iwatabako (hanging tongues). Close up, the heart notches, wavy margins and gloss read,
and the racemes are clearly small white crosses with buds at the tip. At sunset the leaves take
the warm light. At night the flowers hold as pale specks.

## Tests
`npm run typecheck` passes. After the rebase onto main, `npx vitest run
src/plants/species/wasabi.test.ts src/scenery/flora.test.ts` (`VITEST_WORKERS=1`): 2 files, 22
tests pass. The continuity test first failed: the leaf veins appeared at full length once a blade
passed radius 2.5; they now draw out with the blade. The full `src/plants src/scenery` run and
`tests/e2e/studio.spec.ts` were not run (the machine stayed loaded).

## For the orchestrator to place
- **docs/systems/plants-species-a.md** › Species:
  `| \`wasabi\` | Wasabi · Wasabi | 1 | shore | 86×86 · .5/.88 | \`#f6f2e6\` | yes | fountain of long-stalked glossy heart-to-kidney leaves from a knobbly rhizome in a celadon current; airy racemes of small white four-petalled crosses (waterfall only) |`
  and in the helper list: `wasabi-paint.ts`: `heartShape` (cordate/reniform outline with a deep
  sinus and wavy-toothed margin), `heartLeaf` (one wet layer, source-over cover, sinus pool,
  palmate veins, soft gloss), `crossFlowers` (a raceme's crucifer crosses in two shared layers:
  shadow, then white source-over).
- **docs/TESTING.md** matrix:
  `| W4.1 | Wasabi: \`smallSuite\` (deterministic, seeded, grows continuously, fits its box); offered only at the waterfall | plants/species/wasabi; scenery/flora | studio › every entry renders | ✔ |`
- **Studio order**: `wasabi` sorts after `violet` and before `white-clover`, so it is not
  `allSpecies()[0]`. It does join the tier-1 review boards, whose later cards shift by one.

## Left open
- **Reflection not verified.** Planted on the pool rim (`bank-1`, `bank-2`) and the stream
  banks, no reflection of the clump was noticeable in the shots. The reflection pipeline was
  not probed, so whether it is drawn and too faint, or not drawn on these slots, is unknown.
- The overview shot was taken before the final colour change; the close, sunset, night and
  phone shots show the final colours.
- The heart notch only reads in the close view; at overview size the blades read as round.
- Blades are flat planes in perspective: none curls, cups or shows its paler underside.
- Front blades are near-opaque (source-over), so overlaps are clean but there is less
  wet-on-wet glazing between leaves than a hand painting would show.
- The worker paint time was measured on the main thread in a probe, under heavy machine load.
