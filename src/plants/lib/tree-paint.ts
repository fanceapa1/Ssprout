/**
 * Painting helpers shared by the tier-4 trees: the ink skeleton (all branches batched into one
 * wet layer), dry-brush bark, ground shadow, the seed and sapling leaves, foliage pads and
 * blossom masses. Everything is driven by a `TreeView` (see tree-structure.ts) and stable,
 * per-element rng forks, so consecutive growth steps of one seed differ only where the tree
 * actually grew.
 */
import type { Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { blob, bounds, dabOutline, deformPolygon, padRect, ribbon, smoothPath, type Pt, type Rect } from '../../paint/geometry';
import { PIGMENTS, darken, jitter, lighten, mix, rgba, shade, type Pigment } from '../../paint/pigments';
import { dab, dryBrush, glaze, layerAlpha, paintDab, stroke, type PaintTarget } from '../../paint/primitives';
import { foliageLayout, type FoliagePigments } from '../../paint/recipes';
import { WetLayer, type DryOptions, type PaintEnv } from '../../paint/wet';
import { branchProgress, partialPath, ramp, viewPt, widthAt, type Branch, type Tree, type TreeView } from './tree-structure';

// ---------------------------------------------------------------------------------------------
// setup

/**
 * Run `fn` with the painter's context mapped so one unit = one species unit of a `size` box
 * (base of the box at the bottom of the canvas, centred horizontally).
 */
export function inUnits(p: Painter, size: { w: number; h: number }, opts: { w: number; h: number }, fn: () => void): void {
  const ctx = p.ctx;
  const s = Math.min(opts.w / size.w, opts.h / size.h);
  ctx.save();
  ctx.setTransform(s, 0, 0, s, (opts.w - size.w * s) / 2, opts.h - size.h * s);
  try {
    fn();
  } finally {
    ctx.restore();
  }
}

/**
 * A paint target whose environment draws from `rng` (flow-noise offsets of every drying pass),
 * so a mark painted at two growth steps dries identically even if a different number of marks
 * were painted before it.
 */
export function stableTarget(p: Painter, rng: Rng): PaintTarget {
  const env: PaintEnv = { ...p.env, rng };
  return { ctx: p.ctx, env };
}

/** A wet layer over `area` whose drying uses `rng` (see `stableTarget`). */
export function stableLayer(p: Painter, area: Rect, rng: Rng, res?: number): WetLayer {
  return new WetLayer(p.ctx, area, { ...p.env, rng }, res);
}

/**
 * Work resolution for soft, low-contrast passes (shadow glazes, mid-tones, deep petal tints):
 * their edges are blurry anyway, so they dry at reduced resolution (big speed win on
 * crown-sized layers). `undefined` = the engine default (high quality keeps full detail).
 */
export function softRes(p: Painter): number | undefined {
  return p.quality === 'high' ? undefined : p.quality === 'draft' ? 0.45 : 0.6;
}

// ---------------------------------------------------------------------------------------------
// skeleton

export interface BarkStyle {
  /** body pigment of the branches */
  pigment: Pigment;
  /** darker pigment for the shadow side and dry-brush texture (default shade of pigment) */
  dark?: Pigment;
  /** dry-brush bark texture on thick limbs, 0..1 (default 0.6) */
  texture?: number;
  /** shadow-side modelling on thick limbs, 0..1 (default 0.5) */
  modelling?: number;
  /** opacity of the skeleton (default 0.92) */
  opacity?: number;
  /** wobble of the centreline as a fraction of width (default 0.25) */
  wobble?: number;
  /** base flare of trunks (default 0.45) */
  flare?: number;
  /** branches thinner than this (units) after scaling are drawn at this width (default 0.42) */
  minWidth?: number;
  /** skip branches with these tags (painted separately) */
  skipTags?: string[];
  /** only thick limbs at least this wide get texture (default 3) */
  textureMin?: number;
}

interface VisibleBranch {
  b: Branch;
  f: number;
  path: Pt[];
  hw: (t: number) => number;
  off: (t: number) => number;
}

/** The visible, view-mapped centreline and width profile of every grown branch. */
export function visibleBranches(tree: Tree, view: TreeView, style: Pick<BarkStyle, 'wobble' | 'flare' | 'minWidth' | 'skipTags'> = {}): VisibleBranch[] {
  const out: VisibleBranch[] = [];
  const wob = style.wobble ?? 0.25;
  const flare = style.flare ?? 0.45;
  const minW = style.minWidth ?? 0.42;
  for (const b of tree.branches) {
    if (style.skipTags?.includes(b.tag)) continue;
    const f = branchProgress(b, view.tau);
    if (f <= 0.002) continue;
    const pts = partialPath(b, f).map((q) => viewPt(view, q));
    const wk = view.scale * view.thick;
    const baseW = widthAt(b, 0) * wk;
    const path = smoothPath(pts, Math.max(0.6, Math.min(3, baseW * 0.5)));
    if (path.length < 2) continue;
    const growing = f < 1;
    const fl = b.order === 0 ? flare : 0;
    const hw = (t: number) => {
      let w = widthAt(b, t * f) * wk;
      if (growing) w *= 1 - 0.55 * ramp(t, 0.6, 1);
      if (fl) w *= 1 + fl * (1 - ramp(t, 0, 0.1));
      return Math.max(minW, w) / 2;
    };
    const ph = b.phase;
    const visLen = b.len * f;
    const off = (t: number) => {
      const s = t * visLen;
      const w = widthAt(b, t * f) * wk;
      return wob * Math.min(w, 5) * (0.6 * Math.sin(s / 23 + ph) + 0.4 * Math.sin(s / 7.3 + ph * 1.7));
    };
    out.push({ b, f, path, hw, off });
  }
  return out;
}

/**
 * Paint the skeleton: every visible branch as a tapered ribbon in one wet layer (branches
 * merge at their forks like wet ink), then shadow-side modelling and dry-brush bark on the
 * thick limbs. Returns the visible branches for species detail passes.
 */
export function paintSkeleton(p: Painter, tree: Tree, view: TreeView, rng: Rng, style: BarkStyle): VisibleBranch[] {
  const vis = visibleBranches(tree, view, style);
  if (!vis.length) return vis;
  const dark = style.dark ?? shade(style.pigment, 0.3);
  const allPts: Pt[] = [];
  for (const v of vis) for (const q of v.path) allPts.push(q);
  const maxW = vis.reduce((m, v) => Math.max(m, v.hw(0)), 1);
  const area = padRect(bounds(allPts), maxW * 2 + 4);
  const L = stableLayer(p, area, rng.fork('skeleton-dry'));
  const a = layerAlpha(2, 0.92);
  for (const v of vis) {
    const r = rng.fork(`br-${v.b.id}`);
    for (let k = 0; k < 2; k++) {
      const wk = 1 + r.gaussian(0, 0.06);
      L.fill(ribbon(v.path, (t) => v.hw(t) * wk, v.off), jitter(style.pigment, r, 0.025), a);
    }
  }
  L.dry({
    opacity: style.opacity ?? 0.92,
    edge: 0.45,
    edgeWidth: 1.1,
    sharpness: 0.82,
    centreLift: 0.2,
    granulation: 0.25,
    flow: 0.4,
    flowScale: 26,
    darken: 0.25,
  });

  // modelling + bark on the thick limbs
  const texMin = style.textureMin ?? 3;
  const tex = style.texture ?? 0.6;
  const mod = style.modelling ?? 0.5;
  for (const v of vis) {
    const w0 = v.hw(0.15) * 2;
    if (w0 < texMin) continue;
    const r = rng.fork(`bark-${v.b.id}`);
    const t = stableTarget(p, r);
    const n = v.path.length;
    // shadow side (right / lower): a darker stroke hugging that flank
    if (mod > 0) {
      const side = v.path.map((q, i) => {
        const tt = i / (n - 1);
        return { x: q.x + v.hw(tt) * 0.45, y: q.y };
      });
      stroke(t, thin(side, 6), {
        rng: r,
        pigment: dark,
        width: w0 * 0.5,
        pressure: (tt) => v.hw(tt) / Math.max(0.01, v.hw(0.15)),
        taper: [0.02, 0.25],
        wobble: 0.15,
        wetness: 0.55,
        opacity: 0.45 * mod,
        edge: 0.3,
      });
    }
    if (tex > 0) {
      const strokes = w0 > 7 ? 2 : 1;
      for (let s = 0; s < strokes; s++) {
        const shift = (s === 0 ? 0.15 : -0.35) * w0;
        const seg = v.path.map((q, i) => ({ x: q.x + shift * (v.hw(i / (n - 1)) / Math.max(0.01, v.hw(0.15))), y: q.y }));
        const cut = Math.max(2, Math.round(n * r.range(0.65, 0.95)));
        dryBrush(t, thin(seg.slice(0, cut), 6), {
          rng: r,
          pigment: s === 0 ? dark : darken(style.pigment, 0.15),
          width: w0 * (s === 0 ? 0.7 : 0.45),
          pressure: (tt) => Math.max(0.2, v.hw(tt * (cut / n)) / Math.max(0.01, v.hw(0.15))),
          dryness: 0.75,
          opacity: 0.55 * tex,
        });
      }
    }
  }
  return vis;
}

/** Every `step`-th point of a path, keeping the last. */
function thin(path: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < path.length; i += step) out.push(path[i]!);
  if (out[out.length - 1] !== path[path.length - 1]) out.push(path[path.length - 1]!);
  return out.length >= 2 ? out : path.slice();
}

// ---------------------------------------------------------------------------------------------
// ground, seed, sapling

/** Soft cool shadow pooled under the tree; grows with it. */
export function paintGroundShadow(p: Painter, base: Pt, rx: number, view: TreeView, rng: Rng, pigment: Pigment = mix(PIGMENTS.sage, PIGMENTS.shadow, 0.45)): void {
  const k = 0.35 + 0.65 * view.scale;
  const t = stableTarget(p, rng.fork('ground-dry'));
  glaze(t, { cx: base.x + rx * 0.12, cy: base.y + 2, rx: rx * k, ry: rx * k * 0.12 }, pigment, {
    rng: rng.fork('ground'),
    opacity: 0.16 + 0.08 * view.growth,
    edge: 0.05,
    sharpness: 0.25,
    fade: { angle: Math.PI, start: 0.15, amount: 0.85, ragged: 0.8 },
  });
  // a darker pool right at the foot
  glaze(t, { cx: base.x + 3, cy: base.y + 1, rx: 12 * k + 4, ry: 2.6 * k + 1 }, shade(pigment, 0.2), {
    rng: rng.fork('ground-foot'),
    opacity: 0.26,
    sharpness: 0.3,
  });
}

/** The seed in its little mound of soil (fades as the shoot takes over, gone by g ≈ 0.14). */
export function paintSeed(p: Painter, base: Pt, g: number, rng: Rng, seedPigment: Pigment = mix(PIGMENTS.wood, PIGMENTS.gold, 0.25)): void {
  const vis = 1 - ramp(g, 0.06, 0.14);
  if (vis <= 0.01) return;
  const t = stableTarget(p, rng.fork('seed-dry'));
  glaze(t, { cx: base.x, cy: base.y + 1, rx: 13, ry: 4 }, mix(PIGMENTS.stoneWarm, PIGMENTS.wood, 0.4), { rng: rng.fork('soil'), opacity: 0.5 * vis });
  const split = ramp(g, 0.0, 0.05);
  dab(t, { x: base.x - 1.5, y: base.y + 1.5 }, seedPigment, {
    rng: rng.fork('seed'),
    variant: 'round',
    angle: -0.4 - split * 0.5,
    length: 7,
    width: 4.6,
    opacity: 0.85 * vis,
    blend: 'source-over',
  });
}

/**
 * Young leaves at growing tips (sapling stage and while branches extend): a pair of small leaf
 * dabs at each visible tip, fading out as `amount` → 0.
 */
export function paintTipLeaves(p: Painter, vis: readonly VisibleBranch[], view: TreeView, amount: number, rng: Rng, opts: { pigment?: Pigment; size?: number; maxOrder?: number } = {}): void {
  if (amount <= 0.01) return;
  const pig = opts.pigment ?? lighten(PIGMENTS.sap, 0.05);
  const size = (opts.size ?? 6) * (0.55 + 0.45 * view.scale);
  const tips: { at: Pt; a: number; id: number }[] = [];
  const hasKids = new Set<number>();
  for (const v of vis) if (v.b.parent >= 0 && v.f > 0.05) hasKids.add(v.b.parent);
  for (const v of vis) {
    if (opts.maxOrder !== undefined && v.b.order > opts.maxOrder) continue;
    if (v.b.order === 0 && hasKids.has(v.b.id) && view.tau > 0.35) continue;
    const n = v.path.length;
    const tip = v.path[n - 1]!;
    const prev = v.path[Math.max(0, n - 4)]!;
    tips.push({ at: tip, a: Math.atan2(tip.y - prev.y, tip.x - prev.x), id: v.b.id });
  }
  if (!tips.length) return;
  const area = padRect(bounds(tips.map((q) => q.at)), size * 1.6 + 3);
  const L = stableLayer(p, area, rng.fork('tips-dry'));
  for (const tp of tips) {
    const r = rng.fork(`tip-${tp.id}`);
    const n = r.int(2, 3);
    for (let k = 0; k < n; k++) {
      const side = k % 2 === 0 ? 1 : -1;
      const ang = tp.a + side * r.range(0.5, 1.0) - (k === 2 ? side * 0.6 : 0);
      paintDab(L, tp.at, jitter(pig, r, 0.05), { variant: 'leaf', angle: ang, length: size * r.range(0.8, 1.15), curve: side * 0.12, layers: 3 }, r, p.env);
    }
  }
  L.dry({ opacity: 0.8 * amount, edge: 0.5, edgeWidth: 0.8, sharpness: 0.72, centreLift: 0.3, granulation: 0.1, flowScale: 10 });
}

// ---------------------------------------------------------------------------------------------
// foliage

export interface Pad {
  x: number;
  y: number;
  /** full-grown radius */
  r: number;
  /** arrival delay 0..1 within the foliage phase */
  delay: number;
  /** id for its rng fork */
  id: number;
  /** -1 back … 1 front (painting order and tone) */
  depth?: number;
  /** branch the pad grows from (species bookkeeping) */
  branch?: number;
}

export interface PadStyle {
  /** height / width (default 0.55) */
  flatness?: number;
  /** direction light comes from (default -2.3, upper left) */
  light?: number;
  /** overall opacity (default 0.85) */
  opacity?: number;
  /** paper gaps, 0..1 (default 0.35) */
  gaps?: number;
  /** dab radius as a fraction of the pad radius (default 0.22) */
  dabSize?: number;
  /** shadow strength 0..1 (default 0.6) */
  shadow?: number;
  /** dab density (default 1) */
  density?: number;
  /** body passes that dry separately, so overlapping pads keep an edge between them (default 2) */
  groups?: number;
  /** scallops per dab (default 5–8): more = frillier edge */
  scallop?: number;
}

/**
 * Foliage pads batched for speed: the same painting order as the engine's `foliageClump`
 * (merged light body with paper gaps → mid-tone → cool shadow → a few darks) but every pad
 * shares the same few wet layers. Pads are split into `groups` body passes, so neighbouring
 * pads still overlap with a visible wet edge. Layout per pad comes from its own rng fork, so a
 * pad keeps its dabs at every growth step.
 */
export function paintPadMass(
  p: Painter,
  pads: readonly Pad[],
  view: TreeView,
  rng: Rng,
  size: (pad: Pad) => number,
  pigments: (pad: Pad) => FoliagePigments,
  style: PadStyle = {},
): void {
  const flat = style.flatness ?? 0.55;
  const opacity = style.opacity ?? 0.85;
  const shadowK = style.shadow ?? 0.6;
  const gaps = style.gaps ?? 0.35;
  const groups = Math.max(1, style.groups ?? 2);
  type Live = { pad: Pad; at: Pt; r: number; pig: FoliagePigments; dabs: ReturnType<typeof foliageLayout>; rng: Rng };
  const live: Live[] = [];
  const order = pads.slice().sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0) || a.id - b.id);
  for (const pad of order) {
    const k = size(pad);
    if (k <= 0.03) continue;
    const r = pad.r * k * view.scale;
    if (r < 1.2) continue;
    const at = viewPt(view, pad);
    const pr = rng.fork(`pad-${pad.id}`);
    const dabs = foliageLayout(at, r, pr, { flatness: flat, light: style.light, dabSize: style.dabSize ?? 0.22, density: style.density });
    live.push({ pad, at, r, pig: pigments(pad), dabs, rng: pr });
  }
  if (!live.length) return;
  const pts: Pt[] = [];
  let maxR = 1;
  for (const l of live)
    for (const d of l.dabs) {
      pts.push(d);
      maxR = Math.max(maxR, d.r);
    }
  if (!pts.length) return;
  const area = padRect(bounds(pts), maxR * 1.5 + 4);
  const avgR = live.reduce((m, l) => m + l.r, 0) / live.length;
  const dryBase: DryOptions = { edge: 0.5, edgeWidth: Math.max(0.8, avgR * 0.03), sharpness: 0.7, centreLift: 0.3, granulation: 0.12, flow: 0.45, flowScale: avgR * 0.5 };
  const blot = (L: WetLayer, r: Rng, d: { x: number; y: number; r: number }, pig: Pigment, scale: number, alpha: number) => {
    const rad = d.r * scale;
    const poly = blob(d.x, d.y, rad, rad * r.range(0.7, 0.95), r, { points: 14, irregularity: 0.2, scallop: 0.9, scallops: style.scallop ?? r.int(5, 8), rotation: r.range(-0.5, 0.5) });
    for (let k = 0; k < 2; k++) L.fill(deformPolygon(poly, r, { depth: 1, variance: 0.1, cap: rad * 0.08 }), pig, alpha);
  };
  const a2 = layerAlpha(2, 0.8);
  // 1. light bodies (one pass per group)
  for (let gi = 0; gi < groups; gi++) {
    const L = stableLayer(p, area, rng.fork(`pads-body-${gi}`));
    let any = false;
    live.forEach((l, i) => {
      if (i % groups !== gi) return;
      any = true;
      const r = l.rng.fork('body');
      const mixed = mix(l.pig.light, l.pig.mid, 0.5);
      for (const d of l.dabs) blot(L, r, d, d.lit > 0.2 ? l.pig.light : mixed, 1, a2);
      const holes = Math.round(gaps * l.dabs.length * 0.12);
      for (let h = 0; h < holes; h++) {
        const d = l.dabs[r.int(0, l.dabs.length - 1)]!;
        if (d.edge > 0.8) continue;
        const hr = d.r * r.range(0.25, 0.5);
        L.lift(blob(d.x + r.gaussian(0, d.r * 0.5), d.y + r.gaussian(0, d.r * 0.4), hr, hr * 0.7, r, { points: 9, irregularity: 0.3 }), r.range(0.6, 0.95));
      }
    });
    if (any) L.dry({ ...dryBase, opacity: opacity * 0.85 });
    else L.discard();
  }
  // 2. mid-tone away from the light
  const L2 = stableLayer(p, area, rng.fork('pads-mid'), softRes(p));
  for (const l of live) {
    const r = l.rng.fork('mid');
    for (const d of l.dabs) {
      if (d.lit > 0.15 || !r.chance(0.65)) continue;
      blot(L2, r, { x: d.x + r.gaussian(0, d.r * 0.2), y: d.y + d.r * 0.2, r: d.r }, l.pig.mid, r.range(0.75, 1.05), layerAlpha(2, 0.7));
    }
  }
  L2.dry({ ...dryBase, opacity: opacity * 0.42, edge: 0.32, sharpness: 0.55 });
  // 3. cool shadow on the underside
  const L3 = stableLayer(p, area, rng.fork('pads-shadow'), softRes(p));
  for (const l of live) {
    const r = l.rng.fork('shadow');
    const sh = shade(l.pig.shadow, 0.25);
    for (const d of l.dabs) {
      if (d.lit > -0.3 || !r.chance(0.7 * shadowK + 0.2)) continue;
      blot(L3, r, { x: d.x, y: d.y + d.r * 0.3, r: d.r }, sh, r.range(0.6, 0.9), layerAlpha(2, 0.7));
    }
  }
  L3.dry({ ...dryBase, opacity: opacity * 0.3 * (0.5 + shadowK), edge: 0.3, sharpness: 0.5, centreLift: 0.2 });
  // 4. a few dark accents tucked under
  const L4 = stableLayer(p, area, rng.fork('pads-dark'), softRes(p));
  let accents = 0;
  for (const l of live) {
    const r = l.rng.fork('dark');
    const dark = l.pig.dark ?? darken(l.pig.shadow, 0.25);
    for (const d of l.dabs) {
      if (d.lit > -0.6 || !r.chance(0.14)) continue;
      blot(L4, r, { x: d.x + r.gaussian(0, d.r * 0.3), y: d.y + d.r * 0.45, r: d.r }, dark, r.range(0.3, 0.5), layerAlpha(2, 0.75));
      accents++;
    }
  }
  if (accents) L4.dry({ ...dryBase, opacity: opacity * 0.3, edge: 0.35 });
  else L4.discard();
}

// ---------------------------------------------------------------------------------------------
// blossoms

export interface Blossom {
  x: number;
  y: number;
  /** petal length */
  r: number;
  /** rotation */
  rot: number;
  /** 0 pale … 1 deep */
  tone: number;
  /** arrival delay 0..1 within the blossom phase */
  delay: number;
  /** 'flower' = five petals, 'bud' = one round dab, 'dot' = one small round blot */
  kind: 'flower' | 'bud' | 'dot';
  id: number;
}

export interface BlossomPigments {
  pale: Pigment;
  deep: Pigment;
  /** centres / stamens (default gold) */
  centre?: Pigment;
}

/**
 * Paint a blossom mass in batched wet layers: pale petals (source-over so they sit on top of
 * twigs), a multiplied deeper pass on some petals, then tiny centres. `open(b)` gives the
 * arrival 0..1 (petal size and opacity).
 */
export function paintBlossoms(
  p: Painter,
  blossoms: readonly Blossom[],
  view: TreeView,
  rng: Rng,
  open: (b: Blossom) => number,
  pig: BlossomPigments,
  o: {
    petals?: number;
    opacity?: number;
    dry?: DryOptions;
    centres?: number;
    /** body passes that dry separately so neighbouring flowers keep their own rims (default 1) */
    groups?: number;
    /** chance a flower shows its centre (default 0.55) */
    centreChance?: number;
    /** centre size as a fraction of the petal length (default 0.16) */
    centreSize?: number;
    /** stamen hairs per flower (default 0) */
    stamens?: number;
    /** stamen pigment (default sumi) */
    stamenPigment?: Pigment;
    /** chance of a deeper glaze petal per flower (default 0.5 + tone × 0.4) */
    deepChance?: number;
  } = {},
): void {
  const live = blossoms.map((b) => ({ b, k: open(b) })).filter((x) => x.k > 0.04);
  if (!live.length) return;
  const at = live.map(({ b }) => viewPt(view, b));
  const maxR = live.reduce((m, x) => Math.max(m, x.b.r), 1);
  const area = padRect(bounds(at), maxR * 2.4 + 3);
  const petals = o.petals ?? 5;
  const groups = Math.max(1, o.groups ?? 1);
  const bodies = Array.from({ length: groups }, (_, gi) => stableLayer(p, area, rng.fork(gi ? `bl-body-dry-${gi}` : 'bl-body-dry')));
  const deep = stableLayer(p, area, rng.fork('bl-deep-dry'), softRes(p));
  const centres: { at: Pt; r: number; k: number; id: number; group: number }[] = [];
  let deepCount = 0;
  const TONES = 6;
  const tones = Array.from({ length: TONES }, (_, i) => mix(pig.pale, pig.deep, i / (TONES - 1)));
  const budPig = mix(pig.deep, pig.pale, 0.2);
  live.forEach(({ b, k }, i) => {
    const c = at[i]!;
    const r = rng.fork(`bl-${b.id}`);
    const body = bodies[i % groups]!;
    const len = b.r * (0.45 + 0.55 * k) * (0.7 + 0.3 * view.scale);
    const pg = tones[Math.min(TONES - 1, Math.round(b.tone * 0.6 * (TONES - 1)))]!;
    if (b.kind === 'flower') {
      for (let j = 0; j < petals; j++) {
        const ang = b.rot + (j / petals) * Math.PI * 2 + r.gaussian(0, 0.15);
        petalMark(body, c, pg, ang, len * r.range(0.88, 1.1), len * 0.85, 0.8, r);
      }
      if (r.chance(o.deepChance ?? 0.5 + b.tone * 0.4)) {
        petalMark(deep, c, pig.deep, b.rot + r.range(0, 6.3), len * 0.8, len * 0.7, 0.75, r);
        deepCount++;
      }
      if (r.chance(o.centreChance ?? 0.55)) centres.push({ at: c, r: len, k, id: b.id, group: i % groups });
    } else if (b.kind === 'bud') {
      dotMark(deep, c, budPig, len * 0.45, len * 0.34, b.rot, 0.85, r);
      deepCount++;
    } else {
      dotMark(body, c, pg, len * 0.5, len * r.range(0.35, 0.47), b.rot, 0.85, r);
      if (r.chance(0.3 + b.tone * 0.4)) {
        dotMark(deep, { x: c.x + r.range(-0.3, 0.3) * len, y: c.y + r.range(0, 0.3) * len }, pig.deep, len * 0.3, len * 0.24, b.rot, 0.75, r);
        deepCount++;
      }
    }
  });
  const op = o.opacity ?? 0.92;
  // plain centres go into the (still wet) petal layer of their flower and dry with it (no extra
  // crown-sized pass); flowers with stamens get their own crisp multiplied pass on top
  const cAmt = o.centres ?? 1;
  const own = (o.stamens ?? 0) > 0 && cAmt > 0 && centres.length > 0 ? stableLayer(p, area, rng.fork('bl-centre-dry')) : null;
  if (cAmt > 0 && centres.length) {
    const cp = own ? (pig.centre ?? PIGMENTS.gold) : mix(pig.pale, pig.centre ?? PIGMENTS.gold, 0.35 + 0.4 * cAmt);
    const sp = own ? (o.stamenPigment ?? PIGMENTS.sumi) : mix(pig.pale, o.stamenPigment ?? PIGMENTS.sumi, 0.6);
    for (const c of centres) {
      const r = rng.fork(`blc-${c.id}`);
      const C = own ?? bodies[c.group]!;
      const cs = o.centreSize ?? 0.16;
      dotMark(C, { x: c.at.x + r.range(-0.15, 0.15) * c.r, y: c.at.y + r.range(-0.15, 0.15) * c.r }, cp, c.r * cs, c.r * cs * 0.8, 0, 0.95, r);
      const ns = o.stamens ?? 0;
      if (ns > 0) {
        const sc = C.ctx;
        sc.strokeStyle = rgba(sp, 0.8);
        sc.lineWidth = Math.max(0.25, c.r * 0.05);
        sc.lineCap = 'round';
        sc.beginPath();
        for (let j = 0; j < ns; j++) {
          const a = r.range(0, Math.PI * 2);
          const l = c.r * r.range(0.4, 0.6);
          sc.moveTo(c.at.x, c.at.y);
          sc.lineTo(c.at.x + Math.cos(a) * l, c.at.y + Math.sin(a) * l);
        }
        sc.stroke();
        sc.fillStyle = rgba(mix(sp, cp, 0.4), 0.9);
        for (let j = 0; j < ns; j++) {
          const a = r.range(0, Math.PI * 2);
          const l = c.r * r.range(0.4, 0.62);
          sc.beginPath();
          sc.arc(c.at.x + Math.cos(a) * l, c.at.y + Math.sin(a) * l, Math.max(0.3, c.r * 0.06), 0, Math.PI * 2);
          sc.fill();
        }
      }
    }
  }
  for (const body of bodies) body.dry({ opacity: op, edge: 0.5, edgeWidth: 0.7, sharpness: 0.75, centreLift: 0.25, granulation: 0.08, flow: 0.3, flowScale: 12, darken: 0.25, blend: 'source-over', ...o.dry });
  if (deepCount) deep.dry({ opacity: op * 0.6, edge: 0.45, edgeWidth: 0.6, sharpness: 0.7, centreLift: 0.25, granulation: 0.08, flowScale: 10 });
  else deep.discard();
  own?.dry({ opacity: 0.7 * cAmt, edge: 0.4, edgeWidth: 0.5, sharpness: 0.7, centreLift: 0.1, flowScale: 6 });
}

export interface Leaf {
  x: number;
  y: number;
  /** base → tip direction */
  angle: number;
  length: number;
  /** width as a fraction of length (default 0.42) */
  width?: number;
  /** 0..1 pick between the light and dark pigment */
  tone: number;
  delay: number;
  id: number;
  variant?: 'leaf' | 'petal' | 'round' | 'needle' | 'blade';
  curve?: number;
}

/**
 * Many small leaves in one wet layer (single fill each; they merge where they touch, like
 * leaves painted wet into wet). `size(leaf)` gives arrival 0..1.
 */
export function paintLeaves(
  p: Painter,
  leaves: readonly Leaf[],
  view: TreeView,
  rng: Rng,
  size: (l: Leaf) => number,
  light: Pigment,
  dark: Pigment,
  dry: DryOptions = {},
): void {
  const live = leaves.map((l) => ({ l, k: size(l) })).filter((x) => x.k > 0.05);
  if (!live.length) return;
  const at = live.map(({ l }) => viewPt(view, l));
  const maxL = live.reduce((m, x) => Math.max(m, x.l.length), 1);
  const L = stableLayer(p, padRect(bounds(at), maxL * 1.3 + 3), rng.fork('leaves-dry'));
  const TONES = 6;
  const tones = Array.from({ length: TONES }, (_, i) => mix(light, dark, i / (TONES - 1)));
  live.forEach(({ l, k }, i) => {
    const r = rng.fork(`lf-${l.id}`);
    const len = l.length * (0.35 + 0.65 * k) * (0.6 + 0.4 * view.scale);
    const poly = dabOutline(at[i]!.x, at[i]!.y, { angle: l.angle, length: len, width: len * (l.width ?? 0.42), variant: l.variant ?? 'leaf', asym: r.range(-0.3, 0.3), curve: l.curve ?? r.range(-0.15, 0.15) }, 7);
    L.fill(poly, tones[Math.min(TONES - 1, Math.round(l.tone * (TONES - 1)))]!, 0.55 + 0.35 * k);
  });
  L.dry({ opacity: 0.85, edge: 0.5, edgeWidth: 0.6, sharpness: 0.75, centreLift: 0.3, granulation: 0.1, flow: 0.35, flowScale: 12, darken: 0.25, ...dry });
}

/** One petal as a single fill (cheap; the layer's drying pass gives it its rim). */
function petalMark(L: WetLayer, at: Pt, pigment: Pigment, angle: number, length: number, width: number, alpha: number, r: Rng): void {
  const poly = dabOutline(at.x, at.y, { angle: angle + r.gaussian(0, 0.05), length, width, variant: 'petal', asym: r.range(-0.3, 0.3), curve: r.range(-0.12, 0.12) }, 6);
  L.fill(poly, pigment, alpha);
}

/** A small irregular blot as a single fill. */
function dotMark(L: WetLayer, at: Pt, pigment: Pigment, rx: number, ry: number, rot: number, alpha: number, r: Rng): void {
  L.fill(blob(at.x, at.y, rx, ry, r, { points: 9, irregularity: 0.28, rotation: rot }), pigment, alpha);
}

/** A few single petals drifting down (only at full bloom). */
export function paintFallingPetals(p: Painter, petals: readonly { x: number; y: number; r: number; rot: number; id: number }[], pigment: Pigment, rng: Rng, amount: number): void {
  if (amount <= 0.01) return;
  for (const pt of petals) {
    const r = rng.fork(`fall-${pt.id}`);
    dab(stableTarget(p, r), pt, pigment, {
      rng: r,
      variant: 'petal',
      angle: pt.rot,
      length: pt.r,
      width: pt.r * 0.75,
      curve: r.range(-0.2, 0.2),
      layers: 3,
      opacity: 0.85 * amount,
      blend: 'source-over',
    });
  }
}
