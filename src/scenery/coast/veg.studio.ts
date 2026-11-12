/**
 * Studio: the coast's vegetation (G4): the big olive, the leaning Aleppo pine, the promontory's
 * pines and maquis, phrygana, dry grass and the shoreline scrub, alone and in place.
 */
import type { StudioSection } from '../../studio/types';
import { coastRegion } from './land.studio';

const IN_PLACE = ['far', 'sea', 'rock', 'shore', 'land', 'trees', 'near'];

const section: StudioSection = {
  id: 'coast-veg',
  title: 'Scenery · coast vegetation',
  order: 157,
  entries: [
    coastRegion('veg', 'the vegetation alone: maquis, the promontory pines, phrygana, grass, scrub, the olive and the pine', { x: 0, y: 140, w: 1620, h: 880 }, ['trees']),
    coastRegion('olive', 'the big olive on the top terrace: the olive species’ tree at scenery scale, its shadow on the gravel', { x: 1040, y: 100, w: 500, h: 480 }, IN_PLACE, 600),
    coastRegion('pine', 'the leaning Aleppo pine: reddish scaly trunk, open needle pads, cones, its rock', { x: 0, y: 150, w: 320, h: 680 }, IN_PLACE, 400),
    coastRegion('maquis', 'the promontory’s back: pines and dark maquis over the cliff, behind the top terrace', { x: 860, y: 240, w: 760, h: 300 }, IN_PLACE),
  ],
};

export default section;
