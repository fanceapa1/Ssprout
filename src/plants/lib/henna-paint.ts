/**
 * Painting helpers for henna (docs/systems/plants-species-a.md): slender twigs, small smooth
 * elliptic leaves in opposite pairs over a soft foliage underwash, airy sprays of tiny
 * four-petalled cream florets with pink-flushed buds, and small round seed capsules.
 */
import { createRng } from '../../core/rng';
import { bounds, deformPolygon, jitter, mix, padRect, ribbon, shade, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// twigs

export interface Twig {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  seed: number;
  taper?: number;
}

/** Twigs in one wet layer: tapered ribbons, crisp and a little granular, like bark. */
export function paintTwigs(p: Painter, twigs: readonly Twig[], dry: DryOptions = {}): void {
  const live = twigs.filter((t) => t.pts.length >= 2 && t.width > 0.06);
  if (!live.length) return;
  const maxW = Math.max(...live.map((t) => t.width));
  const L = p.layer(padRect(bounds(live.flatMap((t) => t.pts)), maxW * 2 + 4));
  for (const t of live) ribbonInto(L, t.pts, t.width, t.pigment, createRng(t.seed), { taper: [0.02, t.taper ?? 0.6], pressure: (u) => 1.05 - u * 0.4, fills: t.width > 0.7 ? 2 : 1 });
  L.dry({ opacity: 0.88, edge: 0.45, edgeWidth: Math.max(0.3, maxW * 0.25), sharpness: 0.75, centreLift: 0.15, granulation: 0.2, flow: 0.25, flowScale: 8, ...dry });
}

// ---------------------------------------------------------------------------------------------
// foliage underwash

export interface Mass {
  at: Pt;
  rx: number;
  ry: number;
  rot: number;
  pigment: Pigment;
  alpha: number;
  seed: number;
}

/** An irregular soft ellipse (pure). */
export function massShape(m: Mass): Pt[] {
  const rng = createRng(m.seed);
  const n = 14;
  const c = Math.cos(m.rot);
  const s = Math.sin(m.rot);
  const amp = Array.from({ length: n }, () => rng.range(0.8, 1.12));
  return amp.map((k, i) => {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * m.rx * k;
    const y = Math.sin(a) * m.ry * k;
    return { x: m.at.x + x * c - y * s, y: m.at.y + x * s + y * c };
  });
}

/** The crown's shade masses, wet-in-wet: soft-edged, mottled, so the leaves sit on a body of green. */
export function paintMasses(p: Painter, masses: readonly Mass[], dry: DryOptions = {}): void {
  const live = masses.filter((m) => m.alpha > 0.02 && m.rx > 0.5);
  if (!live.length) return;
  const shapes = live.map((m) => ({ m, poly: massShape(m), rng: createRng(m.seed + 1) }));
  const L = p.layer(padRect(bounds(shapes.flatMap((s) => s.poly)), 4));
  for (const { m, poly, rng } of shapes) {
    L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.12 }), jitter(m.pigment, rng, 0.03), 0.4 * m.alpha);
    L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.1 }), jitter(m.pigment, rng, 0.03), 0.3 * m.alpha);
  }
  L.dry({ opacity: 0.62, edge: 0.06, edgeWidth: 3, sharpness: 0.12, centreLift: 0, granulation: 0.25, flow: 0.6, flowScale: 10, darken: 0.15, ...dry });
}

// ---------------------------------------------------------------------------------------------
// leaves

export interface HennaLeaf {
  at: Pt;
  angle: number;
  length: number;
  width: number;
  /** axis bend, signed fraction of the length */
  curve: number;
  pigment: Pigment;
  /** the olive shade of the half turned from the light */
  under: Pigment;
  alpha: number;
  shade: 1 | -1;
  seed: number;
}

/** Half-width along a smooth elliptic leaf: a tapered base, widest at the middle, a short point. */
function leafProfile(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.5) return Math.sin((t / 0.5) * (Math.PI / 2)) ** 0.7;
  return Math.cos(((t - 0.5) / 0.5) * (Math.PI / 2)) ** 0.85;
}

/** The outline, shaded half and midrib of an entire-margined leaf (pure). */
export function leafBlade(l: Pick<HennaLeaf, 'at' | 'angle' | 'length' | 'width' | 'curve' | 'shade'>): { outline: Pt[]; shadow: Pt[]; axis: Pt[] } {
  const { at, angle, length: L, width: W, curve } = l;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const axisAt = (t: number): Pt => {
    const bend = curve * L * t * t;
    return { x: at.x + ux * L * t + nx * bend, y: at.y + uy * L * t + ny * bend };
  };
  const ts = [0.08, 0.2, 0.34, 0.5, 0.66, 0.8, 0.92];
  const side = (s: 1 | -1) =>
    ts.map((t) => {
      const a = axisAt(t);
      const hw = (W / 2) * leafProfile(t);
      return { x: a.x + nx * hw * s, y: a.y + ny * hw * s };
    });
  const right = side(1);
  const left = side(-1);
  const base = axisAt(0);
  const tip = axisAt(1);
  const axis = [0, 0.25, 0.5, 0.75, 0.95].map(axisAt);
  return {
    outline: [base, ...right, tip, ...[...left].reverse()],
    shadow: [base, ...(l.shade > 0 ? right : left), tip, ...[...axis].reverse()],
    axis,
  };
}

/** Leaves in one wet layer: fresh green blades, the shaded half glazed olive, a faint lifted midrib. */
export function paintLeaves(p: Painter, leaves: readonly HennaLeaf[], dry: DryOptions = {}): void {
  const live = leaves.filter((l) => l.length > 0.4 && l.alpha > 0.02);
  if (!live.length) return;
  const blades = live.map((l) => ({ l, rng: createRng(l.seed), blade: leafBlade(l) }));
  const L = p.layer(padRect(bounds(blades.flatMap((b) => b.blade.outline)), 4));
  let len = 0;
  for (const { l, rng, blade } of blades) {
    const a = 0.7 * l.alpha;
    L.fill(deformPolygon(blade.outline, rng, { depth: 1, variance: 0.05 }), jitter(l.pigment, rng, 0.035), a);
    L.fill(blade.shadow, shade(l.under, 0.15), a * 0.38);
    if (l.length > 5) L.lift(ribbon(blade.axis, (t) => Math.max(0.12, l.width * 0.05) * (1 - t * 0.7)), 0.25 * l.alpha);
    len += l.length;
  }
  const mean = len / blades.length;
  L.dry({ opacity: 0.9, edge: 0.5, edgeWidth: Math.max(0.25, Math.min(0.6, mean * 0.07)), sharpness: 0.72, centreLift: 0.1, granulation: 0.1, flow: 0.3, flowScale: Math.max(4, mean), ...dry });
}

// ---------------------------------------------------------------------------------------------
// florets and capsules

export interface Floret {
  at: Pt;
  /** open radius */
  radius: number;
  rot: number;
  /** 0 a closed bud … 1 four petals spread */
  open: number;
  /** seen from the side: the petals squash along this factor */
  squash: number;
  petal: Pigment;
  bud: Pigment;
  alpha: number;
  seed: number;
}

/** A floret: a round bud, or four small crinkled petals round a tiny centre (pure). */
export function floretShape(f: Floret): { petals: Pt[][]; bud: Pt[]; centre: Pt[] } {
  const rng = createRng(f.seed);
  const r = f.radius;
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  const place = (x: number, y: number): Pt => ({ x: f.at.x + (x * c - y * s), y: f.at.y + (x * s + y * c) * f.squash });
  const budR = r * (0.55 - 0.15 * f.open);
  const bud = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * TAU;
    return place(Math.cos(a) * budR, Math.sin(a) * budR * 0.9);
  });
  const centre = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * TAU;
    return place(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
  });
  const petals: Pt[][] = [];
  if (f.open > 0.02) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + rng.range(-0.2, 0.2);
      const len = r * f.open * rng.range(0.85, 1.1);
      const wid = r * 0.42 * (0.4 + 0.6 * f.open);
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      // a spoon: narrow claw at the centre, a round crinkled limb
      const pts: Pt[] = [];
      for (const [t, w] of [[0.1, 0.15], [0.45, 0.8], [0.75, 1], [1, 0.55]] as const) pts.push(place(ux * len * t - uy * wid * w * 0.5, uy * len * t + ux * wid * w * 0.5));
      for (const [t, w] of [[1, -0.55], [0.75, -1], [0.45, -0.8], [0.1, -0.15]] as const) pts.push(place(ux * len * t - uy * wid * w * 0.5 * rng.range(0.85, 1.1), uy * len * t + ux * wid * w * 0.5 * rng.range(0.85, 1.1)));
      petals.push(pts);
    }
  }
  return { petals, bud, centre };
}

export interface Capsule {
  at: Pt;
  radius: number;
  pigment: Pigment;
  alpha: number;
  seed: number;
}

export function capsuleShape(c: Capsule): Pt[] {
  const rng = createRng(c.seed);
  return Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * TAU;
    const k = rng.range(0.92, 1.06);
    return { x: c.at.x + Math.cos(a) * c.radius * k, y: c.at.y + Math.sin(a) * c.radius * k };
  });
}

export interface SprayStyle {
  /** pollen-gold centre */
  eye: Pigment;
  /** a faint warm edge so cream reads on pale ground */
  rim: Pigment;
}

/** Florets and capsules painted over the foliage (source-over: cream must not multiply into the green). */
export function paintSprays(p: Painter, florets: readonly Floret[], capsules: readonly Capsule[], o: SprayStyle): void {
  const live = florets.filter((f) => f.alpha > 0.02 && f.radius > 0.15);
  const caps = capsules.filter((c) => c.alpha > 0.02 && c.radius > 0.1);
  if (!live.length && !caps.length) return;
  const shapes = live.map((f) => ({ f, s: floretShape(f), rng: createRng(f.seed + 3) }));
  const pts = [...shapes.flatMap(({ s }) => [...s.bud, ...s.petals.flat()]), ...caps.flatMap(capsuleShape)];
  const area = padRect(bounds(pts), 3);
  if (caps.length) {
    const C = p.layer(area);
    for (const c of caps) {
      const poly = capsuleShape(c);
      const r = createRng(c.seed + 1);
      C.fill(poly, jitter(c.pigment, r, 0.03), 0.85 * c.alpha);
      C.lift(capsuleShape({ ...c, at: { x: c.at.x - c.radius * 0.3, y: c.at.y - c.radius * 0.35 }, radius: c.radius * 0.35 }), 0.4 * c.alpha);
    }
    C.dry({ opacity: 0.92, blend: 'source-over', edge: 0.55, edgeWidth: 0.3, darken: 0.35, sharpness: 0.8, centreLift: 0.1, granulation: 0.1, flow: 0.2, flowScale: 3 });
  }
  if (!live.length) return;
  const L = p.layer(area);
  for (const { f, s, rng } of shapes) {
    const budK = 1 - f.open;
    if (budK > 0.05) L.fill(s.bud, jitter(mix(f.bud, f.petal, f.open), rng, 0.03), 0.9 * f.alpha);
    for (const petal of s.petals) L.fill(petal, jitter(f.petal, rng, 0.025), 0.92 * f.alpha * Math.min(1, f.open * 3));
  }
  L.dry({ opacity: 0.96, blend: 'source-over', edge: 0.6, edgeWidth: 0.22, darken: 0.28, sharpness: 0.8, centreLift: 0.05, granulation: 0.03, flow: 0.15, flowScale: 3 });
  const E = p.layer(area);
  let any = false;
  for (const { f, s } of shapes) {
    if (f.open < 0.4) continue;
    E.fill(s.centre, f.open > 0.7 ? o.eye : o.rim, 0.75 * f.alpha);
    any = true;
  }
  if (any) E.dry({ opacity: 0.8, edge: 0.3, edgeWidth: 0.2, sharpness: 0.8, centreLift: 0, granulation: 0, flow: 0.1, flowScale: 2, darken: 0.2 });
  else E.discard();
}
