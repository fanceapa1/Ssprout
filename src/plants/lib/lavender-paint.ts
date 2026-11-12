/**
 * Painting helpers for the lavender (docs/systems/plants-species-c.md): a soft grey-green dome,
 * fine leaf strokes, pale stems, and spikes of small whorled flowers in dabs.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, padRect, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const TAU = Math.PI * 2;

export interface Ribbon {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  seed: number;
}

/** Thin tapered strokes in one wet layer, broken by a dry brush on the paper's tooth. */
export function paintRibbons(p: Painter, ribbons: readonly Ribbon[], dry: DryOptions = {}): void {
  const live = ribbons.filter((r) => r.pts.length >= 2 && r.width > 0.05);
  if (!live.length) return;
  const maxW = Math.max(...live.map((r) => r.width));
  const L = p.layer(padRect(bounds(live.flatMap((r) => r.pts)), maxW * 2 + 3));
  for (const r of live) ribbonInto(L, r.pts, r.width, r.pigment, createRng(r.seed), { taper: [0.04, 0.6], pressure: (u) => 1.1 - u * 0.4, fills: 1 });
  L.dry({ opacity: 0.85, edge: 0.3, edgeWidth: Math.max(0.25, maxW * 0.3), sharpness: 0.7, centreLift: 0.1, granulation: 0.15, flow: 0.25, flowScale: 8, dry: 0.2, ...dry });
}

export interface Patch {
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  pigment: Pigment;
  alpha: number;
  seed: number;
}

/** An irregular soft ellipse (pure). */
export function patchShape(m: Patch, n = 12): Pt[] {
  const rng = createRng(m.seed);
  const c = Math.cos(m.rot);
  const s = Math.sin(m.rot);
  return Array.from({ length: n }, (_, i) => {
    const k = rng.range(0.82, 1.12);
    const a = (i / n) * TAU;
    const x = Math.cos(a) * m.rx * k;
    const y = Math.sin(a) * m.ry * k;
    return { x: m.at.x + x * c - y * s, y: m.at.y + x * s + y * c };
  });
}

/** Soft wet-in-wet patches: the body of the dome, or the violet haze above it. */
export function paintPatches(p: Painter, patches: readonly Patch[], dry: DryOptions = {}): void {
  const live = patches.filter((m) => m.alpha > 0.02 && m.rx > 0.5);
  if (!live.length) return;
  const shapes = live.map((m) => ({ m, poly: patchShape(m), rng: createRng(m.seed + 1) }));
  const L = p.layer(padRect(bounds(shapes.flatMap((s) => s.poly)), 4));
  for (const { m, poly, rng } of shapes) {
    L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.14 }), jitter(m.pigment, rng, 0.03), 0.3 * m.alpha);
    L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.12 }), jitter(m.pigment, rng, 0.03), 0.22 * m.alpha);
  }
  L.dry({ opacity: 0.72, edge: 0, edgeWidth: 4, sharpness: 0.05, centreLift: 0, granulation: 0.3, flow: 0.5, flowScale: 14, darken: 0, ...dry });
}

export interface Floret {
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  pigment: Pigment;
  alpha: number;
  seed: number;
}

/** One small flower dab (pure). */
export function floretShape(f: Floret): Pt[] {
  return patchShape({ ...f, alpha: 1 }, 8);
}

/** The flower dabs of the spikes, in one layer. */
export function paintFlorets(p: Painter, florets: readonly Floret[], dry: DryOptions = {}): void {
  const live = florets.filter((f) => f.alpha > 0.02 && f.rx > 0.1);
  if (!live.length) return;
  const shapes = live.map((f) => ({ f, poly: floretShape(f), rng: createRng(f.seed + 3) }));
  const L = p.layer(padRect(bounds(shapes.flatMap((s) => s.poly)), 3));
  for (const { f, poly, rng } of shapes) L.fill(poly, jitter(f.pigment, rng, 0.02), 0.8 * f.alpha);
  L.dry({ opacity: 0.9, edge: 0.25, edgeWidth: 0.4, darken: 0, sharpness: 0.6, centreLift: 0.12, granulation: 0.12, flow: 0.3, flowScale: 5, dry: 0.08, ...dry });
}
