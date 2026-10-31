/**
 * Painting helpers for the daimonjisō (species/daimonjiso.ts): the round, palmately lobed leaf
 * lying on wet rock, and the 大-shaped flower (three short upper petals, two long lower ones).
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, easeOut, lerp, smooth, visible } from './small-growth';
import { INK_GREEN, shadowSide } from './small-paint';
import { lerpAngle, projectDir, type FlowerView } from './small-structure';

export interface Lobe {
  /** angle in the leaf's own plane */
  a: number;
  len: number;
  wid: number;
  tone: number;
}

/**
 * A round lobed leaf in one wet layer: lobe dabs radiate from the blade's centre in perspective
 * (`view`), so their rounded tips make the scalloped margin; `rust` bleeds red into the lobe tips.
 * `k` unfurls it: the lobes fan out from a folded bunch around `fold` as the blade grows.
 */
export function lobedLeaf(
  p: Painter,
  rng: Rng,
  c: Pt,
  o: { lobes: readonly Lobe[]; view: FlowerView; r: number; k: number; fold: number; pigment: Pigment; rust: number; rustPigment: Pigment; opacity?: number; vein?: number },
): void {
  const k = clamp01(o.k);
  if (!visible(k)) return;
  const r = o.r * easeOut(k);
  if (r < 0.3) return;
  const open = smooth(k);
  const ext = r * 1.25 + 1;
  const L = p.layer({ x: c.x - ext, y: c.y - ext, w: ext * 2, h: ext * 2 });
  p.dabInto(L, { x: c.x - r * 0.6, y: c.y }, o.pigment, { rng: rng.fork('heart'), variant: 'round', angle: 0, length: r * 1.2, width: r * 1.1 * o.view.tilt, pool: 0, basePool: 0, layers: 2 });
  const poses = o.lobes.map((lb) => {
    const d = projectDir(lb.a, o.view);
    return { lb, angle: lerpAngle(o.fold, Math.atan2(d.y, d.x), open), len: lerp(0.55, Math.max(0.3, Math.hypot(d.x, d.y)), open) };
  });
  poses.forEach(({ lb, angle, len }, i) => {
    const length = r * lb.len * len;
    const tone = mix(o.pigment, lb.tone > 0.5 ? PIGMENTS.sap : PIGMENTS.olive, Math.abs(lb.tone - 0.5) * 0.5);
    p.dabInto(L, c, tone, { rng: rng.fork(`lobe-${i}`), variant: 'petal', angle, length, width: r * lb.wid * lerp(0.4, 1, open), pool: 0.45, poolSide: shadowSide(angle), basePool: 0.1, layers: 3 });
    const rk = smooth((o.rust - 0.04) / 0.2);
    if (visible(rk)) {
      const tip = { x: c.x + Math.cos(angle) * length * 0.62, y: c.y + Math.sin(angle) * length * 0.62 };
      p.dabInto(L, tip, mix(tone, o.rustPigment, o.rust), { rng: rng.fork(`rust-${i}`), variant: 'round', angle, length: length * 0.42 * rk, width: r * lb.wid * 0.5 * rk, pool: 0, basePool: 0, layers: 2 });
    }
  });
  L.dry({
    opacity: (o.opacity ?? 0.86) * smooth(k * 6),
    edge: 0.6,
    edgeWidth: Math.max(0.25, Math.min(1.6, r * 0.1)),
    sharpness: 0.72,
    centreLift: 0.4,
    granulation: 0.12,
    flow: 0.35,
    flowScale: Math.max(3, r),
  });
  if (o.vein && r > 3.5) {
    poses.forEach(({ angle, len }, i) => {
      if (i % 2 === 1) return;
      const reach = r * len * 0.72;
      p.inkLine(
        [c, { x: c.x + Math.cos(angle) * reach, y: c.y + Math.sin(angle) * reach }],
        { rng: rng.fork(`vein-${i}`), width: Math.max(0.18, r * 0.035), pigment: INK_GREEN, opacity: o.vein! * open, breaks: 0.45, wobble: 0.15, taper: [0.1, 0.7] },
      );
    });
  }
}

const SHADOW = mix(PIGMENTS.shadow, PIGMENTS.petalShade, 0.35);

export interface DaiPetal {
  /** angle in the flower's plane (−π/2 = the flower's up) */
  a: number;
  len: number;
  wid: number;
  curve: number;
  /** the two long lower petals */
  long: boolean;
}

/**
 * The 大 flower in one wet layer, painted source-over so it stays white over rock: petal-white
 * bodies, violet-grey pooled at the base and the shaded flank, an optional flush at the long
 * petals' tips. `open` swings the petals out and draws the long ones out last.
 */
export function daiFlower(
  p: Painter,
  rng: Rng,
  c: Pt,
  o: { petals: readonly DaiPetal[]; view: FlowerView; open: number; size: number; tip?: Pigment; tipK?: number; opacity?: number; shadow?: number },
): void {
  const open = clamp01(o.open);
  if (!visible(open) || o.size < 0.2) return;
  const reach = o.size * 3.6 + 1;
  const sOpen = smooth(open);
  const poses = o.petals.map((pl) => {
    const d = projectDir(pl.a, o.view);
    const angle = lerpAngle(o.view.roll + Math.PI * (pl.long ? 0.9 : 0.05) * Math.sign(Math.cos(pl.a) || 1), Math.atan2(d.y, d.x), sOpen);
    // the long petals draw out after the short ones have opened
    const grow = pl.long ? lerp(0.25, 1, smooth(clamp01((open - 0.2) / 0.8))) : lerp(0.4, 1, sOpen);
    return { pl, angle, length: o.size * pl.len * grow * lerp(0.35, 1, Math.hypot(d.x, d.y)), width: o.size * pl.wid * lerp(0.55, 1, sOpen) };
  });
  // a cool shadow just below and right of the petals: white reads on pale rock by its edge
  const off = { x: c.x + o.size * 0.07, y: c.y + o.size * 0.1 };
  const S = p.layer({ x: off.x - reach, y: off.y - reach, w: reach * 2, h: reach * 2 });
  poses.forEach(({ pl, angle, length, width }, i) => {
    p.dabInto(S, off, SHADOW, { variant: 'petal', angle, curve: pl.curve, rng: rng.fork(`sh-${i}`), length: length * 1.04, width: width * 1.1, pool: 0.3, basePool: 0.2, layers: 2 });
  });
  S.dry({ opacity: (o.shadow ?? 0.3) * smooth(open / 0.4), edge: 0.3, edgeWidth: Math.max(0.15, o.size * 0.06), sharpness: 0.6, centreLift: 0.1, granulation: 0.04 });
  const L = p.layer({ x: c.x - reach, y: c.y - reach, w: reach * 2, h: reach * 2 });
  poses.forEach(({ pl, angle, length, width }, i) => {
    const common = { variant: 'petal' as const, angle, curve: pl.curve };
    p.dabInto(L, c, PIGMENTS.petalWhite, { ...common, rng: rng.fork(`p-${i}`), length, width, pool: 0.4, poolSide: shadowSide(angle), basePool: 0.15, layers: 3 });
    p.dabInto(L, c, PIGMENTS.petalShade, { ...common, rng: rng.fork(`s-${i}`), length: length * (pl.long ? 0.85 : 0.5), width: width * (pl.long ? 0.42 : 0.5), pool: 0, basePool: pl.long ? 0.25 : 0.5, layers: 2 });
    if (pl.long && o.tip && (o.tipK ?? 0) > 0.02) {
      const at = { x: c.x + Math.cos(angle) * length * 0.55, y: c.y + Math.sin(angle) * length * 0.55 };
      p.dabInto(L, at, mix(PIGMENTS.petalWhite, o.tip, o.tipK!), { ...common, variant: 'round', rng: rng.fork(`t-${i}`), length: length * 0.45, width: width * 0.8, pool: 0, basePool: 0, layers: 2 });
    }
  });
  L.dry({
    opacity: (o.opacity ?? 0.95) * smooth(open / 0.3),
    edge: 0.5,
    edgeWidth: Math.max(0.15, o.size * 0.07),
    sharpness: 0.75,
    centreLift: 0.2,
    granulation: 0.04,
    flow: 0.25,
    flowScale: Math.max(2, o.size * 1.5),
    darken: 0.32,
    blend: 'source-over',
  });
  // the yellow-green disc of the ovary
  p.dab(c, mix(PIGMENTS.gold, PIGMENTS.sap, 0.25), { rng: rng.fork('eye'), variant: 'round', angle: o.view.roll, length: o.size * 0.32, width: o.size * 0.28, opacity: 0.9 * smooth((open - 0.3) / 0.5), blend: 'source-over', edge: 0.35 });
}
