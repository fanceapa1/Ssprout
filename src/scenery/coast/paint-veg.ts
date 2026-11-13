/**
 * The coast's vegetation (G4): the promontory's pines and dark maquis, phrygana cushions, dry
 * grass and scrub on the shoreline's edge; the big olive (the `olive` species' tree at scenery
 * scale, ADR 0367); the leaning Aleppo pine. Lit from the left (ADR 0360), on white in world
 * units, in parts (ADR 0226, 0238). docs/systems/scenery.md › Coast › Vegetation.
 */
import { createRng, type Rng } from '../../core/rng';
import { blob, bounds, lighten, mix, padRect, ribbon, type DryOptions, type Painter, type Pigment } from '../../paint';
import { paintOliveLeaves, paintOliveTrunk, trunkOutline } from '../../plants/lib/olive-paint';
import { paintPineBark, paintPineCones, paintPineNeedles, paintPineWash, toneOf } from '../../plants/lib/aleppo-pine-paint';
import { paintSkeleton, softRes, stableLayer, visibleBranches } from '../../plants/lib/tree-paint';
import { branchProgress, treeView, viewPt, type Branch } from '../../plants/lib/tree-structure';
import { ALEPPO_COLOURS, ALEPPO_TIMING, aleppoArrivals, planAleppoPine, type AleppoPinePlan } from '../../plants/species/aleppo-pine';
import { oliveArrivals, planOlive, type OlivePlan } from '../../plants/species/olive';
import type { Pt, Rect } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { batchLayer } from '../oasis/paint-batch';
import { pacer } from '../oasis/paint-pace';
import { EARTH, inView } from './paint-land';
import {
  CLIFF_TOP_SLOT, GRASS, MAQUIS, OLIVE_SHADOW, OLIVE_TREE, PHRYGANA, PINE_ROCK, PINE_TREE, PROMONTORY_PINE_SHAPES, SHORE_CLUMPS,
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
  const all = list.map((c) => ({ c, lobes: lobes(c, rng) })).filter((x) => inView(p, padRect(bounds(x.lobes.flat()), 6)));
  if (!all.length) return;
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
  // a pocket of soil on the cliff top where the tree slot stands, scrub either side of it
  const s = CLIFF_TOP_SLOT;
  if (inView(p, { x: s.x - 60, y: s.y - 20, w: 120, h: 40 })) {
    const r = rng.fork('cliff-pocket');
    yield* p.parts.glaze(blob(s.x + 3, s.y + 1, 36, 7, r, { irregularity: 0.35, flatBottom: 0.3 }), mix(EARTH.soil, EARTH.earth, 0.4), { rng: r, opacity: 0.55, deform: 0.3, spread: 0.25, edge: 0.15, sharpness: 0.4 });
    for (const [dx, k] of [[-40, 1], [44, 0.8], [-22, 0.55], [26, 0.5]] as const) {
      p.grassTuft({ x: s.x + dx, y: s.y + 3 }, { rng: r, height: 9 * k + 4, blades: 7, spread: 9, lean: r.range(-0.2, 0.3), pigments: [EARTH.straw, EARTH.strawDark, VEG.phryganaDark], ground: false, opacity: 0.7 });
    }
  }
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
  for (const [i, c] of PHRYGANA.entries()) {
    if (!inView(p, { x: c.x - c.r * 2, y: c.y - c.r * 2, w: c.r * 4, h: c.r * 3 })) continue;
    const rc = rng.fork(`flicks-${i}`);
    for (let k = 0; k < c.r * 0.7; k++) {
      const a = UP + rc.range(-1.2, 1.2);
      const x = c.x + Math.cos(a) * c.r * 0.7;
      const y = c.y - c.r * 0.42 + Math.sin(a) * c.r * 0.45;
      p.dab({ x, y }, c.rust ? VEG.rust : VEG.phryganaDark, { rng: rc, variant: 'blade', angle: a, length: rc.range(3, 6), width: 1.2, opacity: 0.45, layers: 2 });
    }
    if (pace()) yield;
  }
  // dry golden grass
  for (const [i, [x, y, h]] of GRASS.entries()) {
    if (!inView(p, { x: x - h, y: y - h * 1.3, w: h * 2, h: h * 1.5 })) continue;
    const rg = rng.fork(`grass-${i}`);
    p.grassTuft({ x, y }, { rng: rg, height: h, blades: rg.int(8, 14), spread: h * 0.6, lean: rg.range(-0.15, 0.3), pigments: [lighten(EARTH.straw, 0.12), EARTH.straw, EARTH.strawDark, mix(EARTH.strawDark, VEG.phryganaDark, 0.4)], ground: false, opacity: 0.72 });
    if (pace()) yield;
  }
  yield;
}

/**
 * The promontory's far Aleppo pines, a few strokes each: a slender stem and limbs, then pale soft
 * needle clouds with sky between them, a lit fringe of needles on top; hazier toward the temple.
 */
function* paintPromontoryPines(p: Painter, rng: Rng): Strokes {
  const all = PROMONTORY_PINE_SHAPES.filter((t) => inView(p, { x: t.x - t.rx - 8, y: t.y - t.ry - 8, w: t.rx * 2 + 16, h: t.trunk[0]!.y - t.y + t.ry + 16 }));
  if (!all.length) return;
  const haze = (x: number) => Math.max(0, Math.min(1, (1120 - x) / 260)) * 0.4;
  const far = (pig: Pigment, x: number) => lighten(mix(pig, '#b9c4c6', haze(x)), haze(x) * 0.4);
  for (const t of all) {
    const r = rng.fork(`far-pine-${Math.round(t.x)}`);
    const bark = far(mix(ALEPPO_COLOURS.silver, ALEPPO_COLOURS.red, 0.35), t.x);
    p.stroke(t.trunk, { rng: r, pigment: bark, width: 1.6 + t.rx / 30, taper: [0.1, 0.55], opacity: 0.8, wetness: 0.25, wobble: 0.3 });
    for (const l of t.limbs) p.stroke(l, { rng: r, pigment: bark, width: 1 + t.rx / 50, taper: [0.2, 0.7], opacity: 0.75, wetness: 0.2, wobble: 0.4 });
  }
  yield;
  const clouds = all.flatMap((t) => t.clouds.map((c) => ({ c, x: t.x })));
  const area = padRect(bounds(clouds.flatMap(({ c }) => [{ x: c.x - c.rx, y: c.y - c.ry }, { x: c.x + c.rx, y: c.y + c.ry }])), 8);
  const W = batchLayer(p, area, { x: 0, y: 0, w: 20, h: 10 }, 4);
  if (!W.empty) {
    for (const { c, x } of clouds) {
      const r = rng.fork(`far-cloud-${Math.round(c.x)}-${Math.round(c.y)}`);
      W.fill(blob(c.x, c.y, c.rx, c.ry, r, { points: 12, irregularity: 0.35, scallop: 0.3, scallops: 6, flatBottom: 0.4 }), far(ALEPPO_COLOURS.wash[1], x), 0.5);
      W.fill(blob(c.x + c.rx * 0.15, c.y + c.ry * 0.35, c.rx * 0.8, c.ry * 0.45, r, { points: 10, irregularity: 0.3 }), far(ALEPPO_COLOURS.wash[2], x), 0.4);
      W.lift(blob(c.x - c.rx * 0.25, c.y - c.ry * 0.3, c.rx * 0.45, c.ry * 0.35, r, { points: 8, irregularity: 0.3 }), 0.5);
    }
    W.flush();
    yield;
    yield* W.dryParts({ opacity: 0.85, edge: 0.3, edgeWidth: 1, sharpness: 0.5, centreLift: 0.2, granulation: 0.3, flow: 0.45, flowScale: 8 });
  }
  // a fringe of needle flicks along each cloud's top, lit on the left
  const N = batchLayer(p, area, { x: 0, y: 0, w: 10, h: 2 }, 3);
  if (!N.empty) {
    for (const { c, x } of clouds) {
      const r = rng.fork(`far-flicks-${Math.round(c.x)}-${Math.round(c.y)}`);
      const n = Math.round(c.rx * 0.45) + 2;
      for (let k = 0; k < n; k++) {
        const u = (k / (n - 1)) * 2 - 1;
        const from = { x: c.x + u * c.rx * 0.85, y: c.y - c.ry * Math.sqrt(1 - u * u) * 0.7 };
        const a = UP + u * 0.7 + r.range(-0.25, 0.25);
        const len = c.ry * r.range(0.5, 0.9);
        N.fill(ribbon([from, { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len }], (v) => 0.45 * (1 - v * 0.7)), far(u < 0.2 ? ALEPPO_COLOURS.needle[0] : ALEPPO_COLOURS.needle[1], x), 0.55);
      }
    }
    N.flush();
    yield;
    yield* N.dryParts({ opacity: 0.8, edge: 0.4, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.1, granulation: 0.1, flow: 0.2, flowScale: 6 });
  }
}

// ── the olive ────────────────────────────────────────────────────────────────────────────

/** Everything the olive paints, crown, trunk and shadow, with room to spare. */
const OLIVE_BOX = { x: OLIVE_TREE.base.x - 260, y: OLIVE_TREE.base.y - 500, w: 560, h: 540 };

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
  if (!inView(p, OLIVE_BOX)) return;
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

/** The pruned plan, planned once: the species' tree for `PINE_TREE.seed`, bare below its fork. */
let pinePlanned: { plan: AleppoPinePlan; paint: Rng } | null = null;
export function scenePine(): { plan: AleppoPinePlan; paint: Rng } {
  if (!pinePlanned) {
    const r = createRng(PINE_TREE.seed);
    const plan = planAleppoPine(r, { lean: PINE_TREE.lean });
    pinePlanned = { plan: pruneBelowFork(plan), paint: r.fork('paint') };
  }
  return pinePlanned;
}

/** Drop the side branches below the limbs' fork, with the needles and cones they carry: a cliff pine's bare stem. */
function pruneBelowFork(plan: AleppoPinePlan): AleppoPinePlan {
  const all = plan.tree.branches.filter((b) => b.tag !== 'whorl');
  const byId = new Map(all.map((b) => [b.id, b]));
  const fork = Math.min(...all.filter((b) => b.tag === 'limb').map((b) => b.attach));
  const root = (b: Branch): Branch => (b.order > 1 ? root(byId.get(b.parent)!) : b);
  const keep = (b: Branch) => b.order === 0 || root(b).attach >= fork - 0.02;
  const owner = (q: Pt): Branch => {
    let best = all[0]!;
    let d = Infinity;
    for (const b of all) {
      for (const s of b.pts) {
        const e = (s.x - q.x) ** 2 + (s.y - q.y) ** 2;
        if (e < d) [d, best] = [e, b];
      }
    }
    return best;
  };
  return { ...plan, tree: { base: plan.tree.base, branches: all.filter(keep) }, tufts: plan.tufts.filter((t) => keep(owner(t))), cones: plan.cones.filter((c) => keep(owner(c))) };
}

/** A point of the plan (box units) in the world: its base on `PINE_TREE.base`, `scale` × its units. */
function pineWorld(plan: AleppoPinePlan, q: Pt): Pt {
  const b = plan.tree.base;
  return { x: PINE_TREE.base.x + (q.x - b.x) * PINE_TREE.scale, y: PINE_TREE.base.y + (q.y - b.y) * PINE_TREE.scale };
}

function inPine(p: Painter, plan: AleppoPinePlan, fn: () => void): void {
  const k = PINE_TREE.scale;
  const b = plan.tree.base;
  p.ctx.save();
  p.ctx.transform(k, 0, 0, k, PINE_TREE.base.x - b.x * k, PINE_TREE.base.y - b.y * k);
  try {
    fn();
  } finally {
    p.ctx.restore();
  }
}

/**
 * The shapes the eager code reads (`PINE_TRUNK`, `PINE_BRANCHES`, `PINE_PADS` in `shapes.ts`),
 * from the plan: `veg.test.ts` checks the literals against this.
 */
export function pineShapes(): { trunk: Pt[]; branches: Pt[][]; pads: { x: number; y: number; rx: number; ry: number }[] } {
  const { plan } = scenePine();
  const view = treeView(1, plan.tree.base, ALEPPO_TIMING);
  const w = (q: Pt) => {
    const o = pineWorld(plan, q);
    return { x: Math.round(o.x), y: Math.round(o.y) };
  };
  const sample = (path: readonly Pt[], n: number) => Array.from({ length: n }, (_, i) => w(path[Math.round((i * (path.length - 1)) / (n - 1))]!));
  const vis = visibleBranches(plan.tree, view);
  const trunk = sample(vis.find((v) => v.b.order === 0)!.path, 8);
  const branches = vis.filter((v) => v.b.order === 1 || (v.b.order === 2 && v.b.len * PINE_TREE.scale > 60)).map((v) => sample(v.path, 5));
  // the crown's clouds: tufts gathered round running centres
  const groups: { x: number; y: number; m: { q: Pt; r: number }[] }[] = [];
  for (const t of plan.tufts) {
    const q = pineWorld(plan, t);
    const r = t.r * PINE_TREE.scale;
    const g = groups.find((c) => Math.hypot(c.x - q.x, (c.y - q.y) * 1.3) < 52);
    if (!g) groups.push({ x: q.x, y: q.y, m: [{ q, r }] });
    else {
      g.m.push({ q, r });
      g.x = g.m.reduce((a, o) => a + o.q.x, 0) / g.m.length;
      g.y = g.m.reduce((a, o) => a + o.q.y, 0) / g.m.length;
    }
  }
  const pads = groups
    .filter((g) => g.m.length >= 3)
    .map((g) => ({
      x: Math.round(g.x),
      y: Math.round(g.y),
      rx: Math.round(Math.max(...g.m.map((o) => Math.abs(o.q.x - g.x) + o.r))),
      ry: Math.round(Math.max(...g.m.map((o) => Math.abs(o.q.y - g.y) + o.r * 0.6))),
    }))
    .filter((d) => d.x + d.rx > 0);
  return { trunk, branches, pads };
}

/** Everything the pine paints, crown, trunk, rock and shadow, with room to spare. */
const PINE_BOX = { x: -240, y: 0, w: 620, h: 840 };

/**
 * The Aleppo pine on its rock at the beach's west end (ADR 0380): the species' own tree, bare
 * below its fork, leaning out over the left edge. Its shadow and rock, then the species' layers
 * (limbs, the reddish bark, cloud washes, cones, needles), each in parts of its own.
 */
export function* paintPine(p: Painter, rng: Rng): Strokes {
  if (!inView(p, PINE_BOX)) return;
  const foot = PINE_TREE.base;
  yield* p.parts.glaze(blob(foot.x + 96, foot.y + 7, 120, 9, rng, { irregularity: 0.35 }), mix(EARTH.shadow, EARTH.gravelShade, 0.3), { rng, opacity: 0.38, deform: 0.3, spread: 0.3, edge: 0.04, fade: { angle: 0, start: 0.4, amount: 1, ragged: 0.7 } });
  yield* p.parts.stone(PINE_ROCK, { rng, pigment: mix(EARTH.stone, EARTH.stoneWarm, 0.3), warm: 0.4, moss: 0.05, ink: 0.2, light: LIGHT });
  const { plan, paint } = scenePine();
  const pr = paint.fork('scenery');
  const view = treeView(1, plan.tree.base, ALEPPO_TIMING);
  const arrive = aleppoArrivals(1);
  const style = { pigment: ALEPPO_COLOURS.silver, texture: 0.45, modelling: 0.5, textureMin: 4, flare: 0.3, wobble: 0.3, skipTags: ['whorl'] };
  const trunk = visibleBranches(plan.tree, view, style).find((v) => v.b.order === 0)!;
  // paper under the trunk, so the sea and the far hill do not show through its washes
  inPine(p, plan, () => {
    p.ctx.beginPath();
    ribbon(trunk.path, (t) => trunk.hw(t) * 0.85).forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
    p.ctx.closePath();
    p.ctx.fillStyle = '#fffdf8';
    p.ctx.fill();
  });
  inPine(p, plan, () => paintSkeleton(p, plan.tree, view, pr.fork('limbs'), style));
  yield;
  inPine(p, plan, () => paintPineBark(p, trunk.path, trunk.hw, arrive.age, ALEPPO_COLOURS, pr.fork('bark'), 0.62));
  yield;
  // the scenery's accent through the margin's lift: the lower trunk warmer, its right flank shaded
  const low = trunk.path.slice(0, Math.round(trunk.path.length * 0.62)).map((q) => pineWorld(plan, q));
  const hw = (t: number) => trunk.hw(t * 0.62) * PINE_TREE.scale;
  const A = batchLayer(p, padRect(bounds(low), hw(0) + 6), { x: 0, y: 0, w: 20, h: 40 }, 4);
  if (!A.empty) {
    // staggered washes, so the red fades up the stem without a band
    for (let k = 0; k < 5; k++) A.fill(ribbon(low.slice(0, Math.max(3, Math.round(low.length * (0.4 + k * 0.15)))), (t) => hw(t) * 0.92), VEG.bark, 0.24);
    A.fill(ribbon(low, (t) => -hw(t) * 0.15, (t) => hw(t) * 0.92), VEG.barkDark, 0.42);
    // scaly plates: short dark fissures across the lower trunk
    const r = rng.fork('plates');
    for (let k = 0; k < 70; k++) {
      const i = r.int(0, Math.round(low.length * 0.8));
      const q = low[i]!;
      const w = hw(i / (low.length - 1));
      A.fill(blob(q.x + r.range(-0.75, 0.75) * w, q.y, r.range(1.4, 3.4), r.range(0.6, 1.2), r, { points: 6, irregularity: 0.4, rotation: r.range(-0.3, 0.3) }), VEG.barkDark, 0.55);
    }
    A.flush();
    yield;
    yield* A.dryParts({ opacity: 0.85, edge: 0.2, edgeWidth: 1, sharpness: 0.5, centreLift: 0.1, granulation: 0.45, granules: 0.2, flow: 0.4, flowScale: 9 });
  }
  // the crown's marks at `marks` × the species' size on the scaled tree: finer, with sky between the tufts
  const m = PINE_TREE.marks;
  const tufts = plan.tufts.map((t) => ({ t, k: arrive.tuft(t), at: pineWorld(plan, t) }));
  const xs = tufts.map((x) => x.at.x).sort((a, b) => a - b);
  const cut = [xs[Math.floor(xs.length / 3)]!, xs[Math.floor((xs.length * 2) / 3)]!] as const;
  const thirds = [(x: { at: Pt }) => x.at.x < cut[0], (x: { at: Pt }) => x.at.x >= cut[0] && x.at.x < cut[1], (x: { at: Pt }) => x.at.x >= cut[1]];
  for (const [i, third] of thirds.entries()) {
    paintPineWash(p, tufts.filter(third), m, ALEPPO_COLOURS, pr.fork(`wash-${i}`), 0.85);
    yield;
  }
  const cones = plan.cones.map((c) => ({ c, k: arrive.cone(c), at: pineWorld(plan, c) }));
  paintPineCones(p, cones, m * 0.8, ALEPPO_COLOURS, pr.fork('cones'));
  yield;
  const dry = { opacity: 0.92, edge: 0.4, edgeWidth: 0.5, sharpness: 0.8, centreLift: 0.2, granulation: 0.12, flow: 0.35, flowScale: 10, darken: 0.25 };
  for (const [i, third] of thirds.entries()) {
    paintPineNeedles(p, tufts.filter(third), m, (t) => ALEPPO_COLOURS.needle[toneOf(t.lit)], pr.fork(`needles-${i}`), dry);
    yield;
  }
}
