/**
 * Painting helpers for the iwatabako (rock tobacco, docs/systems/plants-species-a.md): a
 * puckered, toothed, glossy leaf and a small five-pointed star floret. Copied in spirit from
 * `small-paint.ts` (`toothedLeaf`, `smallBlossom`) so the shared helpers stay untouched.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, dabProfile, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth } from './small-growth';
import { dabAxis, shadowSide } from './small-paint';
import { petalPose, type FlowerView, type PetalPlan } from './small-structure';

const halfWidth = (width: number, t: number): number => dabProfile('round', t) * width;

export interface PuckerStyle {
  pigment: Pigment;
  /** sunken veins and midrib */
  deep: Pigment;
  /** the wet light caught on each bulge between the veins */
  gloss: Pigment;
  veins?: number;
  teeth?: number;
  opacity?: number;
  /** 0..1, how far the gloss and veins have come in (a young leaf is smooth and matt) */
  detail?: number;
}

/**
 * A bullate leaf: an oval tongue with a serrate margin, sunken midrib and lateral veins in one
 * wet layer, then broken source-over lights on the bulges between the veins (mostly lit flank).
 */
export function puckeredLeaf(
  p: Painter,
  rng: Rng,
  at: Pt,
  pose: { angle: number; length: number; width: number; curve?: number },
  s: PuckerStyle,
): void {
  if (pose.length < 0.4 || pose.width < 0.2) return;
  // replay the blade dab's own jitter (dabShape's draws) so the teeth sit on its real margin
  const probe = rng.fork('blade');
  const length = pose.length * probe.range(0.92, 1.08);
  const width = pose.width * probe.range(0.9, 1.1);
  const angle = pose.angle + probe.gaussian(0, 0.04);
  const curve = (pose.curve ?? 0) + probe.gaussian(0, 0.04);
  const detail = clamp01(s.detail ?? 1);
  const r = length * 1.15 + width;
  const L = p.layer({ x: at.x - r, y: at.y - r, w: r * 2, h: r * 2 });
  const side = shadowSide(angle);
  p.dabInto(L, at, s.pigment, { rng: rng.fork('blade'), variant: 'round', angle: pose.angle, length: pose.length, width: pose.width, curve: pose.curve ?? 0, asym: 0, pool: 0.55, poolSide: side, basePool: 0.45, layers: 4 });
  const N = 30;
  const axis = dabAxis(at, angle, length, curve, N);
  const dirAt = (t: number) => {
    const i = Math.min(N - 1, Math.round(t * N));
    return Math.atan2(axis[i + 1]!.y - axis[i]!.y, axis[i + 1]!.x - axis[i]!.x);
  };
  const nT = s.teeth ?? 11;
  for (let i = 0; i < nT; i++) {
    const t = 0.1 + (0.84 * (i + 0.5)) / nT;
    const q = axis[Math.round(t * N)]!;
    const ta = dirAt(t);
    const hw = halfWidth(width, t);
    for (const sgn of [-1, 1]) {
      const tr = rng.fork(`tj-${i}-${sgn}`);
      const tl = Math.min(length * 0.08, width * 0.12) * (1 - t * 0.3) * tr.range(0.55, 1.35);
      const nx = -Math.sin(ta) * sgn;
      const ny = Math.cos(ta) * sgn;
      // a sharp forward-pointing tooth riding the margin
      p.dabInto(L, { x: q.x + nx * (hw - tl * 0.45), y: q.y + ny * (hw - tl * 0.45) }, s.pigment, {
        rng: rng.fork(`t-${i}-${sgn}`),
        variant: 'leaf',
        angle: ta + sgn * tr.range(0.35, 0.65),
        length: tl,
        width: tl * 0.5,
        asym: 0,
        pool: 0,
        basePool: 0,
        layers: 2,
      });
    }
  }
  p.dabInto(L, at, s.pigment, { rng: rng.fork('wedge'), variant: 'leaf', angle, length: length * 0.4, width: width * 0.62, curve, asym: 0, pool: 0, basePool: 0.5, layers: 2 });
  p.dabInto(L, at, s.deep, { rng: rng.fork('mid'), variant: 'blade', angle, length: length * 0.88, width: width * 0.07, curve, pool: 0, basePool: 0.35, layers: 2 });
  const nV = s.veins ?? 6;
  const veins: number[] = [];
  for (let i = 0; i < nV; i++) {
    const vr = rng.fork(`vj-${i}`);
    const t = 0.08 + (0.76 * (i + 0.4 + vr.range(-0.15, 0.15))) / nV;
    const q = axis[Math.round(t * N)]!;
    const ta = dirAt(t);
    const hw = halfWidth(width, t);
    for (const sgn of [-1, 1]) {
      p.dabInto(L, q, s.deep, { rng: rng.fork(`v-${i}-${sgn}`), variant: 'blade', angle: ta + sgn * vr.range(0.85, 1.1), length: hw * vr.range(0.9, 1.04), width: Math.max(0.3, width * 0.036), curve: -sgn * 0.22, pool: 0, basePool: 0.25, layers: 2 });
    }
    veins.push(t);
  }
  L.dry({
    opacity: (s.opacity ?? 0.9) * smooth(length / 3),
    edge: 0.65,
    edgeWidth: Math.max(0.25, Math.min(2, width * 0.06)),
    sharpness: 0.74,
    centreLift: 0.18,
    granulation: 0.14,
    flow: 0.45,
    flowScale: Math.max(3, length * 0.45),
    darken: 0.36,
  });
  if (detail < 0.02 || length < 4) return;
  // the bulges between the veins catch the wet light: a quilted, glossy surface
  const G = p.layer({ x: at.x - r, y: at.y - r, w: r * 2, h: r * 2 });
  const gap = (0.76 / nV) * length;
  veins.forEach((t0, i) => {
    const t = t0 + 0.38 / nV;
    const q = axis[Math.min(N, Math.round(t * N))]!;
    const ta = dirAt(Math.min(0.96, t));
    const hw = halfWidth(width, t);
    for (const sgn of [-1, 1]) {
      const g = rng.fork(`g-${i}-${sgn}`);
      const lit = sgn === -side;
      const keep = g.next();
      if (!lit && keep < 0.55) continue;
      const nx = -Math.sin(ta) * sgn;
      const ny = Math.cos(ta) * sgn;
      const off = hw * g.range(0.3, 0.55);
      p.dabInto(G, { x: q.x + nx * off, y: q.y + ny * off }, s.gloss, {
        rng: g,
        variant: 'leaf',
        angle: ta + sgn * g.range(0.8, 1.2),
        length: hw * (lit ? g.range(0.32, 0.55) : g.range(0.2, 0.3)),
        width: gap * g.range(0.18, 0.36),
        curve: g.gaussian(0, 0.25),
        pool: 0,
        basePool: 0,
        layers: 2,
      });
    }
  });
  // one long wet sheen down the lit half, what reads as gloss from afar
  const sn = { x: -Math.sin(angle) * -side, y: Math.cos(angle) * -side };
  for (const [k, t0, len] of [[0, 0.14, 0.3], [1, 0.5, 0.26]] as const) {
    const sa = axis[Math.round(t0 * N)]!;
    const off = width * (0.2 + t0 * 0.08);
    p.dabInto(G, { x: sa.x + sn.x * off, y: sa.y + sn.y * off }, s.gloss, { rng: rng.fork(`sheen-${k}`), variant: 'blade', angle: dirAt(t0) + side * 0.08, length: length * len, width: width * 0.11, curve: -side * 0.15, pool: 0, basePool: 0, layers: 2 });
  }
  G.dry({ opacity: 0.34 * detail, edge: 0.1, edgeWidth: 0.3, sharpness: 0.35, centreLift: 0, granulation: 0.1, flow: 0.4, flowScale: 3, darken: 0.03, blend: 'source-over' });
}

export interface StarFloret {
  petals: readonly PetalPlan[];
  view: FlowerView;
  /** 0 = closed bud … 1 = open star */
  open: number;
  /** bud swelling 0..1 */
  bud: number;
  /** petal length at full opening */
  size: number;
  /** direction the closed bud points (its pedicel's) */
  budAngle: number;
  /** 0 = green bud … 1 = bloom colour */
  colour: number;
  pigment: Pigment;
  pale: Pigment;
  inner: Pigment;
  green: Pigment;
}

/**
 * A tiny five-pointed star in one wet layer: a round bud that colours as it swells, then five
 * pointed petals swinging open out of it while the bud body shrinks into the centre.
 */
export function starFloret(p: Painter, rng: Rng, c: Pt, f: StarFloret): void {
  const bud = clamp01(f.bud);
  if (bud < 0.02 || f.size < 0.3) return;
  const open = clamp01(f.open);
  const r = f.size * 1.6 + 1;
  const L = p.layer({ x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 });
  const body = mix(f.green, f.pigment, clamp01(f.colour));
  const bl = f.size * 0.62 * lerp(0.3, 1, bud) * (1 - 0.75 * smooth(open));
  if (bl > 0.15) {
    p.dabInto(L, c, body, { rng: rng.fork('bud'), variant: 'round', angle: f.budAngle, length: bl, width: bl * 0.78, pool: 0.35, basePool: 0.3, layers: 3 });
  }
  if (open > 0.01) {
    f.petals.forEach((pl, i) => {
      const pose = petalPose(pl.a, f.view, open, 0.35);
      const length = f.size * pl.len * lerp(0.35, 1, pose.len) * lerp(0.4, 1, open);
      const width = f.size * 0.52 * pl.wid * lerp(0.5, 1, open) * lerp(0.7, 1, pose.len);
      const tone = mix(f.pigment, pl.tone > 0.5 ? f.pale : f.pigment, Math.abs(pl.tone - 0.5) * 1.4);
      p.dabInto(L, c, tone, { rng: rng.fork(`p-${i}`), variant: 'leaf', angle: pose.angle, length, width, curve: pl.curve, pool: 0.3, poolSide: shadowSide(pose.angle), basePool: 0.2, layers: 3 });
      p.dabInto(L, c, f.inner, { rng: rng.fork(`i-${i}`), variant: 'leaf', angle: pose.angle, length: length * 0.38, width: width * 0.5, pool: 0, basePool: 0.45, layers: 2 });
    });
  }
  L.dry({
    opacity: 0.9 * smooth(bud * 2.5),
    edge: 0.5,
    edgeWidth: Math.max(0.2, f.size * 0.07),
    sharpness: 0.72,
    centreLift: 0.22,
    granulation: 0.05,
    flow: 0.3,
    flowScale: Math.max(2, f.size),
    darken: 0.3,
  });
}

/** The yellow anther cones of an umbel, batched into one opaque layer. */
export function antherCones(p: Painter, rng: Rng, cones: { id: number; c: Pt; size: number; open: number; roll: number; tilt: number }[]): void {
  const live = cones.filter((k) => k.open > 0.02);
  if (!live.length) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const k of live) {
    x0 = Math.min(x0, k.c.x - k.size);
    y0 = Math.min(y0, k.c.y - k.size);
    x1 = Math.max(x1, k.c.x + k.size);
    y1 = Math.max(y1, k.c.y + k.size);
  }
  const L = p.layer({ x: x0 - 1, y: y0 - 1, w: x1 - x0 + 2, h: y1 - y0 + 2 });
  live.forEach((k) => {
    const o = smooth(clamp01((k.open - 0.25) / 0.6));
    const s = k.size * 0.36 * o;
    if (s < 0.08) return;
    // the cone stands out of the face, so it leans toward where the face points
    const lean = (1 - k.tilt) * s * 0.9;
    const at = { x: k.c.x + Math.cos(k.roll) * lean, y: k.c.y + Math.sin(k.roll) * lean };
    p.dabInto(L, at, PIGMENTS.gold, { rng: rng.fork(`a-${k.id}`), variant: 'round', angle: k.roll, length: s * (1 + (1 - k.tilt) * 0.8), width: s * 0.8, pool: 0.4, poolSide: 1, basePool: 0, layers: 2 });
  });
  L.dry({ opacity: 0.95, edge: 0.35, edgeWidth: 0.2, sharpness: 0.7, centreLift: 0.1, granulation: 0.03, flow: 0.2, flowScale: 2, darken: 0.25, blend: 'source-over' });
}

/** The seed stage on rock: a little earth and the seed, gone once the first leaf covers it. */
export function rockSeed(p: Painter, rng: Rng, g: number, rx: number): void {
  const mound = 0.4 * (0.75 + 0.25 * smooth(g / 0.05)) * (1 - smooth(clamp01((g - 0.1) / 0.35)));
  if (mound > 0.01) {
    p.wash({ cx: 0, cy: -rx * 0.1, rx, ry: rx * 0.3 }, mix(PIGMENTS.stoneWarm, PIGMENTS.wood, 0.35), {
      rng: rng.fork('mound'),
      opacity: mound,
      edge: 0.35,
      centreLift: 0.35,
      granulation: 0.35,
      fade: { angle: -Math.PI / 2, start: 0.55, amount: 0.6 },
    });
  }
  const seed = 1 - smooth(clamp01((g - 0.06) / 0.1));
  if (seed > 0.015) {
    p.dab({ x: rx * 0.12, y: -rx * 0.2 }, mix(PIGMENTS.wood, PIGMENTS.sumi, 0.35), { rng: rng.fork('seed'), variant: 'round', angle: -0.4, length: rx * 0.26, width: rx * 0.18, opacity: 0.85 * seed });
  }
}
