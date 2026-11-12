# ADR 0361: A Mediterranean climate, and scrub and marine biomes, for the coast's flora

- Status: accepted
- Date: 2026-11-12
- Builds on: ADR 0250 (flora per scenery), ADR 0251 (a species only adds files)

## Context
G1 gives the Greek coast its flora profile. The research (docs/research/coast-biome.md §5)
proposes `{ realm: 'mediterranean', biomes: ['coast', 'scrub', 'garden', 'marine'], climate:
'mediterranean', cultivated: true }`. The realm, `coast` and `garden` exist. Three tags do not:
- **No climate fits.** `warm-temperate` is humid Japan and `arid` is the Sahara. Taking `arid`
  would offer the retama and the desert hyacinth by biology, neither of which grows on an Ionian
  terrace (research §4).
- **No biome for maquis and phrygana.** `heath` is moor and heathland.
- **No biome for the sea edge below the waterline** (seagrass beds, rock pools, algae). `coast` is
  cliffs, dunes and shingle.

The phase 15 species tasks only add files (ADR 0251), so the tags their ranges need must exist
before they start.

## Decision
- Add `mediterranean` to `CLIMATES` (hot dry summers, mild wet winters), and `scrub` and `marine`
  to `BIOMES`, one line each in `src/plants/biomes.ts`.
- The coast's profile is the research's, unchanged.
- No existing species is retagged here: the research's shared species (caper, oleander, southern
  maidenhair, grapevine, pomegranate) gain the new tags in the tasks that review them. No
  `also`/`except` yet.

## Consequences
- By biology the coast offers only the caper today (`cultivatedIn: ['mediterranean']`). It stays
  behind `?dev&scenery=coast`, and `flora.test.ts` holds its released invariants (10–30 species, 2
  per tier and habitat, 6 own) only once it ships.
- The offer rule, the oasis's 17 and the other gardens' lists are unchanged: no species carries the
  new tags yet.
