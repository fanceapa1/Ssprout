/**
 * Composite flower heads made of many tiny florets that merge wet-in-wet (hydrangea mopheads,
 * the massed blooms of a clipped azalea). One wet layer per tone keeps them fast: florets in a
 * layer merge into a soft mass, and the shadow tone dries separately so its edges show.
 */
import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, blob, bounds, deformPolygon, jitter, lighten, mix, padRect, shade, type Painter, type Pigment, type Pt } from '../../paint';

export interface Floret {
  /** offset from the head centre, in units of the head radius */
  u: number;
  v: number;
  /** floret radius in units of the head radius */
  r: number;
  /** -1 shadow … 1 lit */
  lit: number;
  /** 0..1 colour position between the head's two pigments */
  hue: number;
  rot: number;
  seed: number;
}

/** Florets packed into a rounded dome (pure). Lit from the upper left. */
export function headFlorets(rng: Rng, count: number, size = 0.24): Floret[] {
  const out: Floret[] = [];
  let tries = 0;
  while (out.length < count && tries < count * 30) {
    tries++;
    const u = rng.range(-1, 1);
    const v = rng.range(-1, 1);
    // a dome: rounder on top, flatter underneath
    const vv = v > 0 ? v * 1.25 : v;
    if (u * u + vv * vv > 1) continue;
    const r = size * rng.range(0.75, 1.2) * (1 - 0.25 * Math.hypot(u, v));
    if (out.some((f) => Math.hypot(f.u - u, f.v - v) < (f.r + r) * 0.55)) continue;
    const lit = Math.max(-1, Math.min(1, -u * 0.55 - v * 0.75));
    out.push({ u, v, r, lit, hue: Math.max(0, Math.min(1, 0.5 + u * 0.25 + v * 0.3 + rng.gaussian(0, 0.22))), rot: rng.range(0, Math.PI * 2), seed: rng.int(1, 0x7fffffff) });
  }
  return out;
}

export interface HeadPaint {
  x: number;
  y: number;
  /** head radius (current, already scaled by growth) */
  radius: number;
  /** squash of the dome (height / width), default 0.85 */
  squash?: number;
  florets: readonly Floret[];
  /** the two pigments florets shade between */
  a: Pigment;
  b: Pigment;
  /** petals per floret (4 for hydrangea, 5 for azalea) */
  lobes: number;
  /** overall opacity */
  alpha: number;
  seed: number;
  /** body wash under the florets (default true) */
  body?: boolean;
  /** tiny dark floret eyes (0..1 opacity, default 0.35) */
  eyes?: number;
  /** depth of the notches between floret petals (default 1.3) */
  scallop?: number;
}

function floretPoly(f: Floret, c: Pt, R: number, squash: number, lobes: number, rng: Rng, scale = 1, scallop = 1.3): Pt[] {
  const r = f.r * R * scale;
  return blob(c.x + f.u * R, c.y + f.v * R * squash, r, r * 0.88, rng, { points: lobes * 6, irregularity: 0.12, scallop, scallops: lobes, rotation: f.rot });
}

/**
 * Paint composite heads. Heads are split into `groups` alternating sets; each set shares two
 * wet layers — body + lit florets (merging into one soft mass), then cooler shadow florets with
 * a few dark eyes — so overlapping heads in different sets keep their edges.
 */
export function paintHeads(p: Painter, heads: readonly HeadPaint[], groups = 2): void {
  const live = heads.filter((h) => h.radius >= 0.5 && h.alpha >= 0.02);
  for (let gi = 0; gi < groups; gi++) {
    const set = live.filter((_, i) => i % groups === gi);
    if (!set.length) continue;
    const area = padRect(bounds(set.flatMap((h) => [{ x: h.x - h.radius * 1.35, y: h.y - h.radius * 1.3 }, { x: h.x + h.radius * 1.35, y: h.y + h.radius * 1.3 }])), 2);
    const lit = p.layer(area);
    const sh = p.layer(area);
    let Rm = 0;
    let shadows = 0;
    for (const h of set) {
      const rng = createRng(h.seed);
      const R = h.radius;
      Rm = Math.max(Rm, R);
      const sq = h.squash ?? 0.85;
      const c = { x: h.x, y: h.y };
      // body: the two colours bleeding into each other under the florets
      if (h.body !== false) {
        const body = blob(c.x, c.y + R * 0.05, R * 1.0, R * sq * 0.98, rng, { points: 26, irregularity: 0.12, scallop: 0.6, scallops: 11 });
        lit.fill(body, lighten(h.a, 0.25), 0.4 * h.alpha);
        lit.fill(deformPolygon(blob(c.x + R * 0.15, c.y + R * 0.25, R * 0.75, R * sq * 0.6, rng, { points: 18, irregularity: 0.2 }), rng, { depth: 1, variance: 0.1 }), lighten(h.b, 0.12), 0.35 * h.alpha);
      }
      // lit florets: little scalloped stars, lighter toward the light
      for (const f of h.florets) {
        const fr = createRng(f.seed);
        const pig = jitter(mix(h.a, h.b, f.hue), fr, 0.04);
        const tone = f.lit > 0.2 ? lighten(pig, 0.18) : pig;
        lit.fill(floretPoly(f, c, R, sq, h.lobes, fr, 1, h.scallop), tone, 0.72 * h.alpha);
        if (f.lit <= -0.1) {
          sh.fill(floretPoly(f, c, R, sq, h.lobes, fr, 0.8, h.scallop), shade(mix(h.a, h.b, f.hue), 0.22), 0.75 * h.alpha);
          shadows++;
        }
      }
      // dark floret eyes, sparingly
      const eyes = h.eyes ?? 0.35;
      if (eyes > 0) {
        for (const f of h.florets) {
          if (!rng.chance(0.18)) continue;
          const at = { x: c.x + f.u * R, y: c.y + f.v * R * sq };
          sh.fill(blob(at.x, at.y, R * 0.025 + 0.25, R * 0.022 + 0.25, rng, { points: 7 }), shade(mix(h.a, h.b, 0.7), 0.5), 0.9 * eyes * h.alpha);
          shadows++;
        }
      }
    }
    lit.dry({ opacity: 0.85, edge: 0.6, edgeWidth: Math.max(0.5, Rm * 0.05), sharpness: 0.7, centreLift: 0.3, flowScale: Rm * 0.4, granulation: 0.15, blend: 'source-over' });
    if (shadows) sh.dry({ opacity: 0.42, edge: 0.5, edgeWidth: Math.max(0.5, Rm * 0.04), sharpness: 0.65, centreLift: 0.2, flowScale: Rm * 0.4 });
    else sh.discard();
  }
}

/** Bud-green for a head that has not coloured yet. */
export const HEAD_BUD = mix(PIGMENTS.sageLight, '#d7dba8', 0.5);
