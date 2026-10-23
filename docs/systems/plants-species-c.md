# Plants · tier-4 trees (species set C)

The six spectacular rewards for 90–180 minute sessions. Each grows live, from a seed in the
soil to a full tree in bloom, as one continuous painting per seed.

Look at them: studio → **Plants · tier-4 trees side by side** (`plants-trees/lineup`, `/variety`,
`/growth`) and each species' own section (`species-<id>`, growth stages + grow loop).
`npm run shots -- --entry plants-trees/lineup`.

## Species

| id | name · native | size (units) · class | habitats | bloom | pollinators | character |
|---|---|---|---|---|---|---|
| `weeping-cherry` | Weeping Cherry · Shidarezakura | 380×460 · tree | back, meadow, shore | `sakura` | yes | trunk forks into steep limbs that arc over into long curtains of pale-pink blossom; fresh leaves, then buds, then blossom; a faint pink veil; a few drifting and fallen petals at full bloom |
| `japanese-maple` | Japanese Maple · Momiji | 380×460 · tree | back, meadow, shore | `vermilion` | no | elegant, sometimes twin-stemmed trunk; horizontal tiers of flat pads fringed with five-lobed leaves; spring green turning orange (top) → crimson (below); fallen leaves |
| `wisteria` | Wisteria · Fuji | 380×460 · tree | back, meadow, shore | `iris` | yes | two stems twining up to a bamboo pergola, runners along the beam, pinnate leaves, a front and a paler back curtain of racemes that open top-down (deep violet → pale tips → green buds) |
| `black-pine` | Black Pine · Kuromatsu | 380×460 · tree | shore, rock, back | `olive` | no | twisting trunk that leans out and turns back up, cloud-pruned dark needle pads with needle fans and pale candles; often one long limb reaching over the water |
| `ginkgo` | Ginkgo · Ichō | 380×460 · tree | back, meadow | `gold` | no | straight upright trunk, short ascending limbs in a loose column; green fans turning butter yellow; a golden carpet of fallen fans |
| `plum-blossom` | Plum Blossom · Ume | 300×340 · **large** | back, meadow, rock | `petalWhite` | yes | short gnarled trunk, angular zig-zag limbs and straight young shoots; sparse five-petal flowers (white or pink per seed) with stamens; red buds at every twig tip; lichen touches |

All anchor at `{ x: 0.5, y: 0.94 }`. Plum is `large` (a smaller tree that still reads as a
centrepiece and fits more slots).

## Growth model (see ADR 0067)
`draw()` first builds the **plan** for the seed (`planWeepingCherry(rng)` etc., exported and
unit-tested): the full skeleton, every pad, leaf, blossom and petal. Nothing in the plan
depends on `growth`. Rendering then reveals the plan:

| growth | what you see |
|---|---|
| 0 – 0.1 | seed in a mound of soil, splitting; a sapling shoot with two leaves (`paintSeed`, `paintTipLeaves`) |
| 0.1 – 0.5 | the skeleton extends in order (structure time τ), the whole tree scales up from 32 % and the trunk thickens; young leaves at the growing tips |
| 0.5 – 0.75 | foliage pads / leaves fill in, staggered per pad (cherry and plum: fresh leaves or moss, then buds swelling) |
| 0.75 – 1 | colour arrives: blossoms open (staggered from the old wood outward), maple and ginkgo turn, racemes open top-down |
| 0.96 – 1 | falling petals / fallen leaves |

`treeView(g, base, timing = {})` (`timing`: `structureEnd`, default 0.5; `minScale`, default
0.32) returns `{ growth, tau, scale, thick, base }`; `tau`, `scale`, `thick` are smooth, monotonic
functions of `g`.
Each branch has a growth window `[t0, t1]` in τ; a child's window opens when its parent's growth
front passes its attach point, so branches unfurl outward. Wisteria uses `minScale: 1` (the
trellis is full size from the start; only the vine grows) and `structureEnd: 0.55`.

## Helpers (`src/plants/lib/`)
- `tree-structure.ts` — pure: `growLimb` (heading noise, curl, kinks, gravity/phototropism,
  `floor`), `startTree` / `addTrunk` / `addBranch`, recursive `growChildren(tree, parent,
  LevelSpec[])` (count, span, divergence, length ratio, side: alternate/random/outward, `up`,
  `level`, width ratios, durations), `normalise`, `fitTree` (uniform shrink about the base so no
  seed clips its box), `pointAt` / `headingAt` / `widthAt` / `partialPath`, and the growth
  mapping (`treeView`, `branchProgress`, `stagger`, `ramp`, `viewPt`).
- `tree-paint.ts` — engine-based painters: `inUnits` (species units → canvas pixels),
  `stableTarget` / `stableLayer` (ADR 0068), `paintSkeleton` (all branches as tapered ribbons
  in **one** wet layer, then shadow-side modelling and dry-brush bark on thick limbs),
  `paintGroundShadow`, `paintSeed`, `paintTipLeaves`, `paintPadMass` (batched foliage pads),
  `paintBlossoms` (petals /
  dots / buds, optional groups, centres and stamens), `paintLeaves` (many small leaf / fan /
  needle / blade marks in one layer), `paintFallingPetals`, `softRes`.
- `tree-review.studio.ts` — the side-by-side studio section.

## Painting order (every tree)
ground shadow → (trellis) → seed → skeleton (ink ribbons, modelling, bark) → moss / tip leaves
→ foliage pads (multiplied, so ink shows faintly through, like the reference trees) → leaf /
needle / fan detail → buds → blossoms (pale petals `source-over` so they sit on the twigs;
deeper glaze petals multiplied) → centres / stamens → falling petals.

## Performance (ADR 0069)
Headless Chromium on the dev machine (Apple M-series, busy with other agents: load ≈ 11–14),
sprite at DPR 2, slot scale 1, `quality: 'normal'`, 10 seeds after warm-up:

| species | px | growth 1 median / max | growth 0.6 median | draft, growth 1 |
|---|---|---|---|---|
| weeping-cherry | 760×920 | 93 / 136 ms | 70 ms | 63 ms |
| japanese-maple | 760×920 | 82 / 101 ms | 72 ms | 48 ms |
| wisteria | 760×920 | 96 / 105 ms | 55 ms | 54 ms |
| black-pine | 760×920 | 72 / 78 ms | 60 ms | 39 ms |
| ginkgo | 760×920 | 81 / 93 ms | 65 ms | 51 ms |
| plum-blossom | 600×680 | 43 / 55 ms | 22 ms | 20 ms |

Target was < 150 ms. Cost is almost all wet-layer drying, proportional to layer pixels: a tree
dries ~8–14 crown-sized layers. What got it there: branches batched into one layer (was one
`inkLine` per branch); pads batched (`paintPadMass`, 2 body passes + shared mid/shadow/dark)
instead of 4 layers per `foliageClump`; blossoms/leaves as single fills of cheap outlines in
shared layers (not `paintDab`, which deforms and adds gradients per dab); soft passes
(shadow, mid-tone, deep petal tint, haze) dried at 0.6 resolution; blossom centres dried with
their petals. A first naive cherry took ~400 ms.

## Tests
`src/plants/lib/tree-structure.test.ts` — determinism and seed variety, fixed rng consumption
of `growLimb` (with and without `floor`), children attach where the parent has grown to,
windows normalised to τ ≤ 1, monotonic branch progress, partial paths, `treeView`
smoothness/monotonicity, `stagger`, `fitTree`, angle helpers.
`src/plants/lib/tree-plans.test.ts` — for every species: registered as tier 4 with a sane
box, plan deterministic per seed, varies across seeds, independent of the caller's rng
position, and every skeleton point inside the sprite box for 12 seeds.
Visuals: studio sections above; `tests/e2e/studio.spec.ts` renders all of them.

## Known weaknesses
- Wisteria's lower half is mostly trellis posts and paper; racemes are cones of dots rather
  than individual pea flowers.
- Pine needle fans can read as little grass tufts at small scale.
- Maple palmate stars are slightly "stamped" up close.
- The painter's own flow-noise stream is bypassed via `stableTarget`, but the engine's
  `grassTuft` (wisteria post feet) still uses the painter stream (tiny, painted first).
