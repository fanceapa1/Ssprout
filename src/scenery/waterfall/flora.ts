/** The waterfall's flora (ADR 0250; docs/systems/scenery.md › Flora). */
import type { SceneryBiome } from '../../plants/flora';

/** A wild gorge in the cool mountains of Honshū: only what grows there wild. */
export const WATERFALL_FLORA: SceneryBiome = {
  realm: 'japan',
  biomes: ['montane-stream', 'wet-cliff', 'temperate-forest'],
  climate: 'cool-temperate',
  cultivated: false,
  // wild fuji does climb on valley edges, but the sprite hangs from a garden trellis
  except: ['wisteria'],
};
