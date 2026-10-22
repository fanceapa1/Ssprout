import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, shade, type Painter, type Pigment, type Pt } from '../../paint';
import { ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { INK_GREEN, dabAxis, groundShadow, paintBud, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, makeStem, pointAt, projectDir, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Dandelion (tanpopo): a flat rosette of jagged, back-toothed leaves; hollow stalks carrying
 * round heads of countless narrow golden florets in rings — and sometimes one stalk already
 * holding a pale seed clock, a sphere of fine silk.
 */

interface Leaf {
  angle: number;
  length: number;
  width: number;
  curve: number;
  teeth: number;
  window: [number, number];
  tone: Pigment;
}

interface Head {
  stem: StemPlan;
  tilt: number;
  roll: number;
  size: number;
  clock: boolean;
  /** ray florets per ring, outermost first: [angle, length factor] */
  rings: { a: number; len: number }[][];
  /** seed clock filaments: direction on the sphere (u across, h up, z toward the viewer) */
  silk: { u: number; h: number; z: number; len: number }[];
  bud: [number, number];
  open: [number, number];
}

export interface DandelionPlan {
  leaves: Leaf[];
  heads: Head[];
  gold: Pigment;
}

export function planDandelion(rng: Rng): DandelionPlan {
  const green = jitter(mix(PIGMENTS.sage, PIGMENTS.sap, 0.4), rng, 0.03);
  const gold = jitter(mix(PIGMENTS.gold, '#edb600', 0.6), rng, 0.02);
  const n = rng.int(6, 9);
  const rot = rng.range(0, 1);
  const leaves: Leaf[] = [];
  for (let i = 0; i < n; i++) {
    // a rosette seen from the side: leaves fan from almost flat to steeply up
    const u = (i + rot) / n - 0.5;
    leaves.push({
      angle: UP + u * 2.9 + rng.gaussian(0, 0.12),
      length: rng.range(13, 19) * (1 - Math.abs(u) * 0.35),
      width: rng.range(3.4, 4.6),
      curve: rng.gaussian(0, 0.12) - u * 0.25,
      teeth: rng.int(3, 5),
      window: [...stagger(i, n, [0.06, 0.48], 0.45)] as [number, number],
      tone: jitter(green, rng, 0.035),
    });
  }
  const nh = rng.int(2, 3);
  const clockAt = rng.chance(0.4) ? rng.int(0, nh - 1) : -1;
  const heads: Head[] = [];
  const flip = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < nh; i++) {
    const side = (i % 2 === 0 ? 1 : -1) * flip;
    const rings: { a: number; len: number }[][] = [];
    for (const [count, len] of [
      [26, 1],
      [20, 0.78],
      [14, 0.55],
    ] as const) {
      const ring: { a: number; len: number }[] = [];
      const r0 = rng.range(0, Math.PI * 2);
      for (let j = 0; j < count; j++) ring.push({ a: r0 + (j / count) * Math.PI * 2 + rng.gaussian(0, 0.06), len: len * rng.range(0.85, 1.12) });
      rings.push(ring);
    }
    const silk: Head['silk'] = [];
    for (let j = 0; j < 34; j++) {
      const h = rng.range(-1, 1);
      const a = rng.range(0, Math.PI * 2);
      const ring = Math.sqrt(1 - h * h);
      silk.push({ u: Math.cos(a) * ring, h, z: Math.sin(a) * ring, len: rng.range(0.85, 1.1) });
    }
    heads.push({
      stem: makeStem(rng, { length: rng.range(22, 32) * (i === 0 ? 1 : rng.range(0.72, 0.9)) * (i === clockAt ? 1.12 : 1), angle: UP + side * rng.range(0.14, 0.38) * (i === 0 ? 0.6 : i === 1 ? 1.5 : 2), bend: -side * rng.range(0, 0.3), segments: 8 }),
      tilt: rng.range(0.45, 0.8),
      roll: UP + side * rng.range(0, 0.4),
      size: rng.range(5.2, 6.4),
      clock: i === clockAt,
      rings,
      silk,
      bud: [...stagger(i, nh, [0.45, 0.76], 0.6)] as [number, number],
      open: [...stagger(i, nh, [0.75, 1], 0.7)] as [number, number],
    });
  }
  return { leaves, heads, gold };
}

function drawFlowerHead(p: Painter, rng: Rng, h: Head, c: Pt, openK: number, gold: Pigment) {
  const view = { tilt: lerp(0.25, h.tilt, openK), roll: h.roll };
  // reflexed green bracts under the head
  const bl = p.layer({ x: c.x - h.size * 1.5, y: c.y - h.size * 1.5, w: h.size * 3, h: h.size * 3 });
  for (let j = 0; j < 7; j++) {
    const a = h.roll + Math.PI + (j - 3) * 0.32;
    p.dabInto(bl, c, PIGMENTS.sage, { rng: rng.fork(`br-${j}`), variant: 'blade', angle: a, length: h.size * 0.55 * lerp(0.5, 1, openK), width: 0.9, pool: 0.3, layers: 2 });
  }
  bl.dry({ opacity: 0.7 * smooth(openK / 0.3), edge: 0.4, edgeWidth: 0.3, sharpness: 0.7, flowScale: 4 });
  // three rings of ray florets, each merged wet-in-wet, glazed outer → inner (paler → deeper)
  h.rings.forEach((ring, ri) => {
    const pig = ri === 0 ? lighten(gold, 0.2) : ri === 1 ? gold : mix(gold, PIGMENTS.vermilion, 0.06);
    const R = h.size * 1.3;
    const L = p.layer({ x: c.x - R, y: c.y - R, w: R * 2, h: R * 2 });
    const o = smooth(ease(openK, ri * 0.12, 0.7 + ri * 0.1));
    ring.forEach((f, j) => {
      const d = projectDir(f.a, view);
      const reach = Math.hypot(d.x, d.y);
      // closed: florets gather upward along the face direction
      const ang = Math.atan2(d.y, d.x);
      const closedAng = h.roll + Math.cos(f.a) * 0.25;
      const angle = closedAng + (((ang - closedAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * o;
      const len = h.size * f.len * lerp(0.4, 1, o) * lerp(0.5, Math.max(0.3, reach), o);
      p.dabInto(L, c, jitter(pig, rng.fork(`fj-${ri}-${j}`), 0.03), { rng: rng.fork(`f-${ri}-${j}`), variant: 'petal', angle, length: len, width: Math.max(0.5, h.size * 0.21 * f.len), pool: 0.25, basePool: 0.25, layers: 2 });
    });
    L.dry({ opacity: 0.86 * smooth(openK / 0.35), edge: 0.38, edgeWidth: 0.3, sharpness: 0.75, centreLift: 0.2, granulation: 0.06, flow: 0.35, flowScale: h.size, darken: 0.3 });
  });
}

function drawClock(p: Painter, rng: Rng, h: Head, c: Pt, openK: number) {
  const R = h.size * 1.45 * lerp(0.4, 1, openK);
  // a barely-there sphere glaze, then fine silk lines from the centre with tiny tufts
  p.glaze({ cx: c.x, cy: c.y, rx: R * 0.95, ry: R * 0.92 }, PIGMENTS.petalShade, { rng: rng.fork('sphere'), opacity: 0.12 * openK, edge: 0 });
  const L = p.layer({ x: c.x - R * 1.3, y: c.y - R * 1.3, w: R * 2.6, h: R * 2.6 });
  const ctx = L.ctx;
  ctx.lineCap = 'round';
  const sorted = h.silk.map((s, i) => ({ s, i })).sort((a, b) => a.s.z - b.s.z);
  for (const { s, i } of sorted) {
    const k = smooth(ease(openK, (i % 7) * 0.04, 0.6 + (i % 7) * 0.05));
    const len = R * s.len * k;
    const ex = c.x + s.u * len;
    const ey = c.y - s.h * len;
    ctx.strokeStyle = `rgba(122,118,128,${0.16 + 0.14 * (s.z + 1) * 0.5})`;
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(c.x + s.u * len * 0.12, c.y - s.h * len * 0.12);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const rr = rng.fork(`tuft-${i}`);
    ctx.strokeStyle = `rgba(150,146,156,${0.22 * k})`;
    for (let t = 0; t < 5; t++) {
      const a = Math.atan2(-s.h, s.u) + rr.range(-1, 1);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(a) * R * 0.1, ey + Math.sin(a) * R * 0.1);
      ctx.lineWidth = 0.12;
      ctx.stroke();
    }
  }
  L.dry({ opacity: 0.85, edge: 0, edgeWidth: 0.2, sharpness: 0.2, centreLift: 0, granulation: 0.05, flow: 0.4, flowScale: 3, darken: 0 });
  p.dab(c, mix(PIGMENTS.woodLight, PIGMENTS.stoneWarm, 0.5), { rng: rng.fork('receptacle'), variant: 'round', angle: 0, length: h.size * 0.28 * openK, width: h.size * 0.24 * openK, opacity: 0.6, edge: 0.3 });
}

function drawHead(p: Painter, rng: Rng, h: Head, plan: DandelionPlan, g: number) {
  const grow = ease(g, h.bud[0] - 0.16, h.open[0] + 0.05);
  if (!visible(grow)) return;
  const budK = ease(g, h.bud[0], h.bud[1]);
  const openK = smooth(ease(g, h.open[0], h.open[1]));
  const pts = stemPoints(h.stem, grow, 1);
  // hollow, pale stalks with a blush toward the base
  paintStem(p, rng.fork('stalk'), pts, { width: 0.8, opacity: 0.6, pigment: mix(PIGMENTS.sap, PIGMENTS.sakura, 0.15), wetness: 0.6 });
  if (!visible(budK)) return;
  const tip = pointAt(pts, 1);
  const c = { x: tip.x, y: tip.y };
  const fade = 1 - smooth(openK / 0.45);
  if (visible(fade)) {
    paintBud(p, rng.fork('bud'), c, {
      angle: tip.angle,
      length: h.size * 0.95,
      width: h.size * 0.6,
      k: budK,
      colour: h.clock ? 0.15 : ease(g, h.bud[1] - 0.1, h.open[0] + 0.05) * 0.5,
      pigment: h.clock ? PIGMENTS.petalShade : plan.gold,
      sepals: 4,
      sepalLen: 0.8,
      opacity: 0.85 * fade,
    });
  }
  if (!visible(openK)) return;
  if (h.clock) drawClock(p, rng.fork('clock'), h, c, openK);
  else drawFlowerHead(p, rng.fork('head'), h, c, openK, plan.gold);
}

const dandelion: SpeciesDef = {
  id: 'dandelion',
  name: 'Dandelion',
  nativeName: 'Tanpopo',
  tier: 1,
  habitats: ['meadow', 'path'],
  sizeClass: 'small',
  // drawn in a 70-unit design box, shown larger so it reads at garden scale
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.88 },
  description: 'Dandelion — a small sun, and later, a hundred wishes.',
  bloomColor: '#e8bc1f',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planDandelion(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 17, k: ease(g, 0.08, 0.6) });
      seedMound(p, r, g, { rx: 6 });
      plan.leaves.forEach((l, i) => {
        const k = ease(g, l.window[0], l.window[1]);
        if (!visible(k)) return;
        const e = smooth(k);
        runcinateLeaf(p, r.fork(`leaf-${i}`), { angle: lerpTo(UP, l.angle, e), length: l.length * e, width: l.width * lerp(0.3, 1, e), curve: l.curve * e }, l, e);
      });
      plan.heads.forEach((h, i) => drawHead(p, r.fork(`head-${i}`), h, plan, g));
    } finally {
      end();
    }
  },
};

/**
 * A runcinate leaf: a narrow midrib blade with lobes that point back toward the base, growing
 * larger toward the tip and ending in a broad arrow-shaped lobe — all in one wet layer.
 */
function runcinateLeaf(p: Painter, rng: Rng, pose: { angle: number; length: number; width: number; curve: number }, l: Leaf, e: number) {
  const { angle, length, width, curve } = pose;
  if (length < 0.8) return;
  const r = length * 1.25;
  const L = p.layer({ x: -r, y: -r, w: r * 2, h: r * 2 });
  const axis = dabAxis({ x: 0, y: 0 }, angle, length, curve, 20);
  p.dabInto(L, { x: 0, y: 0 }, l.tone, { rng: rng.fork('rib'), variant: 'blade', angle, length, width: width * 0.42, curve, pool: 0.4, basePool: 0.3, layers: 3 });
  for (let i = 0; i < l.teeth; i++) {
    const t = 0.3 + (0.5 * (i + 0.5)) / l.teeth;
    const q = axis[Math.round(t * 20)]!;
    const q2 = axis[Math.round(t * 20) + 1]!;
    const ta = Math.atan2(q2.y - q.y, q2.x - q.x);
    const size = width * lerp(0.55, 0.85, t) * (0.9 + ((i * 37) % 10) / 50);
    for (const sgn of [-1, 1]) {
      // lobes sweep back toward the base (runcinate), alternating a little along the rib
      const off = sgn * 0.04 * length;
      const at = { x: q.x + Math.cos(ta) * off, y: q.y + Math.sin(ta) * off };
      p.dabInto(L, at, l.tone, { rng: rng.fork(`lobe-${i}-${sgn}`), variant: 'leaf', angle: ta + sgn * 2.05, length: size, width: size * 0.62, curve: sgn * 0.15, pool: 0.35, basePool: 0.2, layers: 3 });
    }
  }
  // the broad terminal lobe
  const tq = axis[14]!;
  p.dabInto(L, tq, l.tone, { rng: rng.fork('tip'), variant: 'leaf', angle: angle + curve * 0.6, length: length * 0.32, width: width * 0.85, pool: 0.4, basePool: 0.2, layers: 3 });
  p.dabInto(L, { x: 0, y: 0 }, shade(l.tone, 0.18), { rng: rng.fork('mid'), variant: 'blade', angle, length: length * 0.88, width: width * 0.12, curve, pool: 0, basePool: 0.3, layers: 2 });
  L.dry({ opacity: 0.8 * lerp(0.6, 1, e), edge: 0.55, edgeWidth: Math.max(0.25, width * 0.07), sharpness: 0.72, centreLift: 0.28, granulation: 0.1, flow: 0.35, flowScale: Math.max(3, length * 0.5) });
  if (length > 6) {
    p.inkLine(dabAxis({ x: 0, y: 0 }, angle, length, curve, 6, 0.7), { rng: rng.fork('vein'), width: 0.25, pigment: INK_GREEN, opacity: 0.25 * e, breaks: 0.4, wobble: 0.2, taper: [0.05, 0.6] });
  }
}

function lerpTo(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default dandelion;
