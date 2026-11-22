/**
 * Shared bits for creatures that walk the ground: where the others stand or are going to rest, so
 * none walks through another or settles on its spot. docs/systems/fauna.md › Ground creatures.
 */
import type { Pt } from '../../../render/viewport';
import { clamp } from '../../math';
import type { FaunaWorld } from '../../types';

/** The ground creatures and the room each keeps round it (world units at perspective 1). */
export const GROUND_ROOM: Readonly<Record<string, number>> = { cat: 14, tortoise: 13, goat: 16, 'green-lizard': 8, 'rock-crab': 8 };

export interface GroundBody {
  kind: string;
  /** where it is, and where it rests or is going (its `spot()`), if it says */
  at: Pt;
  rest: Pt | null;
  /** its room at its depth */
  r: number;
  ref: object;
}

type Seen = { kind: string; x: number; y: number; done: boolean; alpha?: number; spot?: () => Pt | null };

/** The other ground creatures in sight (not hidden in a gap or a scrub), with their room at their depth. */
export function groundBodies(w: Pick<FaunaWorld, 'creatures' | 'perspective'>, self?: object): GroundBody[] {
  const out: GroundBody[] = [];
  for (const raw of w.creatures) {
    const c = raw as unknown as Seen;
    const room = GROUND_ROOM[c.kind];
    if (room === undefined || c === self || c.done || (c.alpha ?? 1) < 0.05) continue;
    out.push({ kind: c.kind, at: { x: c.x, y: c.y }, rest: c.spot?.() ?? null, r: room * w.perspective(c.y, c.x), ref: raw });
  }
  return out;
}

/** Whether something keeping room `r` can stand or rest at `q`: clear of where each body is and where it rests. */
export function groundFree(q: Pt, r: number, bodies: readonly GroundBody[]): boolean {
  for (const b of bodies) {
    const gap = r + b.r;
    if (Math.hypot(q.x - b.at.x, q.y - b.at.y) < gap) return false;
    if (b.rest && Math.hypot(q.x - b.rest.x, q.y - b.rest.y) < gap) return false;
  }
  return true;
}

/** The nearest body standing in the way from `a` to `b` (room `r` each side), with how far along it is (units); null when the way is clear. */
export function blockerOn(a: Pt, b: Pt, r: number, bodies: readonly GroundBody[]): { body: GroundBody; along: number; off: number } | null {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-6) return null;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  let best: { body: GroundBody; along: number; off: number } | null = null;
  for (const body of bodies) {
    const dx = body.at.x - a.x;
    const dy = body.at.y - a.y;
    const along = dx * ux + dy * uy;
    // ahead of `a` and short of `b`'s far side
    if (along < 0 || along > len + body.r) continue;
    const t = clamp(along, 0, len);
    const off = Math.hypot(a.x + ux * t - body.at.x, a.y + uy * t - body.at.y);
    if (off < r + body.r && (!best || along < best.along)) best = { body, along, off };
  }
  return best;
}

/**
 * Two points to step round a body on the way from `a` to `b`: level with it, `long` before and
 * after along the way, shifted `wide` toward the viewer (`side` +1) or away (−1).
 */
export function stepsRound(a: Pt, b: Pt, body: Pt, long: number, wide: number, side: number): [Pt, Pt] {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const along = (body.x - a.x) * ux + (body.y - a.y) * uy;
  const at = (t: number): Pt => ({ x: a.x + ux * t, y: a.y + uy * t + side * wide });
  return [at(along - long), at(along + long)];
}
