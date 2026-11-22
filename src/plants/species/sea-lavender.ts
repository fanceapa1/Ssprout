import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pt } from '../../paint';
import {
  paddleGeometry,
  paintDots,
  paintHaze,
  paintPaddles,
  paintWires,
  type DotMark,
  type HazeMark,
  type PaddleMark,
  type WireMark,
} from '../lib/sea-lavender-paint';
import { clamp01, lerp, ramp, smooth } from '../lib/shrub-growth';
import { groundShadow, plantFrame, seedMound } from '../lib/small-paint';
import { UP, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Sea lavender (Limonium): a flat rosette of leathery blue-green paddle leaves hugging a rock,
 * and over it a few wiry bare stems that fork into a wide, airy panicle of tiny papery pale lilac
 * flowers. Not a lavender: no spike, no violet.
 */

const LEAF = '#86a493';
const LEAF_LIGHT = '#a3bba6';
const LEAF_DEEP = '#5f8575';
const WIRE = '#bcbbae';
const WIRE_DEEP = '#a09ba2';
const HAZE = '#d9cce6';
const OPEN = '#d0bce0';
const OPEN_DEEP = '#ae96c8';
const BUD = '#a89cb4';
const PAPER = '#ece4ee';
const SHADOW = '#7e948c';
const CRACK = mix(PIGMENTS.shadow, PIGMENTS.stoneWarm, 0.3);

const BOX = { w: 86, h: 86, ax: 0.5, ay: 0.9 };
const FLAT = 0.3;

interface LeafPlan {
  theta: number;
  len: number;
  wid: number;
  lift: number;
  tone: number;
  window: [number, number];
  seed: number;
}

interface DotPlan {
  /** where along the branch (0.5 … 1) and how far to its side */
  u: number;
  off: number;
  r: number;
  tone: number;
  opens: number;
  glint: boolean;
  seed: number;
}

interface BranchPlan {
  id: string;
  parent: string | null;
  attach: number;
  stem: StemPlan;
  window: [number, number];
  width: number;
  gen: number;
  dots: DotPlan[];
  seed: number;
}

export interface SeaLavender {
  foot: number;
  leaves: LeafPlan[];
  branches: BranchPlan[];
  seeds: { ground: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

export function buildSeaLavender(rng: Rng): SeaLavender {
  const foot = rng.range(-2, 2);
  const leaves: LeafPlan[] = [];
  const nLeaf = rng.int(12, 14);
  const order = rng.shuffle(Array.from({ length: nLeaf }, (_, i) => i));
  for (let i = 0; i < nLeaf; i++) {
    const theta = ((i + rng.range(0.15, 0.85)) / nLeaf) * Math.PI * 2;
    const front = Math.sin(theta) > 0;
    const w0 = 0.05 + (order[i]! / nLeaf) * 0.2;
    leaves.push({
      theta,
      len: rng.range(17, 23) * (front ? 0.8 : 1),
      wid: rng.range(6.4, 8.4),
      lift: rng.range(1, 4),
      tone: rng.next(),
      window: [w0, w0 + 0.3],
      seed: seedOf(rng),
    });
  }
  leaves.sort((a, b) => Math.sin(a.theta) - Math.sin(b.theta));

  const branches: BranchPlan[] = [];
  const dotsFor = (n: number, w0: number, spread: number, u0: number): DotPlan[] =>
    Array.from({ length: n }, (_, j) => ({
      u: lerp(u0, 1, (j + rng.range(0.1, 0.9)) / n),
      off: rng.range(-spread, spread),
      r: rng.range(0.85, 1.3),
      tone: rng.next(),
      opens: Math.min(0.88, w0 + 0.12 + rng.range(0, 0.1)),
      glint: rng.chance(0.4),
      seed: seedOf(rng),
    }));
  const add = (id: string, parent: string | null, attach: number, base: Pt, angle: number, length: number, bend: number, w0: number, span: number, width: number, gen: number, dots: number) =>
    branches.push({
      id,
      parent,
      attach,
      stem: makeStem(rng, { base, length, angle, bend, segments: gen === 0 ? 5 : 3, tipBias: 0.3, wobble: gen === 0 ? 0.08 : 0.1 }),
      window: [w0, w0 + span],
      width,
      gen,
      dots: dotsFor(dots, w0, 1.3, gen === 0 ? 0.88 : 0.3),
      seed: seedOf(rng),
    });

  const nMain = rng.int(3, 4);
  for (let i = 0; i < nMain; i++) {
    const u = nMain === 1 ? 0 : lerp(-1, 1, (i + rng.range(0.2, 0.8)) / nMain);
    const lean = u * 0.4 + rng.gaussian(0, 0.05);
    const length = lerp(54, 44, Math.abs(u)) * rng.range(0.92, 1.06);
    const w0 = 0.34 + i * 0.025 + rng.range(0, 0.02);
    add(`m${i}`, null, 0, { x: foot + u * 5, y: -3 }, UP + lean, length, -lean * 0.3, w0, 0.26, 0.8, 0, 6);
    const nb = rng.int(6, 7);
    for (let k = 0; k < nb; k++) {
      const t = lerp(0.36, 0.95, (k + rng.range(0.1, 0.9)) / nb);
      const side = k % 2 ? 1 : -1;
      const len = lerp(17, 7, (t - 0.36) / 0.59) * rng.range(0.85, 1.1);
      const bw0 = w0 + 0.08 + t * 0.12;
      const id = `m${i}b${k}`;
      add(id, `m${i}`, t, { x: 0, y: 0 }, UP + side * rng.range(0.75, 1.1), len, side * rng.range(-0.5, -0.2), bw0, 0.2, 0.42, 1, 5);
      if (len > 9) {
        for (let c = 0; c < 2; c++) {
          const cs = c === 0 ? -1 : 1;
          add(`${id}s${c}`, id, c === 0 ? 0.55 : 0.92, { x: 0, y: 0 }, UP + cs * rng.range(0.5, 0.8), len * rng.range(0.42, 0.55), cs * rng.range(-0.4, -0.1), bw0 + 0.08, 0.18, 0.3, 2, 4);
        }
      }
    }
  }
  return { foot, leaves, branches, seeds: { ground: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface SeaLavenderPose {
  leaves: (PaddleMark & { id: string; len: number })[];
  wires: (WireMark & { id: string })[];
  hazes: (HazeMark & { id: string })[];
  dots: (DotMark & { id: string })[];
}

export function poseSeaLavender(plant: SeaLavender, g: number): SeaLavenderPose {
  const pose: SeaLavenderPose = { leaves: [], wires: [], hazes: [], dots: [] };
  const ends = new Map<string, Pt[]>();

  plant.leaves.forEach((l, i) => {
    const k = ramp(g, l.window[0], l.window[1]);
    if (k < 0.012) return;
    const size = lerp(0.2, 1, smooth(k));
    const cx = Math.cos(l.theta);
    const cy = Math.sin(l.theta) * FLAT;
    const len = l.len * size * Math.hypot(cx, cy);
    const geom = paddleGeometry({ x: plant.foot, y: -2 }, Math.atan2(cy, cx), len, l.wid * lerp(0.4, 1, smooth(k)), l.lift * size);
    pose.leaves.push({
      id: `leaf-${i}`,
      geom,
      pigment: mix(LEAF, LEAF_LIGHT, l.tone * 0.7),
      deep: LEAF_DEEP,
      seed: l.seed,
      alpha: smooth(k * 3),
      len,
    });
  });

  plant.branches.forEach((b, bi) => {
    const par = b.parent ? ends.get(b.parent) : null;
    if (b.parent && !par) return;
    const k = ramp(g, b.window[0], b.window[1]);
    if (k < 0.012) return;
    let base = b.stem.base;
    let dir = b.stem.angle;
    if (par) {
      const at = pointAt(par, b.attach);
      base = { x: at.x, y: at.y };
      dir = at.angle + (b.stem.angle - UP);
    }
    const pts = stemPoints({ ...b.stem, base, angle: dir }, lerp(0.06, 1, smooth(k)), lerp(0.5, 1, smooth(k)));
    ends.set(b.id, pts);
    pose.wires.push({
      id: b.id,
      pts,
      width: b.width * (0.55 + 0.45 * smooth(k * 1.4)),
      pigment: b.gen === 0 ? mix(WIRE, LEAF, 0.2) : mix(WIRE, PAPER, 0.3),
      deep: WIRE_DEEP,
      seed: b.seed,
    });
    if (b.gen === 0) {
      const mid = pointAt(pts, 0.75);
      const haze = smooth(ramp(g, b.window[0] + 0.18, b.window[1] + 0.3));
      pose.hazes.push({ id: `haze-${b.id}`, at: { x: mid.x, y: mid.y - 2 }, rx: 15 * haze, ry: 12 * haze, rot: 0, alpha: haze, pigment: HAZE, seed: b.seed + 3 });
    }
    b.dots.forEach((d, j) => {
      const size = smooth(ramp(g, d.opens - 0.1, d.opens));
      if (size < 0.02) return;
      const open = ramp(g, d.opens, d.opens + 0.12);
      const at = pointAt(pts, d.u);
      pose.dots.push({
        id: `dot-${bi}-${j}`,
        at: { x: at.x + Math.cos(at.angle + Math.PI / 2) * d.off, y: at.y + Math.sin(at.angle + Math.PI / 2) * d.off },
        r: d.r * lerp(0.3, 1, size),
        alpha: smooth(size * 2.5),
        pigment: mix(mix(BUD, OPEN, smooth(open)), PAPER, d.tone * 0.45 * open),
        deep: OPEN_DEEP,
        depth: d.tone > 0.6 ? open : 0,
        glint: d.glint,
        seed: d.seed,
      });
    });
  });
  return pose;
}

/** Every point a full-grown plant paints (for the box test). */
export function seaLavenderReach(plant: SeaLavender): Pt[] {
  const pose = poseSeaLavender(plant, 1);
  return [
    ...pose.leaves.flatMap((l) => l.geom.outline),
    ...pose.wires.flatMap((s) => s.pts),
    ...pose.dots.flatMap((d) => [{ x: d.at.x - d.r * 1.3, y: d.at.y - d.r * 1.3 }, { x: d.at.x + d.r * 1.3, y: d.at.y + d.r * 1.3 }]),
    ...pose.hazes.flatMap((h) => [{ x: h.at.x - h.rx, y: h.at.y - h.ry }, { x: h.at.x + h.rx, y: h.at.y + h.ry }]),
  ];
}

const seaLavender: SpeciesDef = {
  id: 'sea-lavender',
  name: 'Sea lavender',
  nativeName: 'Limonio',
  nativeLang: 'el-Latn',
  // wild on Mediterranean rocky coasts and salt flats
  range: { realms: ['mediterranean'], biomes: ['coast'], climates: ['mediterranean'] },
  tier: 2,
  habitats: ['rock'], sites: ['sea-rock'],
  sizeClass: 'small',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Sea lavender: a lilac froth on bare wires over a salt-rock rosette.',
  bloomColor: '#c0a8d0',
  pollinators: true,
  draw(p: Painter, rng: Rng, opts) {
    const plant = buildSeaLavender(rng);
    const g = clamp01(opts.growth);
    const end = plantFrame(p, seaLavender, opts);
    try {
      const r = createRng(plant.seeds.ground);
      crack(p, r, g, plant.foot);
      groundShadow(p, r, { rx: 24, ry: 4, x: plant.foot, k: ramp(g, 0.06, 0.6), opacity: 0.16, pigment: SHADOW });
      seedMound(p, r, g, { rx: 8, x: plant.foot });
      const pose = poseSeaLavender(plant, g);
      paintHaze(p, pose.hazes);
      paintWires(p, pose.wires);
      paintPaddles(p, pose.leaves);
      paintDots(p, pose.dots);
    } finally {
      end();
    }
  },
};

/** The dark rift the rosette grows out of. */
function crack(p: Painter, rng: Rng, g: number, x: number): void {
  const k = ramp(g, 0.02, 0.3);
  if (k < 0.02) return;
  p.wash({ cx: x, cy: 0.6, rx: 13 * k, ry: 1.7 }, CRACK, { rng: rng.fork('crack'), opacity: 0.3 * k, edge: 0.4, sharpness: 0.5, centreLift: 0.05, granulation: 0.3 });
}

export default seaLavender;
