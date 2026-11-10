/**
 * Painting helpers for the southern maidenhair (docs/devlog/136-southern-maidenhair.md): the
 * damp seep it grows from, lobed fan-shaped leaflets batched per frond, hair-fine wiry stalks
 * and the pale-brown rolled margins that hold the sori. New helpers; the `small-*` stay untouched.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, rgba, type Painter, type Pigment, type Pt } from '../../paint';
import { lerp, visible } from './small-growth';

function bounds(pts: readonly Pt[], pad: number): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    x0 = Math.min(x0, q.x);
    y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x);
    y1 = Math.max(y1, q.y);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

/** The shape of one fan leaflet: a wedge whose broad outer margin is cut into lobes. */
export interface FanShape {
  /** half the wedge's opening angle, radians */
  spread: number;
  lobes: number;
  /** depth of the cuts between lobes, as a fraction of the radius */
  notch: number;
  /** depth of the fine teeth on the lobes */
  teeth: number;
  /** turns the fan off its stalk's line: the lower edge straighter, the upper fuller */
  skew: number;
}

/** Outline of a fan leaflet whose stalk end is at `at`, opening toward `angle`. */
export function fanOutline(at: Pt, angle: number, size: number, f: FanShape, open = 1, n = 20): Pt[] {
  const spread = f.spread * lerp(0.3, 1, open);
  const cut = f.notch * open;
  const teeth = f.teeth * open;
  const out: Pt[] = [];
  const foot = size * 0.06;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  out.push({ x: at.x - uy * foot, y: at.y + ux * foot });
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const th = angle + f.skew * spread + (u * 2 - 1) * spread;
    // rounded shoulders, then V cuts between the lobes and small teeth along each lobe
    let r = 0.72 + 0.28 * Math.sin(Math.PI * u) ** 0.6;
    for (let k = 1; k < f.lobes; k++) r -= cut * Math.max(0, 1 - Math.abs(u - k / f.lobes) * f.lobes * 2.6) ** 1.6;
    r -= teeth * (0.5 + 0.5 * Math.cos(u * f.lobes * 3 * Math.PI * 2));
    out.push({ x: at.x + Math.cos(th) * size * r, y: at.y + Math.sin(th) * size * r });
  }
  out.push({ x: at.x + uy * foot, y: at.y - ux * foot });
  return out;
}

/** The point on a fan's margin at `u` (0 … 1 across the fan), for the sori. */
function marginAt(at: Pt, angle: number, size: number, f: FanShape, u: number): Pt {
  const th = angle + f.skew * f.spread + (u * 2 - 1) * f.spread;
  const r = (0.72 + 0.28 * Math.sin(Math.PI * u) ** 0.6) * size * 0.97;
  return { x: at.x + Math.cos(th) * r, y: at.y + Math.sin(th) * r };
}

function ellipse(c: Pt, rx: number, ry: number, a: number, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    out.push({ x: c.x + x * Math.cos(a) - y * Math.sin(a), y: c.y + x * Math.sin(a) + y * Math.cos(a) });
  }
  return out;
}

function transform(poly: readonly Pt[], c: Pt, s: number, a: number, d: Pt): Pt[] {
  const cs = Math.cos(a) * s;
  const sn = Math.sin(a) * s;
  return poly.map((q) => {
    const x = q.x - c.x;
    const y = q.y - c.y;
    return { x: c.x + x * cs - y * sn + d.x, y: c.y + x * sn + y * cs + d.y };
  });
}

export interface FanLeaflet {
  /** stable identity within its frond */
  key: string;
  at: Pt;
  angle: number;
  size: number;
  open: number;
  shape: FanShape;
  tone: Pigment;
  /** a reserved paper light where the sun comes through the leaflet */
  light: boolean;
  /** 0 … 1: how far the pale-brown rolled margin of the sori shows */
  sori: number;
  /** stable per-leaflet noise, 0 … 1 */
  wob: number;
}

/**
 * One frond's leaflets in one wet layer: each a few thin transparent fills (the wash builds up
 * where they cross), a lifted light on some, then the drying pass pools the dark rim. The sori
 * are a second, source-over pass of short pale-brown strokes on the lobe tips.
 */
export function fanLeaflets(p: Painter, leaflets: readonly FanLeaflet[], o: { opacity: number; deep: Pigment; sorus: Pigment }): void {
  const live = leaflets.filter((l) => l.size > 0.25);
  if (!live.length) return;
  const reach = Math.max(...live.map((l) => l.size)) + 1;
  const area = bounds(live.map((l) => l.at), reach);
  const L = p.layer(area);
  for (const l of live) {
    const poly = fanOutline(l.at, l.angle, l.size, l.shape, l.open);
    const w = l.wob * Math.PI * 2;
    L.fill(poly, l.tone, 0.42);
    L.fill(transform(poly, l.at, 0.94, Math.sin(w) * 0.06, { x: Math.cos(w) * 0.12, y: Math.sin(w) * 0.12 }), l.tone, 0.32);
    // the stalk end of the fan is denser, where the veins gather
    L.fill(fanOutline(l.at, l.angle, l.size * 0.5, { ...l.shape, notch: 0, teeth: 0 }, l.open, 8), o.deep, 0.12);
    if (l.light && l.size > 1.2) {
      // a small soft light toward the lit shoulder, where the sun shows through
      const a = l.angle - 0.35 + l.wob * 0.2;
      const c = { x: l.at.x + Math.cos(a) * l.size * 0.55, y: l.at.y + Math.sin(a) * l.size * 0.55 };
      L.lift(ellipse(c, l.size * 0.26, l.size * 0.14, a + Math.PI / 2), 0.3);
    }
  }
  L.dry({ opacity: o.opacity, edge: 0.55, edgeWidth: 0.26, sharpness: 0.8, centreLift: 0.3, granulation: 0.1, flow: 0.3, flowScale: 3, darken: 0.3 });

  const fertile = live.filter((l) => visible(l.sori) && l.size > 1);
  if (!fertile.length) return;
  const S = p.layer(area);
  const ctx = S.ctx;
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(o.sorus, 0.85);
  for (const l of fertile) {
    ctx.lineWidth = Math.max(0.16, l.size * 0.09 * l.sori);
    const half = (0.24 / l.shape.lobes) * l.sori;
    for (let k = 0; k < l.shape.lobes; k++) {
      if ((k + Math.floor(l.wob * 5)) % 3 === 2) continue;
      const u = (k + 0.5) / l.shape.lobes;
      const a = marginAt(l.at, l.angle, l.size, l.shape, u - half);
      const m = marginAt(l.at, l.angle, l.size * 1.02, l.shape, u);
      const b = marginAt(l.at, l.angle, l.size, l.shape, u + half);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
      ctx.stroke();
    }
  }
  S.dry({ opacity: 0.7, edge: 0.4, edgeWidth: 0.15, sharpness: 0.8, centreLift: 0, granulation: 0.1, flow: 0.2, flowScale: 2, darken: 0.35, blend: 'source-over' });
}

/** Hair-fine wiry stalks (pinna branches and leaflet stalks) of one frond, in one layer. */
export function wireStalks(p: Painter, paths: readonly { pts: readonly Pt[]; width: number }[], o: { pigment: Pigment; opacity: number }): void {
  const live = paths.filter((s) => s.pts.length > 1 && s.width > 0.02);
  if (!live.length) return;
  const S = p.layer(bounds(live.flatMap((s) => s.pts), 2));
  const ctx = S.ctx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(o.pigment, 0.95);
  for (const s of live) {
    ctx.lineWidth = s.width;
    ctx.beginPath();
    ctx.moveTo(s.pts[0]!.x, s.pts[0]!.y);
    for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i]!.x, s.pts[i]!.y);
    ctx.stroke();
  }
  S.dry({ opacity: o.opacity, edge: 0.3, edgeWidth: 0.1, sharpness: 0.85, centreLift: 0, granulation: 0, flow: 0.1, flowScale: 2, darken: 0.2, blend: 'source-over' });
}

/**
 * Where it roots: a dark wet hollow in the stone with a damp stain round it, cushions of moss
 * and, at first, the tiny heart-shaped prothallus a fern starts as.
 */
export function dampSeep(p: Painter, rng: Rng, o: { stain: number; moss: number; heart: number; mossAt: readonly Pt[] }): void {
  p.glaze({ cx: 0.5, cy: 1.6, rx: 11, ry: 3.4 }, mix(PIGMENTS.stoneDark, PIGMENTS.celadonDeep, 0.25), { rng: rng.fork('stain'), opacity: 0.08 * o.stain + 0.03, edge: 0.15, sharpness: 0.3 });
  p.glaze({ cx: 0.3, cy: 0.6, rx: 3.2, ry: 1.3 }, mix(PIGMENTS.sumi, PIGMENTS.celadonDeep, 0.25), { rng: rng.fork('hollow'), opacity: 0.32, edge: 0.3, sharpness: 0.55 });
  if (visible(o.moss)) {
    o.mossAt.forEach((m, i) => {
      p.glaze({ cx: m.x, cy: m.y, rx: 2.2 * o.moss, ry: 0.9 * o.moss }, mix(PIGMENTS.sage, PIGMENTS.sap, (i % 3) / 3), { rng: rng.fork(`moss-${i}`), opacity: 0.28, edge: 0.35, sharpness: 0.5, granulation: 0.4 });
    });
  }
  if (visible(o.heart)) {
    for (const s of [-1, 1]) {
      p.dab({ x: 0.4 + s * 0.5, y: -0.5 }, mix('#9cc47a', PIGMENTS.sageLight, 0.3), { rng: rng.fork(`heart-${s}`), variant: 'round', angle: -Math.PI / 2 + s * 0.5, length: 2 * o.heart, width: 1.6 * o.heart, opacity: 0.85, pool: 0.5, basePool: 0.3, layers: 2 });
    }
  }
}
