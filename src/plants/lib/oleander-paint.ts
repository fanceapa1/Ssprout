/**
 * Painting helpers for the oleander (docs/systems/plants-species-b.md): long knife leaves with a
 * pale midrib, upright stems, and five-petalled pinwheel flowers with a fringed throat, opening
 * from twisted buds. Each mark carries its own seed; only size, angle and opacity change with growth.
 */
import { createRng, type Rng } from '../../core/rng';
import { bounds, deformPolygon, jitter, mix, padRect, ribbon, shade, smoothPath, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth01 = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------
// knife leaves

export interface KnifeLeaf {
  at: Pt;
  angle: number;
  length: number;
  width: number;
  /** axis bend, signed fraction of the length */
  curve: number;
  pigment: Pigment;
  /** the paler, greyer underside, flooded into the shaded half */
  under: Pigment;
  alpha: number;
  shade: 1 | -1;
  seed: number;
}

export interface KnifeBlade {
  outline: Pt[];
  shadow: Pt[];
  axis: Pt[];
}

/** Half-width along a narrow lanceolate leaf: a tapered base, widest at a third, a long point. */
function knifeProfile(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.32) return Math.sin(((t / 0.32) * Math.PI) / 2) ** 0.9;
  return Math.cos((((t - 0.32) / 0.68) * Math.PI) / 2) ** 0.85;
}

/** The outline of a knife leaf (pure). `rng` wobbles the margins a little. */
export function knifeBlade(b: Pick<KnifeLeaf, 'at' | 'angle' | 'length' | 'width' | 'curve'>, rng: Rng, shadeSide: 1 | -1): KnifeBlade {
  const { at, angle, length: L, width: W, curve } = b;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const axisAt = (t: number): Pt => {
    const bend = curve * L * t * t;
    return { x: at.x + ux * L * t + nx * bend, y: at.y + uy * L * t + ny * bend };
  };
  const N = 9;
  const wob = Array.from({ length: N * 2 }, () => rng.range(0.9, 1.1));
  const side = (s: 1 | -1): Pt[] =>
    Array.from({ length: N }, (_, i) => {
      const t = (i + 1) / (N + 1);
      const a = axisAt(t);
      const hw = (W / 2) * knifeProfile(t) * wob[i * 2 + (s > 0 ? 0 : 1)]!;
      return { x: a.x + nx * hw * s, y: a.y + ny * hw * s };
    });
  const right = side(1);
  const left = side(-1);
  const base = axisAt(0);
  const tip = axisAt(1);
  const axis = Array.from({ length: 9 }, (_, i) => axisAt(i / 8));
  return {
    outline: [base, ...right, tip, ...[...left].reverse()],
    shadow: [base, ...(shadeSide > 0 ? right : left), tip, ...[...axis].reverse()],
    axis,
  };
}

/** Leaves in one wet layer: blade twice, the shaded half flooded grey, the midrib lifted pale. */
export function paintKnifeLeaves(p: Painter, leaves: readonly KnifeLeaf[], dry: DryOptions = {}): void {
  const live = leaves.filter((l) => l.length > 0.6 && l.alpha > 0.02);
  if (!live.length) return;
  const blades = live.map((l) => {
    const rng = createRng(l.seed);
    return { l, rng, blade: knifeBlade(l, rng, l.shade) };
  });
  const L = p.layer(padRect(bounds(blades.flatMap((b) => b.blade.outline)), 4));
  let len = 0;
  for (const { l, rng, blade } of blades) {
    const a = 0.85 * l.alpha;
    L.fill(blade.outline, jitter(l.pigment, rng, 0.03), a);
    L.fill(deformPolygon(blade.outline, rng, { depth: 1, variance: 0.04 }), jitter(l.pigment, rng, 0.03), a * 0.7);
    L.fill(blade.shadow, shade(l.under, 0.3), a * 0.4);
    if (l.length > 7) {
      const vw = Math.max(0.16, l.width * 0.07);
      L.lift(ribbon(blade.axis.slice(0, 8), (t) => vw * (1 - t * 0.75)), 0.42 * l.alpha);
    }
    len += l.length;
  }
  const mean = len / blades.length;
  L.dry({ opacity: 0.9, edge: 0.3, edgeWidth: Math.max(0.3, Math.min(0.8, mean * 0.025)), sharpness: 0.8, centreLift: 0.08, granulation: 0.08, flow: 0.35, flowScale: Math.max(4, mean * 0.5), ...dry });
}

// ---------------------------------------------------------------------------------------------
// stems

export interface StemMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  seed: number;
  taper?: number;
}

/** Stems in one wet layer, with a broken darker line along one side. */
export function paintStems(p: Painter, stems: readonly StemMark[], o: { opacity?: number; accent?: Pigment; accentOpacity?: number } = {}): void {
  const live = stems.filter((c) => c.pts.length >= 2 && c.width > 0.08);
  if (!live.length) return;
  const maxW = Math.max(...live.map((c) => c.width));
  const area = padRect(bounds(live.flatMap((c) => c.pts)), maxW * 2 + 3);
  const L = p.layer(area);
  for (const c of live) ribbonInto(L, c.pts, c.width, c.pigment, createRng(c.seed), { taper: [0.02, c.taper ?? 0.6], pressure: (t) => 1.1 - t * 0.5 });
  L.dry({ opacity: o.opacity ?? 0.9, edge: 0.5, edgeWidth: Math.max(0.35, maxW * 0.25), sharpness: 0.75, centreLift: 0.18, granulation: 0.14, flow: 0.3, flowScale: 10 });
  if (!o.accent) return;
  const A = p.layer(area);
  let any = false;
  for (const c of live) {
    if (c.pts.length < 4 || c.width < 0.8) continue;
    const r = createRng(c.seed + 1);
    const sp = smoothPath(c.pts, 2);
    const pieces = r.int(2, 3);
    for (let k = 0; k < pieces; k++) {
      const a = Math.floor(sp.length * (k / pieces + r.range(0.02, 0.08)));
      const b = Math.floor(sp.length * ((k + 1) / pieces - r.range(0.05, 0.2)));
      const seg = sp.slice(a, b).map((q) => ({ x: q.x + c.width * 0.3, y: q.y }));
      if (seg.length < 2) continue;
      ribbonInto(A, seg, Math.max(0.25, c.width * 0.36), o.accent, r, { taper: [0.25, 0.35], fills: 1 });
      any = true;
    }
  }
  if (any) A.dry({ opacity: o.accentOpacity ?? 0.4, edge: 0.3, edgeWidth: 0.4, sharpness: 0.8, flowScale: 8 });
  else A.discard();
}

// ---------------------------------------------------------------------------------------------
// pinwheels

export interface Pinwheel {
  at: Pt;
  /** open radius */
  radius: number;
  /** the direction the face's long axis lies in the picture */
  facing: number;
  /** how round the face looks: 1 straight at us, small when side-on */
  squash: number;
  roll: number;
  /** 0 a twisted bud … 1 open */
  open: number;
  /** the direction a bud points */
  budAngle: number;
  /** this flower's petal colour (default: the style's) */
  petal?: Pigment;
  alpha: number;
  seed: number;
}

export interface PinwheelShape {
  petals: Pt[][];
  /** the curled leading edge of each petal, where the paler reverse shows */
  curls: Pt[][];
  throat: Pt[];
  fringe: Pt[][];
  /** deeper rose streaks running from the throat onto each petal */
  streaks: Pt[][];
  bud: Pt[];
  twist: Pt[][];
}

/** Petals, throat and bud of one flower (pure). Petals overlap one way, like a pinwheel. */
export function pinwheelShape(f: Pinwheel): PinwheelShape {
  const o = smooth01(f.open);
  const R = f.radius * (0.3 + 0.7 * o);
  const e1 = { x: Math.cos(f.facing), y: Math.sin(f.facing) };
  const e2 = { x: -e1.y, y: e1.x };
  const sq = f.squash;
  const proj = (u: number, v: number): Pt => ({ x: f.at.x + e1.x * u + e2.x * v * sq, y: f.at.y + e1.y * u + e2.y * v * sq });
  const petals: Pt[][] = [];
  const curls: Pt[][] = [];
  const S = 8;
  for (let k = 0; k < 5; k++) {
    const th = f.roll + (k * Math.PI * 2) / 5;
    const c = Math.cos(th);
    const s = Math.sin(th);
    // petal-local: x out along the radius, y across; the leading side bulges and sweeps round
    const at = (x: number, y: number) => {
      const yy = y + 0.42 * x * x;
      return proj(R * (x * c - yy * s), R * (x * s + yy * c));
    };
    const lead: Pt[] = [];
    const trail: Pt[] = [];
    const curl: Pt[] = [];
    for (let i = 0; i <= S; i++) {
      const x = 0.12 + (0.9 * i) / S;
      // widest near the end, cut off round and oblique like a propeller blade
      const w = Math.sin(Math.PI * Math.min(1, (x - 0.12) / 0.92) ** 0.55) ** 0.6;
      lead.push(at(x, 0.62 * w));
      trail.push(at(x, -0.2 * w));
      curl.push(at(x, 0.62 * w - 0.16 * w));
    }
    petals.push([...lead, ...[...trail].reverse()]);
    curls.push([...lead.slice(2), ...[...curl.slice(2)].reverse()]);
  }
  const tr = R * 0.2;
  const throat = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return proj(Math.cos(a) * tr, Math.sin(a) * tr);
  });
  // the corona: a few forked threads at the mouth of the throat
  const fringe: Pt[][] = [];
  for (let k = 0; k < 5; k++) {
    const th = f.roll + ((k + 0.5) * Math.PI * 2) / 5;
    for (const d of [-0.12, 0.12]) {
      const a = th + d;
      fringe.push([proj(Math.cos(th) * tr * 0.7, Math.sin(th) * tr * 0.7), proj(Math.cos(a) * tr * 1.75, Math.sin(a) * tr * 1.75)]);
    }
  }
  const streaks = Array.from({ length: 5 }, (_, k) => {
    const th = f.roll + (k * Math.PI * 2) / 5 + 0.25;
    return [proj(Math.cos(th) * tr * 0.4, Math.sin(th) * tr * 0.4), proj(Math.cos(th + 0.12) * tr * 2.3, Math.sin(th + 0.12) * tr * 2.3)];
  });
  // the bud: a slender spindle twisted at the tip, pointing along budAngle
  const bl = f.radius * 0.95;
  const bw = f.radius * 0.3;
  const bx = Math.cos(f.budAngle);
  const by = Math.sin(f.budAngle);
  const bp = (t: number, w: number): Pt => ({ x: f.at.x + bx * bl * (t - 0.25) - by * w, y: f.at.y + by * bl * (t - 0.25) + bx * w });
  const B = 10;
  const half = (sg: number) => Array.from({ length: B + 1 }, (_, i) => bp(i / B, sg * bw * Math.sin(Math.PI * (i / B) ** 0.8) ** 0.9));
  const bud = [...half(1), ...half(-1).reverse()];
  const twist = [0.35, 0.6].map((t0) => [bp(t0, -bw * 0.7), bp(t0 + 0.2, 0), bp(t0 + 0.38, bw * 0.55)]);
  return { petals, curls, throat, fringe, streaks, bud, twist };
}

export interface PinwheelStyle {
  petal: Pigment;
  /** the paler reverse: buds, and the curled edge of each petal */
  reverse: Pigment;
  deep: Pigment;
  alpha?: number;
}

/**
 * Flowers over the leaves: buds as twisted pale spindles that fade as the pinwheel opens; petals
 * in two wet layers so neighbours overlap, the reverse lifted along each curl, a deeper throat.
 */
export function paintPinwheels(p: Painter, items: readonly Pinwheel[], o: PinwheelStyle): void {
  const live = items.filter((f) => f.radius > 0.4 && f.alpha > 0.02);
  if (!live.length) return;
  const alpha = o.alpha ?? 1;
  const shapes = live.map((f) => ({ f, s: pinwheelShape(f), r: createRng(f.seed) }));
  const buds = shapes.filter((x) => x.f.open < 0.6);
  if (buds.length) {
    const B = p.layer(padRect(bounds(buds.flatMap((x) => x.s.bud)), 3));
    for (const { f, s, r } of buds) {
      const k = f.alpha * (1 - smooth01(f.open / 0.6));
      B.fill(deformPolygon(s.bud, r, { depth: 1, variance: 0.04 }), jitter(mix(o.reverse, o.petal, 0.3), r, 0.03), 0.75 * k);
      B.fill(s.bud, o.reverse, 0.3 * k);
      for (const tw of s.twist) B.fill(ribbon(tw, (u) => Math.max(0.1, f.radius * 0.045) * (1 - u * 0.6)), o.petal, 0.45 * k);
    }
    B.dry({ opacity: 0.94 * alpha, blend: 'source-over', edge: 0.4, edgeWidth: 0.3, darken: 0.08, sharpness: 0.75, centreLift: 0.12, granulation: 0.04, flow: 0.2, flowScale: 5 });
  }
  const open = shapes.filter((x) => x.f.open > 0.05);
  if (!open.length) return;
  for (const gi of [0, 1]) {
    const set = open.filter((_, i) => i % 2 === gi);
    if (!set.length) continue;
    const L = p.layer(padRect(bounds(set.flatMap((x) => x.s.petals.flat())), 3));
    for (const { f, s, r } of set) {
      const k = f.alpha * smooth01((f.open - 0.05) / 0.45);
      s.petals.forEach((pt, i) => {
        L.fill(deformPolygon(pt, r, { depth: 1, variance: 0.04 }), jitter(f.petal ?? o.petal, r, 0.035), 0.6 * k);
        L.fill(pt, f.petal ?? o.petal, 0.3 * k);
        L.lift(s.curls[i]!, 0.35 * k);
        L.fill(s.curls[i]!, o.reverse, 0.55 * k);
      });
    }
    const mean = set.reduce((a, x) => a + x.f.radius, 0) / set.length;
    L.dry({ opacity: 0.95 * alpha, blend: 'source-over', edge: 0.7, edgeWidth: Math.max(0.3, mean * 0.06), darken: 0.3, sharpness: 0.75, centreLift: 0.1, granulation: 0.04, flow: 0.25, flowScale: 6 });
  }
  const T = p.layer(padRect(bounds(open.flatMap((x) => x.s.throat)), 4));
  for (const { f, s, r } of open) {
    const k = f.alpha * smooth01((f.open - 0.3) / 0.5);
    if (k < 0.02) continue;
    // a pale mouth, deep streaks fanning onto the petals, and the fringe of the corona
    T.fill(deformPolygon(s.throat, r, { depth: 1, variance: 0.06 }), mix(o.reverse, '#fbf4ef', 0.55), 0.85 * k);
    for (const st of s.streaks) T.fill(ribbon(st, (u) => Math.max(0.12, f.radius * 0.05) * (1 - u * 0.8)), o.deep, 0.7 * k);
    if (f.radius > 3) for (const fr of s.fringe) T.fill(ribbon(fr, (u) => Math.max(0.1, f.radius * 0.03) * (1 - u * 0.7)), mix(o.reverse, o.deep, 0.3), 0.6 * k);
  }
  T.dry({ opacity: 0.9 * alpha, blend: 'source-over', edge: 0.4, edgeWidth: 0.3, darken: 0.15, sharpness: 0.8, centreLift: 0.05, flowScale: 4 });
}
