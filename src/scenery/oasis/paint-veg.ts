/**
 * The oasis's vegetation (O4): the palmeraie behind the basin in three storeys (palms over fruit
 * trees over crops) and the big date palms on the right, the same tree as the date-palm species
 * (devlog 106), simplified with distance. Lit from the upper right (ADR 0300), painted on white
 * in world units, in parts (ADR 0226, 0238). docs/systems/scenery.md › Oasis › Vegetation.
 */
import { createRng, type Rng } from '../../core/rng';
import { PAPER_WHITE, WetLayer, blob, rgba, bounds, lighten, mix, padRect, ribbon, shade, type DryOptions, type FoliagePigments, type Painter, type Pigment } from '../../paint';
import { along, paintDates, paintLeafBases, pinnaOutline, rachisPath, type DateMark, type LeafBase, type RachisMark } from '../../scene/palm-paint';
import type { Pt, Rect } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { BIG_PALMS, GROVE_FROM } from './layout';

const UP = -Math.PI / 2;

/** The date palm's own colours (species `date-palm`), and the warm haze the grove fades into. */
export const PALM = {
  trunk: '#9a7a56',
  trunkShade: '#6b5440',
  trunkPale: '#dcc9a6',
  light: '#b5b98a',
  mid: '#7f9268',
  shadow: '#5f7d6e',
  dark: '#4c6458',
  dryLight: '#e3c98a',
  dryMid: '#c9a560',
  rachis: '#c4bf8c',
  stalk: '#d9883e',
  dateYellow: '#e5c05a',
  dateAmber: '#c98a3e',
  dateBrown: '#7a4a32',
  haze: '#d6c7b6',
} satisfies Record<string, Pigment>;

/** The fruit trees under the palms: fig, pomegranate and olive (docs/research/oasis-biome.md §1). */
const FIG: FoliagePigments = { light: '#b4bd6e', mid: '#7f9450', shadow: '#566a48', dark: '#3f4f3c' };
const POMEGRANATE: FoliagePigments = { light: '#9fae62', mid: '#66804a', shadow: '#4a6046', dark: '#34453a' };
const OLIVE: FoliagePigments = { light: '#bcc2a0', mid: '#8f9a7c', shadow: '#68746a', dark: '#4e5852' };
const CROPS: readonly Pigment[] = ['#a9b862', '#8fa456', '#c2c47a'];

/** Toward the warm haze by `k` (0 near … 1 lost). */
export function haze(p: Pigment, k: number): Pigment {
  return k <= 0 ? p : lighten(mix(p, PALM.haze, k * 0.6), k * 0.25);
}

// light from the upper right, as the rock's (ADR 0300)
const LIGHT = -0.8;

export interface PalmFrond {
  path: Pt[];
  side: number;
  age: number;
  front: boolean;
  dry: number;
  len: number;
}

/** A palm's plan: its trunk (base first), width, fronds, and the crown's outline for daylight. */
export interface PalmShape {
  base: Pt;
  top: Pt;
  trunk: Pt[];
  width: number;
  fronds: PalmFrond[];
  crown: Pt[];
  /** 0 the nearest … 1 the haziest */
  far: number;
}

function trunkPath(base: Pt, top: Pt, bow: number): Pt[] {
  const ctrl = { x: (base.x + top.x) / 2 + bow, y: (base.y + top.y) / 2 };
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    const a = (1 - t) * (1 - t);
    const b = 2 * t * (1 - t);
    const c = t * t;
    return { x: a * base.x + b * ctrl.x + c * top.x, y: a * base.y + b * ctrl.y + c * top.y };
  });
}

/** The crown's outline: the furthest reach of its fronds in each of 24 directions round the top. */
function crownOutline(top: Pt, fronds: readonly PalmFrond[], pad: number): Pt[] {
  const n = 24;
  const reach = new Array<number>(n).fill(pad);
  for (const f of fronds) {
    for (const q of f.path) {
      const a = Math.atan2(q.y - top.y, q.x - top.x);
      const i = ((Math.round((a / (Math.PI * 2)) * n) % n) + n) % n;
      reach[i] = Math.max(reach[i]!, Math.hypot(q.x - top.x, q.y - top.y) + pad);
    }
  }
  // fill gaps between sectors so the outline stays closed and round
  const r = reach.map((v, i) => Math.max(v, (reach[(i + n - 1) % n]! + reach[(i + 1) % n]!) * 0.4));
  return r.map((v, i) => ({ x: top.x + Math.cos((i / n) * Math.PI * 2) * v, y: top.y + Math.sin((i / n) * Math.PI * 2) * v }));
}

/** Plan a palm from its base to its crown: `len` is its longest frond. */
export function planPalm(base: Pt, top: Pt, len: number, width: number, rng: Rng, far = 0): PalmShape {
  const trunk = trunkPath(base, top, rng.range(-0.08, 0.08) * (base.y - top.y));
  const fronds: PalmFrond[] = [];
  const n = rng.int(20, 26);
  for (let i = 0; i < n; i++) {
    const age = i / (n - 1);
    const side = i === 0 ? (rng.chance(0.5) ? 1 : -1) : i % 2 === 0 ? 1 : -1;
    const tilt = (0.1 + 1.7 * age ** 0.9) * rng.range(0.82, 1.12) + rng.gaussian(0, 0.06);
    const toward = i > 2 && rng.chance(0.3);
    const l = len * rng.range(0.75, 1) * (1 - 0.2 * (1 - age) ** 2) * (toward ? rng.range(0.5, 0.72) : 1);
    const path = rachisPath({ from: top, heading: UP + side * Math.min(1.85, tilt), length: l, bend: (0.25 + 1.9 * age ** 1.5) * rng.range(0.85, 1.15) * (toward ? 1.3 : 1), side }, 14);
    fronds.push({ path, side, age, front: i === 0 || toward || rng.chance(0.5), dry: age > 0.9 && !toward ? rng.range(0.45, 0.85) : 0, len: l });
  }
  return { base, top, trunk, width, fronds, crown: crownOutline(top, fronds, len * 0.12), far };
}

/** The big palms on the right (`BIG_PALMS`), planned from fixed seeds so daylight reads the same shapes. */
export const BIG_PALM_SHAPES: readonly PalmShape[] = BIG_PALMS.map((b, i) => planPalm(b.base, b.top, 66 * b.size, 14 * b.size, createRng(`oasis-big-palm-${i}`)));

/** The grove's palms, back row first: hazy and small behind, warmer and nearer in front. */
export const GROVE_PALMS: readonly PalmShape[] = (() => {
  const rng = createRng('oasis-grove-palms');
  const rows = [
    { step: [38, 64], top: [292, 322], base: 452, len: [40, 52], far: 0.75 },
    { step: [70, 110], top: [246, 292], base: 462, len: [56, 74], far: 0.4 },
  ];
  const out: PalmShape[] = [];
  for (const row of rows) {
    for (let x = GROVE_FROM + rng.range(-10, 30); x < 1650; x += rng.range(row.step[0]!, row.step[1]!)) {
      const top = { x, y: rng.range(row.top[0]!, row.top[1]!) };
      const base = { x: x + rng.range(-16, 16), y: row.base + rng.range(-4, 6) };
      const len = rng.range(row.len[0]!, row.len[1]!);
      out.push(planPalm(base, top, len, len * 0.12, rng.fork(`palm-${Math.round(x)}`), row.far));
    }
  }
  return out;
})();

/** The fruit-tree storey: rounded masses along the grove's floor, behind its wall. */
export const GROVE_TREES: readonly { at: Pt; r: number; kind: 'fig' | 'pomegranate' | 'olive' }[] = (() => {
  const rng = createRng('oasis-grove-trees');
  const kinds = ['fig', 'pomegranate', 'olive'] as const;
  const out: { at: Pt; r: number; kind: 'fig' | 'pomegranate' | 'olive' }[] = [];
  for (let x = GROVE_FROM - 6; x < 1640; x += rng.range(46, 78)) {
    out.push({ at: { x, y: rng.range(430, 446) }, r: rng.range(30, 46), kind: kinds[rng.int(0, 2)]! });
  }
  return out;
})();

/** The grove's outline for daylight: from the far palms' crowns down to the grove wall. */
export const GROVE_OUTLINE: readonly Pt[] = (() => {
  const top: Pt[] = [];
  for (let x = GROVE_FROM - 20; x <= 1640; x += 20) {
    let y = 470;
    for (const s of GROVE_PALMS) for (const q of s.crown) if (Math.abs(q.x - x) < 12) y = Math.min(y, q.y);
    top.push({ x, y });
  }
  return [...top, { x: 1640, y: 486 }, { x: GROVE_FROM - 20, y: 486 }];
})();

/** The shapes daylight (O5) shades: each big palm's trunk, crown and width, and the grove. */
export const VEG_SHAPES = { bigPalms: BIG_PALM_SHAPES, grovePalms: GROVE_PALMS, groveTrees: GROVE_TREES, grove: GROVE_OUTLINE } as const;

/** Paper over `shape`, so nothing painted earlier shows through it. */
function reserve(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
  p.ctx.fillStyle = rgba(PAPER_WHITE);
  p.ctx.fill();
  p.ctx.restore();
}

function layerOver(p: Painter, area: Rect, rng: Rng, res?: number): WetLayer {
  return new WetLayer(p.ctx, area, { ...p.env, rng }, res);
}

const softRes = (p: Painter): number | undefined => (p.quality === 'high' ? undefined : p.quality === 'draft' ? 0.45 : 0.6);

/** The frond's tone: lit where it faces the sun on the right, cool where it turns away or hangs low. */
function frondPigment(f: PalmFrond, t: number, far: number): Pigment {
  const lit = f.side > 0 ? 0.15 : 0.6;
  const deep = f.front ? 0 : 0.4;
  const green = mix(mix(PALM.light, PALM.mid, Math.min(1, lit + t)), PALM.shadow, deep);
  return haze(mix(green, mix(PALM.dryLight, PALM.dryMid, t), f.dry), far);
}

interface FrondMarks {
  wash: { poly: Pt[]; pig: Pigment; a: number }[];
  back: { poly: Pt[]; pig: Pigment; a: number }[];
  front: { poly: Pt[]; pig: Pigment; a: number }[];
}

/** One palm's crown as polygons: soft masses along each rachis, and its V-set leaflets and ribs. */
function crownMarks(s: PalmShape, rng: Rng, detail: number, out: FrondMarks): void {
  for (const f of s.fronds) {
    const P = f.len * 0.19;
    const hw = (t: number) => P * 0.55 * Math.sin(Math.PI * Math.min(1, 0.06 + t * 0.94)) ** 0.7;
    out.wash.push({ poly: ribbon(f.path.slice(1), hw), pig: haze(mix(mix(PALM.mid, PALM.shadow, f.front ? 0.25 : 0.6), PALM.dryMid, f.dry), s.far), a: 0.3 });
    const list = f.front ? out.front : out.back;
    const count = Math.max(6, Math.round((f.len / 5) * detail));
    for (let j = 0; j < count; j++) {
      const t = 0.08 + (0.9 * j) / (count - 1) + rng.range(-0.01, 0.01);
      const { at, heading } = along(f.path, t);
      const sh = (0.2 + 0.8 * Math.sin(Math.PI * (0.1 + 0.85 * t)) ** 0.8) * (0.4 + 0.6 * Math.min(1, t / 0.24));
      for (const sgn of [-1, 1]) {
        const spread = (0.42 + 0.32 * ((j + (sgn > 0 ? 1 : 0)) % 2)) * rng.range(0.85, 1.15);
        const angle = heading + sgn * spread * (1 - 0.25 * t);
        const up = Math.sin(angle) < -0.15;
        const tone = Math.min(1, Math.max(0, (up ? 0.1 : 0.55) + rng.range(-0.15, 0.2) + 0.3 * f.age));
        const len = P * sh * rng.range(0.82, 1.12) / Math.max(0.6, detail);
        const width = (1.6 + f.len / 110) / Math.max(0.6, detail);
        list.push({ poly: pinnaOutline(at, angle, len, width, (0.06 + 0.12 * f.age) * (f.dry > 0.3 ? 2 : 1)), pig: frondPigment(f, tone, s.far), a: (f.front ? 0.78 : 0.6) * (1 - 0.35 * f.dry * rng.range(0, 1)) });
      }
    }
    list.push({ poly: ribbon(f.path, (t) => (1.1 + f.len / 120) * (1 - 0.75 * t) + 0.2), pig: haze(mix(mix(PALM.rachis, PALM.mid, f.front ? 0.1 : 0.5), PALM.dryMid, f.dry), s.far), a: 0.75 });
  }
}

/** The trunk as a tapering column, its left flank turned from the sun. */
function trunkMarks(L: WetLayer, s: PalmShape, k: number): void {
  const hw = (t: number) => (s.width / 2) * (1.05 - 0.25 * t + 0.5 * Math.max(0, 0.06 - t) * 16);
  const body = haze(PALM.trunk, s.far);
  const dark = haze(PALM.trunkShade, s.far);
  L.fill(ribbon(s.trunk, hw), body, 0.6 * k);
  L.fill(ribbon(s.trunk, (t) => hw(t) * 0.5, (t) => -hw(t) * 0.5), dark, 0.45 * k);
  L.fill(ribbon(s.trunk, (t) => hw(t) * 0.2, (t) => -hw(t) * 0.78), dark, 0.35 * k);
}

const WASH_DRY: DryOptions = { opacity: 0.72, edge: 0.05, edgeWidth: 3, sharpness: 0.12, centreLift: 0.1, granulation: 0.25, flow: 0.6, flowScale: 16 };
const FROND_DRY: DryOptions = { opacity: 0.88, edge: 0.4, edgeWidth: 0.6, sharpness: 0.8, centreLift: 0.15, granulation: 0.15, flow: 0.3, flowScale: 10, darken: 0.2 };
const TRUNK_DRY: DryOptions = { opacity: 0.88, edge: 0.35, edgeWidth: 1.2, sharpness: 0.65, centreLift: 0.12, granulation: 0.45, flow: 0.5, flowScale: 9, darken: 0.2 };

function* fillAndDry(p: Painter, marks: readonly { poly: Pt[]; pig: Pigment; a: number }[], rng: Rng, dry: DryOptions, res?: number): Strokes {
  const live = marks.filter((m) => m.poly.length > 2);
  if (!live.length) return;
  const L = layerOver(p, padRect(bounds(live.flatMap((m) => m.poly)), 6), rng, res);
  if (L.empty) return;
  for (const m of live) L.fill(m.poly, m.pig, m.a);
  yield;
  yield* L.dryParts(dry);
}

/** The diamond lattice of old leaf bases up a trunk (the species' helper), finer with distance. */
function leafBases(s: PalmShape, rowScale: number): LeafBase[] {
  const out: LeafBase[] = [];
  const cum = [0];
  for (let i = 1; i < s.trunk.length; i++) cum.push(cum[i - 1]! + Math.hypot(s.trunk[i]!.x - s.trunk[i - 1]!.x, s.trunk[i]!.y - s.trunk[i - 1]!.y));
  const total = cum.at(-1)!;
  const row = 8.6 * rowScale;
  const hw = (t: number) => (s.width / 2) * (1.15 - 0.25 * t);
  for (let i = 0; i * row < total - row; i++) {
    const u = i * row + row * 0.5;
    const { at, heading } = along(s.trunk, u / total);
    const half = hw(u / total);
    for (let c = -3; c <= 3; c++) {
      const th = (c + (i % 2) * 0.5) * (Math.PI / 3.4);
      if (Math.abs(th) > 1.38) continue;
      const off = Math.sin(th) * half;
      const ux = Math.cos(heading + Math.PI / 2);
      const uy = Math.sin(heading + Math.PI / 2);
      out.push({ at: { x: at.x - ux * off, y: at.y - uy * off }, heading, hw: half * 0.5 * (0.35 + 0.65 * Math.cos(th)), hh: row * 0.95, flank: Math.sin(th), k: 1, id: i * 16 + c + 4 });
    }
  }
  return out;
}

// ── the grove ─────────────────────────────────────────────────────────────────────────────

/**
 * The palmeraie behind the basin: a hazy back row of palms, a nearer row, the rounded fruit trees
 * under them and the crops as soft green bands on the grove's floor, hazier at the back.
 */
export function* paintGrove(p: Painter, rng: Rng): Strokes {
  // the shade under the canopy: a soft, warm-green floor the trees stand in
  const floor: Pt[] = [{ x: GROVE_FROM - 40, y: 404 }, { x: 1640, y: 396 }, { x: 1640, y: 480 }, { x: GROVE_FROM - 30, y: 482 }];
  yield* p.parts.wetInWet(floor, haze(mix(PALM.mid, '#c2b07a', 0.5), 0.5), mix(PALM.shadow, '#8a7a5a', 0.3), { rng, angle: Math.PI / 2, split: 0.5, softness: 0.7, opacity: 0.45, deform: 0.12, spread: 0.2, edge: 0.05, granulation: 0.3, fade: { angle: -Math.PI / 2, start: 0.45, amount: 1, ragged: 0.7 } });
  for (const [r, far] of [[0, 0.75], [1, 0.4]] as const) {
    const row = GROVE_PALMS.filter((s) => s.far === far);
    const L = layerOver(p, padRect(bounds(row.flatMap((s) => s.trunk)), 10), rng.fork(`trunks-${r}`));
    if (!L.empty) {
      for (const s of row) trunkMarks(L, s, 1);
      yield* L.dryParts(TRUNK_DRY);
    }
    const marks: FrondMarks = { wash: [], back: [], front: [] };
    for (const s of row) crownMarks(s, rng.fork(`crown-${r}-${Math.round(s.top.x)}`), far > 0.5 ? 0.45 : 0.6, marks);
    yield* fillAndDry(p, marks.wash, rng.fork(`wash-${r}`), WASH_DRY, softRes(p));
    yield* fillAndDry(p, [...marks.back, ...marks.front], rng.fork(`fronds-${r}`), { ...FROND_DRY, edge: 0.3 });
  }
  // the fruit trees: olive silver-grey, fig bright, pomegranate dark and glossy
  const kinds = { fig: FIG, pomegranate: POMEGRANATE, olive: OLIVE };
  for (const t of GROVE_TREES) {
    const pig = kinds[t.kind];
    const k = (t.at.y - 430) / 16;
    const warm: FoliagePigments = { light: haze(pig.light, 0.25 - k * 0.15), mid: haze(pig.mid, 0.2 - k * 0.15), shadow: haze(pig.shadow, 0.15), dark: pig.dark };
    yield* p.parts.foliageClump(t.at, t.r, warm, { rng: rng.fork(`tree-${Math.round(t.at.x)}`), light: LIGHT, flatness: 0.62, shadow: 0.7, opacity: 0.78, gaps: 0.25, dabSize: 0.24 });
  }
  // the understorey crops: soft green bands, barley and alfalfa, on the floor before the wall
  for (let i = 0; i < 3; i++) {
    const y = 452 + i * 8;
    const band: Pt[] = [];
    for (let x = GROVE_FROM - 20; x <= 1640; x += 40) band.push({ x, y: y + Math.sin(x / 70 + i * 2) * 2 });
    const poly = [...band, ...band.slice().reverse().map((q) => ({ x: q.x, y: q.y + 7 + i * 2 }))];
    yield* p.parts.glaze(poly, haze(CROPS[i]!, 0.3 - i * 0.12), { rng, opacity: 0.4, deform: 0.2, spread: 0.3, edge: 0.15, granulation: 0.3, fade: { angle: 0, start: 0.85, amount: 0.6, ragged: 0.8 } });
  }
  for (let x = GROVE_FROM; x < 1630; x += rng.range(8, 16)) {
    p.dab({ x, y: rng.range(458, 474) }, haze(CROPS[rng.int(0, 2)]!, 0.2), { rng, variant: 'blade', angle: UP + rng.range(-0.4, 0.4), length: rng.range(6, 11), width: 2.2, opacity: 0.45, layers: 2 });
  }
  yield;
}

// ── the big palms ─────────────────────────────────────────────────────────────────────────

/** The big date palms on the right, cut by the top edge: trunks with their lattice, wet crowns, dates on the near ones. */
export function* paintBigPalms(p: Painter, rng: Rng): Strokes {
  // back to front: the small notch palm, then the tallest
  const order = BIG_PALM_SHAPES.map((s, i) => ({ s, i, size: BIG_PALMS[i]!.size })).sort((a, b) => a.s.base.y - b.s.base.y);
  for (const { s, i, size } of order) {
    const r = rng.fork(`palm-${i}`);
    // its shadow on the ground, cast to the left
    yield* p.parts.glaze(blob(s.base.x - 30 * size, s.base.y + 4, 46 * size, 7 * size, r, { irregularity: 0.3 }), mix('#9e7183', '#8a6a4e', 0.4), { rng: r, opacity: 0.3, deform: 0.3, spread: 0.3, edge: 0.05, fade: { angle: Math.PI, start: 0.4, amount: 1, ragged: 0.6 } });
    const marks: FrondMarks = { wash: [], back: [], front: [] };
    crownMarks(s, r.fork('crown'), 1, marks);
    yield* fillAndDry(p, marks.wash, r.fork('wash'), WASH_DRY, softRes(p));
    yield* fillAndDry(p, marks.back, r.fork('back'), FROND_DRY);
    const T = layerOver(p, padRect(bounds(s.trunk), s.width + 10), r.fork('trunk'));
    if (!T.empty) {
      // paper under the trunk first, so the grove behind it does not show through
      reserve(p, ribbon(s.trunk, (t) => (s.width / 2) * (1.05 - 0.25 * t)));
      yield* p.parts.glaze(blob(s.base.x, s.base.y - 2, s.width * 1.1, s.width * 0.28, r, { irregularity: 0.3 }), mix(PALM.trunkShade, '#9e7183', 0.3), { rng: r, opacity: 0.45, deform: 0.2, spread: 0.3, edge: 0.05 });
      trunkMarks(T, s, 1);
      yield* T.dryParts(TRUNK_DRY);
      paintLeafBases(p, leafBases(s, s.width / 18), r.fork('bases'), { dark: shade(PALM.trunkShade, 0.15), pale: PALM.trunkPale });
      // the sun on its right flank
      const lit = ribbon(s.trunk, (t) => s.width * 0.14 * (1 - 0.3 * t), (t) => s.width * 0.34 * (1 - 0.25 * t));
      yield* p.parts.glaze(lit, PALM.trunkPale, { rng: r, opacity: 0.4, deform: 0.05, spread: 0.1, edge: 0.1, blend: 'source-over' });
    }
    // the crown's heart: sheathing frond bases where the fronds meet the trunk
    const heart: { poly: Pt[]; pig: Pigment; a: number }[] = [];
    for (let h = 0; h < 7; h++) {
      const a = UP + (h / 6 - 0.5) * 2.6 + r.range(-0.15, 0.15);
      const l = r.range(9, 15) * size * 0.9;
      const path = [{ x: s.top.x - Math.cos(a) * 2, y: s.top.y + 4 }, { x: s.top.x + Math.cos(a) * l * 0.5, y: s.top.y + Math.sin(a) * l * 0.5 }, { x: s.top.x + Math.cos(a) * l, y: s.top.y + Math.sin(a) * l }];
      heart.push({ poly: ribbon(path, (t) => 3.2 * size * 0.8 * (1 - t * 0.7)), pig: h % 2 ? PALM.trunkShade : mix(PALM.trunk, PALM.dark, 0.4), a: 0.6 });
    }
    yield* fillAndDry(p, heart, r.fork('heart'), { opacity: 0.8, edge: 0.3, edgeWidth: 1, sharpness: 0.5, centreLift: 0.1, granulation: 0.4, flow: 0.4, flowScale: 8 });
    yield* fillAndDry(p, marks.front, r.fork('front'), { ...FROND_DRY, blend: 'source-over' });
    if (size >= 2.8) {
      paintBunches(p, s, size, r.fork('dates'));
      yield;
    }
  }
}

/** Date bunches hanging under a near crown: amber stalks, strands, the dates ripening. */
function paintBunches(p: Painter, s: PalmShape, size: number, rng: Rng): void {
  const k = size / 2.2;
  const stalks: RachisMark[] = [];
  const dates: DateMark[] = [];
  const n = rng.int(3, 4);
  for (let c = 0; c < n; c++) {
    const side = c % 2 ? 1 : -1;
    const stalk = rachisPath({ from: { x: s.top.x + side * rng.range(2, 8) * k, y: s.top.y + rng.range(2, 8) * k }, heading: side > 0 ? rng.range(-0.5, 0.3) : Math.PI - rng.range(-0.5, 0.3), length: rng.range(18, 34) * k, bend: rng.range(0.9, 1.5), side }, 8);
    stalks.push({ path: stalk, width: 1.6 * k, pigment: mix(PALM.stalk, PALM.trunk, 0.4), alpha: 0.75 });
    const end = stalk.at(-1)!;
    for (let st = 0; st < 7; st++) {
      const a = Math.PI / 2 + rng.range(-0.5, 0.5) + side * 0.1;
      const sl = rng.range(18, 28) * k;
      const strand: Pt[] = [end, { x: end.x + Math.cos(a) * sl * 0.5, y: end.y + Math.sin(a) * sl * 0.5 }, { x: end.x + Math.cos(a) * sl, y: end.y + Math.sin(a) * sl }];
      stalks.push({ path: strand, width: 0.5 * k, pigment: mix(PALM.stalk, PALM.trunk, 0.35), alpha: 0.35 });
      for (let d = 0; d < 5; d++) {
        const q = along(strand, 0.25 + d * 0.18).at;
        const ripe = rng.range(0.3, 1);
        dates.push({ at: { x: q.x + (d % 2 ? 1.7 : -1.7) * k, y: q.y + 1.5 * k }, angle: Math.PI / 2 + rng.range(-0.4, 0.4), size: 6 * k * rng.range(0.85, 1.1), pigment: mix(mix(PALM.dateYellow, PALM.dateAmber, ripe), PALM.dateBrown, ripe * 0.25), alpha: 0.85 });
      }
    }
  }
  paintDates(p, stalks, dates, rng);
}

