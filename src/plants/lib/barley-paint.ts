/**
 * Painting helpers for barley (docs/devlog/122-barley.md): the bearded ear (a herringbone of
 * grains up a short axis, each with a long straight awn) and the narrow arching blade. New
 * helpers, so the shared `small-*` stay untouched.
 */
import type { Rng } from '../../core/rng';
import { jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { dabAxis } from './small-paint';
import { pointAt } from './small-structure';

function bounds(pts: readonly Pt[], pad: number): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x: x0 - pad, y: y0 - pad, w: Math.max(...xs) - x0 + pad * 2, h: Math.max(...ys) - y0 + pad * 2 };
}

export interface EarShape {
  /** where the ear starts (the top of its stalk) and the stalk's direction there */
  base: Pt;
  angle: number;
  length: number;
  width: number;
  /** signed bend of the ear's axis (it nods as it ripens) */
  nod: number;
  grains: number;
  awnLen: number;
  /** how far the beard fans out from the axis (radians at the foot of the ear) */
  spread: number;
  /** per-grain jitter of the awn angles (radians), one per grain */
  awnJit: readonly number[];
  /** 0..1 size of the ear and 0..1 length of the awns */
  k: number;
  awn: number;
}

export interface Grain {
  at: Pt;
  angle: number;
  length: number;
  width: number;
  side: 1 | -1;
  t: number;
}

export interface Awn {
  from: Pt;
  to: Pt;
  side: 1 | -1;
  t: number;
}

export function earAxis(e: EarShape): Pt[] {
  return dabAxis(e.base, e.angle, Math.max(0.01, e.length * e.k), e.nod, 10);
}

/** The grains, alternating sides up the axis, leaning out like a plait; smaller at both ends. */
export function grainLayout(e: EarShape, axis: readonly Pt[] = earAxis(e)): Grain[] {
  const out: Grain[] = [];
  const n = e.grains;
  const step = (e.length * e.k) / n;
  for (let j = 0; j < n; j++) {
    const t = (j + 0.45) / n;
    const q = pointAt(axis, t);
    const side: 1 | -1 = j % 2 === 0 ? 1 : -1;
    const f = lerp(0.72, 1, smooth(t / 0.25)) * lerp(1, 0.62, t * t);
    const w = e.width * 0.55 * f * e.k;
    const nx = -Math.sin(q.angle) * side;
    const ny = Math.cos(q.angle) * side;
    out.push({ at: { x: q.x + nx * w * 0.36, y: q.y + ny * w * 0.36 }, angle: q.angle + side * 0.4, length: step * 2.8 * f, width: w, side, t });
  }
  return out;
}

/** Each grain's awn: from its tip, long and straight, fanning a little wider at the foot of the ear. */
export function awnLines(e: EarShape, grains: readonly Grain[] = grainLayout(e)): Awn[] {
  return grains.map((g, j) => {
    const a0 = g.angle - g.side * 0.42;
    const a = a0 + g.side * e.spread * lerp(1, 0.35, g.t) + (e.awnJit[j] ?? 0);
    const from = { x: g.at.x + Math.cos(g.angle) * g.length * 0.45, y: g.at.y + Math.sin(g.angle) * g.length * 0.45 };
    const len = e.awnLen * e.awn * lerp(1, 0.78, g.t);
    return { from, to: { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len }, side: g.side, t: g.t };
  });
}

export interface EarColours {
  green: Pigment;
  gold: Pigment;
  shade: Pigment;
  /** the lit awns, pale straw */
  pale: Pigment;
  awnGreen: Pigment;
}

/**
 * A bearded ear: a faint gold haze behind the beard (what reads at small size), the awns as fine
 * straight hairs, pale on the lit side and darker on the shaded one, then the plait of grains.
 */
export function barleyEar(p: Painter, rng: Rng, e: EarShape, ripe: number, c: EarColours, o: { opacity: number; light: 1 | -1 }): void {
  if (!visible(e.k)) return;
  const axis = earAxis(e);
  const grains = grainLayout(e, axis);
  const awns = awnLines(e, grains);
  const body = mix(c.green, c.gold, ripe);
  const awnTone = mix(c.awnGreen, c.gold, ripe);
  if (visible(e.awn)) {
    const tips = awns.map((a) => a.to);
    const lo = awns.filter((a) => a.side === -1);
    const hi = awns.filter((a) => a.side === 1);
    // the haze: a soft fan between the outermost awns
    if (lo.length && hi.length) {
      const fan: Pt[] = [axis[0]!, ...lo.map((a) => a.to), ...hi.map((a) => a.to).reverse()];
      p.glaze(fan, mix(awnTone, c.pale, 0.4), { rng: rng.fork('haze'), opacity: 0.13 * smooth(e.awn) * lerp(0.6, 1, ripe), edge: 0, sharpness: 0.15, centreLift: 0, granulation: 0.05, fade: { angle: e.angle, start: 0.35, amount: 1 } });
    }
    const L = p.layer(bounds([...tips, ...axis], 4));
    awns.forEach((a, j) => {
      const len = Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y);
      if (len < 0.3) return;
      const lit = a.side === o.light;
      const tone = lit ? mix(awnTone, c.pale, 0.55) : mix(awnTone, c.shade, 0.35 * ripe + 0.1);
      p.dabInto(L, a.from, jitter(tone, rng.fork(`awn-tone-${j}`), 0.03), {
        rng: rng.fork(`awn-${j}`),
        variant: 'needle',
        angle: Math.atan2(a.to.y - a.from.y, a.to.x - a.from.x),
        length: len,
        width: lerp(0.3, 0.62, clamp01(len / 10)),
        curve: 0,
        pool: 0.1,
        basePool: 0.3,
        layers: 1,
        jitter: 0,
      });
    });
    L.dry({ opacity: o.opacity * 0.9, edge: 0.2, edgeWidth: 0.2, sharpness: 0.8, centreLift: 0, granulation: 0.05, flow: 0.1, darken: 0.25 });
  }
  const G = p.layer(bounds(axis, e.width + 3));
  // one body under the grains, so the ear reads dense and not as beads
  G.fill(earBody(axis, e.width * 0.3 * e.k), mix(body, c.shade, 0.2), 0.4);
  grains.forEach((g, j) => {
    const shaded = g.side !== o.light;
    const tone = shaded ? mix(body, c.shade, lerp(0.25, 0.5, ripe)) : body;
    p.dabInto(G, g.at, jitter(tone, rng.fork(`grain-tone-${j}`), 0.03), {
      rng: rng.fork(`grain-${j}`),
      variant: 'leaf',
      angle: g.angle,
      length: g.length,
      width: g.width,
      curve: g.side * 0.05,
      pool: 0.45,
      poolSide: g.side,
      basePool: 0.35,
      layers: 2,
    });
  });
  G.dry({ opacity: o.opacity, edge: 0.55, edgeWidth: 0.35, sharpness: 0.65, centreLift: 0.2, granulation: 0.15, flow: 0.25, flowScale: 4, darken: 0.4 });
}

/** The ear's outline round its axis: full below, narrowing to the tip. */
function earBody(axis: readonly Pt[], hw: number): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = axis.length - 1;
  axis.forEach((q, i) => {
    const a = axis[Math.min(n, i + 1)]!;
    const b = axis[Math.max(0, i - 1)]!;
    const ang = Math.atan2(a.y - b.y, a.x - b.x);
    const t = i / n;
    const w = hw * lerp(0.45, 1, smooth(t / 0.3)) * lerp(1, 0.3, smooth((t - 0.4) / 0.6));
    left.push({ x: q.x - Math.sin(ang) * w, y: q.y + Math.cos(ang) * w });
    right.push({ x: q.x + Math.sin(ang) * w, y: q.y - Math.cos(ang) * w });
  });
  return [...left, ...right.reverse()];
}

/** A narrow grass blade: a tapered stroke with a darker crease down one side of it. */
export function grassBlade(p: Painter, rng: Rng, pts: readonly Pt[], o: { width: number; tone: Pigment; crease: Pigment; opacity: number }): void {
  if (pts.length < 2) return;
  p.stroke(pts, { rng: rng.fork('blade'), pigment: o.tone, width: o.width, taper: [0.02, 0.8], pressure: [0.85, 1, 0.75], wobble: 0.12, wetness: 0.4, opacity: o.opacity, edge: 0.55 });
  p.inkLine(pts.slice(0, Math.max(2, Math.ceil(pts.length * 0.85))), { rng: rng.fork('crease'), width: 0.28, pigment: o.crease, opacity: o.opacity * 0.3, breaks: 0.4, wobble: 0.1, taper: [0.1, 0.6] });
}
