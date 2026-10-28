/**
 * Studio: the waterfall's vegetation and ground (S8): the banks and meadow, the crown woods and the
 * trees over the edge, the ferns and moss by the ledges, and the whole painting so far.
 */
import { WORLD_H, WORLD_W } from '../../render/viewport';
import type { StudioSection } from '../../studio/types';
import { region } from './rocks.studio';

const section: StudioSection = {
  id: 'waterfall-veg',
  title: 'Scenery · waterfall vegetation',
  order: 108,
  entries: [
    region('veg-banks', 'far ridge, grassy banks and meadow: warm and cool greens, broken lips, granulation, back-runs', { x: 0, y: 340, w: WORLD_W, h: 660 }, ['ridge', 'banks', 'near'], false, 800),
    region('veg-woods', 'crown woods along the cliff top, broken into stands and spires; the trees leaning over the edge', { x: -40, y: 150, w: 1040, h: 260 }, ['gorge', 'cliff', 'ledges', 'woods'], false, 800),
    region('veg-ferns', 'fern sprays and moss at the ledges’ ends and the cliff’s foot', { x: 260, y: 300, w: 680, h: 360 }, ['gorge', 'cliff', 'ledges', 'ferns', 'water', 'falls'], false, 800),
    region('veg-scene', 'the painting so far: vegetation, rock and water under the sky placeholder', { x: 0, y: 0, w: WORLD_W, h: WORLD_H }, undefined, true, 800),
  ],
};

export default section;
