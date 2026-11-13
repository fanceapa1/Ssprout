/**
 * Where creatures go (pure): flower heads for pollinators, perches for small birds, lily pads for
 * the frog, a wading spot for the heron, and the scene's perspective scale. Everything is derived
 * from the SceneGeometry contract and the garden's plants — never hard-coded coordinates.
 */
import { createRng, type Rng } from '../core/rng';
import type { PlantInstance } from '../core/state';
import type { SpeciesDef } from '../plants/types';
import type { Pt } from '../render/viewport';
import type { SceneGeometry, Slot } from '../scene/geometry';
import { plantScale } from '../scene/slots';
import { plantWorldBounds } from '../plants/bounds';
import { clamp, closestOnPolygon, dist, pointInPolygon, polygonBounds, polygonCentroid } from './math';

export type TargetSpecies = Pick<SpeciesDef, 'pollinators' | 'habitats' | 'size' | 'anchor' | 'bloomColor'>;
export type TargetLookup = (id: string) => TargetSpecies | undefined;

export interface FlowerTarget {
  plantId: string;
  /** a point among the flower heads (upper part of the sprite box) */
  x: number;
  y: number;
  /** the plant's base y (its depth) */
  baseY: number;
  /** rough radius of the flowering area */
  r: number;
}

/** Sprite box of a placed plant in world units (base at the slot, per the species anchor). */
export function plantBox(slot: Pick<Slot, 'x' | 'y' | 'scale'>, def: Pick<SpeciesDef, 'size' | 'anchor'>) {
  return plantWorldBounds(def, slot);
}

/**
 * Flower targets for bees and butterflies: finished plants whose species has `pollinators`.
 * The point is seeded by the plant (stable across reloads) inside the top third of its box.
 */
export function flowerTargets(plants: readonly PlantInstance[], slots: readonly Slot[], lookup: TargetLookup): FlowerTarget[] {
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const out: FlowerTarget[] = [];
  for (const p of plants) {
    const def = lookup(p.speciesId);
    const slot = slotById.get(p.slotId);
    if (!def || !slot || !def.pollinators) continue;
    const box = plantBox(slot, def);
    const rng = createRng(p.seed).fork('fauna-flower');
    out.push({
      plantId: p.id,
      x: box.x + box.w * rng.range(0.38, 0.62),
      y: box.y + box.h * rng.range(0.1, 0.3),
      baseY: slot.y,
      r: Math.max(4, Math.min(box.w, box.h) * 0.22),
    });
  }
  return out;
}

export interface Pad {
  plantId: string;
  x: number;
  y: number;
  r: number;
  scale: number;
}

/** Water plants (lotus, water lily…) growing in water slots — somewhere for a frog to sit. */
export function lilyPads(plants: readonly PlantInstance[], slots: readonly Slot[], lookup: TargetLookup): Pad[] {
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const out: Pad[] = [];
  for (const p of plants) {
    const def = lookup(p.speciesId);
    const slot = slotById.get(p.slotId);
    if (!def || !slot || slot.habitat !== 'water' || !def.habitats.includes('water')) continue;
    out.push({ plantId: p.id, x: slot.x, y: slot.y, r: Math.max(8, def.size.w * plantScale(slot) * 0.32), scale: slot.scale });
  }
  return out;
}

export interface Perch {
  id: string;
  /**
   * a boulder's top, a stepping stone, a shelf on a cliff; the oasis's wall copings, basin rim, palm fronds, tower top and gate posts;
   * the coast's tree limbs, jar rims, temple ruins, the caique and the far pines' crowns (ADR 0373)
   */
  kind: 'rock' | 'stone' | 'ledge' | 'wall' | 'rim' | 'frond' | 'tower' | 'post' | 'branch' | 'jar' | 'ruin' | 'boat' | 'crown';
  /** centre of the standing area; y is the surface there */
  x: number;
  y: number;
  /** half-width a bird may hop along */
  spread: number;
  /** how much the surface drops toward the ends of the spread (rocks are domed) */
  dome: number;
  /** entities depth: in front of the rock / stone it stands on */
  depth: number;
  /** rise per unit x along the spread (a frond, a coping running toward the horizon); default flat */
  slope?: number;
  /** the scale of what stands here when it is not the ground's (`w.perspective`): a palm crown, a far tower */
  scale?: number;
  /** the moving body it is on (`w.carriers`, the coast's caique): its point now is `carried(p, w.carriers[id])` */
  carrier?: string;
}

/**
 * An area a creature lives in rather than on a perch (ADR 0373): the coast's shallows, rock pools,
 * open bay, the air over the cove and the trees' bark. Inside: in `outline`, in none of `holes`.
 */
export interface Region {
  id: string;
  kind: 'shallows' | 'pool' | 'bay' | 'sky' | 'bark';
  outline: Pt[];
  /** carved out of it (the rocks standing in the shallows) */
  holes?: Pt[][];
  /** a far stage's own scale at the region's top and bottom y, linear between (not `w.perspective`) */
  scale?: { top: number; bottom: number };
}

/** Is `q` inside the region (in its outline, in none of its holes)? */
export function inRegion(r: Pick<Region, 'outline' | 'holes'>, q: Pt): boolean {
  return pointInPolygon(q, r.outline) && !(r.holes ?? []).some((h) => pointInPolygon(q, h));
}

/** The scale of what moves in a far stage at `y` (its own), or null where the ground's perspective holds. */
export function regionScale(r: Pick<Region, 'outline' | 'scale'>, y: number): number | null {
  if (!r.scale) return null;
  const b = polygonBounds(r.outline);
  const u = clamp((y - b.y) / (b.h || 1), 0, 1);
  return r.scale.top + (r.scale.bottom - r.scale.top) * u;
}

/**
 * A body that moves under its perches (the coast's caique at its mooring, ADR 0373): the point it
 * turns about at rest, and its pose now (offset, and tilt in radians, clockwise). Whatever animates
 * the body writes `pose` each frame it draws; at rest it is all zero.
 */
export interface Carrier {
  pivot: Pt;
  pose: { dx: number; dy: number; angle: number };
}

/** Where a point on a carrier (given at rest) is now; unchanged without one. */
export function carried(q: Pt, c: Carrier | undefined): Pt {
  if (!c) return { x: q.x, y: q.y };
  const { dx, dy, angle } = c.pose;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = q.x - c.pivot.x;
  const y = q.y - c.pivot.y;
  return { x: c.pivot.x + x * cos - y * sin + dx, y: c.pivot.y + x * sin + y * cos + dy };
}

/** Rocks flagged `perch` (birds stand on their top) and the stepping stones. */
export function perchesOf(scene: Pick<SceneGeometry, 'rocks' | 'path'>): Perch[] {
  const out: Perch[] = [];
  for (const r of scene.rocks) {
    if (!r.perch) continue;
    out.push({ id: r.id, kind: 'rock', x: r.x, y: r.y - r.h * 0.93, spread: r.w * 0.24, dome: r.h * 0.12, depth: r.y + 1 });
  }
  scene.path.forEach((s, i) => {
    out.push({ id: `stone-${i}`, kind: 'stone', x: s.x, y: s.y - s.ry * 0.15, spread: s.rx * 0.5, dome: s.ry * 0.1, depth: s.y + s.ry * 0.6 });
  });
  return out;
}

/** A flat shelf's top edge (`a` → `b`, world units) as a perch: birds stand along its middle 70 %. */
export function ledgePerch(id: string, a: Pt, b: Pt): Perch {
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  return { id, kind: 'ledge', x, y, spread: Math.abs(b.x - a.x) * 0.35, dome: 0, depth: y + 1 };
}

/** Surface y of a perch at `x` (clamped to its spread). */
export function perchY(p: Perch, x: number): number {
  const u = clamp((x - p.x) / (p.spread || 1), -1, 1);
  return p.y + p.dome * u * u + (p.slope ?? 0) * u * p.spread;
}

/** An open patch of ground a walking bird forages over (the oasis's damp plots): an ellipse in world units. */
export interface GroundSpot {
  id: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/**
 * An upright wall face a lizard can cling to: its outline, its top edge left → right and its
 * height (the foot is `h` below the top). Scale: `w.perspective(y, x)`; depth: `wallFootAt`.
 */
export interface WallFace {
  id: string;
  outline: Pt[];
  top: Pt[];
  h: number;
}

/** The y of a wall face's top edge at x (clamped to its ends). */
export function wallTopAt(face: Pick<WallFace, 'top'>, x: number): number {
  const t = face.top;
  if (x <= t[0]!.x) return t[0]!.y;
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1]!;
    const b = t[i]!;
    if (b.x >= x) return b.x === a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  return t[t.length - 1]!.y;
}

/** The y of a wall face's foot at x: the entities depth of whatever clings to it there. */
export function wallFootAt(face: Pick<WallFace, 'top' | 'h'>, x: number): number {
  return wallTopAt(face, x) + face.h;
}

/**
 * Pick a perch for a small bird: free of other birds (≥ `gap` from `occupied`), weighted toward
 * the kind it prefers (wagtails like rocks by the water, sparrows the path). Null when none is free.
 */
export function choosePerch(perches: readonly Perch[], occupied: readonly Pt[], rng: Rng, prefer: Perch['kind'], gap = 30): Perch | null {
  const free = perches.filter((p) => occupied.every((o) => dist(o, p) >= gap));
  if (free.length === 0) return null;
  const weights = free.map((p) => (p.kind === prefer ? 3 : 1));
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < free.length; i++) {
    r -= weights[i]!;
    if (r < 0) return free[i]!;
  }
  return free[free.length - 1]!;
}

export interface Stand {
  x: number;
  y: number;
  /** facing: −1 left, 1 right (toward the pond's middle) */
  facing: number;
}

/**
 * A wading spot for the heron: on the far edge of the pond (so the water and its
 * reflection lie in front of it), a few units into the water, away from pads and rocks.
 */
export function heronStands(pond: readonly Pt[], avoid: readonly Pt[], step = 14, inward = 7): Stand[] {
  if (pond.length < 3) return [];
  const c = polygonCentroid(pond);
  const b = polygonBounds(pond);
  const out: Stand[] = [];
  for (let i = 0, j = pond.length - 1; i < pond.length; j = i++) {
    const a = pond[j]!;
    const q = pond[i]!;
    const n = Math.max(1, Math.round(Math.hypot(q.x - a.x, q.y - a.y) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const e = { x: a.x + (q.x - a.x) * t, y: a.y + (q.y - a.y) * t };
      if (e.y > c.y - b.h * 0.15) continue; // only the far edge: the water and its reflection lie in front of it
      if (Math.abs(e.x - c.x) > b.w * 0.4) continue; // the extreme ends are too pointed
      if (avoid.some((o) => dist(o, e) < 70)) continue;
      const dx = c.x - e.x;
      const dy = c.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      out.push({ x: e.x + (dx / d) * inward, y: e.y + (dy / d) * inward, facing: dx >= 0 ? 1 : -1 });
    }
  }
  return out;
}

/** Distance from a point to the pond edge (handy for tests and ripples). */
export function edgeDistance(p: Pt, pond: readonly Pt[]): number {
  return closestOnPolygon(p, pond).d;
}

/**
 * Perspective scale at a world y, fitted (least squares) to the slots' `scale` — far things are
 * smaller. Falls back to 1 without enough slots.
 */
export function perspectiveFit(slots: readonly Pick<Slot, 'y' | 'scale'>[]): (y: number) => number {
  const n = slots.length;
  if (n < 2) return () => 1;
  const my = slots.reduce((s, p) => s + p.y, 0) / n;
  const ms = slots.reduce((s, p) => s + p.scale, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of slots) {
    num += (p.y - my) * (p.scale - ms);
    den += (p.y - my) ** 2;
  }
  const b = den > 1e-9 ? num / den : 0;
  const a = ms - b * my;
  return (y) => clamp(a + b * y, 0.5, 1.2);
}
