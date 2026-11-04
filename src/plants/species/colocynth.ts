import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Pigment, type Pt } from '../../paint';
import { COS_E, SIN_E, flowers, gourd, lobedLeaves, sandBed, tendrils, toScreen, type FlowerNow, type GourdColours, type LobedLeaf, type Lobe, type Tendril } from '../lib/colocynth-paint';
import { clamp01, ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, plantFrame } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, lerpAngle, makeStem, pointAt, stemPoints, subPath, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Colocynth (lḥdej): a prostrate vine lying flat on the sand, hairy runners with deeply lobed
 * grey-green leaves and coiled tendrils, a few small pale yellow flowers, and two or three round
 * gourds on the sand, green striped with pale yellow, the oldest ripened to gold.
 */

const LEAF = '#93a067';
const LEAF_DEEP = '#66744a';
const STEM = '#9fa478';
const TENDRIL = '#a3ad6e';
const PETAL = '#e8c75a';
const COLOURS: GourdColours = { green: '#7f9a52', pale: '#e3d38a', gold: '#e6c766', goldDeep: '#c49a3e' };
const SAND = mix(PIGMENTS.stoneWarm, '#e3cf9c', 0.55);
// the design box round the crown (anchor 0.5, 0.62): x ±35, y −43.4 … 26.6
const BOX = { x: 33, top: -38, bottom: 24 };

interface Leaf {
  side: 1 | -1;
  /** petiole angle off the runner (ground) and its length */
  spread: number;
  petiole: number;
  length: number;
  tilt: number;
  lobes: Lobe[];
  tone: Pigment;
}

interface Node {
  t: number;
  side: 1 | -1;
  leaf?: Leaf;
  tendril?: { length: number; turns: number; r: number; hand: 1 | -1 };
}

interface Runner {
  /** in ground units (x right, y toward us); `toScreen` foreshortens it */
  stem: StemPlan;
  nodes: Node[];
  window: [number, number];
  width: number;
  depth: number;
}

interface Gourd {
  runner: number;
  node: number;
  /** ground centre, radius, and the stalk-to-blossom axis */
  at: Pt;
  r: number;
  yaw: number;
  ripe: number;
  swell: [number, number];
  ripen: [number, number];
  bloom: [number, number];
  flower: { size: number; rot: number };
  stripes: { lon: number; w: number }[];
  mottles: { u: number; lon: number; s: number }[];
}

interface MaleFlower {
  runner: number;
  node: number;
  stalk: number;
  lean: number;
  size: number;
  rot: number;
  open: [number, number];
}

export interface ColocynthPlan {
  runners: Runner[];
  gourds: Gourd[];
  flowers: MaleFlower[];
}

/** A watermelon leaf: a long end lobe, one or two pairs of side lobes, the big ones lobed again. */
function makeLobes(rng: Rng): Lobe[] {
  const lobes: Lobe[] = [];
  const add = (bx: number, by: number, a: number, len: number, wid: number, sub: boolean) => {
    lobes.push({ bx, by, a, len, wid, curve: rng.gaussian(0, 0.08) });
    if (!sub) return;
    for (const s of [-1, 1]) {
      if (!rng.chance(0.75)) continue;
      const u = rng.range(0.42, 0.6);
      lobes.push({ bx: bx + Math.cos(a) * len * u, by: by + Math.sin(a) * len * u, a: a + s * rng.range(0.55, 0.8), len: len * rng.range(0.3, 0.4), wid: wid * 0.75, curve: s * 0.1 });
    }
  };
  add(0.08, 0, rng.gaussian(0, 0.06), rng.range(0.82, 0.92), 0.26, true);
  for (const s of [-1, 1]) add(0.06, 0, s * rng.range(0.7, 0.9), rng.range(0.6, 0.7), 0.24, true);
  if (rng.chance(0.7)) for (const s of [-1, 1]) add(0.02, 0, s * rng.range(1.45, 1.75), rng.range(0.38, 0.48), 0.22, false);
  return lobes;
}

function makeNodes(rng: Rng, length: number, green: Pigment, big: number): Node[] {
  const n = Math.max(3, Math.round(length / 3.4));
  const nodes: Node[] = [];
  const first: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  for (let j = 0; j < n; j++) {
    const t = (j + 0.55) / (n + 0.2);
    const side = (j % 2 ? first : -first) as 1 | -1;
    const size = lerp(big, 3, t ** 0.9) * rng.range(0.88, 1.1);
    nodes.push({
      t,
      side,
      leaf: { side, spread: rng.range(0.8, 1.3), petiole: size * rng.range(0.3, 0.42), length: size, tilt: rng.range(0.5, 0.62), lobes: makeLobes(rng), tone: jitter(mix(green, LEAF_DEEP, rng.range(0, 0.22)), rng, 0.03) },
      tendril: t > 0.25 && rng.chance(0.65) ? { length: rng.range(1.4, 2.4), turns: rng.range(1.2, 2.2), r: rng.range(0.55, 0.8), hand: rng.chance(0.5) ? 1 : -1 } : undefined,
    });
  }
  return nodes;
}

const groundPts = (s: StemPlan): Pt[] => stemPoints(s, 1, 1);

/** Largest scale (≤ 1) that keeps a runner's points, padded by their leaves, inside the box. */
function fitScale(r: Runner): number {
  let s = 1;
  const pts = groundPts(r.stem);
  for (const n of [{ t: 1, pad: 2 }, ...r.nodes.map((n) => ({ t: n.t, pad: (n.leaf ? n.leaf.length + n.leaf.petiole : 2) + 0.5 }))]) {
    const q = toScreen(pointAt(pts, n.t));
    if (Math.abs(q.x) > 1e-6) s = Math.min(s, (BOX.x - n.pad) / Math.abs(q.x));
    if (q.y < -1e-6) s = Math.min(s, (-BOX.top - n.pad * 0.8) / -q.y);
    if (q.y > 1e-6) s = Math.min(s, (BOX.bottom - n.pad * 0.6) / q.y);
  }
  return Math.max(0.35, s);
}

export function planColocynth(rng: Rng): ColocynthPlan {
  const green = jitter(LEAF, rng, 0.03);
  const runners: Runner[] = [];
  const n = rng.int(5, 7);
  const spin = rng.range(0, Math.PI * 2);
  const order = rng.shuffle([...Array(n).keys()]);
  for (let i = 0; i < n; i++) {
    const angle = spin + (i / n) * Math.PI * 2 + rng.gaussian(0, 0.22);
    const length = rng.range(17, 31);
    const stem = makeStem(rng, { base: { x: rng.gaussian(0, 0.6), y: rng.gaussian(0, 0.6) }, length, angle, bend: rng.gaussian(0, 0.55), segments: 9, tipBias: 0.35, wobble: 0.12 });
    const window = [...stagger(order.indexOf(i), n, [0.03, 0.5], 0.62)] as [number, number];
    runners.push({ stem, nodes: makeNodes(rng, length, green, rng.range(6.6, 7.8)), window, width: rng.range(0.8, 1), depth: 0 });
  }
  for (const r of runners) r.stem.length *= fitScale(r);
  // a few runners fork part-way, so the mat is a tangle and not a star
  for (const pi of [...runners.keys()]) {
    const parent = runners[pi]!;
    if (!rng.chance(0.55)) continue;
    const tb = rng.range(0.32, 0.58);
    const q = pointAt(groundPts(parent.stem), tb);
    const length = parent.stem.length * (1 - tb) * rng.range(0.6, 0.95);
    const stem = makeStem(rng, { base: { x: q.x, y: q.y }, length, angle: q.angle + (rng.chance(0.5) ? 1 : -1) * rng.range(0.5, 0.95), bend: rng.gaussian(0, 0.5), segments: 7, tipBias: 0.35, wobble: 0.12 });
    const start = lerp(parent.window[0], parent.window[1], tb);
    const br: Runner = { stem, nodes: makeNodes(rng, length, green, rng.range(5, 6)), window: [start, Math.min(0.62, start + rng.range(0.2, 0.28))], width: parent.width * 0.85, depth: 0 };
    br.stem.length *= fitScale(br);
    runners.push(br);
  }
  for (const r of runners) {
    const pts = groundPts(r.stem);
    r.depth = pts.reduce((s, q) => s + q.y, 0) / pts.length;
  }

  // the gourds lie beside nodes on the near side of the mat, each on its own runner
  const cands: { ri: number; ni: number; at: Pt; r: number; yaw: number }[] = [];
  runners.forEach((rn, ri) => {
    const pts = groundPts(rn.stem);
    rn.nodes.forEach((nd, ni) => {
      if (nd.t < 0.3 || nd.t > 0.85) return;
      const q = pointAt(pts, nd.t);
      const r = rng.range(3.7, 4.5);
      // the side whose normal faces us
      const s = Math.cos(q.angle) >= 0 ? 1 : -1;
      const at = { x: q.x - Math.sin(q.angle) * s * (r + 0.6), y: q.y + Math.cos(q.angle) * s * (r + 0.6) };
      const sc = toScreen(at);
      if (Math.abs(sc.x) + r > BOX.x || sc.y + r * 0.6 > BOX.bottom || sc.y - r * 2 < BOX.top) return;
      cands.push({ ri, ni, at, r, yaw: q.angle + rng.gaussian(0, 0.4) });
    });
  });
  const ng = rng.chance(0.55) ? 3 : 2;
  const gourds: Gourd[] = [];
  for (const c of rng.shuffle(cands).sort((a, b) => Number(b.at.y > -3) - Number(a.at.y > -3))) {
    if (gourds.length >= ng) break;
    if (gourds.some((g) => g.runner === c.ri || Math.hypot(g.at.x - c.at.x, (g.at.y - c.at.y) * SIN_E) < g.r + c.r + 3)) continue;
    const stripes = [];
    const ns = rng.int(9, 11);
    const rot = rng.range(0, Math.PI * 2);
    for (let i = 0; i < ns; i++) stripes.push({ lon: rot + (i / ns) * Math.PI * 2 + rng.gaussian(0, 0.06), w: rng.range(0.17, 0.24) });
    const mottles = Array.from({ length: rng.int(5, 8) }, () => ({ u: rng.range(0.25, 0.75) * Math.PI, lon: rng.range(0, Math.PI * 2), s: rng.range(0.06, 0.12) }));
    gourds.push({ runner: c.ri, node: c.ni, at: c.at, r: c.r, yaw: c.yaw, ripe: 0, swell: [0, 0], ripen: [0, 0], bloom: [0, 0], flower: { size: rng.range(1.35, 1.6), rot: rng.range(0, Math.PI * 2) }, stripes, mottles });
  }
  // the first set is the oldest: it swells first and ripens fully; the others lag behind
  const ripeAt = ng === 3 ? [1, rng.range(0.45, 0.65), rng.range(0, 0.12)] : [1, rng.range(0.1, 0.4)];
  gourds.forEach((g, k) => {
    g.swell = [...stagger(k, gourds.length, [0.5, 0.86], 0.6)] as [number, number];
    g.bloom = [g.swell[0] - 0.14, g.swell[0] + 0.02];
    g.ripe = ripeAt[k] ?? 0;
    g.ripen = [Math.min(0.9, g.swell[1] - 0.02), 1];
  });

  // no leaf may lie over a gourd: drop the ones in front of it that would hide it
  for (const g of gourds) {
    runners.forEach((rn) => {
      const pts = groundPts(rn.stem);
      for (const nd of rn.nodes) {
        if (!nd.leaf) continue;
        const q = pointAt(pts, nd.t);
        const a = q.angle + nd.side * nd.leaf.spread;
        const mid = nd.leaf.petiole + nd.leaf.length * 0.5;
        const c = { x: q.x + Math.cos(a) * mid, y: q.y + Math.sin(a) * mid };
        const d = Math.hypot(c.x - g.at.x, c.y - g.at.y);
        if (d < g.r + nd.leaf.length * 0.55 && c.y > g.at.y - g.r * 1.2) nd.leaf = undefined;
      }
    });
  }

  const used = new Set(gourds.map((g) => `${g.runner}-${g.node}`));
  const male: MaleFlower[] = [];
  const nm = rng.int(2, 4);
  const spots = rng.shuffle(runners.flatMap((rn, ri) => rn.nodes.map((nd, ni) => ({ ri, ni, t: nd.t })).filter((s) => s.t > 0.2 && s.t < 0.8 && !used.has(`${s.ri}-${s.ni}`))));
  for (const s of spots) {
    if (male.length >= nm) break;
    if (male.some((m) => m.runner === s.ri)) continue;
    male.push({ runner: s.ri, node: s.ni, stalk: rng.range(1.8, 3), lean: rng.gaussian(0, 0.35), size: rng.range(1.35, 1.65), rot: rng.range(0, Math.PI * 2), open: [0, 0] });
  }
  male.forEach((m, k) => (m.open = [...stagger(k, male.length, [0.46, 0.84], 0.55)] as [number, number]));
  return { runners, gourds, flowers: male };
}

/** How far a runner has crept at growth g. */
const extent = (rn: Runner, g: number): number => ease(g, rn.window[0], rn.window[1]);
/** Leaves follow a little behind the runner's tip. */
const leafK = (ext: number, t: number): number => smooth((ext * 1.12 - t - 0.05) / 0.32);

function drawRunner(p: Parameters<SpeciesDef['draw']>[0], rng: Rng, rn: Runner, ri: number, g: number): void {
  const ext = extent(rn, g);
  if (!visible(ext)) return;
  const full = groundPts(rn.stem);
  const pts = subPath(full, lerp(0.03, 1, ext)).map(toScreen);
  p.stroke(pts, { rng: rng.fork('stem'), pigment: STEM, width: 0.8 * rn.width, taper: [0.03, 0.35], pressure: [1, 0.85, 0.65], wobble: 0.25, wetness: 0.45, opacity: 0.6 * smooth(ext * 4), edge: 0.25 });
  const leaves: LobedLeaf[] = [];
  const ts: Tendril[] = [];
  rn.nodes.forEach((nd, j) => {
    const q = pointAt(full, nd.t);
    const sq = toScreen(q);
    const lk = leafK(ext, nd.t);
    if (nd.leaf && visible(lk)) {
      const lf = nd.leaf;
      // the leaf lifts off the runner on its stalk and swings out as it unfolds
      const a = q.angle + nd.side * lf.spread * lerp(0.4, 1, smooth(lk));
      const pet = lf.petiole * lk;
      const base = { x: sq.x + Math.cos(a) * pet, y: sq.y + Math.sin(a) * pet * SIN_E - 1.1 * lk * COS_E };
      leaves.push({ key: `${ri}-${j}`, base, yaw: a + nd.side * 0.15, length: lf.length * lk, tilt: lf.tilt, lobes: lf.lobes, tone: lf.tone });
    }
    const tk = smooth((ext * 1.1 - nd.t) / 0.3);
    if (nd.tendril && visible(tk)) {
      const a = q.angle - nd.side * 1.1;
      const dir = toScreen({ x: Math.cos(a), y: Math.sin(a) });
      ts.push({ key: `t-${ri}-${j}`, at: sq, angle: Math.atan2(dir.y - 0.5, dir.x), ...nd.tendril, k: tk });
    }
  });
  lobedLeaves(p, rng.fork('leaves'), leaves, { deep: LEAF_DEEP, opacity: 0.86 });
  tendrils(p, rng.fork('tendrils'), ts, TENDRIL);
}

function gourdNow(plan: ColocynthPlan, gd: Gourd, g: number): { c: Pt; r: number; ripe: number; swell: number } {
  const swell = ease(g, gd.swell[0], gd.swell[1]);
  const r = gd.r * lerp(0.06, 1, swell);
  const sc = toScreen(gd.at);
  // a small ovary starts at the node and rolls out to its place on the sand as it swells
  const rn = plan.runners[gd.runner]!;
  const node = toScreen(pointAt(groundPts(rn.stem), rn.nodes[gd.node]!.t));
  const at = { x: lerp(node.x, sc.x, smooth(swell)), y: lerp(node.y, sc.y, smooth(swell)) };
  return { c: { x: at.x, y: at.y - r * COS_E }, r, ripe: gd.ripe * ease(g, gd.ripen[0], gd.ripen[1]), swell };
}

function drawGourds(p: Parameters<SpeciesDef['draw']>[0], rng: Rng, plan: ColocynthPlan, g: number): FlowerNow[] {
  const fls: FlowerNow[] = [];
  const order = plan.gourds.map((gd, i) => [gd, i] as const).sort((a, b) => a[0].at.y - b[0].at.y);
  for (const [gd, i] of order) {
    const rn = plan.runners[gd.runner]!;
    if (!visible(leafK(extent(rn, g), rn.nodes[gd.node]!.t))) continue;
    const now = gourdNow(plan, gd, g);
    const bloom = ease(g, gd.bloom[0], gd.bloom[1]);
    if (visible(bloom)) {
      fls.push({ key: `g-${i}`, c: { x: now.c.x, y: now.c.y - now.r * 0.6 }, size: gd.flower.size, rot: gd.flower.rot, open: bloom, wither: ease(g, gd.swell[0] + 0.02, gd.swell[0] + 0.16), view: { tilt: 0.62, roll: UP } });
    }
    if (!visible(now.swell)) continue;
    const node = toScreen(pointAt(groundPts(rn.stem), rn.nodes[gd.node]!.t));
    const toward = Math.atan2(node.y - now.c.y, node.x - now.c.x);
    const rim = { x: now.c.x + Math.cos(toward) * now.r * 0.9, y: now.c.y + Math.sin(toward) * now.r * 0.9 };
    if (Math.hypot(rim.x - node.x, rim.y - node.y) > 0.4) {
      p.stroke([node, { x: (node.x + rim.x) / 2, y: (node.y + rim.y) / 2 - 0.4 }, rim], { rng: rng.fork(`stalk-${i}`), pigment: mix(STEM, PIGMENTS.wood, 0.3), width: 0.5, taper: [0.1, 0.2], wobble: 0.1, wetness: 0.3, opacity: 0.75 * smooth(now.swell * 4), edge: 0.4 });
    }
    gourd(p, rng.fork(`gourd-${i}`), { key: `${i}`, c: now.c, r: now.r, yaw: gd.yaw, ripe: now.ripe, stripes: gd.stripes, mottles: gd.mottles }, COLOURS);
  }
  return fls;
}

function maleFlowers(plan: ColocynthPlan, g: number): FlowerNow[] {
  return plan.flowers.flatMap((m, i) => {
    const rn = plan.runners[m.runner]!;
    const nd = rn.nodes[m.node]!;
    const open = ease(g, m.open[0], m.open[1]) * leafK(extent(rn, g), nd.t);
    if (!visible(open)) return [];
    const q = toScreen(pointAt(groundPts(rn.stem), nd.t));
    const lift = m.stalk * lerp(0.3, 1, smooth(open)) * COS_E;
    return [{ key: `m-${i}`, c: { x: q.x + Math.sin(m.lean) * lift, y: q.y - Math.cos(m.lean) * lift }, size: m.size, rot: m.rot, open, wither: 0, view: { tilt: 0.6, roll: lerpAngle(UP, UP + m.lean, 0.6) } }];
  });
}

const colocynth: SpeciesDef = {
  id: 'colocynth',
  name: 'Colocynth',
  nativeName: 'Lḥdej',
  nativeLang: 'ary-Latn',
  // wild on the sands and gravels of the Sahara and Arabia; it rarely reaches the coast
  range: { realms: ['n-africa-arabia'], biomes: ['desert'], climates: ['arid'] },
  tier: 1,
  habitats: ['path', 'rock'],
  sizeClass: 'small',
  // drawn in the 70-unit design box; the crown sits low-centre so the vine can lie all round it
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.62 },
  description: 'Colocynth — small gold moons on the sand, bitter to the core.',
  bloomColor: '#e8c75a',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planColocynth(rng.fork('plan'));
    const g = clamp01(opts.growth);
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      sandBed(p, r.fork('bed'), { rx: 22, k: ease(g, 0.02, 0.5), seed: 1 - ease(g, 0.04, 0.14), crown: ease(g, 0.06, 0.4), sand: SAND, crownTone: mix(PIGMENTS.wood, PIGMENTS.sumi, 0.2) });
      groundShadow(p, r, { rx: 22, ry: 6, k: ease(g, 0.15, 0.6), opacity: 0.08, pigment: PIGMENTS.shadow });
      const order = plan.runners.map((rn, i) => [rn, i] as const).sort((a, b) => a[0].depth - b[0].depth);
      for (const [rn, i] of order) drawRunner(p, r.fork(`runner-${i}`), rn, i, g);
      const fls = drawGourds(p, r.fork('gourds'), plan, g);
      flowers(p, r.fork('flowers'), [...maleFlowers(plan, g), ...fls], { petal: mix(PETAL, PIGMENTS.petalWhite, 0.3), deep: mix(PETAL, '#b8862e', 0.55), dry: '#b59a6a' });
    } finally {
      end();
    }
  },
};

export default colocynth;
