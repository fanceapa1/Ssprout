import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { freckledBud, freckledStars, type Freckle, type StarFlower, type Tepal } from '../lib/hototogisu-paint';
import { clamp01, ease, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintLeaf, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { UP, lerpAngle, makeStem, pointAt, stemPoints, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Hototogisu (Tricyrtis hirta), the toad lily: hairy stems leaning out from shaded rock and
 * arching over, set with alternate clasping lance leaves, and in autumn upward-facing white
 * stars in the leaf axils, freckled purple like the lesser cuckoo's barred breast.
 */

const LEAF = '#8b9c5a';
const STEM = mix('#8b9c5a', '#7a5468', 0.32);
const FRECKLE = '#6b4a8c';
const COLUMN = mix('#b9a2c9', PIGMENTS.petalWhite, 0.3);
const BUD_GREEN = mix(PIGMENTS.sap, PIGMENTS.sageLight, 0.4);

/** Box 120×160, base at (60, 144): room 58 to each side, 140 above, 14 below. */
const BOX = { w: 120, h: 160, ax: 0.5, ay: 0.9 };
const REACH = { side: 55, up: 136, down: 6 };

interface LeafPlan {
  /** node position along the stem (0 base … 1 tip) */
  t: number;
  side: 1 | -1;
  /** turn from the stem's direction at the node, toward the tip */
  turn: number;
  length: number;
  width: number;
  curve: number;
  tone: Pigment;
}

interface Bloom {
  id: number;
  stem: number;
  t: number;
  side: 1 | -1;
  ped: number;
  size: number;
  tilt: number;
  turn: number;
  tepals: Tepal[];
  arms: number[];
  bud: [number, number];
  open: [number, number];
}

interface Stalk {
  plan: StemPlan;
  window: [number, number];
  leaves: LeafPlan[];
  width: number;
}

export interface HototogisuPlan {
  stalks: Stalk[];
  blooms: Bloom[];
}

function planTepals(rng: Rng): Tepal[] {
  const rot = rng.range(0, Math.PI * 2);
  // some tepals are heavily freckled, some sparsely: dabbed, not stippled
  return Array.from({ length: 6 }, (_, i) => {
    const freckles: Freckle[] = [];
    const n = rng.int(1, 5);
    const centres = [rng.range(0.25, 0.5), rng.range(0.45, 0.75)];
    for (let k = 0; k < n; k++) {
      const c = centres[k % 2]!;
      freckles.push({ u: clamp01(c + rng.gaussian(0, 0.12)) * 0.9 + 0.05, v: Math.max(-0.85, Math.min(0.85, rng.gaussian(0, 0.42))), r: rng.range(0.6, 1.5), soft: rng.chance(0.5), tone: rng.next() });
    }
    return { a: rot + (i / 6) * Math.PI * 2 + rng.gaussian(0, 0.07), len: rng.range(0.92, 1.06), wid: rng.range(0.34, 0.42), curve: rng.gaussian(0, 0.08), freckles };
  });
}

/** The stem's points at full growth, to fit it in the box. */
function fullPoints(s: StemPlan): Pt[] {
  return stemPoints(s, 1, 1);
}

export function planHototogisu(rng: Rng): HototogisuPlan {
  const lean: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const n = rng.chance(0.25) ? 2 : rng.chance(0.6) ? 3 : 4;
  const green = jitter(LEAF, rng, 0.03);
  const stalks: Stalk[] = [];
  const blooms: Bloom[] = [];
  for (let i = 0; i < n; i++) {
    // most stems lean out one way; now and then one leans back the other
    const side: 1 | -1 = i > 0 && rng.chance(0.28) ? (-lean as 1 | -1) : lean;
    const main = i === 0;
    const length = rng.range(92, 112) * (main ? 1 : rng.range(0.7, 0.92));
    const angle = UP + side * rng.range(0.06, 0.3);
    const bend = side * rng.range(1.8, 2.4);
    let plan = makeStem(rng, { base: { x: rng.range(-3, 3), y: -0.5 }, length, angle, bend, segments: 12, tipBias: 0.75, wobble: 0.025 });
    // shorten until the arch sits inside the box
    for (let tries = 0; tries < 12; tries++) {
      const pts = fullPoints(plan);
      const out = pts.some((q) => Math.abs(q.x) > REACH.side || q.y < -REACH.up || q.y > REACH.down);
      if (!out) break;
      plan = { ...plan, length: plan.length * 0.92 };
    }
    const nLeaves = rng.int(8, 11);
    const leaves: LeafPlan[] = [];
    let alt: 1 | -1 = rng.chance(0.5) ? 1 : -1;
    for (let j = 0; j < nLeaves; j++) {
      const t = lerp(0.14, 0.93, (j + rng.range(-0.3, 0.3)) / (nLeaves - 1));
      // longest a little below the middle, small toward the tip
      const size = Math.sin(Math.PI * lerp(0.25, 0.92, t)) * lerp(1, 0.55, t ** 2);
      leaves.push({ t, side: alt, turn: rng.range(0.42, 0.75), length: rng.range(15, 20) * size, width: rng.range(5, 6.4) * size, curve: alt * rng.range(0.04, 0.14), tone: jitter(mix(green, PIGMENTS.olive, rng.range(0, 0.3)), rng, 0.03) });
      alt = -alt as 1 | -1;
    }
    stalks.push({ plan, window: [0.06 + i * 0.035, 0.58 + i * 0.03], leaves, width: main ? 1.25 : 1.05 });
    // flowers in the upper axils, often in pairs, and a few at the tip
    for (const l of leaves) {
      if (l.t < 0.3 || !rng.chance(0.36)) continue;
      const m = rng.chance(0.15) ? 2 : 1;
      for (let k = 0; k < m; k++) {
        blooms.push({ id: blooms.length, stem: i, t: l.t, side: l.side, ped: rng.range(1.5, 3.2) + k * 2.2, size: rng.range(7.2, 8.4), tilt: rng.range(0.55, 0.8), turn: rng.gaussian(0, 0.18), tepals: planTepals(rng), arms: [UP - rng.range(1.1, 1.5), UP + rng.gaussian(0, 0.25), UP + rng.range(1.1, 1.5)], bud: [0, 0], open: [0, 0] });
      }
    }
    const tip = rng.chance(0.6) ? 1 : 2;
    for (let k = 0; k < tip; k++) {
      blooms.push({ id: blooms.length, stem: i, t: 0.985, side: k % 2 ? 1 : -1, ped: rng.range(1, 2.4), size: rng.range(6.6, 7.6), tilt: rng.range(0.55, 0.75), turn: rng.gaussian(0, 0.2), tepals: planTepals(rng), arms: [UP - rng.range(1.1, 1.5), UP + rng.gaussian(0, 0.25), UP + rng.range(1.1, 1.5)], bud: [0, 0], open: [0, 0] });
    }
  }
  // buds form and open from the base of each stem outward
  const order = blooms.map((b, i) => ({ i, key: b.t + rng.range(0, 0.08) })).sort((a, b) => a.key - b.key);
  order.forEach(({ i }, k) => {
    blooms[i]!.bud = [...stagger(k, order.length, [0.46, 0.84], 0.42)] as [number, number];
    blooms[i]!.open = [...stagger(k, order.length, [0.74, 1], 0.4)] as [number, number];
  });
  return { stalks, blooms };
}

interface Grown {
  pts: Pt[];
  ext: number;
}

/** A node at fraction `t` of the full stem, on the stem as grown so far. */
function nodeAt(gs: Grown, t: number) {
  return pointAt(gs.pts, Math.min(1, t / Math.max(1e-3, gs.ext)));
}

function grow(s: Stalk, g: number): Grown | null {
  const k = ease(g, s.window[0], s.window[1]);
  if (!visible(k)) return null;
  // a young shoot comes up nearly straight; it arches as it lengthens
  const ext = lerp(0.04, 1, k) * smooth(k * 5);
  return { pts: stemPoints(s.plan, ext, lerp(0.2, 1, smooth(k))), ext };
}

function drawStalk(p: Painter, rng: Rng, s: Stalk, gs: Grown) {
  const hair = mix(STEM, PIGMENTS.petalWhite, 0.35);
  p.dryBrush(gs.pts, { rng: rng.fork('hair'), pigment: hair, width: s.width * 2.4, opacity: 0.22 * smooth(gs.ext * 3), taper: [0.05, 0.5] });
  paintStem(p, rng.fork('stem'), gs.pts, { width: s.width, pigment: STEM, opacity: 0.85, ink: 0.16 * gs.ext, inkReach: 0.6, inkPigment: mix(STEM, PIGMENTS.sumi, 0.5), wetness: 0.4 });
  s.leaves.forEach((l, j) => {
    const k = smooth(clamp01((gs.ext - l.t * 0.88) / 0.24));
    if (!visible(k)) return;
    const node = nodeAt(gs, l.t);
    const angle = node.angle + l.side * l.turn;
    // the clasping base wraps a little round the stem
    const nx = -Math.sin(node.angle) * l.side;
    const ny = Math.cos(node.angle) * l.side;
    const at = { x: node.x - nx * 0.6 * k, y: node.y - ny * 0.6 * k };
    paintLeaf(p, rng.fork(`leaf-${j}`), at, { angle, length: l.length, width: l.width, curve: l.curve, asym: 0.15 * l.side, k, fold: node.angle }, { pigment: l.tone, opacity: 0.8, vein: 0.14 });
    p.dab(at, mix(l.tone, STEM, 0.3), { rng: rng.fork(`clasp-${j}`), variant: 'round', angle: node.angle, length: l.width * 0.55 * k, width: l.width * 0.4 * k, opacity: 0.3 * k, edge: 0.25, layers: 2 });
  });
}

const hototogisu: SpeciesDef = {
  id: 'hototogisu',
  name: 'Toad Lily',
  nativeName: 'Hototogisu',
  // shaded rocky slopes and stream banks of the low mountains; wild only, so not in the garden
  range: { realms: ['japan'], biomes: ['montane-stream', 'temperate-forest'], climates: ['cool-temperate', 'warm-temperate'] },
  tier: 2,
  habitats: ['rock', 'back'],
  sizeClass: 'medium',
  size: { w: BOX.w, h: BOX.h },
  anchor: { x: BOX.ax, y: BOX.ay },
  description: 'Hototogisu — freckled like the cuckoo’s breast, leaning from the rock.',
  bloomColor: '#d9c7dc',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planHototogisu(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts);
    try {
      const r = rng.fork('paint');
      groundShadow(p, r, { rx: 22, k: ease(g, 0.08, 0.6), opacity: 0.2 });
      seedMound(p, r, g, { rx: 8 });
      const grown = plan.stalks.map((s) => grow(s, g));
      // the shorter stems stand behind the main one
      for (let i = plan.stalks.length - 1; i >= 0; i--) {
        const gs = grown[i];
        if (gs) drawStalk(p, r.fork(`stalk-${i}`), plan.stalks[i]!, gs);
      }
      const stars: StarFlower[] = [];
      for (const b of plan.blooms) {
        const gs = grown[b.stem];
        if (!gs) continue;
        const budK = ease(g, b.bud[0], b.bud[1]);
        if (!visible(budK)) continue;
        const node = nodeAt(gs, b.t);
        const dir = lerpAngle(node.angle, UP, 0.55) + b.side * 0.35;
        const c = { x: node.x + Math.cos(dir) * b.ped * budK, y: node.y + Math.sin(dir) * b.ped * budK };
        const fr = r.fork(`bloom-${b.id}`);
        p.inkLine([node, c], { rng: fr.fork('ped'), width: 0.4, pigment: STEM, opacity: 0.6 * smooth(budK * 3), breaks: 0, wobble: 0.1, taper: [0.05, 0.4] });
        const open = ease(g, b.open[0], b.open[1]);
        const roll = UP + b.turn + (dir - UP) * 0.2;
        const fade = 1 - smooth(open / 0.4);
        freckledBud(p, fr, c, { angle: roll, size: b.size * 0.75, k: budK, white: ease(g, b.open[0] - 0.12, b.open[0] + 0.02), opacity: fade, green: BUD_GREEN, freckle: FRECKLE });
        if (visible(open)) stars.push({ id: b.id, c, tepals: b.tepals, view: { tilt: b.tilt, roll }, size: b.size, open, arms: b.arms });
      }
      freckledStars(p, r.fork('stars'), stars, { freckle: FRECKLE, column: COLUMN, area: { x: -BOX.w * BOX.ax, y: -BOX.h * BOX.ay, w: BOX.w, h: BOX.h } });
    } finally {
      end();
    }
  },
};

export default hototogisu;
