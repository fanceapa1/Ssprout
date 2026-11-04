/**
 * The oasis's composition (O2): the bluff, the basin, the terraces, the channels and the palms'
 * places, the skyline traced from the painted silhouette, the terraces' lifts, the footpath and the
 * near ground's structure, the sky layout, the view and the ambience. docs/systems/scenery.md › Oasis.
 */
import type { SkyLayout } from '../../ambience/sky-layout';
import type { Habitat } from '../../plants/types';
import type { Pt } from '../../render/viewport';
import { perspectiveScale } from '../../scene/slots';
import type { SceneryAmbience } from '../types';
import { KSAR_SHAPES } from './ksar';

/** A sliver of the far flat-topped range, seen right of the bluff's shoulder behind the grove. */
export const FAR_RANGE: readonly Pt[] = [
  { x: 780, y: 336 }, { x: 900, y: 322 }, { x: 936, y: 304 }, { x: 1100, y: 300 }, { x: 1132, y: 314 },
  { x: 1300, y: 318 }, { x: 1336, y: 304 }, { x: 1500, y: 302 }, { x: 1540, y: 318 }, { x: 1620, y: 320 },
];

/** Golden dune crests behind the grove (mostly hidden by it). */
export const DUNE_CRESTS: readonly Pt[] = [
  { x: 780, y: 384 }, { x: 960, y: 352 }, { x: 1110, y: 362 }, { x: 1260, y: 342 }, { x: 1420, y: 356 }, { x: 1640, y: 338 },
];
export const DUNE_BASE = 480;

/** Where the grove's palm rows begin: right of the notch the low suns stand in. */
export const GROVE_FROM = 1030;

/**
 * The bluff (O2): a rounded conglomerate ridge on the left, broken where it steps down to the
 * ksar's seat, and a rounded, broken shoulder on the right falling to its foot by the basin.
 */
export const BLUFF: readonly Pt[] = [
  { x: -20, y: 262 }, { x: 20, y: 246 }, { x: 60, y: 230 }, { x: 100, y: 220 }, { x: 140, y: 216 }, { x: 176, y: 220 },
  { x: 204, y: 230 }, { x: 222, y: 244 }, { x: 234, y: 242 }, { x: 248, y: 258 }, { x: 264, y: 266 }, { x: 292, y: 272 },
  { x: 318, y: 284 }, { x: 342, y: 298 }, { x: 364, y: 306 }, { x: 394, y: 312 }, { x: 424, y: 316 },
  { x: 560, y: 318 }, { x: 700, y: 316 }, { x: 860, y: 318 }, { x: 900, y: 320 },
  { x: 920, y: 324 }, { x: 938, y: 332 }, { x: 952, y: 344 }, { x: 960, y: 342 }, { x: 968, y: 356 }, { x: 980, y: 372 },
  { x: 990, y: 392 }, { x: 996, y: 410 }, { x: 1004, y: 412 }, { x: 1008, y: 432 }, { x: 1014, y: 454 }, { x: 1022, y: 476 },
  { x: 980, y: 478 }, { x: 900, y: 474 }, { x: 780, y: 470 }, { x: 640, y: 464 }, { x: 480, y: 460 }, { x: 300, y: 458 },
  { x: 120, y: 456 }, { x: -20, y: 458 },
];

/** Big palms on the right, crowns cut by the top edge, the nearest notch palm right of the low suns. */
export const BIG_PALMS: readonly { top: Pt; base: Pt; size: number }[] = [
  { top: { x: 1236, y: 70 }, base: { x: 1276, y: 548 }, size: 3.0 },
  { top: { x: 1452, y: 14 }, base: { x: 1410, y: 580 }, size: 3.5 },
  { top: { x: 1600, y: 150 }, base: { x: 1572, y: 560 }, size: 2.8 },
  { top: { x: 1140, y: 200 }, base: { x: 1160, y: 474 }, size: 1.8 },
];

/** The pisé terrace walls' top edges and their face height (the drop toward the viewer). */
export interface Wall {
  edge: readonly Pt[];
  h: number;
}
export const WALLS: readonly Wall[] = [
  { edge: [{ x: 1066, y: 478 }, { x: 1140, y: 474 }, { x: 1300, y: 480 }, { x: 1620, y: 470 }], h: 24 },
  { edge: [{ x: -20, y: 506 }, { x: 200, y: 500 }, { x: 400, y: 494 }, { x: 500, y: 490 }], h: 34 },
  { edge: [{ x: -20, y: 602 }, { x: 200, y: 592 }, { x: 380, y: 580 }, { x: 506, y: 572 }], h: 36 },
];

/** The seguia's runs along the terraces, and the falls over each wall into the basin. */
export const SEGUIA_RUNS: readonly (readonly Pt[])[] = [
  [{ x: 300, y: 446 }, { x: 370, y: 462 }, { x: 430, y: 478 }, { x: 458, y: 490 }],
  [{ x: 458, y: 526 }, { x: 476, y: 544 }, { x: 496, y: 562 }, { x: 512, y: 574 }],
  [{ x: 560, y: 662 }, { x: 480, y: 720 }, { x: 380, y: 790 }, { x: 290, y: 880 }, { x: 230, y: 1020 }],
];
export const SEGUIA_FALLS: readonly { top: Pt; drop: number }[] = [
  { top: { x: 458, y: 492 }, drop: 34 },
  { top: { x: 514, y: 576 }, drop: 30 },
];

/** The basin: a stone-edged rectangle in perspective (outer rim), its near face, its rim width. */
export const BASIN: readonly Pt[] = [
  { x: 560, y: 476 }, { x: 1060, y: 476 }, { x: 1114, y: 640 }, { x: 506, y: 640 },
];
export const BASIN_RIM = { far: 12, near: 26, side: 22, face: 18 };

/** The sluice from the basin's near right corner into the oued. */
export const SLUICE: readonly Pt[] = [
  { x: 1096, y: 618 }, { x: 1170, y: 642 }, { x: 1250, y: 664 }, { x: 1334, y: 676 },
];

/** The oued: from behind the big palms on the right, bending down past the viewer's feet. */
export const OUED: readonly Pt[] = [
  { x: 1630, y: 572 }, { x: 1520, y: 590 }, { x: 1420, y: 620 }, { x: 1346, y: 670 }, { x: 1300, y: 746 },
  { x: 1272, y: 840 }, { x: 1250, y: 940 }, { x: 1240, y: 1020 },
  { x: 1520, y: 1020 }, { x: 1500, y: 920 }, { x: 1514, y: 820 }, { x: 1560, y: 740 }, { x: 1630, y: 700 },
];
/** A sand bar on the inside of the bend. */
export const BAR = { cx: 1400, cy: 830, rx: 46, ry: 70 };

/** The top of a closed shape at x (its highest crossing), or null where it does not reach. */
function topAt(poly: readonly Pt[], x: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x)) continue;
    const y = a.x === b.x ? Math.min(a.y, b.y) : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    if (best === null || y < best) best = y;
  }
  return best;
}

/** The highest painted edge at x: the bluff, the ksar's blocks, or the far range behind the grove. */
export function silhouetteAt(x: number): number {
  let y = topAt(FAR_RANGE, x) ?? Infinity;
  if (x < FAR_RANGE[0]!.x) y = Infinity;
  for (const poly of [BLUFF, ...KSAR_SHAPES.flatMap((s) => (s.flank.length ? [s.front, s.flank] : [s.front]))]) {
    const t = topAt(poly, x);
    if (t !== null && t < y) y = t;
  }
  if (Number.isFinite(y)) return y;
  return x < 0 ? BLUFF[0]!.y : FAR_RANGE[FAR_RANGE.length - 1]!.y;
}

/**
 * The open sky's lower edge, left → right, sampled from the painted silhouette (the bluff, the
 * ksar's towers, horns and crenels, the far range behind the grove). Each sample takes the lowest
 * edge within a step either side, so the sky runs into every gap rather than leaving paper.
 */
export const SKYLINE: readonly Pt[] = (() => {
  const step = 2;
  const out: Pt[] = [];
  for (let x = -80; x <= 1680; x += step) {
    let y = -Infinity;
    for (const dx of [-step, -step / 2, 0, step / 2, step]) y = Math.max(y, silhouetteAt(x + dx));
    out.push({ x, y: y + 1 });
  }
  // drop the samples a straight run makes redundant
  return out.filter((q, i) => i === 0 || i === out.length - 1 || q.y !== out[i - 1]!.y || q.y !== out[i + 1]!.y);
})();

/** The skyline's height at x (linear between its points). */
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

/** The footpath's trodden width either side of its line: wider toward the viewer. */
export const PATH_HALF_WIDTH = { far: 16, near: 46 } as const;

/**
 * The near ground's structure (O2 shapes it, O4 paints it): the tilled plots either side of the
 * footpath, the low earth bund along their top edge, and the wet sand along the seguia.
 */
export const NEAR_PLOTS: readonly (readonly Pt[])[] = [
  [{ x: -20, y: 772 }, { x: 140, y: 762 }, { x: 296, y: 772 }, { x: 318, y: 804 }, { x: 252, y: 880 }, { x: 196, y: 1000 }, { x: -20, y: 1000 }],
  [{ x: 438, y: 806 }, { x: 600, y: 792 }, { x: 760, y: 796 }, { x: 772, y: 900 }, { x: 762, y: 1000 }, { x: 330, y: 1000 }, { x: 384, y: 900 }],
  [{ x: 932, y: 778 }, { x: 1062, y: 768 }, { x: 1200, y: 776 }, { x: 1212, y: 880 }, { x: 1192, y: 1000 }, { x: 952, y: 1000 }, { x: 938, y: 890 }],
];
/** The low earth bund curving across the near ground (no level change), broken by the seguia and the footpath. */
export const BUNDS: readonly (readonly Pt[])[] = [
  [{ x: -20, y: 770 }, { x: 140, y: 758 }, { x: 300, y: 768 }, { x: 352, y: 792 }],
  [{ x: 424, y: 806 }, { x: 600, y: 788 }, { x: 772, y: 792 }],
  [{ x: 924, y: 776 }, { x: 1080, y: 764 }, { x: 1226, y: 772 }],
];
/** Damp sand darkening each bank of the seguia's last run, wider as it nears the viewer. */
export const WET_SAND_HALF_WIDTH = { far: 26, near: 70 } as const;

/**
 * Where the light comes from (ADR 0300): the painting is lit from the upper right, and the only
 * low open sky is the notch between the bluff's shoulder and the grove. Both low suns stand in it,
 * the setting one sinking behind the shoulder right of the ksar; the moon arcs over the notch.
 */
export const OASIS_SKY_LAYOUT: SkyLayout = {
  // under the far range (y 300–336), behind the grove's far row
  horizonY: 340,
  sunriseX: 990,
  sunsetX: 920,
  moonArc: [
    { x: 1040, y: 232 },
    { x: 960, y: 150 },
    { x: 926, y: 200 },
  ],
  // the stars stay off the ksar's towers (the gap); high on the left and over the notch
  stars: { top: 6, depth: 104, gap: { x: 664, halfW: 250, y0: -40, y1: 400 } },
  sunSide: { sunrise: 1, sunset: 1 },
};

/**
 * Where the eye rests: the basin's near rim. The portrait crop (600 wide) round it holds the
 * whole ksar, most of the basin and the notch; on wide screens it keeps sky above the horns.
 */
export const FOCUS: Pt = { x: 730, y: 520 };

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
