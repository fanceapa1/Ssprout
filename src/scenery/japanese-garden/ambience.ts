/** Where the weather's ground effects go in the Japanese garden. docs/systems/ambience.md. */
import type { SceneryAmbience } from '../types';

export const GARDEN_AMBIENCE: SceneryAmbience = {
  // the near banks, left and right of the path
  dew: [
    { x: 90, y: 760, w: 470, h: 190 },
    { x: 980, y: 760, w: 520, h: 190 },
  ],
  // the bands on the pond and the far bank
  mistBands: [1, 2, 3],
  // the pond's top (y 452) + 140: above the plant zone
  veilTo: 592,
};
