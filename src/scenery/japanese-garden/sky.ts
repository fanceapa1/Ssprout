/**
 * Where the light comes from over the Japanese garden: the sun low over the right-hand hills at
 * sunrise and the left-hand hills at sunset, the moon through the gap between the tree groups.
 * docs/systems/daylight.md › Sky layout.
 */
import type { SkyLayout } from '../../ambience/sky-layout';
import { smoothPath } from '../../paint';
import { WORLD_W, type Pt, type Rect } from '../../render/viewport';
import { HILLS } from '../../scene/layout';

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
  // shadows fall left at sunrise and right at sunset; rims face the other way (ADR 0284)
  sunSide: { sunrise: 1, sunset: -1 },
};

/** The world band the sky plates cover (above the world's top for tall phones, down past the far bank). */
export const SKY_RECT: Rect = { x: 0, y: -240, w: WORLD_W, h: 740 };
/** Plate resolution, bitmap px per world unit (soft washes; the paper adds the grain). */
export const SKY_SCALE = 0.7;

/** The far ridge as a smooth line: the sun sets behind it. */
export function farRidge(): Pt[] {
  return smoothPath(HILLS[0]!.ridge, 16);
}

/** The open sky above the far ridge (with `below` extra units hanging under the ridge). */
export function skyShape(below = 0): Pt[] {
  const ridge = farRidge().map((q) => ({ x: q.x, y: q.y + below }));
  return [{ x: -80, y: SKY_RECT.y - 40 }, { x: WORLD_W + 80, y: SKY_RECT.y - 40 }, { x: WORLD_W + 80, y: ridge[ridge.length - 1]!.y }, ...ridge.reverse()];
}
