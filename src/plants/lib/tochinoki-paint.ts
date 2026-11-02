/**
 * Painting helpers for the tochinoki (docs/devlog/89-tochinoki.md): palmate leaf hands as fans of
 * long leaflets from one point, and upright candle panicles of cream florets with pink blotches.
 * Shapes are pure; each mark carries its own seed, so only its size, angle and opacity change.
 */
import { createRng, type Rng } from '../../core/rng';
import { blob, bounds, deformPolygon, jitter, mix, padRect, ribbon, shade, type DryOptions, type Painter, type Pigment, type Pt } from '../../paint';
import { softRes, stableLayer } from './tree-paint';

// ---------------------------------------------------------------------------------------------
// hands

export interface HandMark {
  id: string;
  /** where the leaflets meet (top of the petiole), species units */
  at: Pt;
  /** direction of the middle leaflet */
  facing: number;
  /** angle between the outer leaflets */
  spread: number;
  /** vertical foreshortening of the fan (1 = seen face-on, 0.4 = a rosette seen edge-on) */
  squash: number;
  /** length of the middle leaflet */
  length: number;
  /** leaflet lengths relative to the middle one, outer to outer */
  lens: number[];
  /** leaflet width as a fraction of its length */
  width: number;
  /** leaflet droop (axis bend) */
  droop: number;
  pigment: Pigment;
  shadePigment: Pigment;
  alpha: number;
  seed: number;
}

export interface Leaflet {
  outline: Pt[];
  /** the half on the shaded side of the midrib */
  shadow: Pt[];
  axis: Pt[];
}

/** Obovate: a narrow wedge at the base, widest past the middle, drawn out into a short point. */
function leafletProfile(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.66) return Math.sin(((t / 0.66) * Math.PI) / 2) ** 1.35;
  const u = (t - 0.66) / 0.34;
  return (1 - u ** 1.5) ** 1.6;
}

/** The leaflets of one hand (pure). */
export function handShape(h: HandMark): Leaflet[] {
  const rng = createRng(h.seed);
  const n = h.lens.length;
  const out: Leaflet[] = [];
  const sq = (x: number, y: number): Pt => ({ x: h.at.x + x, y: h.at.y + y * h.squash });
  for (let k = 0; k < n; k++) {
    const u = n === 1 ? 0 : k / (n - 1) - 0.5;
    const a = h.facing + u * h.spread + rng.gaussian(0, 0.05);
    const L = h.length * h.lens[k]!;
    const W = L * h.width * rng.range(0.9, 1.1);
    // outer leaflets droop more, toward the side they splay to
    const bend = (h.droop + rng.gaussian(0, 0.04)) * (0.4 + Math.abs(u) * 1.2) * (u === 0 ? (rng.chance(0.5) ? 1 : -1) : Math.sign(Math.cos(a)) || 1);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const gap = h.length * 0.06;
    const axisAt = (t: number) => {
      const b = bend * L * t * t * 0.5;
      return { x: ux * (gap + L * t) + nx * b, y: uy * (gap + L * t) + ny * b };
    };
    const S = 10;
    const right: Pt[] = [];
    const left: Pt[] = [];
    const axis: Pt[] = [];
    const wob = Array.from({ length: S + 1 }, () => rng.range(0.92, 1.08));
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      const c = axisAt(t);
      const hw = (W / 2) * leafletProfile(t) * wob[i]!;
      right.push(sq(c.x + nx * hw, c.y + ny * hw));
      left.push(sq(c.x - nx * hw, c.y - ny * hw));
      axis.push(sq(c.x, c.y));
    }
    const base = axis[0]!;
    const tip = axis[S]!;
    const outline = [base, ...right.slice(1, S), tip, ...left.slice(1, S).reverse()];
    const shadeRight = Math.sin(a) < 0 ? 1 : -1;
    const half = shadeRight > 0 ? right : left;
    const shadow = [base, ...half.slice(1, S), tip, ...axis.slice(1, S).reverse()];
    out.push({ outline, shadow, axis });
  }
  return out;
}

/** Hands in one wet layer: each leaflet laid twice, its shaded half flooded darker, midrib lifted. */
export function paintHands(p: Painter, hands: readonly HandMark[], rng: Rng, dry: DryOptions = {}): void {
  const live = hands.filter((h) => h.length > 0.6 && h.alpha > 0.02);
  if (!live.length) return;
  const shapes = live.map((h) => ({ h, r: createRng(h.seed + 17), leaflets: handShape(h) }));
  const L = stableLayer(p, padRect(bounds(shapes.flatMap((s) => s.leaflets.flatMap((l) => l.outline))), 4), rng.fork('hands-dry'));
  let len = 0;
  for (const { h, r, leaflets } of shapes) {
    const a = 0.72 * h.alpha;
    for (const lf of leaflets) {
      L.fill(lf.outline, jitter(h.pigment, r, 0.035), a);
      L.fill(deformPolygon(lf.outline, r, { depth: 1, variance: 0.06 }), jitter(h.pigment, r, 0.03), a * 0.55);
      L.fill(deformPolygon(lf.shadow, r, { depth: 1, variance: 0.05 }), h.shadePigment, a * 0.6);
      if (h.length > 7) {
        const vw = Math.max(0.14, h.length * 0.012);
        L.lift(ribbon(lf.axis.slice(0, 9), (t) => vw * (1 - t * 0.8)), 0.3 * h.alpha);
      }
    }
    len += h.length;
  }
  const mean = len / shapes.length;
  L.dry({ opacity: 0.88, edge: 0.55, edgeWidth: Math.max(0.35, Math.min(1.2, mean * 0.045)), sharpness: 0.76, centreLift: 0.22, granulation: 0.1, flow: 0.4, flowScale: Math.max(5, mean * 0.6), darken: 0.28, ...dry });
}

/** Long thin petioles from the twig to each hand, in one layer. */
export function paintPetioles(p: Painter, stalks: readonly { from: Pt; to: Pt; width: number; alpha: number }[], pigment: Pigment, rng: Rng): void {
  const live = stalks.filter((s) => s.alpha > 0.02 && Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) > 0.8);
  if (!live.length) return;
  const L = stableLayer(p, padRect(bounds(live.flatMap((s) => [s.from, s.to])), 3), rng.fork('petioles-dry'));
  for (const s of live) {
    const mid = { x: (s.from.x + s.to.x) / 2, y: (s.from.y + s.to.y) / 2 - Math.abs(s.to.x - s.from.x) * 0.08 };
    L.fill(ribbon([s.from, mid, s.to], (t) => s.width * (1 - 0.4 * t)), pigment, 0.7 * s.alpha);
  }
  L.dry({ opacity: 0.8, edge: 0.4, edgeWidth: 0.4, sharpness: 0.8, centreLift: 0.1, granulation: 0.05, flowScale: 6 });
}

// ---------------------------------------------------------------------------------------------
// candles

export interface CandleMark {
  id: string;
  /** base of the panicle */
  at: Pt;
  angle: number;
  length: number;
  /** width at its widest, near the base */
  width: number;
  /** 0 = a green bud … 1 = open cream florets */
  open: number;
  alpha: number;
  seed: number;
}

export interface Candle {
  /** the cone's outline */
  outline: Pt[];
  /** florets: centre and radius, base first */
  florets: { x: number; y: number; r: number }[];
  /** the pink and yellow blotches at the florets' hearts */
  blotches: { x: number; y: number; r: number; pink: boolean }[];
  /** the side away from the light */
  shadow: Pt[];
}

/** Cone half-width along the axis: full near the base, a blunt rounded tip. */
function coneProfile(t: number): number {
  if (t <= 0) return 0.55;
  if (t >= 1) return 0;
  return t < 0.18 ? 0.55 + 0.45 * (t / 0.18) : Math.cos((((t - 0.18) / 0.82) * Math.PI) / 2) ** 0.75;
}

/** A candle panicle (pure): a lumpy cone of florets, blotched pink low and yellow high. */
export function candleShape(c: CandleMark): Candle {
  const rng = createRng(c.seed);
  const ux = Math.cos(c.angle);
  const uy = Math.sin(c.angle);
  const nx = -uy;
  const ny = ux;
  const at = (t: number, s: number): Pt => {
    const hw = (c.width / 2) * coneProfile(t) * s;
    return { x: c.at.x + ux * c.length * t + nx * hw, y: c.at.y + uy * c.length * t + ny * hw };
  };
  const S = 9;
  const right = Array.from({ length: S + 1 }, (_, i) => at(i / S, 1));
  const left = Array.from({ length: S + 1 }, (_, i) => at(i / S, -1));
  const outline = [...right, ...left.slice(0, S).reverse()];
  const shadow = [...right, ...Array.from({ length: S }, (_, i) => at((S - 1 - i) / S, 0.1))];
  const florets: Candle['florets'] = [];
  const blotches: Candle['blotches'] = [];
  const rows = 7;
  for (let i = 0; i < rows; i++) {
    const t = 0.06 + (i / rows) * 0.88 + rng.range(-0.03, 0.03);
    const across = Math.max(1, Math.round(3 * coneProfile(t) + 0.3));
    for (let j = 0; j < across; j++) {
      const s = across === 1 ? rng.range(-0.25, 0.25) : (j / (across - 1)) * 1.5 - 0.75 + rng.range(-0.12, 0.12);
      const q = at(t, s);
      const r = c.width * rng.range(0.15, 0.22) * (0.7 + 0.3 * coneProfile(t));
      florets.push({ x: q.x, y: q.y, r });
      if (rng.chance(0.42)) blotches.push({ x: q.x + rng.range(-0.3, 0.3) * r, y: q.y + rng.range(-0.2, 0.3) * r, r: r * rng.range(0.32, 0.45), pink: t < 0.55 ? rng.chance(0.8) : rng.chance(0.3) });
    }
  }
  return { outline, florets, blotches, shadow };
}

/** Candles: cream florets source-over the leaves, then blotches and a cool shade multiplied. */
export function paintCandles(p: Painter, candles: readonly CandleMark[], rng: Rng, pig: { cream: Pigment; bud: Pigment; pink: Pigment; yellow: Pigment; shade: Pigment }): void {
  const live = candles.filter((c) => c.length > 0.6 && c.alpha > 0.02);
  if (!live.length) return;
  const shapes = live.map((c) => ({ c, r: createRng(c.seed + 5), s: candleShape(c) }));
  const area = padRect(bounds(shapes.flatMap((x) => x.s.outline)), 4);
  const body = stableLayer(p, area, rng.fork('candle-body-dry'));
  for (const { c, r, s } of shapes) {
    const col = mix(pig.bud, pig.cream, Math.min(1, c.open * 1.25));
    const a = c.alpha;
    body.fill(s.outline, col, 0.4 * a);
    for (const f of s.florets) body.fill(blob(f.x, f.y, f.r, f.r * r.range(0.8, 1), r, { points: 8, irregularity: 0.3 }), jitter(col, r, 0.02), 0.75 * a);
  }
  body.dry({ opacity: 0.94, edge: 0.4, edgeWidth: 0.45, sharpness: 0.72, centreLift: 0.12, granulation: 0.06, flow: 0.25, flowScale: 6, darken: 0.18, blend: 'source-over' });
  const deep = stableLayer(p, area, rng.fork('candle-deep-dry'), softRes(p));
  let any = false;
  for (const { c, r, s } of shapes) {
    const k = Math.max(0, (c.open - 0.45) / 0.55);
    deep.fill(deformPolygon(s.shadow, r, { depth: 1, variance: 0.08 }), pig.shade, 0.32 * c.alpha);
    any = true;
    if (k <= 0.02) continue;
    for (const b of s.blotches) deep.fill(blob(b.x, b.y, b.r * k, b.r * k * 0.8, r, { points: 7, irregularity: 0.3 }), b.pink ? pig.pink : pig.yellow, 0.85 * c.alpha);
  }
  if (any) deep.dry({ opacity: 0.8, edge: 0.35, edgeWidth: 0.35, sharpness: 0.7, centreLift: 0.1, granulation: 0.05, flowScale: 5 });
  else deep.discard();
}

/** Shade pigment for a hand pigment. */
export const handShade = (pig: Pigment, k = 0.22) => shade(pig, k);
