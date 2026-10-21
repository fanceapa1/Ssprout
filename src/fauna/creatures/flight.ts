/**
 * Shared bits for flying visitors: where to come in from, where to leave to, and flower choice.
 */
import type { Rng } from '../../core/rng';
import type { Pt, Rect } from '../../render/viewport';
import { dist, offscreenPoint } from '../math';
import type { FlowerTarget } from '../targets';
import { FAUNA_TUNING } from '../tuning';

/** A point just off a random side of the view at a height within [top, bottom] fractions. */
export function entryPoint(view: Rect, rng: Rng, top: number, bottom: number, side = rng.chance(0.5) ? -1 : 1): Pt {
  return offscreenPoint(view, side, view.y + view.h * rng.range(top, bottom), FAUNA_TUNING.offscreen);
}

/** Exit off the nearer side (or `side`), a little higher than now. */
export function exitPoint(view: Rect, from: Pt, rng: Rng, lift = 60, side?: number): Pt {
  const s = side ?? (from.x < view.x + view.w / 2 ? -1 : 1);
  return offscreenPoint(view, s, Math.max(view.y + 10, from.y - rng.range(lift * 0.3, lift)), FAUNA_TUNING.offscreen * 1.5);
}

/**
 * Next flower to visit: nearby ones are much likelier (insects work a patch), never the one
 * just left. Null when there are none.
 */
export function nextFlower(flowers: readonly FlowerTarget[], from: Pt, rng: Rng, exclude: string | null, reach = 160): FlowerTarget | null {
  const pool = flowers.filter((f) => f.plantId !== exclude);
  if (pool.length === 0) return flowers[0] ?? null;
  const weights = pool.map((f) => {
    const d = dist(f, from);
    return 1 / (1 + (d / reach) ** 2);
  });
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}
