# 74 · Daimonjisō (W2)

## What
A new tier-1 species for the rocky waterfall: **daimonjisō** (Daimonji saxifrage, *Saxifraga
fortunei* var. *incisolobata*). Only added files, plus one id in a test list:
- `src/plants/species/daimonjiso.ts`: the definition and the plan/draw (`planDaimonjiso`).
- `src/plants/lib/daimonjiso-paint.ts`: two new helpers, `lobedLeaf` (a round, palmately lobed
  leaf in one wet layer) and `daiFlower` (the 大 flower). No shared `lib/` helper was touched.
- `src/plants/species/daimonjiso.test.ts`: `smallSuite('daimonjiso')`.
- `src/plants/notes/daimonjiso.ts`: the brief's note.
- `src/scenery/flora.test.ts`: `'daimonjiso'` added to the waterfall's pinned flora list.

Fields: tier 1, `small` (86×86 box, drawn in the 70-unit design box), habitats `rock` and `shore`
(the spray zone; the brief's "path" was left out on the task's instruction), `bloomColor`
`#f6f1ea`, pollinators, nativeName "Daimonjisō". Range: realms `japan`, biomes `wet-cliff` and
`montane-stream`, climates `cool-temperate`, no `cultivatedIn`, so only the waterfall offers it.

## How it is painted
- **Rosette**: 5–7 round leaves lying flat on the rock, each on a short red-brown stalk
  (`#9a5a4a`) that meets the blade at its sinus. A blade is 7–9 `petal` dabs fanned round its
  centre in perspective (the rounded dab tips make the scalloped margin) in one wet layer, with
  faint palmate veins. Some 45 % of leaves bleed rust into their lobe tips (autumn colour). Front
  leaves lie closer in and stop above the sprite's foot.
- **Sprays**: 1–3 slender reddish scapes (30–38 units) with 3–5 alternate side branches and a
  terminal flower: a loose, airy panicle of 5–10 flowers per scape.
- **The 大 flower** (`daiFlower`): three short, rounded upper petals and two long, narrow lower
  ones splayed 22–34° either side of down, one a little longer than the other. Petal white is
  painted source-over (so it stays white over rock), with violet-grey (`#cac2d4`) pooled at the
  base and along the long petals, and a yellow-green disc at the centre. Under it, a separate
  cool shadow layer is offset a hair down and right: white on pale rock reads by that edge.
- **Varieties** (seeded): 60 % pure white, 30 % blush tips on the long petals (`#e7a3ae`), 10 %
  deeper rose tips.
- **Growth**: seed mound 0–0.12; leaves unfurl one after another 0.05–0.48 (lobes fan out from a
  folded bunch); scapes rise from 0.34; branches 0.5–0.78; buds swell green → cream 0.48–0.8; the
  flowers open 0.74–1, terminal first. In a flower the short petals open first and the long ones
  draw out after, so the 大 forms last. The family suite's continuity test passes.
- **Cost**: 10–16 ms on the main thread at 1.6× (16 seeds, headless Chromium), inside 4–127 ms.

## Looked at
Probe images (scratchpad) per round, then in `artifacts/shots/`:
- r1: growth × six seeds on grey and paper. Scapes too tall and bare, flowers tiny, rosette a dark
  flat smear with ink veins → shorter scapes, bigger flowers, fewer leaves, faint veins.
- r2–r3: stalks ran through the blades like sticks on lily pads → stalk ends at the sinus; the
  front leaf was clipped at the sprite's foot → front leaves closer in, clamped.
- r4: in the garden (`artifacts/shots/daimonjiso-r1-wf.png`)
  the white flowers vanished against the pale cliff → the cool shadow layer under each flower,
  darker petal rims, a darker rosette (`daimonjiso-r2-wf.png`).
- r5: close view (`daimonjiso-r3-close.png`): flowers crowded into a white mush and the shadow
  doubled every petal → sparser panicle, wider branches, a smaller shadow offset
  (`daimonjiso-r4-close.png`); then the long petals were too faint to read as legs → violet-grey
  along their length, a little wider (`daimonjiso-r5-close.png`).
- Final: `artifacts/shots/daimonjiso-r5-wf.png` (overview, noon), `daimonjiso-r5-close.png`
  (close view of `ledge-3`), `daimonjiso-r5-sunset.png`, `daimonjiso-r5-night.png`,
  `daimonjiso-r5-phone.png` (390×844), `daimonjiso-r5-flora.png` (`flora/waterfall` line-up),
  `daimonjiso-r6-growth.png` (growth 0.1 … 1 × seeds 1–6).

What reads well: close up, each flower is a clear 大 with its two long legs; the round lobed
leaves on red stalks with rust edges look like the plant; at sunset the petals take the warm
light, at night they hold as pale lilac marks. It is unlike the clover (no ball heads), the
anemone (no broad flat flowers) and the forget-me-not (white, not blue).

## Tests
`npm run typecheck`; `npx vitest run src/plants src/scenery` (50 files, 363 tests);
`tests/e2e/studio.spec.ts` with `E2E_WORKERS=1 E2E_PORT=4371` (12 passed).

## For the orchestrator to place
- **docs/systems/plants-species-a.md** › Species:
  `| \`daimonjiso\` | Daimonji Saxifrage · Daimonjisō | 1 | rock, shore | 86×86 · .5/.88 | \`#f6f1ea\` | yes | rosette of round lobed leaves on red stalks; loose sprays of white 大 flowers, two long lower petals; white / blush / rose tips |`
  and in the helper list: `daimonjiso-paint.ts` — `lobedLeaf` (round palmate leaf in perspective,
  one wet layer, rust tips), `daiFlower` (three short + two long petals, source-over white over a
  cool shadow layer).
- **docs/TESTING.md** matrix (no new rule; the family suite):
  `| Daimonjisō: deterministic, seeded, grows continuously, fits its box | src/plants/species/daimonjiso.test.ts (smallSuite) |`
- **Studio order**: `daimonjiso` sorts after `cosmos` and before `dandelion`, so it is not
  `allSpecies()[0]`; it does join the tier-1 review boards (`plants-a-review/lineup-t1`), whose
  later cards shift by one.

## Left open
- At overview scale on the waterfall's pale cliff the plant is a small lilac-white puff over
  round leaves; the 大 shape only reads in the close view. Larger flowers would read sooner but
  would no longer be a delicate saxifrage.
- The long petals are shaded violet-grey along their length so they read on pale rock; on the
  white studio paper they look a little lilac rather than pure white.
- Flowers face the viewer with small turns; none is seen in profile or nodding.
- Leaves are flat on the rock; no leaf curls up or shows its red underside.
- The worker paint time was measured on the main thread in a probe, not in the sprite worker.
