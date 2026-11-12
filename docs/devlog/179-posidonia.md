# 179 · Posidonia (GP5, phase 15)

## What
The Greek coast's seagrass, the garden's main water plant: **posidonia** (*Posidonia oceanica*,
ποσειδωνία), tier 3, `large`, habitat `water`. It adds only files:
- `src/plants/species/posidonia.ts`: the definition, the plan (`planPosidonia`), the pose
  (`posePosidonia`, pure: every mark at a growth value) and `posidoniaReach` (every painted point,
  for the box test). It imports `ribbon` from `lib/baikamo-paint` and the growth and frame helpers;
  no shared `lib/` helper was edited.
- `src/plants/species/posidonia.test.ts`: `shrubSuite('posidonia', planPosidonia, …)` plus the
  recorded draw deterministic and seeded, pose continuity over 240 growths (3 seeds), inside the
  box (30 seeds), the meadow's shape, the three growth stages, the rare flower or fruit, the
  definition, the range against all four gardens and the coast's slots.
- `src/plants/notes/posidonia.ts`: a flowering plant, not a seaweed; Mediterranean only, a
  centimetre a year, centuries old; shelter and clear water; protected, anchors do the most harm
  (three sentences, within the notes test's 330 characters).
- Docs: the row in `docs/systems/plants-species-b.md`, `GP5.1` in the `docs/TESTING.md` matrix.

Definition:
- box 200×110, anchor .42/.64 (the roots sit a little upstream; the leaves are laid over to the
  right by the swell), bloomColor `#6fae8a`, `pollinators: false` (water-pollinated);
- `rimLight: false` (ADR 0281, as the baikamo): it lies under the water, so a low sun leaves no warm
  rim on it. No cast shadow is needed: the plant system casts none on a `water` slot. The reflection
  stays the default for water, as for the baikamo; it was not visible in the shots;
- `range: { realms: ['mediterranean'], biomes: ['marine'], climates: ['mediterranean'] }`
  (ADR 0361's words), no `cultivatedIn`: endemic to the Mediterranean sea, wild only. The coast
  offers it; the Japanese garden, the waterfall and the oasis do not (tested against each);
- name "Posidonia", `nativeName: 'Poseidonia'` (`el-Latn`); description "Posidonia — a sea meadow
  of green ribbons combed by the swell."

**Slots.** As a `large` water plant it fits only `shallows-1` (262, 680), the large slot the coast
reserves for the seagrass meadow (tested with `compatibleSlots`). It is kept out of the medium
slots on purpose: `pool-2` is a rock pool, and the research says Posidonia grows in open water,
not in pools. With one slot, a waiting session that holds `shallows-1` makes the sheet show it full
(as the lotus with two). If the owner wants more meadow, a second large shallows slot is a scenery
change (not made here).

The id sorts after `anemone`, so `ui-shell` and `widget` are unchanged. The tier-3 boards
(`shrubs-b`) and the coast's flora line-up gain a card.

## How it is painted
- **Bed**: a pale sand window (three nested soft rings of sand mixed toward aqua, so its edge fades
  into the sea), a few paler ripple streaks, and one soft shade pool per shoot on the sand, all in
  one wet layer dried soft and granulated.
- **Leaves**: 26–32 shoots inside an ellipse on the bed, denser at the heart, each with 5–7 flat
  ribbons (26–60 units long, about 1.5 wide). A leaf is followed in 3D on the bed: it leaves the
  shoot almost upright and the swell lays it over toward +x (one direction for the whole meadow,
  a little spread and wave), then it is projected for the cliff's view (bed squashed by 0.42, the
  rise by 0.62). A leaf that reaches the water's depth (34 units) lies along the surface. The width
  turns as the ribbon twists, and the tip is a rounded cap.
- **Under the water**: the far half of the meadow is one wet layer (cooler, softer), the near half
  another. Each ribbon gets a faint doubled copy below it (blur), its body, a deeper bluer foot,
  fresh green toward the tip of young leaves, olive-brown on the old tips (12–34 % of an old leaf),
  and a lifted sheen along its middle. The coast's turquoise (`#19a5ad`) is mixed into every
  pigment, more at the bed (46 %) than near the surface (22 %). Surface light lenses are lifted out
  of both layers. The tips at the surface get their own crisper, warmer layer with a lifted top.
- **Beside it**: 2–4 dead leaves lying on the sand and 1–2 brown sea balls (aegagropiles: a body,
  a felt of short fibres, a lifted light). Close up only (sprite resolution over 1.5× the design):
  pale epiphyte flecks lifted from the old leaves and small bubbles.
- **Flower or fruit**: about 30 % of seeds show a small green flower spike among the leaves and 25 %
  an olive-like fruit floating at the surface with one ripple ring, from growth 0.88. Most seeds
  show neither: it rarely flowers.
- **Growth**: the sand window first (0–0.12), then the shoots from the heart outward (0.02–0.86),
  each leaf unrolling and laid over as it lengthens; the old tips brown from 0.45; the dead leaves
  and sea balls from 0.55; the bubbles from 0.4. So: a few short shoots on bare sand, a spreading
  tuft, then the full meadow patch.

## Cost
`def.draw` at 1.6×, growth 1, seeds 1–12, main thread in headless Chromium on the dev server
(a throwaway probe, as for the lavender): median 21 ms, 18–31 ms (the 31 ms is the first, cold draw). Under the 70 ms aim and inside 4–127 ms. At 2× in the round-5 sheets the median was 21 ms;
at 5× (a close view) 48–111 ms.

## Looked at
Probe sheets (scratchpad, on a sea gradient and on paper), then the app at `?dev&scenery=coast`
with the plant on `shallows-1`:
- **r1** (stages and seeds on the sea): it read as a meadow leaning one way, but the ribbons were
  thin teal hooks of one shape, the sand a large flat pale cloud, and no tip ever reached the
  surface. → more and wider leaves, a wider range of bend, a shallower surface, a smaller sand
  window.
- **r2–r3** (5× close): the tips were chisel cuts → rounded caps; the shade on the sand was a row of
  spots → one soft pool per shoot; the dead leaves were sticks with arrow tips → capped and curved.
- **r3 in the garden** (`r3-ov`): a dark, saturated patch on the turquoise with a row of brown
  flags along its top: it sat on the water. → more sea mixed in, lower layer opacity, weaker brown
  tips, fewer leaves reaching the surface.
- **r4 close** (`r4b-close`): reads as seagrass under the water; the sand window had a hard,
  cut-paper edge and the dead leaves and balls stood in a row along the front → nested soft rings,
  debris spread round the sides.
- **r5**: stages (`gp5-posidonia-stages.png`) and the line-up beside the baikamo, lotus, water
  lily, white water lily, cattail and mizubasho (`gp5-posidonia-lineup.png`): the only one with no
  pads, no flowers and nothing above the water; a fan of combed ribbons.
- **r6** in the garden: the overview at noon (`gp5-posidonia-garden.png`: a fan of green ribbons
  leaning with the swell over a pale sand window in the shallows), the close view at noon and at
  sunset (`gp5-posidonia-close.png`).

## Left open
- The ribbons still read a little as brush commas, all bent by a similar curve; real leaves overlap
  more loosely, and some stand straighter.
- At sunset the sea goes warm grey-green but the meadow stays teal-green and a little bright (the
  baikamo has the same left-open note).
- The sea balls are smooth brown pebbles at the close view; the fibre felt only shows at higher
  zoom.
- The flower spike is a few pale dots; it is meant to be inconspicuous, but it was not checked at
  phone size.
- The background sea already paints dark seagrass patches (devlog 176); the planted meadow is
  greener and lighter than them. A later pass could bring the two together.
- Only one slot fits (`shallows-1`).
- Not looked at: night, phone, the planting-sheet preview card (covered by the e2e specs only).

## Tests
- `npm run typecheck` passes.
- `VITEST_WORKERS=2 npm test`: 251 files, 2583 tests pass (after the rebase on `main`).
- E2E, one file at a time against the production build (`E2E_WORKERS=1`, `--trace off`):
  `planting-previews` 2, `plants` 8, `lotus` 2, `plant-card-phone` 5, `lazy-species-painters` 1,
  all passed. The rest of the e2e suite was not run (the task's CPU and disk rules).
