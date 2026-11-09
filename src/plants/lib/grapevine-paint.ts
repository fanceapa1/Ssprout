/**
 * Grapevine arbour painting helpers (docs/devlog/133-grapevine.md): the five-lobed toothed vine
 * leaf, the hanging bunches (flower clusters, then berries), the palm-wood frame, tendrils and
 * the shade under the arbour. Pure geometry plus a few wet layers per pass.
 */
import { createRng, type Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { blob, bounds, padRect, ribbon, type Pt } from '../../paint/geometry';
import { mix, shade, type Pigment } from '../../paint/pigments';
import { stroke } from '../../paint/primitives';
import type { DryOptions } from '../../paint/wet';
import { stableLayer, stableTarget } from './tree-paint';
import { clamp01, ramp } from './tree-structure';

/** Light comes from the upper left; this is the screen direction toward the shade. */
const SHADE_DIR = { x: 0.6, y: 0.8 };
const SINUS = 0.3;
const LOBES = [0, 1.2, -1.2, 2.32, -2.32];
const CLEFTS = [0.62, -0.62, 1.8, -1.8];

/** Radius of the blade from the petiole point at polar angle `th` (0 = the tip). */
export function vineLeafRadius(th: number, depth: number, teeth: number): number {
  const a = Math.abs(th);
  const env = (0.74 + 0.26 * Math.cos(th)) * (1 - 0.72 * ramp(a, 2.55, Math.PI - SINUS));
  let cleft = 0;
  for (const c of CLEFTS) cleft += Math.exp(-(((th - c) / 0.2) ** 2));
  const f = (((th / (2 * Math.PI)) * teeth) % 1 + 1) % 1;
  return env * (1 - depth * cleft) * (0.97 + 0.07 * f ** 1.6);
}

/**
 * The blade: five lobes round a petiolar sinus, toothed, foreshortened by `squash` across its
 * axis. `at` is where the petiole meets the blade and `angle` points to the tip.
 */
export function vineLeafOutline(at: Pt, angle: number, length: number, squash: number, depth: number, id: number): Pt[] {
  const r = createRng(id * 53 + 5);
  const teeth = r.int(17, 22);
  const tilt = r.range(-0.12, 0.12);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const out: Pt[] = [];
  const N = 54;
  for (let i = 0; i <= N; i++) {
    const th = -(Math.PI - SINUS) + (2 * (Math.PI - SINUS) * i) / N;
    const rad = length * vineLeafRadius(th + tilt, depth, teeth) * (1 + 0.04 * Math.sin(th * 3 + id));
    const u = Math.cos(th) * rad;
    const v = Math.sin(th) * rad * squash;
    out.push({ x: at.x + c * u - s * v, y: at.y + s * u + c * v });
  }
  return out;
}

export interface VineLeafMark {
  at: Pt;
  angle: number;
  /** petiole point → tip, after growth */
  length: number;
  squash: number;
  depth: number;
  pigment: Pigment;
  alpha: number;
  /** lift pale veins out of it (front leaves big enough to show them) */
  veins: boolean;
  id: number;
}

/** Leaves in two alternating wet layers, so neighbours keep their own edges. */
export function paintVineLeaves(p: Painter, leaves: readonly VineLeafMark[], rng: Rng, dry: DryOptions, layers = 2, res?: number): void {
  const live = leaves.filter((l) => l.length > 0.6 && l.alpha > 0.02);
  if (!live.length) return;
  const maxL = live.reduce((m, l) => Math.max(m, l.length), 1);
  const area = padRect(bounds(live.map((l) => l.at)), maxL * 1.1 + 3);
  const L = Array.from({ length: layers }, (_, i) => stableLayer(p, area, rng.fork(`vine-leaves-${i}-dry`), res));
  live.forEach((l, i) => {
    const W = L[i % layers]!;
    W.fill(vineLeafOutline(l.at, l.angle, l.length, l.squash, l.depth, l.id), l.pigment, l.alpha);
    if (!l.veins || l.length < 6) return;
    const c = Math.cos(l.angle);
    const s = Math.sin(l.angle);
    for (const th of LOBES) {
      const reach = l.length * vineLeafRadius(th, 0, 1) * (Math.abs(th) > 2 ? 0.55 : 0.78);
      const pts = [0.08, 0.5, 1].map((k) => {
        const u = Math.cos(th) * reach * k;
        const v = Math.sin(th) * reach * k * l.squash;
        return { x: l.at.x + c * u - s * v, y: l.at.y + s * u + c * v };
      });
      W.lift(ribbon(pts, (t) => 0.32 * (1 - 0.7 * t) + 0.05), th === 0 ? 0.42 : 0.3);
    }
  });
  for (const W of L) W.dry({ opacity: 0.88, edge: 0.55, edgeWidth: 0.7, sharpness: 0.78, centreLift: 0.28, granulation: 0.12, flow: 0.4, flowScale: 10, darken: 0.3, ...dry });
}

export interface Berry {
  /** offset from the bunch's top, in the bunch's own frame (x across, y down) */
  x: number;
  y: number;
  r: number;
  /** 0 behind … 1 in front (painted last) */
  depth: number;
}

export interface BunchMark {
  /** where the stalk leaves the cane */
  at: Pt;
  /** sideways lean of the hanging axis, radians from straight down */
  lean: number;
  /** 0..1 how far the stalk and cluster have arrived */
  bud: number;
  /** 0..1 the berries swelling */
  swell: number;
  /** 0 green … 1 ripe */
  ripe: number;
  purple: boolean;
  berries: readonly Berry[];
  id: number;
}

export interface GrapePigments {
  bud: Pigment;
  unripe: Pigment;
  purple: Pigment;
  purpleDeep: Pigment;
  bloom: Pigment;
  amber: Pigment;
  amberWarm: Pigment;
  amberDeep: Pigment;
  stalk: Pigment;
}

/**
 * Bunches: the stalk, then berries in two alternating layers (back berries first), a shade
 * crescent on each and a reserved-paper glint. Flower clusters are the same berries, small.
 */
export function paintBunches(p: Painter, bunches: readonly BunchMark[], rng: Rng, pig: GrapePigments): void {
  const live = bunches.filter((b) => b.bud > 0.03);
  if (!live.length) return;
  const area = padRect(bounds(live.map((b) => b.at)), 48);
  const A = stableLayer(p, area, rng.fork('berries-a-dry'));
  const B = stableLayer(p, area, rng.fork('berries-b-dry'));
  const S = stableLayer(p, area, rng.fork('berries-shade-dry'));
  for (const b of live) {
    const r = createRng(b.id * 389 + 13);
    const k = b.bud;
    const c = Math.cos(b.lean);
    const s = Math.sin(b.lean);
    const map = (q: { x: number; y: number }): Pt => ({ x: b.at.x + (q.x * c + q.y * s) * k, y: b.at.y + 3 * k + (-q.x * s + q.y * c) * k });
    S.fill(ribbon([b.at, map({ x: r.range(-1, 1), y: 2 }), map({ x: r.range(-1.5, 1.5), y: 9 })], (t) => 0.5 - 0.15 * t), pig.stalk, 0.8);
    const size = 0.36 + 0.64 * b.swell;
    const ripe = b.purple ? mix(pig.purple, pig.bloom, 0.12) : mix(pig.amber, pig.amberWarm, 0.3);
    const deep = b.purple ? pig.purpleDeep : pig.amberDeep;
    const young = mix(pig.bud, pig.unripe, ramp(b.swell, 0, 0.5));
    const order = b.berries.map((q, i) => ({ q, i })).sort((u, v) => u.q.depth - v.q.depth);
    for (const { q, i } of order) {
      const at = map(q);
      const R = q.r * size * k;
      if (R < 0.35) continue;
      const br = createRng(b.id * 1009 + i * 31 + 1);
      const tone = br.range(-0.12, 0.12) + (1 - q.depth) * 0.25;
      let body = mix(young, ripe, b.ripe);
      if (b.purple) body = mix(body, br.chance(0.5) ? pig.bloom : deep, clamp01(0.18 + tone) * b.ripe);
      else body = mix(body, br.chance(0.4) ? pig.amberWarm : deep, clamp01(0.1 + tone * 0.6) * b.ripe);
      const W = i % 2 === 0 ? A : B;
      W.fill(blob(at.x, at.y, R, R * 1.08, br, { points: 11, irregularity: 0.08, rotation: br.range(0, 3) }), body, b.purple ? 0.72 + 0.2 * b.swell : 0.62 + 0.12 * b.swell);
      if (b.swell > 0.2) {
        const g = { x: at.x - SHADE_DIR.x * R * 0.38, y: at.y - SHADE_DIR.y * R * 0.38 };
        W.lift(blob(g.x, g.y, R * 0.3, R * 0.22, br, { points: 7, irregularity: 0.2, rotation: -0.6 }), (b.purple ? 0.45 : 0.6) * b.swell);
        const phi = Math.atan2(SHADE_DIR.y, SHADE_DIR.x);
        const outer: Pt[] = [];
        const inner: Pt[] = [];
        for (let j = 0; j <= 6; j++) {
          const a = phi - 1.5 + (3 * j) / 6;
          outer.push({ x: at.x + Math.cos(a) * R, y: at.y + Math.sin(a) * R * 1.05 });
          const ri = R * (1 - 0.5 * Math.max(0, Math.cos(a - phi)));
          inner.push({ x: at.x + Math.cos(a) * ri, y: at.y + Math.sin(a) * ri });
        }
        S.fill([...outer, ...inner.reverse()], deep, (0.35 + 0.35 * b.ripe) * b.swell);
      }
    }
  }
  A.dry({ opacity: 0.95, edge: 0.55, edgeWidth: 0.45, sharpness: 0.85, centreLift: 0.22, granulation: 0.2, flow: 0.3, flowScale: 6, darken: 0.3, blend: 'source-over' });
  B.dry({ opacity: 0.95, edge: 0.55, edgeWidth: 0.45, sharpness: 0.85, centreLift: 0.22, granulation: 0.2, flow: 0.3, flowScale: 6, darken: 0.3, blend: 'source-over' });
  S.dry({ opacity: 0.6, edge: 0.15, edgeWidth: 0.5, sharpness: 0.5, centreLift: 0.05, granulation: 0.25, flowScale: 6 });
}

export interface Frame {
  posts: { x: number; base: number; top: number; w: number; back: boolean; lean: number }[];
  /** the lashed crossbars, front and back (left → right) */
  beams: { pts: Pt[]; w: number; back: boolean }[];
  /** palm-rib poles laid across the top, front beam → back beam */
  poles: Pt[][];
  /** lashings where a beam crosses a post */
  knots: Pt[];
}

export interface WoodPigments {
  wood: Pigment;
  dark: Pigment;
  pale: Pigment;
  rope: Pigment;
}

/** The palm-trunk posts with their ring scars, the crossbars, the rib poles and the lashings. */
export function paintFrame(p: Painter, frame: Frame, rng: Rng, pig: WoodPigments, part: 'back' | 'front'): void {
  const back = part === 'back';
  const wood = back ? mix(pig.wood, pig.pale, 0.5) : pig.wood;
  const dark = back ? mix(pig.dark, pig.pale, 0.45) : pig.dark;
  const t = stableTarget(p, rng.fork(`frame-${part}-dry`));
  if (!back && frame.poles.length) {
    const P = stableLayer(p, padRect(bounds(frame.poles.flat()), 4), rng.fork('poles-dry'));
    for (const pole of frame.poles) P.fill(ribbon(pole, (u) => 1.1 - 0.3 * u), mix(pig.wood, pig.pale, 0.3), 0.8);
    P.dry({ opacity: 0.6, edge: 0.4, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.15, granulation: 0.3, flowScale: 8 });
  }
  frame.posts.forEach((post, i) => {
    if (post.back !== back) return;
    const r = rng.fork(`post-${i}`);
    const top = { x: post.x + post.lean * (post.base - post.top), y: post.top };
    const mid = { x: (post.x + top.x) / 2 + r.range(-1, 1), y: (post.base + post.top) / 2 };
    const pts = [{ x: post.x, y: post.base + 1 }, mid, top];
    stroke(t, pts, { rng: r, pigment: wood, width: post.w, taper: [0, 0], wobble: 0.12, wetness: 0.4, opacity: back ? 0.55 : 0.85, granulation: 0.45 });
    stroke(t, pts.map((q) => ({ x: q.x + post.w * 0.28, y: q.y })), { rng: r.fork('flank'), pigment: dark, width: post.w * 0.42, taper: [0.02, 0.02], wobble: 0.12, wetness: 0.5, opacity: back ? 0.3 : 0.5 });
    if (back) return;
    // the ring scars of the old leaf bases
    const L = stableLayer(p, padRect(bounds(pts), post.w + 2), r.fork('rings-dry'));
    for (let y = post.base - r.range(3, 8); y > post.top + 3; y -= r.range(6, 12)) {
      const skip = r.chance(0.3);
      const k = (post.base - y) / (post.base - post.top);
      const x = post.x + post.lean * (post.base - y) + (mid.x - (post.x + top.x) / 2) * Math.sin(Math.PI * k);
      const hw = post.w / 2;
      const sag = r.range(0.6, 1.6);
      const a = r.range(-0.9, -0.2);
      const b = r.range(0.4, 0.95);
      if (skip) continue;
      const ring = [{ x: x + hw * a, y: y - sag * 0.3 }, { x: x + hw * (a + b) * 0.5, y: y + sag * 0.6 }, { x: x + hw * b, y: y - sag * 0.2 }];
      L.fill(ribbon(ring, (u) => 0.5 * Math.sin(Math.PI * u) + 0.08), dark, r.range(0.3, 0.65));
    }
    L.dry({ opacity: 0.7, edge: 0.3, edgeWidth: 0.4, sharpness: 0.8, centreLift: 0.1, granulation: 0.35, flowScale: 8 });
  });
  frame.beams.forEach((beam, i) => {
    if (beam.back !== back) return;
    const r = rng.fork(`beam-${i}`);
    stroke(t, beam.pts, { rng: r, pigment: wood, width: beam.w, taper: [0.03, 0.03], wobble: 0.12, wetness: 0.4, opacity: back ? 0.5 : 0.85, granulation: 0.4 });
    stroke(t, beam.pts.map((q) => ({ x: q.x, y: q.y + beam.w * 0.3 })), { rng: r.fork('under'), pigment: dark, width: beam.w * 0.35, taper: [0.05, 0.05], wobble: 0.12, wetness: 0.5, opacity: back ? 0.2 : 0.35 });
  });
  if (back) return;
  if (!frame.knots.length) return;
  const K = stableLayer(p, padRect(bounds(frame.knots), 8), rng.fork('knots-dry'));
  const lash = (u: number) => 0.45 * Math.sin(Math.PI * u) + 0.1;
  for (const k of frame.knots) {
    for (let j = 0; j < 3; j++) {
      const dy = (j - 1) * 2;
      K.fill(ribbon([{ x: k.x - 4.5, y: k.y - 3 + dy }, { x: k.x, y: k.y - 0.2 + dy }, { x: k.x + 4.5, y: k.y + 2 + dy }], lash), pig.rope, 0.8);
    }
    K.fill(ribbon([{ x: k.x - 4, y: k.y + 3 }, { x: k.x, y: k.y - 0.2 }, { x: k.x + 4, y: k.y - 3.5 }], lash), shade(pig.rope, 0.3), 0.65);
  }
  K.dry({ opacity: 0.85, edge: 0.4, edgeWidth: 0.4, sharpness: 0.85, centreLift: 0.1, granulation: 0.2, flowScale: 6 });
}

/** A tendril: a fine shoot that reaches out and coils at its end. */
export function tendrilPath(at: Pt, heading: number, length: number, turn: number): Pt[] {
  const pts: Pt[] = [at];
  let h = heading;
  let q = at;
  const n = 22;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const step = (length / n) * (1 - 0.55 * t);
    h += turn * (0.05 + 0.9 * t ** 2);
    q = { x: q.x + Math.cos(h) * step, y: q.y + Math.sin(h) * step };
    pts.push(q);
  }
  return pts;
}

export function paintTendrils(p: Painter, tendrils: readonly { pts: Pt[]; id: number }[], rng: Rng, pigment: Pigment, amount: (id: number) => number): void {
  const live = tendrils.map((td) => ({ td, k: amount(td.id) })).filter((x) => x.k > 0.03);
  if (!live.length) return;
  const L = stableLayer(p, padRect(bounds(live.flatMap((x) => x.td.pts)), 3), rng.fork('tendrils-dry'));
  for (const { td, k } of live) {
    const n = Math.max(2, Math.round(td.pts.length * k));
    L.fill(ribbon(td.pts.slice(0, n), (t) => 0.34 * (1 - 0.65 * t) + 0.05), pigment, 0.7 * Math.min(1, k * 2));
  }
  L.dry({ opacity: 0.8, edge: 0.45, edgeWidth: 0.3, sharpness: 0.9, centreLift: 0.05, granulation: 0.1, flowScale: 6 });
}

/**
 * The cool shade under the roof, darkest under the leaves and fading toward the ground with a
 * ragged edge, and the dappled pool on the ground with flecks of light lifted out of it.
 */
export function paintArbourShade(
  p: Painter,
  box: { x0: number; x1: number; top: number; floor: number },
  rng: Rng,
  pigment: Pigment,
  amount: number,
  flecks: readonly { x: number; y: number; r: number }[],
  res?: number,
): void {
  if (amount <= 0.02) return;
  const { x0, x1, top, floor } = box;
  const L = stableLayer(p, padRect({ x: x0, y: top, w: x1 - x0, h: floor - top }, 16), rng.fork('arbour-shade-dry'), res);
  const r = rng.fork('arbour-shade');
  // dapples of leaf shade, thick under the roof and thinning toward the ground
  const H = floor - top;
  for (let i = 0; i < 30; i++) {
    const v = r.range(0, 1) ** 1.8;
    const x = r.range(x0 + 4, x1 - 4);
    const y = top + 2 + v * H * 0.5;
    const rx = r.range(9, 20) * (1 - 0.4 * v);
    L.fill(blob(x, y, rx, rx * r.range(0.45, 0.7), r, { points: 12, irregularity: 0.3, scallop: 0.4, scallops: r.int(4, 6), rotation: r.range(-0.3, 0.3) }), pigment, 0.15 * (1 - 0.6 * v) * amount);
  }
  const cx = (x0 + x1) / 2;
  for (let i = 0; i < 3; i++) {
    const k = 1 - i * 0.22;
    L.fill(blob(cx + 6, floor - 1, (x1 - x0) * 0.62 * k, 7.5 * k, r, { points: 20, irregularity: 0.15, rotation: 0 }), pigment, 0.09 * amount);
  }
  for (const f of flecks) L.lift(blob(f.x, f.y, f.r, f.r * 0.35, r, { points: 9, irregularity: 0.3, rotation: r.range(-0.2, 0.2) }), 0.6);
  L.dry({ opacity: 0.8, edge: 0.1, edgeWidth: 2, sharpness: 0.2, centreLift: 0.05, granulation: 0.3, flow: 0.55, flowScale: 18 });
}
