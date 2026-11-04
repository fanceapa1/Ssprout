import type { Rng } from '../../core/rng';
import type { Pt } from '../../paint/geometry';
import { mix, shade, type Pigment } from '../../paint/pigments';
import {
  along,
  paintCrownWash,
  paintDates,
  paintFrondPass,
  paintLeafBases,
  paintTrunkBody,
  rachisPath,
  type DateMark,
  type LeafBase,
  type PinnaMark,
  type RachisMark,
  type RachisShape,
  type SoftRibbon,
} from '../lib/date-palm-paint';
import { inUnits, paintGroundShadow, paintSeed, softRes } from '../lib/tree-paint';
import { clamp01, partialPath, ramp, stagger, type TreeView } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;
const UP = -Math.PI / 2;
const MARGIN = 10;

export interface Frond {
  id: number;
  /** 0 the main crown, 1… an offshoot at the foot */
  crown: number;
  /** mature heading and arch (rachisPath) */
  heading: number;
  side: number;
  len: number;
  bend: number;
  /** 0 the young spear … 1 the oldest, lowest frond */
  age: number;
  delay: number;
  front: boolean;
  /** how dry and gold it is at full growth (only the oldest) */
  dry: number;
}

export interface Offshoot {
  x: number;
  delay: number;
  scale: number;
}

export interface DateCluster {
  id: number;
  side: number;
  /** stalk: leaves the crown, arches out and down */
  stalk: RachisShape;
  strands: { angle: number; len: number; n: number }[];
  delay: number;
}

export interface DatePalmPlan {
  /** trunk and full-grown rachises as point lists (the tree suite's box check reads these) */
  tree: { base: Pt; branches: { pts: Pt[] }[] };
  trunk: Pt[];
  trunkWidth: number;
  fronds: Frond[];
  offshoots: Offshoot[];
  clusters: DateCluster[];
}

/** Trunk centreline: a gentle lean that straightens toward the crown. */
function trunkPath(base: Pt, height: number, lean: number, bow: number): Pt[] {
  const top = { x: base.x + Math.sin(lean) * height, y: base.y - height };
  const ctrl = { x: base.x + Math.sin(lean) * height * (0.5 + bow), y: base.y - height * 0.5 };
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = (1 - t) * (1 - t);
    const b = 2 * t * (1 - t);
    const c = t * t;
    pts.push({ x: a * base.x + b * ctrl.x + c * top.x, y: a * base.y + b * ctrl.y + c * top.y });
  }
  return pts;
}

/** Where a crown's fronds leave from at full growth. */
function crownAt(plan: Pick<DatePalmPlan, 'trunk' | 'offshoots'>, crown: number): Pt {
  if (crown === 0) return plan.trunk.at(-1)!;
  const o = plan.offshoots[crown - 1]!;
  return { x: o.x, y: BASE_Y - 2 };
}

function frondShape(f: Frond, from: Pt, len: number, mature: number): RachisShape {
  // young fronds rise in a fan; they arch and droop only as the palm matures
  const heading = UP + (f.heading - UP) * (0.55 + 0.45 * mature);
  return { from, heading, length: len, bend: f.bend * (0.25 + 0.75 * mature), side: f.side };
}

/** The whole palm for a seed, independent of growth. */
export function planDatePalm(rng: Rng): DatePalmPlan {
  const r = rng.fork('structure');
  const lean = (r.chance(0.5) ? 1 : -1) * r.range(0.05, 0.12);
  const base = { x: SIZE.w / 2 - Math.sin(lean) * 60 + r.range(-6, 6), y: BASE_Y };
  const height = r.range(205, 235);
  const trunk = trunkPath(base, height, lean, r.range(0.1, 0.35));
  const trunkWidth = r.range(21, 25);

  const fr = rng.fork('fronds');
  const fronds: Frond[] = [];
  const n = fr.int(22, 27);
  for (let i = 0; i < n; i++) {
    // age 0 is the spear at the top, 1 the lowest, oldest frond
    const age = i / (n - 1);
    const side = i === 0 ? (fr.chance(0.5) ? 1 : -1) : i % 2 === 0 ? 1 : -1;
    // upper fronds stand up, the lowest reach out level and arch down
    const tilt = (0.08 + 1.7 * age ** 0.9) * fr.range(0.85, 1.1);
    const heading = UP + side * Math.min(1.85, tilt);
    // some fronds point at the viewer: foreshortened, they hide the crown's base
    const toward = i > 2 && fr.chance(0.3);
    fronds.push({
      id: i,
      crown: 0,
      heading,
      side,
      len: fr.range(138, 165) * (1 - 0.18 * (1 - age) ** 2) * (age > 0.85 ? 0.93 : 1) * (toward ? fr.range(0.5, 0.72) : 1),
      bend: (0.25 + 1.9 * age ** 1.5) * fr.range(0.85, 1.15) * (toward ? 1.3 : 1),
      age,
      // the oldest arrive first: they were the young palm's fan
      delay: clamp01(1 - age + fr.range(-0.06, 0.06)),
      front: i === 0 || toward ? true : fr.chance(0.5),
      dry: age > 0.92 && !toward ? fr.range(0.45, 0.8) : 0,
    });
  }
  const offshoots: Offshoot[] = [];
  const no = fr.int(1, 3);
  for (let k = 0; k < no; k++) {
    const s = k % 2 === 0 ? -Math.sign(lean) : Math.sign(lean);
    offshoots.push({ x: base.x + s * fr.range(17, 28) * (1 + 0.4 * Math.floor(k / 2)), delay: k / Math.max(1, no - 1), scale: fr.range(0.7, 1) * (k === 2 ? 0.7 : 1) });
  }
  offshoots.forEach((o, k) => {
    const m = fr.int(6, 8);
    for (let j = 0; j < m; j++) {
      const age = j / (m - 1);
      const side = j % 2 === 0 ? 1 : -1;
      fronds.push({
        id: fronds.length,
        crown: k + 1,
        heading: UP + side * (0.12 + 0.95 * age) * fr.range(0.85, 1.1),
        side,
        len: fr.range(52, 72) * o.scale * (1 - 0.25 * (1 - age)),
        bend: (0.3 + 0.9 * age) * fr.range(0.8, 1.1),
        age,
        delay: clamp01(1 - age),
        front: true,
        dry: 0,
      });
    }
  });

  // keep every frond, with its leaflets, inside the box
  const pl = { trunk, offshoots };
  for (const f of fronds) {
    const reach = f.len * 0.2;
    for (let tries = 0; tries < 30; tries++) {
      const path = rachisPath(frondShape(f, crownAt(pl, f.crown), f.len, 1));
      const out = path.some((q) => q.x < MARGIN + reach || q.x > SIZE.w - MARGIN - reach || q.y < MARGIN + reach || q.y > BASE_Y - 14);
      if (!out) break;
      f.len *= 0.95;
    }
  }

  const cr = rng.fork('dates');
  const clusters: DateCluster[] = [];
  const nc = cr.int(3, 5);
  const top = trunk.at(-1)!;
  for (let c = 0; c < nc; c++) {
    const side = c % 2 === 0 ? 1 : -1;
    const strands = Array.from({ length: cr.int(10, 14) }, (_, s, a = cr.range(-0.4, 0.4)) => ({ angle: Math.PI / 2 + a * 0.8 + side * 0.1, len: cr.range(20, 32) * (1 - 0.35 * Math.abs(a)), n: cr.int(5, 8) }));
    clusters.push({
      id: c,
      side,
      stalk: { from: { x: top.x + side * cr.range(2, 6), y: top.y + cr.range(2, 6) }, heading: side > 0 ? cr.range(-0.5, 0.15) : Math.PI - cr.range(-0.5, 0.15), length: cr.range(24, 34), bend: cr.range(1.1, 1.5), side },
      strands,
      delay: c / Math.max(1, nc - 1),
    });
  }

  const branches = [{ pts: trunk }, ...fronds.map((f) => ({ pts: rachisPath(frondShape(f, crownAt(pl, f.crown), f.len, 1)) })), ...clusters.map((c) => ({ pts: rachisPath(c.stalk, 6) }))];
  return { tree: { base, branches }, trunk, trunkWidth, fronds, offshoots, clusters };
}

/** How far each part has arrived at growth g (0 = not yet, 1 = full); continuous in g. */
export function datePalmArrivals(g: number) {
  return {
    /** fraction of the trunk risen: none while the fronds fan from the ground */
    trunk: ramp(g, 0.22, 0.62),
    /** how far fronds have taken their mature arch */
    mature: ramp(g, 0.28, 0.7),
    /** overall size of the fronds, young palm to grown */
    size: 0.42 + 0.58 * ramp(g, 0.02, 0.7),
    frond: (f: Frond) => (f.crown === 0 ? stagger(g, 0.015, 0.8, f.delay, 0.16) : stagger(g, 0.55 + 0.12 * ((f.crown - 1) % 2), 0.86, f.delay, 0.12)),
    /** the oldest fronds dry to gold late */
    dry: (f: Frond) => f.dry * ramp(g, 0.62, 0.86),
    stalk: (c: DateCluster) => ramp(g, 0.76 + c.delay * 0.05, 0.86 + c.delay * 0.05),
    fruit: (c: DateCluster) => ramp(g, 0.82 + c.delay * 0.04, 0.95),
    /** 0 yellow … 1 amber */
    ripe: ramp(g, 0.86, 1),
  };
}

const TRUNK = '#9a7a56';
const TRUNK_SHADE = '#6b5440';
const TRUNK_PALE = '#dcc9a6';
const FROND = { light: '#b5b98a', mid: '#7f9268', shadow: '#5f7d6e', dark: '#4c6458' };
const DRY = { light: '#e3c98a', mid: '#c9a560', shadow: '#9c7c4c' };
const RACHIS = '#c4bf8c';
const STALK = '#d9883e';
const DATE = { yellow: '#e5c05a', amber: '#c98a3e', brown: '#7a4a32' };

const datePalm: SpeciesDef = {
  id: 'date-palm',
  name: 'Date palm',
  nativeName: 'Nkhla',
  nativeLang: 'ary-Latn',
  // every palm of a palmeraie is planted and tended; its wild ancestor is uncertain
  range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] },
  tier: 4,
  habitats: ['meadow', 'back', 'shore'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Date palm — the roof of the oasis, with honey hung in its shade.',
  bloomColor: '#d99a3e',
  pollinators: false,
  draw(p, rng, opts) {
    const g = clamp01(opts.growth);
    const plan = planDatePalm(rng);
    const arrive = datePalmArrivals(g);
    const pr = rng.fork('paint');
    const base = plan.tree.base;
    const view: TreeView = { growth: g, tau: g, scale: 0.35 + 0.65 * ramp(g, 0.1, 0.7), thick: 1, base };
    const trunk = arrive.trunk > 0.005 ? partialPath({ pts: plan.trunk, ...cumOf(plan.trunk) }, arrive.trunk) : [];
    const top = trunk.length > 1 ? trunk.at(-1)! : { x: base.x, y: base.y - 3 };
    const crownNow = (f: Frond): Pt => {
      if (f.crown === 0) return top;
      return crownAt(plan, f.crown);
    };

    // fronds: rachis, leaflets and soft masses, back and front passes
    const back: PinnaMark[] = [];
    const front: PinnaMark[] = [];
    const ribsBack: RachisMark[] = [];
    const ribsFront: RachisMark[] = [];
    const wash: SoftRibbon[] = [];
    for (const f of plan.fronds) {
      const k = arrive.frond(f);
      if (k <= 0.01) continue;
      const fr = pr.fork(`frond-${f.id}`);
      const len = f.len * k ** 0.8 * (f.crown === 0 ? arrive.size : 1);
      const path = rachisPath(frondShape(f, crownNow(f), len, f.crown === 0 ? arrive.mature : 0.4 + 0.6 * k));
      const dry = arrive.dry(f);
      const deep = f.front ? 0 : 0.45;
      const pig = (t: number): Pigment => mix(mix(mix(FROND.light, FROND.mid, t), FROND.shadow, deep), mix(DRY.light, DRY.mid, t), dry);
      // the spear opens as it grows: leaflets fold out from the rib
      const open = ramp(k, 0.2, 0.85);
      const count = Math.round(f.len / 4.2);
      const P = len * 0.17;
      const out = f.front ? front : back;
      for (let j = 0; j < count; j++) {
        const t0 = 0.08 + (0.9 * j) / Math.max(1, count - 1);
        const t = clamp01(t0 + fr.range(-0.012, 0.012));
        const { at, heading } = along(path, t);
        const shape = (0.2 + 0.8 * Math.sin(Math.PI * (0.1 + 0.85 * t)) ** 0.8) * (0.4 + 0.6 * ramp(t, 0.06, 0.24));
        for (const s of [-1, 1]) {
          // leaflets in groups set at two angles, the V of a date palm frond
          const spread = (0.42 + 0.32 * ((j + (s > 0 ? 1 : 0)) % 2)) * fr.range(0.85, 1.15);
          const angle = heading + s * spread * open * (1 - 0.25 * t);
          const up = Math.sin(angle) < -0.15;
          const tone = clamp01((up ? 0.15 : 0.65) + fr.range(-0.15, 0.2) + 0.3 * f.age);
          out.push({
            at,
            angle,
            length: P * shape * fr.range(0.82, 1.12) * (0.35 + 0.65 * open),
            width: 1.5 + 0.9 * (len / 160),
            sag: (0.06 + 0.12 * f.age) * (dry > 0.3 ? 2 : 1),
            pigment: pig(tone),
            alpha: (f.front ? 0.78 : 0.6) * Math.min(1, k * 3) * (1 - 0.4 * dry * fr.range(0, 1)),
          });
        }
      }
      (f.front ? ribsFront : ribsBack).push({ path, width: 1.1 + len / 140, pigment: mix(mix(RACHIS, FROND.mid, deep), DRY.mid, dry), alpha: 0.75 * Math.min(1, k * 3) });
      const hw = (t: number) => P * 0.85 * open * Math.sin(Math.PI * Math.min(1, 0.06 + t * 0.94)) ** 0.7;
      wash.push({ path: path.slice(1), hw, pigment: mix(mix(FROND.mid, FROND.shadow, f.front ? 0.2 : 0.6), DRY.mid, dry), alpha: 0.26 * Math.min(1, k * 2) });
    }

    // the crown's heart: sheathing frond bases where the fronds meet the trunk
    const heart: SoftRibbon[] = [];
    const kh = ramp(g, 0.12, 0.5);
    if (kh > 0) {
      const hr = pr.fork('heart-shape');
      for (let i = 0; i < 7; i++) {
        const a = UP + (i / 6 - 0.5) * 2.6 + hr.range(-0.15, 0.15);
        const l = hr.range(9, 15) * kh * arrive.size;
        heart.push({ path: [{ x: top.x - Math.cos(a) * 2, y: top.y + 4 * kh }, { x: top.x + Math.cos(a) * l * 0.5, y: top.y + Math.sin(a) * l * 0.5 }, { x: top.x + Math.cos(a) * l, y: top.y + Math.sin(a) * l }], hw: (t) => 3.2 * kh * (1 - t * 0.7), pigment: i % 2 ? TRUNK_SHADE : mix(TRUNK, FROND.dark, 0.4), alpha: 0.6 });
      }
    }

    // trunk: diamond lattice of old leaf bases, rows arriving as it rises
    const bases: LeafBase[] = [];
    const W = plan.trunkWidth;
    const hw = (t: number) => (W / 2) * (1.12 - 0.22 * t + 0.25 * Math.max(0, 0.06 - t) * 10) * (0.55 + 0.45 * arrive.trunk);
    if (trunk.length > 1) {
      const full = cumOf(plan.trunk);
      const shown = full.len * arrive.trunk;
      const row = 8.6;
      for (let i = 0; i * row < full.len - 2; i++) {
        const u = i * row + 4;
        const k = ramp(shown - u, 2, 2 + row * 2.2);
        if (k <= 0) break;
        const { at, heading } = along(plan.trunk, u / full.len);
        const half = hw(u / full.len);
        for (let c = -3; c <= 3; c++) {
          const th = (c + (i % 2) * 0.5) * (Math.PI / 3.4);
          if (Math.abs(th) > 1.38) continue;
          const fx = Math.cos(th);
          const off = Math.sin(th) * half;
          const ux = Math.cos(heading + Math.PI / 2);
          const uy = Math.sin(heading + Math.PI / 2);
          bases.push({ at: { x: at.x - ux * off, y: at.y - uy * off }, heading: heading, hw: half * 0.5 * (0.35 + 0.65 * fx), hh: row * 0.95, flank: Math.sin(th), k, id: i * 16 + c + 4 });
        }
      }
    }

    // date clusters hang under the crown
    const stalks: RachisMark[] = [];
    const dates: DateMark[] = [];
    for (const c of plan.clusters) {
      const ks = arrive.stalk(c);
      if (ks <= 0.01) continue;
      const cr = pr.fork(`cluster-${c.id}`);
      const from = { x: top.x + (c.stalk.from.x - plan.trunk.at(-1)!.x), y: top.y + (c.stalk.from.y - plan.trunk.at(-1)!.y) };
      const stalk = rachisPath({ ...c.stalk, from, length: c.stalk.length * ks }, 8);
      stalks.push({ path: stalk, width: 1.8, pigment: mix(STALK, TRUNK, 0.3), alpha: 0.8 });
      const end = stalk.at(-1)!;
      const kf = arrive.fruit(c);
      for (const s of c.strands) {
        const sl = s.len * ks;
        const strand: Pt[] = [end, { x: end.x + Math.cos(s.angle) * sl * 0.5, y: end.y + Math.sin(s.angle) * sl * 0.5 }, { x: end.x + Math.cos(s.angle) * sl + c.side * 1.5, y: end.y + Math.sin(s.angle) * sl }];
        stalks.push({ path: strand, width: 0.55, pigment: mix(STALK, TRUNK, 0.2), alpha: 0.6 });
        for (let d = 0; d < s.n; d++) {
          const t = 0.3 + (0.7 * d) / Math.max(1, s.n - 1);
          const q = along(strand, t).at;
          const side = d % 2 === 0 ? 1 : -1;
          const tone = cr.range(0, 1);
          const ripe = clamp01(arrive.ripe * cr.range(0.75, 1.15));
          const pig = mix(mix(DATE.yellow, DATE.amber, ripe), DATE.brown, ripe * (tone > 0.8 ? 0.55 : 0.12));
          dates.push({ at: { x: q.x + side * 1.6 * kf, y: q.y + 1.2 }, angle: Math.PI / 2 + side * 0.35 + cr.range(-0.2, 0.2), size: 5.2 * kf * cr.range(0.85, 1.1), pigment: pig, alpha: 0.85 });
        }
      }
    }

    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, base, 70 + 30 * arrive.trunk, view, pr.fork('ground'));
      paintSeed(p, base, g, pr.fork('seed'), mix(DATE.amber, DATE.brown, 0.5));
      paintCrownWash(p, wash, pr.fork('wash'), { opacity: 0.7, edge: 0.04, edgeWidth: 3, sharpness: 0.12, centreLift: 0.1, granulation: 0.25, flow: 0.6, flowScale: 16 }, softRes(p));
      paintFrondPass(p, back, ribsBack, pr.fork('back'), { opacity: 0.85, edge: 0.4, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.15, granulation: 0.15, flow: 0.3, flowScale: 10, darken: 0.2 });
      paintTrunkBody(p, trunk, hw, pr.fork('trunk'), { body: TRUNK, shade: TRUNK_SHADE }, ramp(arrive.trunk, 0, 0.08));
      paintLeafBases(p, bases, pr.fork('bases'), { dark: shade(TRUNK_SHADE, 0.15), pale: TRUNK_PALE });
      paintCrownWash(p, heart, pr.fork('heart'), { opacity: 0.8, edge: 0.3, edgeWidth: 1, sharpness: 0.5, centreLift: 0.1, granulation: 0.4, flow: 0.4, flowScale: 8 });
      paintFrondPass(p, front, ribsFront, pr.fork('front'), { opacity: 0.9, edge: 0.45, edgeWidth: 0.5, sharpness: 0.82, centreLift: 0.18, granulation: 0.15, flow: 0.3, flowScale: 10, darken: 0.2, blend: 'source-over' });
      paintDates(p, stalks, dates, pr.fork('dates'));
    });
  },
};

function cumOf(pts: readonly Pt[]): { cum: number[]; len: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return { cum, len: cum.at(-1)! };
}

export default datePalm;
