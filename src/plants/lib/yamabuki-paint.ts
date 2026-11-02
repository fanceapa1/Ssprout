/**
 * Painting helpers for the yamabuki (docs/systems/plants-species-b.md): sharply double-toothed,
 * veined leaves batched into shared wet layers, and thin arching canes. Each mark carries its own
 * seed, so it looks the same at every growth and only its size, angle and opacity change.
 */
import { createRng, type Rng } from '../../core/rng';
import { bounds, dabDry, deformPolygon, jitter, mix, padRect, paintDab, ribbon, shade, smoothPath, type DabOptions, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { dabShape } from '../../paint/primitives';
import { bloomMarks, ribbonInto, type Bloom, type BloomState } from './shrub-paint';
import { petalVector } from './shrub-structure';

export interface BladePose {
  at: Pt;
  angle: number;
  length: number;
  width: number;
  /** axis bend, signed fraction of the length */
  curve: number;
  /** primary teeth per margin (a smaller tooth sits between each pair) */
  teeth: number;
}

export interface Blade {
  outline: Pt[];
  /** the half from the midrib to the shaded margin */
  shadow: Pt[];
  axis: Pt[];
  /** lateral veins, midrib to margin */
  veins: Pt[][];
}

/** Half-width profile: a rounded base, ovate, drawn out into a long pointed tip. */
function profile(t: number): number {
  if (t <= 0) return 0;
  if (t < 0.34) return Math.sin(((t / 0.34) * Math.PI) / 2) ** 0.6;
  return Math.max(0, Math.cos((Math.min(1, (t - 0.34) / 0.66) * Math.PI) / 2)) ** 2;
}

/**
 * The outline of a double-toothed leaf (pure): forward-pointing saw teeth, big and small in turn,
 * along both margins. `shadeSide` picks which half is returned as `shadow`. `rng` jitters the teeth.
 */
export function serratedBlade(b: BladePose, rng: Rng, shadeSide: 1 | -1): Blade {
  const { at, angle, length: L, width: W, curve } = b;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const axisAt = (t: number): Pt => {
    const bend = curve * L * (t * t * 0.7 + Math.sin(Math.PI * t) * 0.15);
    return { x: at.x + ux * L * t + nx * bend, y: at.y + uy * L * t + ny * bend };
  };
  const margin = (t: number, side: number, off: number): Pt => {
    const a = axisAt(t);
    const hw = (W / 2) * profile(t) + off;
    return { x: a.x + nx * hw * side, y: a.y + ny * hw * side };
  };
  const n = b.teeth * 2;
  const t0 = 0.12;
  const t1 = 0.95;
  const dt = (t1 - t0) / n;
  const amps = Array.from({ length: n * 2 }, () => rng.range(0.75, 1.2));
  const side = (s: 1 | -1): Pt[] => {
    const pts: Pt[] = [margin(0.03, s, 0), margin(0.07, s, 0)];
    for (let i = 0; i < n; i++) {
      const ta = t0 + i * dt;
      const big = i % 2 === 0;
      const amp = W * (big ? 0.085 : 0.045) * amps[i * 2 + (s > 0 ? 0 : 1)]! * (0.5 + 0.5 * Math.sqrt(profile(ta)));
      pts.push(margin(ta, s, -amp * 0.35));
      pts.push(margin(ta + dt * 0.72, s, amp * 0.65));
    }
    return pts;
  };
  const right = side(1);
  const left = side(-1);
  const base = axisAt(0);
  const tip = axisAt(1);
  const outline = [base, ...right, tip, ...[...left].reverse()];
  const axis = Array.from({ length: 9 }, (_, i) => axisAt(i / 8));
  const shadow = [base, ...(shadeSide > 0 ? right : left), tip, ...[...axis].reverse()];
  const veins: Pt[][] = [];
  const nv = 5;
  for (let j = 0; j < nv; j++) {
    const t = 0.16 + (j / nv) * 0.62;
    for (const s of [1, -1]) {
      const a = axisAt(t);
      const m = margin(t + 0.13, s, -(W / 2) * profile(t + 0.13) * 0.18);
      veins.push([a, { x: (a.x * 0.45 + m.x * 0.55) + nx * s * W * 0.03, y: (a.y * 0.45 + m.y * 0.55) + ny * s * W * 0.03 }, m]);
    }
  }
  return { outline, shadow, axis, veins };
}

export interface SerratedLeaf extends BladePose {
  pigment: Pigment;
  /** 0..1: fades a young leaf in */
  alpha: number;
  /** which half is in shade (1 or -1) */
  shade: 1 | -1;
  seed: number;
}

/**
 * All leaves in one wet layer: the blade twice (wet edges pool in the teeth), the shaded half
 * flooded darker wet-in-wet, and the midrib and veins lifted pale, as impressed veins catch light.
 */
export function paintSerratedLeaves(p: Painter, leaves: readonly SerratedLeaf[], dry: DryOptions = {}): void {
  const live = leaves.filter((l) => l.length > 0.6 && l.alpha > 0.02);
  if (!live.length) return;
  const blades = live.map((l) => {
    const rng = createRng(l.seed);
    return { l, rng, blade: serratedBlade(l, rng, l.shade) };
  });
  const L = p.layer(padRect(bounds(blades.flatMap((b) => b.blade.outline)), 4));
  let len = 0;
  for (const { l, rng, blade } of blades) {
    const a = 0.5 * l.alpha;
    L.fill(blade.outline, jitter(l.pigment, rng, 0.03), a);
    L.fill(deformPolygon(blade.outline, rng, { depth: 1, variance: 0.06 }), jitter(l.pigment, rng, 0.03), a * 0.7);
    L.fill(deformPolygon(blade.shadow, rng, { depth: 1, variance: 0.05 }), shade(l.pigment, 0.32), a * 0.55);
    if (l.length > 6) {
      const vw = Math.max(0.12, l.width * 0.035);
      L.lift(ribbon(blade.axis.slice(0, 8), (t) => vw * (1 - t * 0.7)), 0.4 * l.alpha);
      for (const v of blade.veins) L.lift(ribbon(v, (t) => vw * 0.8 * (1 - t * 0.8)), 0.28 * l.alpha);
    }
    len += l.length;
  }
  const mean = len / blades.length;
  L.dry({ opacity: 0.88, edge: 0.6, edgeWidth: Math.max(0.3, Math.min(1.2, mean * 0.05)), sharpness: 0.78, centreLift: 0.22, granulation: 0.08, flow: 0.35, flowScale: Math.max(4, mean * 0.7), ...dry });
}

export interface CaneMark {
  pts: Pt[];
  width: number;
  pigment: Pigment;
  seed: number;
  /** a growing tip tapers to a point (default 0.6 of the length) */
  taper?: number;
}

/** Thin canes in one wet layer, with a broken darker line along the shaded underside. */
export function paintCanes(p: Painter, canes: readonly CaneMark[], o: { opacity?: number; accent?: Pigment; accentOpacity?: number } = {}): void {
  const live = canes.filter((c) => c.pts.length >= 2 && c.width > 0.08);
  if (!live.length) return;
  const maxW = Math.max(...live.map((c) => c.width));
  const area = padRect(bounds(live.flatMap((c) => c.pts)), maxW * 2 + 3);
  const L = p.layer(area);
  for (const c of live) {
    ribbonInto(L, c.pts, c.width, c.pigment, createRng(c.seed), { taper: [0.02, c.taper ?? 0.6], pressure: (t) => 1.1 - t * 0.45 });
  }
  L.dry({ opacity: o.opacity ?? 0.9, edge: 0.45, edgeWidth: Math.max(0.35, maxW * 0.22), sharpness: 0.75, centreLift: 0.2, granulation: 0.1, flow: 0.3, flowScale: 10 });
  if (!o.accent) return;
  const A = p.layer(area);
  let any = false;
  for (const c of live) {
    if (c.pts.length < 4) continue;
    const r = createRng(c.seed + 1);
    // the underside of an arch: offset toward +y in plant space, in two or three pieces
    const sp = smoothPath(c.pts, 2);
    const pieces = r.int(2, 3);
    for (let k = 0; k < pieces; k++) {
      const a = Math.floor(sp.length * (k / pieces + r.range(0.02, 0.08)));
      const b = Math.floor(sp.length * ((k + 1) / pieces - r.range(0.05, 0.18)));
      const seg = sp.slice(a, b).map((q) => ({ x: q.x, y: q.y + c.width * 0.28 }));
      if (seg.length < 2) continue;
      ribbonInto(A, seg, Math.max(0.25, c.width * 0.38), o.accent, r, { taper: [0.25, 0.35], fills: 1 });
      any = true;
    }
  }
  if (any) A.dry({ opacity: o.accentOpacity ?? 0.5, edge: 0.3, edgeWidth: 0.4, sharpness: 0.8, flowScale: 8 });
  else A.discard();
}

// ---------------------------------------------------------------------------------------------
// flowers

export interface GoldenFlower {
  bloom: Bloom;
  state: BloomState;
}

export interface GoldenStyle {
  /** deeper gold for the shaded petals and the stamens */
  shade: Pigment;
  /** sepal green */
  sepal: Pigment;
  alpha?: number;
}

const smooth01 = (x: number) => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};

/**
 * Single flowers, bud to open (geometry from `bloomMarks`): clear gold petals painted over the
 * leaves with only a light rim, the back petals a little deeper, a small boss of stamens, and
 * green sepals that hold the bud and fall back as it opens.
 */
export function goldenFlowers(p: Painter, items: readonly GoldenFlower[], o: GoldenStyle): void {
  const live = items.filter((it) => it.state.size >= 0.02);
  if (!live.length) return;
  const alpha = o.alpha ?? 1;
  type Mark = ReturnType<typeof bloomMarks>[number];
  const petals: { m: Mark; shape: ReturnType<typeof dabShape>; r: Rng }[] = [];
  for (const it of live) {
    for (const m of bloomMarks(it.bloom, it.state)) {
      const pigment = m.front < -0.2 ? mix(m.pigment, mix(o.shade, m.pigment, 0.5), 0.35 * it.state.colour) : m.pigment;
      const r = createRng(m.seed);
      petals.push({ m: { ...m, pigment }, shape: dabShape(m.at, m.opts, r), r });
    }
  }
  sepals(p, live, o, alpha);
  // neighbouring petals dry apart, so their overlaps keep an edge
  for (const gi of [0, 1]) {
    const set = petals.filter((_, i) => i % 2 === gi);
    if (!set.length) continue;
    const L = p.layer(padRect(bounds(set.flatMap((x) => x.shape.outline)), 3));
    let len = 0;
    let wid = 0;
    for (const { m, shape, r } of set) {
      paintDab(L, m.at, m.pigment, m.opts, r, p.env, shape);
      if (m.tip) {
        const at = { x: m.at.x + Math.cos(shape.angle) * shape.length * 0.35, y: m.at.y + Math.sin(shape.angle) * shape.length * 0.35 };
        paintDab(L, at, m.tip, { ...m.opts, length: shape.length * 0.66, width: shape.width * 0.8, basePool: 0, pool: 0.3, layers: 2 }, r, p.env);
      }
      len += shape.length;
      wid += shape.width;
    }
    L.dry({ opacity: 0.96 * alpha, blend: 'source-over', edge: 0.42, darken: 0.16, sharpness: 0.7, centreLift: 0.18 }, dabDry(len / set.length, wid / set.length));
  }
  bosses(p, live, o, alpha);
}

function sepals(p: Painter, items: readonly GoldenFlower[], o: GoldenStyle, alpha: number): void {
  const marks: { at: Pt; opts: DabOptions; r: Rng; shape: ReturnType<typeof dabShape> }[] = [];
  for (const it of items) {
    const k = 1 - smooth01((it.state.open - 0.4) / 0.5);
    if (k < 0.03) continue;
    const r = createRng(it.bloom.seed + 7);
    const L = it.bloom.rings[0]!.length * it.state.size;
    for (let j = 0; j < 3; j++) {
      const around = Math.PI / 2 + (j - 1) * 0.85 + r.range(-0.2, 0.2);
      const v = petalVector(around, 0.5 + 1.2 * it.state.open, it.bloom.view, it.bloom.roll);
      const at = { x: it.bloom.x, y: it.bloom.y + L * 0.05 };
      const opts: DabOptions = { angle: v.angle, length: L * 0.5 * Math.max(0.35, v.scale) * k, width: L * 0.22 * k, layers: 2 };
      const rr = createRng(r.int(1, 0x7fffffff));
      marks.push({ at, opts, r: rr, shape: dabShape(at, opts, rr) });
    }
  }
  if (!marks.length) return;
  const L = p.layer(padRect(bounds(marks.flatMap((m) => m.shape.outline)), 3));
  for (const m of marks) paintDab(L, m.at, o.sepal, m.opts, m.r, p.env, m.shape);
  L.dry({ opacity: 0.8 * alpha, edge: 0.5 }, dabDry(5, 2.5));
}

/** A ring of small deeper-gold stamen heads at each open flower's heart. */
function bosses(p: Painter, items: readonly GoldenFlower[], o: GoldenStyle, alpha: number): void {
  const open = items.filter((it) => it.state.open > 0.4);
  if (!open.length) return;
  const L = p.layer(padRect(bounds(open.map((it) => ({ x: it.bloom.x, y: it.bloom.y }))), 6));
  for (const it of open) {
    const k = smooth01((it.state.open - 0.4) / 0.45);
    const r = createRng(it.bloom.seed + 3);
    const s = it.bloom.rings[0]!.length * it.state.size * 0.36;
    const squash = 0.55 + 0.45 * Math.sin(it.bloom.view);
    const heart = Array.from({ length: 10 }, (_, j) => {
      const a = (j / 10) * Math.PI * 2;
      return { x: it.bloom.x + Math.cos(a) * s * 0.95, y: it.bloom.y + Math.sin(a) * s * 0.95 * squash };
    });
    L.fill(deformPolygon(heart, r, { depth: 2, variance: 0.15 }), mix(o.shade, '#f0c23c', 0.55), 0.7 * k);
    for (let j = 0; j < 9; j++) {
      const a = (j / 9) * Math.PI * 2 + r.range(-0.25, 0.25);
      const d = s * r.range(0.45, 0.95);
      const at = { x: it.bloom.x + Math.cos(a) * d, y: it.bloom.y + Math.sin(a) * d * squash };
      const dot = s * r.range(0.22, 0.34) * (0.5 + 0.5 * k);
      const quad = [
        { x: at.x - dot, y: at.y },
        { x: at.x, y: at.y - dot * 0.8 },
        { x: at.x + dot, y: at.y },
        { x: at.x, y: at.y + dot * 0.8 },
      ];
      L.fill(deformPolygon(quad, r, { depth: 2, variance: 0.2 }), mix(o.shade, '#b9781c', r.range(0, 0.35)), 0.75 * k);
    }
  }
  L.dry({ opacity: 0.85 * alpha, blend: 'source-over', edge: 0.4, edgeWidth: 0.4, granulation: 0.3, flowScale: 4 });
}
