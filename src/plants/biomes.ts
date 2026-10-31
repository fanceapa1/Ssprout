/**
 * Where species grow (ADR 0250): the vocabulary a species' `range` and a scenery's flora profile
 * share. A new scenery extends these lists here, one line per tag. docs/systems/plants.md › Flora.
 */

export const REALMS = [
  'japan', // the Japanese archipelago
  'east-asia', // China, Korea and the Russian Far East
  'himalaya', // the Himalaya and the mountains of Yunnan and Sichuan
  'europe', // temperate Europe, the British Isles included
  'mediterranean', // the lands round the Mediterranean
  'n-america-west', // the Pacific side of North America
  'neotropics', // Mexico, Central and South America
  'n-africa-arabia', // the Sahara and Arabia
] as const;
export type Realm = (typeof REALMS)[number];

export const BIOMES = [
  'garden', // planted grounds round houses and temples
  'montane-stream', // fast, cold mountain streams and their banks
  'wet-cliff', // dripping rock faces and spray zones
  'temperate-forest', // broadleaf and mixed forest, its edges and clearings
  'bamboo', // bamboo groves
  'wetland', // ponds, marshes, fens and paddy margins
  'alpine', // above the tree line
  'coast', // sea cliffs, dunes and shores
  'heath', // moor and heathland
  'desert', // dry land and its oases
  'cloud-forest', // misty tropical mountain forest
  'grassland', // open sunny grassland, meadows and field margins
] as const;
export type Biome = (typeof BIOMES)[number];

export const CLIMATES = [
  'warm-temperate', // mild winters, hot humid summers (lowland Honshū and south)
  'cool-temperate', // cold snowy winters, mild summers (the mountains, the north)
  'alpine', // short summers above the tree line
  'oceanic', // cool and wet all year (the Atlantic fringe)
  'arid', // little rain
  'tropical-montane', // cool, misty tropical highlands
] as const;
export type Climate = (typeof CLIMATES)[number];

/** Where a species grows wild, and where people plant it. */
export interface Range {
  realms: Realm[];
  biomes: Biome[];
  climates: Climate[];
  /** where it is planted in gardens (a cultivated scenery of that realm offers it) */
  cultivatedIn?: Realm[];
}

/** Grows in every realm, biome and climate: the dev fixture species. */
export const EVERYWHERE: Range = { realms: [...REALMS], biomes: [...BIOMES], climates: [...CLIMATES] };
