/**
 * Painting helpers for the mizubashō (species/mizubasho.ts): the white boat-shaped spathe curled
 * round its club, and the paddle leaf that rises behind it.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, blob, jitter, mix, organicOutline, outlineLayer, type Outline, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';

/** A curved axis: from `base`, `length` long, leaving at `angle` and turning by `bend` to the tip. */
export interface AxisPose {
  base: Pt;
  angle: number;
  length: number;
  bend: number;
  /** full width across, plant units */
  width: number;
}

/** Authoring units of the unit outlines: half-width 10 across, 40 along. */
const HW = 10;
const LEN = 40;

function axisFrame(pose: AxisPose) {
  const B = pose.base;
  const C = { x: B.x + Math.cos(pose.angle) * pose.length * 0.5, y: B.y + Math.sin(pose.angle) * pose.length * 0.5 };
  const a2 = pose.angle + pose.bend;
  const T = { x: C.x + Math.cos(a2) * pose.length * 0.5, y: C.y + Math.sin(a2) * pose.length * 0.5 };
  return (t: number) => {
    const u = 1 - t;
    const x = u * u * B.x + 2 * u * t * C.x + t * t * T.x;
    const y = u * u * B.y + 2 * u * t * C.y + t * t * T.y;
    let dx = 2 * u * (C.x - B.x) + 2 * t * (T.x - C.x);
    let dy = 2 * u * (C.y - B.y) + 2 * t * (T.y - C.y);
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    return { x, y, tx: dx, ty: dy };
  };
}

/** Map a unit-outline point (x across in ±HW, y along 0..LEN) onto the posed axis. */
export function mapper(pose: AxisPose): (q: Pt) => Pt {
  const at = axisFrame(pose);
  const s = pose.width / (2 * HW);
  return (q) => {
    const a = at(clamp01(q.y / LEN));
    return { x: a.x - a.ty * q.x * s, y: a.y + a.tx * q.x * s };
  };
}

function boundsOf(pts: readonly Pt[], pad: number) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of pts) {
    x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

// ---------------------------------------------------------------------------------------------
// the spathe

export interface SpatheShape {
  outer: Outline;
  hollow: Outline;
  lip: Outline;
  /** the lip's inner edge (unit coords) */
  lipEdge: Pt[];
  /** which margin curls over the hollow (+1 right, −1 left) */
  side: 1 | -1;
  /** hollow's span along the spathe (0..1) */
  h0: number;
  h1: number;
}

/** Half-width of the spathe at `t` (0 base … 1 tip), as a fraction of HW. */
function spatheHalf(t: number): number {
  const p = lerp(0.8, 1.9, t);
  return 0.12 * (1 - t) ** 2 + Math.sin(Math.PI * t ** 0.76) ** p;
}

export function spatheShape(rng: Rng, o: { side: 1 | -1; hook: number; asym: number }): SpatheShape {
  const n = 36;
  const right: Pt[] = [];
  const left: Pt[] = [];
  const hookAt = (t: number) => o.hook * smooth((t - 0.55) / 0.45) ** 2 * HW * 0.5;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = spatheHalf(t) * HW;
    right.push({ x: hookAt(t) + w * (1 + o.asym), y: t * LEN });
    left.push({ x: hookAt(t) - w * (1 - o.asym), y: t * LEN });
  }
  const outerPts = [...right, ...left.reverse().slice(1, -1)];
  const h0 = rng.range(0.08, 0.11);
  const h1 = rng.range(0.52, 0.58);
  const m = 24;
  const hr: Pt[] = [];
  const hl: Pt[] = [];
  const lipIn: Pt[] = [];
  const lipOut: Pt[] = [];
  for (let i = 0; i <= m; i++) {
    const s = i / m;
    const t = lerp(h0, h1, s);
    const w = spatheHalf(t) * HW;
    const c = hookAt(t) + o.side * w * 0.12;
    const wh = w * 0.58 * Math.sin(Math.PI * s) ** 0.5;
    const near = { x: c + o.side * wh, y: t * LEN };
    (o.side > 0 ? hr : hl).push(near);
    (o.side > 0 ? hl : hr).push({ x: c - o.side * wh, y: t * LEN });
    // the curled margin: a crescent laid over the hollow's edge on `side`
    if (s <= 0.82) {
      const q = s / 0.82;
      const lw = wh * 0.42 * Math.sin(Math.PI * q) ** 0.8;
      lipOut.push({ x: near.x + o.side * w * 0.05 * Math.sin(Math.PI * q), y: near.y });
      lipIn.push({ x: near.x - o.side * lw, y: near.y - lw * 0.15 });
    }
  }
  const hollowPts = [...hr, ...hl.reverse().slice(1, -1)];
  const lipPts = [...lipOut, ...lipIn.reverse()];
  return {
    outer: organicOutline(outerPts, rng.fork('outer'), { deform: 0.06, detail: 48, edge: 0.6 }),
    hollow: organicOutline(hollowPts, rng.fork('hollow'), { deform: 0.08, detail: 32, edge: 0.6 }),
    lip: organicOutline(lipPts, rng.fork('lip'), { deform: 0.06, detail: 24, edge: 0.6 }),
    lipEdge: lipIn,
    side: o.side,
    h0,
    h1,
  };
}

export interface SpatheStyle {
  white: Pigment;
  shade: Pigment;
  /** the green flush at the foot of the spathe */
  green: Pigment;
  club: Pigment;
  clubDeep: Pigment;
}

export interface SpatheGrowth {
  /** 0 furled bud … 1 fully open */
  open: number;
  /** 0..1: the club swelling in the hollow */
  club: number;
  opacity: number;
}

/**
 * The hood: reserved white laid over what is behind, a cool shade pooled in the hollow and down
 * the shaded flank, the yellow-green club inside, the curled margin over it, then a pooled rim.
 */
export function spathe(p: Painter, rng: Rng, shape: SpatheShape, pose: AxisPose, s: SpatheStyle, gr: SpatheGrowth): void {
  if (pose.length < 0.5 || !visible(gr.opacity)) return;
  const open = clamp01(gr.open);
  const posed: AxisPose = { ...pose, width: pose.width * lerp(0.34, 1, smooth(open)) };
  const map = mapper(posed);
  const outer = shape.outer.base.map(map);
  const area = boundsOf(outer, pose.width * 0.2 + 1);

  // 1. the white, painted over the leaves behind as if the paper were left
  const W = p.layer(area);
  const wr = rng.fork('white');
  for (let k = 0; k < 4; k++) W.fill(outlineLayer(shape.outer, wr, 0.04).map(map), jitter(s.white, wr, 0.006), 0.72);
  W.dry({ opacity: gr.opacity, edge: 0.12, edgeWidth: 0.4, sharpness: 0.85, centreLift: 0, granulation: 0, flow: 0.15, flowScale: 8, darken: 0.1, blend: 'source-over' });

  // 2. cool shade: the hollow, the flank away from the light, a green flush at the foot
  const S = p.layer(area);
  const sr = rng.fork('shade');
  S.ctx.save();
  S.clip(outer);
  // the right flank turns from the light (upper left)
  const flank = 1;
  const band: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    band.push({ x: flank * spatheHalf(t) * HW * 1.1, y: t * LEN });
  }
  for (let i = 20; i >= 0; i--) {
    const t = i / 20;
    band.push({ x: flank * spatheHalf(t) * HW * lerp(0.45, 0.1, t), y: t * LEN });
  }
  S.fill(band.map(map), s.shade, 0.32);
  const flush = lerp(0.85, 0.16, smooth(open));
  // graded up from the clasping foot in a few ragged steps
  for (let k = 0; k < 4; k++) {
    const top = flush * (1 - k * 0.2) * sr.range(0.9, 1.1);
    const strip: Pt[] = [];
    for (let i = 0; i <= 8; i++) strip.push({ x: -HW * 1.2, y: LEN * top * (i / 8) });
    for (let i = 0; i <= 6; i++) strip.push({ x: lerp(-HW * 1.2, HW * 1.2, i / 6), y: LEN * top * (1 + sr.gaussian(0, 0.16) + 0.25 * Math.sin(i * 1.3 + k)) });
    for (let i = 8; i >= 0; i--) strip.push({ x: HW * 1.2, y: LEN * top * (i / 8) });
    S.fill(strip.map(map), s.green, 0.09);
  }
  S.ctx.restore();
  S.dry({ opacity: 0.7 * gr.opacity, edge: 0.4, edgeWidth: Math.max(0.25, pose.width * 0.03), sharpness: 0.55, centreLift: 0.2, granulation: 0.1, flow: 0.4, flowScale: Math.max(2, pose.width * 0.3), darken: 0.25 });

  // the hollow: a pale soft shade, deepest under the overhanging hood and the curled lip
  const ho = smooth((open - 0.2) / 0.6);
  const deep = mix(s.shade, '#8f99ab', 0.5);
  const hm = (q: Pt) => map({ x: q.x * ho, y: q.y });
  if (visible(ho)) {
    const hollow = shape.hollow.base.map(hm);
    const H = p.layer(boundsOf(hollow, 2));
    const hr = rng.fork('hollow');
    for (let k = 0; k < 3; k++) H.fill(outlineLayer(shape.hollow, hr, 0.025).map(hm), s.shade, 0.16);
    H.ctx.save();
    H.clip(hollow);
    const under = hm({ x: shape.side * 1.5, y: LEN * lerp(shape.h0, shape.h1, 0.95) });
    H.fill(blob(under.x, under.y, pose.width * 0.34, pose.length * 0.13, hr, { rotation: pose.angle + Math.PI / 2 }), deep, 0.28);
    const low = hm({ x: 0, y: LEN * lerp(shape.h0, shape.h1, 0.08) });
    H.fill(blob(low.x, low.y, pose.width * 0.16, pose.length * 0.1, hr, { rotation: pose.angle }), deep, 0.22);
    H.ctx.restore();
    H.dry({ opacity: 0.8 * gr.opacity * ho, edge: 0.3, edgeWidth: Math.max(0.2, pose.width * 0.025), sharpness: 0.5, centreLift: 0.15, granulation: 0.15, flow: 0.45, flowScale: Math.max(2, pose.width * 0.25), darken: 0.3 });
    // crisp accents: the hood's front edge and the shadow the lip casts into the hollow
    const A = p.layer(boundsOf(hollow, 2));
    const ar = rng.fork('accent');
    A.ctx.save();
    A.clip(hollow);
    A.fill(blob(under.x, under.y + pose.length * 0.025, pose.width * 0.26, pose.length * 0.045, ar, { rotation: pose.angle + Math.PI / 2, irregularity: 0.25 }), deep, 0.32);
    const strip = [...shape.lipEdge.map(hm), ...shape.lipEdge.map((q) => hm({ x: q.x - shape.side * HW * 0.16, y: q.y })).reverse()];
    A.fill(strip, deep, 0.3);
    A.ctx.restore();
    A.dry({ opacity: 0.7 * gr.opacity * ho, edge: 0.4, edgeWidth: Math.max(0.2, pose.width * 0.02), sharpness: 0.7, centreLift: 0.1, granulation: 0.1, flow: 0.3, flowScale: 3, darken: 0.3 });
  }

  // 3. the club standing in the hollow
  const ck = clamp01(gr.club);
  if (visible(ck)) {
    const hm = mapper(posed);
    const t0 = lerp(shape.h0, shape.h1, 0.12);
    const t1 = lerp(shape.h0, shape.h1, 0.62);
    const foot = hm({ x: -shape.side * 1.2, y: LEN * t0 });
    const top = hm({ x: -shape.side * 1.2, y: LEN * lerp(t0, t1, ck) });
    const ang = Math.atan2(top.y - foot.y, top.x - foot.x);
    const len = Math.max(0.1, Math.hypot(top.x - foot.x, top.y - foot.y));
    const wid = pose.width * 0.22 * lerp(0.4, 1, ck);
    const C = p.layer(boundsOf([foot, top], wid + 1));
    const cr = rng.fork('club');
    p.dabInto(C, foot, s.club, { rng: cr.fork('body'), variant: 'round', angle: ang, length: len, width: wid, pool: 0.45, poolSide: shape.side, basePool: 0.3, layers: 3 });
    // the florets: a pebbled lattice of tiny dabs
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < 3; j++) {
        const u = (i + 0.5 + (j % 2) * 0.5) / (rows + 0.5);
        const v = (j - 1) * 0.3 + cr.gaussian(0, 0.04);
        const c = { x: foot.x + Math.cos(ang) * len * u - Math.sin(ang) * wid * v, y: foot.y + Math.sin(ang) * len * u + Math.cos(ang) * wid * v };
        p.dabInto(C, c, s.clubDeep, { rng: cr.fork(`f-${i}-${j}`), variant: 'round', angle: ang + cr.gaussian(0, 0.4), length: wid * 0.16 * ck, width: wid * 0.13 * ck, pool: 0.3, basePool: 0, layers: 1 });
      }
    }
    C.dry({ opacity: 0.94 * gr.opacity * smooth(ck * 3), edge: 0.5, edgeWidth: Math.max(0.2, wid * 0.08), sharpness: 0.7, centreLift: 0.15, granulation: 0.55, flow: 0.4, flowScale: Math.max(1.5, wid * 0.4), darken: 0.32, blend: 'source-over' });
  }

  // 4. the curled margin laid over the edge of the hollow and the club
  if (visible(ho)) {
    const lipMap = hm;
    const lip = shape.lip.base.map(lipMap);
    const Lp = p.layer(boundsOf(lip, 2));
    const lr = rng.fork('lip');
    for (let k = 0; k < 2; k++) Lp.fill(outlineLayer(shape.lip, lr, 0.04).map(lipMap), s.white, 0.6);
    Lp.dry({ opacity: 0.96 * gr.opacity * ho, edge: 0.12, edgeWidth: Math.max(0.2, pose.width * 0.025), sharpness: 0.8, centreLift: 0, granulation: 0, flow: 0.1, flowScale: 6, darken: 0.22, blend: 'source-over' });
  }

  // 5. a pooled cool rim round the whole hood
  const R = p.layer(area);
  const rr = rng.fork('rim');
  for (let k = 0; k < 2; k++) R.fill(outlineLayer(shape.outer, rr, 0.03).map(map), s.shade, 0.5);
  R.dry({ opacity: 0.26 * gr.opacity, edge: 0.95, edgeWidth: Math.max(0.25, pose.width * 0.028), sharpness: 0.8, centreLift: 0.92, granulation: 0.1, flow: 0.3, flowScale: 4, darken: 0.4 });

  // the pooled edge where the shaded flank meets the light behind it
  const pk = smooth((pose.length - 6) / 12);
  if (visible(pk)) {
    const edge = [0.06, 0.2, 0.35, 0.5, 0.65, 0.78, 0.86].map((t) => map({ x: flank * spatheHalf(t) * HW * 0.97, y: LEN * t }));
    p.stroke(edge, { rng: rng.fork('pool'), pigment: mix(s.shade, PIGMENTS.shadow, 0.35), width: Math.max(0.3, pose.width * 0.035), taper: [0.3, 0.6], pressure: [0.6, 1, 0.5], wobble: 0.2, wetness: 0.5, opacity: 0.5 * pk * gr.opacity, edge: 0.6 });
  }

  // 6. faint veins converging to the tip
  const vk = smooth((pose.length - 12) / 20) * smooth(open * 2 - 0.6);
  if (visible(vk)) {
    for (let i = 0; i < 4; i++) {
      const x = flank * lerp(0.15, 0.75, i / 3) * HW;
      const pts = [0.74, 0.82, 0.9, 0.97].map((t) => map({ x: x * spatheHalf(t) * lerp(1, 0.3, (t - 0.74) / 0.23), y: LEN * t }));
      p.stroke(pts, { rng: rng.fork(`vein-${i}`), pigment: s.shade, width: Math.max(0.18, pose.width * 0.012), taper: [0.2, 0.6], wobble: 0.15, wetness: 0.2, opacity: 0.35 * vk * gr.opacity, edge: 0.2 });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// the paddle leaf

export interface PaddleShape {
  outline: Outline;
  /** where the winged petiole widens into the blade (0..1) */
  neck: number;
  veins: number;
}

export function paddleShape(rng: Rng, o: { neck: number; asym: number; veins: number }): PaddleShape {
  const n = 40;
  const right: Pt[] = [];
  const left: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = clamp01((t - o.neck) / (1 - o.neck));
    const blade = Math.sin(Math.PI * s ** 0.85) ** 0.55;
    const w = (0.1 + 0.9 * blade) * HW * (t < o.neck ? lerp(0.6, 1, t / o.neck) * 0.12 / 0.1 : 1);
    right.push({ x: w * (1 + o.asym), y: t * LEN });
    left.push({ x: -w * (1 - o.asym), y: t * LEN });
  }
  const pts = [...right, ...left.reverse().slice(1, -1)];
  return { outline: organicOutline(pts, rng.fork('outline'), { deform: 0.07, detail: 48, edge: 0.6 }), neck: o.neck, veins: o.veins };
}

export interface PaddleStyle {
  pigment: Pigment;
  deep: Pigment;
  rib: Pigment;
  opacity: number;
}

/** One leaf in one wet layer dried source-over: shaded half, faint side veins, lifted midrib. */
export function paddleLeaf(p: Painter, rng: Rng, shape: PaddleShape, pose: AxisPose, s: PaddleStyle, open: number): void {
  if (pose.length < 0.6 || !visible(s.opacity)) return;
  const o = clamp01(open);
  const posed: AxisPose = { ...pose, width: pose.width * lerp(0.2, 1, smooth(o)) };
  const map = mapper(posed);
  const base = shape.outline.base.map(map);
  const L = p.layer(boundsOf(base, pose.width * 0.2 + 1));
  const fr = rng.fork('fills');
  for (let k = 0; k < 3; k++) L.fill(outlineLayer(shape.outline, fr, 0.05).map(map), jitter(s.pigment, fr, 0.02), 0.45);
  // a rolled young leaf is mostly its shaded outer flank
  const side = rng.chance(0.5) ? 1 : -1;
  const half: Pt[] = [];
  for (let i = 0; i <= 16; i++) half.push({ x: 0, y: (i / 16) * LEN });
  for (let i = 16; i >= 0; i--) half.push({ x: side * HW * 1.3, y: (i / 16) * LEN });
  L.ctx.save();
  L.clip(base);
  L.fill(half.map(map), s.deep, lerp(0.34, 0.16, o));
  L.ctx.restore();
  const vk = smooth((pose.length - 14) / 20) * smooth(o * 1.6 - 0.4);
  if (visible(vk)) {
    L.ctx.save();
    L.clip(base);
    for (let i = 0; i < shape.veins; i++) {
      const t = lerp(shape.neck + 0.06, 0.8, i / (shape.veins - 1));
      for (const sg of [-1, 1]) {
        const a = map({ x: 0, y: t * LEN });
        const b = map({ x: sg * HW * 0.85 * Math.sin(Math.PI * clamp01((t - shape.neck) / (1 - shape.neck))) ** 0.5, y: Math.min(LEN * 0.92, (t + 0.1) * LEN) });
        p.dabInto(L, a, mix(s.deep, s.pigment, 0.25), { rng: rng.fork(`v-${i}-${sg}`), variant: 'needle', angle: Math.atan2(b.y - a.y, b.x - a.x), length: Math.hypot(b.x - a.x, b.y - a.y) * 0.85 * vk, width: Math.max(0.2, pose.width * 0.012), curve: -sg * 0.15, pool: 0, basePool: 0.1, layers: 1 });
      }
    }
    L.ctx.restore();
  }
  L.dry({ opacity: s.opacity * smooth(pose.length / 6), edge: 0.42, edgeWidth: Math.max(0.25, Math.min(1.3, pose.width * 0.035)), sharpness: 0.72, centreLift: 0.25, granulation: 0.15, flow: 0.35, flowScale: Math.max(4, pose.width * 0.6), darken: 0.3, blend: 'source-over' });
  // the pale midrib, lifted the length of the leaf
  if (pose.length > 4) {
    const rib = [0, 0.2, 0.4, 0.6, 0.8, 0.93].map((t) => map({ x: 0, y: t * LEN }));
    p.stroke(rib, { rng: rng.fork('rib'), pigment: s.rib, width: Math.max(0.3, pose.width * 0.045), taper: [0.05, 0.75], wobble: 0.12, wetness: 0.3, opacity: 0.55 * smooth((pose.length - 4) / 10) * s.opacity, edge: 0.2, blend: 'source-over' });
  }
}
