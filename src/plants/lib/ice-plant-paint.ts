/**
 * Painting helpers for the ice plant (docs/devlog/172-ice-plant.md): the cushion lobes seen from
 * about 25° up, their fleshy finger leaves, and the field of satin-rayed flowers laid over them.
 * New helpers, so the shared `small-*` stay untouched.
 */
import type { Rng } from '../../core/rng';
import { lighten, mix, type Painter, type Pigment, type Pt, type WetLayer } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { shadowSide } from './small-paint';

export const SIN_E = 0.42;
export const COS_E = Math.sqrt(1 - SIN_E * SIN_E);

/** Unit vector towards the light: upper left, a little toward the viewer. */
const LIGHT3 = (() => {
  const v = { x: -0.55, y: 0.25, z: 0.8 };
  const n = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / n, y: v.y / n, z: v.z / n };
})();

export interface Bloom {
  a: number;
  b: number;
  r: number;
  /** −1 a deep fold … +1 a sunlit patch */
  shift: number;
}

/** One cushion: a flattened dome on the ground, planned in unit-disc coordinates (a, b). */
export interface Lobe {
  cx: number;
  cy: number;
  rx: number;
  rd: number;
  h: number;
  /** dome profile: Z = h (1 − s)^q */
  q: number;
  blooms: readonly Bloom[];
  wobble: readonly number[];
}

export interface Surface {
  /** screen position */
  x: number;
  y: number;
  /** the dome's unit normal in ground space */
  nx: number;
  ny: number;
  nz: number;
  /** how squarely the surface faces the viewer, 0..1 */
  face: number;
  /** 0 shaded … 1 facing the light */
  lit: number;
  /** 0 at the crown … 1 at the rim */
  rim: number;
}

/** The point (a, b) of lobe `l` grown to `k` (0..1), with its normal and light. */
export function surface(l: Lobe, k: number, a: number, b: number): Surface {
  const s = Math.min(0.985, a * a + b * b);
  const w = 1 - s;
  const Z = l.h * k * w ** l.q;
  const X = l.cx + a * l.rx * k;
  const Y = l.cy + b * l.rd * k;
  const slope = 2 * l.q * l.h * w ** (l.q - 1);
  const gx = (slope * a) / l.rx;
  const gy = (slope * b) / l.rd;
  const len = Math.hypot(gx, gy, 1);
  const nx = gx / len;
  const ny = gy / len;
  const nz = 1 / len;
  return {
    x: X,
    y: Y * SIN_E - Z * COS_E,
    nx,
    ny,
    nz,
    face: clamp01(ny * COS_E + nz * SIN_E),
    lit: clamp01(nx * LIGHT3.x + ny * LIGHT3.y + nz * LIGHT3.z),
    rim: s,
  };
}

/** How much the blooms of a lobe push the tone at (a, b): −1 deep … +1 sunlit. */
export function bloomShift(l: Lobe, a: number, b: number): number {
  let v = 0;
  for (const m of l.blooms) {
    const d = Math.hypot(a - m.a, b - m.b) / m.r;
    if (d < 1.6) v += m.shift * Math.exp(-d * d * 1.3);
  }
  return Math.max(-1, Math.min(1, v));
}

/** How far a flower has opened at growth `g`, 0..1. */
export const openness = (g: number, open: readonly [number, number]): number => smooth((g - open[0]) / (open[1] - open[0]));

const BINS = 40;

/** The lobe's outline: the farthest surface point in each direction round the crown. */
export function silhouette(l: Lobe, k: number): Pt[] {
  const top = surface(l, k, 0, 0);
  const cx = top.x;
  const cy = (l.cy * SIN_E + top.y) / 2;
  const reach = new Array<number>(BINS).fill(0);
  const rings = [1, 0.93, 0.8, 0.6, 0.35];
  for (const rr of rings) {
    for (let i = 0; i < 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      const q = surface(l, k, Math.cos(t) * rr, Math.sin(t) * rr);
      const ang = Math.atan2(q.y - cy, q.x - cx);
      const bin = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * BINS) % BINS;
      reach[bin] = Math.max(reach[bin]!, Math.hypot(q.x - cx, q.y - cy));
    }
  }
  const out: Pt[] = [];
  for (let i = 0; i < BINS; i++) {
    const r = (reach[i] || reach[(i + 1) % BINS] || reach[(i + BINS - 1) % BINS] || 1) * (1 + (l.wobble[i % l.wobble.length] ?? 0));
    const ang = ((i + 0.5) / BINS) * Math.PI * 2 - Math.PI;
    out.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
  }
  return smoothClosed(out);
}

/** Chaikin-style rounding of a closed polygon, one pass. */
function smoothClosed(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  return out;
}

const scaleAbout = (poly: readonly Pt[], c: Pt, k: number): Pt[] => poly.map((q) => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k }));

const centroid = (poly: readonly Pt[]): Pt => {
  let x = 0;
  let y = 0;
  for (const q of poly) {
    x += q.x;
    y += q.y;
  }
  return { x: x / poly.length, y: y / poly.length };
};

function boundsOf(pts: readonly Pt[], pad: number): { x: number; y: number; w: number; h: number } {
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

const ellipse = (c: Pt, rx: number, ry: number, n = 16): Pt[] => Array.from({ length: n }, (_, i) => ({ x: c.x + Math.cos((i / n) * Math.PI * 2) * rx, y: c.y + Math.sin((i / n) * Math.PI * 2) * ry }));

export interface Finger {
  a: number;
  b: number;
  /** turn from the outward direction, radians */
  turn: number;
  len: number;
  wid: number;
  /** 0 sage … 1 deep */
  tone: number;
  /** where in the lobe's growth it starts */
  start: number;
  key: string;
}

export interface Greens {
  leaf: Pigment;
  deep: Pigment;
  pale: Pigment;
}

/** The leaf body and its fleshy fingers, one wet layer: the cushion before it flowers. */
export function lobeBody(p: Painter, rng: Rng, l: Lobe, k: number, fingers: readonly Finger[], c: Greens, o: { opacity: number; cover: number }): Pt[] {
  const outline = silhouette(l, k);
  const area = boundsOf(outline, 7);
  const L = p.layer(area);
  const mid = centroid(outline);
  L.fill(scaleAbout(outline, mid, 0.97), mix(c.leaf, c.pale, 0.2), 0.9 * smooth((k - 0.2) / 0.4));
  const drawn = fingers
    .map((f) => ({ f, s: surface(l, k, f.a, f.b), fk: smooth((k - f.start) / 0.22) }))
    .filter((q) => visible(q.fk) && q.s.face > 0.04)
    .sort((x, y) => x.s.y - y.s.y);
  for (const { f, s, fk } of drawn) {
    const out = Math.atan2(s.ny * SIN_E - s.nz * COS_E, s.nx);
    const angle = out + f.turn;
    const tone = mix(mix(c.pale, c.leaf, 0.55 + f.tone * 0.3), c.deep, f.tone * 0.5 * (1 - s.lit * 0.6));
    p.dabInto(L, { x: s.x, y: s.y }, tone, {
      rng: rng.fork(f.key),
      variant: 'petal',
      angle,
      length: f.len * lerp(0.2, 1, fk) * lerp(0.6, 1, s.rim ** 2) * (1 - o.cover * 0.55 * (1 - s.rim ** 2)),
      width: f.wid * lerp(0.5, 1, fk),
      asym: 0,
      pool: 0.4,
      poolSide: shadowSide(angle),
      basePool: 0.3,
      layers: 2,
    });
  }
  L.dry({ opacity: o.opacity, edge: 0.3, edgeWidth: 0.35, sharpness: 0.6, centreLift: 0.2, granulation: 0.25, flow: 0.5, flowScale: 3, darken: 0.2, blend: 'source-over' });
  return outline;
}

export interface Bloomlet {
  a: number;
  b: number;
  r: number;
  rot: number;
  rays: number;
  /** per-ray length jitter, 0..1 */
  tips: readonly number[];
  jit: number;
  /** growth at which it starts to open, and finishes */
  open: readonly [number, number];
  key: string;
}

export interface Colourway {
  shade: Pigment;
  mid: Pigment;
  pale: Pigment;
  eye: Pigment;
  bud: Pigment;
}

/** Tone for a shading value v (0 deep fold … 1 sunlit): shade → mid → pale. */
export const toneAt = (c: Colourway, v: number): Pigment => (v < 0.5 ? mix(c.shade, c.mid, v / 0.5) : mix(c.mid, c.pale, (v - 0.5) / 0.5));

function star(c: Pt, r: number, rays: number, tips: readonly number[], rot: number, ux: number, uy: number, squash: number, spread = 0.12): Pt[] {
  const pts: Pt[] = [];
  const n = rays * 2;
  const cosU = ux;
  const sinU = uy;
  for (let i = 0; i < n; i++) {
    const t = rot + (i / n) * Math.PI * 2;
    const tip = i % 2 === 0;
    const rr = r * (tip ? 0.9 + spread * (tips[(i / 2) % tips.length] ?? 0.5) : 0.8);
    const u = Math.cos(t) * rr;
    const v = Math.sin(t) * rr * squash;
    pts.push({ x: c.x + u * cosU - v * sinU, y: c.y + u * sinU + v * cosU });
  }
  return pts;
}

/**
 * The flowers of one lobe: a deep violet wash under them, wet blooms of light and shade, then
 * every flower as a satin-rayed star with a pale eye, back to front, in one wet layer.
 */
export function lobeFlowers(p: Painter, rng: Rng, l: Lobe, k: number, outline: readonly Pt[], flowers: readonly Bloomlet[], g: number, c: Colourway, o: { wash: number; opacity: number }): void {
  const live = flowers.filter((f) => visible(openness(g, f.open)));
  if (!live.length && !visible(o.wash)) return;
  const area = boundsOf(outline, 6);
  const L: WetLayer = p.layer(area);
  const mid = centroid(outline);
  if (visible(o.wash)) {
    const inner = scaleAbout(outline, mid, 0.93);
    L.fill(inner, mix(c.shade, c.mid, 0.6), 0.9 * o.wash);
    const wr = rng.fork('wash');
    L.ctx.save();
    L.clip(inner);
    for (const m of l.blooms) {
      const s = surface(l, k, m.a, m.b);
      if (s.face < 0.02) continue;
      const r = m.r * l.rx * k * 0.8;
      for (let j = 0; j < 2; j++) {
        const at = { x: s.x + wr.gaussian(0, r * 0.15), y: s.y + wr.gaussian(0, r * 0.1) };
        L.fill(ellipse(at, r * (1 - j * 0.35), r * 0.6 * (1 - j * 0.35)), m.shift > 0 ? mix(c.mid, c.pale, 0.35) : c.shade, (m.shift > 0 ? 0.35 : 0.4) * o.wash);
      }
    }
    L.ctx.restore();
  }
  const sorted = live.map((f) => ({ f, s: surface(l, k, f.a, f.b), open: openness(g, f.open) })).filter((q) => q.s.face > 0.05).sort((x, y) => x.s.y - y.s.y);
  for (const { f, s, open } of sorted) {
    const v = clamp01(0.2 + 0.58 * s.lit - 0.22 * s.rim ** 3 + 0.3 * bloomShift(l, f.a, f.b) + f.jit);
    const size = f.r * lerp(0.4, 1, open);
    const squash = 0.38 + 0.62 * s.face;
    const px = s.ny * SIN_E - s.nz * COS_E;
    const along = Math.atan2(px, s.nx) + Math.PI / 2;
    const ux = Math.cos(along);
    const uy = Math.sin(along);
    const at = { x: s.x, y: s.y };
    const tone = mix(c.bud, toneAt(c, v), 0.4 + 0.6 * open);
    const alpha = Math.min(1, open * 3) * o.opacity;
    L.fill(star(at, size, f.rays, f.tips, f.rot, ux, uy, squash), tone, alpha);
    const hi = { x: at.x - size * 0.16, y: at.y - size * 0.18 };
    L.fill(star(hi, size * 0.66, f.rays, f.tips, f.rot + 0.2, ux, uy, squash, 0.1), lighten(tone, 0.28), 0.42 * alpha * open);
    L.fill(ellipse(at, size * 0.19, size * 0.19 * squash, 8), c.eye, 0.9 * smooth(open * 1.6) * alpha);
  }
  L.dry({ opacity: 0.95, edge: 0.25, edgeWidth: 0.3, sharpness: 0.5, centreLift: 0.08, granulation: 0.06, flow: 0.55, flowScale: 3, darken: 0.15, blend: 'source-over' });
}

export interface RimFinger {
  lobe: number;
  a: number;
  b: number;
  turn: number;
  len: number;
  wid: number;
  tone: number;
  start: number;
  key: string;
}

/** Fingers spilling over the rim in front of the flowers, all lobes in one layer. */
export function spill(p: Painter, rng: Rng, lobes: readonly { l: Lobe; k: number }[], fs: readonly RimFinger[], g: number, c: Greens): void {
  const live = fs
    .map((f) => {
      const { l, k } = lobes[f.lobe]!;
      return { f, s: surface(l, k, f.a, f.b), fk: k < 0.02 ? 0 : smooth((g - f.start) / 0.25) };
    })
    .filter((q) => visible(q.fk))
    .sort((x, y) => x.s.y - y.s.y);
  if (!live.length) return;
  const area = boundsOf(live.map((q) => q.s), 9);
  const L = p.layer(area);
  for (const { f, s, fk } of live) {
    const out = Math.atan2(s.ny * SIN_E - s.nz * COS_E, s.nx) + f.turn;
    const tone = mix(mix(c.pale, c.leaf, 0.6 + f.tone * 0.3), c.deep, f.tone * 0.35);
    p.dabInto(L, { x: s.x, y: s.y }, tone, { rng: rng.fork(f.key), variant: 'petal', angle: out, length: f.len * lerp(0.25, 1, fk), width: f.wid * lerp(0.5, 1, fk), asym: 0, pool: 0.4, poolSide: shadowSide(out), basePool: 0.3, layers: 2 });
  }
  L.dry({ opacity: 0.88, edge: 0.5, edgeWidth: 0.3, sharpness: 0.7, centreLift: 0.2, granulation: 0.25, flow: 0.45, flowScale: 3, darken: 0.3, blend: 'source-over' });
}
