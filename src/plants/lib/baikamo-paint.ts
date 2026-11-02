/**
 * Painting helpers for the baikamo (species/baikamo.ts): ribbons for thread-fine submerged
 * leaves laid into a shared wet layer, and the small five-petalled "plum blossoms" that sit
 * just above the surface.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, mix, type Painter, type Pigment, type Pt } from '../../paint';
import { clamp01, easeOut, lerp, smooth, visible } from './small-growth';
import { shadowSide } from './small-paint';
import { petalPose, type FlowerView, type PetalPlan } from './small-structure';

/**
 * A closed polygon around `pts` whose half-width at fraction t is `width(t)`; null when the
 * path is too short to fill.
 */
export function ribbon(pts: readonly Pt[], width: (t: number) => number): Pt[] | null {
  const n = pts.length;
  if (n < 2) return null;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(n - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const w = Math.max(0, width(i / (n - 1)));
    const nx = (-dy / d) * w;
    const ny = (dx / d) * w;
    const q = pts[i]!;
    left.push({ x: q.x + nx, y: q.y + ny });
    right.push({ x: q.x - nx, y: q.y - ny });
  }
  return [...left, ...right.reverse()];
}

/** Half-width profile of a fine thread: swells just after the base, tapers to a hair. */
export const threadWidth = (w: number) => (t: number) => w * (0.55 + 0.45 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5)) * (1 - t) ** 0.7;

export interface PlumFlower {
  /** stable identity: keeps each flower's marks its own as others open */
  id: number;
  c: Pt;
  petals: readonly PetalPlan[];
  view: FlowerView;
  /** petal length at full opening */
  size: number;
  /** 0 = closed … 1 = open */
  open: number;
}

const SHADOW = mix(PIGMENTS.celadonDeep, PIGMENTS.shadow, 0.35);
const SHADE = mix(PIGMENTS.petalShade, PIGMENTS.celadon, 0.35);

/**
 * Small white five-petalled flowers in three shared layers: a cool shadow on the water just
 * below, white petals source-over with a grey-celadon heart, then gold centres.
 */
export function plumFlowers(p: Painter, rng: Rng, flowers: readonly PlumFlower[], o: { eye: Pigment; white?: Pigment }): void {
  const open = flowers.filter((f) => visible(f.open) && f.size > 0.2);
  if (!open.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of open) {
    x0 = Math.min(x0, f.c.x - f.size * 1.6); y0 = Math.min(y0, f.c.y - f.size * 1.4);
    x1 = Math.max(x1, f.c.x + f.size * 1.8); y1 = Math.max(y1, f.c.y + f.size * 2.2);
  }
  const area = { x: x0 - 1, y: y0 - 1, w: x1 - x0 + 2, h: y1 - y0 + 2 };
  const poses = (f: PlumFlower) =>
    f.petals
      .map((pl) => ({ pl, pose: petalPose(pl.a, f.view, f.open, 0.5) }))
      .sort((a, b) => a.pose.depth - b.pose.depth)
      .map(({ pl, pose }) => ({ angle: pose.angle, length: f.size * pl.len * pose.len * lerp(0.35, 1, easeOut(f.open)), width: f.size * 0.74 * pl.wid * lerp(0.5, 1, f.open), curve: pl.curve }));
  const S = p.layer(area);
  open.forEach((f) => {
    const i = f.id;
    const off = { x: f.c.x + f.size * 0.2, y: f.c.y + f.size * 0.75 };
    poses(f).forEach((pl, j) => {
      p.dabInto(S, off, SHADOW, { rng: rng.fork(`sh-${i}-${j}`), variant: 'petal', angle: pl.angle, length: pl.length * 1.1, width: pl.width * 1.05, pool: 0.1, basePool: 0.2, layers: 2, asym: 0, jitter: 0 });
    });
  });
  S.dry({ opacity: 0.3, edge: 0.15, edgeWidth: 0.25, sharpness: 0.3, centreLift: 0.05, granulation: 0.05 });
  const W = p.layer(area);
  open.forEach((f) => {
    const i = f.id;
    poses(f).forEach((pl, j) => {
      p.dabInto(W, f.c, o.white ?? PIGMENTS.petalWhite, { rng: rng.fork(`p-${i}-${j}`), variant: 'petal', angle: pl.angle, length: pl.length, width: pl.width, curve: pl.curve, pool: 0.3, poolSide: shadowSide(pl.angle), basePool: 0.15, layers: 3, asym: 0 });
      p.dabInto(W, f.c, SHADE, { rng: rng.fork(`s-${i}-${j}`), variant: 'petal', angle: pl.angle, length: pl.length * 0.5, width: pl.width * 0.4, pool: 0, basePool: 0.55, layers: 2, asym: 0 });
    });
  });
  W.dry({ opacity: 0.96, edge: 0.5, edgeWidth: 0.18, sharpness: 0.75, centreLift: 0.12, granulation: 0.03, flow: 0.2, flowScale: 2, darken: 0.32, blend: 'source-over' });
  open.forEach((f) => {
    const i = f.id;
    const k = clamp01((f.open - 0.35) / 0.5);
    if (!visible(k)) return;
    const s = f.size * easeOut(k);
    p.dab({ x: f.c.x, y: f.c.y - f.size * 0.05 }, o.eye, { rng: rng.fork(`eye-${i}`), variant: 'round', angle: 0, length: s * 0.5, width: s * 0.36, opacity: 0.95 * smooth(k), blend: 'source-over', edge: 0.2, pool: 0.15, basePool: 0, darken: 0.12 });
  });
}
