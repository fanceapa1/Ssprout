/**
 * Painting helpers for the caper (docs/devlog/109-caper.md): the crack it roots in, round
 * glaucous leaves batched per shoot, hooked stipule spines, the green capers and the big white
 * flower with its fountain of violet stamens. New helpers, so the shared `small-*` stay untouched.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, rgba, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, lerp, smooth, visible } from './small-growth';
import { shadowSide } from './small-paint';
import { petalPose, type FlowerView } from './small-structure';

const PETAL_SHADE = mix(PIGMENTS.petalShade, '#b9b4c8', 0.4);

function bounds(pts: readonly Pt[], pad: number): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    x0 = Math.min(x0, q.x);
    y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x);
    y1 = Math.max(y1, q.y);
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

/** The crack in the stone the caper roots in: a dark broken seam and a cool shadow round it. */
export function wallCrack(p: Painter, rng: Rng, seam: readonly Pt[], o: { seed: number; crown: number }): void {
  p.glaze({ cx: 0.5, cy: 1.5, rx: 6, ry: 2.6 }, PIGMENTS.shadow, { rng: rng.fork('hollow'), opacity: 0.22, edge: 0.1, sharpness: 0.3 });
  p.inkLine(seam, { rng: rng.fork('seam'), width: 0.75, pigment: mix(PIGMENTS.stoneDark, PIGMENTS.sumi, 0.55), opacity: 0.62, breaks: 0.3, wobble: 0.3, taper: [0.3, 0.6] });
  if (visible(o.seed)) {
    p.dab({ x: 0.6, y: -0.8 }, mix(PIGMENTS.wood, PIGMENTS.sumi, 0.35), { rng: rng.fork('seed'), variant: 'round', angle: -0.4, length: 1.5, width: 1.1, opacity: 0.85 * o.seed });
  }
  if (visible(o.crown)) {
    p.dab({ x: 0, y: -0.4 }, mix(PIGMENTS.olive, PIGMENTS.wood, 0.45), { rng: rng.fork('crown'), variant: 'round', angle: -0.3, length: 3.2 * o.crown, width: 2.4 * o.crown, opacity: 0.75, pool: 0.4, basePool: 0.2 });
  }
}

export interface FleshyLeaf {
  key: string;
  at: Pt;
  angle: number;
  length: number;
  width: number;
  curve: number;
  tone: Pigment;
}

/**
 * Round, fleshy leaves of one shoot in one wet layer (they touch wet-in-wet), then a second
 * source-over pass: the pale glaucous bloom on each lit flank that makes them read blue-grey.
 */
export function fleshyLeaves(p: Painter, rng: Rng, leaves: readonly FleshyLeaf[], o: { deep: Pigment; bloom: Pigment; bloomK: number; opacity: number }): void {
  const live = leaves.filter((l) => l.length > 0.3);
  if (!live.length) return;
  const reach = Math.max(...live.map((l) => l.length)) + 1;
  const area = bounds(live.map((l) => l.at), reach);
  const L = p.layer(area);
  for (const l of live) {
    const side = shadowSide(l.angle);
    p.dabInto(L, l.at, l.tone, { rng: rng.fork(`l-${l.key}`), variant: 'round', angle: l.angle, length: l.length, width: l.width, curve: l.curve, asym: 0, pool: 0.6, poolSide: side, basePool: 0.4, layers: 3 });
    const rib = l.length * 0.7 * smooth((l.length - 1.5) / 2.5);
    if (rib > 0.05) {
      p.dabInto(L, l.at, o.deep, { rng: rng.fork(`m-${l.key}`), variant: 'blade', angle: l.angle, length: rib, width: Math.max(0.2, l.width * 0.06), curve: l.curve, pool: 0, basePool: 0.3, layers: 1 });
    }
  }
  L.dry({ opacity: o.opacity, edge: 0.6, edgeWidth: 0.35, sharpness: 0.72, centreLift: 0.3, granulation: 0.22, flow: 0.35, flowScale: 4, darken: 0.34 });
  if (o.bloomK < 0.02) return;
  const B = p.layer(area);
  for (const l of live) {
    const bk = smooth((l.length - 1.5) / 2.5);
    if (bk < 0.05) continue;
    const side = shadowSide(l.angle);
    const nx = -Math.sin(l.angle) * -side;
    const ny = Math.cos(l.angle) * -side;
    const at = { x: l.at.x + Math.cos(l.angle) * l.length * 0.22 + nx * l.width * 0.12, y: l.at.y + Math.sin(l.angle) * l.length * 0.22 + ny * l.width * 0.12 };
    p.dabInto(B, at, o.bloom, { rng: rng.fork(`b-${l.key}`), variant: 'round', angle: l.angle, length: l.length * 0.55 * bk, width: l.width * 0.3 * bk, pool: 0, basePool: 0, layers: 2 });
  }
  B.dry({ opacity: 0.3 * o.bloomK, edge: 0.1, edgeWidth: 0.3, sharpness: 0.4, centreLift: 0, granulation: 0.2, flow: 0.4, flowScale: 3, darken: 0.03, blend: 'source-over' });
}

/** The pair of small hooked stipule spines at each node, batched into one layer. */
export function stipuleSpines(p: Painter, rng: Rng, spines: readonly { key: string; at: Pt; angle: number; length: number }[], pigment: Pigment): void {
  const live = spines.filter((s) => s.length > 0.08);
  if (!live.length) return;
  const L = p.layer(bounds(live.map((s) => s.at), 2));
  for (const s of live) {
    p.dabInto(L, s.at, pigment, { rng: rng.fork(`s-${s.key}`), variant: 'needle', angle: s.angle, length: s.length, width: s.length * 0.32, curve: 0.55, pool: 0, basePool: 0.5, layers: 1 });
  }
  L.dry({ opacity: 0.9, edge: 0.4, edgeWidth: 0.15, sharpness: 0.8, centreLift: 0, granulation: 0, flow: 0.1, flowScale: 2, darken: 0.3, blend: 'source-over' });
}

export interface CaperBud {
  key: string;
  node: Pt;
  end: Pt;
  angle: number;
  r: number;
  /** 0 = green … 1 = the white of the petals showing at the tip */
  white: number;
}

/** Capers: green balls on short stalks from the leaf axils, in one layer. */
export function caperBuds(p: Painter, rng: Rng, buds: readonly CaperBud[], o: { green: Pigment; stalk: Pigment }): void {
  const live = buds.filter((b) => b.r > 0.08);
  if (!live.length) return;
  const L = p.layer(bounds(live.flatMap((b) => [b.node, b.end]), 3));
  for (const b of live) {
    const len = Math.hypot(b.end.x - b.node.x, b.end.y - b.node.y);
    if (len > 0.3) p.dabInto(L, b.node, o.stalk, { rng: rng.fork(`k-${b.key}`), variant: 'blade', angle: b.angle, length: len, width: 0.45, pool: 0, basePool: 0.2, layers: 1 });
    p.dabInto(L, b.end, mix(o.green, PIGMENTS.petalWhite, 0.55 * b.white), { rng: rng.fork(`c-${b.key}`), variant: 'round', angle: b.angle, length: b.r * 2, width: b.r * 1.75, pool: 0.5, poolSide: shadowSide(b.angle), basePool: 0.2, layers: 2 });
  }
  L.dry({ opacity: 0.92, edge: 0.55, edgeWidth: 0.25, sharpness: 0.75, centreLift: 0.3, granulation: 0.08, flow: 0.2, flowScale: 2, darken: 0.32, blend: 'source-over' });
}

export interface CaperPetal {
  a: number;
  len: number;
  wid: number;
  curve: number;
  /** the upper petals carry a pink flush at the base */
  flush: number;
}

export interface Stamen {
  /** screen offset from the face direction */
  spread: number;
  len: number;
  bow: number;
}

/**
 * The flower in three layers: a cool cast shadow (white only reads by its edge), four broad
 * crinkled white petals with a pink flush on the upper pair, then the fountain of long violet
 * stamens with gold-violet anthers, drawn out after the petals have opened.
 */
export function caperFlower(
  p: Painter,
  rng: Rng,
  c: Pt,
  o: { petals: readonly CaperPetal[]; stamens: readonly Stamen[]; view: FlowerView; open: number; size: number; flush: Pigment; violet: Pigment; anther: Pigment },
): void {
  const open = clamp01(o.open);
  if (!visible(open) || o.size < 0.3) return;
  const sOpen = smooth(open);
  const reach = o.size * 2.4 + 1;
  const poses = o.petals.map((pl) => {
    const pose = petalPose(pl.a, o.view, open, 0.4);
    return { pl, angle: pose.angle, length: o.size * pl.len * lerp(0.4, 1, pose.len) * lerp(0.45, 1, sOpen), width: o.size * pl.wid * lerp(0.4, 1, sOpen) * lerp(0.75, 1, pose.len) };
  });
  const off = { x: c.x + o.size * 0.1, y: c.y + o.size * 0.14 };
  const S = p.layer({ x: off.x - reach, y: off.y - reach, w: reach * 2, h: reach * 2 });
  poses.forEach(({ pl, angle, length, width }, i) => {
    p.dabInto(S, off, PIGMENTS.shadow, { rng: rng.fork(`sh-${i}`), variant: 'petal', angle, curve: pl.curve, length: length * 1.04, width: width * 1.06, pool: 0.3, basePool: 0.2, layers: 2 });
  });
  S.dry({ opacity: 0.42 * smooth(open / 0.4), edge: 0.3, edgeWidth: Math.max(0.15, o.size * 0.05), sharpness: 0.6, centreLift: 0.1, granulation: 0.04 });
  const L = p.layer({ x: c.x - reach, y: c.y - reach, w: reach * 2, h: reach * 2 });
  poses.forEach(({ pl, angle, length, width }, i) => {
    const common = { variant: 'petal' as const, angle, curve: pl.curve };
    p.dabInto(L, c, PIGMENTS.petalWhite, { ...common, rng: rng.fork(`p-${i}`), length, width, pool: 0.45, poolSide: shadowSide(angle), basePool: 0.15, layers: 3 });
    p.dabInto(L, c, PETAL_SHADE, { ...common, rng: rng.fork(`s-${i}`), length: length * 0.5, width: width * 0.6, pool: 0, basePool: 0.6, layers: 2 });
    if (pl.flush > 0.02) {
      p.dabInto(L, c, mix(PIGMENTS.petalWhite, o.flush, pl.flush), { ...common, variant: 'round', rng: rng.fork(`f-${i}`), length: length * 0.7, width: width * 0.7, pool: 0, basePool: 0.4, layers: 2 });
    }
    // crinkles: two faint creases running out along the petal
    for (const k of [-1, 1]) {
      p.dabInto(L, c, PETAL_SHADE, { rng: rng.fork(`c-${i}-${k}`), variant: 'needle', angle: angle + k * 0.22, length: length * 0.85, width: Math.max(0.15, width * 0.05), curve: k * 0.2 + pl.curve, pool: 0, basePool: 0, layers: 1 });
    }
  });
  L.dry({ opacity: 0.96 * smooth(open / 0.3), edge: 0.75, edgeWidth: Math.max(0.15, o.size * 0.045), sharpness: 0.8, centreLift: 0.12, granulation: 0.04, flow: 0.3, flowScale: Math.max(2, o.size), darken: 0.5, blend: 'source-over' });

  // the stamens draw out of the centre once the petals are mostly open
  const sk = smooth((open - 0.35) / 0.65);
  if (!visible(sk)) return;
  const F = p.layer({ x: c.x - reach, y: c.y - reach, w: reach * 2, h: reach * 2 });
  const ends: Pt[] = [];
  const pale = mix(PIGMENTS.petalWhite, o.violet, 0.3);
  const ctx = F.ctx;
  ctx.lineCap = 'round';
  o.stamens.forEach((s) => {
    const a = o.view.roll + s.spread * lerp(0.4, 1, sk);
    const len = o.size * s.len * sk;
    const end = { x: c.x + Math.cos(a) * len, y: c.y + Math.sin(a) * len };
    // the filaments arch outward from the flower's axis, like a fountain
    const n = { x: -Math.sin(a) * Math.sign(s.spread || 1), y: Math.cos(a) * Math.sign(s.spread || 1) };
    const mid = { x: (c.x + end.x) / 2 + n.x * len * s.bow, y: (c.y + end.y) / 2 + n.y * len * s.bow };
    const half = { x: (mid.x * 2 + c.x + end.x) / 4, y: (mid.y * 2 + c.y + end.y) / 4 };
    ctx.lineWidth = Math.max(0.18, o.size * 0.05);
    ctx.strokeStyle = rgba(pale, 0.75);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.quadraticCurveTo((c.x + mid.x) / 2, (c.y + mid.y) / 2, half.x, half.y);
    ctx.stroke();
    ctx.strokeStyle = rgba(o.violet, 0.92);
    ctx.beginPath();
    ctx.moveTo(half.x, half.y);
    ctx.quadraticCurveTo((mid.x + end.x) / 2, (mid.y + end.y) / 2, end.x, end.y);
    ctx.stroke();
    ends.push(end);
  });
  F.dry({ opacity: 0.95, edge: 0.3, edgeWidth: 0.12, sharpness: 0.8, centreLift: 0, granulation: 0, flow: 0.1, flowScale: 2, darken: 0.25, blend: 'source-over' });
  const A = p.layer(bounds(ends, 1.5));
  ends.forEach((e, i) => {
    p.dabInto(A, e, i % 3 === 0 ? o.violet : o.anther, { rng: rng.fork(`a-${i}`), variant: 'round', angle: o.view.roll, length: o.size * 0.13 * sk, width: o.size * 0.09 * sk, pool: 0.3, basePool: 0, layers: 1 });
  });
  A.dry({ opacity: 0.95, edge: 0.3, edgeWidth: 0.12, sharpness: 0.75, centreLift: 0, granulation: 0, flow: 0.1, flowScale: 2, darken: 0.3, blend: 'source-over' });
  // the green pistil on its long stalk (gynophore) stands out of the middle
  const gy = { x: c.x + Math.cos(o.view.roll + 0.15) * o.size * 0.9 * sk, y: c.y + Math.sin(o.view.roll + 0.15) * o.size * 0.9 * sk };
  p.inkLine([c, gy], { rng: rng.fork('gyno'), width: Math.max(0.2, o.size * 0.05), pigment: mix(PIGMENTS.sage, PIGMENTS.petalWhite, 0.2), opacity: 0.85 * sk, breaks: 0, wobble: 0.05, taper: [0.1, 0.1] });
}
