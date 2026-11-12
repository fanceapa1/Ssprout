/**
 * The coast's water shapes (G3): the near shore and its depth lines, the seabed, the reflections,
 * the caique, the foam and wrack lines. Eager data, so tests, daylight and motion read them
 * without the painters. docs/systems/scenery.md › Coast › Water.
 */
import { createRng } from '../../core/rng';
import { bounds, resample } from '../../paint/geometry';
import type { Pt, Rect } from '../../render/viewport';
import { CAIQUE, FAR_HILL, HORIZON, PROMONTORY, SHORE_EDGE, WATERLINE_EDGE } from './layout';

/** How much nearer a step toward the horizon looks than one across: the sea plane seen low. */
export const SEA_STRETCH = 2.4;

/**
 * The sea's near shore: down the broken shoreline from the promontory's foot to the steps' foot,
 * then right to left along the beach's waterline, past the left edge.
 */
export const SHORE_PATH: readonly Pt[] = [...SHORE_EDGE, ...WATERLINE_EDGE.slice(0, -1).reverse(), { x: -80, y: 760 }];

/** Every washed area runs past these: the sea from the horizon down under the beach, out past both sides. */
export const SEA_RECT: Rect = { x: -80, y: HORIZON, w: 1060, h: 470 };

/** A moving average along a path, its ends kept. */
function lowpass(path: readonly Pt[], half: number): Pt[] {
  if (half < 1) return path.slice();
  const n = path.length;
  return path.map((q, i) => {
    if (i === 0 || i === n - 1) return { ...q };
    const k = Math.min(half, i, n - 1 - i);
    let x = 0;
    let y = 0;
    for (let j = i - k; j <= i + k; j++) {
      x += path[j]!.x;
      y += path[j]!.y;
    }
    return { x: x / (2 * k + 1), y: y / (2 * k + 1) };
  });
}

/** How far out the water stays shallow is less off rock: the higher up the shoreline, the steeper its foot. */
function steep(a: Pt, b: Pt): number {
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  return x > 640 && y < 812 ? Math.min(320, (812 - y) * 1.1) : 0;
}

/** Distance from the near shore, in stretched units (`SEA_STRETCH` toward the horizon), deeper off the rock. */
export function shoreDistance(q: Pt): number {
  let best = Infinity;
  const k = SEA_STRETCH;
  for (let i = 1; i < SHORE_PATH.length; i++) {
    const a = SHORE_PATH[i - 1]!;
    const b = SHORE_PATH[i]!;
    const dx = b.x - a.x;
    const dy = (b.y - a.y) * k;
    const px = q.x - a.x;
    const py = (q.y - a.y) * k;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(px - dx * t, py - dy * t) + steep(a, b));
  }
  return best;
}

const contours = new Map<string, Pt[]>();

/**
 * The line `r` out from the near shore (stretched units), left to right: in each column, the first
 * point down from the horizon nearer the shore than `r` (wandering by `wobble`), so the line runs
 * round the coves without looping. Computed once per line.
 */
export function shoreContour(r: number, wobble = 0.3, label = 'contour'): Pt[] {
  const key = `${r}:${wobble}:${label}`;
  const hit = contours.get(key);
  if (hit) return hit;
  const rng = createRng(`coast-sea:${label}`);
  const [f1, f2, p1, p2] = [rng.range(70, 120), rng.range(30, 50), rng.range(0, 7), rng.range(0, 7)];
  const top = SEA_RECT.y;
  const bottom = SEA_RECT.y + SEA_RECT.h;
  const line: Pt[] = [];
  for (let x = SEA_RECT.x; x <= SEA_RECT.x + SEA_RECT.w; x += 6) {
    const rr = r * (1 + wobble * (0.75 * Math.sin(x / f1 + p1) + 0.25 * Math.sin(x / f2 + p2)));
    let y = top;
    let prev = top;
    // distance grows at least 2.4 per unit up, so a step can skip ahead by the margin left
    while (y < bottom) {
      const d = shoreDistance({ x, y }) - rr;
      if (d < 0) break;
      prev = y;
      y += Math.max(2, d / SEA_STRETCH);
    }
    let lo = prev;
    let hi = Math.min(y, bottom);
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      if (shoreDistance({ x, y: mid }) >= rr) lo = mid;
      else hi = mid;
    }
    line.push({ x, y: (lo + hi) / 2 });
  }
  const out = lowpass(line, Math.max(2, Math.round(r / 50)));
  contours.set(key, out);
  return out;
}

/** The water out beyond a contour, up to the horizon. */
export function seaward(contour: readonly Pt[]): Pt[] {
  const r = SEA_RECT;
  return [...contour, { x: contour[contour.length - 1]!.x, y: r.y - 40 }, { x: contour[0]!.x, y: r.y - 40 }];
}

/** The water inside a contour, down to the beach and under the land. */
export function shoreward(contour: readonly Pt[]): Pt[] {
  const r = SEA_RECT;
  return [...contour, { x: contour[contour.length - 1]!.x, y: r.y + r.h }, { x: contour[0]!.x, y: r.y + r.h }];
}

/** The depths, in stretched units from the near shore: the pale shallows, the turquoise's edge, the deep's. */
export const DEPTH = { shallows: 150, turquoise: 420, deep: 640 } as const;

/** The pale shallows' edge, where the sand drops away under turquoise (slots and motion read it). */
export const shallowsEdge = (): Pt[] => shoreContour(DEPTH.shallows, 0.3, 'shallows');

type Patch = { x: number; y: number; rx: number; ry: number };

/** Seagrass meadows on the seabed, dark green-teal: kept clear of the water slots' plants. */
export const SEAGRASS: readonly Patch[] = [
  { x: 56, y: 612, rx: 44, ry: 11 }, { x: 150, y: 548, rx: 60, ry: 10 }, { x: 300, y: 522, rx: 78, ry: 12 },
  { x: 430, y: 566, rx: 40, ry: 9 }, { x: 622, y: 560, rx: 54, ry: 11 }, { x: 742, y: 562, rx: 40, ry: 10 }, { x: 412, y: 664, rx: 20, ry: 6 },
];
/** Rock under water: below the cliff, at the bastion and round the splash rocks' feet. */
export const SEABED_ROCKS: readonly Patch[] = [
  { x: 706, y: 470, rx: 52, ry: 10 }, { x: 560, y: 630, rx: 22, ry: 7 }, { x: 770, y: 612, rx: 18, ry: 7 },
  { x: 192, y: 718, rx: 30, ry: 6 }, { x: 386, y: 730, rx: 38, ry: 6 }, { x: 596, y: 676, rx: 44, ry: 7 },
];
/** Pale sand between the meadows, behind the shallows' plants so they read on it. */
export const SAND_WINDOWS: readonly Patch[] = [
  { x: 262, y: 642, rx: 56, ry: 12 }, { x: 520, y: 576, rx: 50, ry: 10 }, { x: 370, y: 590, rx: 44, ry: 9 },
  { x: 140, y: 616, rx: 40, ry: 9 }, { x: 684, y: 628, rx: 40, ry: 9 },
];

/** The top of a closed outline at x (linear between its points), or null where it does not reach. */
function topOf(poly: readonly Pt[], x: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((x < a.x && x < b.x) || (x > a.x && x > b.x) || a.x === b.x) continue;
    const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    if (best === null || y < best) best = y;
  }
  return best;
}

/** The promontory's foot on the water, from its point (636, 414) to the shoreline's top (900, 498). */
export const CLIFF_FOOT: readonly Pt[] = PROMONTORY.slice(PROMONTORY.findIndex((q) => q.x === 900)).concat(PROMONTORY[0]!).reverse();

/** How far a mirrored height drops below its foot (the reflection's squeeze). */
export const REFLECTION_SQUEEZE = 0.32;

/** The far hill mirrored under it: its height squeezed below the horizon. */
export const HILL_REFLECTION: readonly Pt[] = (() => {
  const xs: number[] = [];
  for (let x = -60; x <= 520; x += 10) xs.push(x);
  const top = (x: number) => topOf(FAR_HILL, Math.max(FAR_HILL[0]!.x, x)) ?? HORIZON;
  return [...xs.map((x) => ({ x, y: HORIZON - 1 })), ...xs.reverse().map((x) => ({ x, y: HORIZON + (HORIZON - top(x)) * REFLECTION_SQUEEZE * 0.7 }))];
})();

/** The pale cliff mirrored under its foot: its height above the foot squeezed. */
export const CLIFF_REFLECTION: readonly Pt[] = (() => {
  const foot = resample(CLIFF_FOOT, 12);
  const under = foot.map((q) => {
    const t = topOf(PROMONTORY, q.x) ?? q.y;
    return { x: q.x, y: q.y + Math.max(6, (q.y - t) * REFLECTION_SQUEEZE) };
  });
  return [...foot.map((q) => ({ x: q.x, y: q.y - 4 })), ...under.reverse()];
})();

/**
 * The moored caique (a double-ended wooden fishing boat), bow to the left, in world units about its
 * waterline centre `CAIQUE`. The hull's sheer, keel and both posts; the mast, the yard with the
 * furled sail; the mooring line from the bow to a buoy.
 */
export const CAIQUE_SCALE = 0.85;
const at = (x: number, y: number): Pt => ({ x: CAIQUE.x + x * CAIQUE_SCALE, y: CAIQUE.y + y * CAIQUE_SCALE });
export const CAIQUE_SHAPES = {
  /** the near side, sheer first (stern to bow), then the stem, the waterline and the sternpost */
  hull: [
    at(43, -19), at(30, -13.5), at(10, -11), at(-12, -11.5), at(-32, -15), at(-45, -21), at(-49, -27),
    at(-47.5, -20), at(-44, -10), at(-38, -2.5), at(-31, 0), at(28, 0), at(36, -3.5), at(41, -9), at(44, -16),
  ],
  /** the far gunwale's inside, seen over the near sheer from the clifftop */
  inside: [at(38, -16), at(20, -14.5), at(0, -14), at(-22, -15), at(-38, -19), at(-22, -12.4), at(0, -11.3), at(22, -12.3)],
  sheer: [at(43, -19), at(30, -13.5), at(10, -11), at(-12, -11.5), at(-32, -15), at(-45, -21)],
  waterline: [at(-36, -1.5), at(-20, 0), at(20, 0), at(35, -2.5)],
  mast: [at(-9, -11.5), at(-7.5, -56)],
  yard: [at(-20, -47), at(22, -24)],
  mooring: [at(-47, -20), at(-58, -9), at(-70, -1), at(-80, 2)],
  buoy: at(-98, 3),
} as const;

/** The boat with its reflection, mast and mooring: the box motion rocks and plates. */
export const CAIQUE_BOX: Rect = (() => {
  const b = bounds([...CAIQUE_SHAPES.hull, ...CAIQUE_SHAPES.mast, ...CAIQUE_SHAPES.yard, CAIQUE_SHAPES.buoy]);
  return { x: b.x - 8, y: b.y - 4, w: b.w + 16, h: b.h + 4 + 34 * CAIQUE_SCALE };
})();

/** The beach's foam line along the waterline, left to right, smoothed: where motion laps. */
export const FOAM_LINE: readonly Pt[] = lowpass(resample([{ x: -60, y: 760 }, ...WATERLINE_EDGE.slice(1)], 8), 2);

/** The beach's wrack line (the last high water's weed), a little below the waterline. */
export const WRACK_LINE: readonly Pt[] = FOAM_LINE.filter((q) => q.x < 640).map((q, i) => ({ x: q.x, y: q.y + 30 + 6 * Math.sin(i * 0.37) + 4 * Math.sin(i * 0.11 + 1) }));
