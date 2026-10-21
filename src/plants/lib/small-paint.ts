/**
 * Painting helpers shared by the tier 1–2 species (docs/systems/plants-species-a.md).
 *
 * Every helper takes an element rng (a `fork` of the plant's stream with a stable label) and
 * splits it again per engine call, so the brush marks of one leaf or petal are identical at
 * every growth value — only their size, angle and opacity change. That is what makes the
 * cross-faded growth steps read as one plant growing rather than a re-rolled one.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, lighten, mix, shade, type DabVariant, type Painter, type Pigment, type Pt } from '../../paint';
import type { SpeciesDef, SpeciesDrawOptions } from '../types';
import { clamp01, easeOut, ease, lerp, smooth, visible } from './small-growth';
import { UP, lerpAngle, pathLen, petalPose, subPath, type FlowerView, type PetalPlan } from './small-structure';

/** Direction light comes from (upper left), as in the scene recipes. */
export const LIGHT = -2.3;

/** Earth for seed mounds; cool green-grey for ground shadows; stem greens. */
export const EARTH = mix(PIGMENTS.stoneWarm, PIGMENTS.wood, 0.35);
export const GROUND = mix(PIGMENTS.sap, PIGMENTS.shadow, 0.35);
export const STEM = mix(PIGMENTS.sage, PIGMENTS.olive, 0.4);
export const INK_GREEN = mix(PIGMENTS.olive, PIGMENTS.sumi, 0.45);

/** Flank of a mark at `angle` that faces away from the light (1 or −1, as `poolSide`). */
export function shadowSide(angle: number): 1 | -1 {
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  return nx * Math.cos(LIGHT) + ny * Math.sin(LIGHT) > 0 ? -1 : 1;
}

/**
 * Set up plant-local units: base at the anchor, 1 unit = 1 world unit at slot scale 1 (the
 * canvas is `w × h` px for a `size` box). Returns the restore function.
 */
export function plantFrame(p: Painter, def: Pick<SpeciesDef, 'size' | 'anchor'>, o: SpeciesDrawOptions): () => void {
  const s = Math.min(o.w / def.size.w, o.h / def.size.h);
  p.ctx.save();
  p.ctx.translate(def.anchor.x * o.w, def.anchor.y * o.h);
  p.ctx.scale(s, s);
  return () => p.ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// ground

/** Soft cool shadow wash where the plant meets the ground, fading upward. */
export function groundShadow(p: Painter, rng: Rng, o: { rx: number; ry?: number; x?: number; k: number; pigment?: Pigment; opacity?: number }): void {
  if (!visible(o.k)) return;
  const ry = o.ry ?? o.rx * 0.2;
  p.glaze({ cx: o.x ?? 0, cy: -ry * 0.15, rx: o.rx, ry }, o.pigment ?? GROUND, {
    rng: rng.fork('ground'),
    opacity: (o.opacity ?? 0.2) * clamp01(o.k),
    edge: 0.08,
    sharpness: 0.25,
    fade: { angle: UP, start: 0.25, amount: 0.9 },
  });
}

/**
 * The seed stage: a small mound of turned earth with the seed on it. The mound is there from
 * growth 0 and settles into a faint patch as the plant takes over; the seed fades as the first
 * shoot breaks through (0.06–0.16).
 */
export function seedMound(p: Painter, rng: Rng, g: number, o: { rx: number; x?: number }): void {
  const x = o.x ?? 0;
  const settle = ease(g, 0.08, 0.4);
  const mound = 0.42 * (0.75 + 0.25 * ease(g, 0, 0.05)) * (1 - 0.7 * settle);
  p.wash({ cx: x, cy: -o.rx * 0.1, rx: o.rx, ry: o.rx * 0.3 }, EARTH, {
    rng: rng.fork('mound'),
    opacity: mound,
    edge: 0.35,
    centreLift: 0.35,
    granulation: 0.35,
    fade: { angle: UP, start: 0.55, amount: 0.6 },
  });
  const seed = 1 - ease(g, 0.06, 0.16);
  if (visible(seed)) {
    p.dab({ x: x + o.rx * 0.12, y: -o.rx * 0.2 }, mix(PIGMENTS.wood, PIGMENTS.sumi, 0.35), {
      rng: rng.fork('seed'),
      variant: 'round',
      angle: -0.4,
      length: o.rx * 0.26,
      width: o.rx * 0.18,
      opacity: 0.85 * seed,
    });
  }
}

// ---------------------------------------------------------------------------------------------
// stems & leaves

export interface StemStyle {
  width: number;
  pigment?: Pigment;
  opacity?: number;
  /** opacity of a sparse sumi line over part of the stem (0 = none) */
  ink?: number;
  /** how much of the stem the ink line covers, from the base (default 0.8) */
  inkReach?: number;
  inkPigment?: Pigment;
  wetness?: number;
}

/** A stem: a tapered brush stroke, optionally with a broken ink line over part of it. */
export function paintStem(p: Painter, rng: Rng, pts: readonly Pt[], o: StemStyle): void {
  const len = pathLen(pts);
  if (len < Math.max(0.4, o.width * 0.8)) return;
  const w = o.width * clamp01(0.45 + len / (o.width * 30));
  p.stroke(pts, {
    rng: rng.fork('stroke'),
    pigment: o.pigment ?? STEM,
    width: w,
    taper: [0.04, 0.3],
    pressure: [1, 0.85, 0.7],
    wobble: 0.2,
    wetness: o.wetness ?? 0.45,
    opacity: (o.opacity ?? 0.85) * smooth(len / (o.width * 10)),
    edge: 0.4,
  });
  if (o.ink && len > o.width * 4) {
    p.inkLine(subPath(pts, o.inkReach ?? 0.8), {
      rng: rng.fork('ink'),
      width: Math.max(0.25, w * 0.42),
      pigment: o.inkPigment ?? INK_GREEN,
      opacity: o.ink,
      breaks: 0.35,
      wobble: 0.25,
      taper: [0.1, 0.4],
    });
  }
}

export interface LeafStyle {
  pigment: Pigment;
  /** cool shadow glaze on the shaded flank (default `shade(pigment, 0.35)`; null = none) */
  shadow?: Pigment | null;
  variant?: DabVariant;
  opacity?: number;
  /** ink midrib opacity (0 = none) */
  vein?: number;
}

export interface LeafPose {
  angle: number;
  length: number;
  width: number;
  curve?: number;
  asym?: number;
  /** unfurl progress 0..1 */
  k: number;
  /** direction the leaf points while still folded (e.g. the stem's) — it swings out from here */
  fold?: number;
}

/** Axis points of a dab (same bend formula as the engine's `dabOutline`). */
export function dabAxis(at: Pt, angle: number, length: number, curve: number, n = 6, reach = 1): Pt[] {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * reach;
    const bend = curve * length * (t * t * 0.7 + Math.sin(Math.PI * t) * 0.15);
    pts.push({ x: at.x + ux * length * t - uy * bend, y: at.y + uy * length * t + ux * bend });
  }
  return pts;
}

/**
 * A leaf: a dab with pigment pooled on the shaded flank, a cooler glaze over that flank and an
 * optional faint ink midrib. `k` unfurls it: it grows from nothing, starts narrow (rolled) and
 * swings out from `fold` to its final angle.
 */
export function paintLeaf(p: Painter, rng: Rng, at: Pt, pose: LeafPose, style: LeafStyle): void {
  const k = clamp01(pose.k);
  if (!visible(k)) return;
  const e = easeOut(k);
  const length = pose.length * e;
  if (length < 0.3) return;
  const width = pose.width * e * lerp(0.35, 1, smooth(k));
  const angle = pose.fold !== undefined ? lerpAngle(pose.fold, pose.angle, smooth(k)) : pose.angle;
  const curve = (pose.curve ?? 0) * lerp(0.3, 1, k);
  const op = (style.opacity ?? 0.75) * lerp(0.55, 1, smooth(k * 2)) * smooth(k * 8);
  const side = shadowSide(angle);
  const variant = style.variant ?? 'leaf';
  p.dab(at, style.pigment, {
    rng: rng.fork('leaf'),
    variant,
    angle,
    length,
    width,
    curve,
    asym: pose.asym ?? 0,
    pool: 0.55,
    poolSide: side,
    basePool: 0.35,
    opacity: op,
  });
  if (style.shadow !== null && width > 0.3) {
    const nx = -Math.sin(angle) * side;
    const ny = Math.cos(angle) * side;
    p.dab({ x: at.x + nx * width * 0.2, y: at.y + ny * width * 0.2 }, style.shadow ?? shade(style.pigment, 0.35), {
      rng: rng.fork('shadow'),
      variant,
      angle,
      length: length * 0.88,
      width: width * 0.5,
      curve,
      asym: 0.4 * side,
      pool: 0,
      basePool: 0.25,
      layers: 3,
      opacity: op * 0.28 * smooth((width - 0.3) / 1.5),
      edge: 0.04,
      sharpness: 0.2,
      centreLift: 0,
    });
  }
  if (style.vein && length > 5) {
    p.inkLine(dabAxis(at, angle, length, curve, 6, 0.7), {
      rng: rng.fork('vein'),
      width: Math.max(0.22, width * 0.06),
      pigment: INK_GREEN,
      opacity: style.vein * smooth(k),
      breaks: 0.4,
      wobble: 0.2,
      taper: [0.05, 0.6],
    });
  }
}

// ---------------------------------------------------------------------------------------------
// petals, buds, flowers

export interface PetalStyle {
  pigment: Pigment;
  /** pigment bled in wet-in-wet from the base (e.g. a deeper throat) */
  inner?: Pigment;
  /** how far the inner colour reaches (0..1 of the petal, default 0.5) */
  innerReach?: number;
  /** width of the inner colour as a fraction of the petal width (default from the reach) */
  innerWidth?: number;
  /** pigment bled in at the tip */
  tip?: Pigment;
  opacity?: number;
  /** opaque light petals (painted source-over so they stay pale over any ground) */
  white?: boolean;
  variant?: DabVariant;
  edge?: number;
}

/** One petal: its own wet layer, base and tip colours bleeding wet-in-wet, pooled rim. */
export function paintPetal(
  p: Painter,
  rng: Rng,
  at: Pt,
  pose: { angle: number; length: number; width: number; curve?: number; asym?: number },
  style: PetalStyle,
): void {
  const { length, width } = pose;
  if (length < 0.3 || width < 0.15) return;
  const r = length * 1.15 + width;
  const L = p.layer({ x: at.x - r, y: at.y - r, w: r * 2, h: r * 2 });
  const variant = style.variant ?? 'petal';
  const common = { variant, angle: pose.angle, curve: pose.curve ?? 0, asym: pose.asym ?? 0 };
  p.dabInto(L, at, style.pigment, { ...common, rng: rng.fork('body'), length, width, pool: 0.45, poolSide: shadowSide(pose.angle), basePool: 0.2 });
  if (style.inner) {
    const reach = style.innerReach ?? 0.5;
    p.dabInto(L, at, style.inner, { ...common, rng: rng.fork('inner'), length: length * reach, width: width * (style.innerWidth ?? 0.35 + reach * 0.4), pool: 0, basePool: 0.45, layers: 2 });
  }
  if (style.tip) {
    const u = { x: Math.cos(pose.angle), y: Math.sin(pose.angle) };
    p.dabInto(L, { x: at.x + u.x * length * 0.5, y: at.y + u.y * length * 0.5 }, style.tip, {
      ...common,
      variant: 'round',
      rng: rng.fork('tip'),
      length: length * 0.48,
      width: width * 0.7,
      pool: 0,
      basePool: 0,
      layers: 2,
    });
  }
  L.dry({
    opacity: style.opacity ?? 0.85,
    edge: style.edge ?? 0.55,
    edgeWidth: Math.max(0.25, Math.min(2.2, width * 0.12)),
    sharpness: 0.7,
    centreLift: 0.3,
    granulation: 0.06,
    flow: 0.4,
    flowScale: Math.max(3, length * 0.7),
    darken: style.white ? 0.18 : 0.3,
    blend: style.white ? 'source-over' : 'multiply',
  });
}

export interface FlowerPaint {
  petals: readonly PetalPlan[];
  view: FlowerView;
  /** 0 = closed bud … 1 = fully open */
  open: number;
  /** petal length at full opening (world units) */
  size: number;
  /** petal width as a fraction of its length */
  width: number;
  /** relative petal length while closed (default 0.45) */
  closedLen?: number;
  /** extra curl added while closed (cupped petals) */
  cup?: number;
  style: PetalStyle;
  /** per-petal colour variation (default 0.04) */
  tone?: number;
  /** per-petal style overrides (by index into `petals`) */
  styleFor?: (i: number) => Partial<PetalStyle> | undefined;
}

/**
 * A radial flower seen in perspective (`view`), painted back to front so near petals glaze over
 * far ones. While `open` < 1 the petals are gathered toward the flower's face direction.
 */
export function petalFlower(p: Painter, rng: Rng, c: Pt, f: FlowerPaint): void {
  const order = f.petals
    .map((pl, i) => ({ pl, i, pose: petalPose(pl.a, f.view, f.open, f.closedLen) }))
    .sort((a, b) => a.pose.depth - b.pose.depth);
  const o = clamp01(f.open);
  for (const { pl, i, pose } of order) {
    const length = f.size * pl.len * pose.len;
    const width = f.size * f.width * pl.wid * lerp(0.6, 1, o) * lerp(0.75, 1, pose.len);
    const tone = f.tone ?? 0.04;
    const pigment = tone > 0 ? mix(f.style.pigment, pl.tone > 0.5 ? PIGMENTS.petalWhite : shade(f.style.pigment, 0.4), Math.abs(pl.tone - 0.5) * 2 * tone * 4) : f.style.pigment;
    paintPetal(
      p,
      rng.fork(`petal-${i}`),
      c,
      { angle: pose.angle, length, width, curve: pl.curve + (f.cup ?? 0) * (1 - o) * Math.sign(Math.cos(pl.a) || 1) },
      { ...f.style, pigment, ...f.styleFor?.(i) },
    );
  }
}

export interface BloomPaint extends Omit<FlowerPaint, 'open'> {
  /** bud swelling 0..1 */
  budK: number;
  /** petal opening 0..1 */
  openK: number;
  /** direction the closed bud points */
  budAngle: number;
  /** bud length and width (world units) at full swell */
  budLen: number;
  budWidth: number;
  /** how far the bud has coloured, 0 = green … 1 = bloom colour */
  colourK: number;
  green?: Pigment;
  sepals?: number;
}

/**
 * Bud → flower in one continuous mark: a single bud body swells and colours, then, as the
 * petals swing open from it, the bud body dissolves into them (its opacity falls while the
 * petals' rises), so no step of the growth sequence pops.
 */
export function bloom(p: Painter, rng: Rng, c: Pt, b: BloomPaint): void {
  const fade = 1 - smooth(b.openK / 0.55);
  if (visible(b.budK) && visible(fade)) {
    paintBud(p, rng.fork('bud'), c, {
      angle: b.budAngle,
      length: b.budLen * lerp(1, 1.2, b.openK),
      width: b.budWidth * lerp(1, 1.3, b.openK),
      k: b.budK,
      colour: b.colourK,
      pigment: b.style.pigment,
      green: b.green,
      sepals: b.sepals,
      opacity: (b.style.opacity ?? 0.85) * fade,
      white: b.style.white,
    });
  }
  if (visible(b.openK)) {
    petalFlower(p, rng.fork('petals'), c, {
      ...b,
      open: b.openK,
      style: { ...b.style, opacity: (b.style.opacity ?? 0.85) * smooth(b.openK / 0.35) },
    });
  }
}

/**
 * A closed bud: a petal-shaped body whose colour moves from green to the bloom colour as it
 * swells (`k` 0..1, `colour` 0..1), cupped by small sepals.
 */
export function paintBud(
  p: Painter,
  rng: Rng,
  at: Pt,
  o: { angle: number; length: number; width: number; k: number; colour: number; pigment: Pigment; green?: Pigment; sepals?: number; sepalLen?: number; opacity?: number; white?: boolean },
): void {
  const k = clamp01(o.k);
  if (!visible(k)) return;
  const green = o.green ?? PIGMENTS.sage;
  const e = easeOut(k);
  const len = o.length * e;
  const wid = o.width * e;
  if (len < 0.3) return;
  const body = mix(green, o.pigment, clamp01(o.colour));
  paintPetal(
    p,
    rng.fork('bud'),
    at,
    { angle: o.angle, length: len, width: wid },
    { pigment: body, inner: green, innerReach: 0.45, opacity: (o.opacity ?? 0.85) * lerp(0.6, 1, k), white: o.white && o.colour > 0.5 },
  );
  const n = o.sepals ?? 2;
  const sl = len * (o.sepalLen ?? 0.45);
  if (n > 0 && sl > 0.4) {
    // sepals merge in one wet layer so where they overlap they don't knot up darker
    const L = p.layer({ x: at.x - sl * 1.3, y: at.y - sl * 1.3, w: sl * 2.6, h: sl * 2.6 });
    for (let i = 0; i < n; i++) {
      const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * 1.1;
      p.dabInto(L, at, green, { rng: rng.fork(`sepal-${i}`), variant: 'leaf', angle: o.angle + spread, length: sl, width: wid * 0.42, curve: -spread * 0.4, pool: 0.3, basePool: 0.1, layers: 3 });
    }
    L.dry({ opacity: 0.7 * lerp(0.6, 1, k) * ((o.opacity ?? 0.85) / 0.85), edge: 0.45, edgeWidth: Math.max(0.2, wid * 0.08), sharpness: 0.7, centreLift: 0.2, granulation: 0.05, flow: 0.3, flowScale: Math.max(2, sl) });
  }
}

/**
 * A toothed leaf (strawberry, balloon flower, anemone): one wet layer holding the blade dab plus
 * small forward-pointing tooth dabs along both margins, so the silhouette is serrated but the
 * leaf dries as a single wash; a darker band down the midrib bleeds in wet-in-wet.
 */
export function toothedLeaf(
  p: Painter,
  rng: Rng,
  at: Pt,
  pose: { angle: number; length: number; width: number; curve?: number },
  style: { pigment: Pigment; teeth?: number; toothSize?: number; toothAngle?: number; opacity?: number; vein?: number; midrib?: Pigment | null },
): void {
  const { angle, length, width } = pose;
  if (length < 0.3 || width < 0.15) return;
  const curve = pose.curve ?? 0;
  const r = length * 1.2 + width;
  const L = p.layer({ x: at.x - r, y: at.y - r, w: r * 2, h: r * 2 });
  const side = shadowSide(angle);
  p.dabInto(L, at, style.pigment, { rng: rng.fork('blade'), variant: 'leaf', angle, length, width, curve, asym: 0, pool: 0.5, poolSide: side, basePool: 0.3, layers: 4 });
  const n = style.teeth ?? 5;
  const axis = dabAxis(at, angle, length, curve, 24);
  const ts = style.toothSize ?? 1;
  for (let i = 0; i < n; i++) {
    const t = 0.28 + (0.58 * (i + 0.5)) / n;
    const q = axis[Math.round(t * 24)]!;
    const q2 = axis[Math.min(24, Math.round(t * 24) + 1)]!;
    const ta = Math.atan2(q2.y - q.y, q2.x - q.x);
    const hw = width * 0.5 * Math.sin(Math.PI * t ** 0.76) ** 0.85;
    for (const sgn of [-1, 1]) {
      const nx = -Math.sin(ta) * sgn;
      const ny = Math.cos(ta) * sgn;
      const tl = Math.min(length * 0.13, width * 0.32) * ts * (1 - t * 0.4);
      p.dabInto(L, { x: q.x + nx * hw * 0.62, y: q.y + ny * hw * 0.62 }, style.pigment, {
        rng: rng.fork(`t-${i}-${sgn}`),
        variant: 'leaf',
        angle: ta + sgn * (style.toothAngle ?? 0.85),
        length: tl,
        width: tl * 0.75,
        pool: 0,
        basePool: 0,
        layers: 2,
      });
    }
  }
  if (style.midrib !== null) {
    p.dabInto(L, at, style.midrib ?? shade(style.pigment, 0.3), { rng: rng.fork('mid'), variant: 'blade', angle, length: length * 0.85, width: width * 0.16, curve, pool: 0, basePool: 0.3, layers: 2 });
  }
  L.dry({
    opacity: (style.opacity ?? 0.8) * smooth(length / 2.5),
    edge: 0.55,
    edgeWidth: Math.max(0.25, Math.min(2, width * 0.08)),
    sharpness: 0.72,
    centreLift: 0.3,
    granulation: 0.1,
    flow: 0.35,
    flowScale: Math.max(3, length * 0.6),
  });
  if (style.vein && length > 4) {
    p.inkLine(dabAxis(at, angle, length, curve, 6, 0.75), { rng: rng.fork('vein'), width: Math.max(0.2, width * 0.04), pigment: INK_GREEN, opacity: style.vein, breaks: 0.4, wobble: 0.2, taper: [0.05, 0.6] });
  }
}

/**
 * A compound leaf of toothed leaflets (strawberry, anemone) radiating from one point, seen in
 * perspective and unfolding from a folded bunch as `open` goes 0 → 1.
 */
export function leafletFan(
  p: Painter,
  rng: Rng,
  at: Pt,
  plan: readonly PetalPlan[],
  view: FlowerView,
  open: number,
  size: number,
  tone: Pigment,
  o: { vein?: number; width?: number; teeth?: number; toothSize?: number; opacity?: number } = {},
): void {
  const poses = plan.map((pl, i) => ({ pl, i, pose: petalPose(pl.a, view, open, 0.75) })).sort((a, b) => a.pose.depth - b.pose.depth);
  for (const { pl, i, pose } of poses) {
    toothedLeaf(
      p,
      rng.fork(`lf-${i}`),
      at,
      { angle: pose.angle, length: size * pl.len * pose.len, width: size * (o.width ?? 0.62) * pl.wid * lerp(0.45, 1, open), curve: pl.curve },
      {
        pigment: mix(tone, pl.tone > 0.5 ? lighten(tone, 0.25) : shade(tone, 0.2), Math.abs(pl.tone - 0.5)),
        teeth: o.teeth ?? 6,
        toothSize: o.toothSize,
        vein: (o.vein ?? 0) * open,
        opacity: o.opacity ?? 0.8,
      },
    );
  }
}

/** A few short ink stamens/anthers around a centre (sparingly). */
export function stamens(p: Painter, rng: Rng, c: Pt, o: { count: number; length: number; view: FlowerView; opacity: number; pigment?: Pigment; width?: number }): void {
  if (!visible(o.opacity) || o.length < 0.4) return;
  for (let i = 0; i < o.count; i++) {
    const a = (i / o.count) * Math.PI * 2 + rng.fork(`sa-${i}`).range(-0.4, 0.4);
    const pose = petalPose(a, o.view, 1);
    const L = o.length * (0.6 + 0.4 * rng.fork(`sl-${i}`).next()) * pose.len;
    const end = { x: c.x + Math.cos(pose.angle) * L, y: c.y + Math.sin(pose.angle) * L };
    p.inkLine([c, { x: (c.x + end.x) / 2, y: (c.y + end.y) / 2 + L * 0.06 }, end], {
      rng: rng.fork(`st-${i}`),
      width: o.width ?? 0.35,
      pigment: o.pigment ?? PIGMENTS.sumi,
      opacity: o.opacity,
      breaks: 0,
      wobble: 0.1,
      taper: [0.3, 0.1],
    });
  }
}

/**
 * A tiny flower (a few world units across) painted in a single wet layer: at that size the
 * petals' overlaps would only read as dark knots, so they merge wet-in-wet instead. Cheaper
 * than `petalFlower` (one drying pass per flower) — for forget-me-nots, florets, umbels.
 */
export function smallBlossom(
  p: Painter,
  rng: Rng,
  c: Pt,
  o: {
    petals: readonly PetalPlan[];
    view: FlowerView;
    open: number;
    size: number;
    width?: number;
    pigment: Pigment;
    inner?: Pigment;
    opacity?: number;
    white?: boolean;
    closedLen?: number;
  },
): void {
  if (o.size < 0.25) return;
  const r = o.size * 1.5 + 1;
  const L = p.layer({ x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 });
  o.petals.forEach((pl, i) => {
    const pose = petalPose(pl.a, o.view, o.open, o.closedLen ?? 0.5);
    const length = o.size * pl.len * pose.len;
    const width = o.size * (o.width ?? 0.75) * pl.wid * lerp(0.6, 1, clamp01(o.open));
    p.dabInto(L, c, o.pigment, { rng: rng.fork(`b-${i}`), variant: 'petal', angle: pose.angle, length, width, curve: pl.curve, pool: 0.3, basePool: 0.15, layers: 3 });
    if (o.inner) {
      p.dabInto(L, c, o.inner, { rng: rng.fork(`i-${i}`), variant: 'petal', angle: pose.angle, length: length * 0.4, width: width * 0.5, pool: 0, basePool: 0.4, layers: 2 });
    }
  });
  L.dry({
    opacity: o.opacity ?? 0.88,
    edge: 0.5,
    edgeWidth: Math.max(0.2, o.size * 0.08),
    sharpness: 0.7,
    centreLift: 0.25,
    granulation: 0.05,
    flow: 0.3,
    flowScale: Math.max(2, o.size),
    darken: o.white ? 0.18 : 0.28,
    blend: o.white ? 'source-over' : 'multiply',
  });
}
