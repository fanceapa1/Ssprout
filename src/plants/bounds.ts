import { plantScale } from '../scene/slots';
import type { SpeciesDef } from './types';

/**
 * World-space sprite box of a placed plant: the species box (world units at slot scale 1) scaled
 * by the slot's perspective scale and the garden plant scale (`GARDEN_PLANT_SCALE`, 1.25 —
 * ADR 0148), positioned so the species anchor sits on the slot point. This is exactly the
 * rectangle the plant system draws the sprite into (docs/systems/plants.md); hover labels,
 * reflections, the placement ghost and fauna targets all use it.
 */
export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function plantWorldBounds(
  def: Pick<SpeciesDef, 'size' | 'anchor'>,
  slot: { x: number; y: number; scale: number },
): WorldRect {
  const k = plantScale(slot);
  const w = def.size.w * k;
  const h = def.size.h * k;
  return { x: slot.x - def.anchor.x * w, y: slot.y - def.anchor.y * h, w, h };
}

/** The same box as edges (what hit-testing wants). */
export function plantWorldEdges(
  def: Pick<SpeciesDef, 'size' | 'anchor'>,
  slot: { x: number; y: number; scale: number },
): { left: number; top: number; right: number; bottom: number } {
  const r = plantWorldBounds(def, slot);
  return { left: r.x, top: r.y, right: r.x + r.w, bottom: r.y + r.h };
}
