/**
 * The oasis's layout beyond its geometry: the skyline, the terraces' lifts, the footpath, the sky
 * layout, the view, the ambience boxes and the habitat words. The shapes come from draft A
 * (`drafts/a/layout.ts`) until the painters O2–O4 own them. docs/systems/scenery.md › Oasis.
 */
import type { SkyLayout } from '../../ambience/sky-layout';
import type { Habitat } from '../../plants/types';
import type { Pt } from '../../render/viewport';
import { perspectiveScale } from '../../scene/slots';
import type { SceneryAmbience } from '../types';
import { FAR_RANGE, WALLS } from './drafts/a/layout';

export { BASIN, BASIN_RIM, BIG_PALMS, BLUFF, KSAR, OUED, BAR, SEGUIA_FALLS, SEGUIA_RUNS, SLUICE, WALLS } from './drafts/a/layout';

/**
 * The open sky's lower edge, left → right: the high cliff, the ksar's towers and houses (horns
 * included), the bluff's shoulder, then the far range behind the grove. The big palms cross it.
 */
export const SKYLINE: readonly Pt[] = [
  { x: -80, y: 140 },
  { x: 60, y: 126 },
  { x: 150, y: 132 },
  { x: 206, y: 160 },
  { x: 236, y: 214 },
  { x: 254, y: 230 },
  // the west tower, its lit flank, the houses with the palms behind them
  { x: 254, y: 18 },
  { x: 368, y: 18 },
  { x: 368, y: 96 },
  { x: 420, y: 96 },
  { x: 440, y: 36 },
  { x: 480, y: 40 },
  { x: 504, y: 96 },
  // the tall middle tower
  { x: 504, y: -12 },
  { x: 634, y: -12 },
  { x: 634, y: 60 },
  { x: 700, y: 56 },
  { x: 730, y: 90 },
  // the east tower, its lit flank down to the bluff's shoulder, which hides the range's end
  { x: 730, y: 50 },
  { x: 838, y: 40 },
  { x: 838, y: 266 },
  { x: 846, y: 318 },
  { x: 862, y: 326 },
  ...FAR_RANGE.filter((q) => q.x >= 900),
  { x: 1680, y: 320 },
];

/** The skyline's height at x (linear between its points; the last point wins at a step). */
export function skylineAt(x: number): number {
  const s = SKYLINE;
  if (x <= s[0]!.x) return s[0]!.y;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]!;
    const b = s[i]!;
    if (b.x >= x) return b.x === a.x ? Math.max(a.y, b.y) : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return s[s.length - 1]!.y;
}

/** Top of the sky plates' band (as the other sceneries': paper above the world for tall phones). */
export const SKY_TOP = -240;

/** The open sky above the skyline, with `below` units hanging under it. */
export function openSky(below = 0): Pt[] {
  const line = SKYLINE.map((q) => ({ x: q.x, y: q.y + below }));
  return [{ x: -80, y: SKY_TOP - 40 }, { x: 1680, y: SKY_TOP - 40 }, ...line.reverse()];
}

/**
 * How high each terrace stands above the basin's: the drawn drops of the walls in front of it
 * (ADR 0300). Raised ground reads nearer than its screen y, so it takes `perspectiveScale(y + lift)`.
 */
export const LIFT = {
  /** the high terrace under the bluff, and the coping of the wall that holds it */
  high: WALLS[1]!.h + WALLS[2]!.h,
  /** the middle terrace, and the coping of the wall below it */
  middle: WALLS[2]!.h,
  /** the grove's terrace behind the basin, and its wall's coping */
  grove: WALLS[0]!.h,
} as const;
export type Terrace = keyof typeof LIFT;

/** The scale of what stands at world y on a terrace (or on the basin terrace without one). */
export function terraceScale(y: number, terrace?: Terrace): number {
  return perspectiveScale(y + (terrace ? LIFT[terrace] : 0));
}

/** A wall's coping height at x (linear along its edge), or null beyond its ends. */
export function copingAt(wall: (typeof WALLS)[number], x: number): number | null {
  const e = wall.edge;
  if (x < e[0]!.x || x > e[e.length - 1]!.x) return null;
  for (let i = 1; i < e.length; i++) {
    const a = e[i - 1]!;
    const b = e[i]!;
    if (b.x >= x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return null;
}

/** The trodden walk from the viewer's feet to the basin's near rim, nearest first (painted by O4). */
export const FOOTPATH: readonly Pt[] = [
  { x: 836, y: 1000 },
  { x: 820, y: 920 },
  { x: 832, y: 840 },
  { x: 848, y: 760 },
  { x: 852, y: 690 },
];

/**
 * Where the light comes from (ADR 0300): the painting is lit from the upper right, and the only
 * low open sky is the notch between the bluff's shoulder and the grove. Both low suns stand in it,
 * the setting one sinking behind the shoulder under the ksar; the moon arcs over the notch.
 */
export const OASIS_SKY_LAYOUT: SkyLayout = {
  // under the far range (y 300–336), behind the grove's far row
  horizonY: 340,
  sunriseX: 980,
  sunsetX: 872,
  moonArc: [
    { x: 1010, y: 236 },
    { x: 930, y: 120 },
    { x: 866, y: 220 },
  ],
  // the stars stay off the ksar's towers (the gap); high on the left and over the notch
  stars: { top: 6, depth: 104, gap: { x: 546, halfW: 300, y0: -40, y1: 400 } },
  sunSide: { sunrise: 1, sunset: 1 },
};

/** Where the portrait crop stays: the basin's near rim, with the two east towers and the notch. */
export const FOCUS: Pt = { x: 800, y: 640 };

export const OASIS_AMBIENCE: SceneryAmbience = {
  // the foreground sand either side of the footpath
  dew: [
    { x: 380, y: 760, w: 380, h: 200 },
    { x: 900, y: 760, w: 300, h: 200 },
  ],
  // the bands on the basin and the grove's floor
  mistBands: [0, 1, 2],
  // the basin's water top (y 488) + 140
  veilTo: 628,
};

/** How the planting sheet names each habitat here (`OASIS.habitatWords`, from docs/research/oasis-biome.md). */
export const OASIS_HABITAT_WORDS: Readonly<Record<Habitat, string>> = {
  water: 'in the shallows',
  shore: 'by the water',
  meadow: 'in the plots',
  path: 'on the sand',
  back: 'under the palms',
  rock: 'on the walls',
};
