# 10 — Plants C: the tier-4 trees

## What
- Six tier-4 species in `src/plants/species/`: `weeping-cherry`, `japanese-maple`, `wisteria`,
  `black-pine`, `ginkgo`, `plum-blossom` (the last is `large`).
- Shared helpers in `src/plants/lib/`: `tree-structure.ts` (pure skeleton generator + growth
  mapping), `tree-paint.ts` (engine-based skeleton, foliage, blossom, leaf painters),
  `tree-review.studio.ts` (side-by-side studio section `plants-trees`).
- Tests: `tree-structure.test.ts`, `tree-plans.test.ts` (46 tests across the two).
- Docs: `docs/systems/plants-species-c.md`, ADRs 0067–0069.

## Why / how it went
Reference bar: the owner's image — thin, elegant ink trunks with airy layered clumps.
- Round 1 (each species): structure first, judged on six seeds at growth 1. Cherries and
  maples were half the box height and blossoms read as polka dots; pines too pale and straight;
  ginkgo tan instead of butter yellow; plum limbs too smooth; wisteria a thin dotted curtain
  under a huge empty frame.
- Round 2: taller proportions (fitTree was silently shrinking wide seeds), softer and denser
  blossom, deeper maple and pine palettes, angular plum kinks, cone-shaped racemes, lower
  pergola, organic twining vine.
- Round 3: side-by-side lineup — pine still the shortest (less lean, reaching limb added),
  cherry blossom thickened, wisteria got a paler back curtain and tufts at the posts, needle
  fans pulled inside the pads. Growth sequences checked for every species (0.05 … 1): each is
  one tree growing.
- Performance: the first cherry took ~400 ms at DPR 2. Profiling showed rasterisation of
  thousands of deformed dab polygons and many crown-sized drying passes. Batching, single-fill
  marks and soft-resolution passes brought every tree under 100 ms median (ADR 0069).

## Left / known weaknesses
- Wisteria is the weakest: the lower half is mostly posts and paper, and racemes are cones of
  dots rather than pea flowers.
- Pine needle fans can read as grass tufts when small; maple leaf stars look a little stamped
  up close.
- Vitest's module cache (`node_modules/.vitest-cache`) can hold a stale expansion of the
  registry's `import.meta.glob` after adding a species file — delete it if a new species is
  "not registered" in unit tests.
- Sprite caching, bloom cross-fade, sway and reflections belong to `sprites.ts` (another task).
