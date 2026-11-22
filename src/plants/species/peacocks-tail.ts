import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbon } from '../lib/baikamo-paint';
import { clamp01, ease, lerp, smooth, visible } from '../lib/small-growth';
import { plantFrame } from '../lib/small-paint';
import type { SpeciesDef } from '../types';

/**
 * Peacock's tail (Padina pavonica): a small cluster of thin, chalk-dusted fronds rolled into
 * shallow funnels and ears, each banded with chalk and fine olive hairlines under a rolled rim,
 * on one holdfast on a stone in a rock pool or the shallows. Seen from the cliff through the water.
 */

const BUFF = '#c6b582';
const CHALK = '#f2f1e4';
const OLIVE = '#8c8150';
const DEEP = '#5c5a38';
const BROWN = '#806a3c';
const SHEEN = '#8fcfc4';
const LILAC = '#c3b2d2';
const SAND = '#e6d6b0';
const SEA = '#19a5ad';
const GLINT = '#effaf6';

/** Vertical squash of the bed; the water flattens what stands in it (refraction). */
const FLAT = 0.42;
const RISE = 0.54;
const SCALE = 1.12;
const BOX = { w: 86, h: 86, ax: 0.5, ay: 0.74 };

interface Band {
  /** radius as a fraction of the fan's full radius */
  f: number;
  chalk: boolean;
  /** half-width in fan units */
  w: number;
  /** the share of the span it crosses: bands break off short of the frond's edges */
  from: number;
  to: number;
}

interface Fan {
  id: string;
  x: number;
  z: number;
  /** height of the apex on its short stalk */
  stalk: number;
  /** the cup's lean: azimuth (0 = +x, toward the viewer positive) and tilt off vertical */
  az: number;
  tilt: number;
  /** the cone's half-angle: small is a deep funnel, near 90° a flat blade */
  cone: number;
  span: number;
  radius: number;
  window: [number, number];
  bands: Band[];
  ribs: number[];
  phase: [number, number];
  /** 0 olive-buff … 1 chalky */
  chalk: number;
  /** one side of the frond grows wider than the other (an ear, not a scallop) */
  ear: number;
  /** splits in the rim: where (share of the span) and how deep */
  notches: [number, number][];
}

export interface PeacocksTailPlan {
  fans: Fan[];
  stone: { x: number; z: number; rx: number; rz: number; seed: number };
  grains: { x: number; z: number; r: number }[];
  glints: { y: number; x0: number; x1: number; phase: number }[];
}

/** Seen through the surface: what stands in the water wavers a little from side to side. */
const project = (x: number, z: number, h: number): Pt => {
  const y = z * FLAT - h * RISE;
  return { x: x + 0.45 * Math.sin(y * 0.8) + 0.25 * Math.sin(y * 1.9 + 1), y };
};

interface Template {
  x: number;
  z: number;
  r: number;
  az: number;
  tilt: number;
  cone: number;
  span: number;
  window: [number, number];
}

/** A wide funnel, an ear leaning left, a funnel and an ear behind on the right, a young funnel in front. */
const TEMPLATES: Template[] = [
  { x: 0, z: 1, r: 19, az: Math.PI / 2, tilt: 0.42, cone: 0.95, span: 4.4, window: [0, 0.52] },
  { x: -16, z: 4, r: 16, az: Math.PI / 2 + 1.1, tilt: 0.75, cone: 1.12, span: 3.1, window: [0.18, 0.64] },
  { x: 16, z: 2, r: 14, az: 0.4, tilt: 0.6, cone: 1.0, span: 3.6, window: [0.34, 0.78] },
  { x: -4, z: -6, r: 14, az: Math.PI / 2 - 0.5, tilt: 0.5, cone: 1.05, span: 3.3, window: [0.5, 0.9] },
  { x: 7, z: 8, r: 10, az: Math.PI / 2 + 0.4, tilt: 0.35, cone: 0.85, span: 4.8, window: [0.62, 1] },
];

export function planPeacocksTail(rng: Rng): PeacocksTailPlan {
  const fans: Fan[] = TEMPLATES.map((t, i) => {
    const r = rng.fork(`fan${i}`);
    const radius = t.r * SCALE * r.range(0.9, 1.1);
    const nb = r.int(10, 14);
    const bands: Band[] = [];
    for (let b = 0; b < nb; b++) {
      const f = 0.14 + 0.82 * ((b + r.range(0.05, 0.75)) / nb) ** 0.9;
      const chalk = b % 2 === 0;
      const broken = r.chance(0.45);
      bands.push({
        f: Math.min(0.96, f),
        chalk,
        w: (chalk ? r.range(0.45, 1.05) : b % 4 === 3 ? r.range(1.3, 1.8) : r.range(0.22, 0.5)) * Math.max(0.7, radius / 24),
        from: broken ? r.range(0.02, 0.3) : r.range(0, 0.06),
        to: broken ? r.range(0.7, 0.98) : r.range(0.94, 1),
      });
    }
    return {
      id: `f${i}`,
      x: (t.x + r.range(-2.5, 2.5)) * SCALE,
      z: (t.z + r.range(-1.5, 1.5)) * SCALE,
      stalk: r.range(1.2, 2.6) * SCALE,
      az: t.az + r.range(-0.3, 0.3),
      tilt: t.tilt + r.range(-0.1, 0.1),
      cone: t.cone + r.range(-0.08, 0.08),
      span: t.span * r.range(0.92, 1.06),
      radius,
      window: t.window,
      bands,
      ribs: Array.from({ length: r.int(5, 8) }, () => r.range(-0.48, 0.48)),
      phase: [r.range(0, 6.28), r.range(0, 6.28)],
      chalk: r.range(0.3, 0.85),
      ear: r.range(0.2, 0.42) * (r.chance(0.5) ? 1 : -1),
      notches: Array.from({ length: r.int(1, 3) }, () => [r.range(-0.4, 0.4), r.range(0.18, 0.4)] as [number, number]),
    };
  });
  const stone = { x: rng.range(-2, 2), z: 3, rx: rng.range(15, 18) * SCALE, rz: rng.range(7, 8.5) * SCALE, seed: rng.int(1, 1e9) };
  const grains = Array.from({ length: 12 }, () => ({ x: rng.range(-22, 22), z: rng.range(7, 16), r: rng.range(0.5, 0.95) }));
  const glints = Array.from({ length: 3 }, (_, i) => {
    const c = rng.range(-14, 14);
    const half = rng.range(7, 13);
    return { y: -6 - i * rng.range(4, 6), x0: c - half, x1: c + half, phase: rng.range(0, 6.28) };
  });
  return { fans, stone, grains, glints };
}

export interface FanPose {
  id: string;
  k: number;
  /** drawing order key: farther first */
  z: number;
  lift: number;
  apex: Pt;
  rim: Pt[];
  rimIn: Pt[];
  rimOut: Pt[];
  body: Pt[];
  throat: Pt[];
  shade: Pt[];
  rings: { pts: Pt[]; w: number; chalk: boolean; k: number }[];
  ribs: Pt[][];
  seed: number;
  chalk: number;
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

export interface PeacocksTailPose {
  fans: FanPose[];
  stone: { x: number; y: number; rx: number; ry: number; k: number; seed: number } | null;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** The point of a fan at fan angle phi and radius r (fan units), projected for the cliff's view. */
function fanPoint(f: Fan, phi: number, r: number): Pt {
  const { az, tilt: t, cone: c } = f;
  const ca = Math.cos(az);
  const sa = Math.sin(az);
  const N = { x: Math.sin(t) * ca, z: Math.sin(t) * sa, h: Math.cos(t) };
  const back = { x: -Math.cos(t) * ca, z: -Math.cos(t) * sa, h: Math.sin(t) };
  const side = { x: -sa, z: ca, h: 0 };
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const sc = Math.sin(c);
  const cc = Math.cos(c);
  const dx = N.x * cc + (back.x * cp + side.x * sp) * sc;
  const dz = N.z * cc + (back.z * cp + side.z * sp) * sc;
  const dh = N.h * cc + (back.h * cp + side.h * sp) * sc;
  return project(f.x + dx * r, f.z + dz * r, Math.max(0, f.stalk + dh * r));
}

/** Every mark of the plant at growth g: a pure function, so a session's frames match. */
export function posePeacocksTail(plan: PeacocksTailPlan, g: number): PeacocksTailPose {
  const fans: FanPose[] = [];
  for (const f of plan.fans) {
    const k = ease(g, f.window[0], f.window[1]);
    if (!visible(k)) continue;
    const R = f.radius * k;
    // a young frond is a small flat fan; it rolls into its funnel as it grows
    const span = f.span * (0.5 + 0.5 * smooth(k * 1.3));
    const M = 36;
    const phis = Array.from({ length: M + 1 }, (_, i) => (i / M - 0.5) * span);
    const ruffle = (phi: number) => {
      const u = phi / span;
      let r = 1 + f.ear * 2 * u + 0.05 * Math.sin(phi * 5.3 + f.phase[0]) + 0.03 * Math.sin(phi * 12 + f.phase[1]);
      for (const [at, depth] of f.notches) r -= depth * Math.exp(-(((u - at) / 0.035) ** 2));
      return r - 0.12 * smooth((Math.abs(u) - 0.38) / 0.12);
    };
    const rimAt = (r: number) => phis.map((phi) => fanPoint(f, phi, r * ruffle(phi)));
    const apex = fanPoint(f, 0, 0);
    const rim = rimAt(R);
    const sector = (r: number, from = 0, to = M): Pt[] => [apex, ...rimAt(r).slice(from, to + 1)];
    const rings = f.bands
      .map((b) => {
        const rk = smooth((k - b.f * 0.96) / 0.1);
        const i0 = 1 + Math.round(b.from * (M - 2));
        const i1 = 1 + Math.round(b.to * (M - 2));
        const pts = phis.slice(i0, i1 + 1).map((phi) => fanPoint(f, phi * 0.97, f.radius * b.f * (1 + (ruffle(phi) - 1) * b.f)));
        return { pts, w: b.w * rk, chalk: b.chalk, k: rk };
      })
      .filter((b) => visible(b.k));
    const ribs = f.ribs.map((u) => [0.2, 0.45, 0.7, 0.92].map((s) => fanPoint(f, u * span, R * s * ruffle(u * span))));
    const all = [...rim, apex];
    const x0 = Math.min(...all.map((q) => q.x));
    const x1 = Math.max(...all.map((q) => q.x));
    const y0 = Math.min(...all.map((q) => q.y));
    const y1 = Math.max(...all.map((q) => q.y));
    const lift = clamp01(-(y0 + y1) / 2 / 22);
    fans.push({
      id: f.id,
      k,
      z: f.z,
      lift,
      apex,
      rim,
      rimIn: rimAt(R * 0.94),
      rimOut: rimAt(R * 1.02),
      body: [apex, ...rim],
      throat: sector(R * 0.36),
      shade: sector(R * 0.96, Math.round(M * 0.62), M),
      rings,
      ribs: k > 0.3 ? ribs : [],
      seed: hash(f.id),
      chalk: f.chalk,
      bounds: { x0, x1, y0, y1 },
    });
  }
  fans.sort((a, b) => a.z - b.z);
  const s = plan.stone;
  const sk = ease(g, 0, 0.14);
  return { fans, stone: visible(sk) ? { x: s.x, y: s.z * FLAT, rx: s.rx, ry: s.rz * FLAT, k: sk, seed: s.seed } : null };
}

/** Every painted point of the full-grown plant (for the box test). */
export function peacocksTailReach(plan: PeacocksTailPlan): Pt[] {
  const pose = posePeacocksTail(plan, 1);
  const pts: Pt[] = [];
  for (const f of pose.fans) {
    pts.push(...f.rim, f.apex);
    for (const b of f.rings) pts.push(...b.pts.flatMap((q) => [{ x: q.x, y: q.y - b.w }, { x: q.x, y: q.y + b.w }]));
  }
  const s = pose.stone;
  if (s) pts.push({ x: s.x - s.rx * 1.6, y: s.y - s.ry * 2.8 }, { x: s.x + s.rx * 1.6, y: s.y + s.ry * 1.8 });
  return pts;
}

type Area = { x: number; y: number; w: number; h: number };

/** Sinks a pigment into the sea's colour: little for the pale tops, more low down. */
const underWater = (pigment: Pigment, lift: number, share = 0.14) => mix(mix(pigment, SEA, lerp(share, share * 0.45, lift)), PIGMENTS.stone, 0.03);

function blob(cx: number, cy: number, rx: number, ry: number, seed: number, wob = 0.12): Pt[] {
  const pts: Pt[] = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 1 + Math.sin(a * 2 + seed) * wob + Math.sin(a * 3 + seed * 1.7) * wob * 0.5;
    pts.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r });
  }
  return pts;
}

/** The stone sunk in the water, and the cluster's soft shadow on it and on the bottom. */
function drawStone(p: Painter, pose: PeacocksTailPose, area: Area, near: number) {
  const s = pose.stone;
  if (!s) return;
  const L = p.layer(area);
  // from afar the stone is only a darker patch of the bottom
  const st = lerp(0.45, 1, near);
  const sr = s.seed % 100;
  const cool = mix(PIGMENTS.shadow, SEA, 0.6);
  // the hollow the stone sits in, a shade deeper than the water round it
  L.fill(blob(s.x + 1, s.y - s.ry * 0.2, s.rx * 1.3 * s.k, s.ry * 2.2 * s.k, sr + 4, 0.18), mix(SEA, PIGMENTS.shadow, 0.25), 0.16 * s.k);
  L.fill(blob(s.x + 4, s.y + s.ry * 0.7, s.rx * 1.3 * s.k, s.ry * 0.85 * s.k, sr), cool, 0.16 * s.k);
  L.fill(blob(s.x, s.y, s.rx * s.k, s.ry * 1.1 * s.k, sr + 1), underWater(mix(PIGMENTS.stone, '#8f7a5e', 0.4), 0, 0.42), 0.42 * s.k * st);
  L.fill(blob(s.x - s.rx * 0.2, s.y - s.ry * 0.3, s.rx * 0.6 * s.k, s.ry * 0.55 * s.k, sr + 2), underWater(mix(PIGMENTS.stone, '#c4b494', 0.5), 0, 0.4), 0.3 * s.k * st);
  for (const f of pose.fans) {
    const w = (f.bounds.x1 - f.bounds.x0) * 0.42;
    L.fill(blob(f.apex.x + w * 0.35 + 2, f.apex.y + 2.2, w, 2.6 * f.k, f.seed % 50, 0.2), cool, 0.2 * f.k);
  }
  L.lift(blob(s.x - s.rx * 0.35, s.y - s.ry * 0.6, s.rx * 0.25 * s.k, s.ry * 0.2 * s.k, sr), 0.25);
  L.dry({ opacity: 0.8, edge: 0.08, edgeWidth: 1.2, sharpness: 0.15, centreLift: 0.1, granulation: 0.5, flow: 0.45, flowScale: 8 });
}

const pad = (b: FanPose['bounds'], m: number): Area => ({ x: b.x0 - m, y: b.y0 - m, w: b.x1 - b.x0 + 2 * m, h: b.y1 - b.y0 + 2 * m });

/**
 * One frond: a thin, pale wash the water shows through, its throat in shadow, the chalk bands
 * and the rolled rim, the sea's tint rising over its lower part; then the dry hairlines.
 */
function drawFan(p: Painter, f: FanPose, near: number) {
  const area = pad(f.bounds, 4);
  const A = p.layer(area);
  const tone = mix(mix(BUFF, OLIVE, 0.08), CHALK, 0.15 + 0.35 * f.chalk);
  // from afar the bands and hairlines melt into one pale frond (they read as crinkled discs)
  const band = lerp(0.3, 1, near);
  A.fill(f.body, underWater(tone, f.lift, 0.22), lerp(0.36, 0.28, near));
  for (const b of f.rings) {
    if (!b.chalk) continue;
    const poly = ribbon(b.pts, (t) => b.w * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)) ** 0.4);
    if (poly) A.fill(poly, underWater(CHALK, f.lift, 0.12), 0.56 * b.k * lerp(0.55, 1, near));
  }
  const roll = ribbon(f.rim, (t) => 0.8 * smooth(f.k * 2) * (0.35 + 0.65 * Math.abs(Math.sin(t * 9 + f.seed))));
  if (roll) A.fill(roll, underWater(CHALK, f.lift, 0.1), 0.32 * band);
  // the water over the frond: its foot fades into the water's own colour, the rolled rim stays clear
  const { y0, y1 } = f.bounds;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const ya = lerp(y1 + 1, y0, (i + 1) / n);
    const yb = lerp(y1 + 1, y0, i / n);
    A.lift([{ x: f.bounds.x0 - 2, y: ya }, { x: f.bounds.x1 + 2, y: ya }, { x: f.bounds.x1 + 2, y: yb }, { x: f.bounds.x0 - 2, y: yb }], 0.42 * (1 - i / n) ** 1.3);
  }
  // from afar the water's own colour over the whole frond, inside it, so it sits under the surface
  if (near < 0.95) A.fill(f.body, mix(SEA, PIGMENTS.stone, 0.2), 0.3 * (1 - near));
  A.dry({ opacity: 0.9, edge: 0.1, edgeWidth: 0.5, sharpness: 0.1, centreLift: 0.05, granulation: 0.3, flow: 0.45, flowScale: 6, darken: 0.06, blend: 'source-over' });

  const B = p.layer(area);
  B.fill(f.throat, underWater(mix(BROWN, DEEP, 0.3), f.lift, 0.2), 0.26 * band);
  B.fill(f.shade, underWater(mix(OLIVE, PIGMENTS.shadow, 0.3), f.lift, 0.2), 0.14 * band);
  let any = false;
  for (const b of f.rings) {
    if (b.chalk) continue;
    // most are hairlines; every other one is a broad olive-brown zone that still shows from afar
    const zone = b.w > 1;
    const poly = ribbon(b.pts, (t) => b.w * (zone ? 0.55 : 0.4) * Math.sin(Math.PI * t) ** 0.5);
    if (poly) {
      B.fill(poly, underWater(zone ? mix(BROWN, BUFF, 0.25) : mix(BROWN, DEEP, 0.2), f.lift, 0.12), (zone ? 0.32 : 0.55) * b.k * band);
      any = true;
    }
  }
  for (const r of f.ribs) {
    const poly = ribbon(r, (t) => 0.26 * (1 - 0.5 * t));
    if (poly) B.fill(poly, underWater(OLIVE, f.lift, 0.2), 0.1);
  }
  const inside = ribbon(f.rimIn, (t) => 0.4 * smooth(f.k * 2) * (0.6 + 0.4 * Math.sin(t * 23 + f.seed)));
  if (inside) B.fill(inside, underWater(BROWN, f.lift), 0.22 * band);
  if (!any && !inside) {
    B.discard();
    return;
  }
  if (near > 0.05) {
    for (const b of f.rings) {
      if (b.chalk || b.k < 0.9 || b.w > 1) continue;
      const poly = ribbon(b.pts, () => b.w * 0.3);
      if (poly) B.fill(poly.map((q) => ({ x: q.x, y: q.y - 0.5 })), mix(b.w > 0.4 ? SHEEN : LILAC, SEA, 0.25), 0.22 * near);
    }
  }
  B.dry({ opacity: 0.8, edge: 0.2, edgeWidth: 0.35, sharpness: 0.45, centreLift: 0.04, granulation: 0.2, flow: 0.25, flowScale: 5, dry: 0.2, darken: 0.12 });
}

/** The short stalks, the holdfast and a few sand grains round the stone. */
function drawBase(p: Painter, plan: PeacocksTailPlan, pose: PeacocksTailPose, area: Area, near: number) {
  const L = p.layer(area);
  let any = false;
  for (const f of pose.fans) {
    const src = plan.fans.find((q) => q.id === f.id)!;
    const base = project(src.x * 0.6, src.z * 0.6, 0);
    const poly = ribbon([base, { x: lerp(base.x, f.apex.x, 0.5), y: lerp(base.y, f.apex.y, 0.5) }, f.apex], (t) => (0.7 - 0.3 * t) * smooth(f.k * 3));
    if (poly) {
      L.fill(poly, underWater(mix(OLIVE, DEEP, 0.4), 0, 0.3), 0.5);
      any = true;
    }
  }
  const s = pose.stone;
  if (s) {
    L.fill(blob(s.x, s.y - 1, 4 * s.k, 1.5 * s.k, 3, 0.2), underWater(mix(OLIVE, DEEP, 0.5), 0, 0.3), 0.22);
    any = true;
    if (near > 0.05) for (const gr of plan.grains) L.fill(blob(gr.x, gr.z * FLAT, gr.r, gr.r * 0.7, 1, 0.1), underWater(SAND, 0, 0.25), 0.5 * near);
  }
  if (!any) {
    L.discard();
    return;
  }
  L.dry({ opacity: 0.8, edge: 0.25, edgeWidth: 0.4, sharpness: 0.35, centreLift: 0.05, granulation: 0.3, flow: 0.3, flowScale: 5 });
}

/** The surface over the cluster: a few broken lines of light where the ripples catch the sky. */
function drawSurface(p: Painter, plan: PeacocksTailPlan, pose: PeacocksTailPose, area: Area) {
  const k = pose.fans.length ? Math.max(...pose.fans.map((f) => f.k)) : 0;
  if (k < 0.3) return;
  const L = p.layer(area);
  const c = L.ctx;
  c.save();
  c.beginPath();
  for (const f of pose.fans) f.body.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
  c.clip();
  for (const gl of plan.glints) {
    const pts = Array.from({ length: 9 }, (_, i) => {
      const x = lerp(gl.x0, gl.x1, i / 8);
      return { x, y: gl.y + 0.6 * Math.sin(x * 0.45 + gl.phase) };
    });
    const poly = ribbon(pts, (t) => 0.6 * Math.sin(Math.PI * t) ** 0.7 * (0.4 + 0.6 * Math.sin(t * 17 + gl.phase) ** 2));
    if (poly) L.fill(poly, GLINT, 0.6 * smooth((k - 0.3) / 0.4));
  }
  c.restore();
  L.dry({ opacity: 0.8, edge: 0.05, edgeWidth: 0.3, sharpness: 0.3, centreLift: 0, granulation: 0.1, flow: 0.3, flowScale: 4, blend: 'source-over' });
}

const peacocksTail: SpeciesDef = {
  id: 'peacocks-tail',
  name: "Peacock's Tail",
  nativeName: 'Padina pavonica',
  nativeLang: 'la',
  // a warm-sea alga of rock pools and shallow rocks, wild only
  range: { realms: ['mediterranean'], biomes: ['marine'], climates: ['mediterranean'] },
  tier: 1,
  habitats: ['water'],
  sizeClass: 'small',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: "Peacock's tail — chalky banded fans on a stone in a rock pool.",
  bloomColor: '#c9c0a0',
  pollinators: false,
  // under the water: the low sun leaves no warm rim on it, and the surface mirrors nothing of it
  rimLight: false,
  reflect: false,
  draw(p, rng, opts) {
    const plan = planPeacocksTail(rng.fork('plan'));
    const pose = posePeacocksTail(plan, opts.growth);
    const near = smooth((opts.w / BOX.w - 1.5) / 3);
    const end = plantFrame(p, this, opts);
    try {
      const area = { x: -BOX.w * BOX.ax, y: -BOX.h * BOX.ay, w: BOX.w, h: BOX.h };
      drawStone(p, pose, area, near);
      drawBase(p, plan, pose, area, near);
      for (const f of pose.fans) drawFan(p, f, near);
      drawSurface(p, plan, pose, area);
    } finally {
      end();
    }
  },
};

export default peacocksTail;
