import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { plumFlowers, ribbon, threadWidth, type PlumFlower } from '../lib/baikamo-paint';
import { clamp01, ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { plantFrame } from '../lib/small-paint';
import { UP, petalRing, type PetalPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Baikamo (Ranunculus nipponicus var. submersus): long tresses of thread-fine, forked leaves
 * combed downstream under clear cold water, and small white plum-blossom flowers with gold
 * hearts riding just above the surface. No pads: it reads as green hair in the current.
 */

const LEAF = '#6f9a6a';
const DEEP = mix(LEAF, mix(PIGMENTS.olive, PIGMENTS.celadonDeep, 0.5), 0.55);
const TIP = mix(LEAF, PIGMENTS.sageLight, 0.3);
const GLAZE = PIGMENTS.celadon;
const STALK = mix(PIGMENTS.sageLight, LEAF, 0.35);

/** Vertical squash of the water plane, seen from the bank. */
const FLAT = 0.42;
const BOX = { w: 140, h: 56, ax: 0.4, ay: 0.55 };
/** Sampling step along a tress, in plane units. */
const STEP = 1.6;

interface Thread {
  /** angle off the stem where it leaves the node (signed) */
  off: number;
  len: number;
  /** a fork: where it splits (0..1) and the branch's angle and length */
  fork: { at: number; off: number; len: number } | null;
  width: number;
}

interface Node {
  s: number;
  threads: Thread[];
  tone: Pigment;
}

interface Tress {
  root: { x: number; z: number };
  angle: number;
  length: number;
  amp: number;
  freq: number;
  phase: number;
  /** 0 = lying deep on the bed … 1 = just under the surface */
  depth: number;
  window: [number, number];
  nodes: Node[];
}

interface Blossom {
  tress: number;
  s: number;
  stalk: number;
  lean: number;
  size: number;
  tilt: number;
  petals: PetalPlan[];
  bud: [number, number];
  open: [number, number];
}

export interface BaikamoPlan {
  tresses: Tress[];
  blossoms: Blossom[];
  glints: { y: number; x0: number; x1: number; h: number }[];
}

export function planBaikamo(rng: Rng): BaikamoPlan {
  const n = rng.int(6, 8);
  const drift = rng.range(0.08, 0.22);
  const tresses: Tress[] = [];
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  // two or three rooted crowns upstream; the tresses fan out from them
  const crowns = Array.from({ length: rng.int(2, 3) }, (_, c, a = rng.range(-30, -14)) => ({ x: a + c * rng.range(4, 9), z: rng.range(-20, 20) }));
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    const length = rng.range(46, 84) * (1 - Math.abs(u) * 0.35);
    const nodes: Node[] = [];
    const tone = jitter(LEAF, rng, 0.03);
    for (let s = rng.range(1.5, 3); s < length - 1; s += rng.range(2.2, 3.2)) {
      const q = s / length;
      const nt = rng.int(4, 7);
      const threads: Thread[] = [];
      for (let t = 0; t < nt; t++) {
        const side = t % 2 ? 1 : -1;
        threads.push({
          off: side * rng.range(0.18, 0.8),
          // the leaves are longest mid-tress, a tight young tuft at the tip
          len: rng.range(8, 17) * lerp(0.75, 1, Math.sin(Math.min(1, q * 1.4) * Math.PI * 0.5)) * lerp(1, 0.45, smooth((q - 0.75) / 0.25)),
          fork: rng.chance(0.6) ? { at: rng.range(0.3, 0.6), off: -side * rng.range(0.12, 0.3), len: rng.range(0.4, 0.7) } : null,
          width: rng.range(0.22, 0.36),
        });
      }
      nodes.push({ s, threads, tone: jitter(mix(mix(DEEP, tone, smooth(q * 2.5)), TIP, smooth((q - 0.6) / 0.4) * 0.7), rng, 0.025) });
    }
    tresses.push({
      root: { x: crowns[i % crowns.length]!.x + rng.gaussian(0, 1.5), z: crowns[i % crowns.length]!.z + rng.gaussian(0, 1.5) },
      angle: drift + u * rng.range(0.55, 0.8) + rng.gaussian(0, 0.06),
      length,
      amp: rng.range(1.4, 3.6),
      freq: (Math.PI * 2) / rng.range(22, 38),
      phase: rng.range(0, Math.PI * 2),
      depth: rng.range(0, 1),
      window: [0, 0],
      nodes,
    });
  }
  order.forEach((ti, k) => {
    tresses[ti]!.window = [...stagger(k, n, [0.02, 0.74], 0.62)] as [number, number];
  });
  // the flowers stand on the tresses nearest the surface, mostly downstream
  const lifted = tresses.map((t, i) => ({ t, i })).sort((a, b) => b.t.depth - a.t.depth);
  const nb = rng.int(8, 12);
  const blossoms: Blossom[] = [];
  for (let b = 0; b < nb; b++) {
    const { t, i } = lifted[b % Math.min(lifted.length, 6)]!;
    const s = t.length * rng.range(0.35, 0.9);
    blossoms.push({
      tress: i,
      s,
      stalk: rng.range(1.6, 3.4),
      lean: rng.gaussian(0, 0.25),
      size: rng.range(2.3, 2.9),
      tilt: rng.range(0.42, 0.6),
      petals: petalRing(rng, 5, { angJit: 0.08, lenJit: 0.07, widJit: 0.06, curve: 0.05 }),
      bud: [0, 0],
      open: [0, 0],
    });
  }
  rng.shuffle(blossoms.map((_, i) => i)).forEach((bi, k) => {
    blossoms[bi]!.bud = [...stagger(k, nb, [0.6, 0.86], 0.5)] as [number, number];
    blossoms[bi]!.open = [...stagger(k, nb, [0.78, 1], 0.55)] as [number, number];
  });
  const glints = Array.from({ length: rng.int(5, 8) }, () => {
    const x0 = rng.range(-40, 45);
    return { y: rng.range(-9, 9), x0, x1: x0 + rng.range(22, 55), h: rng.range(0.3, 0.7) };
  });
  return { tresses, blossoms, glints };
}

/** A point on the water plane (x downstream, z toward the bank) to the sprite, sunk by depth. */
const project = (x: number, z: number, sink: number): Pt => ({ x, y: z * FLAT + sink });

const sinkOf = (t: Tress) => (1 - t.depth) * 2.4;

/** The stem's plane position and direction at arc length s. */
function stemAt(t: Tress, s: number): { x: number; z: number; a: number } {
  const env = Math.min(1, s / 18);
  const lat = t.amp * env * Math.sin(t.freq * s + t.phase);
  const dl = t.amp * (env * t.freq * Math.cos(t.freq * s + t.phase) + (s < 18 ? Math.sin(t.freq * s + t.phase) / 18 : 0));
  const c = Math.cos(t.angle);
  const sn = Math.sin(t.angle);
  return { x: t.root.x + c * s - sn * lat, z: t.root.z + sn * s + c * lat, a: t.angle + Math.atan(dl) };
}

function stemPath(t: Tress, len: number): Pt[] {
  const pts: Pt[] = [];
  const sink = sinkOf(t);
  const n = Math.max(1, Math.ceil(len / STEP));
  for (let i = 0; i <= n; i++) {
    const q = stemAt(t, (len * i) / n);
    pts.push(project(q.x, q.z, sink));
  }
  return pts;
}

/** A thread from a node: leaves at an angle, then is combed back along the current. */
function threadPath(t: Tress, base: { x: number; z: number; a: number }, off: number, len: number, sink: number): Pt[] {
  const pts: Pt[] = [project(base.x, base.z, sink)];
  let x = base.x;
  let z = base.z;
  const n = Math.max(2, Math.ceil(len / 1.2));
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const a = base.a + off * (1 - smooth(u * 2.6)) + Math.sin(u * 5 + base.x * 0.3) * 0.05;
    x += (Math.cos(a) * len) / n;
    z += (Math.sin(a) * len) / n;
    pts.push(project(x, z, sink));
  }
  return pts;
}

/** The tress's leaves as ribbons, grown by how far its tip has passed each node. */
function tressMarks(t: Tress, g: number): { stem: Pt[] | null; halo: Pt[][]; threads: { poly: Pt[]; tone: Pigment }[]; len: number } {
  const k = ease(g, t.window[0], t.window[1]);
  const len = t.length * easeOut(k);
  const out = { stem: null as Pt[] | null, halo: [] as Pt[][], threads: [] as { poly: Pt[]; tone: Pigment }[], len };
  if (len < 0.4) return out;
  const sink = sinkOf(t);
  const path = stemPath(t, len);
  const grow = smooth(k * 2.5);
  out.stem = ribbon(path, (q) => 0.3 * grow * (1 - q * 0.6));
  const hw = (q: number) => lerp(0.6, 4.6, smooth(q * 3)) * smooth(q * 12) * (1 - smooth((q - 0.72) / 0.28) * 0.85) * grow;
  for (const f of [0.45, 0.75, 1]) {
    const h = ribbon(path, (q) => hw(q) * f);
    if (h) out.halo.push(h);
  }
  for (const node of t.nodes) {
    if (node.s > len) break;
    const base = stemAt(t, node.s);
    for (const th of node.threads) {
      const nk = clamp01((len - node.s) / (th.len * 1.6));
      if (!visible(nk)) continue;
      const tl = th.len * easeOut(nk);
      const pts = threadPath(t, base, th.off * lerp(0.4, 1, nk), tl, sink);
      const poly = ribbon(pts, threadWidth(th.width * lerp(0.5, 1, nk)));
      if (poly) out.threads.push({ poly, tone: node.tone });
      if (th.fork && nk > th.fork.at) {
        const fi = Math.floor(th.fork.at * (pts.length - 1));
        const fp = pts[fi]!;
        const fb = { x: fp.x, z: (fp.y - sink) / FLAT, a: base.a + th.off * 0.5 };
        const fl = tl * th.fork.len * smooth((nk - th.fork.at) / (1 - th.fork.at));
        const fpoly = ribbon(threadPath(t, fb, th.fork.off, fl, sink), threadWidth(th.width * 0.8));
        if (fpoly && fl > 0.4) out.threads.push({ poly: fpoly, tone: node.tone });
      }
    }
  }
  return out;
}

function drawTresses(p: Painter, plan: BaikamoPlan, g: number) {
  const marks = plan.tresses.map((t) => ({ t, m: tressMarks(t, g) })).filter((x) => x.m.stem);
  if (!marks.length) return;
  // the whole sprite box: a tress fanning toward the bank must not be cut by its layer
  const area = { x: -BOX.w * BOX.ax, y: -BOX.h * BOX.ay, w: BOX.w, h: BOX.h };
  // the weed's shadow on the gravel bed, a little below it
  const B = p.layer(area);
  for (const { m } of marks) for (const h of m.halo) B.fill(h.map((q) => ({ x: q.x + 0.6, y: q.y + 1.2 })), PIGMENTS.shadow, 0.1);
  B.dry({ opacity: 0.24, edge: 0.05, edgeWidth: 1, sharpness: 0.1, centreLift: 0, granulation: 0.25, flow: 0.5, flowScale: 10 });
  // deep tresses first, softer and cooler; those near the surface over them
  for (const deep of [true, false]) {
    const L = p.layer(area);
    for (const { t, m } of marks) {
      if (t.depth < 0.5 !== deep) continue;
      // the cold water's celadon glaze is mixed into the weed, never washed round it
      const cool = deep ? 0.55 : 0.36;
      for (const h of m.halo) L.fill(h, mix(DEEP, GLAZE, cool), 0.06);
      for (const th of m.threads) {
        // a faint doubled copy blurs each hair, as water does
        L.fill(th.poly.map((q) => ({ x: q.x + 0.3, y: q.y + 0.45 })), mix(mix(th.tone, GLAZE, cool + 0.15), PIGMENTS.stone, 0.14), 0.14);
        L.fill(th.poly, mix(mix(th.tone, GLAZE, cool), PIGMENTS.stone, 0.14), 0.36);
      }
      if (m.stem) L.fill(m.stem, mix(DEEP, GLAZE, cool * 0.5), 0.6);
    }
    // light on the surface lifts out of the weed below it
    for (const gl of plan.glints) L.lift(lens(gl), 0.62);
    L.dry({ opacity: deep ? 0.6 : 0.74, edge: 0.14, edgeWidth: 0.35, sharpness: deep ? 0.12 : 0.22, centreLift: 0.06, granulation: 0.18, flow: 0.45, flowScale: 8, darken: 0.25 });
  }
}

/** A thin horizontal lens of light on the water. */
function lens(gl: BaikamoPlan['glints'][number]): Pt[] {
  const pts: Pt[] = [];
  const N = 10;
  for (let i = 0; i <= N; i++) pts.push({ x: lerp(gl.x0, gl.x1, i / N), y: gl.y - Math.sin((i / N) * Math.PI) * gl.h });
  for (let i = N; i >= 0; i--) pts.push({ x: lerp(gl.x0, gl.x1, i / N), y: gl.y + Math.sin((i / N) * Math.PI) * gl.h * 0.6 });
  return pts;
}

function drawBlossoms(p: Painter, rng: Rng, plan: BaikamoPlan, g: number, res: number) {
  const open: PlumFlower[] = [];
  plan.blossoms.forEach((b, i) => {
    const budK = ease(g, b.bud[0], b.bud[1]);
    if (!visible(budK)) return;
    const t = plan.tresses[b.tress]!;
    const q = stemAt(t, b.s);
    // the stalk leaves the water where its node lies under the surface
    const water = project(q.x, q.z, 0);
    const h = b.stalk * easeOut(budK);
    const top = { x: water.x + b.lean * h, y: water.y - h };
    p.ripple({ x: water.x, y: water.y + 0.3 }, { rng: rng.fork(`ring-${i}`), width: 6.5 * easeOut(budK), count: 1, squash: 0.3, opacity: 0.3 * budK, light: 0.4, lineWidth: 0.35 });
    p.stroke([water, { x: (water.x + top.x) / 2 + b.lean * 0.4, y: (water.y + top.y) / 2 }, top], { rng: rng.fork(`stalk-${i}`), pigment: STALK, width: 0.28 * budK, taper: [0.1, 0.3], wobble: 0.1, wetness: 0.3, opacity: 0.6, edge: 0.3 });
    const ok = ease(g, b.open[0], b.open[1]);
    const fade = 1 - smooth(ok / 0.5);
    if (visible(fade)) {
      const bud = mix(PIGMENTS.sageLight, PIGMENTS.petalWhite, 0.35 + smooth(budK) * 0.45);
      p.dab({ x: top.x, y: top.y + 0.2 }, bud, { rng: rng.fork(`bud-${i}`), variant: 'round', angle: UP + b.lean, length: lerp(0.3, 1.5, budK), width: lerp(0.3, 1.25, budK), opacity: 0.92 * fade, edge: 0.4, blend: 'source-over' });
    }
    if (visible(ok)) open.push({ id: i, c: top, petals: b.petals, view: { tilt: b.tilt, roll: UP + b.lean * 0.3 }, size: b.size, open: ok });
  });
  plumFlowers(p, rng.fork('flowers'), open, { eye: mix(PIGMENTS.gold, '#f2d36b', 0.45), res });
}

const baikamo: SpeciesDef = {
  id: 'baikamo',
  name: 'Baikamo',
  nativeName: 'Baikamo',
  // cold, clear, spring-fed mountain streams
  range: { realms: ['japan'], biomes: ['montane-stream'], climates: ['cool-temperate'] },
  tier: 2,
  habitats: ['water'],
  sizeClass: 'medium',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Baikamo — plum blossom in the current, in the middle of summer.',
  bloomColor: '#f8f4ea',
  pollinators: true,
  // under the water: the low sun leaves no warm rim on the tresses
  rimLight: false,
  draw(p, rng, opts) {
    const plan = planBaikamo(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      // the first stir where it takes root, widening and settling
      p.ripple({ x: -10, y: 1 }, { rng: r.fork('ring'), width: lerp(10, 34, ease(g, 0, 0.4)), count: 2, squash: 0.22, opacity: 0.26 * (0.4 + 0.6 * ease(g, 0, 0.06)) * (1 - 0.5 * ease(g, 0.4, 0.8)), light: 0.3 });
      drawTresses(p, plan, g);
      drawBlossoms(p, r.fork('blossoms'), plan, g, opts.w / BOX.w);
    } finally {
      end();
    }
  },
};

export default baikamo;
