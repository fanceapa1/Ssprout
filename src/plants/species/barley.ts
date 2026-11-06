import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Pigment, type Painter, type Pt } from '../../paint';
import { awnLines, barleyEar, earAxis, grassBlade, type EarShape } from '../lib/barley-paint';
import { clamp01, ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { INK_GREEN, groundShadow, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { UP, bendProfile, makeStem, pathLen, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Barley (Hordeum vulgare): a small stand of upright culms with narrow blue-green blades, each
 * ending in a dense ear plaited from grains, every grain carrying a long straight awn, so the
 * ears are bearded. They come out of their sheaths green and ripen to straw gold; one stays green.
 */

const BLADE = mix('#a6b56a', '#86a39a', 0.38);
const BLADE_DEEP = mix(BLADE, '#55705e', 0.45);
const CREASE = mix(INK_GREEN, '#55705e', 0.3);
const EAR_GREEN = '#a6b56a';
const GOLD = '#e2bd62';
const SHADE = '#b98d3e';
const PALE = '#f3e6bb';
const AWN_GREEN = mix('#a6b56a', '#cdd19c', 0.5);
const STEM_GREEN = mix('#a6b56a', PIGMENTS.olive, 0.25);
const STRAW = '#dcc68a';
// the box round the base (anchor 0.5, 0.92): x ±60, y −147 … 13
const BOX = { x: 54, top: -140 };

export interface Blade {
  stem: StemPlan;
  width: number;
  window: [number, number];
  tone: Pigment;
  /** how far the blade dries to straw as the stand ripens */
  dry: number;
  front: boolean;
}

export interface StemLeaf {
  /** where it leaves the culm (0..1 of the culm's length) */
  t: number;
  side: 1 | -1;
  out: number;
  length: number;
  bends: number[];
  width: number;
  tone: Pigment;
}

export interface Culm {
  stem: StemPlan;
  window: [number, number];
  emerge: [number, number];
  awn: [number, number];
  ripen: [number, number];
  /** 1 ripens fully; the late tiller stays green */
  ripeMax: number;
  front: boolean;
  nod: number;
  ear: Pick<EarShape, 'length' | 'width' | 'grains' | 'awnLen' | 'spread' | 'awnJit'>;
  leaves: StemLeaf[];
  nodes: number[];
}

export interface BarleyPlan {
  blades: Blade[];
  culms: Culm[];
}

/** A culm as grown at `g`: its stalk points, its ear and how ripe it is. */
export function culmNow(c: Culm, g: number): { pts: Pt[]; ext: number; ear: EarShape; ripe: number } {
  const ext = easeOut(ease(g, c.window[0], c.window[1]));
  const ripe = c.ripeMax * ease(g, c.ripen[0], c.ripen[1]);
  const pts = stemPoints(c.stem, ext, lerp(0.35, 1, smooth(ripe)) * lerp(0.4, 1, ext));
  const tip = pointAt(pts, 1);
  const ear: EarShape = {
    ...c.ear,
    base: { x: tip.x, y: tip.y },
    angle: tip.angle,
    nod: c.nod * lerp(0.2, 1, ripe),
    k: ease(g, c.emerge[0], c.emerge[1]),
    awn: ease(g, c.awn[0], c.awn[1]),
  };
  return { pts, ext, ear, ripe };
}

/** Every point a full-grown culm reaches: stalk, ear and awn tips. */
export function culmReach(c: Culm): Pt[] {
  const { pts, ear } = culmNow(c, 1);
  return [...pts, ...earAxis(ear), ...awnLines(ear).map((a) => a.to)];
}

function fits(pts: readonly Pt[]): number {
  let s = 1;
  for (const q of pts) {
    if (Math.abs(q.x) > BOX.x) s = Math.min(s, BOX.x / Math.abs(q.x));
    if (q.y < BOX.top) s = Math.min(s, BOX.top / q.y);
  }
  return s;
}

export function planBarley(rng: Rng): BarleyPlan {
  const lean = rng.gaussian(0, 0.05);
  const n = rng.int(5, 9);
  const green = rng.int(0, n - 1);
  const xs = Array.from({ length: n }, (_, i) => (i + rng.range(0.2, 0.8)) / n - 0.5);
  const culms: Culm[] = [];
  const order = xs.map((_, i) => i).sort((a, b) => Math.abs(xs[a]!) - Math.abs(xs[b]!) + rng.gaussian(0, 0.15));
  for (let i = 0; i < n; i++) {
    const u = xs[i]!;
    const late = i === green;
    // most stand upright; one or two lean right out
    const leaner = rng.chance(0.22) ? Math.sign(u || 1) * rng.range(0.16, 0.3) : 0;
    const angle = UP + lean + u * rng.range(0.4, 0.62) + leaner + rng.gaussian(0, 0.04);
    const side = Math.sign(angle - UP) || 1;
    const stem = makeStem(rng, { base: { x: u * rng.range(10, 16), y: 0 }, length: rng.range(84, 100) * (1 - Math.abs(u) * 0.22) * (late ? 0.88 : 1), angle, bend: side * rng.range(0.08, 0.22), segments: 10, tipBias: 0.7, wobble: 0.01 });
    const grains = rng.int(12, 15);
    const k = order.indexOf(i);
    const c: Culm = {
      stem,
      window: [...stagger(k, n, [0.18, 0.62], 0.62)] as [number, number],
      emerge: [...stagger(k, n, [0.46, 0.74], 0.6)] as [number, number],
      awn: [...stagger(k, n, [0.54, 0.86], 0.62)] as [number, number],
      ripen: [...stagger(k, n, [0.68, 1], 0.7)] as [number, number],
      ripeMax: late ? rng.range(0.08, 0.2) : 1,
      front: rng.chance(0.45),
      nod: side * rng.range(0.12, 0.3),
      ear: {
        length: rng.range(16, 20) * (late ? 0.9 : 1),
        width: rng.range(4.4, 5.2),
        grains,
        awnLen: rng.range(26, 34),
        spread: rng.range(0.1, 0.2),
        awnJit: Array.from({ length: grains }, () => rng.gaussian(0, 0.04)),
      },
      leaves: [],
      nodes: [rng.range(0.22, 0.3), rng.range(0.45, 0.55)],
    };
    const nl = rng.int(1, 2);
    for (let j = 0; j < nl; j++) {
      const ls = (j % 2 === 0 ? side : -side) as 1 | -1;
      c.leaves.push({
        t: c.nodes[j]! + 0.01,
        side: ls,
        out: rng.range(0.35, 0.6),
        length: rng.range(20, 30),
        bends: bendProfile(rng, 6, ls * rng.range(0.8, 1.4), 0.5, 0.02),
        width: rng.range(2, 2.5),
        tone: jitter(mix(BLADE, BLADE_DEEP, rng.range(0, 0.25)), rng, 0.025),
      });
    }
    for (let pass = 0; pass < 2; pass++) {
      const s = fits(culmReach(c));
      if (s < 1) c.stem.length *= s * 0.97;
    }
    culms.push(c);
  }
  const nb = rng.int(6, 9);
  const blades: Blade[] = [];
  for (let i = 0; i < nb; i++) {
    const u = i / (nb - 1) - 0.5;
    const side = Math.sign(u) || (rng.chance(0.5) ? 1 : -1);
    blades.push({
      stem: { base: { x: u * rng.range(8, 14), y: 0 }, length: rng.range(30, 54) * (1 - Math.abs(u) * 0.3), angle: UP + lean + u * rng.range(0.9, 1.3) + rng.gaussian(0, 0.08), bends: bendProfile(rng, 8, side * rng.range(0.7, 1.4), 0.55, 0.02) },
      width: rng.range(2.3, 3),
      window: [0, 0],
      tone: jitter(mix(BLADE, BLADE_DEEP, rng.range(0, 0.3)), rng, 0.03),
      dry: rng.chance(0.4) ? rng.range(0.5, 0.85) : rng.range(0.1, 0.3),
      front: rng.chance(0.5),
    });
  }
  rng.shuffle(blades.map((_, i) => i)).forEach((bi, k) => {
    blades[bi]!.window = [...stagger(k, nb, [0.03, 0.42], 0.5)] as [number, number];
  });
  return { blades, culms };
}

function drawBlade(p: Painter, rng: Rng, b: Blade, g: number) {
  const k = ease(g, b.window[0], b.window[1]);
  if (!visible(k)) return;
  const pts = stemPoints(b.stem, easeOut(k), lerp(0.2, 1, k));
  if (pathLen(pts) < 0.8) return;
  const dry = b.dry * ease(g, 0.72, 1);
  grassBlade(p, rng, pts, { width: b.width * lerp(0.6, 1, k), tone: mix(b.tone, STRAW, dry), crease: CREASE, opacity: 0.82 * smooth(k * 6) });
}

function drawCulm(p: Painter, rng: Rng, c: Culm, g: number) {
  const { pts, ext, ear, ripe } = culmNow(c, g);
  if (!visible(ext)) return;
  const len = pathLen(pts);
  const stalk = mix(STEM_GREEN, STRAW, smooth(ripe) * 0.85);
  paintStem(p, rng.fork('stalk'), pts, { width: 1.15, pigment: stalk, opacity: 0.85, ink: 0.18 * smooth(ext * 2), inkReach: 0.75, inkPigment: mix(CREASE, SHADE, ripe * 0.5) });
  // the leaves leave the culm at its nodes once it has grown past them
  c.leaves.forEach((l, j) => {
    const lk = smooth((ext - l.t - 0.05) / 0.3);
    if (!visible(lk)) return;
    const q = pointAt(pts, l.t / Math.max(ext, l.t + 0.05));
    const lp = stemPoints({ base: { x: q.x, y: q.y }, length: l.length, angle: q.angle + l.side * l.out, bends: l.bends }, easeOut(lk), lerp(0.3, 1, lk));
    grassBlade(p, rng.fork(`leaf-${j}`), lp, { width: l.width * lerp(0.5, 1, lk), tone: mix(l.tone, STRAW, ripe * 0.6), crease: CREASE, opacity: 0.8 * smooth(lk * 5) });
  });
  c.nodes.forEach((t, j) => {
    const nk = smooth((ext - t - 0.02) / 0.15);
    if (!visible(nk)) return;
    const q = pointAt(pts, t / Math.max(ext, t + 0.02));
    p.dab(q, mix(stalk, SHADE, 0.5), { rng: rng.fork(`node-${j}`), variant: 'round', angle: q.angle + Math.PI / 2, length: 2.2 * nk, width: 1.1 * nk, opacity: 0.5 * nk });
  });
  // the boot: the flag leaf's sheath swells round the ear, and the ear pushes out of it
  const bk = smooth((ext - 0.55) / 0.35);
  if (visible(bk) && len > 8) {
    const bootLen = 12 * bk;
    const q = pointAt(pts, clamp01(1 - (bootLen + lerp(0, 2, ear.k)) / len));
    const swell = lerp(3.4, 2.2, smooth(ear.k));
    p.dab(q, mix(mix(STEM_GREEN, BLADE, 0.5), STRAW, ripe * 0.8), { rng: rng.fork('boot'), variant: 'leaf', angle: q.angle, length: bootLen + lerp(2, 0, ear.k), width: swell * bk, curve: 0, pool: 0.4, basePool: 0.1, opacity: 0.75 * bk });
  }
  barleyEar(p, rng.fork('ear'), ear, ripe, { green: EAR_GREEN, gold: GOLD, shade: SHADE, pale: PALE, awnGreen: AWN_GREEN }, { opacity: 0.92, light: -1 });
}

const barley: SpeciesDef = {
  id: 'barley',
  name: 'Barley',
  nativeName: 'Shʿir',
  nativeLang: 'ary-Latn',
  // sown in autumn on the plots under the palms; a crop with no wild stand here
  range: { realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] },
  tier: 2,
  habitats: ['meadow'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.92 },
  description: "Barley — the spring's gold, cut by hand before the heat.",
  bloomColor: GOLD,
  pollinators: false,
  draw(p, rng, opts) {
    const plan = planBarley(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 26, ry: 4.5, k: ease(g, 0.08, 0.6), opacity: 0.16 });
      seedMound(p, r, g, { rx: 11 });
      const back = plan.culms.map((c, i) => [c, i] as const).filter(([c]) => !c.front);
      const front = plan.culms.map((c, i) => [c, i] as const).filter(([c]) => c.front);
      plan.blades.forEach((b, i) => !b.front && drawBlade(p, r.fork(`bb-${i}`), b, g));
      for (const [c, i] of back) drawCulm(p, r.fork(`culm-${i}`), c, g);
      plan.blades.forEach((b, i) => b.front && drawBlade(p, r.fork(`fb-${i}`), b, g));
      for (const [c, i] of front) drawCulm(p, r.fork(`culm-${i}`), c, g);
    } finally {
      end();
    }
  },
};

export default barley;
