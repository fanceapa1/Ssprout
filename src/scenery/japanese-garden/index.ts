/**
 * The Japanese garden as a scenery: the pond, the engawa and its lantern, the stepping stones.
 * Its painters live in `src/scene/` (docs/systems/scene.md); this file gathers them.
 */
import { GARDEN_ART } from '../../scene/background';
import { gardenScene } from '../../scene/geometry';
import { GARDEN_SKY } from '../../scene/paint-sky';
import type { Scenery } from '../types';
import { GARDEN_AMBIENCE } from './ambience';
import { GARDEN_FLORA, GARDEN_HABITAT_WORDS } from './flora';
import { GARDEN_LIGHT_ART } from './light';
import { GARDEN_VIEW } from './view';

export const JAPANESE_GARDEN: Scenery = {
  id: 'japanese-garden',
  name: 'Japanese garden',
  blurb: 'A still pond under the engawa, stepping stones and a paper lantern.',
  order: 0,
  available: () => true,
  geometry: gardenScene,
  art: GARDEN_ART,
  sky: GARDEN_SKY,
  light: GARDEN_LIGHT_ART,
  ambience: GARDEN_AMBIENCE,
  view: GARDEN_VIEW,
  flora: GARDEN_FLORA,
  habitatWords: GARDEN_HABITAT_WORDS,
};
