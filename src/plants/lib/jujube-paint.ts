/**
 * Painting helpers for the wild jujube (docs/devlog/135-jujube.md): pale zigzag stems in dry
 * brush, paired thorns at the nodes, small glossy oval leaves, tiny green-gold flowers, round
 * glossy fruit with a reserved highlight, and the drift of sand caught in the shrub's foot.
 */
import { createRng } from '../../core/rng';
import { blob, bounds, jitter, mix, padRect, ribbon, shade, smoothPath, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbonInto } from './shrub-paint';

/** Light comes from the upper left; this is the screen direction toward the shade. */
const SHADE_DIR = { x: 0.6, y: 0.8 };

const local = (at: Pt, angle: number) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return (u: number, v: number): Pt => ({ x: at.x + c * u - s * v, y: at.y + s * u + c * v });
};

// ---------------------------------------------------------------------------------------------
// stems and thorns

export interface StemMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  seed: number;
}

export interface Thorn {
  at: Pt;
  angle: number;
  length: number;
  /** the short hooked one of the pair, curved back toward the stem's foot */
  hooked: boolean;
  seed: number;
}

/** A thorn: a slim straight spine, or a short hook bent back (pure). */
export function thornShape(t: Thorn): Pt[] {
  const P = local(t.at, t.angle);
  const L = t.length;
  const b = Math.max(0.28, L * (t.hooked ? 0.3 : 0.14));
  if (!t.hooked) return [P(0, -b), P(L * 0.55, -b * 0.35), P(L, 0), P(L * 0.55, b * 0.3), P(0, b)];
  return [P(0, -b), P(L * 0.6, -b * 0.6), P(L, -b * 1.6), P(L * 0.75, -b * 0.15), P(L * 0.2, b), P(0, b)];
}

export interface StemStyle {
  opacity?: number;
  accent?: Pigment;
  thorn?: Pigment;
}

/** Stems in one dry-brush layer, then a broken dark underside and the thorns in a second. */
export function paintStems(p: Painter, stems: readonly StemMark[], thorns: readonly Thorn[], o: StemStyle = {}): void {
  const live = stems.filter((s) => s.pts.length >= 2 && s.width > 0.1);
  if (!live.length) return;
  const maxW = Math.max(...live.map((s) => s.width));
  const area = padRect(bounds(live.flatMap((s) => s.pts)), maxW * 2 + 7);
  const L = p.layer(area);
  for (const s of live) ribbonInto(L, s.pts, s.width, s.pigment, createRng(s.seed), { taper: [0.02, 0.35], endWidth: 0.25, fills: 1, coverage: 0.85, pressure: (t) => 1.08 - t * 0.4 });
  L.dry({ opacity: o.opacity ?? 0.9, edge: 0.28, edgeWidth: Math.max(0.3, maxW * 0.18), sharpness: 0.7, centreLift: 0.2, granulation: 0.3, flow: 0.3, flowScale: 8, dry: 0.18, darken: 0.12 });
  const A = p.layer(area);
  let any = false;
  if (o.accent) {
    for (const s of live) {
      if (s.width < 0.75 || s.pts.length < 3) continue;
      const r = createRng(s.seed + 1);
      const sp = smoothPath(s.pts, 1.5);
      const a = Math.floor(sp.length * r.range(0.05, 0.3));
      const b = Math.floor(sp.length * r.range(0.55, 0.9));
      const seg = sp.slice(a, b).map((q) => ({ x: q.x + s.width * 0.18, y: q.y + s.width * 0.3 }));
      if (seg.length < 2) continue;
      ribbonInto(A, seg, Math.max(0.25, s.width * 0.34), o.accent, r, { taper: [0.3, 0.4], fills: 1, coverage: 0.7 });
      any = true;
    }
  }
  if (o.thorn) {
    for (const t of thorns) {
      if (t.length < 0.3) continue;
      A.fill(thornShape(t), jitter(o.thorn, createRng(t.seed), 0.05), 0.9);
      any = true;
    }
  }
  if (any) A.dry({ opacity: 0.7, edge: 0.35, edgeWidth: 0.3, sharpness: 0.85, centreLift: 0.05, granulation: 0.1, flowScale: 6 });
  else A.discard();
}

// ---------------------------------------------------------------------------------------------
// leaves

export interface JujubeLeaf {
  at: Pt;
  angle: number;
  length: number;
  width: number;
  pigment: Pigment;
  alpha: number;
  seed: number;
}

/** A small oval leaf with a rounded tip, a touch asymmetric at the base (pure). */
export function leafOval(l: Pick<JujubeLeaf, 'at' | 'angle' | 'length' | 'width'>): Pt[] {
  const P = local(l.at, l.angle);
  const out: Pt[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(P(l.length * (0.06 + 0.94 * t), (l.width / 2) * Math.sin(Math.PI * t) ** 0.75 * (1.06 - 0.12 * t)));
  }
  for (let i = n - 1; i >= 1; i--) {
    const t = i / n;
    out.push(P(l.length * (0.06 + 0.94 * t), (-l.width / 2) * Math.sin(Math.PI * t) ** 0.75 * (0.96 - 0.1 * t)));
  }
  out.push(P(0, 0));
  return out;
}

/** Leaves in one wet layer: a glossy blade, its shaded half deepened, a reserved gleam. */
export function paintLeaves(p: Painter, leaves: readonly JujubeLeaf[], dry: DryOptions = {}): void {
  const live = leaves.filter((l) => l.length > 0.5 && l.alpha > 0.02);
  if (!live.length) return;
  const outlines = live.map((l) => leafOval(l));
  const L = p.layer(padRect(bounds(outlines.flat()), 4));
  live.forEach((l, i) => {
    const r = createRng(l.seed);
    const out = outlines[i]!;
    L.fill(out, jitter(l.pigment, r, 0.04), 0.9 * l.alpha);
    const P = local(l.at, l.angle);
    const sd = -Math.sin(l.angle) * SHADE_DIR.x + Math.cos(l.angle) * SHADE_DIR.y >= 0 ? 1 : -1;
    const hw = l.width / 2;
    L.fill([P(l.length * 0.1, 0), P(l.length * 0.35, sd * hw * 0.85), P(l.length * 0.7, sd * hw * 0.8), P(l.length * 0.98, 0)], shade(l.pigment, 0.3), 0.3 * l.alpha);
    if (l.length > 3.5) L.lift([P(l.length * 0.22, -sd * hw * 0.15), P(l.length * 0.42, -sd * hw * 0.62), P(l.length * 0.66, -sd * hw * 0.5), P(l.length * 0.5, -sd * hw * 0.12)], 0.55 * l.alpha);
  });
  const mean = live.reduce((s, l) => s + l.length, 0) / live.length;
  L.dry({ opacity: 0.92, edge: 0.35, edgeWidth: Math.max(0.3, Math.min(0.5, mean * 0.07)), sharpness: 0.75, centreLift: 0.06, granulation: 0.1, flow: 0.3, flowScale: 6, ...dry });
}

// ---------------------------------------------------------------------------------------------
// flowers and fruit

export interface Floret {
  at: Pt;
  radius: number;
  rot: number;
  alpha: number;
  seed: number;
}

/** A tiny five-pointed star of green-gold sepals (pure). */
export function floretShape(f: Pick<Floret, 'at' | 'radius' | 'rot'>): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = f.rot + (i * Math.PI) / 5;
    const r = f.radius * (i % 2 ? 0.42 : 1);
    out.push({ x: f.at.x + Math.cos(a) * r, y: f.at.y + Math.sin(a) * r * 0.85 });
  }
  return out;
}

export function paintFlorets(p: Painter, florets: readonly Floret[], petal: Pigment, eye: Pigment): void {
  const live = florets.filter((f) => f.radius > 0.2 && f.alpha > 0.02);
  if (!live.length) return;
  const L = p.layer(padRect(bounds(live.map((f) => f.at)), 6));
  for (const f of live) {
    const r = createRng(f.seed);
    L.fill(floretShape(f), jitter(petal, r, 0.04), 0.85 * f.alpha);
    L.fill(blob(f.at.x, f.at.y, f.radius * 0.36, f.radius * 0.3, r, { points: 7, irregularity: 0.15 }), eye, 0.7 * f.alpha);
  }
  L.dry({ opacity: 0.92, edge: 0.4, edgeWidth: 0.3, sharpness: 0.8, centreLift: 0.1, granulation: 0.1, flowScale: 5 });
}

export interface Fruit {
  at: Pt;
  radius: number;
  /** 0 yellow-green … 1 deep rust-red */
  ripe: number;
  /** stalk foot: the node it hangs from */
  from: Pt;
  alpha: number;
  seed: number;
}

export interface FruitPigments {
  green: Pigment;
  gold: Pigment;
  orange: Pigment;
  red: Pigment;
  rust: Pigment;
  stalk: Pigment;
}

/** The skin colour along ripening. */
export function skinOf(ripe: number, pig: FruitPigments): Pigment {
  const stops = [pig.green, pig.gold, pig.orange, pig.red, pig.rust];
  const x = Math.max(0, Math.min(0.9999, ripe)) * (stops.length - 1);
  const i = Math.floor(x);
  return mix(stops[i]!, stops[i + 1]!, x - i);
}

/** The fruit's outline: nearly round, a little longer than wide (pure). */
export function fruitOutline(f: Pick<Fruit, 'at' | 'radius' | 'seed'>): Pt[] {
  return blob(f.at.x, f.at.y, f.radius * 0.96, f.radius * 1.04, createRng(f.seed), { points: 16, irregularity: 0.05 });
}

/** Fruit: stalks, a glossy body with the highlight left as paper, then the shade crescent. */
export function paintFruits(p: Painter, fruits: readonly Fruit[], pig: FruitPigments): void {
  const live = fruits.filter((f) => f.radius > 0.25 && f.alpha > 0.02);
  if (!live.length) return;
  const area = padRect(bounds(live.flatMap((f) => [f.at, f.from])), 8);
  const G = p.layer(area);
  const S = p.layer(area);
  for (const f of live) {
    const r = createRng(f.seed);
    const R = f.radius;
    const skin = jitter(skinOf(f.ripe, pig), r, 0.03);
    const dx = f.at.x - f.from.x;
    const dy = f.at.y - f.from.y;
    const d = Math.hypot(dx, dy);
    if (d > R * 0.9 + 0.3) {
      const end = { x: f.at.x - (dx / d) * R * 0.85, y: f.at.y - (dy / d) * R * 0.85 };
      G.fill(ribbon([f.from, { x: (f.from.x + end.x) / 2, y: (f.from.y + end.y) / 2 }, end], () => Math.max(0.22, R * 0.11)), pig.stalk, 0.8 * f.alpha);
    }
    G.fill(fruitOutline(f), skin, 0.92 * f.alpha);
    // the gleam on the lit shoulder stays paper
    const gx = f.at.x - SHADE_DIR.x * R * 0.42;
    const gy = f.at.y - SHADE_DIR.y * R * 0.42;
    G.lift(blob(gx, gy, R * 0.3, R * 0.2, r, { points: 8, irregularity: 0.2, rotation: -0.7 }), 0.95 * f.alpha);
    const phi = Math.atan2(SHADE_DIR.y, SHADE_DIR.x);
    const outer: Pt[] = [];
    const inner: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = phi - 1.6 + (3.2 * i) / 8;
      outer.push({ x: f.at.x + Math.cos(a) * R * 0.97, y: f.at.y + Math.sin(a) * R });
      const ri = R * (1 - 0.48 * Math.max(0, Math.cos(a - phi)));
      inner.push({ x: f.at.x + Math.cos(a) * ri, y: f.at.y + Math.sin(a) * ri });
    }
    S.fill([...outer, ...inner.reverse()], shade(skin, 0.45), (0.45 + 0.25 * f.ripe) * f.alpha);
  }
  G.dry({ opacity: 0.96, edge: 0.6, edgeWidth: 0.45, sharpness: 0.9, centreLift: 0.18, granulation: 0.1, flow: 0.25, flowScale: 5, darken: 0.35, blend: 'source-over' });
  S.dry({ opacity: 0.62, edge: 0.2, edgeWidth: 0.5, sharpness: 0.5, centreLift: 0.05, granulation: 0.2, flowScale: 5 });
}

// ---------------------------------------------------------------------------------------------
// the sand caught at the foot

/** The low drift of sand (a little nebkha) round the shrub's foot (pure). */
export function driftShape(foot: number, half: number, height: number, skew: number): Pt[] {
  const out: Pt[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 - 1;
    const x = foot + t * half;
    const y = -height * (1 - t * t) ** 1.4 * (1 + skew * t);
    out.push({ x, y });
  }
  out.push({ x: foot + half * 0.6, y: 2 }, { x: foot - half * 0.6, y: 2 });
  return out;
}

export function paintDrift(p: Painter, seed: number, shape: Pt[], foot: number, half: number, k: number, sand: Pigment): void {
  if (k < 0.02) return;
  const r = createRng(seed);
  p.wash(shape, sand, { rng: r, opacity: 0.32 * k, edge: 0.12, sharpness: 0.3, layers: 6, fade: { angle: Math.PI / 2, start: 0.35, amount: 0.9 } });
  // the drift's shaded flank, away from the light
  const shadeSide = shape.filter((q) => q.x > foot + half * 0.05);
  p.glaze([...shadeSide, { x: foot + half * 0.05, y: 3 }], shade(sand, 0.4), { rng: r, opacity: 0.18 * k, edge: 0.1, layers: 5, sharpness: 0.25, fade: { angle: Math.PI / 2, start: 0.4, amount: 0.85 } });
}

/** The grey of the fine twigs massed inside the mound: a faint broken wash behind the stems. */
export function paintHaze(p: Painter, seed: number, outline: Pt[], k: number, grey: Pigment): void {
  if (k < 0.02 || outline.length < 3) return;
  const r = createRng(seed);
  p.glaze(outline, grey, { rng: r, opacity: 0.2 * k, edge: 0.1, layers: 6, sharpness: 0.25, fade: { angle: -Math.PI / 2, start: 0.3, amount: 0.75 } });
}
