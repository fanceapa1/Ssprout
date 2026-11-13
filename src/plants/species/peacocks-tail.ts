import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { ribbon } from '../lib/baikamo-paint';
import { clamp01, ease, lerp, smooth, visible } from '../lib/small-growth';
import { plantFrame } from '../lib/small-paint';
import type { SpeciesDef } from '../types';

/**
 * Peacock's tail (Padina pavonica): a small cluster of thin, chalk-dusted, fan-shaped fronds
 * curled into funnels, each with an inrolled upper rim and fine concentric bands, standing on one
 * holdfast on a stone in a rock pool or the shallows. Seen from the cliff through the water.
 */

const BODY = '#bcae82';
const CREAM = '#e6dcb4';
const CHALK = '#f4efdc';
const OLIVE = '#8d7c46';
const DEEP = '#6a5a32';
const SHEEN = '#8fcfc4';
const LILAC = '#c3b2d2';
const SAND = '#e6d6b0';
const SEA = '#19a5ad';

/** Vertical squash of the bed and the share of a rise that shows, as in the Posidonia. */
const FLAT = 0.42;
const RISE = 0.8;
const SCALE = 1.2;
const BOX = { w: 86, h: 86, ax: 0.5, ay: 0.74 };

interface Band {
  /** radius as a fraction of the fan's full radius */
  f: number;
  chalk: boolean;
  /** half-width in fan units */
  w: number;
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
  /** 0 olive-brown … 1 chalky */
  chalk: number;
  /** where along the rim a slit cuts in, as a share of the span */
  notch: number;
}

export interface PeacocksTailPlan {
  fans: Fan[];
  stone: { x: number; z: number; rx: number; rz: number; seed: number };
  grains: { x: number; z: number; r: number }[];
}

const project = (x: number, z: number, h: number): Pt => ({ x, y: z * FLAT - h * RISE });

interface Template {
  x: number;
  z: number;
  r: number;
  az: number;
  tilt: number;
  window: [number, number];
}

const TEMPLATES: Template[] = [
  { x: 0, z: 2, r: 22, az: Math.PI / 2, tilt: 0.85, window: [0, 0.52] },
  { x: -14, z: 5, r: 17, az: Math.PI / 2 + 0.8, tilt: 0.95, window: [0.18, 0.64] },
  { x: 14, z: 3, r: 16, az: 0.3, tilt: 1.2, window: [0.34, 0.78] },
  { x: -5, z: -6, r: 15, az: Math.PI / 2 - 0.3, tilt: 0.7, window: [0.5, 0.9] },
  { x: 8, z: 9, r: 11, az: Math.PI - 0.5, tilt: 1.15, window: [0.62, 1] },
];

export function planPeacocksTail(rng: Rng): PeacocksTailPlan {
  const fans: Fan[] = TEMPLATES.map((t, i) => {
    const r = rng.fork(`fan${i}`);
    const radius = t.r * SCALE * r.range(0.92, 1.08);
    const nb = r.int(9, 13);
    const bands: Band[] = [];
    for (let b = 0; b < nb; b++) {
      const f = 0.16 + 0.8 * ((b + r.range(0.1, 0.6)) / nb) ** 0.92;
      const chalk = b % 2 === 0;
      bands.push({ f: Math.min(0.97, f), chalk, w: (chalk ? r.range(0.6, 1.2) : r.range(0.3, 0.7)) * Math.max(0.7, radius / 24) });
    }
    return {
      id: `f${i}`,
      x: (t.x + r.range(-2.5, 2.5)) * SCALE,
      z: (t.z + r.range(-1.5, 1.5)) * SCALE,
      stalk: r.range(1.8, 3.6) * SCALE,
      az: t.az + r.range(-0.25, 0.25),
      tilt: t.tilt + r.range(-0.1, 0.1),
      cone: r.range(1.25, 1.45),
      span: r.range(2.5, 3.0),
      radius,
      window: t.window,
      bands,
      ribs: Array.from({ length: r.int(4, 7) }, () => r.range(-0.46, 0.46)),
      phase: [r.range(0, 6.28), r.range(0, 6.28)],
      chalk: r.range(0.25, 0.8),
      notch: r.range(-0.4, 0.4),
    };
  });
  const stone = { x: rng.range(-2, 2), z: 4, rx: rng.range(17, 20) * SCALE, rz: rng.range(8, 9.5) * SCALE, seed: rng.int(1, 1e9) };
  const grains = Array.from({ length: 12 }, () => ({ x: rng.range(-32, 32), z: rng.range(7, 18), r: rng.range(0.5, 0.95) }));
  return { fans, stone, grains };
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
  inner: Pt[];
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
    const span = f.span * (0.55 + 0.45 * smooth(k * 1.4));
    const M = 30;
    const phis = Array.from({ length: M + 1 }, (_, i) => (i / M - 0.5) * span);
    const ruffle = (phi: number) => 1 + 0.06 * Math.sin(phi * 5.1 + f.phase[0]) + 0.035 * Math.sin(phi * 11 + f.phase[1]) - 0.17 * Math.exp(-(((phi - f.notch * f.span) / 0.16) ** 2));
    const rimAt = (r: number) => phis.map((phi) => fanPoint(f, phi, r * ruffle(phi)));
    const apex = fanPoint(f, 0, 0);
    const rim = rimAt(R);
    const sector = (r: number, from = 0, to = M): Pt[] => [apex, ...rimAt(r).slice(from, to + 1)];
    const rings = f.bands
      .map((b) => {
        const rk = smooth((k - b.f * 0.96) / 0.1);
        const pts = phis.slice(1, -1).map((phi) => fanPoint(f, phi * 0.94, f.radius * b.f * (1 + (ruffle(phi) - 1) * b.f)));
        return { pts, w: b.w * rk, chalk: b.chalk, k: rk };
      })
      .filter((b) => visible(b.k));
    const ribs = f.ribs.map((u) => [0.22, 0.45, 0.7, 0.93].map((s) => fanPoint(f, u * span, R * s * ruffle(u * span))));
    const all = [...rim, apex];
    const x0 = Math.min(...all.map((q) => q.x));
    const x1 = Math.max(...all.map((q) => q.x));
    const y0 = Math.min(...all.map((q) => q.y));
    const y1 = Math.max(...all.map((q) => q.y));
    const lift = clamp01(-(y0 + y1) / 2 / 34);
    fans.push({
      id: f.id,
      k,
      z: f.z,
      lift,
      apex,
      rim,
      rimIn: rimAt(R * 0.93),
      rimOut: rimAt(R * 1.03),
      body: [apex, ...rim],
      inner: sector(R * 0.62),
      throat: sector(R * 0.34),
      shade: sector(R * 0.96, Math.round(M * 0.68), M),
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
  if (s) pts.push({ x: s.x - s.rx, y: s.y - s.ry }, { x: s.x + s.rx, y: s.y + s.ry * 1.4 });
  return pts;
}

type Area = { x: number; y: number; w: number; h: number };

/** Sinks a pigment into the sea's colour: little for the pale fans, more low down. */
const underWater = (pigment: Pigment, lift: number, share = 0.09) => mix(mix(pigment, SEA, lerp(share, share * 0.5, lift)), PIGMENTS.stone, 0.03);

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

function drawStone(p: Painter, pose: PeacocksTailPose, area: Area) {
  const s = pose.stone;
  if (!s) return;
  const L = p.layer(area);
  const sr = s.seed % 100;
  L.fill(blob(s.x + 1.5, s.y + s.ry * 0.5, s.rx * 1.05 * s.k, s.ry * 0.7 * s.k, sr), mix(PIGMENTS.shadow, SEA, 0.55), 0.18 * s.k);
  L.fill(blob(s.x, s.y, s.rx * s.k, s.ry * 1.1 * s.k, sr + 1), underWater(mix(PIGMENTS.stone, '#8f7a5e', 0.5), 0.1, 0.27), 0.62 * s.k);
  L.fill(blob(s.x - s.rx * 0.2, s.y - s.ry * 0.3, s.rx * 0.6 * s.k, s.ry * 0.55 * s.k, sr + 2), underWater(mix(PIGMENTS.stone, '#c4b494', 0.5), 0.3, 0.27), 0.4 * s.k);
  L.fill(blob(s.x + s.rx * 0.25, s.y + s.ry * 0.35, s.rx * 0.45 * s.k, s.ry * 0.4 * s.k, sr + 3), underWater(DEEP, 0.1, 0.27), 0.3 * s.k);
  L.lift(blob(s.x - s.rx * 0.35, s.y - s.ry * 0.6, s.rx * 0.25 * s.k, s.ry * 0.2 * s.k, sr), 0.3);
  L.dry({ opacity: 0.8, edge: 0.15, edgeWidth: 0.6, sharpness: 0.2, centreLift: 0.08, granulation: 0.55, flow: 0.4, flowScale: 8 });
}

const pad = (b: FanPose['bounds'], m: number): Area => ({ x: b.x0 - m, y: b.y0 - m, w: b.x1 - b.x0 + 2 * m, h: b.y1 - b.y0 + 2 * m });

/** One fan: a pale wet wash with its throat in shadow and its chalk bands, then the dry hairlines. */
function drawFan(p: Painter, f: FanPose, near: number) {
  const area = pad(f.bounds, 4);
  const A = p.layer(area);
  const tone = mix(mix(BODY, OLIVE, 0.08), CREAM, 0.25 + 0.35 * f.chalk);
  A.fill(f.body, underWater(tone, f.lift), 0.9);
  A.fill(f.inner, underWater(mix(tone, OLIVE, 0.28), f.lift), 0.34);
  A.fill(f.throat, underWater(mix(OLIVE, DEEP, 0.4), f.lift, 0.3), 0.38);
  A.fill(f.shade, underWater(mix(OLIVE, PIGMENTS.shadow, 0.3), f.lift), 0.2);
  for (const b of f.rings) {
    if (!b.chalk) continue;
    const poly = ribbon(b.pts, () => b.w);
    if (poly) A.fill(poly, underWater(CHALK, f.lift, 0.05), 0.85 * b.k);
  }
  const roll = ribbon(f.rim, () => 0.9 * smooth(f.k * 2));
  if (roll) A.fill(roll, underWater(CHALK, f.lift, 0.04), 0.85);
  A.dry({ opacity: 0.88, edge: 0.08, edgeWidth: 0.4, sharpness: 0.3, centreLift: 0.04, granulation: 0.25, flow: 0.4, flowScale: 7, darken: 0.12, blend: 'source-over' });

  const B = p.layer(area);
  let any = false;
  for (const b of f.rings) {
    if (b.chalk) continue;
    const poly = ribbon(b.pts, () => b.w * 0.4);
    if (poly) {
      B.fill(poly, underWater(mix(OLIVE, DEEP, 0.2), f.lift), 0.45 * b.k);
      any = true;
    }
  }
  for (const r of f.ribs) {
    const poly = ribbon(r, (t) => 0.3 * (1 - 0.4 * t));
    if (poly) B.fill(poly, underWater(OLIVE, f.lift), 0.13);
  }
  const inside = ribbon(f.rimIn, () => 0.45 * smooth(f.k * 2));
  const edge = ribbon(f.rimOut, () => 0.3 * smooth(f.k * 2));
  if (inside) B.fill(inside, underWater(OLIVE, f.lift), 0.4);
  if (edge) B.fill(edge, underWater(mix(OLIVE, DEEP, 0.3), f.lift), 0.2);
  if (!any && !inside) {
    B.discard();
    return;
  }
  if (near > 0.05) {
    for (const b of f.rings) {
      if (b.chalk || b.k < 0.9) continue;
      const poly = ribbon(b.pts, () => b.w * 0.3);
      if (poly) B.fill(poly.map((q) => ({ x: q.x, y: q.y - 0.5 })), mix(b.k > 0.95 && b.w > 0.6 ? SHEEN : LILAC, SEA, 0.2), 0.25 * near);
    }
  }
  B.dry({ opacity: 0.8, edge: 0.2, edgeWidth: 0.35, sharpness: 0.5, centreLift: 0.04, granulation: 0.2, flow: 0.25, flowScale: 5, dry: 0.25, darken: 0.15 });
}

/** The short stalks, the holdfast knot and a few sand grains round the stone. */
function drawBase(p: Painter, plan: PeacocksTailPlan, pose: PeacocksTailPose, area: Area, near: number) {
  const L = p.layer(area);
  let any = false;
  for (const f of pose.fans) {
    const src = plan.fans.find((q) => q.id === f.id)!;
    const base = project(src.x, src.z, 0);
    const poly = ribbon([base, { x: lerp(base.x, f.apex.x, 0.5), y: lerp(base.y, f.apex.y, 0.5) }, f.apex], (t) => (0.8 - 0.35 * t) * smooth(f.k * 3));
    if (poly) {
      L.fill(poly, underWater(mix(OLIVE, DEEP, 0.5), 0.1), 0.7);
      any = true;
    }
  }
  const s = pose.stone;
  if (s) {
    L.fill(blob(s.x, s.y - 1, 5 * s.k, 1.8 * s.k, 3, 0.15), underWater(DEEP, 0.1), 0.3);
    any = true;
    if (near > 0.05) for (const gr of plan.grains) L.fill(blob(gr.x, gr.z * FLAT, gr.r, gr.r * 0.7, 1, 0.1), underWater(SAND, 0.2, 0.1), 0.6 * near);
  }
  if (!any) {
    L.discard();
    return;
  }
  L.dry({ opacity: 0.8, edge: 0.25, edgeWidth: 0.4, sharpness: 0.4, centreLift: 0.05, granulation: 0.3, flow: 0.3, flowScale: 5 });
}

const peacocksTail: SpeciesDef = {
  id: 'peacocks-tail',
  name: "Peacock's tail",
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
  // under the water: the low sun leaves no warm rim on it
  rimLight: false,
  draw(p, rng, opts) {
    const plan = planPeacocksTail(rng.fork('plan'));
    const pose = posePeacocksTail(plan, opts.growth);
    const near = smooth((opts.w / BOX.w - 1.5) / 3);
    const end = plantFrame(p, this, opts);
    try {
      const area = { x: -BOX.w * BOX.ax, y: -BOX.h * BOX.ay, w: BOX.w, h: BOX.h };
      drawStone(p, pose, area);
      drawBase(p, plan, pose, area, near);
      for (const f of pose.fans) drawFan(p, f, near);
    } finally {
      end();
    }
  },
};

export default peacocksTail;
