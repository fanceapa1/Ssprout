import type { Rng } from '../../core/rng';
import { mix, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, ramp, smooth } from '../lib/shrub-growth';
import { groundShadow, inPlantSpace, seedAndShoot } from '../lib/shrub-paint';
import { UP } from '../lib/small-structure';
import {
  bractShapes,
  paintHaze,
  paintHeads,
  paintStems,
  paintTufts,
  spurgeLeaf,
  type BractHead,
  type HazeMark,
  type SpurgeLeaf,
  type StemMark,
} from '../lib/tree-spurge-paint';
import type { SpeciesDef } from '../types';

/**
 * Tree spurge (Euphorbia dendroides): a rounded dome of red-brown stems, each forking in twos,
 * with tufts of narrow blue-green leaves at the tips and, in spring, flat lime-yellow bract heads
 * over the whole dome.
 */

const LEAF = '#86a592';
const LEAF_WARM = '#9db27f';
const LEAF_BACK = '#6b8a80';
const STEM = '#8a5a44';
const LIME = '#c6cd5e';
const LIME_BRIGHT = '#d6d45a';
const HAZE = '#9fb27e';
const TWIG = '#a3937a';

const BOX = { w: 200, h: 220, ax: 0.5, ay: 0.93 };
const DOME = { cy: -14, rx: 86, ry: 132, spread: 1.4 };
/** the fraction of the way out to the dome's rim each fork depth stands at */
const REACH = [0.04, 0.16, 0.3, 0.44, 0.58, 0.72, 0.86, 1];
const WIDTH = [5.2, 4, 3.1, 2.4, 1.8, 1.35, 1, 0.75];

interface LeafPlan {
  turn: number;
  len: number;
  wid: number;
  tone: number;
  seed: number;
}

interface NodePlan {
  parent: number;
  depth: number;
  pos: Pt;
  /** the direction out from the dome's heart, from straight up */
  phi: number;
  window: [number, number];
  /** 0 the far side of the dome (painted under the stems), 1 the near side */
  band: 0 | 1;
  tip: boolean;
  leaves: LeafPlan[];
  head: { bloom: number; R: number; rot: number; lift: number; bracts: [number, number, number][]; tone: number; seed: number } | null;
  seed: number;
}

export interface TreeSpurge {
  foot: number;
  nodes: NodePlan[];
  haze: { node: number; dy: number; rx: number; ry: number; seed: number; tone: number }[];
  seeds: { ground: number; sprout: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

function leavesOf(rng: Rng, tip: boolean): LeafPlan[] {
  const n = tip ? rng.int(10, 14) : rng.int(5, 7);
  return Array.from({ length: n }, (_, i) => ({
    turn: lerp(-1.55, 1.55, (i + rng.range(0.2, 0.8)) / n),
    len: rng.range(7, 10.5) * (tip ? 1 : 0.8),
    wid: rng.range(1.7, 2.3),
    tone: rng.next(),
    seed: seedOf(rng),
  }));
}

function bractsOf(rng: Rng): [number, number, number][] {
  const n = rng.int(4, 6);
  return Array.from({ length: n }, (_, k) => [(k / n) * Math.PI * 2 + rng.range(-0.3, 0.3), rng.range(0.35, 0.65), rng.range(0.38, 0.5)]);
}

export function buildTreeSpurge(rng: Rng): TreeSpurge {
  const foot = rng.range(-3, 3);
  const nodes: NodePlan[] = [];
  const maxDepth = 7;
  let near = rng.chance(0.5);
  const add = (parent: number, depth: number, lo: number, hi: number, rho: number, band: 0 | 1) => {
    const phi = (lo + hi) / 2 + rng.range(-0.06, 0.06);
    const r = REACH[depth]! * lerp(1, rho, clamp01((depth - 2) / (maxDepth - 2)));
    const pos =
      depth === 0
        ? { x: foot + rng.range(-1.5, 1.5), y: -rng.range(7, 11) }
        : { x: Math.sin(phi) * DOME.rx * r, y: DOME.cy - Math.cos(phi) * DOME.ry * r };
    // a few branches stop forking early, so the dome is not a perfect fan
    const tip = depth === maxDepth || (depth === maxDepth - 1 && rng.chance(0.22));
    const w0 = 0.02 + depth * 0.064 + rng.range(0, 0.03);
    const i = nodes.length;
    nodes.push({
      parent,
      depth,
      pos,
      phi: depth === 0 ? 0 : phi,
      window: [w0, w0 + rng.range(0.17, 0.22)],
      band,
      tip,
      leaves: leavesOf(rng, tip || depth < 2),
      head: tip
        ? {
            bloom: 0,
            R: rng.range(5.2, 7),
            rot: rng.range(0, 6.28),
            lift: rng.range(2, 4),
            bracts: bractsOf(rng),
            tone: rng.next(),
            seed: seedOf(rng),
          }
        : null,
      seed: seedOf(rng),
    });
    if (tip) return;
    const split = lerp(lo, hi, 0.5 + rng.range(-0.12, 0.12));
    // from the third fork on, a limb stands on the near side of the dome (inside its outline,
    // painted over the stems) or on the far side (on the rim, painted under them)
    const limb = () => {
      if (depth !== 3) return { rho: depth + 1 === maxDepth ? rho * rng.range(0.93, 1.03) : rho, band };
      near = !near;
      return near ? { rho: rng.range(0.48, 0.88), band: 1 as const } : { rho: rng.range(0.92, 1), band: 0 as const };
    };
    const l1 = limb();
    add(i, depth + 1, lo, split, l1.rho, l1.band);
    const l2 = limb();
    add(i, depth + 1, split, hi, l2.rho, l2.band);
  };
  add(-1, 0, -DOME.spread, DOME.spread, 1, 1);

  // the heads open from the top of the dome outward, staggered
  const tips = nodes.filter((n) => n.head);
  const order = tips.map((n) => ({ n, key: Math.abs(n.pos.x) / DOME.rx + rng.range(0, 0.5) })).sort((a, b) => a.key - b.key);
  order.forEach(({ n }, k) => (n.head!.bloom = lerp(0.6, 0.84, k / Math.max(1, order.length - 1))));

  const haze = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.depth === 4 || n.depth === 6)
    .map(({ n, i }) => ({ node: i, dy: -4, rx: n.depth === 4 ? rng.range(22, 28) : rng.range(11, 15), ry: n.depth === 4 ? rng.range(18, 24) : rng.range(9, 12), seed: seedOf(rng), tone: rng.next() }));
  // the far side of the dome, seen behind the trunk's first fork
  haze.unshift({ node: 0, dy: -50, rx: rng.range(58, 66), ry: rng.range(40, 46), seed: seedOf(rng), tone: rng.next() });
  return { foot, nodes, haze, seeds: { ground: seedOf(rng), sprout: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface TreeSpurgePose {
  haze: (HazeMark & { id: string })[];
  stems: (StemMark & { id: string })[];
  leaves: (SpurgeLeaf & { id: string; band: 0 | 1 })[];
  heads: (BractHead & { id: string })[];
}

interface Grown {
  tip: Pt;
  dir: number;
  e: number;
}

function bezier(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

export function poseTreeSpurge(plant: TreeSpurge, g: number): TreeSpurgePose {
  const pose: TreeSpurgePose = { haze: [], stems: [], leaves: [], heads: [] };
  const S = lerp(0.42, 1, smooth(ramp(g, 0.04, 0.8)));
  const at = (q: Pt): Pt => ({ x: plant.foot + (q.x - plant.foot) * S, y: q.y * S });
  const bloomAll = smooth(ramp(g, 0.58, 0.9));
  const grown: (Grown | null)[] = [];
  const childE = new Map<number, number>();

  plant.nodes.forEach((n, i) => {
    const par = n.parent >= 0 ? grown[n.parent] : { tip: { x: plant.foot, y: 0 }, dir: UP, e: 1 };
    if (!par) return void grown.push(null);
    const gate = smooth(clamp01((par.e - 0.62) / 0.38));
    const e = smooth(ramp(g, n.window[0], n.window[1])) * gate;
    if (e < 0.01) return void grown.push(null);
    childE.set(n.parent, Math.max(childE.get(n.parent) ?? 0, e));
    const a = par.tip;
    const b = at(n.pos);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    // leaves the fork along the parent's line, then bends out: the candelabra of a dichotomy
    const ux = Math.cos(par.dir) + (b.x - a.x) / (len || 1);
    const uy = Math.sin(par.dir) + (b.y - a.y) / (len || 1);
    const un = Math.hypot(ux, uy) || 1;
    const c = { x: a.x + (ux / un) * len * 0.4, y: a.y + (uy / un) * len * 0.4 };
    const pts = Array.from({ length: 7 }, (_, k) => bezier(a, c, b, (k / 6) * e));
    const tip = pts[6]!;
    const q = pts[5]!;
    // measured from straight up, so a branch past horizontal does not flip sign
    const dir = UP + Math.atan2(tip.x - q.x, -(tip.y - q.y));
    grown.push({ tip, dir, e });
    const w = WIDTH[n.depth]! * lerp(0.45, 1, e) * lerp(0.55, 1, S);
    pose.stems.push({ id: `stem-${i}`, pts, width: w, pigment: mix(STEM, TWIG, n.depth / 8), seed: n.seed });
  });

  plant.nodes.forEach((n, i) => {
    const gs = grown[i];
    if (!gs) return;
    const kIn = smooth(ramp(gs.e, 0.1, 0.7));
    // the last forks keep part of their tuft, so the dome stays leafy inside
    const kOut = n.tip ? 1 : 1 - (n.depth >= 5 ? 0.55 : 1) * smooth(ramp(childE.get(i) ?? 0, 0.25, 0.95));
    const k = kIn * kOut;
    if (k < 0.015) return;
    const facing = UP + n.phi * 0.75;
    const band = n.band;
    n.leaves.forEach((l, j) => {
      const size = lerp(0.35, 1, kIn) * lerp(0.5, 1, kOut) * lerp(0.6, 1, S);
      const base = mix(LEAF, LEAF_WARM, l.tone * 0.7);
      pose.leaves.push({
        id: `leaf-${i}-${j}`,
        band,
        at: gs.tip,
        angle: facing + l.turn * lerp(0.55, 1, kIn),
        len: l.len * size,
        wid: l.wid * lerp(0.6, 1, size),
        pigment: band === 0 ? mix(base, LEAF_BACK, 0.5) : base,
        alpha: smooth(k * 2),
        seed: l.seed,
      });
    });
    const h = n.head;
    if (!h) return;
    const hk = smooth(ramp(g, h.bloom, h.bloom + 0.12)) * kIn;
    if (hk < 0.015) return;
    pose.heads.push({
      id: `head-${i}`,
      at: { x: gs.tip.x + Math.cos(facing) * h.lift * S, y: gs.tip.y + Math.sin(facing) * h.lift * S },
      R: h.R * lerp(0.3, 1, hk),
      rot: h.rot,
      pigment: mix(LIME, LIME_BRIGHT, h.tone),
      alpha: smooth(hk * 2),
      bracts: h.bracts,
      seed: h.seed,
    });
  });

  const hazeK = smooth(ramp(g, 0.18, 0.6));
  plant.haze.forEach((m, i) => {
    const gs = grown[m.node];
    if (!gs || hazeK < 0.01) return;
    const pigment: Pigment = mix(mix(HAZE, LEAF, m.tone * 0.5), LIME, bloomAll * 0.75);
    pose.haze.push({ id: `haze-${i}`, cx: gs.tip.x, cy: gs.tip.y + m.dy * S, rx: m.rx * S * lerp(0.4, 1, gs.e), ry: m.ry * S * lerp(0.4, 1, gs.e), pigment, alpha: hazeK * lerp(0.75, 1.15, bloomAll), seed: m.seed });
  });
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function treeSpurgeReach(plant: TreeSpurge): Pt[] {
  const pose = poseTreeSpurge(plant, 1);
  return [
    ...pose.stems.flatMap((s) => s.pts),
    ...pose.leaves.flatMap((l) => spurgeLeaf(l)),
    ...pose.heads.flatMap((h) => bractShapes(h).flat()),
    ...pose.haze.flatMap((m) => [{ x: m.cx - m.rx * 1.1, y: m.cy - m.ry * 1.1 }, { x: m.cx + m.rx * 1.1, y: m.cy + m.ry * 1.1 }]),
  ];
}

const treeSpurge: SpeciesDef = {
  id: 'tree-spurge',
  name: 'Tree spurge',
  // the Greek names in the research are unconfirmed, so the card shows the Latin
  nativeName: 'Euphorbia dendroides',
  nativeLang: 'la',
  // wild on the rocky coasts and sea cliffs of the Mediterranean, in its scrub
  range: { realms: ['mediterranean'], biomes: ['coast', 'scrub'], climates: ['mediterranean'] },
  tier: 3,
  habitats: ['back'],
  sizeClass: 'large',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Tree spurge: a lime-yellow dome of forked stems on the cliff.',
  bloomColor: LIME,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildTreeSpurge(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, treeSpurge, () => {
      groundShadow(p, plant.seeds.ground, g, plant.foot, 78, 7, 0.22);
      seedAndShoot(p, plant.seeds.sprout, g, { soil: 12, green: LEAF, handover: 0.2 });
      const pose = poseTreeSpurge(plant, g);
      paintHaze(p, pose.haze);
      paintTufts(p, pose.leaves.filter((l) => l.band === 0), { opacity: 0.72 });
      paintStems(p, pose.stems);
      paintTufts(p, pose.leaves.filter((l) => l.band === 1));
      paintHeads(p, pose.heads);
    });
  },
};

export default treeSpurge;
