# ADR 0383: A slot may have a site, and a species grows on a site only if it lists it

- Status: accepted
- Date: 2026-11-22
- Builds on: ADRs 0043 (slot perspective and plant sizes), 0250 (flora per scenery), 0360 (the
  coast's layout), 0361 (the coast's range words)

## Context
A species says which habitats it takes and how large it is; a slot says its habitat and its largest
size. In the Greek coast one habitat covers places that grow very different plants:
- `rock` is the terrace walls' copings and cracks (`wall-1…5`, `crack-1/2`), the bastion's headland
  ledge (`shelf-1`) and three splash rocks standing in the sea (`splash-1…3`). Every `rock` plant
  could land on a splash rock: an ivy-leaved cyclamen (a woodland flower) or an ice plant growing on
  a rock in the water. To avoid it the rock rose and the Jerusalem sage dropped `rock` and lost the
  ledge where they belong.
- `shore` is beach sand there, but the spring's margin in the oasis. The southern maidenhair takes
  `shore` for the oasis, so it was offered on the pebble beach too.

No existing habitat fits the splash rocks honestly: as `shore` they would take the sea holly and the
sea daffodil (dune plants), as `water` the algae.

## Decision
- **`Site`** (`src/plants/types.ts`): `'wall' | 'ledge' | 'sea-rock' | 'beach'`, a particular kind
  of place inside a habitat, set only where the habitat word is too broad.
- **`Slot.site?: Site`** and **`SpeciesDef.sites?: Site[]`**, both optional.
- **The rule** (`fitsSite`, read by `isCompatible`): a slot without a site takes any species of its
  habitat, as before; a slot with a site takes only species that list it. A species' `sites` never
  narrows it on slots without a site.
- `isCompatible` is the one reader of the fit, so the rule holds wherever a slot is offered or
  checked: the placement markers and the planting sheet's "nowhere to go" (through
  `controller.placementOptions`), the reducer at `session/start`, and `sprout.addPlants`
  (`plantRandomly`). The planting sheet's habitat line names a habitat only where the garden has a
  slot of it whose site the species may take (`fitsSite`, sizes not read, so no other garden's line
  changes).
- Only the coast sets sites: walls and cracks `wall`, the bastion `ledge`, the splash rocks
  `sea-rock`, the beach `beach`. `scrub-2`, on the sand at the beach's west end, becomes a `shore`
  slot with the site `beach` under its old id (ids are kept in saved gardens).
- Every species the coast offers on those slots lists its sites from docs/research/coast-biome.md
  (devlog 217 has the table); a test pins each one's coast slots.

## Consequences
- The Japanese garden, the waterfall and the oasis have no sited slot, so every species fits the
  slots it fitted before (checked slot by slot for all four gardens before and after); no garden's
  offer changed, since flora does not read sites. The shared caper, oleander and maidenhair list
  sites that only the coast reads.
- A new species for the coast must list its sites to grow on the coast's walls, ledge, splash rocks
  or beach (docs/systems/species-recipe.md).
- No schema change: plants already in a slot are grandfathered, as with any fit change.
- A large place for a second wild shrub was looked for and not found in the present painting: the
  bastion as a `large` slot puts a tree spurge's dome over the cove, as if it grew in the sea, and
  the cliff top and the terrace ends are taken by the goats' ledges, the olive, the temple, the
  creatures' walks or another slot's plant (devlog 217).
