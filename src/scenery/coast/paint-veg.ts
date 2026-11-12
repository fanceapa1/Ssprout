/**
 * The coast's vegetation (G4): the promontory's pines and dark maquis, phrygana cushions, dry
 * grass and scrub on the shoreline's edge; the big olive (the `olive` species' tree at scenery
 * scale, ADR 0367); the leaning Aleppo pine. Lit from the left (ADR 0360), on white in world
 * units, in parts (ADR 0226, 0238). docs/systems/scenery.md › Coast › Vegetation.
 */
import { createRng, type Rng } from '../../core/rng';
import { blob, bounds, jitter, lighten, mix, padRect, ribbon, shade, smoothPath, type DryOptions, type Painter, type Pigment } from '../../paint';
import { paintOliveLeaves, paintOliveTrunk, trunkOutline } from '../../plants/lib/olive-paint';
import { paintSkeleton, softRes, stableLayer } from '../../plants/lib/tree-paint';
import { branchProgress, treeView, viewPt } from '../../plants/lib/tree-structure';
import { oliveArrivals, planOlive, type OlivePlan } from '../../plants/species/olive';
import type { Pt, Rect } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { batchLayer } from '../oasis/paint-batch';
import { pacer } from '../oasis/paint-pace';
import { EARTH } from './paint-land';
import {
  GRASS, MAQUIS, OLIVE_SHADOW, OLIVE_TREE, PHRYGANA, PINE_BRANCHES, PINE_PADS, PINE_ROCK, PINE_TRUNK, PROMONTORY_PINE_SHAPES, SHORE_CLUMPS,
} from './shapes';

/** The vegetation's palette: dark maquis, Aleppo pine, phrygana, straw. */
export const VEG = {
  maquis: '#6f7d52',
  maquisDark: '#3f4e3c',
  maquisLit: '#929b68',
  pine: '#8fa262',
  pineLit: '#c3c884',
  pineDark: '#5d6e48',
  bark: '#8e5640',
  barkLit: '#d9a184',
  barkDark: '#523428',
  cone: '#8a5a3a',
  phrygana: '#9ea586',
  phryganaDark: '#6f7a62',
  rust: '#b48a5e',
} satisfies Record<string, Pigment>;

const LIGHT = -2.3;
const UP = -Math.PI / 2;

/** The olive species' own colours (`plants/species/olive.ts`), so the scenery olive is the same tree. */
const OLIVE_COLOURS = { bark: '#9a8b78', young: '#a19e95', shade: '#6a5d52', groove: '#4a4038', lit: '#ddd6c8' };
const OLIVE_WASH = '#a4b29c';
const OLIVE_SHADE = '#6d8070';
const OLIVE_LEAF: Record<0 | 1 | 2, Pigment> = { 0: '#4f6354', 1: '#7a8f76', 2: '#e1e6d8' };
const FRUIT = { green: '#8a9a4e', purple: '#6a4560', black: '#3f3240' };
const fruitColour = (ripe: number): Pigment => (ripe < 0.5 ? mix(FRUIT.green, FRUIT.purple, ripe * 2) : mix(FRUIT.purple, FRUIT.black, ripe * 2 - 1));

interface Clump {
  x: number;
  y: number;
  rx: number;
  ry: number;
  lit: Pigment;
  dark: Pigment;
  a: number;
}

/** A clump as a cloud of small scalloped lobes over a flat bottom, top to bottom. */
function lobes(c: Clump, rng: Rng): Pt[][] {
  const n = Math.max(4, Math.min(16, Math.round((c.rx / c.ry) * 3.2 + 1)));
  const out: { y: number; poly: Pt[] }[] = [];
  for (let k = 0; k < n; k++) {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next());
    const r = c.ry * rng.range(0.42, 0.7);
    const x = c.x + Math.cos(a) * (c.rx - r) * d;
    const y = Math.min(c.y + c.ry * 0.45 - r * 0.5, c.y + Math.sin(a) * (c.ry - r * 0.6) * d);
    out.push({ y, poly: blob(x, y, r * rng.range(1, 1.35), r, rng, { points: 12, irregularity: 0.3, scallop: 0.3, scallops: 5, flatBottom: 0.3 }) });
  }
  return out.sort((p, q) => p.y - q.y).map((o) => o.poly);
}

/** Clumps in two batched layers: the lobes' lit body, then each lobe's shade on its lower right. */
function* clumps(p: Painter, list: readonly Clump[], rng: Rng, sample: Rect, dry: DryOptions): Strokes {
  if (!list.length) return;
  const all = list.map((c) => ({ c, lobes: lobes(c, rng) }));
  const area = padRect(bounds(all.flatMap((x) => x.lobes.flat())), 6);
  const B = batchLayer(p, area, sample, 4);
  if (B.empty) return;
  for (const { c, lobes: ls } of all) for (const l of ls) B.fill(l, c.lit, c.a * 0.6);
  B.flush();
  yield;
  yield* B.dryParts(dry);
  const D = batchLayer(p, area, sample, 4);
  for (const { c, lobes: ls } of all) {
    for (const l of ls) {
      const b = bounds(l);
      D.fill(l, c.dark, c.a * 0.75);
      D.lift(l.map((q) => ({ x: q.x - b.w * 0.16, y: q.y - b.h * 0.34 })), 1);
    }
  }
  D.flush();
  yield;
  yield* D.dryParts({ ...dry, opacity: (dry.opacity ?? 0.8) * 0.9 });
}

const CLUMP_DRY: DryOptions = { opacity: 0.85, edge: 0.4, edgeWidth: 0.9, sharpness: 0.6, centreLift: 0.2, granulation: 0.4, granules: 0.15, flow: 0.4, flowScale: 8 };

// ── maquis, phrygana, grass and scrub ────────────────────────────────────────────────────

/** The promontory's pines and maquis, the phrygana and scrub on the slopes and the shoreline's edge, dry grass. */
export function* paintMaquis(p: Painter, rng: Rng): Strokes {
  // the maquis over the promontory's back: dense dark rounded shrubs, hazier toward the temple
  const maquis = MAQUIS.map((m) => {
    const far = Math.max(0, Math.min(1, (1100 - m.x) / 300)) * 0.35;
    const k = (pig: Pigment) => lighten(mix(pig, '#b9c4c6', far * 0.4), far * 0.3);
    return { x: m.x, y: m.y, rx: m.r, ry: m.r * 0.62, lit: k(mix(VEG.maquis, VEG.maquisLit, rng.range(0, 0.4))), dark: k(VEG.maquisDark), a: 0.8 };
  });
  yield* clumps(p, maquis, rng.fork('maquis'), { x: 0, y: 0, w: 30, h: 18 }, CLUMP_DRY);
  yield* paintPromontoryPines(p, rng.fork('pines'));
  // phrygana: low domes, grey-green or summer-rust, with a short shadow to the right
  const shadows = PHRYGANA.map((c) => blob(c.x + c.r * 0.5, c.y + 1, c.r * 1.1, c.r * 0.18, rng, { irregularity: 0.3 }));
  const S = batchLayer(p, padRect(bounds(shadows.flat()), 4), { x: 0, y: 0, w: 30, h: 6 }, 3);
  if (!S.empty) {
    for (const s of shadows) S.fill(s, mix(EARTH.shadow, EARTH.gravelShade, 0.3), 0.45);
    yield* S.dryParts({ opacity: 0.6, edge: 0.05, edgeWidth: 2, sharpness: 0.2, centreLift: 0.05, granulation: 0.2, flow: 0.4, flowScale: 12 });
  }
  const cushions = [
    ...PHRYGANA.map((c) => ({ x: c.x, y: c.y - c.r * 0.42, rx: c.r, ry: c.r * 0.5, lit: c.rust ? mix(VEG.rust, VEG.phrygana, 0.3) : VEG.phrygana, dark: c.rust ? mix(VEG.rust, VEG.phryganaDark, 0.6) : VEG.phryganaDark, a: 0.75 })),
    ...SHORE_CLUMPS.map((c) => ({ ...c, lit: mix(VEG.maquis, VEG.phrygana, 0.4), dark: VEG.maquisDark, a: 0.8 })),
  ];
  yield* clumps(p, cushions, rng.fork('cushions'), { x: 0, y: 0, w: 30, h: 14 }, CLUMP_DRY);
  // their twiggy texture: short flicks out of each dome's top
  const pace = pacer(3);
  for (const c of PHRYGANA) {
    for (let k = 0; k < c.r * 0.7; k++) {
      const a = UP + rng.range(-1.2, 1.2);
      const x = c.x + Math.cos(a) * c.r * 0.7;
      const y = c.y - c.r * 0.42 + Math.sin(a) * c.r * 0.45;
      p.dab({ x, y }, c.rust ? VEG.rust : VEG.phryganaDark, { rng, variant: 'blade', angle: a, length: rng.range(3, 6), width: 1.2, opacity: 0.45, layers: 2 });
    }
    if (pace()) yield;
  }
  // dry golden grass
  for (const [x, y, h] of GRASS) {
    p.grassTuft({ x, y }, { rng, height: h, blades: rng.int(8, 14), spread: h * 0.6, lean: rng.range(-0.15, 0.3), pigments: [lighten(EARTH.straw, 0.12), EARTH.straw, EARTH.strawDark, mix(EARTH.strawDark, VEG.phryganaDark, 0.4)], ground: false, opacity: 0.72 });
    if (pace()) yield;
  }
  yield;
}

/** The promontory's pines: thin dark trunks under flat, broken umbrella crowns, lit on the left. */
function* paintPromontoryPines(p: Painter, rng: Rng): Strokes {
  for (const t of PROMONTORY_PINE_SHAPES) p.stroke(t.trunk, { rng, pigment: mix(VEG.barkDark, VEG.maquisDark, 0.4), width: 2 + t.rx / 24, taper: [0.05, 0.5], opacity: 0.75, wetness: 0.3 });
  yield;
  const pads = PROMONTORY_PINE_SHAPES.flatMap((t) =>
    [[0, 0, 1], [-0.45, 0.25, 0.55], [0.5, 0.15, 0.6]].map(([dx, dy, k]) => ({
      x: t.x + dx! * t.rx,
      y: t.y + dy! * t.ry,
      rx: t.rx * k!,
      ry: t.ry * k! * 0.8,
      lit: mix(VEG.pine, VEG.maquisDark, 0.2),
      dark: shade(VEG.pineDark, 0.1),
      a: 0.85,
    })),
  );
  yield* clumps(p, pads, rng.fork('crowns'), { x: 0, y: 0, w: 40, h: 14 }, { ...CLUMP_DRY, opacity: 0.85 });
}

// ── the olive ────────────────────────────────────────────────────────────────────────────

/** The plan, planned once: the same tree as the species' sprite for `OLIVE_TREE.seed`. */
let planned: { plan: OlivePlan; paint: Rng } | null = null;
function olivePlan(): { plan: OlivePlan; paint: Rng } {
  if (!planned) {
    const r = createRng(OLIVE_TREE.seed);
    const plan = planOlive(r);
    planned = { plan, paint: r.fork('paint') };
  }
  return planned;
}

/** Run `fn` with the olive's box units mapped onto the world (its base on `OLIVE_TREE.base`). */
function inOlive(p: Painter, plan: OlivePlan, fn: () => void): void {
  const k = OLIVE_TREE.scale;
  const b = plan.tree.base;
  p.ctx.save();
  p.ctx.transform(k, 0, 0, k, OLIVE_TREE.base.x - b.x * k, OLIVE_TREE.base.y - b.y * k);
  try {
    fn();
  } finally {
    p.ctx.restore();
  }
}

/**
 * The big olive on the top terrace: its shadow on the gravel, then the species' own layers (limbs,
 * fluted trunk, tuft washes, leaves, the silver leaves and olives), each in a part of its own.
 */
export function* paintOlive(p: Painter, rng: Rng): Strokes {
  const s = OLIVE_SHADOW;
  yield* p.parts.glaze(blob(s.cx, s.cy, s.rx, s.ry, rng, { irregularity: 0.35 }), mix(EARTH.shadow, EARTH.gravelShade, 0.3), { rng, opacity: 0.4, deform: 0.3, spread: 0.3, edge: 0.04, fade: { angle: 0, start: 0.5, amount: 1, ragged: 0.7 } });
  const { plan, paint } = olivePlan();
  const pr = paint.fork('scenery');
  const view = treeView(1, plan.tree.base);
  const arrive = oliveArrivals(1);
  const trunk = plan.tree.branches[0]!;
  inOlive(p, plan, () => {
    const limbs = { base: plan.tree.base, branches: plan.tree.branches.filter((b) => b.order > 1) };
    paintSkeleton(p, limbs, view, pr.fork('limbs'), { pigment: OLIVE_COLOURS.bark, texture: 0.4, modelling: 0.45, textureMin: 6, flare: 0, opacity: 0.88 });
  });
  yield;
  // paper under the trunk, so the cliff and the terrace behind do not show through its wash
  inOlive(p, plan, () => {
    const o = trunkOutline(trunk, plan.trunk, view, branchProgress(trunk, view.tau), arrive.age);
    const side = (k: number, w: readonly number[]) =>
      o.c.map((q, i) => {
        const a = o.c[Math.max(0, i - 1)]!;
        const b = o.c[Math.min(o.c.length - 1, i + 1)]!;
        const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        return { x: q.x - ((b.y - a.y) / l) * w[i]! * 0.85 * k, y: q.y + ((b.x - a.x) / l) * w[i]! * 0.85 * k };
      });
    const shape = [...side(1, o.left), ...side(-1, o.right).reverse()];
    p.ctx.beginPath();
    shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
    p.ctx.closePath();
    p.ctx.fillStyle = '#fffdf8';
    p.ctx.fill();
  });
  // clipped at the foot: the trunk's layers leave a pale box on the gravel below its sole
  p.ctx.save();
  p.ctx.beginPath();
  p.ctx.rect(OLIVE_TREE.base.x - 400, -200, 800, OLIVE_TREE.base.y + 203);
  p.ctx.clip();
  inOlive(p, plan, () => paintOliveTrunk(p, trunk, plan.trunk, view, branchProgress(trunk, view.tau), arrive.age, pr.fork('trunk'), OLIVE_COLOURS, plan.tree.branches.filter((b) => b.parent === trunk.id)));
  p.ctx.restore();
  yield;
  const sc = view.scale;
  inOlive(p, plan, () => {
    const tufts = plan.tufts.map((t) => ({ t, at: viewPt(view, t) }));
    const W = stableLayer(p, padRect(bounds(tufts.map((x) => x.at)), 20 * sc), pr.fork('wash'), softRes(p));
    for (const { t, at } of tufts) {
      const r = createRng(t.id * 97 + 5);
      const rad = t.r * sc;
      W.fill(blob(at.x, at.y, rad, rad * 0.7, r, { points: 10, irregularity: 0.3, rotation: r.range(-0.6, 0.6) }), t.lit > -0.2 ? OLIVE_WASH : OLIVE_SHADE, 0.4);
    }
    W.dry({ opacity: 0.7, edge: 0.12, edgeWidth: 2, sharpness: 0.35, centreLift: 0.15, granulation: 0.15, flow: 0.5, flowScale: 14 });
  });
  yield;
  const leaves = plan.leaves.map((l) => ({ l, k: arrive.leaf(l), at: viewPt(view, l) }));
  const leafDry = { opacity: 0.85, edge: 0.45, edgeWidth: 0.6, sharpness: 0.75, centreLift: 0.25, granulation: 0.12, flow: 0.35, flowScale: 10, darken: 0.2 };
  // each layer in two halves, left and right of the trunk, so no part dries the whole crown at once
  const halves = [(x: { at: Pt }) => x.at.x < plan.tree.base.x, (x: { at: Pt }) => x.at.x >= plan.tree.base.x];
  for (const [h, half] of halves.entries()) {
    inOlive(p, plan, () => paintOliveLeaves(p, leaves.filter((x) => x.l.tone < 2 && half(x)), view, (l) => OLIVE_LEAF[l.tone], pr.fork(`leaves-${h}`), leafDry));
    yield;
  }
  const olives = plan.fruits.map((f) => ({ id: f.id, at: viewPt(view, f), rx: f.r * sc, ry: f.r * 0.74 * sc, rot: f.rot, pigment: fruitColour(arrive.ripe(f)), alpha: 0.95 }));
  for (const [h, half] of halves.entries()) {
    inOlive(p, plan, () => paintOliveLeaves(p, leaves.filter((x) => x.l.tone === 2 && half(x)), view, () => OLIVE_LEAF[2], pr.fork(`leaves-silver-${h}`), { ...leafDry, opacity: 0.92, edge: 0.3, blend: 'source-over' }, olives.filter(half), []));
    yield;
  }
}

// ── the leaning pine ─────────────────────────────────────────────────────────────────────

/** The Aleppo pine: its rock, a reddish scaly trunk lit on the left, crooked branches, open needle pads, cones. */
export function* paintPine(p: Painter, rng: Rng): Strokes {
  yield* p.parts.stone(PINE_ROCK, { rng, pigment: mix(EARTH.stone, EARTH.stoneWarm, 0.3), warm: 0.4, moss: 0.05, ink: 0.2, light: LIGHT });
  const trunk = smoothPath(PINE_TRUNK.map((q) => ({ x: q.x, y: q.y })), 6);
  const hw = (t: number) => 13 * (1 - 0.66 * t) + (t < 0.05 ? (0.05 - t) * 100 : 0);
  const body = ribbon(trunk, hw);
  // paper under the trunk, so the hill and sea behind it do not show through
  p.ctx.save();
  p.ctx.beginPath();
  body.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
  p.ctx.fillStyle = '#fffdf8';
  p.ctx.fill();
  p.ctx.restore();
  const T = batchLayer(p, padRect(bounds(body), 6), { x: 0, y: 0, w: 22, h: 60 }, 4);
  if (!T.empty) {
    T.fill(body, VEG.bark, 0.78);
    // shade on the right flank, away from the sea
    T.fill(ribbon(trunk, (t) => hw(t) * 0.55, (t) => hw(t) * 0.45), VEG.barkDark, 0.45);
    // the scaly plates: short dark fissures across the trunk
    for (let k = 0; k < 90; k++) {
      const i = rng.int(0, trunk.length - 2);
      const q = trunk[i]!;
      const w = hw(i / (trunk.length - 1));
      const u = rng.range(-0.8, 0.8) * w;
      T.fill(blob(q.x + u, q.y, rng.range(1.2, 3.2), rng.range(0.6, 1.3), rng, { points: 6, irregularity: 0.4, rotation: rng.range(-0.3, 0.3) }), VEG.barkDark, 0.6);
    }
    T.flush();
    yield;
    yield* T.dryParts({ opacity: 0.85, edge: 0.4, edgeWidth: 1, sharpness: 0.65, centreLift: 0.12, granulation: 0.5, granules: 0.2, flow: 0.4, flowScale: 9 });
  }
  // the sun on its left flank
  yield* p.parts.glaze(ribbon(trunk, (t) => hw(t) * 0.25, (t) => -hw(t) * 0.55), VEG.barkLit, { rng, opacity: 0.35, deform: 0.05, spread: 0.1, edge: 0.1, blend: 'source-over' });
  for (const b of PINE_BRANCHES) {
    p.stroke(smoothPath(b.map((q) => ({ x: q.x, y: q.y })), 4), { rng, pigment: mix(VEG.bark, VEG.barkDark, 0.4), width: 6, taper: [0.1, 0.8], opacity: 0.85, wetness: 0.35, wobble: 0.4 });
  }
  yield;
  yield* paintNeedles(p, rng.fork('needles'));
  for (let k = 0; k < 9; k++) {
    const pad = PINE_PADS[k % PINE_PADS.length]!;
    const at = { x: pad.x + rng.range(-0.6, 0.6) * pad.rx, y: pad.y + pad.ry * rng.range(0.1, 0.6) };
    p.wash(blob(at.x, at.y, 3.2, 4.4, rng, { points: 10, irregularity: 0.2, rotation: rng.range(-0.4, 0.4) }), VEG.cone, { rng, opacity: 0.8, layers: 3, edge: 0.4, sharpness: 0.7 });
  }
  yield;
}

/** The pine's needle pads: a light, open wash broken into tufts, then fine needles radiating from each twig tip. */
function* paintNeedles(p: Painter, rng: Rng): Strokes {
  const tufts: { at: Pt; r: number; lit: boolean }[] = [];
  for (const pad of PINE_PADS) {
    const n = Math.round((pad.rx * pad.ry) / 26);
    for (let k = 0; k < n; k++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next());
      const y = pad.y + Math.sin(a) * pad.ry * d;
      tufts.push({ at: { x: pad.x + Math.cos(a) * pad.rx * d, y: Math.min(pad.y + pad.ry * 0.5, y) }, r: rng.range(9, 14), lit: Math.sin(a) < 0.1 && Math.cos(a) < 0.4 });
    }
  }
  const area = padRect(bounds(tufts.map((t) => t.at)), 18);
  const W = batchLayer(p, area, { x: 0, y: 0, w: 20, h: 12 }, 4);
  if (!W.empty) {
    for (const t of tufts) W.fill(blob(t.at.x, t.at.y - t.r * 0.2, t.r * 1.1, t.r * 0.62, rng, { points: 12, irregularity: 0.4, scallop: 0.35, scallops: 7 }), t.lit ? mix(VEG.pine, VEG.pineLit, 0.6) : VEG.pine, 0.42);
    W.flush();
    yield;
    yield* W.dryParts({ opacity: 0.75, edge: 0.2, edgeWidth: 1.5, sharpness: 0.4, centreLift: 0.15, granulation: 0.3, flow: 0.5, flowScale: 12 });
  }
  for (const [pass, pig, a] of [[0, VEG.pineDark, 0.3], [1, VEG.pine, 0.45], [2, VEG.pineLit, 0.7]] as const) {
    const N = batchLayer(p, area, { x: 0, y: 0, w: 10, h: 2 }, 3);
    if (N.empty) continue;
    for (const t of tufts) {
      if ((pass === 2 && !t.lit) || (pass === 0 && t.lit)) continue;
      const n = pass === 1 ? 11 : 8;
      for (let k = 0; k < n; k++) {
        const ang = UP + (k / (n - 1) - 0.5) * 2.9 + rng.range(-0.12, 0.12) + (pass === 0 ? 0.35 : 0);
        const len = t.r * rng.range(0.85, 1.35);
        const from = { x: t.at.x, y: t.at.y + 1 };
        const to = { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len * 0.8 };
        N.fill(ribbon([from, to], (u) => 0.6 * (1 - u * 0.7)), jitter(pig, rng, 0.05), a);
      }
    }
    N.flush();
    yield;
    yield* N.dryParts({ opacity: 0.85, edge: 0.4, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.1, granulation: 0.1, flow: 0.2, flowScale: 6 });
  }
}
