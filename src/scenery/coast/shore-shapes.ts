/**
 * The coast's beach and rock pools as the shore painter lays them out (GB2), data only: the sorted
 * shingle's cobbles, half-buried stones, the Posidonia wrack and its sea balls, dry tufts at the
 * beach's back, and each pool's rim, water, far wall and floor. Fixed seeds, so only the brushwork
 * follows the art seed. docs/systems/scenery.md › Coast › Shore.
 */
import { createRng } from '../../core/rng';
import { createSimplex2D } from '../../paint/noise';
import type { Pt } from '../../render/viewport';
import { POOLS } from './layout';
import { shelfTopAt } from './paint-rocks';
import { lineAt } from './rock-kit';
import { FOAM_LINE, WRACK_LINE } from './sea';
import { BEACH_FLIGHT_BOX } from './shapes';
import { COAST_SLOTS } from './slots';

/** The waterline (where the motion's swash starts) and the beach's back at x. */
export const foamAt = (x: number): number => lineAt(FOAM_LINE, x);
export const backAt = (x: number): number => shelfTopAt(x);
/** The beach's span across x: its left past the frame, its right at the flight's foot. */
export const BEACH_X: readonly [number, number] = [-24, 672];

/** How far up the beach a point lies: 0 at the waterline, 1 at the back. */
export const beachDepth = (x: number, y: number): number => (y - foamAt(x)) / Math.max(1, backAt(x) - foamAt(x));

/** The static wet band's width under the waterline at x: under half the swash's reach (`SWASH_MAX`), so the moving sheet runs past it. */
export const wetWidth = (() => {
  const noise = createSimplex2D(createRng('coast-shore-wet'));
  return (x: number): number => 9 + 3 * noise(x / 70, 0.5) + 1.5 * noise(x / 19, 3);
})();

/** The beach plants' feet (the shingle opens round them). */
const FEET = COAST_SLOTS.filter((s) => s.habitat === 'shore');
const nearFoot = (x: number, y: number): number => Math.min(...FEET.map((s) => Math.hypot(x - s.x, (y - s.y) * 1.6)));

export interface Cobble {
  x: number;
  y: number;
  /** half-width; its height is `r * squash` */
  r: number;
  squash: number;
  tilt: number;
  /** palette index: 0 cream, 1 pale ochre, 2 warm grey, 3 blue-grey, 4 dark, 5 rust, 6 white */
  tone: number;
}

/**
 * The storm berm's cobbles: none in the swash, a few small ones up the fine sand, packed and
 * coarser toward the back; thinned round the plants' feet and kept apart, so sand shows between.
 */
export const COBBLES: readonly Cobble[] = (() => {
  const rng = createRng('coast-shore-cobbles');
  const out: Cobble[] = [];
  const tones = [0, 0, 0, 6, 6, 6, 2, 2, 1, 1, 3, 5, 4];
  for (let i = 0; i < 9000 && out.length < 280; i++) {
    const x = rng.range(BEACH_X[0], BEACH_X[1] - 10);
    const u = 0.3 + 0.7 * rng.next();
    // denser up the berm: a stone low on the beach is rare
    if (rng.next() > ((u - 0.3) / 0.7) ** 2 + 0.03) continue;
    const top = foamAt(x);
    const back = backAt(x);
    const y = top + (back - top) * u - 1;
    const foot = nearFoot(x, y);
    if (foot < 16 || (foot < 28 && rng.chance(0.6))) continue;
    if (x > BEACH_FLIGHT_BOX.x - 6 && y > BEACH_FLIGHT_BOX.y) continue;
    const big = (u - 0.3) / 0.7;
    const r = (1.1 + 3.1 * big ** 1.3) * rng.range(0.65, 1.25) * (rng.chance(0.06) ? 1.5 : 1);
    if (out.some((c) => Math.hypot(c.x - x, (c.y - y) * 1.5) < (c.r + r) * 0.95)) continue;
    out.push({ x, y, r, squash: rng.range(0.5, 0.68), tilt: rng.range(-0.35, 0.35), tone: rng.pick(tones) });
  }
  return out;
})();

/** Larger sea-rounded stones half buried in the berm, clear of the plants: centre of their foot, width. */
export const BURIED: readonly { x: number; y: number; w: number }[] = [
  { x: 28, w: 13, d: 9 }, { x: 206, w: 15, d: 7 }, { x: 376, w: 12, d: 8 }, { x: 512, w: 14, d: 6 }, { x: 118, w: 9, d: 14 },
].map((s) => ({ x: s.x, y: backAt(s.x) - s.d, w: s.w }));

/** The wrack line's drifts of dead Posidonia leaves (the last high water's), clear of the plants: start and end along `WRACK_LINE`. */
export const WRACK_DRIFTS: readonly { t0: number; t1: number }[] = [
  { t0: 0.02, t1: 0.09 }, { t0: 0.13, t1: 0.17 }, { t0: 0.43, t1: 0.52 }, { t0: 0.57, t1: 0.6 }, { t0: 0.7, t1: 0.79 }, { t0: 0.9, t1: 0.96 },
].filter((d) => {
  const at = (t: number) => WRACK_LINE[Math.round(t * (WRACK_LINE.length - 1))]!;
  return nearFoot(at((d.t0 + d.t1) / 2).x, at((d.t0 + d.t1) / 2).y) > 20;
});

/** The felted balls of Posidonia fibre (egagropili) the sea rolls up: a few by the drifts, two up the berm. */
export const SEA_BALLS: readonly { x: number; y: number; r: number }[] = (() => {
  const rng = createRng('coast-shore-balls');
  const out: { x: number; y: number; r: number }[] = [];
  for (const d of WRACK_DRIFTS) {
    if (rng.chance(0.35)) continue;
    const q = WRACK_LINE[Math.round(rng.range(d.t0, d.t1) * (WRACK_LINE.length - 1))]!;
    out.push({ x: q.x + rng.range(-6, 6), y: q.y + rng.range(1, 5), r: rng.range(1.5, 2.4) });
  }
  for (const x of [262, 548]) out.push({ x, y: foamAt(x) + (backAt(x) - foamAt(x)) * 0.62, r: rng.range(1.6, 2.2) });
  return out.filter((b) => nearFoot(b.x, b.y) > 14);
})();

/** Dry grass tufts in the sand drifted against the shelf at the beach's back: base and height. */
export const BACK_TUFTS: readonly { x: number; y: number; h: number }[] = [
  { x: 14, h: 10 }, { x: 196, h: 8 }, { x: 352, h: 11 }, { x: 534, h: 9 }, { x: 650, h: 12 },
].map((t) => ({ x: t.x, y: backAt(t.x) + 1, h: t.h }));

/** A rock pool as the shore painter sees it, each outline closed and listed from angle 0 (right) round through the near side. */
export interface PoolShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** the still water's edge: hand cut, its far side lowered by the inner wall */
  water: Pt[];
  /** the cover's outer edge: past the shelf's smooth ring and wet rings round the old pool */
  rim: Pt[];
  /** the rim's inner edge along the far side, left to right: the top of the inner wall */
  wallTop: Pt[];
  /** the water's far edge, left to right: the foot of the inner wall */
  wallFoot: Pt[];
  /** the water's near edge, left to right: the lit lip */
  nearEdge: Pt[];
  /** the low limestone platform the pool lies in */
  platform: Pt[];
  /** stones on the floor, under the water */
  floor: { x: number; y: number; r: number; dark: boolean }[];
  /** tufts of weed and crusts of pink coralline at the waterline */
  weed: { x: number; y: number; r: number }[];
  crust: { x: number; y: number; r: number }[];
}

const N = 56;

function poolShape(q: (typeof POOLS)[number], i: number): PoolShape {
  const rng = createRng(`coast-shore-pool-${i}`);
  const noise = createSimplex2D(rng.fork('edge'));
  const wall = Math.max(2.4, q.ry * 0.22);
  // radii as (base, noise) pairs across and down; the noise only pulls in, so the water stays inside the old edge
  const at = (k: number, [bx, nx]: [number, number], [by, ny]: [number, number], drop = 0, seed = 0): Pt => {
    const a = (k / N) * Math.PI * 2;
    const s = Math.sin(a);
    const c = Math.cos(a);
    const m = Math.max(0, Math.min(1, 0.5 + 0.4 * noise(c * 1.5 + seed, s * 1.5 + seed) + 0.25 * noise(c * 5 + seed, s * 5 - seed)));
    return { x: q.cx + c * (bx + nx * m), y: q.cy + s * (by + ny * m) + (s < 0 ? drop * (-s) ** 1.3 : 0) };
  };
  const ks = Array.from({ length: N }, (_, k) => k);
  const water = ks.map((k) => at(k, [q.rx - 2.6, -4.5], [q.ry - 1.9, -2], wall));
  const top = ks.map((k) => at(k, [q.rx - 2, -2.8], [q.ry - 1.4, -1.2]));
  const rim = ks.map((k) => at(k, [q.rx + 12, 3], [q.ry + 8, 1.5], 0, 5));
  const platform = ks.map((k) => at(k, [q.rx + 18, 10], [q.ry + 9, 5], 0, 9));
  // the far side runs from angle π (left) up through 3π/2 to 2π (right): indices N/2..N
  const far = ks.slice(N / 2).concat([0]);
  const near = ks.slice(0, N / 2 + 1).reverse();
  const floor = Array.from({ length: 4 + Math.round(q.rx / 30) }, () => {
    const a = rng.range(0.1, Math.PI - 0.1);
    const d = rng.range(0.25, 0.7);
    return { x: q.cx + Math.cos(a) * q.rx * d * (rng.chance(0.5) ? 1 : -1), y: q.cy + Math.sin(a) * q.ry * d * rng.range(-0.3, 0.9), r: rng.range(1.4, 3.4) * (q.rx / 60 + 0.4), dark: rng.chance(0.3) };
  });
  const weed: PoolShape['weed'] = [];
  const crust: PoolShape['crust'] = [];
  for (let k = 0; k < N; k += 1) {
    const a = (k / N) * Math.PI * 2;
    const p = water[k]!;
    // weed on the shaded sides and under the far wall; coralline crust at the waterline all round
    if (rng.chance(Math.sin(a) < 0 ? 0.32 : 0.16)) weed.push({ x: p.x + (q.cx - p.x) * 0.06, y: p.y + (q.cy - p.y) * 0.12, r: rng.range(1.4, 2.8) });
    if (rng.chance(0.14)) crust.push({ x: p.x + rng.range(-1, 1), y: p.y + (Math.sin(a) > 0 ? 0.8 : -0.6), r: rng.range(1.2, 2.6) });
  }
  return {
    cx: q.cx, cy: q.cy, rx: q.rx, ry: q.ry, water, rim, platform, floor, weed, crust,
    wallTop: far.map((k) => top[k]!),
    wallFoot: far.map((k) => water[k]!),
    nearEdge: near.map((k) => water[k]!).reverse(),
  };
}

export const POOL_SHAPES: readonly PoolShape[] = POOLS.map(poolShape);
