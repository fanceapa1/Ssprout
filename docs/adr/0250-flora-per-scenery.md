# ADR 0250: Each scenery offers its own flora, from where species grow

- Status: accepted
- Date: 2026-10-31
- Builds on: ADR 0240 (a garden per scenery), ADR 0241 (the scenery contract), ADR 0244 (the UI reads the garden on view), ADR 0036 (tiers)

## Context
Every species could be planted in every garden. With the waterfall, and about ten sceneries
planned, the owner asked that each scenery has its own flora and fauna, that species are shared
only where they really grow ("share by biology"), and that each garden feels unique. The B0
research proposed a tagging model (realm, biome, climate on species; a profile on each scenery);
a code audit added escape hatches and named every consumer.

## Decision
- **Vocabulary** (`src/plants/biomes.ts`): `REALMS`, `BIOMES`, `CLIMATES`, one documented line per
  tag; a new scenery extends them there. B0's list plus `grassland` (open sunny grassland,
  meadows and field margins), without which kikyō, dandelion and clover had no honest biome.
- **Species**: `SpeciesDef.range: Range` (required) = `{ realms, biomes, climates, cultivatedIn? }`,
  where it grows wild in the form its sprite shows, and where people plant it. A bred or trained
  form (chrysanthemum, weeping cherry) has an empty wild range. `nativeLang?` (BCP 47, default
  `ja-Latn` through `nativeLang(def)`) is the native name's language.
- **Scenery**: `Scenery.flora: SceneryBiome` = `{ realm, biomes, climate, cultivated, also?, except? }`
  and `Scenery.habitatWords` (moved from `ui/format.ts` and `waterfall/layout.ts` into the sceneries).
- **The rule** (`src/plants/flora.ts`, pure): offered ⇔ `!except.includes(id) && (also.includes(id)
  || (realm ∈ range.realms && range.biomes ∩ biomes ≠ ∅ && climate ∈ range.climates) || (cultivated
  && realm ∈ range.cultivatedIn))`. `also`/`except` only where biology cannot say it, each with a
  comment. `floraOf(all, profile)`; `floraLookup(all, profileOf)` caches a list per scenery.
- **Tagging**: the Japanese garden is `japan · garden · warm-temperate`, cultivated; the waterfall
  `japan · montane-stream, wet-cliff, temperate-forest · cool-temperate`, wild, `except: ['wisteria']`
  (wild fuji grows on valley edges, but the sprite hangs from a trellis). All 25 existing species
  are `cultivatedIn: ['japan']` with their real wild range, so the garden keeps exactly its 25 and
  the waterfall offers exactly maidenhair fern, Japanese maple, violet, wild strawberry and silver
  grass (B0 §4). The waterfall's own species will carry a wild range without `cultivatedIn`, so they
  stay out of the garden. Table: docs/systems/plants.md › Flora.
- **Consumers**: `main.ts` builds `floraLookup(species, id => getScenery(id).flora)` and passes
  `of` to the controller (`speciesIn`) and the core and schedule dev hooks, `grows` to the reducer.
  Core never imports `src/scenery`.
  - `selectableSpecies(min, sceneryId = state.scenery)` lists that garden's flora; tiers stay
    global (they come from the session's length, not from progress).
  - `placementOptions` returns `[]` for a species the garden does not grow.
  - `ReducerWorld.grows?(speciesId, sceneryId)` is checked only at `session/start`, where a
    species that does not grow there makes the start a no-op. Load, import, `state/replace`,
    completion and swaps never check it: plants already in a garden are grandfathered. No schema change.
  - The planting sheet lists the viewed garden's flora; its habitat line names only habitats the
    garden's slots have; native names take `lang` from the species there, in the herbarium, the
    plant card and the plant view.
  - The herbarium stays one book; once it holds more than one garden's specimens, each names its garden.
  - The `fx-*` fixtures and the placeholder sprout have the `EVERYWHERE` range. The sprite worker
    still paints any species by id.
  - Dev: `start`, `addPlants` and `schedule.fillHistory` pick from the target garden's flora;
    `sprout.flora(sceneryId?)`.
- **Tests** (`src/scenery/flora.test.ts`, replacing `plants/plantable.test.ts` and the waterfall's
  "every species placeable"): every species has a range and a scenery, and a slot in each scenery
  that offers it; `also`/`except` ids exist; the garden's 25 and the waterfall's 5 are pinned; a
  **released** scenery offers 10–30 species, ≥ 2 per tier, ≥ 2 per slot habitat and ≥ 6 offered
  nowhere else.

## Consequences
- A new scenery is a profile and, if needed, a tag line; sharing follows from the ranges, and the
  uniqueness checks hold it to account once it is released.
- B0's stricter uniqueness bar (≥ 8 exclusive, ≥ 60 % of the offer) is not enforced yet: the
  waterfall offers only its 5 shared species until the art tasks add its own, and it is not
  released. The released bar is ≥ 6 exclusive.
- The waterfall has no tier 3 species and nothing for its pool (`water`) slots until its own
  species arrive; tiers are global, so a long session there may plant a lower-tier species.
- Slot habitats are per species, not per scenery: silver grass may still go by the pool there
  (B0 would keep it to the meadow and the back). A per-scenery habitat restriction is left for later.
- A plant moved by an old save or import into a garden that does not offer its species stays and
  blooms there; only new starts follow the flora.
