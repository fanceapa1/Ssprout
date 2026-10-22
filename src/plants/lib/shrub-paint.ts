/**
 * Painting helpers shared by the tier-3 flowering shrubs (docs/systems/plants-species-b.md).
 *
 * Every element carries its own `seed`; it is painted with a fresh `createRng(seed)` stream,
 * so the same element looks the same at every growth step and only its size, extent, opening
 * and colour change with growth. Nothing here consumes the species rng.
 *
 * Speed: a wet layer's drying pass costs a pixel read-back, so marks that belong together are
 * batched into a few shared layers (all stems, the whole foliage mass, one petal ring across
 * every flower) instead of one layer per mark — see ADR 0065.
 */
import { createRng, type Rng } from '../../core/rng';
import {
  PIGMENTS,
  blob,
  bounds,
  dabDry,
  darken,
  deformPolygon,
  foliageLayout,
  jitter,
  layerAlpha,
  lighten,
  mix,
  padRect,
  paintDab,
  ribbon,
  shade,
  smoothPath,
  type DabOptions,
  type DryOptions,
  type FoliagePigments,
  type Painter,
  type Pigment,
  type Pt,
  type Rect,
  type WetLayer,
} from '../../paint';
import { dabShape } from '../../paint/primitives';
import type { SpeciesDrawOptions } from '../types';
import { lerp, ramp } from './shrub-growth';
import { partialPath, petalVector, type Branch, type Clump, type Leaf } from './shrub-structure';

export type { Clump, Leaf } from './shrub-structure';

// ---------------------------------------------------------------------------------------------
// plant space and small utilities

/**
 * Paint in plant units: origin at the plant's base (the anchor), one unit = one world unit at
 * slot scale 1. Restores the context afterwards.
 */
export function inPlantSpace(
  p: Painter,
  opts: SpeciesDrawOptions,
  def: { size: { w: number; h: number }; anchor: { x: number; y: number } },
  paint: () => void,
): void {
  const k = Math.min(opts.w / def.size.w, opts.h / def.size.h);
  p.ctx.save();
  p.ctx.translate(opts.w * def.anchor.x, opts.h * def.anchor.y);
  p.ctx.scale(k, k);
  try {
    paint();
  } finally {
    p.ctx.restore();
  }
}

/** Bounding rect of point sets, padded. */
export function areaOf(sets: readonly (readonly Pt[])[], pad: number): Rect {
  return padRect(bounds(sets.flat()), pad);
}

export interface RibbonOptions {
  /** taper length at the start / end as fractions (default [0.05, 0.5]) */
  taper?: [number, number];
  /** width left at the very end, as a fraction (default 0 = pointed) */
  endWidth?: number;
  /** layered fills (default 2) */
  fills?: number;
  /** total coverage of the fills (default 0.88) */
  coverage?: number;
  /** sideways offset of the whole ribbon (e.g. a shadow-side accent) */
  offset?: number;
  /** pressure along the ribbon (default 1) */
  pressure?: (t: number) => number;
}

/** A tapered brush ribbon along `path`, filled into an open wet layer (no drying). */
export function ribbonInto(L: WetLayer, path: readonly Pt[], width: number, pigment: Pigment, rng: Rng, o: RibbonOptions = {}): void {
  if (path.length < 2) return;
  const sp = smoothPath(path, Math.max(0.8, width * 0.8));
  const [ts, te] = o.taper ?? [0.05, 0.5];
  const endW = o.endWidth ?? 0;
  const hw = (t: number) => {
    let k = 1;
    if (ts > 0 && t < ts) k *= 0.35 + 0.65 * (t / ts);
    if (te > 0 && t > 1 - te) k *= endW + (1 - endW) * ((1 - t) / te) ** 0.8;
    return (width / 2) * k * (o.pressure ? o.pressure(t) : 1);
  };
  const off = o.offset ?? 0;
  const poly = ribbon(sp, hw, off ? () => off : undefined);
  const n = o.fills ?? 2;
  const a = layerAlpha(n, o.coverage ?? 0.88);
  for (let k = 0; k < n; k++) L.fill(n > 1 ? deformPolygon(poly, rng, { depth: 1, variance: 0.03 }) : poly, jitter(pigment, rng, 0.02), a);
}

// ---------------------------------------------------------------------------------------------
// ground, seed and shoot

/** A soft cool shadow under the plant that widens as it grows. */
export function groundShadow(p: Painter, seed: number, g: number, x: number, rx: number, ry: number, opacity = 0.32): void {
  const k = 0.35 + 0.65 * ramp(g, 0.02, 0.6);
  // a cool, soft-edged pool of shade, lost toward the right
  p.glaze({ cx: x, cy: ry * 0.1, rx: rx * k, ry: ry * (0.6 + 0.4 * k) }, shade(PIGMENTS.sage, 0.5), {
    rng: createRng(seed),
    opacity: opacity * (0.5 + 0.5 * k),
    sharpness: 0.3,
    edge: 0.15,
    layers: 8,
    fade: { angle: 0.15, start: 0.35, amount: 0.85 },
  });
}

export interface SproutOptions {
  /** soil mound half-width */
  soil?: number;
  /** shoot / cotyledon colour */
  green?: Pigment;
  /** growth at which the shoot has fully handed over to the plant (default 0.3) */
  handover?: number;
}

/**
 * Seed phase (growth 0 → 0.12): a dark seed in a small soil mound, then a pale shoot with two
 * seed leaves that fade as the real stems take over.
 */
export function seedAndShoot(p: Painter, seed: number, g: number, o: SproutOptions = {}): void {
  const rng = createRng(seed);
  const soil = o.soil ?? 14;
  const green = o.green ?? PIGMENTS.sap;
  const handover = o.handover ?? 0.3;
  // soil mound stays faintly under the plant
  p.wash({ cx: rng.range(-1, 1), cy: -1, rx: soil, ry: soil * 0.28 }, mix(PIGMENTS.stoneWarm, PIGMENTS.wood, 0.4), {
    rng,
    opacity: 0.55 * (1 - 0.5 * ramp(g, 0.1, 0.4)),
    edge: 0.35,
    layers: 10,
    fade: { angle: Math.PI / 2, start: 0.5, amount: 0.8 },
  });
  const seedA = 1 - ramp(g, 0.05, 0.12);
  const shoot = ramp(g, 0.03, 0.12);
  const fade = 1 - ramp(g, 0.14, handover);
  if (seedA < 0.02 && (shoot < 0.02 || fade < 0.02)) return;
  // seed, shoot and two seed leaves share one small wet layer
  const L = p.layer({ x: -10, y: -16, w: 20, h: 19 });
  if (seedA > 0.02) {
    const r = createRng(seed + 1);
    const len = 3.8 * (1 + ramp(g, 0, 0.05) * 0.3);
    paintDab(L, { x: r.range(-2, 2) - len / 2, y: -1.5 }, mix(PIGMENTS.wood, PIGMENTS.sumi, 0.35 * seedA + 0.1), { variant: 'round', angle: -0.3, length: len, layers: 2 }, r, p.env);
  }
  if (shoot > 0.02 && fade > 0.02) {
    const h = 9 * shoot;
    const tip = { x: 0.8, y: -h };
    const r = createRng(seed + 2);
    ribbonInto(L, [{ x: 0, y: 0 }, { x: 0.6, y: -h * 0.5 }, tip], 1.3, mix(green, PIGMENTS.olive, 0.5), r, { taper: [0, 0.3], fills: 1 });
    for (const side of [-1, 1]) {
      paintDab(L, tip, green, { angle: -Math.PI / 2 + side * 0.95, length: 6.5 * shoot, width: 3.6 * shoot, layers: 2 }, createRng(seed + 3 + side), p.env);
    }
  }
  L.dry({ opacity: 0.85 * Math.max(seedA, fade), edge: 0.5, edgeWidth: 0.8, flowScale: 6 });
}

// ---------------------------------------------------------------------------------------------
// branches

export interface BranchPaint {
  /** stem colour */
  pigment: Pigment;
  /** depth ≥ this is drawn as thin twigs (default 1) */
  inkFrom?: number;
  /** overall opacity (default 0.9) */
  opacity?: number;
  /** a broken shadow-side accent on the stems (default 0.5 opacity; 0 = none) */
  accent?: number;
  /**
   * Foliage that hides the upper stems: from growth `at[0]` to `at[1]` the visible part of
   * each stem shrinks to `keep` of its length (twigs are no longer drawn).
   */
  hide?: { keep: number; at: [number, number] };
}

/**
 * Paint a skeleton as far as it has grown: stems as tapered brush ribbons sharing one wet
 * layer, twigs in a second, and a broken dark accent on the stems' shadow side in a third.
 */
export function paintBranches(p: Painter, branches: readonly Branch[], g: number, o: BranchPaint): void {
  const inkFrom = o.inkFrom ?? 1;
  const opacity = o.opacity ?? 0.9;
  const hidden = o.hide ? ramp(g, o.hide.at[0], o.hide.at[1]) : 0;
  const keep = o.hide ? 1 - (1 - o.hide.keep) * hidden : 1;
  type Item = { b: Branch; path: Pt[]; w: number; f: number; tucked: boolean };
  const stems: Item[] = [];
  const twigs: Item[] = [];
  for (const b of branches) {
    const grown = ramp(g, b.t0, b.t1);
    const isStem = b.depth < inkFrom;
    // twigs vanish into the foliage as it closes over them
    const f = isStem ? Math.min(grown, keep) : grown * (1 - hidden);
    if (f < 0.02) continue;
    const path = partialPath(b.pts, Math.max(0.06, f));
    // stems thicken for a while after they reach full length
    const w = b.width * (0.45 + 0.55 * ramp(g, b.t0, Math.min(1, b.t1 + 0.25)));
    (isStem ? stems : twigs).push({ b, path, w, f, tucked: grown > keep + 1e-6 });
  }
  const maxW = Math.max(1, ...stems.map((s) => s.w), ...twigs.map((s) => s.w));
  if (stems.length) {
    const L = p.layer(areaOf(stems.map((s) => s.path), maxW * 2 + 3));
    for (const s of stems) {
      // a growing tip tapers to a point; a stem tucked into foliage just thins out
      ribbonInto(L, s.path, s.w, o.pigment, createRng(s.b.seed), { taper: [0, s.tucked ? 0.35 : 0.55], endWidth: s.tucked ? 0.35 : 0, pressure: (t) => 1.1 - t * 0.25 });
    }
    L.dry({ opacity, edge: 0.4, edgeWidth: Math.max(0.6, maxW * 0.18), sharpness: 0.72, centreLift: 0.15, granulation: 0.15, flow: 0.3, flowScale: maxW * 4 + 8 });
    const accent = o.accent ?? 0.5;
    const lit = stems.filter((s) => s.f > 0.3);
    if (accent > 0 && lit.length) {
      const A = p.layer(areaOf(lit.map((s) => s.path), maxW * 2 + 3));
      for (const s of lit) {
        const r = createRng(s.b.seed + 1);
        // broken: two or three pieces along the stem
        const pieces = r.int(2, 3);
        for (let k = 0; k < pieces; k++) {
          const a = k / pieces + r.range(0, 0.08);
          const b = (k + 1) / pieces - r.range(0.06, 0.2);
          const seg = partialPath(s.path, b).slice(Math.floor(a * s.path.length));
          if (seg.length >= 2) ribbonInto(A, seg, Math.max(0.5, s.w * 0.3), darken(o.pigment, 0.35), r, { offset: s.w * 0.3, taper: [0.2, 0.3], fills: 1 });
        }
      }
      A.dry({ opacity: accent * opacity, edge: 0.3, edgeWidth: 0.6, sharpness: 0.75, flowScale: 8 });
    }
  }
  if (twigs.length) {
    const T = p.layer(areaOf(twigs.map((s) => s.path), maxW + 3));
    for (const s of twigs) ribbonInto(T, s.path, Math.max(0.7, s.w), o.pigment, createRng(s.b.seed), { taper: [0, 0.6], fills: 1 });
    T.dry({ opacity, edge: 0.3, edgeWidth: 0.6, sharpness: 0.75, centreLift: 0.1, flowScale: 10 });
  }
}

// ---------------------------------------------------------------------------------------------
// foliage

export interface ClumpPaint {
  flatness?: number;
  opacity?: number;
  dabSize?: number;
  shadow?: number;
  gaps?: number;
  density?: number;
  /** direction light comes from (default upper left, -2.3) */
  light?: number;
}

/**
 * The plant's foliage mass: every clump's round dabs merge wet-in-wet into one scalloped body
 * (light side light, the rest mid), then a cooler underside pass and a few dark accents. Clumps
 * swell from small to full over their growth windows. Three wet layers for the whole plant.
 */
export function paintClumps(p: Painter, clumps: readonly Clump[], g: number, pigments: FoliagePigments, o: ClumpPaint = {}): void {
  type D = { x: number; y: number; r: number; lit: number; edge: number; rng: Rng; a: number };
  const dabs: D[] = [];
  let rSum = 0;
  let n = 0;
  for (const c of clumps) {
    const k = ramp(g, c.t0, c.t1);
    if (k < 0.03) continue;
    const rng = createRng(c.seed);
    const r = c.r * (0.3 + 0.7 * k);
    for (const d of foliageLayout({ x: c.x, y: c.y }, r, rng, { flatness: o.flatness ?? 0.62, dabSize: o.dabSize, density: o.density, light: o.light })) {
      dabs.push({ ...d, rng, a: 0.45 + 0.55 * k });
    }
    rSum += r;
    n++;
  }
  if (!dabs.length) return;
  const R = rSum / n;
  const opacity = o.opacity ?? 0.85;
  const shadowK = o.shadow ?? 0.6;
  const gaps = o.gaps ?? 0.35;
  const maxR = dabs.reduce((m, d) => Math.max(m, d.r), 0);
  const area = padRect(bounds(dabs), maxR * 1.4 + 4);
  const blot = (L: WetLayer, d: D, pigment: Pigment, scale: number, alpha: number) => {
    const r = d.r * scale;
    const poly = blob(d.x, d.y, r, r * d.rng.range(0.7, 0.95), d.rng, { points: 18, irregularity: 0.2, scallop: 0.9, scallops: d.rng.int(5, 8), rotation: d.rng.range(-0.5, 0.5) });
    L.fill(poly, jitter(pigment, d.rng, 0.03), alpha * d.a);
    L.fill(deformPolygon(poly, d.rng, { depth: 1, variance: 0.06 }), jitter(pigment, d.rng, 0.03), alpha * d.a * 0.6);
  };
  const dry = (x: DryOptions): DryOptions => ({ edge: 0.5, edgeWidth: Math.max(1, R * 0.03), sharpness: 0.7, centreLift: 0.3, granulation: 0.12, flow: 0.45, flowScale: R * 0.5, ...x });
  // 1. light body
  const L1 = p.layer(area);
  for (const d of dabs) blot(L1, d, d.lit > 0.2 ? pigments.light : mix(pigments.light, pigments.mid, 0.55), 1, 0.62);
  for (const d of dabs) {
    if (d.edge > 0.8 || !d.rng.chance(gaps * 0.12)) continue;
    const r = d.r * d.rng.range(0.25, 0.5);
    L1.lift(blob(d.x + d.rng.gaussian(0, d.r * 0.5), d.y + d.rng.gaussian(0, d.r * 0.4), r, r * 0.7, d.rng, { points: 9, irregularity: 0.3 }), d.rng.range(0.6, 0.95));
  }
  L1.dry(dry({ opacity: opacity * 0.85 }));
  // 2. mid-tone on the side away from the light
  const L2 = p.layer(area);
  for (const d of dabs) {
    if (d.lit > 0.15 || !d.rng.chance(0.65)) continue;
    blot(L2, { ...d, x: d.x + d.rng.gaussian(0, d.r * 0.2), y: d.y + d.r * 0.2 }, pigments.mid, d.rng.range(0.75, 1.05), 0.55);
  }
  L2.dry(dry({ opacity: opacity * 0.5, edge: 0.32, sharpness: 0.55 }));
  // 3. cool underside and a few dark accents, one layer
  const L3 = p.layer(area);
  const sh = shade(pigments.shadow, 0.25);
  const dark = pigments.dark ?? darken(pigments.shadow, 0.25);
  for (const d of dabs) {
    if (d.lit > -0.3 || !d.rng.chance(0.7 * shadowK + 0.2)) continue;
    blot(L3, { ...d, y: d.y + d.r * 0.3 }, sh, d.rng.range(0.6, 0.9), 0.5);
    if (d.lit < -0.6 && d.rng.chance(0.18)) blot(L3, { ...d, x: d.x + d.rng.gaussian(0, d.r * 0.3), y: d.y + d.r * 0.45 }, dark, d.rng.range(0.3, 0.5), 0.8);
  }
  L3.dry(dry({ opacity: opacity * 0.38 * (0.5 + shadowK), edge: 0.32, sharpness: 0.5, centreLift: 0.2 }));
}

export interface LeafPaint extends DryOptions {
  variant?: DabOptions['variant'];
  /** lift a glossy streak along each leaf (0..1, default 0) */
  gloss?: number;
  /** groups to split leaves into (alternating neighbours dry separately; default 2) */
  groups?: number;
  /** fills per leaf (default 2) */
  layers?: number;
}

/** Leaf dabs unfolding over their growth windows, batched into a few wet layers. */
export function paintLeaves(p: Painter, leaves: readonly Leaf[], g: number, o: LeafPaint = {}): void {
  const groups = o.groups ?? 2;
  const variant = o.variant ?? 'leaf';
  for (let gi = 0; gi < groups; gi++) {
    const marks: { leaf: Leaf; rng: Rng; shape: ReturnType<typeof dabShape>; opts: DabOptions }[] = [];
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i]!;
      if ((leaf.group ?? i) % groups !== gi) continue;
      const k = ramp(g, leaf.t0, leaf.t1);
      if (k < 0.03) continue;
      const len = leaf.length * (0.25 + 0.75 * k);
      const opts: DabOptions = { variant, angle: leaf.angle, length: len, width: len * (leaf.width ?? 0.42) * (0.6 + 0.4 * k), curve: leaf.curve ?? 0, layers: o.layers ?? 2 };
      const rng = createRng(leaf.seed);
      marks.push({ leaf, rng, shape: dabShape(leaf, opts, rng), opts });
    }
    if (!marks.length) continue;
    const L = p.layer(areaOf(marks.map((m) => m.shape.outline), 4));
    let len = 0;
    let wid = 0;
    for (const m of marks) {
      paintDab(L, m.leaf, m.leaf.pigment, m.opts, m.rng, p.env, m.shape);
      if (o.gloss) {
        const a = m.shape.angle;
        const l = m.shape.length;
        const w = m.shape.width;
        const nx = -Math.sin(a);
        const ny = Math.cos(a);
        const off = w * 0.12;
        const pt = (t: number, s: number): Pt => ({
          x: m.leaf.x + Math.cos(a) * l * t + nx * (off + s * w * 0.09),
          y: m.leaf.y + Math.sin(a) * l * t + ny * (off + s * w * 0.09),
        });
        L.lift([pt(0.2, 0), pt(0.45, 1), pt(0.75, 0.4), pt(0.8, -0.2), pt(0.45, -0.6)], o.gloss * (0.6 + 0.4 * m.rng.next()));
      }
      len += m.shape.length;
      wid += m.shape.width;
    }
    L.dry(o, dabDry(len / marks.length, wid / marks.length));
  }
}

// ---------------------------------------------------------------------------------------------
// flowers

export interface PetalRing {
  count: number;
  /** full petal length */
  length: number;
  /** width as a fraction of length */
  width: number;
  /** final angle away from the flower axis (π/2 = flat) */
  open: number;
  pigment: Pigment;
  /** ring base radius as a fraction of the petal length (default 0.12) */
  offset?: number;
  /** petal bend (signed fraction, random sign per petal; default 0.1) */
  curve?: number;
  /** length variation (default 0.12) */
  lengthVar?: number;
  /** angular jitter in radians (default 0.15) */
  angleVar?: number;
  /** extra pigment pooled at the petal base (default 0.35) */
  basePool?: number;
  /** ruffled tips: small notches lifted out of each petal's tip (count, default 0) */
  ruffle?: number;
  /** a second colour flooded into the outer half of each petal, wet-in-wet (lotus tips) */
  tip?: Pigment;
  variant?: DabOptions['variant'];
}

export type BloomCentre =
  | { kind: 'boss'; pigment: Pigment; size: number }
  | { kind: 'stamens'; pigment: Pigment; size: number; count: number }
  | { kind: 'tuft'; pigment: Pigment; size: number; count: number };

export interface Bloom {
  x: number;
  y: number;
  /** viewer elevation over the flower's face (π/2 = face-on) */
  view: number;
  /** sideways tilt of the flower */
  roll: number;
  /** rotation of the petal pattern */
  rot: number;
  rings: PetalRing[];
  centre?: BloomCentre;
  /** petals are opaque light colour (white flowers): painted source-over */
  opaque?: boolean;
  /** back petals, centre, front petals when seen from the side (cups); otherwise centre last */
  cupped?: boolean;
  /** bud colour (default a pale green) */
  bud?: Pigment;
  /** sepals under the bud (count; default 3) */
  sepals?: number;
  /** a soft glaze deep in the cup (flare / throat colour), painted under the centre */
  throat?: { pigment: Pigment; size: number; alpha: number };
  seed: number;
}

export interface BloomState {
  /** overall scale 0..1 */
  size: number;
  /** 0 = closed bud … 1 = fully open */
  open: number;
  /** 0 = bud green … 1 = full flower colour */
  colour: number;
}

/** Bud → bloom state over a flower's own windows (swell during buds, open during bloom). */
export function bloomState(g: number, bud: [number, number], open: [number, number]): BloomState {
  const swell = ramp(g, bud[0], bud[1]);
  const o = ramp(g, open[0], open[1]);
  return {
    size: lerp(0, 0.5, swell) + 0.5 * ramp(g, bud[1] - (bud[1] - bud[0]) * 0.3, open[1]),
    open: o,
    colour: 0.25 * swell + 0.75 * ramp(g, open[0] - 0.05, open[0] + (open[1] - open[0]) * 0.7),
  };
}

interface PetalMark {
  ring: number;
  front: number;
  at: Pt;
  opts: DabOptions;
  pigment: Pigment;
  tip?: Pigment;
  ruffle: number;
  seed: number;
}

const BUD_OPEN = 0.16;

/** Petal geometry of one flower in a given state (pure; fixed rng order at every growth). */
export function bloomMarks(b: Bloom, s: BloomState): PetalMark[] {
  const rng = createRng(b.seed);
  const bud = b.bud ?? '#b4c27f';
  const marks: PetalMark[] = [];
  b.rings.forEach((ring, ri) => {
    const lenVar = ring.lengthVar ?? 0.12;
    const angVar = ring.angleVar ?? 0.15;
    const ringRot = b.rot + ri * (Math.PI / Math.max(3, ring.count)) + rng.range(-0.2, 0.2);
    for (let j = 0; j < ring.count; j++) {
      const around = ringRot + (j / ring.count) * Math.PI * 2 + rng.range(-angVar, angVar);
      const lenK = 1 + rng.range(-lenVar, lenVar);
      const curve = (ring.curve ?? 0.1) * (rng.chance(0.5) ? 1 : -1) * rng.range(0.5, 1.2);
      const openJ = ring.open * rng.range(0.9, 1.08);
      const seed = rng.int(1, 0x7fffffff);
      const asym = rng.range(-0.3, 0.3);
      // a bud is the same petals folded up (tighter for the inner rings); opening swings them out
      const openNow = lerp(BUD_OPEN * (1 - ri * 0.15), openJ, s.open);
      const v = petalVector(around, openNow, b.view, b.roll);
      const L = ring.length * lenK * s.size * lerp(0.75, 1, s.open);
      const off = L * (ring.offset ?? 0.12) * s.open;
      const ov = petalVector(around, Math.PI / 2, b.view, b.roll);
      marks.push({
        ring: ri,
        front: v.front,
        at: { x: b.x + Math.cos(ov.angle) * off * ov.scale, y: b.y + Math.sin(ov.angle) * off * ov.scale },
        pigment: mix(bud, ring.pigment, s.colour),
        tip: ring.tip ? mix(bud, ring.tip, s.colour) : undefined,
        ruffle: ring.ruffle ?? 0,
        seed,
        opts: {
          variant: ring.variant ?? 'petal',
          angle: v.angle,
          length: Math.max(L * 0.22, L * v.scale),
          width: L * ring.width * lerp(0.7, 1, s.open),
          curve,
          asym,
          basePool: ring.basePool ?? 0.35,
          pool: 0.45,
          layers: 3,
        },
      });
    }
  });
  return marks;
}

export interface BloomBatchOptions {
  /** overall opacity of the batch (default 1) */
  alpha?: number;
  /** wet-layer groups for the outer ring (inner rings use one; default 2) */
  groups?: number;
}

/**
 * Paint flowers, each in any state from tight bud to full bloom. Petals are dabs in rings
 * around a tilted axis (`petalVector`). All flowers in one call share wet layers per pass
 * (ring × back/front × group), so they should not overlap each other much — call once per
 * flower when they do. Neighbouring outer petals dry separately so overlaps show as edges.
 */
export function paintBlooms(p: Painter, items: readonly { bloom: Bloom; state: BloomState }[], o: BloomBatchOptions = {}): void {
  const live = items.filter((it) => it.state.size >= 0.02);
  if (!live.length) return;
  const alpha = o.alpha ?? 1;
  const groups = o.groups ?? 2;
  const all = live.map((it) => {
    // a cup seen from the side hides its centre behind the front petals; seen from above, the
    // inner rings simply lie over the outer ones
    const split = it.bloom.cupped === true && it.bloom.view < 0.9;
    return { ...it, split, marks: bloomMarks(it.bloom, it.state) };
  });
  const opaque = live[0]!.bloom.opaque === true;
  const dryOpts: DryOptions = { opacity: (opaque ? 0.95 : 0.85) * alpha, blend: opaque ? 'source-over' : 'multiply', edge: 0.6, darken: opaque ? 0.45 : 0.3 };
  const nRings = Math.max(...live.map((it) => it.bloom.rings.length));
  const pass = (pick: (m: PetalMark, split: boolean) => boolean, ring: number) => {
    const set = all.flatMap((it) => it.marks.filter((m) => m.ring === ring && pick(m, it.split)));
    const ng = ring === 0 ? groups : 1;
    for (let gi = 0; gi < ng; gi++) {
      const sub = set.filter((_, i) => i % ng === gi);
      if (sub.length) paintPetals(p, sub, dryOpts);
    }
  };
  for (let ri = 0; ri < nRings; ri++) pass((m, split) => !split || m.front < 0, ri);
  paintThroats(p, all, alpha);
  paintCentres(p, all, alpha);
  for (let ri = nRings - 1; ri >= 0; ri--) pass((m, split) => split && m.front >= 0, ri);
  paintSepals(p, all, alpha);
}

function paintPetals(p: Painter, set: readonly PetalMark[], dryOpts: DryOptions): void {
  const shapes = set.map((m) => {
    const r = createRng(m.seed);
    return { m, r, shape: dabShape(m.at, m.opts, r) };
  });
  const L = p.layer(areaOf(shapes.map((x) => x.shape.outline), 3));
  let len = 0;
  let wid = 0;
  for (const { m, r, shape } of shapes) {
    paintDab(L, m.at, m.pigment, m.opts, r, p.env, shape);
    const ca = Math.cos(shape.angle);
    const sa = Math.sin(shape.angle);
    if (m.tip) {
      // tip colour flooded into the wet petal: merges into a soft gradient toward the base
      const at = { x: m.at.x + ca * shape.length * 0.3, y: m.at.y + sa * shape.length * 0.3 };
      paintDab(L, at, m.tip, { ...m.opts, length: shape.length * 0.72, width: shape.width * 0.85, basePool: 0, pool: 0.35, layers: 2 }, r, p.env);
    }
    // ruffles: bites out of the tip; the drying pass rims them like crinkled petal edges
    for (let k = 0; k < m.ruffle; k++) {
      const t = r.range(0.9, 1.02);
      const side = r.range(-0.3, 0.3);
      const cx = m.at.x + ca * shape.length * t - sa * shape.width * side;
      const cy = m.at.y + sa * shape.length * t + ca * shape.width * side;
      const rr = shape.width * r.range(0.07, 0.11);
      L.lift(blob(cx, cy, rr, rr * 0.8, r, { points: 10, irregularity: 0.3 }), r.range(0.55, 0.85));
    }
    len += shape.length;
    wid += shape.width;
  }
  L.dry(dryOpts, dabDry(len / shapes.length, wid / shapes.length));
}

type Painted = { bloom: Bloom; state: BloomState };

function paintThroats(p: Painter, all: readonly Painted[], alpha: number): void {
  const items = all.filter((it) => it.bloom.throat && it.state.open > 0.3);
  if (!items.length) return;
  const polys = items.map((it) => {
    const t = it.bloom.throat!;
    const r = t.size * it.state.size;
    return blob(it.bloom.x, it.bloom.y, r, r * (0.45 + 0.5 * Math.sin(it.bloom.view)), createRng(it.bloom.seed + 5), { points: 20, irregularity: 0.2 });
  });
  const L = p.layer(areaOf(polys, 3));
  items.forEach((it, i) => {
    const k = ramp(it.state.open, 0.3, 0.9) * it.bloom.throat!.alpha;
    const r = createRng(it.bloom.seed + 6);
    for (let j = 0; j < 4; j++) L.fill(deformPolygon(polys[i]!, r, { depth: 2, variance: 0.15 }), it.bloom.throat!.pigment, k * 0.3);
  });
  L.dry({ opacity: alpha, edge: 0.1, sharpness: 0.3, centreLift: 0, granulation: 0.1, flowScale: 8 });
}

function paintCentres(p: Painter, all: readonly Painted[], alpha: number): void {
  const items = all.filter((it) => it.bloom.centre && it.state.open > 0.45);
  if (!items.length) return;
  const vis = (it: Painted) => ramp(it.state.open, 0.45, 0.85);
  const size = (it: Painted) => it.bloom.centre!.size * it.state.size;
  const area = padRect(bounds(items.flatMap((it) => [{ x: it.bloom.x - size(it) * 1.3, y: it.bloom.y - size(it) * 1.7 }, { x: it.bloom.x + size(it) * 1.3, y: it.bloom.y + size(it) }])), 2);
  // pollen bosses and stamen heads: one layer for every flower
  const H = p.layer(area);
  const F = p.layer(area);
  let filaments = false;
  for (const it of items) {
    const c = it.bloom.centre!;
    const rng = createRng(it.bloom.seed + 3);
    const s = size(it);
    const k = vis(it);
    const { x: cx, y: cy } = it.bloom;
    if (c.kind === 'boss') {
      paintDab(H, { x: cx - s * 0.4, y: cy }, c.pigment, { variant: 'round', angle: 0, length: s, width: s * 0.85, layers: 2 }, rng, p.env);
    } else if (c.kind === 'stamens') {
      for (let j = 0; j < c.count; j++) {
        const a = rng.range(0, Math.PI * 2);
        const r = s * Math.sqrt(rng.next()) * 0.55;
        const at = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * Math.sin(it.bloom.view) };
        const d = s * rng.range(0.16, 0.3) * (0.5 + 0.5 * k);
        paintDab(H, at, mix(c.pigment, PIGMENTS.vermilion, rng.range(0, 0.2)), { variant: 'round', angle: rng.range(0, 6.28), length: d, width: d * 0.8, layers: 2 }, rng, p.env);
      }
    } else {
      // tuft: a brush of stamens rising from the cup (camellia), gold heads on pale filaments
      filaments = true;
      const fil = lighten(mix(c.pigment, PIGMENTS.petalWhite, 0.6), 0.2);
      for (let j = 0; j < c.count; j++) {
        const a = -Math.PI / 2 + (j / Math.max(1, c.count - 1) - 0.5) * 1.3 + rng.range(-0.1, 0.1);
        const len = s * rng.range(0.8, 1.05) * (0.4 + 0.6 * k);
        const base = { x: cx + rng.range(-1, 1) * s * 0.2, y: cy + s * 0.1 };
        paintDab(F, base, fil, { variant: 'blade', angle: a, length: len, width: s * 0.22, layers: 2 }, rng, p.env);
        const d = s * rng.range(0.16, 0.26);
        paintDab(H, { x: base.x + Math.cos(a) * len - d / 2, y: base.y + Math.sin(a) * len }, mix(c.pigment, PIGMENTS.vermilion, rng.range(0, 0.15)), { variant: 'round', angle: 0, length: d, width: d * 0.85, layers: 2 }, rng, p.env);
      }
    }
  }
  if (filaments) F.dry({ opacity: 0.95 * alpha, edge: 0.35, edgeWidth: 0.5, blend: 'source-over' });
  else F.discard();
  H.dry({ opacity: 0.9 * alpha, edge: 0.5, edgeWidth: 0.5, granulation: 0.35, flowScale: 4, blend: 'source-over' });
}

function paintSepals(p: Painter, all: readonly Painted[], alpha: number): void {
  const items = all.filter((it) => (it.bloom.sepals ?? 3) > 0 && it.state.open < 0.95);
  if (!items.length) return;
  const marks: { at: Pt; opts: DabOptions; rng: Rng; shape: ReturnType<typeof dabShape>; a: number }[] = [];
  for (const it of items) {
    const b = it.bloom;
    const s = it.state;
    const nSep = b.sepals ?? 3;
    const sr = createRng(b.seed + 7);
    const L = b.rings[0]!.length * s.size;
    for (let k = 0; k < nSep; k++) {
      const around = Math.PI / 2 + (k - (nSep - 1) / 2) * 0.9 + sr.range(-0.2, 0.2);
      const v = petalVector(around, lerp(0.35, 1.9, s.open), b.view, b.roll);
      const at = { x: b.x, y: b.y + L * 0.05 };
      const opts: DabOptions = { angle: v.angle, length: L * 0.42 * Math.max(0.3, v.scale), width: L * 0.2, layers: 2 };
      const rng = createRng(sr.int(1, 0x7fffffff));
      marks.push({ at, opts, rng, shape: dabShape(at, opts, rng), a: 1 - 0.8 * s.open });
    }
  }
  const L = p.layer(areaOf(marks.map((m) => m.shape.outline), 3));
  for (const m of marks) paintDab(L, m.at, mix(PIGMENTS.sage, PIGMENTS.olive, 0.3), m.opts, m.rng, p.env, m.shape);
  const fade = Math.max(...marks.map((m) => m.a));
  L.dry({ opacity: 0.8 * alpha * fade, edge: 0.5 }, dabDry(6, 3));
}
