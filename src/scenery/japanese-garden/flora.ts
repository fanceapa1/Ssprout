/** The Japanese garden's flora and habitat words (ADR 0250; docs/systems/scenery.md › Flora). */
import type { SceneryBiome } from '../../plants/flora';
import type { Habitat } from '../../plants/types';

/** A planted garden in warm lowland Japan: it offers what Japanese gardens grow. */
export const GARDEN_FLORA: SceneryBiome = { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true };

/** How the planting sheet names each habitat in the garden. */
export const GARDEN_HABITAT_WORDS: Readonly<Record<Habitat, string>> = {
  water: 'on the water',
  shore: 'at the pond’s edge',
  meadow: 'in the meadow',
  path: 'beside the path',
  back: 'on the far bank',
  rock: 'among the stones',
};
