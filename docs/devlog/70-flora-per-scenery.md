# 70 — F1: each scenery offers its own flora

**Status: done**, with the open points below.

## What
- `src/plants/biomes.ts`: the vocabulary (`REALMS`, `BIOMES`, `CLIMATES`, one line per tag),
  `Range`, and `EVERYWHERE` for the dev fixtures. B0's tags plus `grassland`.
- `src/plants/flora.ts`: `SceneryBiome`, `growsIn`, `floraOf`, `floraLookup` (ADR 0250).
- `SpeciesDef` gains `range` (required) and `nativeLang?`; `nativeLang(def)` defaults to `ja-Latn`.
  Each of the 25 species has its real wild range plus `cultivatedIn: ['japan']`
  (docs/systems/plants.md › Flora has the table).
- `Scenery` gains `flora` and `habitatWords`: `japanese-garden/flora.ts` (`GARDEN_FLORA`, and
  `GARDEN_HABITAT_WORDS` moved from `ui/format.ts`), `waterfall/flora.ts` (`WATERFALL_FLORA`,
  `except: ['wisteria']` because the sprite hangs from a trellis).
- Core: `speciesIn` on the controller (`selectableSpecies(min, sceneryId?)`, `placementOptions`
  returns `[]` for a species the garden does not grow); `ReducerWorld.grows?` checked only at
  `session/start`. Existing plants stay. No schema change.
- UI: the planting sheet lists the viewed garden's flora and names only the habitats its slots have;
  `lang` from the species on the sheet, the herbarium, the plant card and the plant view; the
  herbarium names each specimen's garden once it holds more than one.
- Dev: `start`, `addPlants` and `schedule.fillHistory` pick from the target garden's flora;
  `sprout.flora(sceneryId?)`.
- `src/main.ts` (shared): `floraLookup` built once, passed as `speciesIn` to the controller and
  core debug, `grows` to the reducer, `flora.of` to the schedule debug; `habitatWords` reads the
  scenery. Nine lines changed, two imports dropped.

## Result
- The Japanese garden offers exactly today's 25 species. The waterfall offers exactly maidenhair
  fern, Japanese maple, violet, wild strawberry and silver grass, plus the `fx-*` fixtures under
  `?fixtures`.
- `src/scenery/flora.test.ts` replaces `plants/plantable.test.ts` and the waterfall's "every
  species placeable". The lotus Q1 checks moved there. Unit tests also cover the controller,
  persistence, the planting sheet and the plant card. The e2e `gardens.spec.ts` covers the
  waterfall's sheet and the herbarium across gardens.
- Tests: `npm run typecheck`, `npx vitest run` (all), and the e2e specs `gardens`, `sceneries`,
  `planting-previews` and `lotus` pass.

## Left open
- The art tasks add the waterfall's own species with wild ranges (no `cultivatedIn`). They also
  extend the waterfall's pinned list in `flora.test.ts` and the e2e check.
- The waterfall has no tier 3 species and nothing for its pool slots until then. Once it is
  released, `flora.test.ts` holds it to 10–30 species, ≥ 2 per tier and per slot habitat, and
  ≥ 6 offered nowhere else. B0's ≥ 8 and 60 % exclusive bar is not enforced.
- Habitats are per species, not per scenery: silver grass may grow by the waterfall's pool,
  although B0 keeps it to the meadow and the back.
- The plant card's per-scenery note text is F2's.
- The fauna side of "share by biology" is S11's.
