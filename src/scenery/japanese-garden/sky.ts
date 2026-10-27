/**
 * Where the light comes from over the Japanese garden: the sun low over the right-hand hills at
 * sunrise and the left-hand hills at sunset, the moon through the gap between the tree groups.
 * docs/systems/daylight.md › Sky layout.
 */
import type { SkyLayout } from '../../ambience/sky-layout';

export const GARDEN_SKY_LAYOUT: SkyLayout = {
  // behind the far ridge (~y 300–352)
  horizonY: 368,
  sunriseX: 966,
  sunsetX: 556,
  moonArc: [
    { x: 902, y: 270 },
    { x: 806, y: 182 },
    { x: 708, y: 252 },
  ],
  stars: { top: 30, depth: 270, gap: { x: 806, halfW: 130, y0: 140, y1: 300 } },
};
