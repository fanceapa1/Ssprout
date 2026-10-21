import type { Rng } from '../../core/rng';
import type { Pt } from '../../paint/geometry';
import { PIGMENTS, darken, lighten, mix } from '../../paint/pigments';
import { inkLine, stroke } from '../../paint/primitives';
import type { FoliagePigments } from '../../paint/recipes';
import {
  inUnits,
  paintBlossoms,
  paintGroundShadow,
  paintLeaves,
  paintPadMass,
  paintSeed,
  paintSkeleton,
  paintTipLeaves,
  stableTarget,
  type Blossom,
  type Leaf,
  type Pad,
} from '../lib/tree-paint';
import { addBranch, growChildren, growLimb, normalise, pointAt, ramp, stagger, treeView, type Tree } from '../lib/tree-structure';
import type { SpeciesDef } from '../types';

const SIZE = { w: 380, h: 460 };
const BASE_Y = SIZE.h * 0.94;

export interface Trellis {
  posts: { x: number; top: number; w: number }[];
  /** main beam (left → right) and a lighter rail below it */
  beam: Pt[];
  rail: Pt[];
  /** bamboo node marks along the beam */
  nodes: number[];
}

export interface Raceme {
  x: number;
  y: number;
  /** full length */
  len: number;
  /** slight sideways sway of the hanging axis */
  sway: number;
  delay: number;
  id: number;
}

export interface WisteriaPlan {
  tree: Tree;
  trellis: Trellis;
  racemes: Raceme[];
  florets: (Blossom & { raceme: number; u: number })[];
  pads: Pad[];
  leaves: Leaf[];
}

/** The whole vine, its trellis and every raceme for a seed — independent of growth. */
export function planWisteria(rng: Rng): WisteriaPlan {
  const r = rng.fork('structure');
  const base = { x: SIZE.w / 2, y: BASE_Y };
  const beamY = BASE_Y - r.range(235, 275);
  const half = r.range(118, 140);
  const offset = r.range(-12, 12);
  const left = base.x - half + offset;
  const right = base.x + half + offset;
  const trellis: Trellis = {
    posts: [
      { x: left, top: beamY - 6, w: r.range(5, 6.5) },
      { x: right, top: beamY - 6, w: r.range(5, 6.5) },
    ],
    beam: [
      { x: left - r.range(16, 26), y: beamY + r.range(-1.5, 1.5) },
      { x: base.x, y: beamY + r.range(-1, 2) },
      { x: right + r.range(16, 26), y: beamY + r.range(-1.5, 1.5) },
    ],
    rail: [
      { x: left - 4, y: beamY + 20 + r.range(-2, 2) },
      { x: right + 4, y: beamY + 20 + r.range(-2, 2) },
    ],
    nodes: Array.from({ length: r.int(3, 5) }, () => r.range(0.08, 0.92)),
  };

  // two stems twining around each other up to the beam
  const tree: Tree = { base, branches: [] };
  const height = BASE_Y - beamY - 6;
  const amp = r.range(3.5, 6.5);
  const turns = r.range(1.0, 1.7);
  const wob = [r.range(0, 6.3), r.range(0, 6.3)];
  const drift = r.range(-24, 24);
  const ph = r.range(0, Math.PI * 2);
  const stems = [0, Math.PI].map((shift, k) => {
    const pts: Pt[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({
        x:
          base.x +
          (k ? 2 : -2) * (1 - t) +
          drift * t * t +
          Math.sin(t * 3.1 + wob[0]!) * 6 +
          Math.sin(t * turns * Math.PI * 2 + ph + shift + Math.sin(t * 5 + wob[1]!) * 0.6) * amp * (k ? 1.4 : 0.6) * (0.55 + 0.45 * Math.sin(t * 4 + wob[1]!) ** 2),
        y: BASE_Y - t * height,
      });
    }
    return addBranch(tree, -1, 0, { pts, w0: k ? r.range(3.5, 4.5) : r.range(8, 10), w1: k ? 1.8 : 4, t0: k ? 0.06 : 0, t1: 0.75, tag: 'trunk' }, r);
  });
  // runners trained along the beam, left and right
  for (const [si, dir] of [[0, -1], [1, 1]] as const) {
    const s = stems[si]!;
    const start = pointAt(s, 1);
    const len = Math.abs((dir < 0 ? trellis.beam[0]!.x : trellis.beam[2]!.x) - start.x) * r.range(0.85, 1.0);
    const pts = growLimb(r, start, dir < 0 ? Math.PI + r.range(-0.15, 0.05) : r.range(-0.05, 0.15), len, { segments: 9, wander: 0.08 });
    // keep the runner hugging the beam: pull each point toward beam height
    for (const q of pts) q.y = q.y * 0.35 + (beamY + 1.5) * 0.65;
    const runner = addBranch(tree, s.id, 1, { pts, w0: s.w1 * 1.1, w1: 1, attach: 1, t0: s.t1 - 0.02, t1: s.t1 + 0.55, tag: 'runner' }, r);
    // short hanging spurs and tendrils off the runner
    growChildren(tree, runner, [{ count: [4, 7], span: [0.05, 1], angle: [0.5, 1.2], length: [0.1, 0.22], shrink: 0, side: 'random', limb: { segments: 4, wander: 0.15, gravity: 0.25 }, width: 0.6, tipWidth: 0.4, minTip: 0.35, tag: 'spur', dur: 0.4 }], r);
  }
  normalise(tree);

  // racemes hang from the spurs and straight from the runners
  const rr = rng.fork('racemes');
  const racemes: Raceme[] = [];
  const hangFrom: Pt[] = [];
  for (const b of tree.branches) {
    if (b.tag === 'spur') hangFrom.push(pointAt(b, 1));
    if (b.tag === 'runner') for (let k = 0; k < 7; k++) hangFrom.push(pointAt(b, rr.range(0.05, 0.98)));
  }
  for (const at of hangFrom) {
    if (racemes.some((q) => Math.abs(q.x - at.x) < 9)) continue;
    racemes.push({ x: at.x, y: at.y + 2, len: rr.range(60, 125), sway: rr.range(-0.12, 0.12), delay: rr.range(0, 1), id: racemes.length });
  }
  const florets: WisteriaPlan['florets'] = [];
  for (const rc of racemes) {
    const fr = rr.fork(`rc-${rc.id}`);
    const n = Math.round(rc.len / 1.05);
    for (let i = 0; i < n; i++) {
      const u = (i + fr.range(0, 1)) / n;
      const width = 6.5 * (1 - u) ** 0.8 + 1.2;
      const ax = rc.x + Math.sin(u * 2.2) * rc.sway * rc.len;
      const tip = u > 0.86;
      florets.push({
        x: ax + fr.gaussian(0, 0.55) * width,
        y: rc.y + u * rc.len + fr.range(-1.5, 1.5),
        r: tip ? fr.range(2.6, 3.4) : fr.range(4.6, 6.2) * (1 - u * 0.4),
        rot: fr.range(-0.6, 0.6) + Math.PI / 2,
        tone: Math.min(1, Math.max(0, 1 - u * 1.05 + fr.range(-0.15, 0.15))),
        delay: 0,
        kind: tip ? 'bud' : 'dot',
        id: florets.length,
        raceme: rc.id,
        u,
      });
    }
  }

  // light foliage along the top of the beam and pinnate leaflets hanging between the racemes
  const pr = rng.fork('pads');
  const pads: Pad[] = [];
  const nPads = pr.int(5, 7);
  for (let i = 0; i < nPads; i++) {
    const t = (i + pr.range(0.2, 0.8)) / nPads;
    const x = trellis.beam[0]!.x + (trellis.beam[2]!.x - trellis.beam[0]!.x) * t;
    pads.push({ x, y: beamY - pr.range(4, 10), r: pr.range(16, 24), delay: pr.range(0, 1), id: i, depth: pr.range(-1, 1) });
  }
  const lr = rng.fork('leaves');
  const leaves: Leaf[] = [];
  for (const b of tree.branches) {
    if (b.tag !== 'runner' && b.tag !== 'spur') continue;
    const n = Math.floor(b.len / 9);
    for (let i = 0; i < n; i++) {
      const at = pointAt(b, (i + lr.range(0, 1)) / n);
      // a drooping pinnate leaf: a few paired leaflets down a short stalk
      const ang = Math.PI / 2 + lr.range(-0.7, 0.7);
      const pairs = lr.int(2, 4);
      const tone = lr.range(0, 1);
      const delay = lr.range(0, 1);
      for (let k = 0; k < pairs; k++) {
        const d = 3 + k * 4.2;
        const cx = at.x + Math.cos(ang) * d;
        const cy = at.y + Math.sin(ang) * d;
        for (const side of [-1, 1]) leaves.push({ x: cx, y: cy, angle: ang + side * 0.9, length: lr.range(4.5, 6.5), width: 0.42, tone, delay, id: leaves.length, curve: side * 0.1 });
      }
      leaves.push({ x: at.x + Math.cos(ang) * (3 + pairs * 4.2), y: at.y + Math.sin(ang) * (3 + pairs * 4.2), angle: ang, length: 5.5, width: 0.42, tone, delay, id: leaves.length });
    }
  }
  return { tree, trellis, racemes, florets, pads, leaves };
}

const BARK = mix(PIGMENTS.sumi, PIGMENTS.stoneWarm, 0.3);
const VIOLET = { pale: mix(PIGMENTS.irisLight, PIGMENTS.petalWhite, 0.55), deep: mix(PIGMENTS.iris, PIGMENTS.irisLight, 0.2), centre: PIGMENTS.gold };
const TIP_BUDS = { pale: mix(PIGMENTS.sageLight, PIGMENTS.irisLight, 0.25), deep: mix(PIGMENTS.sap, PIGMENTS.irisLight, 0.3) };
const FRESH: FoliagePigments = { light: lighten(PIGMENTS.sageLight, 0.06), mid: PIGMENTS.sap, shadow: PIGMENTS.sage, dark: PIGMENTS.olive };
const BAMBOO = mix(PIGMENTS.woodLight, PIGMENTS.gold, 0.15);

function paintTrellis(p: import('../../paint').Painter, t: Trellis, rng: Rng): void {
  const tg = stableTarget(p, rng.fork('trellis-dry'));
  t.posts.forEach((post, i) => {
    const pr = rng.fork(`post-${i}`);
    const pts = [{ x: post.x + pr.range(-1, 1), y: BASE_Y + 2 }, { x: post.x + pr.range(-1.5, 1.5), y: (BASE_Y + post.top) / 2 }, { x: post.x, y: post.top }];
    stroke(tg, pts, { rng: pr, pigment: PIGMENTS.wood, width: post.w, taper: [0, 0], wobble: 0.1, wetness: 0.35, opacity: 0.75 });
    inkLine(tg, pts.map((q) => ({ x: q.x + post.w * 0.45, y: q.y })), { rng: pr, width: 1.1, opacity: 0.55, breaks: 0.35, pigment: darken(PIGMENTS.wood, 0.3) });
  });
  const br = rng.fork('beam');
  stroke(tg, t.beam, { rng: br, pigment: BAMBOO, width: 5.5, taper: [0.02, 0.02], wobble: 0.1, wetness: 0.35, opacity: 0.8 });
  inkLine(tg, t.beam.map((q) => ({ x: q.x, y: q.y + 2.6 })), { rng: br, width: 0.9, opacity: 0.5, breaks: 0.3, pigment: darken(PIGMENTS.wood, 0.25) });
  stroke(tg, t.rail, { rng: br.fork('rail'), pigment: BAMBOO, width: 3, taper: [0.03, 0.03], wobble: 0.1, wetness: 0.35, opacity: 0.6 });
  const x0 = t.beam[0]!.x;
  const x1 = t.beam[2]!.x;
  for (const u of t.nodes) {
    const x = x0 + (x1 - x0) * u;
    const y = t.beam[1]!.y;
    inkLine(tg, [{ x, y: y - 2.8 }, { x: x + 0.4, y: y + 2.8 }], { rng: br.fork(`n${u}`), width: 1, opacity: 0.6, breaks: 0, taper: [0.2, 0.2] });
  }
  // lashings where beam meets posts
  for (const post of t.posts) {
    const y = t.beam[1]!.y;
    inkLine(tg, [{ x: post.x - 4, y: y - 2 }, { x: post.x + 4, y: y + 3 }], { rng: br.fork(`l${post.x}`), width: 0.9, opacity: 0.55, breaks: 0 });
    inkLine(tg, [{ x: post.x - 4, y: y + 3 }, { x: post.x + 4, y: y - 2 }], { rng: br.fork(`m${post.x}`), width: 0.9, opacity: 0.55, breaks: 0 });
  }
}

const wisteria: SpeciesDef = {
  id: 'wisteria',
  name: 'Wisteria',
  nativeName: 'Fuji',
  tier: 4,
  habitats: ['back', 'meadow', 'shore'],
  sizeClass: 'tree',
  size: SIZE,
  anchor: { x: 0.5, y: 0.94 },
  description: 'Violet rain hanging from the bamboo, humming with bees.',
  bloomColor: PIGMENTS.iris,
  pollinators: true,
  draw(p, rng, opts) {
    const g = Math.max(0, Math.min(1, opts.growth));
    const plan = planWisteria(rng);
    const view = { ...treeView(g, plan.tree.base, { structureEnd: 0.55, minScale: 1 }) };
    const pr = rng.fork('paint');
    inUnits(p, SIZE, opts, () => {
      paintGroundShadow(p, plan.tree.base, 120, { ...view, scale: 0.4 + 0.6 * ramp(g, 0, 0.6) }, pr);
      paintTrellis(p, plan.trellis, pr);
      paintSeed(p, plan.tree.base, g, pr);
      // vine thickens with age; no overall scaling (the trellis is full size from the start)
      const vis = paintSkeleton(p, plan.tree, { ...view, thick: 0.35 + 0.65 * ramp(g, 0.02, 0.7) }, pr, { pigment: BARK, texture: 0.7, modelling: 0.55, flare: 0.25, wobble: 0.2 });
      paintTipLeaves(p, vis, view, 1 - ramp(g, 0.5, 0.7), pr, { pigment: lighten(PIGMENTS.sap, 0.05), size: 6 });
      paintPadMass(p, plan.pads, view, pr, (pad) => stagger(g, 0.5, 0.76, pad.delay, 0.14), () => FRESH, { flatness: 0.4, opacity: 0.6, gaps: 0.6, dabSize: 0.26, shadow: 0.45 });
      paintLeaves(p, plan.leaves, view, pr.fork('leaves'), (l) => stagger(g, 0.52, 0.78, l.delay, 0.12), lighten(PIGMENTS.sageLight, 0.04), PIGMENTS.sap, { opacity: 0.75 });
      // racemes lengthen and open from the top down (0.72–1)
      const rOpen = plan.racemes.map((rc) => stagger(g, 0.7, 1, rc.delay, 0.2));
      const floretOpen = (b: Blossom) => {
        const f = b as WisteriaPlan['florets'][number];
        return ramp(rOpen[f.raceme]!, f.u * 0.75, f.u * 0.75 + 0.25);
      };
      const tips = plan.florets.filter((f) => f.kind === 'bud');
      const body = plan.florets.filter((f) => f.kind !== 'bud');
      paintBlossoms(p, body, view, pr.fork('florets'), floretOpen, VIOLET, { groups: 2, opacity: 0.9, centres: 0, dry: { edge: 0.55 } });
      paintBlossoms(p, tips, view, pr.fork('tips'), floretOpen, TIP_BUDS, { opacity: 0.85, centres: 0 });
    });
  },
};

export default wisteria;
