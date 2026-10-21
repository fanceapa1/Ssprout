# 08 — Plant species, tiers 1–2 (painter A)

## What
- 13 species in `src/plants/species/`: tier 1 `violet`, `white-clover`, `forget-me-not`,
  `wild-strawberry`, `dandelion`, `maidenhair-fern`; tier 2 `japanese-iris`, `anemone`,
  `balloon-flower`, `cosmos`, `spider-lily`, `water-lily`, `susuki-grass`. Each exports a pure
  `plan<Species>(rng)` and a default `SpeciesDef`.
- Shared library `src/plants/lib/small-growth.ts` (staging maths), `small-structure.ts` (turtle
  stems, petal rings, flower perspective), `small-paint.ts` (frame, ground, stems, leaves,
  toothed and compound leaves, petals, buds, bloom dissolve, tiny blossoms), `small-recorder.ts`
  (recording painter for tests), `small-species-list.ts`.
- Studio section `plants-a-review` (`small-review.studio.ts`): tier line-ups at one world scale
  and a growth strip per species, on white with the paper multiplied (water lily on a pond wash).
- Tests: `small-growth.test.ts`, `small-species.test.ts` (65 species tests incl. the
  200-step continuity check). Docs: `docs/systems/plants-species-a.md`, ADRs 0060–0063.

## Why / how it went
Each species went through at least three look → fix rounds on large single entries
(`?entry=species-<id>/growth-1`), growth strips and multi-seed montages:
- First passes exposed shared problems that became helpers: buds as black knots (merged sepals,
  `bloom` dissolve), detached tooth dots (teeth anchored inside the blade, sized by width),
  grass blades that couldn't droop (strokes along turtle paths), perspective petals that
  spiked toward the viewer (foreshortened length), white petals vanishing (source-over).
- Species-specific: violet's upper-petal overlap read as a sixth petal (wider spread); clover
  heads read as daisies until the florets sat on a ball; dandelion leaves became runcinate
  lobes in one layer; the fern went from twigs to tiers of hanging leaflets; spider-lily stems
  crossed (flip applied to angle too) and its heads were thinned; cosmos leaves became feathery
  ribs; susuki plumes went from ladders to tassels combed downwind.
- Final reviews: the two line-ups (cohesive value and saturation; fern and clover enlarged
  afterwards) and growth strips for every species.
- The continuity test caught real pops the screenshots had missed (leaves starting at 30 %,
  the strawberry runner jumping, stems appearing at full opacity) — all fixed in the helpers.

## Perf
All 13 under 40 ms at 300×400 px, normal quality (susuki 34 ms worst median); table in the
system doc.

## What's left / notes
- `placeholder-sprout` stays: `src/plants/registry.test.ts` and `tests/e2e/studio.spec.ts`
  still reference it (not mine to change).
- After adding a species, clear `node_modules/.vitest-cache` if Vitest reports it missing (the
  glob in `registry.ts` is cached).
- Weakest species: white clover (faint at garden size, by nature of white on pale ground) and
  maidenhair fern (leaflets float a little off their stalks).
