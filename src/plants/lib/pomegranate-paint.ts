/**
 * Pomegranate painting helpers (docs/devlog/115-pomegranate.md): the crowned calyx and the
 * crumpled scarlet corolla of its flower, the round fruit wearing the dried calyx, and the
 * twisting furrows of its grey stems. Pure geometry plus one wet layer per pass.
 */
import { createRng, type Rng } from '../../core/rng';
import type { Painter } from '../../paint';
import { blob, bounds, padRect, ribbon, type Pt } from '../../paint/geometry';
import { mix, shade, type Pigment } from '../../paint/pigments';
import { stableLayer, type visibleBranches } from './tree-paint';
import { clamp01, ramp } from './tree-structure';

type Visible = ReturnType<typeof visibleBranches>[number];

/** Light comes from the upper left; this is the screen direction toward the shade. */
const SHADE_DIR = { x: 0.6, y: 0.8 };

/** A point at (u along the axis, v across it) from `at`. */
function local(at: Pt, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return (u: number, v: number): Pt => ({ x: at.x + c * u - s * v, y: at.y + s * u + c * v });
}

/** Which side of an axis (+1 or −1 across it) faces away from the light. */
export function shadeSide(angle: number): number {
  return -Math.sin(angle) * SHADE_DIR.x + Math.cos(angle) * SHADE_DIR.y >= 0 ? 1 : -1;
}

/**
 * The fleshy calyx, side on: a swollen base, a waist and a mouth crowned with three visible
 * teeth. `open` 0 is the closed bud (teeth drawn together), 1 the teeth splayed round a flower.
 */
export function calyxOutline(at: Pt, angle: number, length: number, open: number): Pt[] {
  const P = local(at, angle);
  const L = length;
  const m = 0.2 + 0.11 * open;
  const t = 0.07 + 0.31 * open;
  const half: [number, number][] = [
    [0.15, 0.25],
    [0.38, 0.19],
    [0.56, m],
  ];
  const left = half.map(([u, v]) => P(u * L, -v * L));
  const right = half.map(([u, v]) => P(u * L, v * L)).reverse();
  const tip = 0.72 + 0.04 * (1 - open);
  return [
    P(0, -0.15 * L),
    ...left,
    P(tip * L, -t * L),
    P(0.6 * L, -0.12 * open * L),
    P((tip + 0.03) * L, 0),
    P(0.6 * L, 0.12 * open * L),
    P(tip * L, t * L),
    ...right,
    P(0, 0.15 * L),
  ];
}

export interface FlowerMark {
  /** where it joins the twig */
  at: Pt;
  /** base → mouth direction */
  angle: number;
  length: number;
  /** 0..1 the calyx's arrival (it grows from nothing as a bud) */
  calyx: number;
  /** 0..1 the corolla bursting out of the calyx */
  petals: number;
  id: number;
}

export interface FlowerPigments {
  calyx: Pigment;
  calyxShade: Pigment;
  petal: Pigment;
  petalDeep: Pigment;
}

/**
 * Flowers: the crumpled corolla first (one wet layer, its folds in a second), then the calyx
 * clasping it, so the teeth stand in front of the silk.
 */
export function paintFlowers(p: Painter, flowers: readonly FlowerMark[], rng: Rng, pig: FlowerPigments): void {
  const live = flowers.filter((f) => f.calyx > 0.03);
  if (!live.length) return;
  const area = padRect(bounds(live.map((f) => f.at)), 16);
  const petals = live.filter((f) => f.petals > 0.03);
  if (petals.length) {
    const C = stableLayer(p, area, rng.fork('corolla-dry'));
    const F = stableLayer(p, area, rng.fork('folds-dry'));
    for (const f of petals) {
      const r = createRng(f.id * 313 + 7);
      const L = f.length * f.calyx;
      const k = f.petals;
      const P = local(f.at, f.angle);
      const c = P(L * (0.56 + 0.3 * k), 0);
      const across = L * (0.2 + 0.28 * k);
      const along = L * (0.14 + 0.24 * k);
      const crumple = blob(c.x, c.y, along, across, r, { points: 16, irregularity: 0.32, scallop: 0.55, scallops: r.int(5, 7), rotation: f.angle });
      C.fill(crumple, pig.petal, 0.6 + 0.35 * k);
      // two or three folds of the crumpled silk
      for (let i = 0; i < r.int(2, 3); i++) {
        const v = r.range(-0.6, 0.6) * across;
        const fold = [P(L * 0.62, v * 0.5), P(L * (0.62 + 0.18 * k), v + r.range(-1, 1)), P(L * (0.6 + 0.32 * k), v * 0.8 + r.range(-1.5, 1.5))];
        F.fill(ribbon(fold, (t) => 0.55 * Math.sin(Math.PI * t) * k + 0.05), pig.petalDeep, 0.55 * k);
      }
    }
    C.dry({ opacity: 0.95, edge: 0.55, edgeWidth: 0.6, sharpness: 0.85, centreLift: 0.25, granulation: 0.08, flow: 0.3, flowScale: 6, darken: 0.3, blend: 'source-over' });
    F.dry({ opacity: 0.8, edge: 0.3, edgeWidth: 0.4, sharpness: 0.8, centreLift: 0.05, granulation: 0.1, flowScale: 6 });
  }
  const K = stableLayer(p, area, rng.fork('calyx-dry'));
  const S = stableLayer(p, area, rng.fork('calyx-shade-dry'));
  for (const f of live) {
    const L = f.length * f.calyx;
    if (L < 0.6) continue;
    const open = ramp(f.petals, 0, 0.6);
    K.fill(calyxOutline(f.at, f.angle, L, open), pig.calyx, 0.65 + 0.3 * f.calyx);
    // the flank away from the light
    const P = local(f.at, f.angle);
    const s = shadeSide(f.angle);
    S.fill([P(0.05 * L, 0.04 * s * L), P(0.15 * L, 0.24 * s * L), P(0.38 * L, 0.18 * s * L), P(0.56 * L, (0.19 + 0.1 * open) * s * L), P(0.5 * L, 0.06 * s * L)], pig.calyxShade, 0.6 * f.calyx);
  }
  K.dry({ opacity: 0.95, edge: 0.5, edgeWidth: 0.5, sharpness: 0.85, centreLift: 0.15, granulation: 0.12, flow: 0.25, flowScale: 6, darken: 0.3, blend: 'source-over' });
  S.dry({ opacity: 0.7, edge: 0.2, edgeWidth: 0.4, sharpness: 0.6, centreLift: 0.05, granulation: 0.15, flowScale: 6 });
}

export interface FruitMark {
  /** the centre of the full-grown fruit */
  at: Pt;
  /** centre → crown direction */
  angle: number;
  /** full-grown radius */
  r: number;
  /** 0..1 the calyx's arrival, as a bud, before the fruit swells */
  calyx: number;
  /** 0..1 the fruit swelling behind its calyx */
  swell: number;
  /** 0 unripe … 1 ripe */
  ripe: number;
  /** 0 yellow-red … 1 rose-red */
  blush: number;
  id: number;
}

export interface FruitPigments {
  unripe: Pigment;
  gold: Pigment;
  rose: Pigment;
  deep: Pigment;
  crown: Pigment;
}

/** The globe's outline: nearly round, a little flattened across its axis. */
export function fruitOutline(f: Pick<FruitMark, 'at' | 'angle' | 'id'>, R: number): Pt[] {
  const r = createRng(f.id * 71 + 3);
  return blob(f.at.x, f.at.y, R, R * 0.94, r, { points: 18, irregularity: 0.05, rotation: f.angle });
}

/**
 * Fruits: the leathery globe with its blush and a lifted gloss, the shade crescent, then the
 * dried calyx at its end: a short neck and splayed teeth, the fruit's little crown.
 */
export function paintFruits(p: Painter, fruits: readonly FruitMark[], rng: Rng, pig: FruitPigments): void {
  const live = fruits.filter((f) => f.calyx > 0.03);
  if (!live.length) return;
  const area = padRect(bounds(live.map((f) => f.at)), 20);
  const G = stableLayer(p, area, rng.fork('globe-dry'));
  const B = stableLayer(p, area, rng.fork('blush-dry'));
  const S = stableLayer(p, area, rng.fork('crescent-dry'));
  const K = stableLayer(p, area, rng.fork('crown-dry'));
  let globes = 0;
  for (const f of live) {
    const R = f.r * f.swell;
    const r = createRng(f.id * 977 + 11);
    const ripe = mix(pig.gold, pig.rose, f.blush);
    const skin = mix(pig.unripe, ripe, f.ripe);
    if (R > 0.5) {
      globes++;
      G.fill(fruitOutline(f, R), skin, 0.9);
      // gloss on the lit shoulder
      const gl = { x: f.at.x - SHADE_DIR.x * R * 0.42, y: f.at.y - SHADE_DIR.y * R * 0.42 };
      G.lift(blob(gl.x, gl.y, R * 0.22, R * 0.12, r, { points: 9, irregularity: 0.2, rotation: -0.6 }), 0.55 * f.ripe);
      // the blush gathers on the lit side, wet into wet
      const bc = { x: f.at.x - SHADE_DIR.x * R * 0.15 + r.range(-0.15, 0.15) * R, y: f.at.y - SHADE_DIR.y * R * 0.1 };
      B.fill(blob(bc.x, bc.y, R * 0.78, R * 0.7, r, { points: 14, irregularity: 0.25, rotation: r.range(0, 6.3) }), pig.rose, (0.25 + 0.35 * f.blush) * f.ripe);
      // the shade crescent: between the rim and an inner arc bowed toward the light
      const phi = Math.atan2(SHADE_DIR.y, SHADE_DIR.x);
      const outer: Pt[] = [];
      const inner: Pt[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = phi - 1.75 + (3.5 * i) / 10;
        outer.push({ x: f.at.x + Math.cos(a) * R * 0.98, y: f.at.y + Math.sin(a) * R * 0.92 });
        const ri = R * (1 - 0.42 * Math.max(0, Math.cos(a - phi)));
        inner.push({ x: f.at.x + Math.cos(a) * ri, y: f.at.y + Math.sin(a) * ri * 0.94 });
      }
      S.fill([...outer, ...inner.reverse()], pig.deep, 0.5 + 0.2 * f.ripe);
    }
    // the crown rides out on the swelling fruit's end
    const P = local(f.at, f.angle);
    const c = clamp01(f.calyx);
    const u0 = R * 0.84;
    const w = f.r * 0.26 * c;
    const n = f.r * 0.32 * c;
    const t = f.r * (0.12 + 0.3 * ramp(f.swell, 0.2, 1)) * c;
    const crown = [P(u0 - n * 0.3, -w), P(u0 + n * 0.75, -w * 0.9), P(u0 + n + t, -w * 1.5), P(u0 + n * 0.95, -w * 0.4), P(u0 + n + t * 1.1, 0), P(u0 + n * 0.95, w * 0.4), P(u0 + n + t, w * 1.5), P(u0 + n * 0.75, w * 0.9), P(u0 - n * 0.3, w)];
    K.fill(crown, mix(pig.crown, pig.unripe, 0.35 * (1 - f.ripe)), 0.85 * c);
    if (R > 0.5) K.fill(ribbon([P(u0 - n * 0.2, -w * 0.95), P(u0, 0), P(u0 - n * 0.2, w * 0.95)], () => 0.35), shade(pig.crown, 0.3), 0.6 * c);
  }
  if (globes) {
    G.dry({ opacity: 0.95, edge: 0.6, edgeWidth: 0.6, sharpness: 0.85, centreLift: 0.2, granulation: 0.12, flow: 0.3, flowScale: 8, darken: 0.3, blend: 'source-over' });
    B.dry({ opacity: 0.75, edge: 0.1, edgeWidth: 1, sharpness: 0.3, centreLift: 0.1, granulation: 0.15, flow: 0.5, flowScale: 6 });
    S.dry({ opacity: 0.55, edge: 0.15, edgeWidth: 0.8, sharpness: 0.4, centreLift: 0.05, granulation: 0.2, flowScale: 6 });
  } else {
    G.discard();
    B.discard();
    S.discard();
  }
  K.dry({ opacity: 0.95, edge: 0.5, edgeWidth: 0.45, sharpness: 0.85, centreLift: 0.1, granulation: 0.15, flowScale: 6, darken: 0.3, blend: 'source-over' });
}

/**
 * The twisting grey bark: furrows that spiral round each stem, drawn only where they pass the
 * front of it, and a pale ridge beside each. They fade in with the stem's width.
 */
export function paintTwist(p: Painter, vis: readonly Visible[], rng: Rng, bark: Pigment): void {
  const stems = vis.filter((v) => v.b.order <= 1 && v.hw(0.1) * 2 >= 2.2);
  if (!stems.length) return;
  const area = padRect(bounds(stems.flatMap((v) => v.path)), 8);
  const D = stableLayer(p, area, rng.fork('twist-dark-dry'));
  const L = stableLayer(p, area, rng.fork('twist-pale-dry'));
  const dark = shade(bark, 0.4);
  const pale = mix(bark, '#f4efe2', 0.6);
  for (const v of stems) {
    const r = rng.fork(`twist-${v.b.id}`);
    const fade = ramp(v.hw(0.1) * 2, 2.2, 5);
    const turns = r.range(0.6, 1.3) * (v.b.len / 100);
    const n = v.path.length;
    for (let s = 0; s < 3; s++) {
      const ph = r.range(0, Math.PI * 2);
      const run: Pt[][] = [[]];
      const sides: number[][] = [[]];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const a = t * turns * Math.PI * 2 + ph;
        if (Math.cos(a) < 0.15 || t > 0.9) {
          if (run.at(-1)!.length) {
            run.push([]);
            sides.push([]);
          }
          continue;
        }
        run.at(-1)!.push(v.path[i]!);
        sides.at(-1)!.push(Math.sin(a) * 0.8);
      }
      run.forEach((seg, j) => {
        if (seg.length < 3) return;
        const side = sides[j]!;
        const off = (t: number) => {
          const k = Math.min(side.length - 1, Math.round(t * (side.length - 1)));
          return side[k]! * v.hw(t);
        };
        const hw = (t: number) => 0.32 * Math.sin(Math.PI * t) * Math.min(1.4, v.hw(0.1) * 0.3) + 0.05;
        D.fill(ribbon(seg, hw, off), dark, 0.7 * fade);
        L.fill(ribbon(seg, (t) => hw(t) * 1.2, (t) => off(t) - hw(t) * 2.4), pale, 0.6 * fade);
      });
    }
  }
  D.dry({ opacity: 0.7, edge: 0.35, edgeWidth: 0.4, sharpness: 0.8, centreLift: 0.1, granulation: 0.3, flowScale: 8 });
  L.dry({ opacity: 0.7, edge: 0.25, edgeWidth: 0.4, sharpness: 0.75, centreLift: 0.1, granulation: 0.4, flowScale: 8, blend: 'source-over' });
}
