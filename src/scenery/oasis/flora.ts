/** The oasis's flora (ADR 0250; docs/systems/scenery.md › Flora, › Oasis). */
import type { SceneryBiome } from '../../plants/flora';

/**
 * A tended palm grove in the Draa valley: what grows wild in the Saharan oases and their water,
 * and what the oasis gardens plant. No species is shared by biology (docs/research/oasis-biome.md),
 * so it offers none until the phase 13 art queue lands.
 */
export const OASIS_FLORA: SceneryBiome = {
  realm: 'n-africa-arabia',
  biomes: ['desert', 'wetland'],
  climate: 'arid',
  cultivated: true,
};
