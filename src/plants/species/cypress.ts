import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { blob, bounds, dabOutline, padRect, ribbon, type Pt } from '../../paint/geometry';
import { mix, type Pigment } from '../../paint/pigments';
import { inUnits, softRes, stableLayer } from '../lib/tree-paint';
import { clamp01, ramp } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

/**
 * Mediterranean cypress (Cupressus sempervirens): the dark spire of Greek terraces and chapel
 * yards. A narrow flame of upswept scale-leaf sprays hugging a hidden trunk, ragged at the edge,
 * on a short bare grey-brown foot. docs/devlog/204-cypress.md.
 */

const SIZE = { w: 200, h: 220 };
const BASE = { x: SIZE.w / 2, y: SIZE.h * 0.94 };
const UP = -Math.PI / 2;
/** outline samples from the foliage's foot (0) to the tip */
const SAMPLES = 24;

export interface CypressSpray {
  /** height up the foliage 0..1 and side −1 (left, lit) … 1 (right, shade) */
  t: number;
  u: number;
  /** lean off vertical, radians (negative: left) */
  tilt: number;
  len: number;
  /** 0 lit, 1 mid, 2 shade */
  tone: 0 | 1 | 2;
  /** a long spray breaking the silhouette */
  out: boolean;
  id: number;
}

export interface CypressCone {
  t: number;
  u: number;
  r: number;
  delay: number;
  id: number;
}

export interface CypressPlan {
  /** foliage height and widest half-width at growth 1, species units */
  height: number;
  half: number;
  foot: number;
  /** axis sway: amplitude and phase */
  sway: number;
  phase: number;
  /** ragged outline factors per sample, left and right */
  left: number[];
  right: number[];
  sprays: CypressSpray[];
  cones: CypressCone[];
}

/** The flame's half-width at t (0 the foliage's foot … 1 the tip): a spindle, widest a third up. */
export function flame(t: number): number {
  const c = clamp01(t);
  return 1.2 * Math.pow(1 - c, 0.85) * (0.45 + 0.75 * ramp(c, 0, 0.35));
}

function ragged(r: Rng): number[] {
  const raw = Array.from({ length: SAMPLES + 1 }, () => 1 + r.range(-0.14, 0.16));
  return raw.map((v, i) => (v * 2 + (raw[i - 1] ?? v) + (raw[i + 1] ?? v)) / 4);
}

const at = (arr: readonly number[], t: number) => {
  const f = clamp01(t) * SAMPLES;
  const i = Math.min(SAMPLES - 1, Math.floor(f));
  return arr[i]! + (arr[i + 1]! - arr[i]!) * (f - i);
};

/** The whole cypress for a seed, independent of growth. */
export function planCypress(rng: Rng): CypressPlan {
  const r = rng.fork('shape');
  const foot = r.range(7, 10);
  const height = r.range(176, 186) - foot;
  const half = r.range(17, 20.5);
  const plan: CypressPlan = { height, half, foot, sway: r.range(1.5, 3.5) * (r.chance(0.5) ? 1 : -1), phase: r.range(0, Math.PI), left: ragged(r), right: ragged(r), sprays: [], cones: [] };

  const s = rng.fork('sprays');
  const rows = 52;
  for (let i = 0; i < rows; i++) {
    const t = (i + s.range(0.2, 0.8)) / rows;
    const w = flame(t);
    const n = Math.max(2, Math.round(w * 9));
    const shift = s.range(-0.5, 0.5);
    for (let j = 0; j < n; j++) {
      const u = Math.max(-1.05, Math.min(1.05, ((j + 0.5 + shift * 0.6) / n) * 2 - 1 + s.gaussian(0, 0.06)));
      const rim = Math.abs(u) > 0.7;
      const lightness = -u * 0.8 + (t - 0.5) * 0.3 + s.gaussian(0, 0.35);
      const tone: 0 | 1 | 2 = lightness > 0.55 ? 0 : lightness < -0.1 ? 2 : 1;
      plan.sprays.push({ t, u, tilt: u * (rim ? 0.55 : 0.3) + s.gaussian(0, 0.1), len: s.range(6, 8.5) * (0.8 + 0.2 * w), tone, out: false, id: plan.sprays.length });
    }
  }
  // one or two sprays break the silhouette, low to middle on the column
  const breaks = s.int(1, 2);
  const side0 = s.chance(0.5) ? 1 : -1;
  for (let b = 0; b < breaks; b++) {
    const side = b === 0 ? side0 : -side0;
    plan.sprays.push({ t: s.range(0.18, 0.55), u: side * 0.95, tilt: side * s.range(0.55, 0.8), len: s.range(14, 18), tone: 1, out: true, id: plan.sprays.length });
  }

  // small round cones in tight clusters in the lower half, near the rim
  const c = rng.fork('cones');
  const clusters = c.int(3, 5);
  for (let k = 0; k < clusters; k++) {
    const t = c.range(0.12, 0.55);
    const u = (c.chance(0.5) ? 1 : -1) * c.range(0.45, 0.85);
    const delay = c.next();
    const count = c.int(2, 4);
    for (let q = 0; q < count; q++) plan.cones.push({ t: t + c.range(-0.02, 0.02), u: u + c.range(-0.12, 0.12), r: c.range(1.3, 1.7), delay, id: plan.cones.length });
  }
  return plan;
}

export interface CypressPose {
  /** foliage foot and tip in species units, and the trunk */
  y0: number;
  tip: Pt;
  trunk: Pt[];
  trunkW: number;
  body: Pt[];
  /** the column a little inside the sprays, for the under-wash */
  core: Pt[];
  /** the column's right part, turned from the sun */
  shadeSide: Pt[];
  sprays: { id: string; base: Pt; angle: number; len: number; tone: 0 | 1 | 2; out: boolean; alpha: number }[];
  cones: { id: string; at: Pt; r: number; alpha: number }[];
  /** how young the colour still is, 1 a fresh sapling … 0 grown */
  youth: number;
}

/** Every mark of the cypress at growth g, in species units (pure, used by the painter and the tests). */
export function poseCypress(plan: CypressPlan, g: number): CypressPose {
  const r = clamp01(g / 0.92);
  const S = 0.08 + 0.92 * (1 - Math.pow(1 - r, 1.6));
  const Sw = Math.pow(S, 0.82);
  const marks = 0.45 + 0.55 * S;
  const foot = plan.foot * ramp(g, 0.35, 0.85);
  const y0 = BASE.y - foot;
  const H = plan.height * S;
  const axis = (t: number) => BASE.x + plan.sway * S * Math.sin(t * Math.PI * 0.9 + plan.phase) - plan.sway * S * Math.sin(plan.phase);
  const pt = (t: number, u: number): Pt => {
    const side = u < 0 ? at(plan.left, t) : at(plan.right, t);
    return { x: axis(t) + u * plan.half * Sw * flame(t) * side, y: y0 - t * H };
  };
  const body: Pt[] = [];
  for (let i = 0; i <= SAMPLES; i++) body.push(pt(i / SAMPLES, -1));
  for (let i = SAMPLES; i >= 0; i--) body.push(pt(i / SAMPLES, 1));
  const core: Pt[] = [];
  for (let i = 0; i <= SAMPLES; i++) core.push(pt(i / SAMPLES, -0.8));
  for (let i = SAMPLES; i >= 0; i--) core.push(pt(i / SAMPLES, 0.8));
  const shadeSide: Pt[] = [];
  for (let i = 0; i <= SAMPLES; i++) shadeSide.push(pt(i / SAMPLES, 0.12));
  for (let i = SAMPLES; i >= 0; i--) shadeSide.push(pt(i / SAMPLES, 0.86));
  const sprays = plan.sprays.map((s) => {
    const base = pt(s.t, s.u * 0.88);
    const len = s.len * marks * (s.out ? ramp(g, 0.45, 0.8) * 0.7 + 0.3 : 1);
    return { id: `s${s.id}`, base, angle: UP + s.tilt, len, tone: s.tone, out: s.out, alpha: s.out ? ramp(g, 0.3, 0.6) : 1 };
  });
  const cones = plan.cones.map((c) => ({ id: `c${c.id}`, at: pt(c.t, c.u), r: c.r * marks, alpha: ramp(g, 0.78 + c.delay * 0.08, 0.86 + c.delay * 0.08) }));
  const tip = pt(1, 0);
  return { y0, tip, trunk: [{ x: BASE.x, y: BASE.y + 1 }, { x: axis(0), y: y0 - 4 * S }], trunkW: 0.8 + 2.4 * S, body, core, shadeSide, sprays, cones, youth: 1 - ramp(g, 0.15, 0.6) };
}

/** The outermost points a grown cypress reaches (spray tips, breakouts, tip), for the box test. */
export function cypressReach(plan: CypressPlan): Pt[] {
  const pose = poseCypress(plan, 1);
  return [...pose.body, ...pose.sprays.map((s) => ({ x: s.base.x + Math.cos(s.angle) * s.len, y: s.base.y + Math.sin(s.angle) * s.len }))];
}

export const CYPRESS_COLOURS = {
  /** the light under-wash, the lit, mid and shade sprays, the shade glaze */
  wash: '#64795c',
  spray: ['#68845a', '#455f50', '#31443a'] as [Pigment, Pigment, Pigment],
  shade: '#2c3d36',
  young: '#7d9a62',
  bark: '#7c6b5a',
  cone: '#8a7d62',
  coneDark: '#4c4436',
};

/** Paint a cypress pose in species units (the caller sets the transform). */
export function paintCypress(p: Painter, pose: CypressPose, pr: Rng): void {
  const col = CYPRESS_COLOURS;
  const area = padRect(bounds([...pose.body, { x: BASE.x, y: BASE.y + 4 }]), 30);
  const scale = Math.min(1, (pose.y0 - pose.tip.y) / 170);

  const G = stableLayer(p, padRect(bounds([{ x: BASE.x - 30, y: BASE.y - 6 }, { x: BASE.x + 40, y: BASE.y + 6 }]), 4), pr.fork('ground'), softRes(p));
  G.fill(blob(BASE.x + 6 * scale, BASE.y + 1.5, 8 + 22 * scale, 2 + 2.5 * scale, pr.fork('ground-blob'), { points: 16, irregularity: 0.2 }), '#8f8a80', 0.35);
  G.dry({ opacity: 0.5, edge: 0.05, sharpness: 0.2, centreLift: 0.1, granulation: 0.2, flow: 0.4, flowScale: 12 });

  const T = stableLayer(p, area, pr.fork('trunk'));
  T.fill(ribbon(pose.trunk, (u) => pose.trunkW * (1 - 0.4 * u)), col.bark, 0.8);
  T.fill(ribbon(pose.trunk.map((q) => ({ x: q.x + pose.trunkW * 0.35, y: q.y })), (u) => pose.trunkW * 0.4 * (1 - 0.5 * u)), col.coneDark, 0.4);
  T.dry({ opacity: 0.9, edge: 0.3, edgeWidth: 0.6, sharpness: 0.7, centreLift: 0.1, granulation: 0.3, flow: 0.3, flowScale: 6 });

  const young = (c: Pigment) => mix(c, col.young, pose.youth * 0.45);
  const W = stableLayer(p, area, pr.fork('wash'), softRes(p));
  W.fill(pose.core, young(col.wash), 0.6);
  W.dry({ opacity: 0.85, edge: 0.05, edgeWidth: 2, sharpness: 0.15, centreLift: 0.15, granulation: 0.3, flow: 0.5, flowScale: 14 });

  const L = stableLayer(p, area, pr.fork('sprays'));
  const sr = pr.fork('spray-shapes');
  for (const s of pose.sprays) {
    if (s.alpha < 0.03 || s.len < 0.5) continue;
    const r = sr.fork(s.id);
    const pig = young(col.spray[s.tone]);
    const a = (s.tone === 2 ? 0.58 : 0.5) * (s.out ? 1.2 : 1) * s.alpha;
    if (s.out) L.fill(ribbon([s.base, { x: s.base.x + Math.cos(s.angle) * s.len * 0.6, y: s.base.y + Math.sin(s.angle) * s.len * 0.6 }], () => 0.5), col.bark, 0.5 * s.alpha);
    // a spray: a short central frond and two side fronds, all swept up
    const fronds = s.out ? 7 : 4;
    for (let f = 0; f < fronds; f++) {
      const k = (f % 2 ? 1 : -1) * r.range(0.1, 0.55);
      const along = (s.out ? 0.9 : 0.45) * s.len * (f / fronds);
      const bx = s.base.x + Math.cos(s.angle) * along + r.gaussian(0, 0.6);
      const by = s.base.y + Math.sin(s.angle) * along;
      const len = s.len * r.range(0.45, 0.7) * (s.out ? 0.55 : 1);
      L.fill(dabOutline(bx, by, { angle: s.angle + k + r.gaussian(0, 0.08), length: len, width: len * 0.55, variant: 'round', curve: k * 0.3 }, 7), pig, a);
    }
  }
  L.dry({ opacity: 0.9, edge: 0.3, edgeWidth: 0.5, sharpness: 0.6, centreLift: 0.1, granulation: 0.2, flow: 0.35, flowScale: 8, darken: 0.2 });

  // the shade side: a glaze down the right of the column, deepest low down
  const D = stableLayer(p, area, pr.fork('shade'), softRes(p));
  D.fill(pose.shadeSide, col.shade, 0.4);
  D.dry({ opacity: 0.8, edge: 0.08, edgeWidth: 2, sharpness: 0.25, centreLift: 0.1, granulation: 0.25, flow: 0.5, flowScale: 12 });

  const live = pose.cones.filter((c) => c.alpha > 0.03);
  if (live.length) {
    const C = stableLayer(p, area, pr.fork('cones'));
    for (const c of live) {
      const r = pr.fork(c.id);
      C.fill(blob(c.at.x, c.at.y, c.r, c.r * 0.92, r, { points: 9, irregularity: 0.12 }), col.cone, 0.85 * c.alpha);
      C.fill(blob(c.at.x + c.r * 0.3, c.at.y + c.r * 0.3, c.r * 0.45, c.r * 0.4, r, { points: 7, irregularity: 0.2 }), col.coneDark, 0.45 * c.alpha);
    }
    C.dry({ opacity: 0.9, edge: 0.45, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.3, granulation: 0.2, flow: 0.2, flowScale: 6, darken: 0.25 });
  }
}

const cypress: SpeciesDef = {
  id: 'cypress',
  name: 'Mediterranean Cypress',
  nativeName: 'Kyparissi',
  nativeLang: 'el-Latn',
  // wild in the eastern Mediterranean's hills (Crete, the south-east Aegean), planted all round it
  range: { realms: ['mediterranean'], biomes: ['scrub', 'coast'], climates: ['mediterranean'], cultivatedIn: ['mediterranean'] },
  tier: 4,
  habitats: ['meadow'],
  sizeClass: 'large',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Mediterranean cypress — a dark flame standing over the terrace.',
  bloomColor: '#4a6454',
  pollinators: false,
  reflect: false,
  draw(p, rng, opts) {
    const g = clamp01(opts.growth);
    const plan = planCypress(rng);
    inUnits(p, SIZE, opts, () => paintCypress(p, poseCypress(plan, g), rng.fork('paint')));
  },
};

export default cypress;
