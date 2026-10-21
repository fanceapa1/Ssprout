# 09 — Plant species, tier 3 shrubs (set B)

## What
- Six tier-3 species in `src/plants/species/`: `tree-peony`, `hydrangea`, `azalea`, `camellia`,
  `chrysanthemum`, `lotus` — all painted with the paint engine, all growing live from seed to
  full bloom. Species table, approach and perf in `docs/systems/plants-species-b.md`.
- Shared helpers `src/plants/lib/shrub-growth.ts`, `shrub-structure.ts` (pure, tested),
  `shrub-paint.ts`, `shrub-heads.ts`, and a studio review sheet `shrub-gallery.studio.ts`
  (section `shrubs-b`).
- Tests: `shrub-structure.test.ts`, `shrub-species.test.ts`. ADRs 0064–0066.

## Why / how it went
Critique → improve rounds per species, looking at zoomed studio captures, the side-by-side
row at preview and garden scale, five seeds per species and a ten-step growth strip:
1. First pass: petals multiplied into dark crimson "x-ray" blooms; leaves read as dark cut-out
   fans; stems like a bouquet of sticks; mopheads polka-dotted; azalea flowers as big pink
   hexagons spilling off the mound; camellia a lollipop tree; mums floating star stickers.
2. Opaque light petals with pooled rims, ruffles and a flare glaze; compound leaves on a
   petiole over a foliage dome; stems that tuck into foliage as it closes; finer florets with
   rare eyes; smaller deep-lobed azalea flowers; lotus raised leaves as bowls with an underside.
3. Performance: one wet layer per mark made 50–110 drying passes and 70–145 ms; batching marks
   into shared layers (ADR 0065) brought every species under 60 ms.
4. Growth review: foliage appeared floating away from the stems around growth 0.2–0.3, so
   foliage is now timed by reach from the plant's heart (`growOutward`); colourways come from a
   labelled rng fork (the first draws of related seeds clustered on one colour); denser, darker
   camellia crowns; more azalea blossom; greener, fuller chrysanthemum cushions; lotus flowers
   spaced apart with slimmer cupped petals.

## Left / known weaknesses
- Chrysanthemum is the weakest: readable cushion, but flat blooms and dull foliage.
- Same-pass marks merge (some leaf edges lost); upper stems can show through foliage.
- Not yet seen in the real garden at slot scale with sway and reflections (that needs the
  sprite cache / view work owned by another agent).
