/**
 * The oasis's geometry in world units (1600 × 1000): the basin's water (the still pond), the
 * seguia, the sluice and the oued (moving water), and the slots. From draft A's layout; no
 * boulders or stepping stones yet (O2–O4 paint them). docs/systems/scenery.md › Oasis.
 */
import { ribbon, smoothPath } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { SceneGeometry } from '../../scene/geometry';
import { BAR, BASIN, BASIN_RIM, OUED, SEGUIA_RUNS, SLUICE, towardVp } from './layout';
import { OASIS_SLOTS } from './slots';

/** The basin's water inside its coping, its sides on the rim's lines to the vanishing point: far left, far right, near right, near left. */
export const BASIN_WATER: Pt[] = (() => {
  const [fl, , nr, nl] = BASIN as readonly [Pt, Pt, Pt, Pt];
  const r = BASIN_RIM;
  const [far, near] = [fl.y + r.far, nl.y - r.near];
  const [x0, x1] = [nl.x + r.side, nr.x - r.side];
  return [
    { x: towardVp(x0, far), y: far },
    { x: towardVp(x1, far), y: far },
    { x: towardVp(x1, near), y: near },
    { x: towardVp(x0, near), y: near },
  ];
})();

/** The basin with its coping and near face: what stands on the basin terrace. */
export const BASIN_STONE: Pt[] = (() => {
  const [fl, fr, nr, nl] = BASIN as readonly [Pt, Pt, Pt, Pt];
  return [fl, fr, nr, { x: nr.x - 3, y: nr.y + BASIN_RIM.face }, { x: nl.x + 3, y: nl.y + BASIN_RIM.face }, nl].map((q) => ({ ...q }));
})();

/** The basin's far water edge: what its reflections mirror about. */
export const WATERLINE = BASIN_WATER[0]!.y;

/** A channel's water as the draft paints it: its bed ribbon, `w` either side of the smoothed line. */
function channel(run: readonly Pt[], w: number): Pt[] {
  return ribbon(smoothPath(run.map((q) => ({ ...q })), 4), () => w);
}

/** The seguia's runs (the last, wider one leaves the basin for the bottom-left), then the sluice. */
export const SEGUIA: Pt[][] = SEGUIA_RUNS.map((run, i) => channel(run, i === 2 ? 8 * 1.8 : 8));
export const SLUICE_WATER: Pt[] = channel(SLUICE, 7);

/** The oued's water (the sand bar inside it is land). */
export const OUED_WATER: Pt[] = OUED.map((q) => ({ ...q }));

/** The sand bar on the inside of the bend, as an ellipse. */
export { BAR };

/** The oasis's geometry (its scenery: `./index.ts`). No building, lantern or eave of its own. */
export const oasisScene: SceneGeometry = {
  pond: BASIN_WATER,
  waterline: WATERLINE,
  streams: [...SEGUIA, SLUICE_WATER, OUED_WATER],
  falls: null,
  rocks: [],
  path: [],
  structure: null,
  lights: [],
  eave: null,
  slots: OASIS_SLOTS,
  // over the notch between the bluff and the grove, and the palms' crowns
  skyBand: { top: 40, bottom: 300 },
};
