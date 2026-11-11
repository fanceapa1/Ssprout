/**
 * The ksar's small marks laid into shared wet layers (ADR 0345): strokes, dry-brush strokes and
 * small washes without their own layer and drying pass, so a block's run of like marks dries once.
 * docs/systems/scenery.md › Oasis › Rock.
 */
import type { Rng } from '../../core/rng';
import {
  deformPolygon, DRY_DEFAULTS, GLAZE_DEFAULTS, jitter, layerAlpha, layersFor, outlineLayer, padRect, prepareOutline, rgba, ribbon, STROKE_DEFAULTS, WASH_DEFAULTS, WetLayer,
  type DryOptions, type Painter, type Pigment, type Pt, type Rect, type Shape, type StrokeOptions,
} from '../../paint';
import { strokeGeometry } from '../../paint/primitives';
import { layerResolution } from '../../paint/wet';

/** `dryBrush`'s defaults, under the caller's options. */
export const DRY_BRUSH: StrokeOptions = { wetness: 0.15, dryness: 0.6, width: 14, wobble: 0.3, taper: [0.03, 0.14] };

/** A wet layer over `area` at the work resolution a mark `size` across would get on its own. */
export function batchLayer(p: Painter, area: Rect, size: number): WetLayer {
  const m = p.ctx.getTransform();
  const k = Math.abs(m.a * m.d - m.b * m.c);
  return new WetLayer(p.ctx, padRect(area, 6), p.env, layerResolution(p.quality, size * size * k));
}

/** Lay a stroke's marks into `L` as `stroke` does, at `alpha` of its full strength, without drying. */
export function strokeInto(L: WetLayer, p: Painter, points: readonly Pt[], opts: StrokeOptions, alpha = 1): void {
  if (points.length < 2) return;
  const rng = opts.rng ?? p.env.rng;
  const pigment = opts.pigment ?? '#8a9a6b';
  const width = opts.width ?? STROKE_DEFAULTS.width;
  const dryness = opts.dryness ?? STROKE_DEFAULTS.dryness;
  const g = strokeGeometry(points, opts, p.env.flowNoise, rng);
  const c = L.ctx;
  if (alpha !== 1) c.globalAlpha = alpha;
  if (dryness < 0.05) {
    const n = layersFor(p.env, opts.layers ?? STROKE_DEFAULTS.layers);
    const a = layerAlpha(n, 0.88);
    for (let k = 0; k < n; k++) {
      const wk = 1 + rng.gaussian(0, 0.05);
      L.fill(deformPolygon(ribbon(g.path, (s) => g.hw(s) * wk, g.off), rng, { depth: 1, variance: 0.05 }), jitter(pigment, rng, 0.02), a);
    }
    if (alpha !== 1) c.globalAlpha = 1;
    return;
  }
  L.fill(ribbon(g.path, g.hw, g.off), pigment, 0.5 * (1 - dryness * 0.6));
  const nb = opts.bristles ?? Math.max(5, Math.min(18, Math.round(width / 1.2)));
  const lw = Math.max(0.5, (width / nb) * 1.2);
  const last = Math.max(1, g.path.length - 1);
  const normals = g.path.map((_, i) => {
    const a = g.path[Math.max(0, i - 1)]!;
    const b = g.path[Math.min(g.path.length - 1, i + 1)]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  });
  const hws = g.path.map((_, i) => g.hw(i / last));
  const offs = g.path.map((_, i) => g.off(i / last));
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (let j = 0; j < nb; j++) {
    const u = -1 + (2 * (j + 0.5)) / nb + rng.gaussian(0, 0.08);
    const seed = rng.range(0, 1000);
    c.strokeStyle = rgba(jitter(pigment, rng, 0.04), rng.range(0.5, 0.85));
    c.lineWidth = lw * rng.range(0.7, 1.3);
    let down = false;
    const t0 = rng.range(0, 0.12);
    const t1 = 1 - rng.next() * dryness * 0.6 * (0.4 + Math.abs(u));
    c.beginPath();
    for (let i = 0; i < g.path.length; i++) {
      const s = i / last;
      const q = g.path[i]!;
      const nm = normals[i]!;
      const hw = hws[i]!;
      const gate = p.env.flowNoise((s * g.len) / (width * 6 + 20), seed) + (1 - Math.abs(u)) * 0.6 - dryness * 0.7;
      const o = offs[i]! + u * hw * 0.92;
      if (s >= t0 && s <= t1 && gate > -0.45 && hw > 0.15) {
        if (!down) c.moveTo(q.x + nm.x * o, q.y + nm.y * o);
        else c.lineTo(q.x + nm.x * o, q.y + nm.y * o);
        down = true;
      } else down = false;
    }
    c.stroke();
  }
  if (alpha !== 1) c.globalAlpha = 1;
}

/** The drying `stroke` gives a stroke with these options (the caller's opacity and blend win). */
export function strokeDry(opts: StrokeOptions): DryOptions {
  const wet = opts.wetness ?? STROKE_DEFAULTS.wetness;
  const width = opts.width ?? STROKE_DEFAULTS.width;
  const dryness = opts.dryness ?? STROKE_DEFAULTS.dryness;
  return {
    ...DRY_DEFAULTS,
    opacity: opts.opacity ?? 0.85,
    edge: 0.25 + 0.35 * (1 - wet),
    edgeWidth: Math.max(0.7, width * 0.16),
    sharpness: 0.45 + 0.4 * (1 - wet),
    centreLift: 0.15,
    granulation: 0.15,
    flow: 0.3,
    flowScale: width * 4 + 8,
    dry: dryness >= 0.05 ? 0.3 + dryness * 0.45 : 0,
    ...(opts.blend ? { blend: opts.blend } : {}),
  };
}

export interface SmallWash {
  layers: number;
  deform: number;
  spread: number;
  coverage?: number;
  jitter?: number;
  /** a lost edge toward `angle`, from `start` of the shape's extent, `amount` lifted at the far side */
  fade?: { angle: number; start: number; amount: number };
}

/** Lay a small wash's fills into `L` as `wash` and `glaze` do, without drying. */
export function washInto(L: WetLayer, shape: Shape, pigment: Pigment, rng: Rng, o: SmallWash): void {
  const out = prepareOutline(shape, rng, o.deform);
  const a = layerAlpha(o.layers, o.coverage ?? 0.9);
  const jit = o.jitter ?? 0.025;
  for (let k = 0; k < o.layers; k++) L.fill(outlineLayer(out, rng, o.spread), jit > 0 ? jitter(pigment, rng, jit) : pigment, a);
  if (!o.fade) return;
  // the fade's gradient lift, kept to this shape's own box so it spares its neighbours
  const b = out.bounds;
  const ux = Math.cos(o.fade.angle);
  const uy = Math.sin(o.fade.angle);
  const ds = [b.x * ux + b.y * uy, (b.x + b.w) * ux + b.y * uy, b.x * ux + (b.y + b.h) * uy, (b.x + b.w) * ux + (b.y + b.h) * uy];
  const lo = Math.min(...ds);
  const hi = Math.max(...ds);
  const d0 = lo + (hi - lo) * o.fade.start;
  const c = L.ctx;
  const g = c.createLinearGradient(ux * d0, uy * d0, ux * hi, uy * hi);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${o.fade.amount})`);
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = g;
  const r = padRect(b, 1);
  c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
}

/** The drying of a `wash` and a `glaze`, under the caller's options. */
export const WASH_DRY = WASH_DEFAULTS.dry;
export const GLAZE_DRY = GLAZE_DEFAULTS;
