/**
 * Painting helpers for the Damask rose (docs/systems/plants-species-b.md): small toothed leaflets
 * of compound leaves, prickly arching canes, ruffled cups in rings of petals that dry apart, buds
 * in feathery sepals, and petals fallen on the ground. Each mark carries its own seed.
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
// leaflets

export interface Leaflet {
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

export interface LeafletBlade {
  outline: Pt[];
  shadow: Pt[];
  axis: Pt[];
}

/** Half-width along an ovate leaflet: a rounded base, widest just below the middle, a short point. */
function leafletProfile(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.42) return Math.sin(((t / 0.42) * Math.PI) / 2) ** 0.55;
  return Math.cos((((t - 0.42) / 0.58) * Math.PI) / 2) ** 0.7;
}

/** The outline of a finely toothed leaflet (pure). `rng` jitters the teeth. */
export function leafletBlade(b: Pick<Leaflet, 'at' | 'angle' | 'length' | 'width' | 'curve'>, rng: Rng, shadeSide: 1 | -1): LeafletBlade {
  const { at, angle, length: L, width: W, curve } = b;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const axisAt = (t: number): Pt => {
    const bend = curve * L * t * t;
    return { x: at.x + ux * L * t + nx * bend, y: at.y + uy * L * t + ny * bend };
  };
  const teeth = 6;
  const amps = Array.from({ length: teeth * 2 }, () => rng.range(0.7, 1.2));
  const side = (s: 1 | -1): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i < teeth; i++) {
      const t0 = 0.1 + (i / teeth) * 0.84;
      const t1 = t0 + 0.84 / teeth;
      for (const [t, out] of [
        [t0, -0.05],
        [t0 + (t1 - t0) * 0.75, 0.07 * amps[i * 2 + (s > 0 ? 0 : 1)]!],
      ] as const) {
        const a = axisAt(t);
        const hw = (W / 2) * leafletProfile(t) * (1 + out);
        pts.push({ x: a.x + nx * hw * s, y: a.y + ny * hw * s });
      }
    }
    return pts;
  };
  const right = side(1);
  const left = side(-1);
  const base = axisAt(0);
  const tip = axisAt(1);
  const axis = Array.from({ length: 7 }, (_, i) => axisAt(i / 6));
  return {
    outline: [base, ...right, tip, ...[...left].reverse()],
    shadow: [base, ...(shadeSide > 0 ? right : left), tip, ...[...axis].reverse()],
    axis,
  };
}

/** Leaflets in one wet layer: matte blades, the shaded half flooded grey, a faint lifted midrib. */
export function paintLeaflets(p: Painter, leaves: readonly Leaflet[], dry: DryOptions = {}): void {
  const live = leaves.filter((l) => l.length > 0.5 && l.alpha > 0.02);
  if (!live.length) return;
  const blades = live.map((l) => {
    const rng = createRng(l.seed);
    return { l, rng, blade: leafletBlade(l, rng, l.shade) };
  });
  const L = p.layer(padRect(bounds(blades.flatMap((b) => b.blade.outline)), 4));
  let len = 0;
  for (const { l, rng, blade } of blades) {
    const a = 0.62 * l.alpha;
    L.fill(blade.outline, jitter(l.pigment, rng, 0.035), a);
    L.fill(deformPolygon(blade.outline, rng, { depth: 1, variance: 0.05 }), jitter(l.pigment, rng, 0.03), a * 0.6);
    L.fill(blade.shadow, shade(l.under, 0.2), a * 0.32);
    if (l.length > 6) L.lift(ribbon(blade.axis.slice(0, 6), (t) => Math.max(0.14, l.width * 0.05) * (1 - t * 0.7)), 0.3 * l.alpha);
    len += l.length;
  }
  const mean = len / blades.length;
  L.dry({ opacity: 0.88, edge: 0.45, edgeWidth: Math.max(0.3, Math.min(0.7, mean * 0.06)), sharpness: 0.7, centreLift: 0.12, granulation: 0.12, flow: 0.35, flowScale: Math.max(4, mean * 0.8), ...dry });
}

// ---------------------------------------------------------------------------------------------
// canes

export interface CaneMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  seed: number;
  taper?: number;
  /** the reddish young growth toward the tip: 0 none … 1 the top third flushed */
  flush?: number;
}

export interface Prickle {
  at: Pt;
  angle: number;
  length: number;
  seed: number;
}

export interface CaneStyle {
  opacity?: number;
  accent?: Pigment;
  young?: Pigment;
  prickle?: Pigment;
}

/** Canes in one wet layer, a broken darker underside, the young tips flushed red, and prickles. */
export function paintCanes(p: Painter, canes: readonly CaneMark[], prickles: readonly Prickle[], o: CaneStyle = {}): void {
  const live = canes.filter((c) => c.pts.length >= 2 && c.width > 0.08);
  if (!live.length) return;
  const maxW = Math.max(...live.map((c) => c.width));
  const area = padRect(bounds(live.flatMap((c) => c.pts)), maxW * 2 + 5);
  const L = p.layer(area);
  for (const c of live) ribbonInto(L, c.pts, c.width, c.pigment, createRng(c.seed), { taper: [0.02, c.taper ?? 0.5], pressure: (t) => 1.1 - t * 0.45 });
  L.dry({ opacity: o.opacity ?? 0.9, edge: 0.45, edgeWidth: Math.max(0.35, maxW * 0.22), sharpness: 0.75, centreLift: 0.2, granulation: 0.16, flow: 0.3, flowScale: 10 });
  const A = p.layer(area);
  let any = false;
  for (const c of live) {
    const r = createRng(c.seed + 1);
    const sp = smoothPath(c.pts, 2);
    if (o.young && c.flush && sp.length > 4) {
      const seg = sp.slice(Math.floor(sp.length * 0.62));
      ribbonInto(A, seg, c.width * 0.9, o.young, r, { taper: [0.3, 0.5], fills: 1, coverage: 0.5 * c.flush });
      any = true;
    }
    if (!o.accent || c.pts.length < 4 || c.width < 0.7) continue;
    const pieces = r.int(2, 3);
    for (let k = 0; k < pieces; k++) {
      const a = Math.floor(sp.length * (k / pieces + r.range(0.02, 0.08)));
      const b = Math.floor(sp.length * ((k + 1) / pieces - r.range(0.05, 0.18)));
      const seg = sp.slice(a, b).map((q) => ({ x: q.x, y: q.y + c.width * 0.28 }));
      if (seg.length < 2) continue;
      ribbonInto(A, seg, Math.max(0.25, c.width * 0.36), o.accent, r, { taper: [0.25, 0.35], fills: 1 });
      any = true;
    }
  }
  if (o.prickle) {
    for (const k of prickles) {
      if (k.length < 0.3) continue;
      const r = createRng(k.seed);
      A.fill(prickleShape(k), jitter(o.prickle, r, 0.04), 0.85);
      any = true;
    }
  }
  if (any) A.dry({ opacity: 0.75, edge: 0.35, edgeWidth: 0.35, sharpness: 0.8, flowScale: 8 });
  else A.discard();
}

/** A prickle: a small flat-based hook, curved back toward the cane's foot (pure). */
export function prickleShape(k: Prickle): Pt[] {
  const ux = Math.cos(k.angle);
  const uy = Math.sin(k.angle);
  const nx = -uy;
  const ny = ux;
  const L = k.length;
  const base = L * 0.45;
  const at = (u: number, v: number): Pt => ({ x: k.at.x + ux * u + nx * v, y: k.at.y + uy * u + ny * v });
  return [at(-L * 0.15, -base), at(L * 0.55, -base * 0.2), at(L, base * 0.35), at(L * 0.4, base * 0.25), at(-L * 0.15, base * 0.7)];
}

// ---------------------------------------------------------------------------------------------
// roses

export interface Rose {
  at: Pt;
  /** open radius */
  radius: number;
  /** the direction of the face's long axis in the picture */
  facing: number;
  /** 1 seen straight on … small seen side-on; the +e2 side is the near lip */
  squash: number;
  rot: number;
  /** 0 a bud … 1 open */
  open: number;
  /** semi-double: the heart opens on golden stamens */
  eye: boolean;
  budAngle: number;
  petal: Pigment;
  alpha: number;
  seed: number;
}

export interface RoseShape {
  /** rings of petals from the outer guard petals inward */
  rings: Pt[][][];
  /** the two outer petals of the near side, folded over the cup's lip */
  lip: Pt[][];
  /** short creases where inner petals fold */
  creases: Pt[][];
  heart: Pt[];
  stamens: Pt[];
  bud: Pt[];
  /** the bud's coloured tip, where the petals show between the sepals */
  budTip: Pt[];
  sepals: Pt[][];
}

/**
 * Petals, lip, heart, bud and sepals of one rose (pure). The cup is drawn in flower-local polar
 * coordinates and projected onto an ellipse (`facing`, `squash`); inner rings sit a little toward
 * the far side, so the near lip folds over them.
 */
export function roseShape(f: Rose): RoseShape {
  const r = createRng(f.seed + 17);
  const o = smooth01(f.open);
  const R = f.radius * (0.35 + 0.65 * o);
  const e1 = { x: Math.cos(f.facing), y: Math.sin(f.facing) };
  const e2 = { x: -e1.y, y: e1.x };
  const sq = f.squash;
  const proj = (u: number, v: number, cx = 0, cy = 0): Pt => ({ x: f.at.x + e1.x * (u + cx) + e2.x * (v + cy) * sq, y: f.at.y + e1.y * (u + cx) + e2.y * (v + cy) * sq });
  /** one petal as a fan in polar coordinates, its rim ruffled in shallow scallops */
  const petal = (th: number, r0: number, r1: number, half: number, ruffle: number, phase: number, cy: number): Pt[] => {
    const pts: Pt[] = [];
    const S = 5;
    const T = 9;
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      const rr = r0 + (r1 - r0) * t * 0.92;
      const a = th - half * Math.sin((Math.PI / 2) * Math.min(1, t / 0.8)) ** 0.7;
      pts.push(proj(Math.cos(a) * rr, Math.sin(a) * rr, 0, cy));
    }
    for (let j = 0; j <= T; j++) {
      const u = j / T;
      const a = th - half + 2 * half * u;
      const rr = r1 * (1 - 0.1 * (2 * u - 1) ** 2) * (1 + ruffle * Math.sin(Math.PI * 3 * u + phase));
      pts.push(proj(Math.cos(a) * rr, Math.sin(a) * rr, 0, cy));
    }
    for (let i = S; i >= 0; i--) {
      const t = i / S;
      const rr = r0 + (r1 - r0) * t * 0.92;
      const a = th + half * Math.sin((Math.PI / 2) * Math.min(1, t / 0.8)) ** 0.7;
      pts.push(proj(Math.cos(a) * rr, Math.sin(a) * rr, 0, cy));
    }
    return pts;
  };
  const rings: Pt[][][] = [];
  const creases: Pt[][] = [];
  // outer guard petals, then two rings of ruffled inner petals, smaller in an open-eyed flower
  const spec = [
    { n: 5, r1: 1, half: 0.78, ruf: 0.07, cy: 0 },
    { n: 6, r1: f.eye ? 0.7 : 0.76, half: 0.62, ruf: 0.09, cy: -0.1 },
    { n: 7, r1: f.eye ? 0.46 : 0.54, half: 0.55, ruf: 0.1, cy: -0.17 },
  ];
  spec.forEach((s, k) => {
    const ring: Pt[][] = [];
    const rot = f.rot + k * 0.55;
    for (let i = 0; i < s.n; i++) {
      const th = rot + (i * Math.PI * 2) / s.n + r.range(-0.12, 0.12);
      // a petal of the outer ring on the near side is drawn as the lip instead
      ring.push(petal(th, R * 0.1, R * s.r1 * r.range(0.9, 1.06), s.half * r.range(0.9, 1.1), s.ruf, r.range(0, 6.28), R * s.cy));
      if (k > 0 && i % 2 === k % 2) {
        const cr = R * s.r1 * r.range(0.6, 0.8);
        const a0 = th - s.half * 0.55;
        creases.push(Array.from({ length: 4 }, (_, j) => {
          const a = a0 + (j / 3) * s.half * 1.1;
          return proj(Math.cos(a) * cr, Math.sin(a) * cr * 0.9, 0, R * s.cy);
        }));
      }
    }
    rings.push(ring);
  });
  const lip = [-0.55, 0.5].map((d) => petal(Math.PI / 2 + d + r.range(-0.1, 0.1), R * 0.25, R * r.range(0.98, 1.06), 0.62, 0.06, r.range(0, 6.28), R * 0.04));
  const hr = R * (f.eye ? 0.2 : 0.16);
  const heart = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return proj(Math.cos(a) * hr, Math.sin(a) * hr, 0, -R * 0.2);
  });
  const stamens = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + r.range(-0.2, 0.2);
    const d = hr * r.range(0.4, 1.05);
    return proj(Math.cos(a) * d, Math.sin(a) * d, 0, -R * 0.2);
  });
  // the bud: a plump teardrop along budAngle, held in five sepals whose long tips feather out
  const bl = f.radius * 1.05;
  const bw = f.radius * 0.42;
  const bx = Math.cos(f.budAngle);
  const by = Math.sin(f.budAngle);
  const bp = (t: number, w: number): Pt => ({ x: f.at.x + bx * bl * (t - 0.3) - by * w, y: f.at.y + by * bl * (t - 0.3) + bx * w });
  const B = 10;
  const half = (sg: number) => Array.from({ length: B + 1 }, (_, i) => bp(i / B, sg * bw * Math.sin(Math.PI * (i / B) ** 0.75) ** 0.8));
  const bud = [...half(1), ...half(-1).reverse()];
  const budTip = [...half(1).slice(5), ...half(-1).slice(5).reverse()];
  const sepals: Pt[][] = [];
  const spread = 0.25 + 1.6 * smooth01(f.open / 0.7);
  for (const s of [-1, -0.35, 0.35, 1]) {
    const a0 = f.budAngle + s * spread;
    const len = bl * (s * s > 0.5 ? 1.15 : 0.95) * r.range(0.9, 1.1);
    const base = bp(0.12, s * bw * 0.3);
    const pts: Pt[] = [base];
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const a = a0 + s * 0.35 * t * t * (1 - o) + Math.sign(s) * 0.8 * t * o;
      const prev = pts[pts.length - 1]!;
      pts.push({ x: prev.x + Math.cos(a) * (len / 5), y: prev.y + Math.sin(a) * (len / 5) });
    }
    sepals.push(pts);
  }
  return { rings, lip, creases, heart, stamens, bud, budTip, sepals };
}

export interface RoseStyle {
  /** the clear rose pink of the cup's heart */
  petal: Pigment;
  /** the paler rim of the outer petals */
  pale: Pigment;
  deep: Pigment;
  gold: Pigment;
  sepal: Pigment;
  alpha?: number;
}

/**
 * Buds in feathery sepals, then each cup in rings: pale guard petals, deeper ruffled inner rings
 * dried one by one so their rims keep an edge, creases, a glimpse of gold, and the near lip last.
 */
export function paintRoses(p: Painter, items: readonly Rose[], o: RoseStyle): void {
  const live = items.filter((f) => f.radius > 0.4 && f.alpha > 0.02);
  if (!live.length) return;
  const alpha = o.alpha ?? 1;
  const shapes = live.map((f) => ({ f, s: roseShape(f), r: createRng(f.seed) }));
  const withSepals = shapes.filter((x) => x.f.open < 0.95);
  if (withSepals.length) {
    const B = p.layer(padRect(bounds(withSepals.flatMap((x) => [...x.s.bud, ...x.s.sepals.flat()])), 4));
    for (const { f, s, r } of withSepals) {
      const k = f.alpha * (1 - smooth01(f.open / 0.6));
      if (k > 0.02) {
        B.fill(deformPolygon(s.bud, r, { depth: 1, variance: 0.04 }), jitter(mix(o.petal, o.sepal, 0.2), r, 0.03), 0.75 * k);
        B.fill(s.budTip, mix(o.petal, o.deep, 0.4), 0.7 * k);
      }
      const ks = f.alpha * (1 - smooth01((f.open - 0.6) / 0.35));
      for (const sp of s.sepals) {
        const w = Math.max(0.3, f.radius * 0.17) * ks;
        B.fill(ribbon(sp, (u) => w * (1 - u) ** 1.6 + w * 0.12), o.sepal, 0.75 * ks);
        // the feathery side lobes of the sepal tips
        for (let i = 2; i < sp.length - 1; i++) {
          const a = Math.atan2(sp[i + 1]!.y - sp[i]!.y, sp[i + 1]!.x - sp[i]!.x) + (i % 2 ? 0.9 : -0.9);
          const l = f.radius * 0.22 * ks;
          B.fill(ribbon([sp[i]!, { x: sp[i]!.x + Math.cos(a) * l, y: sp[i]!.y + Math.sin(a) * l }], (u) => w * 0.45 * (1 - u)), o.sepal, 0.55 * ks);
        }
      }
    }
    B.dry({ opacity: 0.92 * alpha, blend: 'source-over', edge: 0.45, edgeWidth: 0.3, darken: 0.1, sharpness: 0.75, centreLift: 0.12, granulation: 0.06, flow: 0.2, flowScale: 5 });
  }
  const open = shapes.filter((x) => x.f.open > 0.05);
  if (!open.length) return;
  const kOf = (f: Rose) => f.alpha * smooth01((f.open - 0.05) / 0.45);
  const ringTone = [mix(o.petal, o.pale, 0.55), mix(o.petal, o.pale, 0.2), o.petal];
  for (const gi of [0, 1]) {
    const set = open.filter((_, i) => i % 2 === gi);
    if (!set.length) continue;
    for (let ring = 0; ring < 3; ring++) {
      const L = p.layer(padRect(bounds(set.flatMap((x) => x.s.rings[ring]!.flat())), 3));
      for (const { f, s, r } of set) {
        const k = kOf(f);
        const tone = mix(ringTone[ring]!, f.petal, 0.5);
        for (const pt of s.rings[ring]!) {
          L.fill(deformPolygon(pt, r, { depth: 1, variance: 0.035 }), jitter(tone, r, 0.03), 0.72 * k);
          L.fill(pt, tone, 0.42 * k);
        }
      }
      const mean = set.reduce((a, x) => a + x.f.radius, 0) / set.length;
      L.dry({ opacity: 0.95 * alpha, blend: 'source-over', edge: 0.65, edgeWidth: Math.max(0.3, mean * 0.05), darken: 0.25, sharpness: 0.75, centreLift: 0.15, granulation: 0.04, flow: 0.2, flowScale: 6 });
    }
  }
  const H = p.layer(padRect(bounds(open.flatMap((x) => [...x.s.heart, ...x.s.creases.flat()])), 4));
  for (const { f, s, r } of open) {
    const k = kOf(f);
    for (const c of s.creases) H.fill(ribbon(c, (u) => Math.max(0.12, f.radius * 0.04) * Math.sin(Math.PI * u)), o.deep, 0.35 * k);
    if (f.eye) {
      const ke = f.alpha * smooth01((f.open - 0.6) / 0.35);
      H.fill(deformPolygon(s.heart, r, { depth: 1, variance: 0.1 }), mix(o.gold, '#f3dc8a', 0.3), 0.75 * ke);
      for (const q of s.stamens) {
        const d = Math.max(0.3, f.radius * 0.06) * (0.5 + 0.5 * ke);
        H.fill([{ x: q.x - d, y: q.y }, { x: q.x, y: q.y - d * 0.8 }, { x: q.x + d, y: q.y }, { x: q.x, y: q.y + d * 0.8 }], shade(o.gold, 0.25), 0.8 * ke);
      }
    } else {
      H.fill(deformPolygon(s.heart, r, { depth: 1, variance: 0.08 }), o.deep, 0.45 * k);
    }
  }
  H.dry({ opacity: 0.9 * alpha, blend: 'source-over', edge: 0.4, edgeWidth: 0.3, darken: 0.15, sharpness: 0.8, centreLift: 0.05, granulation: 0.2, flowScale: 4 });
  const LP = p.layer(padRect(bounds(open.flatMap((x) => x.s.lip.flat())), 3));
  for (const { f, s, r } of open) {
    const k = kOf(f) * smooth01((f.open - 0.2) / 0.5);
    for (const pt of s.lip) {
      LP.fill(deformPolygon(pt, r, { depth: 1, variance: 0.035 }), jitter(mix(o.pale, f.petal, 0.35), r, 0.03), 0.72 * k);
      LP.fill(pt, mix(o.pale, f.petal, 0.2), 0.4 * k);
    }
  }
  LP.dry({ opacity: 0.95 * alpha, blend: 'source-over', edge: 0.6, edgeWidth: 0.4, darken: 0.2, sharpness: 0.75, centreLift: 0.2, granulation: 0.04, flowScale: 6 });
}

// ---------------------------------------------------------------------------------------------
// fallen petals

export interface FallenPetal {
  at: Pt;
  rot: number;
  size: number;
  seed: number;
}

/** A fallen petal: a cupped rounded fan lying flat (pure). */
export function fallenShape(f: FallenPetal): Pt[] {
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  return Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const rx = f.size * (1 + 0.25 * Math.cos(a));
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * f.size * 0.75;
    return { x: f.at.x + x * c - y * s * 0.45, y: f.at.y + x * s * 0.45 + y * 0.45 };
  });
}

export function paintFallen(p: Painter, petals: readonly FallenPetal[], k: number, petal: Pigment, pale: Pigment): void {
  if (k < 0.02 || !petals.length) return;
  const shapes = petals.map((f) => ({ f, s: fallenShape(f), r: createRng(f.seed) }));
  const L = p.layer(padRect(bounds(shapes.flatMap((x) => x.s)), 3));
  for (const { s, r } of shapes) {
    L.fill(deformPolygon(s, r, { depth: 1, variance: 0.06 }), jitter(mix(pale, petal, r.range(0.2, 0.6)), r, 0.04), 0.7 * k);
  }
  L.dry({ opacity: 0.9, blend: 'source-over', edge: 0.6, edgeWidth: 0.35, darken: 0.2, sharpness: 0.75, flowScale: 4 });
}
