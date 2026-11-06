import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, jitter, lighten, mix, type Pigment, type Pt } from '../../paint';
import { capsuleShape, floretShape, leafBlade, paintLeaves, paintMasses, paintSprays, paintTwigs, type Capsule, type Floret, type HennaLeaf, type Mass, type Twig } from '../lib/henna-paint';
import { clamp01, lerp, ramp, smooth, stagger } from '../lib/shrub-growth';
import { inPlantSpace } from '../lib/shrub-paint';
import { groundShadow, seedMound } from '../lib/small-paint';
import { UP, lerpAngle, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Henna (Lawsonia inermis): a small, much-branched, rounded bush of slender grey-brown twigs and
 * dense small opposite leaves, topped with airy sprays of tiny four-petalled cream flowers flushed
 * pink in the bud, and a few small round seed capsules.
 */

const LEAF = '#8fa85a';
const OLIVE = '#7a8a4a';
const STEM = mix('#8a5a44', '#a29c90', 0.55);
const YOUNG = '#8a5a44';
const CREAM = '#f1e2bf';
const SHADE = mix(OLIVE, PIGMENTS.shadow, 0.4);
const BUD = '#e6c7b0';
const EYE = mix('#d9b25a', '#c98a5a', 0.3);
const STALK = mix('#b3ad7a', '#c4a284', 0.4);
const CAPSULE = ['#a3a25e', '#9a8a54', '#8a6a48'] as const;

const BOX = { w: 120, h: 160, ax: 0.5, ay: 0.92 };
/** the rounded crown the twigs fill: centre and radii (plant units, base at 0) */
const DOME = { cy: -48, rx: 44, ry: 40 };

interface PairPlan {
  t: number;
  /** odd pairs turn toward and away from us, so they read foreshortened */
  facing: boolean;
  spread: number;
  length: number;
  width: number;
  tone: Pigment;
  seed: number;
}

interface SprayPlan {
  length: number;
  lean: number;
  /** side branchlets along the axis */
  arms: { t: number; side: 1 | -1; turn: number; length: number; florets: number[] }[];
  /** florets at the axis tip */
  top: number[];
  window: [number, number];
}

interface FloretPlan {
  id: number;
  /** offset from where it sits */
  dx: number;
  dy: number;
  radius: number;
  rot: number;
  squash: number;
  bud: boolean;
  petal: Pigment;
  open: [number, number];
  seed: number;
}

interface CapsulePlan {
  dx: number;
  dy: number;
  radius: number;
  pigment: Pigment;
  seed: number;
}

interface Branch {
  plan: StemPlan;
  /** index of the stem it grows from, and where (0..1 of that stem) */
  parent: { i: number; t: number } | null;
  window: [number, number];
  width: number;
  band: 0 | 1;
  pairs: PairPlan[];
  masses: { t: number; rx: number; ry: number; rot: number; dx: number; dy: number; tone: Pigment; seed: number }[];
  spray: SprayPlan | null;
  capsules: CapsulePlan[];
  seed: number;
}

export interface Henna {
  branches: Branch[];
  florets: FloretPlan[];
  foot: number;
  /** the soft body of green the whole dome sits on */
  crown: { tone: Pigment; seed: number };
  seeds: { ground: number; sprout: number };
}

const seedOf = (rng: Rng) => rng.int(1, 0x7fffffff);

/** Distance from `q` along `a` to the dome's edge. */
function toDome(q: Pt, a: number): number {
  const dx = Math.cos(a) / DOME.rx;
  const dy = Math.sin(a) / DOME.ry;
  const ox = q.x / DOME.rx;
  const oy = (q.y - DOME.cy) / DOME.ry;
  const A = dx * dx + dy * dy;
  const B = 2 * (ox * dx + oy * dy);
  const C = ox * ox + oy * oy - 1;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return 0;
  return Math.max(0, (-B + Math.sqrt(disc)) / (2 * A));
}

function pairsAlong(rng: Rng, from: number, length: number, green: Pigment, scale: number): PairPlan[] {
  const out: PairPlan[] = [];
  const step = rng.range(3.7, 4.4);
  const n = Math.max(1, Math.floor((length * (1 - from)) / step));
  const facing0 = rng.chance(0.5);
  for (let j = 0; j < n; j++) {
    const t = from + (1 - from) * ((j + rng.range(0.3, 0.6)) / n);
    const tipward = smooth((t - 0.6) / 0.4);
    out.push({
      t,
      facing: (j % 2 === 0) === facing0,
      spread: lerp(1.05, 0.6, tipward) + rng.range(-0.12, 0.12),
      length: rng.range(5.2, 6.6) * scale * lerp(1, 0.68, tipward),
      width: rng.range(2.4, 2.9) * scale * lerp(1, 0.75, tipward),
      tone: jitter(mix(green, rng.chance(0.4) ? OLIVE : lighten(green, 0.06), rng.range(0, 0.3)), rng, 0.03),
      seed: seedOf(rng),
    });
  }
  return out;
}

function sprayOf(rng: Rng, florets: FloretPlan[]): SprayPlan {
  const floret = (bud: boolean): number => {
    const f: FloretPlan = {
      id: florets.length,
      dx: rng.range(-1.2, 1.2),
      dy: rng.range(-1.2, 0.6),
      radius: rng.range(2.2, 2.7) * (bud ? 0.8 : 1),
      rot: rng.range(0, Math.PI * 2),
      squash: rng.range(0.65, 1),
      bud,
      petal: jitter(mix(mix(CREAM, '#fdf8ec', 0.55), rng.chance(0.3) ? BUD : '#fdf8ec', rng.range(0, 0.3)), rng, 0.015),
      open: [0, 0],
      seed: seedOf(rng),
    };
    florets.push(f);
    return f.id;
  };
  const nArms = rng.int(5, 7);
  const side0: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const arms: SprayPlan['arms'] = [];
  for (let j = 0; j < nArms; j++) {
    const t = lerp(0.18, 0.86, j / (nArms - 1)) + rng.range(-0.04, 0.04);
    const n = j < nArms - 2 ? rng.int(3, 5) : rng.int(2, 3);
    arms.push({
      t,
      side: (j % 2 ? side0 : -side0) as 1 | -1,
      turn: rng.range(0.75, 1.1),
      length: lerp(9.5, 5, t) * rng.range(0.85, 1.1),
      florets: Array.from({ length: n }, (_, k) => floret(k === n - 1 && rng.chance(0.45))),
    });
  }
  const top = Array.from({ length: rng.int(2, 3) }, (_, k) => floret(k > 0 && rng.chance(0.6)));
  return { length: rng.range(15, 22), lean: rng.range(-0.15, 0.15), arms, top, window: [0, 0] };
}

export function buildHenna(rng: Rng): Henna {
  const foot = rng.range(-3, 3);
  const green = jitter(LEAF, rng, 0.02);
  const branches: Branch[] = [];
  const florets: FloretPlan[] = [];
  // main stems fan from one crown, each ending on the dome's rim
  const n = rng.int(6, 8);
  const order = rng.shuffle([...Array(n).keys()]);
  for (let i = 0; i < n; i++) {
    const u = lerp(-1, 1, (i + rng.range(0.25, 0.75)) / n);
    const aim = UP + u * 1.18;
    const base = { x: foot + u * rng.range(2, 4), y: 0 };
    const dist = toDome(base, aim) * rng.range(0.8, 0.92);
    // they leave the crown flared, then curve back up
    const plan = makeStem(rng, { base, length: dist * 1.04, angle: aim + u * rng.range(0.12, 0.22), bend: -u * rng.range(0.2, 0.36), segments: 10, tipBias: 0.1, wobble: 0.025 });
    const start = 0.1 + 0.1 * (order[i]! / Math.max(1, n - 1));
    branches.push({ plan, parent: null, window: [start, start + rng.range(0.26, 0.3)], width: rng.range(1.1, 1.4), band: 0, pairs: [], masses: [], spray: null, capsules: [], seed: seedOf(rng) });
  }
  // side twigs branch off toward the dome's surface: much-branched, every way
  for (let i = 0; i < n; i++) {
    const stem = branches[i]!;
    const full = stemPoints(stem.plan, 1, 1);
    const m = rng.int(3, 5);
    let side: 1 | -1 = rng.chance(0.5) ? 1 : -1;
    for (let j = 0; j < m; j++) {
      const t = lerp(0.3, 0.9, (j + rng.range(0.2, 0.8)) / m);
      const node = pointAt(full, t);
      const a = node.angle + side * rng.range(0.45, 0.85);
      const reach = Math.min(30, toDome(node, a) * rng.range(0.85, 1));
      side = -side as 1 | -1;
      if (reach < 7) continue;
      const plan = makeStem(rng, { base: { x: node.x, y: node.y }, length: reach, angle: a, bend: -side * rng.range(0.05, 0.25), segments: 5, tipBias: 0.2, wobble: 0.03 });
      const w0 = stem.window[0] + t * (stem.window[1] - stem.window[0]) + 0.03;
      branches.push({ plan, parent: { i, t }, window: [w0, w0 + rng.range(0.2, 0.24)], width: rng.range(0.6, 0.8), band: rng.chance(0.4) ? 0 : 1, pairs: [], masses: [], spray: null, capsules: [], seed: seedOf(rng) });
    }
  }
  for (const b of branches) {
    const main = !b.parent;
    b.pairs = pairsAlong(rng, main ? 0.32 : 0.12, b.plan.length, green, main ? 1 : 0.94);
    const nm = main ? 2 : 1;
    for (let k = 0; k < nm; k++) {
      const t = main ? lerp(0.45, 0.75, k) : rng.range(0.3, 0.6);
      const inner = main && k === 0;
      b.masses.push({
        t,
        rx: rng.range(8, 11),
        ry: rng.range(6.5, 9),
        rot: rng.range(-0.5, 0.5),
        dx: rng.range(-2, 2),
        dy: rng.range(-1, 2.5),
        tone: inner ? mix(OLIVE, PIGMENTS.shadow, 0.25) : mix(green, OLIVE, rng.range(0.3, 0.7)),
        seed: seedOf(rng),
      });
    }
  }
  // sprays at the tips that face the sky, kept apart so the froth is airy, not a cap
  const tips = branches
    .map((b, i) => ({ i, tip: stemPoints(b.plan, 1, 1).at(-1)! }))
    .filter(({ tip }) => tip.y < DOME.cy - 2 && Math.abs(tip.x) < 34)
    .sort((a, b) => a.tip.y - b.tip.y);
  const placed: Pt[] = [];
  const nSprays = rng.int(9, 12);
  for (const { i, tip } of tips) {
    if (placed.length >= nSprays || placed.some((q) => Math.hypot(q.x - tip.x, q.y - tip.y) < 12)) continue;
    placed.push(tip);
    branches[i]!.spray = sprayOf(rng, florets);
  }
  // a few lower twig tips on the flanks carry last season's seed capsules
  const flanks = tips.length ? branches.filter((b) => b.parent && !b.spray) : [];
  const withCaps = rng.shuffle(flanks).slice(0, rng.int(1, 2));
  for (const b of withCaps) {
    b.capsules = Array.from({ length: rng.int(3, 5) }, (_, k) => ({
      dx: rng.range(-3.5, 3.5),
      dy: rng.range(-3.5, 1.5),
      radius: rng.range(1.2, 1.5),
      pigment: jitter(CAPSULE[(k + rng.int(0, 2)) % 3]!, rng, 0.02),
      seed: seedOf(rng),
    }));
  }
  // the sprays rise in turn; buds swell, then the florets open from the base of each spray up
  const sprayed = branches.filter((b) => b.spray);
  rng.shuffle(sprayed.map((_, k) => k)).forEach((k, j) => {
    const b = sprayed[k]!;
    const [w0, w1] = stagger(j, sprayed.length, 0.52, 0.84, 0.55);
    // a spray only rises once its twig has finished growing
    const shift = Math.max(0, b.window[1] - w0);
    b.spray!.window = [w0 + shift, Math.min(0.92, w1 + shift)];
  });
  for (const b of sprayed) {
    const s = b.spray!;
    const ids = [...s.arms.flatMap((a) => a.florets), ...s.top];
    ids.forEach((id, k) => {
      const f = florets[id]!;
      const o = stagger(k, ids.length, Math.max(s.window[1] - 0.02, 0.74), 0.99, 0.35);
      f.open = f.bud ? [2, 3] : o;
    });
  }
  const crown = { tone: mix(green, OLIVE, 0.35), seed: seedOf(rng) };
  return { branches, florets, foot, crown, seeds: { ground: seedOf(rng), sprout: seedOf(rng) } };
}

// ---------------------------------------------------------------------------------------------
// pose: every mark at a growth value (pure; the draw paints it, the tests check its continuity)

export interface HennaPose {
  twigs: (Twig & { id: string; band: number })[];
  stalks: (Twig & { id: string })[];
  masses: (Mass & { id: string })[];
  leaves: (HennaLeaf & { id: string; band: number })[];
  florets: (Floret & { id: string })[];
  capsules: (Capsule & { id: string })[];
}

interface Grown {
  pts: Pt[];
  ext: number;
}

const nodeAt = (gs: Grown, t: number) => pointAt(gs.pts, Math.min(1, t / Math.max(1e-3, gs.ext)));

function growBranch(plant: Henna, grown: (Grown | null)[], b: Branch, g: number): Grown | null {
  const k = ramp(g, b.window[0], b.window[1]);
  if (k < 0.012) return null;
  const ext = lerp(0.02, 1, k) * smooth(k * 6);
  let plan = b.plan;
  if (b.parent) {
    const pg = grown[b.parent.i];
    if (!pg) return null;
    const node = nodeAt(pg, b.parent.t);
    plan = { ...plan, base: { x: node.x, y: node.y } };
  }
  return { pts: stemPoints(plan, ext, lerp(0.3, 1, smooth(k))), ext };
}

export function poseHenna(plant: Henna, g: number): HennaPose {
  const pose: HennaPose = { twigs: [], stalks: [], masses: [], leaves: [], florets: [], capsules: [] };
  const grown: (Grown | null)[] = [];
  const leafGate = ramp(g, 0.2, 0.62);
  const kc = ramp(g, 0.3, 0.8);
  if (kc > 0.012) pose.masses.push({ id: 'crown', at: { x: plant.foot, y: DOME.cy + 6 }, rx: DOME.rx * lerp(0.3, 0.68, kc), ry: DOME.ry * lerp(0.3, 0.68, kc), rot: 0, pigment: plant.crown.tone, alpha: kc * 0.55, seed: plant.crown.seed });
  plant.branches.forEach((b, i) => {
    const gs = growBranch(plant, grown, b, g);
    grown[i] = gs;
    if (!gs) return;
    const kb = ramp(g, b.window[0], Math.min(1, b.window[1] + 0.25));
    const main = !b.parent;
    pose.twigs.push({ id: `twig-${i}`, band: b.band, pts: gs.pts, width: b.width * (0.4 + 0.6 * kb) * smooth(gs.ext * 5), pigment: main ? STEM : mix(STEM, YOUNG, 0.45), seed: b.seed, taper: main ? 0.55 : 0.7 });
    // shade masses fill in behind the leaves as the crown thickens
    b.masses.forEach((m, j) => {
      const k = smooth(clamp01((gs.ext - m.t * 0.8) / 0.3)) * ramp(g, 0.3, 0.72);
      if (k < 0.012) return;
      const q = nodeAt(gs, m.t);
      const at = { x: q.x + m.dx, y: Math.min(q.y + m.dy, -18) };
      // the light comes from the upper left: the far, lower side of the dome is in shade
      const dark = clamp01(0.45 + (at.x - plant.foot) / 70 + (at.y - DOME.cy) / 80);
      pose.masses.push({ id: `mass-${i}-${j}`, at, rx: m.rx * lerp(0.4, 0.9, k), ry: m.ry * lerp(0.4, 0.9, k), rot: m.rot, pigment: mix(m.tone, SHADE, 0.5 * dark), alpha: k, seed: m.seed });
    });
    // opposite leaf pairs unfold behind the growing tip
    b.pairs.forEach((pr, j) => {
      const k = smooth(clamp01((gs.ext - pr.t * 0.85) / 0.3)) * leafGate;
      if (k < 0.012) return;
      const node = nodeAt(gs, pr.t);
      const e = 1 - (1 - k) ** 3;
      for (const s of [1, -1] as const) {
        const near = pr.facing && s > 0;
        const a = node.angle + s * lerp(0.25, pr.spread, smooth(k));
        // a pair turned toward us is foreshortened, and the nearer leaf droops a little
        const length = pr.length * e * (pr.facing ? (near ? 0.62 : 0.5) : 1);
        const angle = pr.facing ? a + (near ? 0.35 : -0.2) * s : a;
        const lit = (Math.sin(angle) > 0 ? 1 : -1) as 1 | -1;
        pose.leaves.push({ id: `leaf-${i}-${j}${s > 0 ? 'a' : 'b'}`, band: b.band, at: { x: node.x, y: node.y }, angle, length, width: pr.width * e, curve: s * 0.08, pigment: pr.tone, under: OLIVE, alpha: smooth(k * 4), shade: lit, seed: pr.seed + (s > 0 ? 0 : 7) });
      }
    });
    const tip = gs.pts[gs.pts.length - 1]!;
    const tipAngle = pointAt(gs.pts, 1).angle;
    if (b.spray) {
      const s = b.spray;
      const k = ramp(g, s.window[0], s.window[1]) * smooth(clamp01((gs.ext - 0.9) / 0.1));
      if (k > 0.012) {
        const dir = lerpAngle(tipAngle, UP, 0.6) + s.lean;
        const axis = makeAxis(tip, dir, s.length * k, -s.lean * 0.6);
        pose.stalks.push({ id: `axis-${i}`, pts: axis, width: 0.62 * lerp(0.5, 1, k), pigment: STALK, seed: b.seed + 11, taper: 0.5 });
        s.arms.forEach((arm, j) => {
          const ka = smooth(clamp01((k - arm.t * 0.6) / 0.4));
          if (ka < 0.012) return;
          const q = pointAt(axis, arm.t);
          const a = lerpAngle(q.angle + arm.side * arm.turn, UP, 0.15);
          const len = arm.length * ka;
          const end = { x: q.x + Math.cos(a) * len, y: q.y + Math.sin(a) * len - len * 0.12 };
          pose.stalks.push({ id: `arm-${i}-${j}`, pts: [{ x: q.x, y: q.y }, { x: lerp(q.x, end.x, 0.5), y: lerp(q.y, end.y, 0.5) - len * 0.08 }, end], width: 0.42 * lerp(0.5, 1, ka), pigment: STALK, seed: b.seed + 13 + j, taper: 0.5 });
          arm.florets.forEach((id, m) => {
            const u = arm.florets.length > 1 ? lerp(0.45, 1, m / (arm.florets.length - 1)) : 1;
            floretAt(pose, plant.florets[id]!, { x: lerp(q.x, end.x, u), y: lerp(q.y, end.y, u) }, ka, g);
          });
        });
        const top = axis[axis.length - 1]!;
        s.top.forEach((id) => floretAt(pose, plant.florets[id]!, top, smooth(clamp01((k - 0.5) / 0.5)), g));
      }
    }
    b.capsules.forEach((c, j) => {
      const k = ramp(g, 0.84, 0.99) * smooth(clamp01((gs.ext - 0.9) / 0.1));
      if (k < 0.012) return;
      pose.capsules.push({ id: `cap-${i}-${j}`, at: { x: tip.x + c.dx * k, y: tip.y + c.dy * k }, radius: c.radius * k, pigment: c.pigment, alpha: smooth(k * 3), seed: c.seed });
    });
  });
  return pose;
}

function makeAxis(from: Pt, dir: number, len: number, bend: number): Pt[] {
  const pts: Pt[] = [from];
  let a = dir;
  let q = from;
  for (let i = 0; i < 4; i++) {
    q = { x: q.x + Math.cos(a) * (len / 4), y: q.y + Math.sin(a) * (len / 4) };
    pts.push(q);
    a += bend / 4;
  }
  return pts;
}

function floretAt(pose: HennaPose, f: FloretPlan, at: Pt, k: number, g: number): void {
  if (k < 0.012) return;
  const open = f.bud ? 0 : ramp(g, f.open[0], f.open[1]);
  pose.florets.push({ id: `floret-${f.id}`, at: { x: at.x + f.dx * k, y: at.y + f.dy * k }, radius: f.radius * k, rot: f.rot + open * 0.4, open, squash: f.squash, petal: f.petal, bud: BUD, alpha: smooth(k * 3), seed: f.seed });
}

/** Every point a full-grown plant paints (for the box test). */
export function hennaReach(plant: Henna): Pt[] {
  const pose = poseHenna(plant, 1);
  return [
    ...pose.twigs.flatMap((t) => t.pts),
    ...pose.stalks.flatMap((t) => t.pts),
    ...pose.leaves.flatMap((l) => leafBlade(l).outline),
    ...pose.florets.flatMap((f) => {
      const s = floretShape(f);
      return [...s.bud, ...s.petals.flat()];
    }),
    ...pose.capsules.flatMap(capsuleShape),
  ];
}

const henna: SpeciesDef = {
  id: 'henna',
  name: 'Henna',
  nativeName: 'Lḥenna',
  nativeLang: 'ary-Latn',
  // grown in irrigated plots of the hottest southern oases; its wild origin is uncertain
  range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] },
  tier: 2,
  habitats: ['meadow', 'back'],
  sizeClass: 'medium',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Henna — green leaves that keep a red secret.',
  bloomColor: CREAM,
  pollinators: true,
  draw(p, rng, opts) {
    const plant = buildHenna(rng);
    const g = opts.growth;
    inPlantSpace(p, opts, henna, () => {
      const r = createRng(plant.seeds.ground);
      groundShadow(p, r, { rx: 32, ry: 5, x: plant.foot, k: ramp(g, 0.06, 0.6), opacity: 0.2 });
      seedMound(p, r, g, { rx: 10, x: plant.foot });
      const pose = poseHenna(plant, g);
      paintMasses(p, pose.masses);
      for (const band of [0, 1]) {
        paintTwigs(p, pose.twigs.filter((t) => t.band === band), { opacity: band ? 0.82 : 0.66, darken: 0.18 });
        paintLeaves(p, pose.leaves.filter((l) => l.band === band), { opacity: band ? 0.92 : 0.82 });
      }
      paintTwigs(p, pose.stalks, { opacity: 0.85, granulation: 0.05 });
      paintSprays(p, pose.florets, pose.capsules, { eye: EYE, rim: BUD });
    });
  },
};

export default henna;
