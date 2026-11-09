import type { Rng } from '../../core/rng';
import type { Pt } from '../../paint/geometry';
import { mix } from '../../paint/pigments';
import {
  paintArbourShade,
  paintBunches,
  paintFrame,
  paintTendrils,
  paintVineLeaves,
  tendrilPath,
  type Berry,
  type Frame,
  type VineLeafMark,
} from '../lib/grapevine-paint';
import { paintBlots, paintShaggyBark, type Blot } from '../lib/katsura-paint';
import { inUnits, paintSeed, paintSkeleton, paintTipLeaves, softRes } from '../lib/tree-paint';
import { addBranch, clamp01, growLimb, normalise, pointAt, ramp, stagger, treeView, type Branch, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

/**
 * Grapevine arbour (Vitis vinifera): two or three old twisting trunks trained up a frame of
 * palm-trunk posts and a lashed crossbar, a roof of five-lobed leaves and bunches hanging in
 * its shade, purple and amber-green.
 */

const SIZE = { w: 320, h: 330 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;
const MARGIN = 9;

export type LeafLayer = 'back' | 'mid' | 'front';

export interface GrapeLeaf {
  x: number;
  y: number;
  angle: number;
  length: number;
  squash: number;
  /** how deep the clefts between the lobes are */
  depth: number;
  /** -0.5 in the roof's shade … 0.5 sun-lit */
  lit: number;
  layer: LeafLayer;
  /** turning amber at the end of the season */
  amber: boolean;
  delay: number;
  id: number;
}

export interface GrapeBunch {
  at: Pt;
  lean: number;
  purple: boolean;
  /** full length of the cluster from its stalk */
  length: number;
  berries: Berry[];
  delay: number;
  id: number;
}

export interface GrapevinePad {
  x: number;
  y: number;
  r: number;
  lit: number;
  layer: LeafLayer;
  delay: number;
  id: number;
}

export interface GrapevinePlan {
  tree: Tree;
  frame: Frame;
  /** the roof's extent: left and right ends, the beam's height and the roof's top over x */
  roof: { x0: number; x1: number; beamY: number; top: number[] };
  pads: GrapevinePad[];
  leaves: GrapeLeaf[];
  bunches: GrapeBunch[];
  tendrils: { pts: Pt[]; delay: number; id: number }[];
  flecks: { x: number; y: number; r: number }[];
}

const clampX = (x: number) => Math.max(MARGIN, Math.min(SIZE.w - MARGIN, x));
const clampPt = (q: Pt): Pt => ({ x: clampX(q.x), y: Math.max(MARGIN, Math.min(SIZE.h - 4, q.y)) });

/** The whole arbour for a seed — independent of growth. */
export function planGrapevine(rng: Rng): GrapevinePlan {
  const r = rng.fork('frame');
  const cx = SIZE.w / 2 + r.range(-6, 6);
  const half = r.range(84, 94);
  const beamY = BASE_Y - r.range(138, 150);
  const xL = cx - half;
  const xR = cx + half;
  const bdx = r.range(10, 15);
  const bdy = r.range(13, 17);
  const ov = [r.range(14, 22), r.range(14, 22)];
  const x0 = xL - ov[0]!;
  const x1 = xR + ov[1]!;
  const beamPts = (dx: number, dy: number) => [0, 0.33, 0.67, 1].map((u, i) => ({ x: x0 + (x1 - x0) * u + dx, y: beamY + dy + (i === 1 || i === 2 ? r.range(0, 1.8) : r.range(-1, 0.5)) }));
  const frame: Frame = {
    posts: [
      ...[xL, xR].map((x) => ({ x: x + bdx, base: BASE_Y - bdy, top: beamY - bdy - 3, w: r.range(4.5, 5.5), back: true, lean: r.gaussian(0, 0.01) })),
      ...[xL, xR].map((x) => ({ x, base: BASE_Y, top: beamY - 3, w: r.range(6.5, 8), back: false, lean: r.gaussian(0, 0.012) })),
    ],
    beams: [
      { pts: beamPts(bdx, -bdy), w: r.range(4, 5), back: true },
      { pts: beamPts(0, 0), w: r.range(5.5, 6.5), back: false },
    ],
    poles: [],
    knots: [
      { x: xL, y: beamY },
      { x: xR, y: beamY },
    ],
  };
  const np = r.int(7, 9);
  for (let k = 0; k < np; k++) {
    const x = x0 + 4 + ((x1 - x0 - 8) * (k + r.range(0.3, 0.7))) / np;
    frame.poles.push([
      { x: x - bdx * 0.2, y: beamY + 2 + bdy * 0.2 },
      { x: x + bdx * 1.2, y: beamY - bdy * 1.2 - 1 },
    ]);
  }

  // the roof: a deep band of leaves over the beam, a little domed and uneven on top
  const thick = r.range(70, 82);
  const ph = [r.range(0, 6.3), r.range(0, 6.3)];
  const COLS = 33;
  const top = Array.from({ length: COLS }, (_, i) => {
    const x = (SIZE.w * i) / (COLS - 1);
    const dome = 1 - ((x - cx) / (half + 30)) ** 2;
    return beamY - thick * (0.78 + 0.12 * Math.sin(x / 31 + ph[0]!) + 0.08 * Math.sin(x / 13 + ph[1]!)) - 10 * Math.max(0, dome);
  });
  const topAt = (x: number) => {
    const f = Math.max(0, Math.min(COLS - 1.001, (x / SIZE.w) * (COLS - 1)));
    const i = Math.floor(f);
    return top[i]! + (top[i + 1]! - top[i]!) * (f - i);
  };
  const roofX0 = x0 - 4;
  const roofX1 = x1 + 4;
  // ends of the roof slope down to the beam's ends
  const roofTop = (x: number) => {
    const e = Math.min(ramp(x, roofX0 - 4, roofX0 + 34), ramp(-x, -roofX1 - 4, -roofX1 + 34));
    return beamY + 6 - (beamY + 6 - topAt(x)) * (0.35 + 0.65 * e);
  };
  const bottom = beamY + 5;

  // the vine: two or three trunks at the posts' feet, cordons along the beam, canes into the roof
  const tree: Tree = { base: { x: cx, y: BASE_Y }, branches: [] };
  const vr = rng.fork('vine');
  const nT = vr.int(2, 3);
  const trunks: { foot: number; post: number; inward: number }[] = [
    { foot: xL + vr.range(7, 12), post: xL, inward: 1 },
    { foot: xR - vr.range(7, 12), post: xR, inward: -1 },
  ];
  if (nT === 3) {
    const left = vr.chance(0.5);
    trunks.push({ foot: left ? xL - vr.range(6, 9) : xR + vr.range(6, 9), post: left ? xL : xR, inward: left ? 1 : -1 });
  }
  const cordons: Branch[] = [];
  trunks.forEach((tk, k) => {
    const topPt = { x: tk.post + tk.inward * vr.range(2, 6), y: beamY + 1 };
    const amp = vr.range(4, 8);
    const turns = vr.range(0.8, 1.5);
    const phase = vr.range(0, Math.PI * 2);
    const crook = vr.range(-7, 7);
    const pts: Pt[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const e = t * t * (3 - 2 * t);
      pts.push({
        x: tk.foot + (topPt.x - tk.foot) * e + Math.sin(t * turns * Math.PI * 2 + phase) * amp * (1 - 0.6 * t) * Math.min(1, t * 5) + crook * Math.sin(Math.PI * t),
        y: BASE_Y - t * (BASE_Y - topPt.y),
      });
    }
    const third = k === 2;
    const trunk = addBranch(tree, -1, 0, { pts, w0: third ? vr.range(5.5, 7) : vr.range(9, 11.5), w1: third ? 2.8 : 4.6, t0: k * 0.05, t1: 0.6, tag: 'trunk' }, vr);
    if (third) {
      // the third one climbs on into the roof
      const cane = growLimb(vr, pointAt(trunk, 1), UP + tk.inward * vr.range(0.3, 0.7), vr.range(40, 60), { segments: 6, wander: 0.15 });
      cordons.push(addBranch(tree, trunk.id, 1, { pts: cane.map(clampPt), w0: 2.6, w1: 1, attach: 1, t0: 0.6, t1: 0.95, tag: 'cordon' }, vr));
      return;
    }
    for (const dir of [tk.inward, -tk.inward]) {
      const start = pointAt(trunk, 1);
      const len = dir === tk.inward ? Math.abs(cx - start.x) + vr.range(6, 26) : Math.abs((dir < 0 ? x0 : x1) - start.x) - vr.range(0, 5);
      if (len < 8) continue;
      const pts2 = growLimb(vr, start, dir < 0 ? Math.PI : 0, len, { segments: 8, wander: 0.1 });
      for (const q of pts2) q.y = q.y * 0.3 + (beamY - 2.5) * 0.7;
      cordons.push(addBranch(tree, trunk.id, 1, { pts: pts2.map(clampPt), w0: 4.4, w1: 1.4, attach: 1, t0: 0.58, t1: 0.92, tag: 'cordon' }, vr));
    }
  });
  const drops: Branch[] = [];
  for (const c of cordons) {
    const nc = Math.max(2, Math.round(c.len / 20));
    for (let i = 0; i < nc; i++) {
      const f = (i + vr.range(0.2, 0.8)) / nc;
      const at = pointAt(c, f);
      const t0 = c.t0 + (c.t1 - c.t0) * f;
      const end = at.x < x0 + 14 || at.x > x1 - 14;
      if (end || vr.chance(0.32)) {
        // a cane flopping over the front edge, or a curtain at the roof's ends
        const out = at.x < cx ? -1 : 1;
        const pts = growLimb(vr, at, end ? DOWN + out * vr.range(0.05, 0.3) : DOWN + vr.range(-0.5, 0.5), end ? vr.range(40, 66) : vr.range(14, 34), { segments: 5, wander: 0.15, gravity: 0.2 });
        drops.push(addBranch(tree, c.id, 2, { pts: pts.map(clampPt), w0: 1.6, w1: 0.6, attach: f, t0: t0 + 0.05, t1: t0 + 0.35, tag: end ? 'curtain' : 'drop' }, vr));
      } else {
        const pts = growLimb(vr, at, UP + vr.range(-0.75, 0.75), vr.range(26, 58), { segments: 5, wander: 0.18, gravity: -0.03 });
        addBranch(tree, c.id, 2, { pts: pts.map(clampPt), w0: 1.8, w1: 0.6, attach: f, t0: t0 + 0.03, t1: t0 + 0.4, tag: 'cane' }, vr);
      }
    }
  }
  normalise(tree);

  const tops = trunks.slice(0, 2).map((t) => t.post);
  const reach = (x: number) => Math.min(1, Math.min(...tops.map((t) => Math.abs(t - x))) / (half + 20));

  // the roof's body wash, in pads
  const pr = rng.fork('pads');
  const pads: GrapevinePad[] = [];
  const litAt = (x: number, y: number) => {
    const v = clamp01((y - roofTop(x)) / Math.max(10, bottom - roofTop(x)));
    return 0.55 * (1 - v) + 0.45 * (1 - (x - roofX0) / (roofX1 - roofX0)) - 0.5;
  };
  let row = 0;
  for (let y = Math.min(...top) + 8; y < bottom; y += 16, row++)
    for (let x = roofX0 + 6 + (row % 2) * 11; x <= roofX1 - 6; x += 22) {
      const jx = x + pr.range(-5, 5);
      const jy = y + pr.range(-4, 4);
      if (jy < roofTop(jx) + 6) continue;
      const v = (jy - roofTop(jx)) / Math.max(10, bottom - roofTop(jx));
      pads.push({ x: jx, y: jy, r: pr.range(14, 19), lit: litAt(jx, jy) + pr.range(-0.1, 0.1), layer: v < 0.4 ? 'back' : 'mid', delay: clamp01(reach(jx) * 0.6 + (1 - v) * 0.2 + pr.range(0, 0.2)), id: pads.length });
    }
  for (const d of drops)
    for (let f = 0.15; f <= 1; f += 12 / Math.max(12, d.len)) {
      const q = pointAt(d, f);
      pads.push({ x: q.x, y: q.y, r: pr.range(10, 13), lit: -0.25 + pr.range(-0.1, 0.15), layer: 'front', delay: clamp01(reach(q.x) * 0.6 + 0.2 + f * 0.2), id: pads.length });
    }

  // leaves: the roof filled row by row, tips poking up along its top, hanging curtains in front
  const lr = rng.fork('leaves');
  const leaves: GrapeLeaf[] = [];
  const leaf = (x: number, y: number, angle: number, layer: LeafLayer, length: number, squash: number, lit: number, delay: number) => {
    const L = length;
    const q = { x: Math.max(MARGIN + L, Math.min(SIZE.w - MARGIN - L, x)), y: Math.max(MARGIN + L, y) };
    leaves.push({ ...q, angle, length: L, squash, depth: lr.range(0.18, 0.4), lit, layer, amber: lit > 0 && lr.chance(0.08), delay: clamp01(delay), id: leaves.length });
  };
  row = 0;
  for (let y = Math.min(...top) + 2; y < bottom + 4; y += 8.5, row++)
    for (let x = roofX0 + 4 + (row % 2) * 5.5; x <= roofX1 - 4; x += 11) {
      const jx = x + lr.range(-3.5, 3.5);
      const jy = y + lr.range(-3, 3);
      const t = roofTop(jx);
      if (jy < t + lr.range(-2, 5)) continue;
      const v = clamp01((jy - t) / Math.max(10, bottom - t));
      const back = v < 0.4;
      const a = DOWN + lr.gaussian(0, back ? 0.9 : 0.6);
      leaf(jx, jy, a, back ? 'back' : 'mid', lr.range(8.5, 12) * (back ? 0.9 : 1), lr.range(0.55, 0.9), litAt(jx, jy) + lr.range(-0.15, 0.15), reach(jx) * 0.5 + (1 - v) * 0.35 + lr.range(0, 0.15));
    }
  for (let x = roofX0 + 6; x < roofX1 - 4; x += lr.range(10, 16)) {
    const t = roofTop(x);
    leaf(x, t + lr.range(4, 8), UP + lr.gaussian(0, 0.55), 'back', lr.range(8, 11), lr.range(0.7, 1), 0.3 + lr.range(-0.1, 0.2), reach(x) * 0.6 + 0.25 + lr.range(0, 0.15));
  }
  for (const d of drops) {
    let side = lr.chance(0.5) ? 1 : -1;
    for (let f = 0.12; f <= 1.0001; f += 8 / Math.max(8, d.len)) {
      const q = pointAt(d, f);
      side = -side;
      leaf(q.x + side * lr.range(2, 6), q.y + lr.range(-1, 3), DOWN + side * lr.range(0.1, 0.5) + lr.gaussian(0, 0.2), 'front', lr.range(9, 12.5), lr.range(0.75, 1), -0.2 + lr.range(-0.15, 0.25), reach(q.x) * 0.6 + 0.2 + f * 0.2);
    }
  }
  // the front edge of the roof hangs a little over the beam
  for (let x = roofX0 + 8; x < roofX1 - 8; x += lr.range(9, 17)) leaf(x, beamY + lr.range(-9, 1), DOWN + lr.gaussian(0, 0.35), 'front', lr.range(9, 12), lr.range(0.7, 0.95), -0.1 + lr.range(-0.15, 0.2), reach(x) * 0.6 + 0.2 + lr.range(0, 0.15));

  // bunches hang under the front edge, in the arbour's shade
  const br = rng.fork('bunches');
  const nb = br.int(10, 14);
  const bunches: GrapeBunch[] = [];
  for (let tries = 0; tries < 200 && bunches.length < nb; tries++) {
    const x = br.range(roofX0 + 18, roofX1 - 18);
    const y = beamY + br.range(-4, 22);
    if (bunches.some((b) => Math.abs(b.at.x - x) < 14 && Math.abs(b.at.y - y) < 22)) continue;
    const length = br.range(18, 36);
    const width = br.range(13, 18);
    const rr = br.range(2.3, 2.8);
    const berries: Berry[] = [];
    const wing = br.chance(0.45) ? (br.chance(0.5) ? 1 : -1) : 0;
    for (let yy = rr; yy < length; yy += rr * 1.5) {
      const u = yy / length;
      const W = width * (u < 0.22 ? 0.62 + (0.38 * u) / 0.22 : 0.06 + 0.94 * ((1 - u) / 0.78) ** 0.8);
      const m = Math.max(1, Math.round(W / (2 * rr * 0.85)));
      for (let j = 0; j < m; j++) {
        const xx = (j - (m - 1) / 2) * (W / m) + br.range(-0.6, 0.6);
        berries.push({ x: xx, y: yy + br.range(-0.6, 0.6), r: rr * br.range(0.85, 1.1), depth: clamp01(1 - (Math.abs(xx) / (W / 2 + 1)) * 0.7 + br.range(0, 0.25)) });
      }
      for (let j = 0; j < m - 1; j++) berries.push({ x: (j + 0.5 - (m - 1) / 2) * (W / m), y: yy + rr * 0.5, r: rr * br.range(0.8, 1), depth: br.range(0, 0.3) });
      if (wing && u > 0.08 && u < 0.32) berries.push({ x: wing * (W / 2 + rr * 1.4), y: yy + rr, r: rr * br.range(0.8, 1), depth: br.range(0.2, 0.6) });
    }
    bunches.push({ at: { x, y }, lean: br.gaussian(0, 0.12), purple: false, length, berries, delay: br.range(0, 1), id: bunches.length });
  }
  const nPurple = Math.max(2, Math.min(bunches.length - 2, Math.round(bunches.length * br.range(0.45, 0.7))));
  for (const b of br.shuffle(bunches.slice()).slice(0, nPurple)) b.purple = true;

  const tr = rng.fork('tendrils');
  const tendrils: GrapevinePlan['tendrils'] = [];
  for (let i = 0, n = tr.int(8, 12); i < n; i++) {
    const x = tr.range(roofX0 + 10, roofX1 - 10);
    const atTop = tr.chance(0.6);
    const at = atTop ? { x, y: roofTop(x) + tr.range(3, 8) } : { x, y: bottom + tr.range(4, 14) };
    const out = x < cx ? -1 : 1;
    const heading = atTop ? UP + out * tr.range(0.1, 0.8) : out * tr.range(0.2, 0.9) + (out < 0 ? Math.PI : 0);
    tendrils.push({ pts: tendrilPath(at, heading, tr.range(12, 18), (tr.chance(0.5) ? 1 : -1) * tr.range(0.45, 0.7)).map(clampPt), delay: tr.range(0, 1), id: i });
  }
  const fr = rng.fork('flecks');
  const flecks = Array.from({ length: fr.int(6, 9) }, () => ({ x: fr.range(xL + 8, xR - 8), y: BASE_Y + fr.range(-4, 3), r: fr.range(3, 7) }));

  return { tree, frame, roof: { x0: roofX0, x1: roofX1, beamY, top: top.map((_, i) => roofTop((SIZE.w * i) / (COLS - 1))) }, pads, leaves, bunches, tendrils, flecks };
}

const BARK = '#857565';
const WOOD = { wood: '#a28c6e', dark: '#6f5b47', pale: '#e9e2d0', rope: '#8a6f4e' };
/** sun-lit yellow-green → the roof's deep shade */
const GREENS = ['#c4c46a', '#a6b85e', '#80994a', '#5b7641', '#42592f'];
const BACK_TINT = '#8fa58f';
const AMBER = '#cc9a48';
const SHADE = mix('#8c89a1', '#6d7c44', 0.35);
const GRAPES = {
  bud: '#bcc37c',
  unripe: '#9cae62',
  purple: '#5f4a6e',
  purpleDeep: '#3d3049',
  bloom: '#958fae',
  amber: '#bfc382',
  amberWarm: '#d2b467',
  amberDeep: '#86904e',
  stalk: '#6f6a48',
};

function green(t: number): string {
  const f = clamp01(t) * (GREENS.length - 1);
  const i = Math.min(GREENS.length - 2, Math.floor(f));
  return mix(GREENS[i]!, GREENS[i + 1]!, f - i);
}

/** How far each mark has arrived at growth g (0 = not yet, 1 = full size). */
export function grapevineArrivals(g: number) {
  return {
    pad: (m: { delay: number }) => stagger(g, 0.42, 0.8, m.delay, 0.18),
    leaf: (m: { delay: number }) => stagger(g, 0.4, 0.82, m.delay, 0.16),
    tendril: (m: { delay: number }) => stagger(g, 0.48, 0.86, m.delay, 0.15),
    /** the flower clusters, which become the bunches */
    bud: (m: { delay: number }) => stagger(g, 0.6, 0.8, m.delay, 0.12),
    swell: (m: { delay: number }) => stagger(g, 0.72, 0.95, m.delay * 0.5, 0.15),
    ripe: (m: { delay: number }) => stagger(g, 0.84, 1, m.delay * 0.5, 0.12),
    amber: ramp(g, 0.86, 1),
    shade: ramp(g, 0.45, 0.85),
    tips: 1 - ramp(g, 0.45, 0.65),
  };
}

const grapevine: SpeciesDef = {
  id: 'grapevine',
  name: 'Grapevine',
  nativeName: 'Dalia',
  nativeLang: 'ary-Latn',
  // grown in the palmeraie's middle storey; the wild vine is not of the oasis
  range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] },
  tier: 4,
  habitats: ['meadow', 'back'],
  sizeClass: 'large',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Grapevine — a green roof on palm posts, sweet bunches in its shade.',
  bloomColor: '#6a4f78',
  pollinators: true,
  draw(p, rng, opts) {
    const g = clamp01(opts.growth);
    const plan = planGrapevine(rng);
    const view = { ...treeView(g, plan.tree.base, { structureEnd: 0.55, minScale: 1 }), thick: 0.3 + 0.7 * ramp(g, 0.02, 0.7) };
    const pr = rng.fork('paint');
    const arrive = grapevineArrivals(g);
    const { roof } = plan;
    const leafMark = (l: GrapeLeaf): VineLeafMark => {
      const k = arrive.leaf(l);
      let pigment = green(0.5 - l.lit * 1.3);
      if (l.layer === 'back') pigment = mix(pigment, BACK_TINT, 0.35);
      if (l.amber) pigment = mix(pigment, AMBER, 0.75 * arrive.amber);
      return { at: l, angle: l.angle, length: l.length * (0.3 + 0.7 * k), squash: l.squash, depth: l.depth, pigment, alpha: Math.min(1, k * 3) * (l.layer === 'back' ? 0.62 : 0.8), veins: l.layer !== 'back' && l.lit > -0.15, id: l.id };
    };
    const leavesOf = (layer: LeafLayer) => plan.leaves.filter((l) => l.layer === layer).sort((a, b) => a.y - b.y).map(leafMark);
    const blots = (layer: LeafLayer, alpha: number): Blot[] =>
      plan.pads.filter((q) => q.layer === layer || (layer === 'mid' && q.layer === 'front')).map((q) => {
        const k = arrive.pad(q);
        return { x: q.x, y: q.y, r: q.r * k, alpha: Math.min(1, k * 2.5) * alpha, pigment: mix(green(0.45 - q.lit), layer === 'back' ? BACK_TINT : GREENS[2]!, 0.3), id: q.id };
      });
    const wash = { opacity: 0.85, edge: 0.2, edgeWidth: 1.4, sharpness: 0.5, centreLift: 0.15, granulation: 0.2, flow: 0.5, flowScale: 14 };
    inUnits(p, SIZE, opts, () => {
      paintFrame(p, plan.frame, pr.fork('frame-back'), WOOD, 'back');
      const part = (keep: (b: Branch) => boolean): Tree => ({ base: plan.tree.base, branches: plan.tree.branches.filter(keep) });
      const canes = paintSkeleton(p, part((b) => b.tag === 'cane'), view, pr.fork('canes'), { pigment: mix(BARK, '#e9e2d0', 0.25), texture: 0, modelling: 0, opacity: 0.45, wobble: 0.3 });
      paintBlots(p, blots('back', 0.42), pr.fork('wash-back'), [], wash, softRes(p), 0.7, 0.9);
      paintVineLeaves(p, leavesOf('back'), pr.fork('leaves-back'), { opacity: 0.8, edge: 0.45 }, 1, softRes(p));
      paintArbourShade(p, { x0: plan.frame.posts[2]!.x, x1: plan.frame.posts[3]!.x, top: roof.beamY + 2, floor: BASE_Y }, pr.fork('shade'), SHADE, 0.3 + 0.7 * arrive.shade, plan.flecks, softRes(p));
      paintFrame(p, plan.frame, pr.fork('frame'), WOOD, 'front');
      paintSeed(p, { x: plan.tree.branches[0]!.pts[0]!.x, y: BASE_Y }, g, pr, mix(BARK, '#8e7960', 0.4));
      const trunks = paintSkeleton(p, part((b) => b.order === 0), view, pr.fork('trunks'), { pigment: BARK, texture: 0.75, modelling: 0.6, flare: 0.35, wobble: 0.45 });
      paintShaggyBark(p, trunks, pr.fork('shag'), BARK, ramp(g, 0.2, 0.6));
      const arms = paintSkeleton(p, part((b) => b.order > 0 && b.tag !== 'cane'), view, pr.fork('arms'), { pigment: mix(BARK, '#a28c6e', 0.35), texture: 0.25, modelling: 0.25, opacity: 0.72, wobble: 0.3 });
      paintTipLeaves(p, [...trunks, ...arms, ...canes], view, arrive.tips, pr.fork('tips'), { pigment: mix(GREENS[1]!, AMBER, 0.2), size: 6 });
      paintBlots(p, blots('mid', 0.5), pr.fork('wash-mid'), [], wash, softRes(p), 0.7, 0.9);
      paintVineLeaves(p, leavesOf('mid'), pr.fork('leaves-mid'), {});
      paintBunches(p, plan.bunches.map((b) => ({ at: b.at, lean: b.lean, bud: arrive.bud(b), swell: arrive.swell(b), ripe: arrive.ripe(b), purple: b.purple, berries: b.berries, id: b.id })), pr.fork('bunches'), GRAPES);
      paintVineLeaves(p, leavesOf('front'), pr.fork('leaves-front'), { blend: 'source-over', opacity: 0.92 }, 1);
      paintTendrils(p, plan.tendrils, pr.fork('tendrils'), mix(GREENS[2]!, BARK, 0.3), (id) => arrive.tendril(plan.tendrils[id]!));
    });
  },
};

export default grapevine;
