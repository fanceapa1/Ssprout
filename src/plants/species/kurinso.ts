import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { primroseBud, primroseEye, primroseRing, spoonLeaf, type Primrose } from '../lib/kurinso-paint';
import { ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { UP, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Kurinsō (Primula japonica): a rosette of long, crinkled spoon leaves by the stream, and one
 * stout stem carrying its flat magenta primroses in rings stacked up it like a pagoda's spire.
 */

const LEAF = '#8fae5e';
const LEAF_DEEP = mix('#5f7d45', PIGMENTS.celadonDeep, 0.25);
const SCAPE = mix('#a9b97a', PIGMENTS.sage, 0.35);

interface Colourway {
  pigment: Pigment;
  light: Pigment;
  eye: Pigment;
  throat: Pigment;
  white: boolean;
}

const MAGENTA: Colourway = { pigment: '#c9568a', light: '#e08aae', eye: '#7a2b4f', throat: mix(PIGMENTS.gold, '#c9568a', 0.35), white: false };
const CRIMSON: Colourway = { pigment: mix('#c9568a', '#a8274a', 0.55), light: mix('#e08aae', '#c9568a', 0.5), eye: mix('#7a2b4f', '#5a1830', 0.5), throat: mix(PIGMENTS.gold, '#a8274a', 0.3), white: false };
const ROSE: Colourway = { pigment: mix('#c9568a', '#e08aae', 0.5), light: mix('#e08aae', PIGMENTS.petalWhite, 0.35), eye: mix('#7a2b4f', '#c9568a', 0.35), throat: mix(PIGMENTS.gold, PIGMENTS.petalWhite, 0.2), white: false };
const WHITE: Colourway = { pigment: '#f6eef0', light: PIGMENTS.petalWhite, eye: '#d98aa6', throat: mix(PIGMENTS.gold, PIGMENTS.petalWhite, 0.3), white: true };

interface SpoonPlan {
  /** where its winged base leaves the crown */
  base: Pt;
  angle: number;
  length: number;
  width: number;
  curve: number;
  window: [number, number];
  tone: Pigment;
  veins: number;
  asym: number;
  /** screen depth: leaves reaching back are painted before the stem */
  depth: number;
}

interface WhorlFlower {
  /** angle round the stem in the ground plane (π/2 = toward us) */
  phi: number;
  reach: number;
  lift: number;
  size: number;
  lobes: number[];
  open: [number, number];
}

interface Whorl {
  /** position along the scape (0 base … 1 tip) */
  at: number;
  flowers: WhorlFlower[];
  bud: [number, number];
  bracts: { angle: number; length: number }[];
}

export interface KurinsoPlan {
  leaves: SpoonPlan[];
  scape: StemPlan;
  whorls: Whorl[];
  colour: Colourway;
}

function pickColour(rng: Rng): Colourway {
  const u = rng.next();
  const base = u < 0.1 ? WHITE : u < 0.28 ? CRIMSON : u < 0.42 ? ROSE : MAGENTA;
  return base.white ? base : { ...base, pigment: jitter(base.pigment, rng, 0.025) };
}

export function planKurinso(rng: Rng): KurinsoPlan {
  const n = rng.int(7, 10);
  const rot = rng.range(0, Math.PI * 2);
  const green = jitter(LEAF, rng, 0.03);
  const leaves: SpoonPlan[] = [];
  for (let i = 0; i < n; i++) {
    // spread round the base in the ground plane, ascending, foreshortened toward us
    const phi = rot + (i / n) * Math.PI * 2 + rng.gaussian(0, 0.2);
    const lift = rng.range(0.15, 0.5);
    let ax = Math.cos(phi);
    let ay = 0.42 * Math.sin(phi) - lift;
    // a leaf toward us would be a stub in this box: it lies out sideways instead
    if (ay > 0.08) {
      ay = 0.08;
      ax = (ax < 0 ? -1 : 1) * Math.max(Math.abs(ax), 0.75);
    }
    const angle = Math.atan2(ay, ax);
    const reach = Math.hypot(ax, ay) / Math.hypot(1, lift);
    let length = rng.range(34, 46) * lerp(0.7, 1, reach);
    const width = rng.range(11, 14) * lerp(0.75, 1, Math.min(1, length / 34));
    // the box: its blade, flank included, stays 8 below the base and 56 to each side
    const curve = (Math.cos(angle) > 0 ? 1 : -1) * rng.range(0.04, 0.14);
    // the tip droops by about 0.7 × curve × length
    const down = Math.sin(angle) + Math.abs(curve) * 0.7 * Math.abs(Math.cos(angle));
    const flank = (width / 2) * Math.abs(Math.cos(angle));
    if (down > 0.05) length = Math.min(length, Math.max(4, (7.5 - flank) / down));
    length = Math.min(length, 54 / Math.max(0.05, Math.abs(Math.cos(angle))));
    leaves.push({
      base: { x: Math.cos(phi) * rng.range(1, 2.6), y: -0.5 + Math.sin(phi) * rng.range(0.3, 0.9) },
      angle,
      length,
      width: width * lerp(0.6, 1, Math.min(1, length / 20)),
      curve,
      window: [0, 0],
      tone: jitter(mix(green, LEAF_DEEP, rng.range(0, 0.3)), rng, 0.025),
      veins: rng.int(6, 8),
      asym: rng.range(-0.3, 0.3),
      depth: Math.sin(phi),
    });
  }
  leaves.forEach((l, i) => {
    l.window = [...stagger((i * 3) % n, n, [0.05, 0.56], 0.42)] as [number, number];
  });

  const colour = pickColour(rng);
  const length = rng.range(98, 120);
  const lean = rng.gaussian(0, 0.05);
  const scape = makeStem(rng, { base: { x: rng.range(-1, 1), y: -1 }, length, angle: UP + lean, bend: rng.gaussian(0, 0.12), segments: 10, tipBias: 0.5, wobble: 0.015 });
  const nw = rng.int(3, 5);
  const low = rng.range(0.34, 0.42);
  const whorls: Whorl[] = [];
  for (let j = 0; j < nw; j++) {
    const q = j / (nw - 1);
    // internodes shorten toward the tip; the upper rings are smaller
    const at = lerp(low, 0.985, 1 - (1 - q) ** 1.25);
    const m = rng.int(6, 9) - (q > 0.8 ? 1 : 0);
    const turn = rng.range(0, Math.PI * 2);
    const scale = lerp(1, 0.74, q);
    const flowers: WhorlFlower[] = [];
    for (let k = 0; k < m; k++) {
      const lobeRot = rng.range(0, Math.PI * 2);
      flowers.push({
        phi: turn + (k / m) * Math.PI * 2 + rng.gaussian(0, 0.18),
        reach: rng.range(8, 10.5) * scale,
        lift: rng.range(2.4, 4) * scale,
        size: rng.range(4.6, 5.4) * scale,
        lobes: Array.from({ length: 5 }, (_, i) => lobeRot + (i / 5) * Math.PI * 2 + rng.gaussian(0, 0.07)),
        open: [0, 0],
      });
    }
    // the rings open from the bottom up, each one's flowers a little apart
    const open = stagger(j, nw, [0.68, 1], 0.5);
    const order = rng.shuffle(flowers.map((_, k) => k));
    order.forEach((fi, k) => {
      flowers[fi]!.open = [...stagger(k, m, open, 0.65)] as [number, number];
    });
    const bracts = Array.from({ length: rng.int(2, 3) }, () => ({ angle: rng.range(-Math.PI, 0), length: rng.range(2.5, 4) * scale }));
    whorls.push({ at, flowers, bud: [...stagger(j, nw, [0.36, 0.76], 0.62)] as [number, number], bracts });
  }
  return { leaves, scape, whorls, colour };
}

function drawLeaf(p: Painter, rng: Rng, l: SpoonPlan, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  spoonLeaf(
    p,
    rng,
    { x: l.base.x * smooth(k * 2), y: l.base.y },
    // a young leaf comes up rolled and upright, then lies out
    { angle: lerp(UP, l.angle, smooth(k * 1.3)), length: l.length, width: l.width, curve: l.curve, k },
    { pigment: l.tone, deep: mix(LEAF_DEEP, l.tone, 0.35), veins: l.veins, asym: l.asym, opacity: 0.92 },
  );
}

interface Placed {
  key: string;
  whorl: number;
  at: Pt;
  node: Pt;
  depth: number;
  f: WhorlFlower;
  bud: number;
}

/** Where each flower of the whorls sits at growth `g`, with its pedicel's root. */
function placeFlowers(plan: KurinsoPlan, pts: Pt[], g: number): Placed[] {
  const out: Placed[] = [];
  plan.whorls.forEach((w, j) => {
    const bud = ease(g, w.bud[0], w.bud[1]);
    if (!visible(bud)) return;
    const node = pointAt(pts, w.at);
    w.flowers.forEach((f, k) => {
      const spread = lerp(0.25, 1, bud) * lerp(0.75, 1, ease(g, f.open[0], f.open[1]));
      const x = node.x + Math.cos(f.phi) * f.reach * spread;
      const y = node.y - f.lift * spread + Math.sin(f.phi) * f.reach * 0.36 * spread;
      out.push({ key: `${j}-${k}`, whorl: j, at: { x, y }, node, depth: Math.sin(f.phi), f, bud });
    });
  });
  return out;
}

/** Screen pose of a flower: it faces out and up from the stem, so back ones show their backs. */
function flowerView(f: WhorlFlower) {
  const s = Math.sin(f.phi);
  return { view: { tilt: lerp(0.4, 0.92, Math.abs(s)), roll: Math.atan2(-0.55 - 0.25 * Math.max(0, -s), Math.cos(f.phi)) }, face: Math.max(0, Math.min(1, 0.55 + 0.55 * s)) };
}

/** Pedicels and buds, then the open flowers of these as one wash, then their eyes. */
function drawFlowers(p: Painter, rng: Rng, placed: Placed[], plan: KurinsoPlan, g: number, ring: string) {
  const c = plan.colour;
  const open: (Primrose & { key: string })[] = [];
  for (const pl of placed) {
    const { f, at, node, bud } = pl;
    const r = rng.fork(`f-${pl.key}`);
    const tip = { x: lerp(node.x, at.x, 0.8), y: lerp(node.y, at.y, 0.8) };
    p.inkLine([node, { x: (node.x + tip.x) / 2, y: (node.y + tip.y) / 2 - 0.5 }, tip], { rng: r.fork('ped'), width: 0.4, pigment: mix(SCAPE, LEAF, 0.3), opacity: 0.55 * smooth(bud * 3), breaks: 0, wobble: 0.1, taper: [0.05, 0.4] });
    const k = ease(g, f.open[0], f.open[1]);
    const { view, face } = flowerView(f);
    const fade = 1 - smooth(k / 0.45);
    if (visible(fade)) {
      primroseBud(p, r.fork('bud'), at, { angle: view.roll, length: f.size * 0.8, k: bud, colour: ease(g, f.open[0] - 0.12, f.open[0] + 0.05), pigment: c.pigment, green: mix(SCAPE, PIGMENTS.sageLight, 0.35), opacity: 0.85 * fade });
    }
    if (visible(k)) open.push({ key: pl.key, c: at, view, size: f.size, open: k, lobes: f.lobes, face });
  }
  const style = { pigment: c.pigment, light: c.light, eye: c.eye, throat: c.throat, white: c.white };
  primroseRing(p, rng.fork(`ring-${ring}`), open, style, c.white ? 0.95 : 0.9);
  for (const f of open) primroseEye(p, rng.fork(`eye-${f.key}`), f, style);
}

function drawBracts(p: Painter, rng: Rng, plan: KurinsoPlan, pts: Pt[], g: number) {
  plan.whorls.forEach((w, j) => {
    const k = ease(g, w.bud[0], w.bud[1] + 0.05);
    if (!visible(k)) return;
    const node = pointAt(pts, w.at);
    w.bracts.forEach((b, i) => {
      p.dab(node, mix(mix(SCAPE, LEAF, 0.4), PIGMENTS.petalWhite, 0.2), { rng: rng.fork(`bract-${j}-${i}`), variant: 'leaf', angle: b.angle, length: b.length * k, width: b.length * 0.3 * k, opacity: 0.55 * smooth(k * 3), edge: 0.25 });
    });
  });
}

const kurinso: SpeciesDef = {
  id: 'kurinso',
  name: 'Japanese Primrose',
  nativeName: 'Kurinsō',
  // boggy ground beside mountain streams; wild only, so the Japanese garden does not offer it
  range: { realms: ['japan'], biomes: ['montane-stream', 'wetland'], climates: ['cool-temperate'] },
  tier: 2,
  habitats: ['shore', 'meadow'],
  sizeClass: 'medium',
  size: { w: 120, h: 160 },
  anchor: { x: 0.5, y: 0.94 },
  description: 'Kurinsō — a pagoda’s spire of flowers, one ring at a time.',
  bloomColor: '#c9568a',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planKurinso(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 30, k: ease(g, 0.08, 0.6), opacity: 0.18 });
      seedMound(p, r, g, { rx: 9 });
      const back = plan.leaves.map((l, i) => [l, i] as const).filter(([l]) => l.depth < 0).sort((a, b) => a[0].depth - b[0].depth);
      const front = plan.leaves.map((l, i) => [l, i] as const).filter(([l]) => l.depth >= 0).sort((a, b) => a[0].depth - b[0].depth);
      for (const [l, i] of back) drawLeaf(p, r.fork(`leaf-${i}`), l, g);
      const ext = ease(g, 0.3, 0.8);
      if (visible(ext)) {
        const pts = stemPoints(plan.scape, lerp(0.06, 1, ext) * smooth(ext * 4), lerp(0.3, 1, ext));
        const placed = placeFlowers(plan, pts, g);
        plan.whorls.forEach((_, j) => drawFlowers(p, r, placed.filter((pl) => pl.whorl === j && pl.depth < 0), plan, g, `${j}-back`));
        paintStem(p, r.fork('scape'), pts, { width: 2.3, pigment: SCAPE, opacity: 0.85, ink: 0.18 * ext, inkReach: 0.5, wetness: 0.5 });
        drawBracts(p, r, plan, pts, g);
        plan.whorls.forEach((_, j) => drawFlowers(p, r, placed.filter((pl) => pl.whorl === j && pl.depth >= 0).sort((a, b) => a.depth - b.depth), plan, g, `${j}-front`));
      }
      for (const [l, i] of front) drawLeaf(p, r.fork(`leaf-${i}`), l, g);
    } finally {
      end();
    }
  },
};

export default kurinso;
