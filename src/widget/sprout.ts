import { createRng } from '../core/rng';
import {
  brushStroke,
  clamp01,
  cubic,
  inkLine,
  leafOutline,
  lerp,
  PIGMENT,
  smooth,
  transform,
  wash,
  type Ctx,
  type P,
} from './brush';

/**
 * The widget's placeholder plant: a seeded sprout that grows with session progress — ink stem,
 * 2–5 leaves unfolding in turn, a bud from ~70 %, opening into a flower at completion.
 *
 * It is one implementation of `PlantPainter`; the card takes any painter, so the chosen
 * species (`species.draw` at cached growth stages) can replace it without touching the widget.
 */

export interface PlantBox {
  /** base point (where the stem meets the soil), in canvas units */
  x: number;
  y: number;
  /** full-grown height */
  h: number;
}

export interface PlantPaintState {
  /** 0..1 */
  growth: number;
  /** 0..1, how open the flower is */
  bloom: number;
  seed: string;
  paused: boolean;
}

export type PlantPainter = (ctx: Ctx, box: PlantBox, s: PlantPaintState) => void;

/** Soil mound with a pebble and a few blades of grass, under any plant. */
export function paintSoil(ctx: Ctx, box: PlantBox, seed: string): void {
  const rng = createRng(`soil:${seed}`);
  const w = box.h * 0.55;
  const mound: P[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const x = box.x + (t - 0.5) * w;
    const bump = Math.sin(t * Math.PI) * box.h * 0.045 * (1 + rng.range(-0.25, 0.25));
    mound.push({ x, y: box.y - bump + 1 });
  }
  for (let i = 18; i >= 0; i--) {
    const t = i / 18;
    mound.push({ x: box.x + (t - 0.5) * w * 0.92, y: box.y + box.h * 0.022 + rng.range(-0.6, 0.6) });
  }
  ctx.globalCompositeOperation = 'multiply';
  wash(ctx, mound, rng.fork('mound'), { color: PIGMENT.stoneWarm, alpha: 0.13, layers: 4, jitter: 1.2, rim: 0.22, lost: 0.7 });
  // a pebble
  const pb: P = { x: box.x + w * rng.range(0.22, 0.32), y: box.y - box.h * 0.004 };
  const pebble: P[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pebble.push({ x: pb.x + Math.cos(a) * box.h * 0.034 * rng.range(0.9, 1.1), y: pb.y + Math.sin(a) * box.h * 0.02 * rng.range(0.9, 1.1) });
  }
  wash(ctx, pebble, rng.fork('pebble'), { color: PIGMENT.stone, alpha: 0.22, layers: 3, jitter: 0.5, rim: 0.4 });
  // grass blades
  const g = rng.fork('grass');
  for (let i = 0; i < 5; i++) {
    const bx = box.x + (g.next() < 0.5 ? -1 : 1) * w * g.range(0.18, 0.46);
    const len = box.h * g.range(0.06, 0.12);
    const lean = g.range(-0.5, 0.5);
    const pts: P[] = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      pts.push({ x: bx + lean * len * t * t, y: box.y - len * t });
    }
    brushStroke(ctx, pts, g, { width: (t) => (1 - t) * 1.6 + 0.2, color: PIGMENT.sap, alpha: 0.42 });
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** The placeholder sprout (PlantPainter). */
export const paintSprout: PlantPainter = (ctx, box, s) => {
  const g = clamp01(s.growth);
  const bloom = clamp01(s.bloom);
  const rng = createRng(`sprout:${s.seed}`);
  const H = box.h;
  ctx.save();
  if (s.paused) ctx.globalAlpha = 0.62; // a held breath: the sprout pales, it does not vanish

  // --- stem -------------------------------------------------------------------------------
  const st = rng.fork('stem');
  const lean = st.range(-0.1, 0.1) * H;
  const h = H * (0.1 + 0.9 * (1 - Math.pow(1 - g, 1.6)));
  const hook = (1 - smooth(0, 0.16, g)) * H * 0.05; // a germinating shoot nods at the top
  const base: P = { x: box.x, y: box.y };
  const top: P = { x: box.x + lean * g + hook, y: box.y - h + hook * 0.4 };
  const c1: P = { x: box.x + st.range(-0.06, 0.06) * H, y: box.y - h * 0.38 };
  const c2: P = { x: top.x - lean * 0.7 + st.range(-0.05, 0.05) * H, y: box.y - h * 0.72 };
  const stemAt = (t: number) => cubic(base, c1, c2, top, t);
  const stemPts = Array.from({ length: 26 }, (_, i) => stemAt(i / 25));
  const thick = 0.8 + 0.6 * g;

  ctx.globalCompositeOperation = 'multiply';
  brushStroke(ctx, stemPts, st.fork('wash'), { width: (t) => (3.6 - 2.2 * t) * thick, color: PIGMENT.sage, alpha: 0.5, edge: 0.2 });

  // --- leaves -----------------------------------------------------------------------------
  const lf = rng.fork('leaves');
  const n = lf.int(2, 5);
  const firstSide = lf.chance(0.5) ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const r = lf.fork(`leaf${i}`);
    const start = 0.05 + (i * 0.6) / n;
    const u = smooth(start, start + 0.24, g); // 0 = folded bud, 1 = open
    if (u <= 0.01) continue;
    const t = n === 1 ? 0.5 : lerp(0.24, 0.8, i / (n - 1)) + r.range(-0.04, 0.04);
    const at = stemAt(t);
    const side = i % 2 === 0 ? firstSide : -firstSide;
    const open = r.range(0.95, 1.25) - (i / n) * 0.2;
    const angle = -Math.PI / 2 + side * lerp(0.18, open, u) + side * (1 - t) * 0.15 * u;
    const len = H * r.range(0.24, 0.32) * (1 - 0.28 * (i / n)) * lerp(0.28, 1, u);
    const wid = len * r.range(0.38, 0.48) * lerp(0.45, 1, u);
    const local = leafOutline(len, wid, r.fork('shape'), { tipBend: -side * r.range(0.05, 0.16) });
    const pts = transform(local, at, angle);
    wash(ctx, pts, r.fork('w1'), { color: PIGMENT.sage, alpha: 0.24, layers: 4, jitter: 0.7, rim: 0.42, rimColor: PIGMENT.olive, lost: 0.35 });
    // cooler glaze on the shaded half
    const half = transform(local.slice(0, Math.ceil(local.length / 2)).concat([{ x: len, y: 0 }]), at, angle);
    wash(ctx, half, r.fork('w2'), { color: PIGMENT.olive, alpha: 0.12, layers: 2, jitter: 0.5 });
    // midrib, faint
    const rib = Array.from({ length: 8 }, (_, k) => transform([{ x: (k / 7) * len * 0.82, y: 0 }], at, angle)[0]!);
    ctx.globalCompositeOperation = 'source-over';
    inkLine(ctx, rib, r.fork('rib'), { width: (q) => (1 - q) * 0.7 + 0.15, alpha: 0.28 });
    ctx.globalCompositeOperation = 'multiply';
  }

  // --- bud / flower -------------------------------------------------------------------------
  const bud = smooth(0.62, 0.94, g);
  const tip = stemAt(1);
  const pre = stemAt(0.94);
  const dir = Math.atan2(tip.y - pre.y, tip.x - pre.x);
  if (bud > 0.01) {
    const b = rng.fork('bud');
    const blen = H * 0.12 * lerp(0.35, 1, bud);
    if (bloom > 0.01) {
      // petals unfold from the bud direction to a full five-petal face
      const e = 1 - Math.pow(1 - bloom, 2);
      const centre: P = { x: tip.x + Math.cos(dir) * blen * 0.35 * e, y: tip.y + Math.sin(dir) * blen * 0.35 * e };
      const off = b.range(0, Math.PI * 2);
      for (let k = 0; k < 5; k++) {
        const pr = b.fork(`petal${k}`);
        const closedA = dir + (k - 2) * 0.22;
        const openA = off + (k * Math.PI * 2) / 5 + pr.range(-0.15, 0.15);
        const a = lerp(closedA, closedA + angleDelta(closedA, openA), e);
        const plen = H * pr.range(0.13, 0.16) * lerp(0.7, 1, e);
        const shape = leafOutline(plen, plen * lerp(0.5, 0.95, e), pr.fork('shape'), { round: 0.55, tipBend: pr.range(-0.1, 0.1) });
        const pts = transform(shape, centre, a);
        wash(ctx, pts, pr.fork('w'), { color: PIGMENT.sakuraPale, alpha: 0.34, layers: 3, jitter: 0.6, rim: 0.5, rimColor: PIGMENT.sakura, lost: 0.25 });
        const inner = transform(leafOutline(plen * 0.45, plen * 0.4, pr.fork('in')), centre, a);
        wash(ctx, inner, pr.fork('wi'), { color: PIGMENT.sakura, alpha: 0.18, layers: 2, jitter: 0.4 });
      }
      // stamens
      ctx.globalCompositeOperation = 'source-over';
      const sr = b.fork('stamens');
      const dots = Math.round(5 + 4 * e);
      for (let k = 0; k < dots; k++) {
        const a = sr.range(0, Math.PI * 2);
        const r = sr.range(0.5, 3.2) * e * (H / 120);
        ctx.fillStyle = `rgba(217,179,108,${0.75 * e})`;
        ctx.beginPath();
        ctx.arc(centre.x + Math.cos(a) * r, centre.y + Math.sin(a) * r, sr.range(0.7, 1.3) * (H / 120), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(74,68,60,${0.5 * e})`;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, 0.9 * (H / 120), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'multiply';
    } else {
      // closed bud: a pink teardrop held by two green sepals
      const petal = transform(leafOutline(blen, blen * 0.62, b.fork('tear'), { round: 1.15, asym: 0.05 }), tip, dir);
      wash(ctx, petal, b.fork('pw'), { color: PIGMENT.sakura, alpha: 0.26 * smooth(0.4, 1, bud) + 0.06, layers: 3, jitter: 0.5, rim: 0.45 });
    }
    for (const side of [-1, 1]) {
      const sep = transform(
        leafOutline(blen * lerp(0.75, 0.55, bloom), blen * 0.3, b.fork(`sep${side}`)),
        tip,
        dir + side * lerp(0.32, 1.25, bloom),
      );
      wash(ctx, sep, b.fork(`sw${side}`), { color: PIGMENT.sap, alpha: lerp(0.32, 0.16, bloom), layers: 3, jitter: 0.4, rim: lerp(0.35, 0.15, bloom), rimColor: PIGMENT.olive });
    }
  }

  // ink line along the stem, slightly off-centre, sometimes lifting
  ctx.globalCompositeOperation = 'source-over';
  const inkPts = stemPts.map((p, i) => ({ x: p.x + 0.7 * (1 - i / 25), y: p.y }));
  inkLine(ctx, inkPts, st.fork('ink'), { width: (t) => (1.5 - 1.05 * t) * thick, alpha: 0.78, breaks: 0.05 });
  ctx.restore();
};

/** Signed shortest angle from a to b. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
