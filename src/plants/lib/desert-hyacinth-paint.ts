/**
 * Painting helpers for the desert hyacinth (Cistanche phelypaea) only: the cracked sand mound,
 * the fleshy scaled stem and the golden flower spike. docs/devlog/118-desert-hyacinth.md.
 */
import type { Rng } from '../../core/rng';
import { mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { UP, pathLen, pointAt } from './small-structure';

export interface HyacinthColours {
  cream: Pigment;
  creamShade: Pigment;
  scale: Pigment;
  violet: Pigment;
  bud: Pigment;
  gold: Pigment;
  goldDeep: Pigment;
  lobe: Pigment;
  throat: Pigment;
  sand: Pigment;
  sandShade: Pigment;
  crack: Pigment;
}

/** Light comes from the upper left: the shaded flank of an upright column is its right. */
const SHADE_SIDE = 1;

function box(pts: readonly Pt[], pad: number): { x: number; y: number; w: number; h: number } {
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

/** A point `side` across the axis at fraction `t` of the path (side > 0 is screen-right for an upright axis). */
export function across(axis: readonly Pt[], t: number, side: number): { x: number; y: number; angle: number } {
  const q = pointAt(axis, t);
  return { x: q.x - Math.sin(q.angle) * side, y: q.y + Math.cos(q.angle) * side, angle: q.angle };
}

/** The outline of a column on `axis` between fractions `t0..t1`, radius `r(u)` with u 0..1 over that span, flank `from..to` (−1..1). */
export function column(axis: readonly Pt[], t0: number, t1: number, r: (u: number) => number, from = -1, to = 1, n = 14): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const t = lerp(t0, t1, u);
    const rr = r(u);
    left.push(across(axis, t, rr * from));
    right.push(across(axis, t, rr * to));
  }
  return [...left, ...right.reverse()];
}

/**
 * The sand the stems break: a low warm mound with a shaded lip, and cracks that open round
 * each stem foot before the tip shows (`k` 0..1), settling a little as the plant takes over.
 */
export function crackedMound(
  p: Painter,
  rng: Rng,
  feet: readonly { x: number; r: number; k: number; cracks: { a: number; len: number; bend: number }[] }[],
  c: HyacinthColours,
  o: { rx: number; k: number },
): void {
  const mk = lerp(0.45, 1, o.k);
  const xs = feet.map((f) => f.x);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  p.wash({ cx, cy: -1.2, rx: o.rx * mk, ry: o.rx * 0.2 * mk }, c.sand, {
    rng: rng.fork('mound'),
    opacity: 0.5,
    edge: 0.3,
    centreLift: 0.4,
    granulation: 0.5,
    fade: { angle: UP, start: 0.5, amount: 0.7 },
  });
  p.glaze({ cx: cx + o.rx * 0.18, cy: 0.6, rx: o.rx * 0.8 * mk, ry: o.rx * 0.09 * mk }, c.sandShade, {
    rng: rng.fork('lip'),
    opacity: 0.32,
    edge: 0.2,
    sharpness: 0.3,
    fade: { angle: UP, start: 0.3, amount: 0.9 },
  });
  feet.forEach((f, i) => {
    if (!visible(f.k)) return;
    f.cracks.forEach((cr, j) => {
      const len = cr.len * f.k;
      if (len < 0.4) return;
      const r0 = f.r * 0.9;
      const a = cr.a;
      const pts: Pt[] = [];
      for (let s = 0; s <= 3; s++) {
        const d = r0 + (len * s) / 3;
        const aa = a + cr.bend * (s / 3);
        pts.push({ x: f.x + Math.cos(aa) * d, y: Math.sin(aa) * d * 0.28 - 0.4 });
      }
      p.inkLine(pts, { rng: rng.fork(`crack-${i}-${j}`), width: 0.55, pigment: c.crack, opacity: 0.55 * smooth(f.k * 1.5), breaks: 0.3, wobble: 0.35, taper: [0.2, 0.7] });
    });
    // the ring of lifted sand round the foot
    p.dab({ x: f.x, y: -0.5 }, c.sandShade, {
      rng: rng.fork(`ring-${i}`),
      variant: 'round',
      angle: 0,
      length: f.r * 3 * f.k,
      width: f.r * 0.9 * f.k,
      opacity: 0.38 * f.k,
      pool: 0.6,
      poolSide: 1,
    });
  });
}

export interface StemNow {
  axis: Pt[];
  /** fraction of the axis that is bare stem; the spike takes the rest */
  split: number;
  radius: number;
  violet: number;
  scales: { t: number; side: number; len: number; wid: number; k: number }[];
}

/** The fleshy stem: a cream column, a buff shaded flank, a violet-brown flush at the foot and overlapping pale scales. */
export function scaledStem(p: Painter, rng: Rng, s: StemNow, c: HyacinthColours): void {
  if (s.split * pathLen(s.axis) < 0.5) return;
  const r = (u: number) => s.radius * lerp(1.12, 0.92, u);
  const poly = column(s.axis, 0, s.split, r);
  const L = p.layer(box(poly, 6));
  L.fill(poly, c.cream, 0.9);
  L.fill(column(s.axis, 0, s.split, r, 0.15 * SHADE_SIDE, 1.02 * SHADE_SIDE), c.creamShade, 0.75);
  if (s.violet > 0.02) L.fill(column(s.axis, 0, s.split * 0.42, (u) => r(u * 0.42) * 1.02), c.violet, 0.55 * s.violet);
  L.lift(column(s.axis, 0.02, s.split * 0.95, r, -0.75 * SHADE_SIDE, -0.35 * SHADE_SIDE), 0.25);
  L.dry({ opacity: 0.94, edge: 0.55, edgeWidth: 0.35, sharpness: 0.55, centreLift: 0.1, granulation: 0.25, granules: 0.15, flow: 0.3, flowScale: 1.5, darken: 0.5, blend: 'source-over' });
  s.scales.forEach((sc, i) => {
    if (!visible(sc.k)) return;
    const t = sc.t * s.split;
    const q = across(s.axis, t, sc.side * s.radius * 0.55);
    const tone = mix(c.scale, c.violet, s.violet * clamp01(1 - sc.t * 2.2) * 0.6);
    p.dab({ x: q.x, y: q.y }, tone, {
      rng: rng.fork(`scale-${i}`),
      variant: 'leaf',
      angle: q.angle + sc.side * 0.22,
      length: sc.len * sc.k,
      width: sc.wid * sc.k,
      curve: -sc.side * 0.12,
      opacity: 0.62 * sc.k,
      pool: 0.8,
      poolSide: -sc.side,
      basePool: 0.1,
      layers: 2,
    });
  });
}

export interface FlowerNow {
  /** 0..1 up the spike */
  u: number;
  /** azimuth round the column: 0 faces the viewer */
  az: number;
  size: number;
  /** 0 a bud pressed to the axis, 1 a flower open and turned out */
  open: number;
  /** 0..1, how far the mark has emerged (buds swell in) */
  k: number;
}

export interface SpikeNow {
  axis: Pt[];
  t0: number;
  radius: number;
  /** 0..1: how far up the spike the flowers have opened */
  front: number;
  flowers: FlowerNow[];
}

/** Where a flower sits on the spike, which way its tube points and how long it looks. */
function flowerPose(s: SpikeNow, f: FlowerNow, r: (u: number) => number) {
  const sin = Math.sin(f.az);
  const facing = Math.max(0, Math.cos(f.az));
  const back = Math.max(0, -Math.cos(f.az));
  const q = across(s.axis, lerp(s.t0, 1, f.u), sin * r(f.u) * lerp(0.55, 0.8, f.open));
  const dir = q.angle + sin * lerp(0.12, 1.05, f.open) * lerp(1, 0.75, back);
  const tubeLen = f.size * f.k * lerp(2.4, 4.3, f.open) * lerp(1, 0.5, facing * f.open);
  return { q, sin, facing, back, dir, tubeLen };
}

/** The radius profile of the spike: full in the lower half, a blunt cone at the top. */
export const spikeR = (u: number): number => (u < 0.55 ? lerp(0.86, 1, smooth(u / 0.55)) : lerp(1, 0.32, smooth((u - 0.55) / 0.45)));

/**
 * The flower spike: a column the colour of the buds turning gold below the opening front,
 * then every flower back to front, bracts first, in one wet layer, then the throats.
 */
export function flowerSpike(p: Painter, rng: Rng, s: SpikeNow, c: HyacinthColours): void {
  if (s.t0 > 0.995) return;
  const r = (u: number) => s.radius * spikeR(u);
  const poly = column(s.axis, s.t0, 1, r, -0.92, 0.92);
  const L = p.layer(box(poly, s.radius * 2.4));
  L.fill(poly, c.bud, 0.85);
  if (s.front > 0.02) {
    const top = Math.min(1, s.front + 0.05);
    L.fill(column(s.axis, s.t0, lerp(s.t0, 1, top), (u) => r(u * top), -0.85, 0.85), c.goldDeep, 0.8 * smooth(s.front * 3));
  }
  L.fill(column(s.axis, s.t0, 1, r, 0.2 * SHADE_SIDE, 0.95 * SHADE_SIDE), mix(c.goldDeep, c.throat, 0.35), 0.4);
  const order = s.flowers.map((_, i) => i).sort((a, b) => Math.cos(s.flowers[a]!.az) - Math.cos(s.flowers[b]!.az));
  for (const i of order) {
    const f = s.flowers[i]!;
    if (!visible(f.k)) continue;
    const { q, sin, facing, back, dir, tubeLen } = flowerPose(s, f, r);
    const fr = rng.fork(`fl-${i}`);
    const sz = f.size * f.k;
    // the bract: a pale scale under every flower, the buds' cover at the top
    p.dabInto(L, { x: q.x, y: q.y + sz * 1.2 }, mix(c.bud, c.scale, 0.45), {
      rng: fr.fork('bract'),
      variant: 'leaf',
      angle: q.angle + sin * 0.35,
      length: sz * lerp(3.2, 2.4, f.open),
      width: sz * 1.5,
      pool: 0.7,
      poolSide: SHADE_SIDE,
      basePool: 0,
      layers: 1,
    });
    // the tube: a bud pointing up the axis that turns out and gold as it opens
    const tone = mix(c.bud, c.gold, smooth(f.open * 1.4));
    p.dabInto(L, q, mix(tone, c.goldDeep, back * 0.5), {
      rng: fr.fork('tube'),
      variant: 'petal',
      angle: dir,
      length: tubeLen,
      width: sz * lerp(1.3, 1.9, f.open),
      pool: 0.9,
      poolSide: sin >= 0 ? 1 : -1,
      basePool: 0.2,
      layers: 1,
    });
    if (f.open < 0.04) continue;
    // the flaring lobes: two lips at the mouth, a rosette on the flowers that face out
    const mouth = { x: q.x + Math.cos(dir) * tubeLen * 0.85, y: q.y + Math.sin(dir) * tubeLen * 0.85 };
    const spread = lerp(1.05, 2.5, facing);
    for (let j = 0; j < 5; j++) {
      const a = dir + (j - 2) * spread * 0.5 + (j < 2 ? -0.15 : 0);
      const lk = f.open * (j === 2 ? 0.85 : 1);
      p.dabInto(L, mouth, mix(c.lobe, c.gold, back * 0.6 + (j % 2) * 0.2), {
        rng: fr.fork(`lobe-${j}`),
        variant: 'petal',
        angle: a,
        length: sz * 1.55 * lk,
        width: sz * 1.25 * lk,
        pool: 0.5,
        basePool: 0,
        layers: 1,
      });
    }
  }
  L.dry({ opacity: 0.96, edge: 0.6, edgeWidth: 0.3, sharpness: 0.6, centreLift: 0.12, granulation: 0.2, granules: 0.12, flow: 0.3, flowScale: 1.2, darken: 0.55, blend: 'source-over' });
  // the throats, a warm dark eye in the flowers that look out
  for (const i of order) {
    const f = s.flowers[i]!;
    const facing = Math.max(0, Math.cos(f.az));
    const k = f.open * f.k * smooth((facing - 0.25) / 0.5);
    if (!visible(k)) continue;
    const { q, dir, tubeLen } = flowerPose(s, f, r);
    p.dab({ x: q.x + Math.cos(dir) * tubeLen * 0.85, y: q.y + Math.sin(dir) * tubeLen * 0.85 }, c.throat, {
      rng: rng.fork(`throat-${i}`),
      variant: 'round',
      angle: dir,
      length: f.size * 0.9 * k,
      width: f.size * 0.7 * k,
      opacity: 0.7 * k,
      layers: 1,
    });
  }
}
