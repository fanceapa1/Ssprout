/**
 * Photosynthesis motes — where they come from and how often. Pure.
 * A mote rises from a plant's foliage; the plant growing in this session emits more.
 */
import { sessionTimeline } from '../core/session';
import type { GardenState } from '../core/state';
import type { SizeClass } from '../plants/types';
import type { Slot } from '../scene/geometry';
import { plantScale } from '../scene/slots';

export interface Emitter {
  /** base of the plant (world units) */
  x: number;
  y: number;
  /** rough foliage extent above the base (world units) */
  w: number;
  h: number;
  /** relative share of the motes */
  weight: number;
}

export const MOTE = {
  /** motes per second with one plant, at full level */
  base: 0.15,
  /** extra motes per second per unit of emitter weight */
  perWeight: 0.06,
  /** spawn-rate ceiling (per second) */
  maxRate: 0.6,
  /** never more than this many alive */
  max: 7,
  /** lifetime range (s) */
  life: [7, 11] as const,
  /** rise speed range (world units / s) */
  rise: [5, 9] as const,
  /** horizontal drift per unit of wind sway (world units / s) */
  windDrift: 7,
  /** emitter weight of the plant growing in the current session */
  growingWeight: 3,
  /** sprite radius range (world units) */
  size: [1.6, 2.8] as const,
  /** peak alpha */
  alpha: 0.7,
} as const;

/** Rough plant height per slot size class at slot scale 1 (world units). */
export const PLANT_HEIGHT: Readonly<Record<SizeClass, number>> = { small: 34, medium: 62, large: 100, tree: 200 };

/** Emitters for the finished plants and the session's growing plant (unknown slots ignored). */
export function moteEmitters(state: Pick<GardenState, 'plants' | 'session'>, slots: readonly Slot[], now: number): Emitter[] {
  const byId = new Map(slots.map((s) => [s.id, s]));
  const out: Emitter[] = [];
  const growingSlot = state.session?.slotId;
  for (const p of state.plants) {
    if (p.slotId === growingSlot) continue; // stepping aside for the session's plant
    const s = byId.get(p.slotId);
    if (!s) continue;
    const h = PLANT_HEIGHT[s.maxSize] * plantScale(s);
    out.push({ x: s.x, y: s.y, w: h * 0.6, h, weight: 1 });
  }
  if (state.session) {
    const s = byId.get(state.session.slotId);
    if (s) {
      const growth = sessionTimeline(state.session, now).growth;
      const h = PLANT_HEIGHT[s.maxSize] * plantScale(s) * Math.max(0.2, growth);
      out.push({ x: s.x, y: s.y, w: Math.max(10, h * 0.6), h: Math.max(10, h), weight: MOTE.growingWeight });
    }
  }
  return out;
}

/** Motes per second for these emitters at `level` (0..1). Zero without emitters. */
export function moteRate(emitters: readonly Emitter[], level: number): number {
  if (emitters.length === 0 || !(level > 0)) return 0;
  const weight = emitters.reduce((s, e) => s + e.weight, 0);
  return Math.min(1, level) * Math.min(MOTE.maxRate, MOTE.base + MOTE.perWeight * weight);
}

/** Weighted emitter choice for a uniform `u` in [0, 1). */
export function pickEmitter(emitters: readonly Emitter[], u: number): Emitter | undefined {
  const total = emitters.reduce((s, e) => s + e.weight, 0);
  let k = u * total;
  for (const e of emitters) {
    k -= e.weight;
    if (k < 0) return e;
  }
  return emitters.at(-1);
}
