import type { Rng } from '../../core/rng';
import { PIGMENTS, jitter, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { crossFlowers, heartLeaf, heartShape, type CrossFlower, type HeartShape } from '../lib/wasabi-paint';
import { ease, easeOut, lerp, smooth, stagger, visible } from '../lib/small-growth';
import { groundShadow, paintStem, plantFrame, seedMound } from '../lib/small-paint';
import { SMALL_DESIGN, SMALL_SIZE } from '../lib/small-size';
import { UP, makeStem, pointAt, stemPoints, subPath, type StemPlan } from '../lib/small-structure';
import type { SpeciesDef } from '../types';

/**
 * Wasabi (Eutrema japonicum): a clump of long-stalked, glossy, round heart-to-kidney leaves
 * rising from a knobbly rhizome at the edge of cold running water, and in spring a few airy
 * racemes of small white four-petalled crosses.
 */

const MATURE = '#7f9a52';
const YOUNG = '#a8b572';
// a cool, clean green that keeps the clump crisp beside the meadow
const FRESH = '#6fa35c';
const STALK = mix('#b9c486', PIGMENTS.sageLight, 0.4);
const FLUSH = '#8a5d82';
const RHIZOME = mix(mix(PIGMENTS.sap, PIGMENTS.wood, 0.45), PIGMENTS.sage, 0.3);
const WATER = mix(PIGMENTS.celadon, PIGMENTS.celadonMid, 0.4);

interface WasabiLeaf {
  stalk: StemPlan;
  shape: HeartShape;
  r: number;
  tilt: number;
  /** how far the blade turns from the stalk's tip toward upright */
  lift: number;
  turn: number;
  z: number;
  window: [number, number];
  tone: Pigment;
  flush: number;
  gloss: number;
}

interface Bract {
  t: number;
  side: number;
  r: number;
  shape: HeartShape;
}

interface RacemeFlower {
  t: number;
  side: number;
  pedicel: number;
  spread: number;
  size: number;
  tilt: number;
  turn: number;
  bud: [number, number];
  /** null: still a bud at full growth (the raceme's tip) */
  open: [number, number] | null;
}

interface Raceme {
  stem: StemPlan;
  window: [number, number];
  bracts: Bract[];
  flowers: RacemeFlower[];
}

export interface WasabiPlan {
  leaves: WasabiLeaf[];
  racemes: Raceme[];
  /** the rhizome's slant and size */
  rhizome: { angle: number; length: number; width: number; knobs: number[] };
  spread: number;
}

export function planWasabi(rng: Rng): WasabiPlan {
  const lean = rng.range(-0.15, 0.15);
  const nLeaves = rng.int(6, 8);
  const mature = jitter(MATURE, rng, 0.03);
  const leaves: WasabiLeaf[] = [];
  const zs = rng.shuffle(Array.from({ length: nLeaves }, (_, i) => i / (nLeaves - 1) - 0.5));
  for (let i = 0; i < nLeaves; i++) {
    const u = i / (nLeaves - 1) - 0.5 + rng.gaussian(0, 0.04);
    const out = Math.abs(u) * 2;
    const z = zs[i]!;
    const length = lerp(26, 13.5, out) * rng.range(0.86, 1.08) * lerp(1, 0.86, Math.max(0, z));
    leaves.push({
      stalk: makeStem(rng, { base: { x: u * 3, y: -2.6 + z * 1 }, length, angle: UP + lean * 0.6 + u * 1.75 + rng.gaussian(0, 0.08), bend: u * rng.range(0.55, 1.05), segments: 7, tipBias: 0.55, wobble: 0.03 }),
      shape: heartShape(rng.fork(`shape-${i}`), { wide: rng.range(1.02, 1.2), notch: rng.range(0.5, 0.68), teeth: rng.int(18, 26), wave: rng.range(0.03, 0.06) }),
      r: lerp(9.2, 7.4, out) * rng.range(0.9, 1.08),
      tilt: rng.range(0.62, 0.95),
      lift: rng.range(0.35, 0.6),
      turn: rng.gaussian(0, 0.12),
      z,
      window: [0, 0],
      // the inner leaves are the youngest, still a fresh yellow-green
      tone: jitter(mix(mix(YOUNG, mature, lerp(0.35, 1, out) * rng.range(0.8, 1)), FRESH, 0.25), rng, 0.025),
      flush: rng.range(0.35, 0.8),
      gloss: rng.range(0.5, 0.68),
    });
  }
  const order = rng.shuffle(leaves.map((_, i) => i));
  order.forEach((li, k) => {
    leaves[li]!.window = [...stagger(k, nLeaves, [0.08, 0.6], 0.42)] as [number, number];
  });

  const nRacemes = rng.chance(0.35) ? 1 : rng.chance(0.75) ? 2 : 3;
  const racemes: Raceme[] = [];
  const sides = rng.shuffle([-1, 1, rng.chance(0.5) ? -0.3 : 0.3]);
  for (let s = 0; s < nRacemes; s++) {
    const side = sides[s]!;
    const length = rng.range(38, 45) * (s === 0 ? 1 : rng.range(0.82, 0.95));
    const stem = makeStem(rng, { base: { x: side * 2, y: -1 }, length, angle: UP + lean + side * rng.range(0.22, 0.42), bend: side * rng.range(0.15, 0.4), segments: 9, tipBias: 0.7, wobble: 0.04 });
    const w0 = 0.42 + s * 0.04;
    const bracts: Bract[] = [];
    const nb = rng.int(1, 2);
    for (let b = 0; b < nb; b++) {
      bracts.push({ t: rng.range(0.32, 0.55), side: (b % 2 ? -1 : 1) * (rng.chance(0.5) ? 1 : -1), r: rng.range(2.4, 3.4), shape: heartShape(rng.fork(`bract-${s}-${b}`), { wide: rng.range(0.95, 1.1), notch: 0.55, teeth: 14, wave: 0.05 }) });
    }
    const nF = rng.int(7, 10);
    const nBuds = rng.int(2, 3);
    const nOpen = nF - nBuds;
    const flowers: RacemeFlower[] = [];
    const flip = rng.chance(0.5) ? 1 : -1;
    for (let j = 0; j < nF; j++) {
      const q = j / (nF - 1);
      flowers.push({
        t: lerp(0.62, 0.995, q ** 0.8),
        side: (j % 2 ? 1 : -1) * flip,
        pedicel: lerp(3.4, 0.6, q) * rng.range(0.85, 1.15),
        spread: rng.range(0.7, 1.15),
        size: rng.range(1.7, 2.1),
        tilt: rng.range(0.62, 1),
        turn: rng.gaussian(0, 0.35),
        bud: [...stagger(j, nF, [0.5, 0.8], 0.6)] as [number, number],
        // racemes open from the bottom up
        open: j < nOpen ? ([...stagger(j, nOpen, [0.74, 1], 0.5)] as [number, number]) : null,
      });
    }
    racemes.push({ stem, window: [w0, 0.74], bracts, flowers });
  }
  const knobs = Array.from({ length: 3 }, () => rng.range(0.8, 1.15));
  return { leaves, racemes, rhizome: { angle: UP + rng.gaussian(0, 0.25), length: rng.range(4.6, 5.8), width: rng.range(4.4, 5.2), knobs }, spread: 21 };
}

/** The blade's forward axis: from the stalk's tip, turned partway toward upright. */
function bladeAngle(tipAngle: number, lift: number): number {
  const d = Math.atan2(Math.sin(UP - tipAngle), Math.cos(UP - tipAngle));
  return tipAngle + d * lift;
}

function drawLeaf(p: Painter, rng: Rng, l: WasabiLeaf, g: number) {
  const k = ease(g, l.window[0], l.window[1]);
  if (!visible(k)) return;
  const pts = stemPoints(l.stalk, lerp(0.15, 1, k) * smooth(k * 3), lerp(0.3, 1, k));
  paintStem(p, rng.fork('stalk'), pts, { width: 0.82, opacity: 0.85, pigment: STALK, wetness: 0.5 });
  // flushed purple where the stalks crowd out of the rhizome
  paintStem(p, rng.fork('flush'), subPath(pts, 0.3), { width: 1, opacity: 0.75 * l.flush * smooth(k * 2), pigment: mix(FLUSH, STALK, 0.15) });
  const kb = ease(g, lerp(l.window[0], l.window[1], 0.3), l.window[1] + 0.05);
  if (!visible(kb)) return;
  const tip = pointAt(pts, 1);
  heartLeaf(
    p,
    rng.fork('blade'),
    l.shape,
    { sinus: { x: tip.x, y: tip.y }, angle: bladeAngle(tip.angle, l.lift * smooth(kb)) + l.turn, r: l.r * easeOut(kb), tilt: lerp(0.95, l.tilt, smooth(kb)), open: smooth(kb) },
    { pigment: l.tone, deep: mix(l.tone, mix(PIGMENTS.olive, PIGMENTS.celadonDeep, 0.35), 0.6), gloss: l.gloss * smooth(kb * 1.4 - 0.4), opacity: 0.96, cover: true },
  );
}

/** Centre of the rhizome at `t` (0 = in the water, 1 = where the stalks crowd out). */
function rhizomeAt(plan: WasabiPlan, t: number, k: number): Pt {
  const { angle, length } = plan.rhizome;
  const d = length * t * easeOut(k);
  return { x: Math.cos(angle) * d, y: 0.6 + Math.sin(angle) * d };
}

function drawRhizome(p: Painter, rng: Rng, plan: WasabiPlan, g: number) {
  const k = ease(g, 0.1, 0.55);
  if (!visible(k)) return;
  const { angle, length, width, knobs } = plan.rhizome;
  const L = p.layer({ x: -10, y: -12, w: 20, h: 16 });
  const seg = (length / knobs.length) * 1.5;
  knobs.forEach((s, i) => {
    const t = (i + 0.5) / knobs.length;
    const c = rhizomeAt(plan, t, k);
    const sl = seg * s * easeOut(k);
    // each knob a squat round dab centred on the axis, the upper ones greener
    p.dabInto(L, { x: c.x - Math.cos(angle) * sl * 0.5, y: c.y - Math.sin(angle) * sl * 0.5 }, mix(RHIZOME, PIGMENTS.sap, t * 0.4), { rng: rng.fork(`knob-${i}`), variant: 'round', angle, length: sl, width: width * s * lerp(0.75, 1, t) * lerp(0.5, 1, k), pool: 0.5, poolSide: 1, basePool: 0.2, layers: 3 });
  });
  L.dry({ opacity: 0.78 * smooth(k * 3), edge: 0.55, edgeWidth: 0.45, sharpness: 0.7, centreLift: 0.3, granulation: 0.35, flow: 0.4, flowScale: 4, darken: 0.32 });
  // old leaf scars ring the rhizome between the knobs
  const sk = smooth((k - 0.4) / 0.4);
  if (visible(sk)) {
    knobs.forEach((s, i) => {
      if (i === 0) return;
      const c = rhizomeAt(plan, i / knobs.length, k);
      const nx = Math.cos(angle + Math.PI / 2);
      const ny = Math.sin(angle + Math.PI / 2);
      const hw = width * 0.4 * s;
      // a short scar on the shaded side only
      p.inkLine([{ x: c.x + nx * hw * 0.1, y: c.y + ny * hw * 0.1 }, { x: c.x + nx * hw * 0.6 - Math.cos(angle) * 0.4, y: c.y + ny * hw * 0.6 - Math.sin(angle) * 0.4 }, { x: c.x + nx * hw, y: c.y + ny * hw }], { rng: rng.fork(`scar-${i}`), width: 0.28, pigment: mix(RHIZOME, PIGMENTS.sumi, 0.45), opacity: 0.4 * sk, breaks: 0.35, wobble: 0.2, taper: [0.2, 0.3] });
    });
  }
}

function drawRaceme(p: Painter, rng: Rng, rc: Raceme, g: number) {
  const ext = ease(g, rc.window[0], rc.window[1]);
  if (!visible(ext)) return;
  const pts = stemPoints(rc.stem, ext, lerp(0.4, 1, ext));
  paintStem(p, rng.fork('stem'), pts, { width: 0.5, opacity: 0.8, pigment: mix(STALK, PIGMENTS.sage, 0.3) });
  rc.bracts.forEach((b, i) => {
    const kb = ease(g, rc.window[0] + 0.08, rc.window[1] + 0.04);
    if (!visible(kb)) return;
    const node = pointAt(pts, b.t);
    heartLeaf(p, rng.fork(`bract-${i}`), b.shape, { sinus: { x: node.x, y: node.y }, angle: node.angle + b.side * 0.9, r: b.r * easeOut(kb), tilt: 0.8, open: smooth(kb) }, { pigment: mix(YOUNG, MATURE, 0.4), deep: mix(MATURE, PIGMENTS.olive, 0.5), gloss: 0.3 * smooth(kb), opacity: 0.94, cover: true });
  });
  const open: CrossFlower[] = [];
  rc.flowers.forEach((f, j) => {
    const budK = ease(g, f.bud[0], f.bud[1]);
    if (!visible(budK)) return;
    const node = pointAt(pts, Math.min(1, f.t / Math.max(0.01, 1)));
    const pa = node.angle + f.side * f.spread;
    const pl = f.pedicel * lerp(0.3, 1, budK);
    const tip = { x: node.x + Math.cos(pa) * pl, y: node.y + Math.sin(pa) * pl };
    paintStem(p, rng.fork(`ped-${j}`), [{ x: node.x, y: node.y }, { x: (node.x + tip.x) / 2, y: (node.y + tip.y) / 2 - pl * 0.12 }, tip], { width: 0.24, opacity: 0.75, pigment: STALK });
    const ok = f.open ? ease(g, f.open[0], f.open[1]) : 0;
    const fade = 1 - smooth(ok / 0.5);
    if (visible(fade)) {
      const bud = mix(PIGMENTS.sageLight, PIGMENTS.petalWhite, 0.3 + smooth(budK) * (f.open ? 0.5 : 0.25));
      p.dab(tip, bud, { rng: rng.fork(`bud-${j}`), variant: 'round', angle: pa, length: lerp(0.4, 1.3, budK), width: lerp(0.35, 1, budK), opacity: 0.9 * fade * smooth(budK * 3), edge: 0.3, blend: 'source-over' });
    }
    if (visible(ok)) open.push({ c: tip, roll: pa + f.turn, tilt: f.tilt, size: f.size, open: ok });
  });
  crossFlowers(p, rng.fork('flowers'), open, { eye: mix(PIGMENTS.gold, PIGMENTS.sap, 0.45) });
}

const wasabi: SpeciesDef = {
  id: 'wasabi',
  name: 'Wasabi',
  nativeName: 'Wasabi',
  // the beds and banks of cold, shaded mountain streams
  range: { realms: ['japan'], biomes: ['montane-stream'], climates: ['cool-temperate'] },
  tier: 1,
  habitats: ['shore'],
  sizeClass: 'small',
  // drawn in a 70-unit design box, shown larger so it reads at garden scale
  size: { w: SMALL_SIZE, h: SMALL_SIZE },
  anchor: { x: 0.5, y: 0.88 },
  description: 'Wasabi — heart leaves in the cold current, the sharpness kept below.',
  bloomColor: '#f6f2e6',
  pollinators: true,
  draw(p, rng, opts) {
    const plan = planWasabi(rng.fork('plan'));
    const g = opts.growth;
    const end = plantFrame(p, this, opts, SMALL_DESIGN);
    try {
      const r = rng.fork('paint');
      // the foot stands in a cold, celadon current
      groundShadow(p, r.fork('water'), { rx: plan.spread, ry: 3.6, k: ease(g, 0.06, 0.5), pigment: WATER, opacity: 0.34 });
      groundShadow(p, r, { rx: 9, k: ease(g, 0.08, 0.6), opacity: 0.22 });
      seedMound(p, r, g, { rx: 6 });
      const byDepth = plan.leaves.map((l, i) => ({ l, i })).sort((a, b) => a.l.z - b.l.z);
      byDepth.forEach(({ l, i }) => l.z < 0.3 && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      plan.racemes.forEach((rc, i) => drawRaceme(p, r.fork(`raceme-${i}`), rc, g));
      byDepth.forEach(({ l, i }) => l.z >= 0.3 && drawLeaf(p, r.fork(`leaf-${i}`), l, g));
      drawRhizome(p, r.fork('rhizome'), plan, g);
      // the rhizome's foot is lost in the current
      groundShadow(p, r.fork('foot'), { rx: 8, ry: 2.2, k: ease(g, 0.2, 0.6), pigment: WATER, opacity: 0.4 });
      // the current parts around the foot
      const wk = ease(g, 0.3, 0.7);
      if (visible(wk)) {
        for (const [i, s] of [[0, -1], [1, 1]] as const) {
          const x0 = s * 4.5;
          const x1 = s * lerp(6, 15, wk);
          p.stroke([{ x: x0, y: 1.6 }, { x: (x0 + x1) / 2, y: 1.2 }, { x: x1, y: 1.9 }], { rng: r.fork(`current-${i}`), pigment: PIGMENTS.celadonDeep, width: 0.5, taper: [0.2, 0.5], wobble: 0.2, wetness: 0.4, opacity: 0.4 * wk, edge: 0.3 });
        }
      }
    } finally {
      end();
    }
  },
};

export default wasabi;
