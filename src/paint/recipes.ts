/**
 * Higher-level recipes composed from the primitives: foliage clumps, grass tufts, stones and
 * water. These encode the painting order a watercolourist would use (light → mid → dark,
 * wet-in-wet first, details last) so scene and plant code gets a convincing result in one call.
 */
import type { Rng } from '../core/rng';
import {
  blob,
  bounds,
  centroid,
  deformPolygon,
  innerClip,
  isEllipse,
  organicOutline,
  outlineLayer,
  padRect,
  pointInPolygon,
  stoneShape,
  toPolygon,
  type Polygon,
  type Pt,
  type Shape,
} from './geometry';
import { PIGMENTS, darken, jitter, lighten, mix, rgba, shade, type Pigment } from './pigments';
import {
  glaze,
  granulate,
  inkLine,
  layerAlpha,
  layersFor,
  lift,
  paintDab,
  PAPER_WHITE,
  ripple,
  wash,
  wetInWet,
  type PaintTarget,
} from './primitives';
import { DRY_DEFAULTS, WetLayer, tracePath, type ResolvedDry } from './wet';

// ---------------------------------------------------------------------------------------------
// foliage

export interface FoliagePigments {
  light: Pigment;
  mid: Pigment;
  shadow: Pigment;
  /** small dark accents (default derived from shadow) */
  dark?: Pigment;
}

export const FOLIAGE_GREEN: FoliagePigments = {
  light: PIGMENTS.sageLight,
  mid: PIGMENTS.sap,
  shadow: PIGMENTS.sage,
  dark: PIGMENTS.olive,
};

export interface FoliageOptions {
  rng?: Rng;
  /** direction light comes FROM (radians; default upper-left, -2.3) */
  light?: number;
  /** height / width of the clump (default 0.62) */
  flatness?: number;
  /** dab density multiplier (default 1) */
  density?: number;
  /** dab radius as a fraction of the clump radius (default 0.2) */
  dabSize?: number;
  /** strength of the shadow side, 0..1 (default 0.6) */
  shadow?: number;
  /** overall opacity (default 0.85) */
  opacity?: number;
  /** paper gaps inside the clump, 0..1 (default 0.35) */
  gaps?: number;
}

/** Foliage dab placement (pure): positions, radii and how lit each one is (-1 shadow … 1 lit). */
export function foliageLayout(center: Pt, radius: number, rng: Rng, o: FoliageOptions = {}): { x: number; y: number; r: number; lit: number; edge: number }[] {
  const flat = o.flatness ?? 0.62;
  const dabR = radius * (o.dabSize ?? 0.2);
  const lightA = o.light ?? -2.3;
  const lx = Math.cos(lightA);
  const ly = Math.sin(lightA);
  const outline = blob(center.x, center.y, radius, radius * flat, rng, { points: 16, irregularity: 0.22, flatBottom: 0.5 });
  const count = Math.round((o.density ?? 1) * 2.2 * (radius / dabR) ** 2);
  const out: { x: number; y: number; r: number; lit: number; edge: number }[] = [];
  let tries = 0;
  while (out.length < count && tries < count * 8) {
    tries++;
    const x = center.x + rng.range(-1, 1) * radius * 1.05;
    const y = center.y + rng.range(-1, 1) * radius * flat * 1.05;
    if (!pointInPolygon({ x, y }, outline)) continue;
    const nx = (x - center.x) / radius;
    const ny = (y - center.y) / (radius * flat);
    const d = Math.hypot(nx, ny);
    // directional light plus a top-lit bias; rim dabs read lighter (sky behind)
    const lit = Math.max(-1, Math.min(1, (nx * -lx + ny * -ly) * -0.9 - ny * 0.35));
    out.push({ x, y, r: dabR * rng.range(0.6, 1.25) * (1 - d * 0.25), lit, edge: d });
  }
  return out;
}

/**
 * A foliage clump like the cloud-pads of a Japanese garden tree or a shrub: clustered round
 * dabs that merge wet-in-wet into a scalloped mass, a mid-tone pass, a cool shadow glaze on the
 * side away from the light and a few dark accents. Paper shows through small gaps.
 *
 * @example p.foliageClump({ x: 200, y: 140 }, 70, FOLIAGE_GREEN, { light: -2.4 })
 */
export function foliageClump(t: PaintTarget, center: Pt, radius: number, pigments: FoliagePigments = FOLIAGE_GREEN, opts: FoliageOptions = {}): void {
  const rng = opts.rng ?? t.env.rng;
  const dabs = foliageLayout(center, radius, rng, opts);
  const opacity = opts.opacity ?? 0.85;
  const shadowK = opts.shadow ?? 0.6;
  const gaps = opts.gaps ?? 0.35;
  const maxR = dabs.reduce((m, d) => Math.max(m, d.r), 0);
  const area = padRect(bounds(dabs.map((d) => ({ x: d.x, y: d.y }))), maxR * 1.4 + 4);
  const nL = layersFor(t.env, 3);
  const blot = (L: WetLayer, d: { x: number; y: number; r: number }, p: Pigment, scale: number, alpha: number) => {
    const r = d.r * scale;
    const poly = blob(d.x, d.y, r, r * rng.range(0.7, 0.95), rng, {
      points: 24,
      irregularity: 0.2,
      scallop: 0.9,
      scallops: rng.int(5, 8),
      rotation: rng.range(-0.5, 0.5),
    });
    const a = layerAlpha(nL, alpha);
    for (let k = 0; k < nL; k++) L.fill(deformPolygon(poly, rng, { depth: 2, variance: 0.08, cap: r * 0.06 }), jitter(p, rng, 0.03), a);
  };
  const dry = (o: Partial<ResolvedDry>): ResolvedDry => ({
    ...DRY_DEFAULTS,
    edge: 0.5,
    edgeWidth: Math.max(1, radius * 0.03),
    sharpness: 0.7,
    centreLift: 0.3,
    granulation: 0.12,
    flow: 0.45,
    flowScale: radius * 0.5,
    ...o,
  });

  // 1. light body: every dab, merged wet-in-wet into one scalloped mass
  const L1 = new WetLayer(t.ctx, area, t.env);
  for (const d of dabs) blot(L1, d, d.lit > 0.2 ? pigments.light : mix(pigments.light, pigments.mid, 0.5), 1, 0.8);
  // paper gaps: lift a few small holes, more on the lit side
  const holes = Math.round(gaps * dabs.length * 0.12);
  for (let i = 0; i < holes; i++) {
    const d = dabs[rng.int(0, dabs.length - 1)]!;
    if (d.edge > 0.8) continue;
    const r = d.r * rng.range(0.25, 0.5);
    L1.lift(deformPolygon(blob(d.x + rng.gaussian(0, d.r * 0.5), d.y + rng.gaussian(0, d.r * 0.4), r, r * 0.7, rng, { points: 9, irregularity: 0.3 }), rng, { depth: 1, variance: 0.2 }), rng.range(0.6, 0.95));
  }
  L1.dry({}, dry({ opacity: opacity * 0.85 }));

  // 2. mid-tone: dabs on the side away from the light, smaller, separate wet edges
  const L2 = new WetLayer(t.ctx, area, t.env);
  for (const d of dabs) {
    if (d.lit > 0.15 || !rng.chance(0.65)) continue;
    blot(L2, { x: d.x + rng.gaussian(0, d.r * 0.2), y: d.y + d.r * 0.2, r: d.r }, pigments.mid, rng.range(0.75, 1.05), 0.7);
  }
  L2.dry({}, dry({ opacity: opacity * 0.42, edge: 0.32, sharpness: 0.55 }));

  // 3. shadow: underside dabs, cooler
  const L3 = new WetLayer(t.ctx, area, t.env);
  const sh = shade(pigments.shadow, 0.25);
  for (const d of dabs) {
    if (d.lit > -0.3 || !rng.chance(0.7 * shadowK + 0.2)) continue;
    blot(L3, { x: d.x, y: d.y + d.r * 0.3, r: d.r }, sh, rng.range(0.6, 0.9), 0.7);
  }
  L3.dry({}, dry({ opacity: opacity * 0.3 * (0.5 + shadowK), edge: 0.3, sharpness: 0.5, centreLift: 0.2 }));

  // 4. a few dark accents tucked under the mass
  const dark = pigments.dark ?? darken(pigments.shadow, 0.25);
  const L4 = new WetLayer(t.ctx, area, t.env);
  let accents = 0;
  for (const d of dabs) {
    if (d.lit > -0.6 || !rng.chance(0.14)) continue;
    blot(L4, { x: d.x + rng.gaussian(0, d.r * 0.3), y: d.y + d.r * 0.45, r: d.r }, dark, rng.range(0.3, 0.5), 0.75);
    accents++;
  }
  if (accents) L4.dry({}, dry({ opacity: opacity * 0.3, edge: 0.35 }));
  else L4.discard();
}

// ---------------------------------------------------------------------------------------------
// grass

export interface GrassOptions {
  rng?: Rng;
  /** tallest blade (default 40) */
  height?: number;
  /** horizontal spread of the blade bases (default height × 0.5) */
  spread?: number;
  /** number of blades (default random 7–12) */
  blades?: number;
  /** overall lean in radians (default random ±0.15) */
  lean?: number;
  /** blade pigments, light to dark (default sap/sage/olive family) */
  pigments?: Pigment[];
  /** soft ground wash under the tuft (default true) */
  ground?: boolean;
  /** overall opacity (default 0.85) */
  opacity?: number;
}

/**
 * A grass tuft: blades fanning from a base, back blades paler, front blades darker and more
 * curved, sitting in a soft ground wash.
 *
 * @example p.grassTuft({ x: 120, y: 300 }, { height: 36 })
 */
export function grassTuft(t: PaintTarget, base: Pt, opts: GrassOptions = {}): void {
  const rng = opts.rng ?? t.env.rng;
  const H = opts.height ?? 40;
  const spread = opts.spread ?? H * 0.5;
  const n = opts.blades ?? rng.int(9, 15);
  const lean = opts.lean ?? rng.range(-0.15, 0.15);
  const pig = opts.pigments ?? [PIGMENTS.sageLight, PIGMENTS.sap, PIGMENTS.sage, PIGMENTS.olive];
  const opacity = opts.opacity ?? 0.85;
  if (opts.ground ?? true) {
    glaze(t, { cx: base.x, cy: base.y - H * 0.02, rx: spread * 1.1 + H * 0.3, ry: H * 0.1 }, mix(PIGMENTS.sap, PIGMENTS.sageLight, 0.4), {
      rng,
      opacity: 0.2 * opacity,
      fade: { angle: -Math.PI / 2, start: 0.2, amount: 0.9 },
    });
  }
  const area = padRect({ x: base.x - spread - H, y: base.y - H * 1.3, w: (spread + H) * 2, h: H * 1.45 }, 4);
  const blade = (L: WetLayer, i: number, back: boolean) => {
    const u = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5..0.5 across the tuft
    const bx = base.x + u * spread * 1.4 + rng.gaussian(0, spread * 0.12);
    const fan = u * 1.3 + rng.gaussian(0, 0.12);
    const len = H * (back ? rng.range(0.55, 1) : rng.range(0.4, 0.85)) * (1 - Math.abs(u) * 0.5);
    const p = back ? pig[rng.int(0, Math.min(1, pig.length - 1))]! : pig[rng.int(Math.min(1, pig.length - 1), pig.length - 1)]!;
    paintDab(
      L,
      { x: bx, y: base.y + rng.range(0, H * 0.04) },
      p,
      {
        variant: 'blade',
        angle: -Math.PI / 2 + lean + fan * 0.55,
        length: len,
        width: H * rng.range(0.035, 0.06),
        curve: Math.sign(fan || rng.range(-1, 1)) * rng.range(0.15, 0.55) + lean * 0.5,
        asym: rng.range(-0.4, 0.4),
        pool: 0.4,
        basePool: 0.45,
        layers: 3,
      },
      rng,
    );
  };
  const back = new WetLayer(t.ctx, area, t.env);
  const nb = Math.max(2, Math.round(n * 0.6));
  for (let i = 0; i < nb; i++) blade(back, rng.int(0, n - 1), true);
  back.dry({}, { ...DRY_DEFAULTS, opacity: opacity * 0.7, edge: 0.5, edgeWidth: Math.max(0.6, H * 0.012), sharpness: 0.75, centreLift: 0.2, granulation: 0.1, flow: 0.3, flowScale: H * 0.4 });
  const front = new WetLayer(t.ctx, area, t.env);
  for (let i = 0; i < n; i++) blade(front, i, false);
  front.dry({}, { ...DRY_DEFAULTS, opacity: opacity * 0.85, edge: 0.55, edgeWidth: Math.max(0.6, H * 0.012), sharpness: 0.8, centreLift: 0.2, granulation: 0.1, flow: 0.3, flowScale: H * 0.4 });
}

// ---------------------------------------------------------------------------------------------
// stones

export interface StoneOptions {
  rng?: Rng;
  /** body pigment (default stone grey) */
  pigment?: Pigment;
  /** warmth 0..1 — mixes toward warm stone (default 0.35) */
  warm?: number;
  /** direction light comes FROM (default upper-left, -2.2) */
  light?: number;
  /** moss amount 0..1 (default 0.3; 0 = none) */
  moss?: number;
  /** granulation strength 0..1 (default 0.35) */
  granulation?: number;
  /** ink accent along the shadowed underside, 0..1 opacity (default 0.3; 0 = none) */
  ink?: number;
  /** soft cast shadow on the ground (default true) */
  groundShadow?: boolean;
  /** darker blotches on the body (default 2–4) */
  patches?: number;
  /** reserve the stone's area first (paint paper-white under it) so it is opaque over water or
   * grass painted earlier (default true) */
  reserve?: boolean;
}

/** A stone box `{ x, y, w, h }` with its base at `(x, y)` — matches scene rocks. */
export interface StoneBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const isBox = (s: Shape | StoneBox): s is StoneBox => !Array.isArray(s) && 'w' in s;

/**
 * A garden boulder: warm grey wash lit from above with moss bleeding wet-in-wet into it, soft
 * darker blotches, a cool underside glaze, granulation, an occasional broken ink accent at the
 * base and a soft cast shadow.
 *
 * @example p.stone({ x: 300, y: 220, w: 140, h: 80 }, { moss: 0.4 })
 */
export function stone(t: PaintTarget, shape: Shape | StoneBox, opts: StoneOptions = {}): void {
  const rng = opts.rng ?? t.env.rng;
  const poly: Polygon = isBox(shape) ? stoneShape(shape.x, shape.y, shape.w, shape.h, rng) : isEllipse(shape) ? toPolygon(shape, rng) : shape.slice();
  const b = bounds(poly);
  const c = centroid(poly);
  const size = (b.w + b.h) / 2;
  const lightA = opts.light ?? -2.2;
  const warm = opts.warm ?? 0.35;
  const body = mix(opts.pigment ?? PIGMENTS.stone, PIGMENTS.stoneWarm, warm);
  const mossK = opts.moss ?? 0.3;
  const gran = opts.granulation ?? 0.35;

  if (opts.groundShadow ?? true) {
    glaze(t, { cx: c.x + b.w * 0.08, cy: b.y + b.h * 0.97, rx: b.w * 0.62, ry: b.h * 0.12 }, mix(PIGMENTS.olive, PIGMENTS.stoneDark, 0.5), {
      rng,
      opacity: 0.3,
      fade: { angle: -Math.PI / 2, start: 0.55, amount: 0.7 },
    });
  }

  // 1. body wash, lighter toward the light, moss dropped in wet-in-wet
  const mossDrops =
    mossK > 0
      ? Array.from({ length: rng.int(1, 1 + Math.round(mossK * 2)) }, () => {
          const top = rng.chance(0.6);
          return {
            pigment: jitter(rng.chance(0.5) ? PIGMENTS.sage : PIGMENTS.sap, rng, 0.03),
            at: {
              x: b.x + b.w * rng.range(0.2, 0.8),
              y: top ? b.y + b.h * rng.range(0.08, 0.3) : b.y + b.h * rng.range(0.8, 0.95),
            },
            size: rng.range(0.25, 0.42) * (0.55 + mossK),
            alpha: 0.35 + mossK * 0.35,
          };
        })
      : undefined;
  const o = organicOutline(poly, rng, { deform: 0.15 });
  if (opts.reserve ?? true) {
    // reserve the stone's paper: an opaque white under the washes, slightly inset so no halo
    const r = innerClip(o, Math.max(1, Math.min(b.w, b.h) * 0.04));
    t.ctx.save();
    t.ctx.beginPath();
    r.forEach((q, i) => (i ? t.ctx.lineTo(q.x, q.y) : t.ctx.moveTo(q.x, q.y)));
    t.ctx.closePath();
    t.ctx.fillStyle = PAPER_WHITE;
    t.ctx.fill();
    t.ctx.restore();
  }
  wash(t, o.base, lighten(body, 0.1), {
    rng,
    deform: 0.08,
    spread: 0.3,
    opacity: 0.62,
    edge: 0.55,
    edgeWidth: Math.max(1.2, size * 0.012),
    centreLift: 0.2,
    granulation: 0.25 * gran + 0.05,
    flow: 0.45,
    flowScale: size * 0.35,
    fade: { angle: lightA, start: 0.3, amount: 0.5, ragged: 0.4 },
    drops: mossDrops,
  });

  // 2. soft darker blotches, clipped to the stone
  const patches = opts.patches ?? rng.int(2, 4);
  const L = new WetLayer(t.ctx, padRect(b, size * 0.1 + 4), t.env);
  L.ctx.save();
  L.clip(innerClip(o));
  for (let i = 0; i < patches; i++) {
    // biased toward the side away from the light and toward the lower half
    const ax = c.x - Math.cos(lightA) * b.w * rng.range(0.05, 0.3) + rng.gaussian(0, b.w * 0.15);
    const ay = c.y - Math.sin(lightA) * b.h * rng.range(0, 0.25) + rng.gaussian(0, b.h * 0.12);
    const r = size * rng.range(0.12, 0.24);
    const patch = organicOutline(blob(ax, ay, r * rng.range(1, 1.6), r * rng.range(0.55, 0.85), rng, { irregularity: 0.3, rotation: rng.range(-0.4, 0.4) }), rng, { deform: 0.35 });
    const n = layersFor(t.env, 4);
    for (let k = 0; k < n; k++) L.fill(outlineLayer(patch, rng, 0.5), jitter(PIGMENTS.stoneDark, rng, 0.03), layerAlpha(n, 0.65));
  }
  // 3. cool underside glaze in the same wet layer (it merges softly with the blotches)
  const S = L;
  const shadow = organicOutline(
    blob(c.x - Math.cos(lightA) * b.w * 0.14, b.y + b.h * 1.02, b.w * 0.64, b.h * 0.6, rng, { irregularity: 0.28 }),
    rng,
    { deform: 0.4 },
  );
  const sn = layersFor(t.env, 6);
  const sp = shade(PIGMENTS.stoneDark, 0.3);
  for (let k = 0; k < sn; k++) {
    // each layer fades out toward the top at a slightly different height: a soft, turning edge
    const top = b.y + b.h * rng.range(0.3, 0.55);
    const g = S.ctx.createLinearGradient(0, top, 0, b.y + b.h * rng.range(0.75, 0.9));
    const pj = jitter(sp, rng, 0.02);
    g.addColorStop(0, rgba(pj, 0));
    g.addColorStop(1, rgba(pj, layerAlpha(sn, 0.7)));
    tracePath(S.ctx, outlineLayer(shadow, rng, 0.5));
    S.ctx.fillStyle = g;
    S.ctx.fill();
  }
  S.ctx.restore();
  S.dry({}, { ...DRY_DEFAULTS, opacity: 0.36, edge: 0.32, edgeWidth: Math.max(1, size * 0.015), sharpness: 0.32, centreLift: 0.1, granulation: 0.3 * gran, flow: 0.45, flowScale: size * 0.28 });

  // 4. granulation over the body
  if (gran > 0) granulate(t, o.base, PIGMENTS.stoneDark, { rng, strength: gran * 0.55 });

  // 5. a broken ink accent along part of the shadowed underside (lost elsewhere)
  const ink = opts.ink ?? 0.3;
  if (ink > 0) {
    // the longest contiguous run of outline points below the centre, in outline order
    const below = poly.map((p) => p.y > c.y + b.h * 0.15);
    let best: Pt[] = [];
    for (let s = 0; s < poly.length; s++) {
      if (!below[s] || below[(s - 1 + poly.length) % poly.length]) continue;
      const run: Pt[] = [];
      for (let k = 0; k < poly.length && below[(s + k) % poly.length]; k++) run.push(poly[(s + k) % poly.length]!);
      if (run.length > best.length) best = run;
    }
    const lower = best;
    if (lower.length > 3) {
      const from = Math.floor(lower.length * rng.range(0.15, 0.4));
      const to = Math.ceil(lower.length * rng.range(0.65, 0.9));
      const seg = lower.slice(from, to).map((p) => ({ x: p.x, y: p.y - size * 0.008 }));
      if (seg.length > 1) inkLine(t, seg, { rng, width: Math.max(0.8, size * 0.011), opacity: ink, breaks: 0.35, pigment: mix(PIGMENTS.sumi, PIGMENTS.stoneDark, 0.35) });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// water

export interface WaterOptions {
  rng?: Rng;
  /** light, mid, deep celadon (default palette celadons) */
  pigments?: [Pigment, Pigment, Pigment];
  /** number of soft horizontal bands (default 5) */
  bands?: number;
  /** number of ripple groups (default 3) */
  ripples?: number;
  /** pale reflection streak strength 0..1 (default 0.5) */
  reflection?: number;
  /** darker water under the far bank, 0..1 (default 0.55) */
  farShadow?: number;
  /** granulation 0..1 (default 0.4) */
  granulation?: number;
}

/**
 * A body of still water: celadon washed wet-in-wet (deeper toward the far bank), soft
 * horizontal banding, lifted pale reflection streaks and a few ripple lines. Paints over an
 * opaque ground (it lifts paper colour), so use it on backgrounds.
 *
 * @example p.waterBody(scene.pond, { ripples: 4 })
 */
export function waterBody(t: PaintTarget, shape: Shape, opts: WaterOptions = {}): void {
  const rng = opts.rng ?? t.env.rng;
  const [pl, pm, pd] = opts.pigments ?? [PIGMENTS.celadon, PIGMENTS.celadonMid, PIGMENTS.celadonDeep];
  const poly = toPolygon(shape, rng);
  const gran = opts.granulation ?? 0.4;
  const o = organicOutline(poly, rng, { deform: 0.1, detail: 40 });
  const b = o.bounds;
  const far = opts.farShadow ?? 0.55;

  // 1. body: pale celadon bleeding into a deeper tone toward the far bank
  wetInWet(t, o.base, lighten(pl, 0.1), mix(pl, pm, 0.6), {
    rng,
    angle: -Math.PI / 2,
    split: 0.62,
    softness: 0.45,
    fingers: 0.3,
    deform: 0.04,
    spread: 0.15,
    opacity: 0.78,
    edge: 0.5,
    edgeWidth: Math.max(1.5, b.h * 0.012),
    centreLift: 0.15,
    granulation: 0.3 * gran,
    flow: 0.3,
    flowScale: b.w * 0.25,
  });

  // 2. soft bands: a deep band under the far bank and thin horizontal streaks
  const L = new WetLayer(t.ctx, padRect(b, 4), t.env);
  L.ctx.save();
  L.clip(innerClip(o));
  if (far > 0) {
    const fb = organicOutline(blob(b.x + b.w * 0.5, b.y + b.h * 0.02, b.w * 0.62, b.h * 0.16, rng, { irregularity: 0.1, points: 32 }), rng, { deform: 0.2 });
    const n = layersFor(t.env, 8);
    for (let k = 0; k < n; k++) L.fill(outlineLayer(fb, rng, 0.5), jitter(pd, rng, 0.02), layerAlpha(n, 0.45 * far + 0.1));
  }
  const bands = opts.bands ?? 5;
  for (let i = 0; i < bands; i++) {
    const y = b.y + b.h * (0.18 + (0.72 * (i + rng.next() * 0.7)) / bands);
    const w = b.w * rng.range(0.35, 0.8);
    const x = b.x + rng.range(w / 2, b.w - w / 2);
    const band = organicOutline(blob(x, y, w / 2, b.h * rng.range(0.012, 0.035), rng, { irregularity: 0.1, points: 24 }), rng, { deform: 0.2 });
    const n = layersFor(t.env, 5);
    for (let k = 0; k < n; k++) L.fill(outlineLayer(band, rng, 0.5), jitter(rng.chance(0.6) ? pm : pd, rng, 0.02), layerAlpha(n, rng.range(0.15, 0.32)));
  }
  L.ctx.restore();
  L.dry({}, { ...DRY_DEFAULTS, opacity: 0.6, edge: 0.15, edgeWidth: Math.max(2, b.h * 0.02), sharpness: 0.2, centreLift: 0, granulation: 0.35 * gran, flow: 0.4, flowScale: b.w * 0.12 });

  // 3. pale reflection streaks lifted out
  const refl = opts.reflection ?? 0.5;
  if (refl > 0) {
    const count = rng.int(2, 3);
    for (let i = 0; i < count; i++) {
      const y = b.y + b.h * rng.range(0.35, 0.75);
      const w = b.w * rng.range(0.2, 0.45);
      const x = b.x + b.w * rng.range(0.25, 0.75);
      const streak = blob(x, y, w / 2, b.h * rng.range(0.006, 0.016), rng, { irregularity: 0.1, points: 20 });
      const clipped = streak.map((p) => (pointInPolygon(p, o.base) ? p : nearestInside(p, o.base, b)));
      lift(t, clipped, { rng, amount: refl * rng.range(0.35, 0.6), deform: 0.15, spread: 0.4, sharpness: 0.25 });
    }
  }

  // 4. ripple lines
  const nr = opts.ripples ?? 3;
  for (let i = 0; i < nr; i++) {
    for (let tries = 0; tries < 12; tries++) {
      const p = { x: b.x + b.w * rng.range(0.15, 0.85), y: b.y + b.h * rng.range(0.35, 0.85) };
      const w = b.w * rng.range(0.08, 0.15);
      if (!pointInPolygon(p, o.base) || !pointInPolygon({ x: p.x - w / 2, y: p.y }, o.base) || !pointInPolygon({ x: p.x + w / 2, y: p.y }, o.base)) continue;
      ripple(t, p, { rng, width: w, count: rng.int(2, 3), lineWidth: Math.max(0.8, b.h * 0.005) });
      break;
    }
  }
}

/** Pull a point toward the rect centre until it lies inside the polygon (keeps lifts inside water). */
function nearestInside(p: Pt, poly: readonly Pt[], b: { x: number; y: number; w: number; h: number }): Pt {
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  for (let k = 1; k <= 8; k++) {
    const q = { x: p.x + (c.x - p.x) * (k / 8), y: p.y + (c.y - p.y) * (k / 8) };
    if (pointInPolygon(q, poly)) return q;
  }
  return c;
}
