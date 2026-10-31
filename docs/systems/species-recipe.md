# Recipe: add a species

The checklist for an "add a species" art task (phase 12: one species per task, 2–3 tasks at a
time). A species is **only added files** (ADR 0251), so parallel tasks never conflict and a merge
does not repaint anyone's cached landscape (`UNCACHED_DIRS`, docs/systems/paint.md). Draw it with
the `drawing-assets` skill (`~/.claude/skills/drawing-assets/SKILL.md`): render, look, name what is
wrong, fix, repeat. The quality bar is docs/ART_DIRECTION.md.

## Files you add (and nothing else)
| File | What |
|---|---|
| `src/plants/species/<id>.ts` | default export `SpeciesDef` (ARCHITECTURE › Species). Found by the registry glob; the studio section `species-<id>` appears by itself |
| `src/plants/species/<id>.test.ts` | one call of your family's suite (below), plus any species-specific test |
| `src/plants/notes/<id>.ts` | `export default { note: '…' } satisfies SpeciesNote;` (`import type { SpeciesNote } from '../notes'`), optionally `in: { waterfall: '…' }` |
| `src/plants/lib/<id>-*.ts` or a new family helper | only if you need new painting helpers |
| `docs/devlog/<NN>-<id>.md` | your devlog entry (the orchestrator adds the README row if you are told so; otherwise add it) |

**Never edit a shared `lib/` helper** (`small-*`, `shrub-*`, `tree-*`, the engine in `src/paint`):
it changes the pixels of every species that uses it, and a scene that imports it changes the paint
version. Copy what you need into a new helper file instead. Do not edit `types.ts`, the registry,
`notes.ts`, the family studios or another species' files; if you think you must, stop and ask the
orchestrator.

## The definition
- **`id`**: kebab-case, equal to the file name, and **permanent**. Saved gardens, logs and pressed
  flowers store it; renaming it later orphans plants (`unknownSpecies` on load).
- **`name`** (English), **`nativeName`** and **`nativeLang`** (task F1: the language of the native
  name, e.g. Japanese), **`description`**: one short poetic line, **under 80 characters**.
- **`range`** (task F1, ADR 0250): where it grows (realms, biomes, climates, `cultivatedIn`). The
  scenery's biome profile and `also`/`except` decide which gardens offer it (`floraOf`). A shared
  species (by biology, not by convenience) lists every biome it really grows in.
- **`tier`** (1–4, by session length 10–24 · 25–49 · 50–89 · 90–180 min) and **`sizeClass`**; the
  box `size` should match `PLANT_SIZES` of its class (`src/scene/slots.ts`: small 86×86, medium
  120×160, large 200×220, tree 380×460), `anchor` at its base. It must fit a slot of its class.
- **`habitats`**: only habitats its gardens have slots for (`water`, `shore`, `meadow`, `path`,
  `back`, `rock`). The plantable tests fail if a species has nowhere to grow. At the waterfall
  (`src/scenery/waterfall/slots.ts`):
  - `rock` is the ledges: small and medium only, at slot scale **0.64–0.72** (the plant is drawn
    smaller than on the ground, so check it still reads);
  - there are only **2 tree slots** (`cliff-1`, `bank-16`): a tree competes for them;
  - the large water slots are **`pool-1` and `pool-2`**; `pool-3`/`pool-4` are medium;
  - the crown of the cliff (`cliff-3..5`) is at scale 0.6.
- **`pollinators`** (bees and butterflies visit), **`reflect`** (defaults to true on water/shore),
  **`bloomColor`** (hex; UI swatch and bee targeting).
- **`draw(p, rng, { w, h, growth })`**: deterministic for (seed, growth, w, h), inside its box, no
  DOM (it runs in a worker), all randomness from `rng`, growth continuous across the 24 steps.

## The test file
Pick the suite of the family your painter follows (`src/plants/lib/suites.ts`):
```ts
import { smallSuite } from '../lib/suites';
smallSuite('iwatabako');                            // tiers 1–2, small-* helpers: continuity over 200 growths

import { shrubSuite } from '../lib/suites';
import { buildYamabuki } from './yamabuki';
shrubSuite('yamabuki', buildYamabuki, { habitats: ['shore', 'meadow'], sizeClass: 'medium' }); // tier 3

import { treeSuite } from '../lib/suites';
import { planKatsura } from './katsura';
treeSuite('katsura', planKatsura);                  // tier 4: plan deterministic, inside the box
```
A species that follows no family writes the same checks itself (determinism, seed variety, growth
continuity, description < 80, a native name, inside the box, its habitats). Add its row to the
TESTING.md matrix only if it brings a new rule.

## Look at it
```
npm run shots -- --entry species-<id>/growth-1                    # one stage (also growth-0.1 … 0.8)
npm run shots -- --studio species-<id>                             # every stage and the grow loop
npm run shots -- --entry species-<id>/growth-1 --seed 2            # … seeds 1 to 6: six variants
npm run shots -- --entry flora/waterfall                           # beside its neighbours, by tier
npm run shots -- --name <id>-wf --query "dev&scenery=waterfall" \
  --eval "sprout.addPlants(30, undefined, 'waterfall'); await sprout.plantsReady()"
```
- **Close view** in the garden: start, finish and frame one plant, light pinned:
  `--eval "sprout.camera.autoFocus(false); sprout.start(25, { speciesId: '<id>', sceneryId: 'waterfall', slotId: 'ledge-3' }); sprout.completeSession(); sprout.setTime('noon'); await sprout.plantsReady(); sprout.camera.focusSlot('ledge-3', { animate: false }); await sprout.camera.settle()"`
  (the minutes must reach the species' tier; pick a slot of its habitat and size).
- **Sunset and night**: the same with `sprout.setTime('sunset')` / `'night'`.
- **Phone**: `--viewports mobile`.
- Name shots by round (`<id>-r1`, `-r2`) and keep derived crops and probes in your scratchpad.

## Budgets
- A full-grown sprite paints in the worker in **4–127 ms at 1.6×** (the existing 25 species'
  range; docs/systems/plants.md › Budgets). Time `def.draw` at `w = size.w × 1.6` in a probe.
- No mark outside the box (it is clipped), nothing touching its sides or top at growth 1.

## Pitfalls
- **Sprites paint asynchronously** in workers: await `sprout.plantsReady()` (or
  `sprout.plants.settle()`) before a shot, `window.studio.settle()` in the studio.
- **The alphabetically first species feeds other studio entries**: `ui-shell` and `widget` draw
  `allSpecies()[0]` (anemone today), and the family boards and `flora` list species in id order.
  An id that sorts before `anemone` changes those cards; say so in your devlog.
- **Never edit shared lib helpers**: they change other species' pixels. Add new helper files.
- **Paint on white**; the paper is multiplied last (ADR 0021). Never fill a background with washi.
- **Pin the time**: `sprout.setTime('noon')` when comparing shots; `advance` and session jumps
  move the light.
- `?speed` and `window.sprout` need `?dev`.

## Before you finish
`npx vitest run src/plants` and `npx playwright test tests/e2e/studio.spec.ts` (with your own
`E2E_PORT`), `npm run typecheck`; the devlog lists the images you looked at and what is left open.
