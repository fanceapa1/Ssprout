/**
 * Dry-brush marks laid into a shared wet layer (ADR 0343): the bristles `dryBrush` paints, without
 * its own layer and drying pass, so a run of like strokes (the near plots' furrows) dries once.
 * docs/systems/scenery.md › Oasis › Land.
 */
import { DRY_DEFAULTS, jitter, padRect, rgba, ribbon, STROKE_DEFAULTS, WetLayer, type DryOptions, type Painter, type Pt, type Rect, type StrokeOptions } from '../../paint';
import { strokeGeometry } from '../../paint/primitives';
import { layerResolution } from '../../paint/wet';

/** `dryBrush`'s defaults under the caller's options. */
const DRY_BRUSH = { wetness: 0.15, dryness: 0.6, width: 14, wobble: 0.3, taper: [0.03, 0.14] as [number, number] };

/** Lay a dry-brush stroke's body and bristles into `L` (as `dryBrush` does), without drying. */
export function dryBrushInto(L: WetLayer, p: Painter, points: readonly Pt[], options: StrokeOptions): void {
  if (points.length < 2) return;
  const opts = { ...DRY_BRUSH, ...options };
  const rng = opts.rng ?? p.env.rng;
  const pigment = opts.pigment ?? '#8a9a6b';
  const width = opts.width ?? STROKE_DEFAULTS.width;
  const dryness = opts.dryness;
  const g = strokeGeometry(points, opts, p.env.flowNoise, rng);
  const c = L.ctx;
  L.fill(ribbon(g.path, g.hw, g.off), pigment, 0.5 * (1 - dryness * 0.6));
  const nb = opts.bristles ?? Math.max(5, Math.min(18, Math.round(width / 1.2)));
  const lw = Math.max(0.5, (width / nb) * 1.2);
  const normals = g.path.map((_, i) => {
    const a = g.path[Math.max(0, i - 1)]!;
    const b = g.path[Math.min(g.path.length - 1, i + 1)]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  });
  // the half-width and wobble are the same for every bristle: sample them once per point
  const last = Math.max(1, g.path.length - 1);
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
      const ink = s >= t0 && s <= t1 && gate > -0.45 && hw > 0.15;
      const o = offs[i]! + u * hw * 0.92;
      if (ink) {
        if (!down) c.moveTo(q.x + nm.x * o, q.y + nm.y * o);
        else c.lineTo(q.x + nm.x * o, q.y + nm.y * o);
        down = true;
      } else down = false;
    }
    c.stroke();
  }
}

/** The drying `dryBrush` gives a stroke with these options (the caller's opacity and blend win). */
export function dryBrushDry(options: StrokeOptions): DryOptions {
  const { wetness: wet, dryness, width } = { ...DRY_BRUSH, ...options };
  const { opacity, blend } = options;
  return {
    ...DRY_DEFAULTS,
    opacity: opacity ?? 0.85,
    edge: 0.25 + 0.35 * (1 - wet),
    edgeWidth: Math.max(0.7, width * 0.16),
    sharpness: 0.45 + 0.4 * (1 - wet),
    centreLift: 0.15,
    granulation: 0.15,
    flow: 0.3,
    flowScale: width * 4 + 8,
    dry: 0.3 + dryness * 0.45,
    ...(blend ? { blend } : {}),
  };
}

/**
 * A wet layer over `area` at the work resolution one stroke over `sample` would get, so marks
 * batched into a large layer keep their own stroke's sharpness.
 */
export function batchLayer(p: Painter, area: Rect, sample: Rect, pad: number): WetLayer {
  const m = p.ctx.getTransform();
  const k = Math.abs(m.a * m.d - m.b * m.c);
  const s = padRect(sample, pad);
  return new WetLayer(p.ctx, area, p.env, layerResolution(p.quality, s.w * s.h * k));
}
