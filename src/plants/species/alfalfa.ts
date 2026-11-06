import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Painter, type Pigment } from '../../paint';
import { coiledPod, plotSoil, racemes, trefoils, type Floret, type Raceme, type Trefoil } from '../lib/alfalfa-paint';
import { clamp01, ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintStem, plantFrame } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, add, lerpAngle, makeStem, pointAt, stemPoints, subPath, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Alfalfa (fessa): a dense, upright clump of many slender stems fanning from one crown, set with
 * leaves of three narrow leaflets toothed at the tip, in a fresh blue-green, and topped with
 * short dense clusters of violet pea flowers; here and there a small coiled seed pod.
 */

const LEAF = mix('#8aa65e', PIGMENTS.celadonDeep, 0.22);
const LEAF_DEEP = mix('#58764a', PIGMENTS.celadonDeep, 0.25);
const STEM = mix('#8aa65e', PIGMENTS.olive, 0.3);
const BLOOM = '#8f6fb3';
const LILAC = '#b39ccc';
const OLD = mix(BLOOM, PIGMENTS.bellflower, 0.5);
const BUD = mix('#8fa065', BLOOM, 0.3);
const KEEL = mix(BLOOM, PIGMENTS.indigo, 0.35);
const POD = '#a8a06a';
// the design box round the base (anchor 0.5, 0.88): x ±35, y −61.6 … 8.4
const BOX = { x: 33, top: -58 };

interface LeafPlan {
  t: number;
  side: 1 | -1;
  turn: number;
  petiole: number;
  size: number;
  width: number;
  spread: number;
  tone: Pigment;
}

interface RacemePlan {
  /** where on the stem it rises (1 = the stem's tip) */
  t: number;
  turn: number;
  stalk: number;
  length: number;
  width: number;
  florets: Floret[];
  age: number;
  bud: [number, number];
  open: [number, number];
}

interface Shoot {
  stem: StemPlan;
  depth: number;
  window: [number, number];
  leaves: LeafPlan[];
  racemes: RacemePlan[];
  pod?: { t: number; side: 1 | -1; stalk: number; r: number; turns: number; rot: number };
}

export interface AlfalfaPlan {
  shoots: Shoot[];
}

function makeFlorets(rng: Rng): Floret[] {
  const n = rng.int(12, 16);
  const out: Floret[] = [];
  for (let i = 0; i < n; i++) out.push({ v: (i + rng.range(0.2, 0.8)) / n, u: rng.range(-1, 1), size: rng.range(0.75, 0.95), pale: rng.chance(0.25) ? rng.range(0.5, 0.9) : rng.range(0, 0.2) });
  return out;
}

function makeRaceme(rng: Rng, t: number, turn: number, end: number): RacemePlan {
  const start = Math.max(0.46, end - 0.06);
  return {
    t,
    turn,
    stalk: t >= 1 ? rng.range(0.8, 1.8) : rng.range(2, 3.2),
    length: rng.range(3.4, 4.4),
    width: rng.range(1.05, 1.3),
    florets: makeFlorets(rng),
    age: rng.chance(0.25) ? rng.range(0.5, 0.9) : rng.range(0, 0.25),
    bud: [start, Math.min(0.84, start + 0.22)],
    open: [0, 0],
  };
}

export function planAlfalfa(rng: Rng): AlfalfaPlan {
  const n = rng.int(13, 17);
  const green = jitter(LEAF, rng, 0.03);
  const order = rng.shuffle([...Array(n).keys()]);
  const us = Array.from({ length: n }, (_, i) => lerp(-1, 1, (i + rng.range(0.15, 0.85)) / n));
  const shoots: Shoot[] = [];
  for (let i = 0; i < n; i++) {
    const u = us[i]!;
    const depth = rng.next();
    // the stems fan out of one crown: tall and upright in the middle, shorter and leaning outside
    const base = { x: u * rng.range(4, 7) + rng.gaussian(0, 0.8), y: lerp(-1.4, 0.8, depth) };
    const length = rng.range(38, 47) * (1 - Math.abs(u) ** 1.4 * 0.45);
    const angle = UP + u * rng.range(0.5, 0.75) + rng.gaussian(0, 0.06);
    const stem = makeStem(rng, { base, length, angle, bend: u * rng.range(0.05, 0.22) + rng.gaussian(0, 0.08), segments: 8, tipBias: 0.25 });
    const window = [...stagger(order.indexOf(i), n, [0.04, 0.6], 0.55)] as [number, number];
    const nl = rng.int(6, 9);
    const leaves: LeafPlan[] = [];
    let side: 1 | -1 = rng.chance(0.5) ? 1 : -1;
    const scale = rng.range(0.9, 1.08);
    for (let j = 0; j < nl; j++) {
      const t = lerp(0.14, 0.94, j / (nl - 1)) + rng.gaussian(0, 0.015);
      const size = (3.3 + 1.5 * Math.sin(Math.PI * Math.min(1, t * 1.3))) * lerp(1, 0.72, t) * scale * rng.range(0.9, 1.1);
      leaves.push({
        t,
        side,
        turn: rng.range(0.55, 1.05),
        petiole: size * rng.range(0.5, 0.75),
        size,
        width: size * rng.range(0.34, 0.4),
        spread: rng.range(0.7, 1.0),
        tone: jitter(mix(mix(green, PIGMENTS.sageLight, rng.range(0, 0.18)), LEAF_DEEP, rng.range(0, 0.15) + (1 - depth) * 0.12), rng, 0.025),
      });
      side = side === 1 ? -1 : 1;
    }
    const rcs: RacemePlan[] = [];
    if (rng.chance(Math.abs(u) < 0.7 ? 0.8 : 0.4)) rcs.push(makeRaceme(rng, 1, rng.gaussian(0, 0.1), window[1]));
    const na = Math.abs(u) < 0.7 && rng.chance(0.45) ? 1 : 0;
    for (let j = 0; j < na; j++) {
      const lf = leaves[nl - 2 - j * 2];
      if (!lf) break;
      rcs.push(makeRaceme(rng, lf.t, lf.side * rng.range(0.35, 0.6), window[1]));
    }
    shoots.push({ stem, depth, window, leaves, racemes: rcs });
  }
  // the clusters open one after another from about 0.7
  const all = shoots.flatMap((sh) => sh.racemes);
  const ro = rng.shuffle([...all.keys()]);
  all.forEach((rc, k) => {
    rc.open = [...stagger(ro[k]!, all.length, [Math.max(0.7, rc.bud[1] - 0.06), 1], 0.5)] as [number, number];
    if (rc.open[0] < rc.bud[1] - 0.08) rc.open[0] = rc.bud[1] - 0.08;
  });
  // one or two coiled pods low on the outer stems, where the first flowers were
  const outer = shoots.map((sh, i) => [sh, us[i]!] as const).filter(([, u]) => Math.abs(u) > 0.3);
  const np = rng.int(1, 2);
  for (const [sh, u] of rng.shuffle(outer).slice(0, np)) {
    sh.pod = { t: rng.range(0.5, 0.68), side: u > 0 ? 1 : -1, stalk: rng.range(2.4, 3.4), r: rng.range(1.45, 1.7), turns: rng.range(2.2, 2.8), rot: rng.range(0, Math.PI * 2) };
  }
  // fit each stem with its top cluster and its widest leaf into the box
  for (const sh of shoots) {
    const pts = stemPoints(sh.stem, 1, 1);
    const tip = pts[pts.length - 1]!;
    const top = sh.racemes.find((rc) => rc.t >= 1);
    const extra = top ? top.stalk + top.length + 1 : 4;
    const rise = sh.stem.base.y - tip.y + extra;
    let s = Math.min(1, (-BOX.top + sh.stem.base.y) / rise);
    const reach = Math.max(...sh.leaves.map((l) => l.size + l.petiole));
    for (const q of pts) s = Math.min(s, Math.abs(q.x) > 1e-6 ? (BOX.x - reach) / Math.abs(q.x) : 1);
    if (s < 1) sh.stem.length *= Math.max(0.5, s);
  }
  return { shoots };
}

interface Marks {
  leaves: Trefoil[];
  racemes: Raceme[];
  later: (() => void)[];
}

function drawShoot(p: Painter, rng: Rng, sh: Shoot, i: number, g: number, out: Marks): void {
  const ext = ease(g, sh.window[0], sh.window[1]);
  if (!visible(ext)) return;
  const full = stemPoints(sh.stem, 1, lerp(0.4, 1, ext));
  const head = lerp(0.03, 1, ext);
  const pts = subPath(full, head);
  const back = 1 - sh.depth;
  paintStem(p, rng.fork('stem'), pts, { width: 0.48, pigment: mix(STEM, PIGMENTS.sageLight, 0.25 + back * 0.2), opacity: 0.62, ink: 0.025 * ext, inkReach: 0.6, inkPigment: mix(LEAF_DEEP, PIGMENTS.sumi, 0.3) });
  sh.leaves.forEach((lf, j) => {
    const lk = smooth((head * 1.12 - lf.t) / 0.3);
    if (!visible(lk)) return;
    const q = pointAt(full, lf.t * head);
    out.leaves.push({ key: `${i}-${j}`, at: q, angle: lerpAngle(q.angle, q.angle + lf.side * lf.turn, lk), petiole: lf.petiole, size: lf.size, width: lf.width, spread: lf.spread, tone: lf.tone, open: lk });
  });
  sh.racemes.forEach((rc, j) => {
    const rk = ease(g, rc.bud[0], rc.bud[1]);
    if (!visible(rk)) return;
    const q = pointAt(full, rc.t * head);
    const angle = q.angle + rc.turn * smooth(rk);
    const stalk = subPath([q, add(q, angle, rc.stalk * 0.5), add(q, angle + rc.turn * 0.3, rc.stalk)], rk);
    paintStem(p, rng.fork(`stalk-${j}`), stalk, { width: 0.4, pigment: STEM, opacity: 0.7 });
    const end = stalk[stalk.length - 1]!;
    const op = rc.open;
    out.racemes.push({
      key: `${i}-${j}`,
      base: end,
      angle: angle + rc.turn * 0.3,
      length: rc.length * rk,
      width: rc.width,
      florets: rc.florets,
      age: rc.age,
      open: (v) => ease(g, lerp(op[0], op[1] - 0.1, v), lerp(op[0] + 0.1, op[1], v)),
    });
  });
  if (sh.pod) {
    const pk = ease(g, 0.82, 1);
    if (!visible(pk)) return;
    const pd = sh.pod;
    const q = pointAt(full, pd.t * head);
    const a = q.angle + pd.side * 0.9;
    const stalk = subPath([q, add(q, a, pd.stalk)], pk);
    paintStem(p, rng.fork('pod-stalk'), stalk, { width: 0.3, pigment: STEM, opacity: 0.6 });
    out.later.push(() => coiledPod(p, rng.fork('pod'), add(q, a, pd.stalk * pk + pd.r * 0.8 * pk), { r: pd.r, turns: pd.turns, rot: pd.rot, k: pk, pigment: lighten(POD, 0.12), line: mix(POD, PIGMENTS.wood, 0.5) }));
  }
}

const BANDS = 3;

const alfalfa: SpeciesDef = {
  id: 'alfalfa',
  name: 'Alfalfa',
  nativeName: 'Fessa',
  nativeLang: 'ary-Latn',
  // a forage crop sown under the palms; the brief also lists the Mediterranean, left out so no other garden offers it
  range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] },
  tier: 1,
  habitats: ['meadow', 'path'],
  sizeClass: 'small',
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.88 },
  description: 'Alfalfa — the lowest storey, cut and cut again, and still in flower.',
  bloomColor: '#8f6fb3',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planAlfalfa(rng.fork('plan'));
    const g = clamp01(opts.growth);
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      plotSoil(p, r.fork('soil'), { rx: 22, k: ease(g, 0.03, 0.5) });
      groundShadow(p, r, { rx: 18, ry: 3.6, k: ease(g, 0.15, 0.7), opacity: 0.07, pigment: mix(PIGMENTS.shadow, PIGMENTS.stoneWarm, 0.4) });
      // back to front in depth bands: each band's stems, then its leaves and its flowers in one layer each
      const order = plan.shoots.map((sh, i) => [sh, i] as const).sort((a, b) => a[0].depth - b[0].depth);
      for (let b = 0; b < BANDS; b++) {
        const band = order.filter(([sh]) => Math.min(BANDS - 1, Math.floor(sh.depth * BANDS)) === b);
        const marks: Marks = { leaves: [], racemes: [], later: [] };
        for (const [sh, i] of band) drawShoot(p, r.fork(`shoot-${i}`), sh, i, g, marks);
        const k = b / (BANDS - 1);
        trefoils(p, r.fork(`leaves-${b}`), marks.leaves, { deep: LEAF_DEEP, stalk: STEM, opacity: lerp(0.78, 0.9, k) });
        racemes(p, r.fork(`flowers-${b}`), marks.racemes, { bud: BUD, bloom: BLOOM, pale: lighten(LILAC, 0.05), old: OLD, keel: KEEL, opacity: lerp(0.82, 0.92, k) });
        for (const f of marks.later) f();
      }
    } finally {
      end();
    }
  },
};

export default alfalfa;
