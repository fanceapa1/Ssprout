# 84 · Yamabuki (W9)

## What
A new tier-3 shrub for the rocky waterfall: **yamabuki**, Japanese kerria (*Kerria japonica*,
ヤマブキ). It adds only files, plus one id in a test list:
- `src/plants/species/yamabuki.ts`: the definition, the builder (`buildYamabuki`) and a pure pose
  at a growth (`poseYamabuki`), which the draw paints and the tests check.
- `src/plants/lib/yamabuki-paint.ts`: new helpers `serratedBlade`, `paintSerratedLeaves`,
  `paintCanes` and `goldenFlowers`. No shared `lib/` helper was touched.
- `src/plants/species/yamabuki.test.ts`: `shrubSuite('yamabuki', buildYamabuki, …)` plus its own
  continuity, box and flowering checks.
- `src/plants/notes/yamabuki.ts`: the Ōta Dōkan note from the brief.
- `src/scenery/flora.test.ts`: `'yamabuki'` added to the waterfall's pinned flora list, after
  `wild-strawberry`.

Fields:
- tier 3, `large`, box 200×220, anchor .5/.93;
- habitats `shore`, `meadow`, `back`; `bloomColor` `#e5b02f`; pollinators; nativeName "Yamabuki";
- range: realms `japan`, biomes `montane-stream` and `temperate-forest`, climates
  `cool-temperate` and `warm-temperate`, no `cultivatedIn`;
- description: "Yamabuki — gold leaning over the stream, keeping no seed."

The Japanese garden's flora is only the `garden` biome, so yamabuki does not leak there, and the
garden keeps its 25 species. At the waterfall it fits the large shore slot `stream-2`, the large
meadow slots (`bank-5`, `-6`, `-11`, `-13`, `-14`) and the back slots `cliff-2` and `cliff-3`.

## How it is painted
- **Canes:** 9–12 thin green canes (`#8fa456`) from one narrow crown. Most lean one way. The crown
  sits 6–14 units back from that side, so the arches have room to lean over.
  - Each cane is a 16-segment turtle stem. Inner canes rise nearly upright, 150–290 long, with the
    bend weighted toward the tip, so they climb and then bow over with the tip nodding down.
    Outer canes start leaning (up to 0.75 rad) and arch out low and wide.
  - A cane is shortened until its full arch sits inside the box (±77 across, 180 up) with its tip
    above the ground.
  - About one cane in five is a short, nearly upright new shoot. It carries no flowers: kerria
    blooms on last year's arching wood.
  - Canes are brush ribbons in one wet layer per depth band (three bands, back to front, the back
    band cooler and paler), with a broken darker line on the underside of the arch.
- **Leaves:** alternate along each cane, largest along the middle and small toward the tip. Each
  leaf is a real outline, not a dab (`serratedBlade`): a rounded base, ovate, drawn out into a long
  pointed tip, with forward-pointing saw teeth along both margins, big and small in turn, which
  gives the double-toothed edge.
  - All leaves of a band share two wet layers (alternate leaves apart, so overlaps keep an edge).
    The rim pools in the teeth.
  - The shaded half is flooded darker wet-in-wet, as if the leaf is folded a little at the midrib.
  - The midrib and five pairs of lateral veins are lifted pale, as impressed veins catch the
    light. They show in the close view, not the overview.
- **Flowers:** single five-petalled golden flowers on short leafy side shoots along the upper arch.
  There are at most three per cane and at least three nodes apart, and none sits within 15 units
  of another, so they are spaced, not clustered. Most shoots rise from the upper side of the arch.
  - Geometry comes from the shared `bloomMarks`. The paint is the new `goldenFlowers`: clear gold
    (`#e5b02f` lifted toward `#f4cf4a`, tips paler) source-over the leaves with a light rim. The
    back petals are a little deeper (`#c78f24`). A gold heart under a ring of deeper stamen heads
    keeps the leaves from showing through the centre.
  - The shared `paintBlooms` was tried first: its opaque rim darkening and orange-mixed stamens
    turned the flowers mustard-brown at garden scale.
  - Green sepals hold the bud and fall back as it opens.
- **Growth:**
  - The seed mound comes first, under the crown.
  - Canes rise from 0.08 to about 0.6, staggered per cane. A young cane comes up nearly straight
    and arches as it lengthens.
  - Leaves unfurl as the tip passes their node.
  - Flowering shoots grow out and buds swell as gold-green beads (0.5–0.82, base first). Flowers
    open along the arches (0.72–1).
  - Every mark grows in from small. The species test checks this over 240 growth steps on the pose
    (no mark appears or vanishes larger than 1.2 % of the box, none jumps more than 3 %). The
    family suite only checks determinism and rng use.
- **Cost:** 24–36 ms at growth 1 for seeds 1–6 at 1.6×. That was timed on the main thread in a
  headless probe, inside the 4–127 ms budget. There are about 20 drying passes: 3 bands × (canes,
  accent, 2 leaf layers), plus the flower layers.

## Looked at
The sandbox refused `nice npm run shots`, so these come from small Playwright scripts against my
own dev server on port 5409. All images are in `artifacts/yamabuki/`.
- **r1** (`r1-growth.png`, `r1-zoom.png`):
  - It read as a fountain, but squat, using half the box.
  - The flowers were mustard-brown with dark rims, and they clustered in seed 1.
  - The canes were dark olive lines converging like grass, and the leaves were small arrowheads.
  - → An ovate, acuminate leaf profile, larger leaves, flower spacing, lighter canes.
- **r2–r4** (`r2-seeds.png`, `r3-seeds.png`, `r4-seeds.png`):
  - The flowers turned golden and spaced out.
  - The canes splayed in a V, or swept up and ended level like a broom, never bowing over.
  - Upright canes topped by one flower read as stalks.
  - → More total turn with the bend toward the tip, tall inner and low outer canes, no flowers on
    new shoots.
- **r5** (`r5-seeds.png`, `r5-growth.png`): a fountain whose tips nod down. The bud stage was
  invisible.
- **In the garden, r1** (`yamabuki-r1-wf.png`, `yamabuki-r1-close.png` on `stream-2`):
  - Overview: "yellow dots on green arches".
  - Close: the toothed leaves read, but the flowers were ochre with heavy rims, and a soil blob sat
    beside the off-centre crown.
  - → `goldenFlowers`, and the seed moved to the crown.
- **r2** (`r6-zoom.png`, `yamabuki-r2-close.png`, `-r2-wf.png`, `-r2-sunset.png`,
  `-r2-night.png`, `-r2-phone.png`, `-r2-flora.png`): clear yamabuki gold. The stream-2 clump leans
  its arches over the water.
- **r3, final:**
  - `r7-growth-seeds.png`: seeds 1–6 × growth 0.15–1.
  - `yamabuki-r3-wf.png`: overview, planted on `stream-2`, `bank-5`, `-6`, `-11`, `-13`, `-14` and
    `cliff-2`.
  - `yamabuki-r3-close.png`: noon, close on `stream-2`.
  - `yamabuki-r3-night.png`.

**What reads well:**
- **Overview:** single gold dots spaced along green arches. That is unlike the chrysanthemum's
  dense yellow cushion, and nothing hangs, so it is unlike the weeping cherry and wisteria.
- **Close and phone:** the arches bow over and nod. The leaves are sharp, double-toothed and
  pointed. The five-petalled flowers are clear gold with a stamen heart.
- **Sunset:** the gold takes the warm light.
- **Night:** the flowers hold as muted gold dots.
- **Line-up:** it is the waterfall's first and only tier-3 species, larger than the tier-2 plants
  and well below the maple.

## Tests
- `npm run typecheck` passes.
- `VITEST_WORKERS=1 npx vitest run src/plants/species/yamabuki.test.ts src/scenery/flora.test.ts`:
  2 files, 23 tests pass. That includes the pose continuity check and the garden's pinned 25.
- `npx vitest run src/plants`: 50 files, 332 tests pass.
- No local e2e, as briefed.

## For the orchestrator to place
- **docs/systems/plants-species-b.md** › Species:
  `| \`yamabuki\` | Japanese Kerria · Yamabuki | shore, meadow, back | large · 200×220 · (0.5, 0.93) | \`#e5b02f\` | a fountain of 9–12 thin green canes from an off-centre crown, inner ones tall and bowing over, outer ones arching low; alternate ovate, long-pointed, double-toothed leaves with pale impressed veins; single five-petalled gold flowers on short shoots spaced along the upper arches (waterfall only) |`
  and under helpers: `yamabuki-paint.ts`: `serratedBlade` (a pure double-toothed leaf outline
  with its shaded half and veins), `paintSerratedLeaves` (leaves in one wet layer, shaded half
  wet-in-wet, veins lifted), `paintCanes` (canes in one layer plus an underside accent) and
  `goldenFlowers` (`bloomMarks` petals source-over with a light rim, sepals and a stamen heart).
- **docs/TESTING.md** matrix:
  `| W9.1 | Yamabuki: \`shrubSuite\` plus pose continuity over 240 growths, inside its box (16 seeds), single spaced flowers that open after the leaves; offered only at the waterfall, the garden keeps its 25 | plants/species/yamabuki; scenery/flora | studio › every entry renders | ✔ |`
- **Studio order:** `yamabuki` sorts last, so `allSpecies()[0]` is still the anemone. The tier-3
  boards (`shrubs-b`) and the flora boards gain a card at the end.

## Left open
- **Crowded crown:** near the crown the translucent leaves of many canes overlap into a darker,
  muddier green mass. Leaves of one band and group merge in their layer.
- **Height:** the plant uses about 60 % of the box height, because the width limit shortens the
  tallest arches. This is true to kerria's wide mound, but it is a little low beside the box.
- **Lean:** it leans by seed, not toward the water: the sprite does not know where its slot's
  stream is.
- **Flower view:** the flowers face the viewer much alike (view 0.8–1.45). There are no side-on cups.
- **Checks not made:**
  - the crown slot `cliff-3` (scale 0.6);
  - the worker paint time (measured on the main thread only);
  - the planting sheet preview;
  - `tests/e2e/studio.spec.ts`, although the flora studio entry rendered without errors.
