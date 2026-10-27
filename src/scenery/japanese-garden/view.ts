/** How the stage frames the Japanese garden. docs/systems/scene.md › Composition map. */
import { PATH } from '../../scene/geometry';
import type { SceneryView } from '../types';

export const GARDEN_VIEW: SceneryView = {
  // the pond's centre: portrait phones keep it in view (ADR 0123)
  focus: { x: 800, y: 560 },
  // the stepping stones' near edges, nearest first: the guiding path leaves from there (ADR 0202)
  pathOut: PATH.map((s) => ({ x: s.x, y: s.y + s.ry })),
};
