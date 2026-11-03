# 80 · Baikamo (W6)

## What
A new tier-2 water species for the rocky waterfall: **baikamo** (*Ranunculus nipponicus* var.
*submersus*, バイカモ). Only added files, plus one id in a test list:
- `src/plants/species/baikamo.ts`: the definition and the plan/draw (`planBaikamo`).
- `src/plants/lib/baikamo-paint.ts`: new helpers `ribbon`, `threadWidth` and `plumFlowers`.
  No shared `lib/` helper was touched.
- `src/plants/species/baikamo.test.ts`: `smallSuite('baikamo')`.
- `src/plants/notes/baikamo.ts`: the brief's note.
- `src/scenery/flora.test.ts`: `'baikamo'` added to the waterfall's pinned flora list (first,
  sorted).

Fields: tier 2, `medium`, box 140×56 (anchor .4/.55: the roots sit upstream of the slot point,
the tresses stream right toward the outflow), habitats `water` only, `bloomColor` `#f8f4ea`,
pollinators, nativeName "Baikamo". Range: realms `japan`, biomes `montane-stream`, climates
`cool-temperate`, no `cultivatedIn`, so only the waterfall offers it. Medium, so it fits all
four pool slots without needing the large `pool-1`/`pool-2`; the lotus and invariant tests in
`flora.test.ts` still pass.

## How it is painted
- **Tresses**: 6–8 per plant, rooted in 2–3 crowns upstream and fanning out downstream (+x,
  drifting a little toward the bank). They are laid out on the water plane and squashed by 0.42
  for the bank's view. Each stem undulates gently, more toward the tip. Every 2.2–3.2 units a
  node puts out 4–7 hair-fine threads (some forked). They leave at an angle and are combed back
  along the current within the first third of their length. The leaves are longest mid-tress,
  with a short young tuft at the tip.
- **Seen through water**: every thread, stem and soft body halo is a ribbon polygon filled into
  one shared wet layer per depth band (deep tresses cooler and softer, near ones over them),
  dried with low sharpness. Each thread also gets a faint doubled copy offset by half a unit,
  which blurs it the way water does. Horizontal lenses of surface light are lifted out of both
  layers. There is a soft violet-grey shadow on the bed just below. The celadon glaze
  (`#9cc6ba`) is **mixed into the weed's pigments**, never washed around it (see the sunset
  round). The leaf colour is the brief's `#6f9a6a`, deeper and olive at the root, paler at the
  tips, pulled 14 % toward stone grey.
- **Flowers**: 6–10 small white plum blossoms on the tresses nearest the surface, mostly
  downstream (`plumFlowers`: a cool shadow on the water just below, five round petals in petal
  white source-over with a grey-celadon heart, then a gold eye). Each stands on a short pale
  stalk with a one-line ripple ring where it leaves the water. There are no pads anywhere.
- **Growth**: a ripple where it takes root (0–0.4, then fading by half). The tresses lengthen
  downstream one after another (0.02–0.74), each node's threads drawing out as the tip passes
  it. Pale buds rise on their stalks (0.6–0.86), and the blossoms open at the surface last
  (0.78–1). The family suite's continuity test passes. It first failed because the flower marks
  were keyed by their index among the open flowers, which shifted as more opened. They are now
  keyed by a stable id.
- **Reflect**: left at the default. On a `water` slot the plant system reflects whatever the
  species sets (`isWet(slot.habitat) || def.reflect`), so `reflect: false` would not take
  effect. In the shots the reflection (flipped, blurred, celadon) is barely visible and does no
  harm: it shows as a faint pale ghost of the flowers.
- **Cost**: 11–18 ms at 1.6× (12 seeds, main thread in a headless probe, with another agent
  loading the machine), inside 4–127 ms.

## Looked at
Probe sheets (growth 0/0.1/0.3/0.55/0.8/1 × seeds 1–6, on a pale pond colour) in the
scratchpad per round; the final ones are in `artifacts/shots/`.
- r1 (sheet, 9× zoom): each tress was a thick fuzzy rope, with too few, too-short threads
  hugging the stem. The shadow and glaze halos were hard-edged offset strips, like stacked
  cellophane. The flowers were crumpled blobs on a dark pin with a muddy brown eye. → Many more,
  longer, finer threads; feathered halos (three widths at low alpha); rounder petals and a
  brighter eye.
- r2: it read as combed green hair, but the halo ribbons ended in blunt vertical cut-offs →
  tapered halos. Then the colony was a narrow cigar, the same shape on every seed → 2–3 crowns
  and a wider fan. Wide thread angles made some seeds look like fir twigs → the threads comb
  back sooner.
- In the waterfall, `baikamo-r1-close.png` (noon, close on `pool-1`): grass-green, needle-sharp,
  lying *on* the water, the same green as the susuki beside it → cooler and softer, a doubled
  blurring copy, more glints (`baikamo-r2-close.png`, which reads as submerged). Also a flat
  cut-off under one colony: the wet layer's area was shorter than the box → layers span the
  box.
- Sunset, `baikamo-r2-sunset.png`: the pool turns warm grey-rose but each colony kept a teal
  patch around it; with a narrower glaze it became a teal lens with a rim, which began to read
  like a pad → the separate glaze layer was removed, the shadow made neutral, and the weed
  desaturated a little (`baikamo-r3-sunset.png`).
- The bud stage showed dark pins (stalks plus buds) → paler and finer (`baikamo-r3-buds.png`,
  growth 0.78/0.86/1 at 6×).
- Final: `baikamo-r3-growth.png` (growth × seeds 1–6), `baikamo-r3-wf.png` (overview, noon) and
  `baikamo-r3-wf-pool.png` (crop of its pool), `baikamo-r3-close.png` (close on `pool-1`,
  noon), `baikamo-r3-sunset.png`, `baikamo-r3-night.png`, `baikamo-r3-phone.png` (390×844,
  close), `baikamo-r3-flora.png` (`flora/waterfall` line-up). Planted on `pool-1`, `pool-3` and
  `pool-4`.

What reads well: at close and phone size it is "green hair combed out in clear water, dotted with
tiny white blossoms": veiled and cool under the surface, with only the flowers crisp on top. At
overview it is a soft green streak with white specks in the pool, unlike anything else in the
waterfall's line-up and unlike the water lily and lotus (no pads, no big flowers). At night the
weed sinks into the dark water and the flowers hold as pale specks.

## Tests
`npm run typecheck` passes. `VITEST_WORKERS=1 npx vitest run src/plants/species/baikamo.test.ts
src/scenery/flora.test.ts`: 2 files, 22 tests pass (the lotus pin and the released-scenery
invariants included). No local e2e (left to CI, as briefed); `tests/e2e/studio.spec.ts` was not
run.

## For the orchestrator to place
- **docs/systems/plants-species-a.md** › Species:
  `| \`baikamo\` | Baikamo · Baikamo | 2 | water | 140×56 · .4/.55 | \`#f8f4ea\` | yes | long tresses of thread-fine forked leaves combed downstream under clear water (celadon mixed into the green, blurred, surface light lifted out); small white five-petalled plum blossoms with gold eyes on short stalks at the surface; no pads (waterfall only) |`
  and in the helper list: `baikamo-paint.ts`: `ribbon` (closed polygon around a path with a
  width profile, for filling many fine marks into one wet layer), `threadWidth` (a hair's
  swell-and-taper profile), `plumFlowers` (small five-petalled flowers in three shared layers:
  water shadow, white source-over, gold eyes).
- **docs/TESTING.md** matrix:
  `| W6.1 | Baikamo: \`smallSuite\` (deterministic, seeded, grows continuously, fits its box); offered only at the waterfall | plants/species/baikamo; scenery/flora | studio › every entry renders | ✔ |`
- **Studio order**: `baikamo` sorts after `anemone` and before `balloon-flower`, so
  `allSpecies()[0]` is still the anemone and `ui-shell`/`widget` do not change. It does join
  the tier-1–2 review boards and the flora boards, and later cards shift by one.

## Left open
- **The rim light** of the plant system draws a warm edge along the top of the weed at sunset.
  On an underwater plant that is wrong, but a species cannot opt out (it would need a
  `SpeciesDef` field; not done, since types are shared).
- **On bare paper** (studio cards, the flora line-up, the planting sheet preview) it is a pale
  cool streak with tiny flowers. It is meant to be seen in water, and without the pool behind it
  it reads weakly. Not checked in the planting sheet.
- **The flow direction is fixed** to the right (toward the waterfall's outflow). A future
  scenery whose current runs the other way would need the sprite mirrored.
- At overview size the gold eyes make the specks read a little warm, cream rather than white.
- The surface glints are subtle and mostly lost at overview size; the glints in the pool
  background do most of that work.
- The worker paint time was measured on the main thread in a probe under load, not in the
  worker.

## W6b polish

### What
- **No rim light under the water** (ADR 0281). New optional `SpeciesDef.rimLight?: boolean`
  (default true). `drawLit` in `plants/system.ts` skips the `screen` rim blit when it is `false`.
  The cast shadow and reflection do not change. Baikamo sets `rimLight: false`. The contract line
  is in `docs/ARCHITECTURE.md` › Species. The test is in `plants/system.test.ts`: at a pinned
  sunset, a plain species gets a `screen` blit and a `rimLight: false` one gets none. It failed
  before the fix.
- **Blossoms that read white at overview size** (`plumFlowers` in `lib/baikamo-paint.ts`):
  - The petals are reserved paper: `petalWhite` mixed 70 % toward white, laid source-over with
    almost no pooling, edge or darkening. The washi multiplied last turns them paper-white, not
    cream.
  - The petals alternate between two wet layers, so neighbouring petals keep a faint edge where
    they overlap. Seen close they read as five rounded plum petals instead of one white blot.
  - The draw now passes `res` (sprite px per unit, `opts.w / 140`). Detail scales with it
    (`near` = 0 at overview, 1 seen close):
    - At overview the eye is half its old size, and the grey-celadon heart and petal edges are
      dropped.
    - Seen close, a pale yellow-green heart gets a ring of seven tiny gold stamen dots, as on
      plum blossom.
    - The water shadow under each flower is fainter and closer (0.2 → 0.14 opacity), so it no
      longer makes a small teal disc.
  - A few more and slightly larger flowers: 8–12 (was 6–10), size 2.3–2.9 (was 2.1–2.7), spread
    over the 6 tresses nearest the surface (was 5). Each tress's next flower stands further
    downstream than the one before (0.46 + 0.22 per round, capped at 0.92 of the tress), so
    they read as dots rather than clumps.
  - The box (140×56), the range and the growth windows are unchanged. The stamens and heart
    grow in with the eye (`k`), so nothing pops. The family suite's continuity test passes.
- **Paint version**: `src/plants/types.ts` and `src/plants/system.ts` are paint sources (the
  `src/plants` root), so the paint version changes once. The baikamo files are in
  `UNCACHED_DIRS` and do not change it.

### Looked at (waterfall, `?dev&scenery=waterfall`, baikamo on `pool-1` and `pool-3`)
`addPlants` places the other plants differently on each run, so the neighbours change between
shots. Before/after crops are in `artifacts/shots/`:
- Overview, noon, DPR 2: `baikamo-b-before-overview-pool.png` (cream specks with gold eyes) →
  `baikamo-b-after-overview-pool.png` (white plum-blossom dots on the water). At DPR 1:
  `baikamo-b-before-overview-dpr1-pool.png` → `baikamo-b-after-overview-dpr1-pool.png`.
- Sunset, close on `pool-1`: `baikamo-b-before-sunset-close.png` (yellow rim strokes along the
  top of every tress, so the weed seemed to lie on the water) → `baikamo-b-after-sunset-close.png`
  (no rim; the weed stays under the surface).
- Sunset overview: `baikamo-b-before-sunset-pool.png` → `baikamo-b-after-sunset-pool.png`. The
  mizubasho beside it keeps its warm rim, which shows the opt-out is per species.
- Close, noon: `baikamo-b-after-close.png`. Night: `baikamo-b-after-night.png` (the flowers stay
  pale specks). Phone 390×844: `baikamo-b-after-phone.png`.
- Growth (growth 0/0.1/0.3/0.55/0.8/1 × seeds 1–6, 3×): `baikamo-b-before-growth.png` →
  `baikamo-b-after-growth.png`. Buds opening, 6×: `baikamo-b-after-buds.png`. Petals, 24×:
  `baikamo-b-after-flowers-zoom.png`.
- Rounds:
  - r1: white petals, but the five petals merged into one white blot seen close → two
    alternating petal layers.
  - r2: in the game the flowers were white dots, but they clumped in pairs on one tress → spread
    them down each tress, then shifted the spread downstream (r3).

### Tests
- `npm run typecheck` passes.
- `VITEST_WORKERS=1 npx vitest run src/plants src/scenery`: 63 files, 477 tests pass.
- No local e2e, as briefed.

### Still open
- Flowers on neighbouring tresses can still overlap in the middle of a colony (the tresses cross
  there). A minimum spacing in plane space would fix it.
- Seen very close, the gold stamen ring is a little blobby: dots rather than fine filaments.
- At sunset the weed's green is quite saturated against the grey-rose pool (from W6, not
  changed).
- The faint white reflection ghost under each flower (default `reflect` on water) is still there.
- The flora line-up and studio card were not re-shot.

### For the orchestrator to place
- **docs/adr/README.md**:
  `| [0281](0281-species-rim-light-opt-out.md) | A species can opt out of the rim light | accepted | \`SpeciesDef.rimLight?: boolean\` (default true); \`false\` skips the sunrise/sunset \`screen\` rim in the plant system's lit draw (shadow and reflection unchanged); baikamo sets it (under the water); one paint version change |`
- **docs/systems/plants.md**, item 3 of the daylight list, append:
  `A species with \`rimLight: false\` (baikamo, under the water; ADR 0281) gets no rim.`
- **docs/systems/plants-species-a.md** › Species, baikamo row, the description becomes:
  `long tresses of thread-fine forked leaves combed downstream under clear water (celadon mixed into the green, blurred, surface light lifted out; no rim light); 8–12 small five-petalled plum blossoms of reserved white on short stalks at the surface, with gold eyes that shrink at overview size and gain stamens close; no pads (waterfall only)`
  and the helper line for `plumFlowers`: `small five-petalled flowers: a faint water shadow, reserved-white petals in two alternating layers, gold eyes scaled by sprite resolution (\`res\`)`.
- **docs/TESTING.md** matrix, a row:
  `| W6b.1 | A species with \`rimLight: false\` gets no sunset rim light | plants/system | — | ✔ |`
