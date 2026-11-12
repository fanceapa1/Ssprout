/** The Greek coast's flora (ADRs 0250, 0361; docs/systems/scenery.md › Flora, › Coast). */
import type { SceneryBiome } from '../../plants/flora';

/**
 * A tended clifftop terrace over an Ionian cove: the planted garden, the maquis and phrygana round
 * it, the shingle and cliffs, and the sea edge below (docs/research/coast-biome.md §5). By biology
 * it offers only the caper for now; the phase 15 species bring the rest.
 */
export const COAST_FLORA: SceneryBiome = {
  realm: 'mediterranean',
  biomes: ['coast', 'scrub', 'garden', 'marine'],
  climate: 'mediterranean',
  cultivated: true,
};
