/**
 * The coast's rock shapes (G2), data only so eager code can read them (devlog 149): the splash
 * rocks in the shallows with their dry tops, the blocks that break the shoreline and the
 * village's houses. Fixed seeds, so only the brushwork follows the art seed.
 */
import { createRng, type Rng } from '../../core/rng';
import type { Pt, Rect } from '../../render/viewport';
import { SHORE_BOULDERS, SPLASH_ROCKS, VILLAGE } from './layout';
import { COAST_SLOTS } from './slots';

export interface RockShape {
  /** base centre on the water or the ground */
  x: number;
  y: number;
  w: number;
  /** the whole silhouette above the water */
  outline: Pt[];
  /** the flat dry top, seen a little from above: where a plant or a heron stands */
  top: Pt[];
  /** the top's front edge at the rock's centre */
  topY: number;
  /** the broken block on the top's back, if any: its x span and top */
  block: { x0: number; x1: number; y: number } | null;
}

/**
 * A limestone ledge seen a little from above: a flat top foreshortened behind its front edge, a
 * low front face to the water, and on some a higher broken block standing on the top's back.
 */
function rockShape(x: number, y: number, w: number, front: number, lift: number, rng: Rng): RockShape {
  const hw = w / 2 + 3;
  const j = (k: number) => rng.range(-k, k);
  const pd = Math.max(5, w * 0.2);
  const back = front - pd;
  const edge: Pt[] = [
    { x: x + hw + 1, y: front + j(1) },
    { x: x + hw * 0.35 + j(4), y: front + 1.2 + j(0.6) },
    { x: x - hw * 0.25 + j(4), y: front + 0.3 + j(0.6) },
    { x: x - hw - 1, y: front + 1.5 + j(1) },
  ];
  const rear: Pt[] = [{ x: x - hw * 0.86, y: back + pd * 0.35 + j(1) }];
  let block: RockShape['block'] = null;
  if (lift > 0) {
    // the block stands on the left or the right of the top's back
    const bw = hw * rng.range(0.7, 1.05);
    const b0 = rng.chance(0.5) ? x - hw * 0.7 + j(3) : x + hw * 0.8 - bw + j(3);
    const b1 = b0 + bw;
    const tilt = j(3);
    rear.push(
      { x: b0, y: back + j(1) }, { x: b0 + 1 + j(1), y: back - lift * 0.6 }, { x: b0 + 4, y: back - lift + tilt },
      { x: b1 - 6, y: back - lift - tilt + j(1.5) }, { x: b1 - 1.5, y: back - lift * 0.7 - tilt }, { x: b1, y: back + j(1) },
    );
    block = { x0: b0, x1: b1, y: back - lift };
  } else {
    rear.push({ x: x - hw * 0.45, y: back + j(1.2) }, { x: x + hw * 0.1, y: back - 1 + j(1.2) });
  }
  rear.push({ x: x + hw * 0.6, y: back + 1 + j(1) }, { x: x + hw * 0.92, y: back + pd * 0.45 + j(1) });
  const outline: Pt[] = [
    { x: x - hw + j(1), y: y + 3 },
    { x: x - hw - 1, y: front + 1.5 },
    ...rear,
    { x: x + hw + 1, y: front },
    { x: x + hw + j(1), y: y + 3 },
    { x: x + hw * 0.35, y: y + 4 + j(1) },
    { x: x - hw * 0.4, y: y + 3.5 + j(1) },
  ];
  const top: Pt[] = [{ x: x - hw * 0.86, y: back + pd * 0.35 }, { x: x - hw * 0.45, y: back }, { x: x + hw * 0.6, y: back + 1 }, { x: x + hw * 0.92, y: back + pd * 0.45 }, ...edge];
  return { x, y, w, outline, top, topY: front, block };
}

const slotOver = (x: number): number | null => COAST_SLOTS.find((s) => s.habitat === 'rock' && Math.abs(s.x - x) < 4)?.y ?? null;

/** The splash rocks: low limestone ledges, the slot on the flat top, a broken block behind on most. */
export const SPLASH_ROCK_SHAPES: readonly RockShape[] = SPLASH_ROCKS.map((r, i) => {
  const rng = createRng(`coast-splash-${i}`);
  const front = (slotOver(r.x) ?? r.y - r.w * 0.2) + 2;
  return rockShape(r.x, r.y, r.w, front, rng.chance(0.6) ? rng.range(5, 10) : 0, rng);
});

/** The blocks on the broken shoreline: taller ledges, each with a block on its back. */
export const SHORE_BOULDER_SHAPES: readonly RockShape[] = SHORE_BOULDERS.map((b, i) => {
  const rng = createRng(`coast-boulder-${i}`);
  return rockShape(b.x, b.y, b.w, b.y - b.w * 0.24, rng.range(8, 16), rng);
});

export interface Cube extends Rect {
  /** the shade side's share of the width */
  side: number;
  holes: Rect[];
}

/** The village's houses: each layout house as one to three white cubes, an upper storey on some; back rows first. */
export const VILLAGE_CUBES: readonly Cube[][] = (() => {
  const rng = createRng('coast-village');
  const rows = new Map<number, Cube[]>();
  const add = (row: number, x: number, y: number, w: number, h: number) => {
    const holes: Rect[] = [];
    const n = rng.chance(0.3) ? 0 : rng.chance(0.6) ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const hw = rng.range(1.4, 2.4);
      const hh = rng.chance(0.4) ? h * rng.range(0.4, 0.55) : rng.range(1.8, 2.8);
      holes.push({ x: x + rng.range(1.5, w * 0.6 - hw), y: y + h - hh - (hh > 4 ? 0 : rng.range(2, h - hh - 2)), w: hw, h: hh });
    }
    const list = rows.get(row) ?? [];
    list.push({ x, y, w, h, side: rng.range(0.28, 0.42), holes });
    rows.set(row, list);
  };
  for (const v of VILLAGE) {
    const row = Math.round(v.y / 6);
    add(row, v.x + rng.range(-1, 1), v.y, v.w * rng.range(0.8, 1), v.h);
    if (rng.chance(0.55)) {
      const w = v.w * rng.range(0.45, 0.65);
      add(row - 1, v.x + (rng.chance(0.5) ? 0 : v.w * 0.35), v.y - v.h * rng.range(0.45, 0.6), w, v.h * 0.6);
    }
    if (rng.chance(0.45)) {
      const w = rng.range(9, 14);
      add(row + 1, v.x + v.w * rng.range(0.6, 0.9), v.y + v.h * rng.range(0.3, 0.5), w, v.h * rng.range(0.6, 0.8));
    }
  }
  return [...rows.keys()].sort((a, b) => a - b).map((k) => rows.get(k)!);
})();
