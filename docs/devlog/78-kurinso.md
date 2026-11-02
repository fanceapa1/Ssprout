# 78 · Kurinsō (W5)

## What
A new tier-2 species for the rocky waterfall: **kurinsō** (Japanese primrose, *Primula japonica*,
クリンソウ). It adds files only, plus one id in a test list:
- `src/plants/species/kurinso.ts`: the definition and the plan/draw (`planKurinso`).
- `src/plants/lib/kurinso-paint.ts`: new helpers `spoonLeaf`, `primroseRing`, `primroseEye` and
  `primroseBud`. No shared `lib/` helper was touched. It started from the previous attempt's
  unreviewed partial. The eye was off-centre there (a round dab grows from its base), and each
  flower had its own layer. Both were reworked.
- `src/plants/species/kurinso.test.ts`: `smallSuite('kurinso')` plus two plan tests (3–5 whorls
  that open from the bottom up, each a full ring of ≥ 5 flowers; rosette, droop included, and the
  top ring inside the box).
- `src/plants/notes/kurinso.ts`: the brief's note.
- `src/scenery/flora.test.ts`: `'kurinso'` added at its sorted place in the waterfall's pinned list.

Fields: tier 2, `medium` (120×160, anchor .5/.94), habitats `shore` and `meadow`, `bloomColor`
`#c9568a`, pollinators, nativeName "Kurinsō" (default `ja-Latn`). Range: realms `japan`, biomes
`montane-stream` and `wetland`, climates `cool-temperate`, no `cultivatedIn`.

## How it is painted
- **Rosette**: 7–10 long spoon leaves (`petal` dab, 34–46 long) spread round the crown in the
  ground plane and rising a little. A leaf that would point at the viewer lies out sideways
  instead, because the box has only 9.6 units below the base and such a leaf was a stub. Each
  blade is one wet layer dried **source-over**, so front leaves cover the back ones (multiply
  made dark cellophane wedges). It has a second offset pass for an uneven margin, fine side-vein
  furrows, and a strong fine-scale `flow` mottle that reads as the blistered, crinkled surface.
  The pale midrib is lifted out on top. Colour is the brief's `#8fae5e`, jittered toward a
  deeper green.
- **Scape**: one stout pale-green stem (98–120). It carries **3–5 whorls** from about 0.38 of
  its height to the tip. The internodes shorten upward and the upper rings are smaller. There
  are never fewer than 3, so it can never read as a single whorl (brief › Pitfalls).
- **Whorls**: 5–9 flowers on pedicels round each node, placed on a foreshortened ellipse. They
  face out and up, so back flowers show their paler backs. Each **half-ring** (behind the stem,
  in front of it) is painted as **one wet layer**: neighbours merge into a ring instead of
  stacking into dark maroon overlaps. Each lobe is two splayed round dabs, so the tip keeps its
  notch. Then a soft dark eye and a small warm throat on the flowers that face us.
- **Colourways**: magenta `#c9568a`/`#e08aae` with eye `#7a2b4f` (58 %), crimson (18 %), pale
  rose (14 %), and white `#f6eef0` with a pink eye (10 %).
- **Growth**: seed mound 0–0.12. Leaves unfurl from rolled and upright, 0.05–0.56. The scape
  rises from 0.3 to 0.8. Bud clusters swell ring by ring from 0.36, and the **rings open from the
  bottom up** over 0.68–1, each ring's flowers a little apart. Everything grows in from small:
  the family continuity test passes, and a leaf's opacity ramps with its length, so it does not
  appear at 2 units.
- **Cost**: 18–28 ms at 1.6×, growth 1, seeds 1–10, measured on the main thread in headless
  Chromium under `nice`. That is inside 4–127 ms.

## Rounds
1. Sheet (growth × 6 seeds) and zoom: the stacked rings read at once. The wavy-margin dabs
   floated off the blades as green beads. Overlapping leaves multiplied into cellophane. Each
   ring was a dark crumpled pompom (per-flower multiply layers, near-black eyes), too narrow for
   the stem. → Leaves source-over with no beads; one layer per half-ring; a softer, smaller eye;
   wider rings.
2. The flowers now read as flat, notched pink primroses. There were dark vein ticks past the
   leaf margins, and the pedicels showed as dark spokes through the flowers. → Shorter veins
   kept inside the blade; pale pedicels that stop short of the flower; earlier, overlapping bud
   windows (no bare needle tip mid-growth); a thicker scape.
3. Pale "pucker" dabs meant to show the crinkle dried as outlined soap bubbles, and the veins
   read as fishbone chevrons. → Puckers removed. The crinkle is now a fine `flow` mottle in the
   leaf wash, with fainter veins. The bracts at each node made a dark star, so they are paler now.
4. Waterfall overview and close view: it reads, but the plants towered on a long bare stem. One
   rosette was cut flat at the bottom by the box, because a leaf's flank and tip droop went past
   9.6 units. → A shorter scape with rings starting lower, and leaves capped by their full lower
   extent (test updated). The front leaves then became stubs, so they now lie out sideways.
   Leaf bases are spread round the crown so they do not meet at one point.
5. Sunset, night, phone, flora line-up and the studio growth stages: no new faults worth a round.

## Looked at
Scratchpad sheets (not in the repo): `r1-sheet`, `r1-zoom`, `r2-sheet`, `r2-zoom`, `r3-zoom`,
`r3-big`, `r4-big`, `r5-sheet` (growth 0.1–1 × seeds 1–6), `r6-sheet` (growth 0.55/1 × seeds
1–10). In `artifacts/shots/`:
- overview, noon: `kurinso-r1-wf-1440x900.png`, `kurinso-r2-wf-1440x900.png`
- close view (`bank-4` and neighbours), noon: `kurinso-r1-close-1440x900.png`, `kurinso-r2-close-1440x900.png`
- sunset close view (`stream-1`): `kurinso-r3-sunset-1440x900.png`
- night close view (`bank-4`): `kurinso-r3-night-1440x900.png`
- phone: `kurinso-r3-phone-390x844.png`
- flora line-up: `kurinso-r3-flora-1440x900.png`
- studio growth stages: `kurinso-r3-growth-1440x900.png`

Kurinsō was planted on `bank-1`, `bank-3`, `bank-4`, `stream-1`, `stream-3` (shore) and `bank-9`,
`bank-10` (meadow), with 18 more plants from `addPlants`.

What reads well: at overview and phone size it is "a stem of stacked rose-magenta rings above a
leafy rosette by the water". No other species in the waterfall or garden is built like it. It is
unlike the iwakagami (low, nodding pink bells), azalea (a clipped mound), spider lily (one head
of red threads) and tree peony (a shrub of big single blooms). Close up, the notched five-lobed
faces, dark eyes, pagoda tiers and crinkled leaves all read. The white form holds its pink eyes.
At sunset the leaves and stems catch the warm rim light. At night the rings cool to a muted
violet-magenta and still read as tiers.

## Tests
`npm run typecheck` passes. `VITEST_WORKERS=1 npx vitest run src/plants/species/kurinso.test.ts
src/scenery/flora.test.ts`: 2 files, 24 tests pass. No local e2e (the orchestrator runs it on CI).

## For the orchestrator to place
- **docs/systems/plants-species-a.md** › Species:
  `| \`kurinso\` | Japanese Primrose · Kurinsō | 2 | shore, meadow | 120×160 · .5/.94 | \`#c9568a\` | yes | low rosette of long crinkled spoon leaves; one stout stem with 3–5 stacked whorls of flat notched magenta primroses with dark eyes, opening from the bottom up; crimson, rose and white forms (waterfall only) |`
  and in the helper list: `kurinso-paint.ts`: `spoonLeaf` (spoon blade, source-over, mottled
  crinkle, lifted midrib), `primroseRing` (the flowers of a half-whorl in one wet layer, notched
  five-lobed faces), `primroseEye`, `primroseBud`.
- **docs/TESTING.md** matrix:
  `| W5.1 | Kurinsō: \`smallSuite\` (deterministic, seeded, grows continuously); 3–5 whorls of ≥ 5 flowers opening bottom-up; rosette (droop included) and top ring inside the box; offered only at the waterfall | plants/species/kurinso; scenery/flora | studio › every entry renders | ✔ |`
- **Studio order**: `kurinso` sorts after `japanese-maple` and before `maidenhair-fern`, so it is
  not `allSpecies()[0]`. It joins the tier 1–2 review boards, where later cards shift by one.

## Left open
- The rosette is still mostly a flat fan in the picture plane. The leaves do not cup, twist or
  show a paler underside, and the upright inner leaves can read as paddles behind the stem.
- The leaf green is a little brighter and more acid than the waterfall's other foliage at
  overview and phone size, because source-over leaves at 0.92 opacity take up less of the scene
  tone than multiplied ones. A slight shift toward the deeper green was not tried.
- Side flowers of a ring are foreshortened but not cupped. Close up, a ring reads as flowers
  round an ellipse rather than a true 3-D candelabrum.
- The white form is 10 % of seeds. Seeds 1–10 in the sheets are all coloured, so the white form
  was only seen in the garden shots.
- The reflection on the shore slots was not checked.
- The paint time was measured on the main thread, not in the worker.
