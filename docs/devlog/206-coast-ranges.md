# 206 · Coast range lines (GF2, phase 15)

## What
The olive's `range` was written before ADR 0361 and used the old words. Every coast species' range
line was checked against ADR 0361 and `docs/research/coast-biome.md`.

- **Olive:** `biomes: ['coast'], climates: ['warm-temperate']` became `biomes: ['scrub', 'garden'],
  climates: ['mediterranean']` (wild in maquis, planted on terraces). `realms` and `cultivatedIn`
  (`mediterranean`, `n-africa-arabia`) are unchanged, so the oasis keeps offering it.
- **Caper:** gained `coast` and `scrub` biomes and the `mediterranean` climate (research §5).
- **Sea lavender:** `scrub` and `marine` dropped; the research says biome `coast` only (it is a rock
  plant above the waterline, not a seagrass or alga).
- **Checked and fine:** ice plant, sea daffodil, posidonia, Aleppo pine, cystoseira, peacock's tail,
  cyclamen, rock rose, tree spurge, Jerusalem sage, oleander, pomegranate, grapevine, southern maidenhair.
- **Tests:** the olive, caper and sea lavender tests pin their range; the olive's offer test reads the
  coast's real profile.
- **Docs:** the sea lavender row in `docs/systems/plants-species-a.md`.

## Offers before and after
Offered species per garden, listed before and after (a throwaway test, not committed): Japanese
garden 25, waterfall 17, oasis 18, coast 20, no difference in any of them.

## Left open (judgement calls)
- Sea holly and rock samphire add `europe` to the realm (true biology: Atlantic coasts); the research
  says `mediterranean` only. No garden has that realm, so it changes no offer.
- Lavender keeps a wild range (`heath`, `grassland`, `warm-temperate`) where the research says
  cultivated only (the Greek wild lavender is another species). The coast offers it by `cultivatedIn`.
- `maidenhair-fern` is the Japanese species (`japan`, `east-asia`); the coast's one is
  `southern-maidenhair`, whose range is fine. The Japanese one was left alone.
