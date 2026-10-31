/**
 * Painting helpers for the wasabi (species/wasabi.ts): the round, glossy heart-to-kidney leaf
 * held on its stalk, and a raceme of small four-petalled crucifer crosses.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, blob, jitter, mix, organicOutline, outlineLayer, type Outline, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, easeOut, lerp, smooth, visible } from './small-growth';
import { LIGHT, shadowSide } from './small-paint';

export interface HeartShape {
  /** the blade's outline in its own plane (sinus at the origin, tip along +v, radius ~10) */
  outline: Outline;
  /** main palmate veins, as angles from the forward axis */
  veins: number[];
}

/** Radius the unit outline is authored at, and how far forward of the sinus its centre is. */
const UNIT = 10;
const CENTRE = 0.56;

/**
 * A heart-to-kidney blade: a circle set forward of the sinus, pulled into a notch at the stalk,
 * with a shallow wavy-toothed margin. `wide` > 1 makes it reniform.
 */
export function heartShape(rng: Rng, o: { wide: number; notch: number; teeth: number; wave: number }): HeartShape {
  const n = 64;
  const phase = rng.range(0, Math.PI * 2);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const phi = (i / n) * Math.PI * 2;
    const tooth = Math.abs(Math.sin((phi * o.teeth) / 2 + phase));
    const rho = 1 + o.wave * (tooth - 0.5) + 0.03 * Math.sin(phi * 3 + phase * 2);
    let u = Math.sin(phi) * rho * o.wide;
    let v = CENTRE + Math.cos(phi) * rho;
    const d = Math.abs(phi - Math.PI);
    if (d < o.notch) {
      // the basal lobes curl in to a deep sinus at the stalk
      const w = (1 - d / o.notch) ** 1.25;
      u = lerp(u, 0, w);
      v = lerp(v, 0.04, w);
    }
    pts.push({ x: u * UNIT, y: v * UNIT });
  }
  const outline = organicOutline(pts, rng.fork('outline'), { deform: 0.08, detail: 40, edge: 0.6 });
  const nv = rng.int(5, 7);
  const veins: number[] = [];
  for (let i = 0; i < nv; i++) veins.push(lerp(-2.1, 2.1, i / (nv - 1)) + rng.gaussian(0, 0.08));
  return { outline, veins };
}

export interface HeartPose {
  /** where the stalk meets the blade */
  sinus: Pt;
  /** screen direction of the blade's forward axis */
  angle: number;
  /** blade radius in plant units */
  r: number;
  /** foreshortening of the forward axis (1 = face-on) */
  tilt: number;
  /** 0..1: how far the blade has unrolled across (young blades are folded) */
  open: number;
}

/** Map a point of the unit outline onto the canvas. */
function place(q: Pt, pose: HeartPose): Pt {
  const s = pose.r / UNIT;
  const fx = Math.cos(pose.angle);
  const fy = Math.sin(pose.angle);
  const u = q.x * s * lerp(0.3, 1, pose.open);
  const v = q.y * s * pose.tilt;
  return { x: pose.sinus.x + fx * v - fy * u, y: pose.sinus.y + fy * v + fx * u };
}

export interface HeartStyle {
  pigment: Pigment;
  /** veins and the shaded lower half */
  deep: Pigment;
  /** how much wet light is lifted on the lit flank (0 = matt) */
  gloss: number;
  opacity?: number;
  /** paint over what is behind instead of glazing through it */
  cover?: boolean;
}

/**
 * One blade in one wet layer: a few wandering fills of the outline, a cooler pool on the side
 * away from the light, palmate veins from the sinus, then a lifted sheen that reads as gloss.
 */
export function heartLeaf(p: Painter, rng: Rng, shape: HeartShape, pose: HeartPose, s: HeartStyle): void {
  if (pose.r < 0.4) return;
  const base = shape.outline.base.map((q) => place(q, pose));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of base) {
    x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
  }
  const pad = pose.r * 0.25 + 1;
  const L = p.layer({ x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 });
  const fr = rng.fork('fills');
  const n = 4;
  for (let k = 0; k < n; k++) {
    L.fill(outlineLayer(shape.outline, fr, 0.05).map((q) => place(q, pose)), jitter(s.pigment, fr, 0.02), 0.44);
  }
  // the blade dips toward the sinus: a soft cool pool there, kept inside the outline
  const lx = Math.cos(LIGHT);
  const ly = Math.sin(LIGHT);
  const sr = rng.fork('shade');
  L.ctx.save();
  L.clip(base);
  for (let k = 0; k < 3; k++) {
    const q = place({ x: sr.gaussian(0, 0.6), y: UNIT * sr.range(0.15, 0.4) }, pose);
    L.fill(blob(q.x, q.y, pose.r * sr.range(0.45, 0.7), pose.r * sr.range(0.3, 0.45) * pose.tilt, sr, { rotation: pose.angle + Math.PI / 2 }), s.deep, 0.14);
  }
  L.ctx.restore();
  // palmate veins fan from the sinus
  if (pose.r > 2.5) {
    shape.veins.forEach((a, i) => {
      const tip = place({ x: Math.sin(a) * UNIT * 0.95, y: (CENTRE + Math.cos(a) * 0.95) * UNIT }, pose);
      const ang = Math.atan2(tip.y - pose.sinus.y, tip.x - pose.sinus.x);
      const len = Math.hypot(tip.x - pose.sinus.x, tip.y - pose.sinus.y) * 0.74;
      p.dabInto(L, pose.sinus, mix(s.pigment, s.deep, 0.6), { rng: rng.fork(`vein-${i}`), variant: 'needle', angle: ang, length: len, width: Math.max(0.16, pose.r * 0.026), curve: (i % 2 ? 1 : -1) * 0.05, pool: 0, basePool: 0.4, layers: 2, asym: 0 });
    });
  }
  L.dry({
    opacity: (s.opacity ?? 0.9) * smooth(pose.r / 1.5),
    edge: 0.62,
    edgeWidth: Math.max(0.25, Math.min(1.4, pose.r * 0.09)),
    sharpness: 0.78,
    centreLift: 0.12,
    granulation: 0.1,
    flow: 0.4,
    flowScale: Math.max(3, pose.r * 0.8),
    darken: 0.34,
    // a front blade covers the one behind, as if painted around it
    ...(s.cover ? { blend: 'source-over' as const } : {}),
  });
  // wet light on the lit flank: a soft, ragged paler patch, not a crisp glint
  if (s.gloss > 0.02 && pose.r > 2) {
    const g = rng.fork('gloss');
    const q = place({ x: 0, y: CENTRE * UNIT }, pose);
    const cx = q.x + lx * pose.r * 0.4;
    const cy = q.y + ly * pose.r * 0.4 * pose.tilt;
    const rx = pose.r * g.range(0.34, 0.46) * lerp(0.4, 1, pose.open);
    const ry = pose.r * g.range(0.16, 0.24) * pose.tilt;
    const rot = Math.atan2(Math.sin(LIGHT + Math.PI / 2) * pose.tilt, Math.cos(LIGHT + Math.PI / 2)) + g.gaussian(0, 0.15);
    const G = p.layer({ x: cx - rx - 1, y: cy - rx - 1, w: rx * 2 + 2, h: rx * 2 + 2 });
    G.ctx.save();
    G.clip(base);
    for (let k = 0; k < 3; k++) G.fill(blob(cx, cy, rx * g.range(0.7, 1), ry * g.range(0.7, 1), g, { rotation: rot, irregularity: 0.3 }), mix(s.pigment, PIGMENTS.petalWhite, 0.6), 0.4);
    G.ctx.restore();
    G.dry({ opacity: s.gloss, edge: 0.05, edgeWidth: 0.2, sharpness: 0.15, centreLift: 0, granulation: 0, flow: 0.5, flowScale: 2, blend: 'source-over' });
  }
}

const SHADOW = mix(PIGMENTS.shadow, PIGMENTS.petalShade, 0.35);

export interface CrossFlower {
  c: Pt;
  /** the flower's facing (screen angle of one petal axis) */
  roll: number;
  tilt: number;
  size: number;
  /** 0..1 */
  open: number;
}

/** Four petals at right angles, foreshortened by `tilt` across `roll`. */
function crossPetals(f: CrossFlower): { angle: number; length: number; width: number }[] {
  const out: { angle: number; length: number; width: number }[] = [];
  const o = smooth(f.open);
  // a flower starts as a speck and swells as it opens
  const s = f.size * smooth(f.open / 0.25);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const dx = Math.cos(a);
    const dy = Math.sin(a) * f.tilt;
    const ang = f.roll + Math.atan2(dy, dx);
    const reach = Math.hypot(dx, dy);
    out.push({ angle: ang, length: s * lerp(0.35, 1, o) * lerp(0.55, 1, reach), width: s * lerp(0.4, 0.78, o) });
  }
  return out;
}

/**
 * A raceme's open flowers in two shared wet layers: a cool shadow offset a hair down-right
 * (so white reads on pale rock and water), then petal white painted source-over.
 */
export function crossFlowers(p: Painter, rng: Rng, flowers: readonly CrossFlower[], o: { opacity?: number; eye: Pigment }): void {
  const open = flowers.filter((f) => visible(f.open) && f.size > 0.2);
  if (!open.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of open) {
    x0 = Math.min(x0, f.c.x - f.size * 1.4); y0 = Math.min(y0, f.c.y - f.size * 1.4);
    x1 = Math.max(x1, f.c.x + f.size * 1.6); y1 = Math.max(y1, f.c.y + f.size * 1.6);
  }
  const area = { x: x0 - 1, y: y0 - 1, w: x1 - x0 + 2, h: y1 - y0 + 2 };
  const maxOpen = Math.max(...open.map((f) => f.open));
  const S = p.layer(area);
  open.forEach((f, i) => {
    const off = { x: f.c.x + f.size * 0.12, y: f.c.y + f.size * 0.16 };
    crossPetals(f).forEach((pl, j) => {
      p.dabInto(S, off, SHADOW, { rng: rng.fork(`sh-${i}-${j}`), variant: 'petal', angle: pl.angle, length: pl.length * 1.05, width: pl.width * 1.1, pool: 0.2, basePool: 0.2, layers: 2, asym: 0, jitter: 0 });
    });
  });
  S.dry({ opacity: 0.32 * smooth(maxOpen / 0.4), edge: 0.3, edgeWidth: 0.2, sharpness: 0.6, centreLift: 0.1, granulation: 0.03 });
  const W = p.layer(area);
  open.forEach((f, i) => {
    crossPetals(f).forEach((pl, j) => {
      p.dabInto(W, f.c, PIGMENTS.petalWhite, { rng: rng.fork(`p-${i}-${j}`), variant: 'petal', angle: pl.angle, length: pl.length, width: pl.width, pool: 0.35, poolSide: shadowSide(pl.angle), basePool: 0.2, layers: 3, asym: 0 });
      p.dabInto(W, f.c, PIGMENTS.petalShade, { rng: rng.fork(`s-${i}-${j}`), variant: 'petal', angle: pl.angle, length: pl.length * 0.45, width: pl.width * 0.45, pool: 0, basePool: 0.5, layers: 2, asym: 0 });
    });
  });
  W.dry({ opacity: (o.opacity ?? 0.95) * smooth(maxOpen / 0.3), edge: 0.45, edgeWidth: 0.16, sharpness: 0.75, centreLift: 0.15, granulation: 0.03, flow: 0.2, flowScale: 2, darken: 0.3, blend: 'source-over' });
  open.forEach((f, i) => {
    const k = clamp01((f.open - 0.3) / 0.5);
    if (!visible(k)) return;
    p.dab(f.c, o.eye, { rng: rng.fork(`eye-${i}`), variant: 'round', angle: f.roll, length: f.size * 0.36 * easeOut(k), width: f.size * 0.3 * easeOut(k), opacity: 0.9 * smooth(k), blend: 'source-over', edge: 0.3 });
  });
}
