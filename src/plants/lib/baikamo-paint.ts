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
const SHADE = mix(mix(PIGMENTS.petalShade, PIGMENTS.celadon, 0.25), '#ffffff', 0.35);
/** Petals left as paper: whiter than petal white, so the paper multiplied last gives washi. */
const RESERVED = mix(PIGMENTS.petalWhite, '#ffffff', 0.7);
const HEART = mix(PIGMENTS.sageLight, '#e8e0a0', 0.5);

/**
 * Small white five-petalled flowers in three shared layers: a faint cool shadow on the water
 * just below, petals of reserved paper (a soft grey-celadon heart only seen close), then gold
 * eyes. `res` is sprite px per unit: small sprites get a smaller eye, close ones stamens.
 */
export function plumFlowers(p: Painter, rng: Rng, flowers: readonly PlumFlower[], o: { eye: Pigment; white?: Pigment; res?: number }): void {
  const open = flowers.filter((f) => visible(f.open) && f.size > 0.2);
  if (!open.length) return;
  const res = o.res ?? 2;
  // 0 at overview size … 1 seen close
  const near = smooth((res - 1.5) / 3);
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
      .map(({ pl, pose }) => ({ angle: pose.angle, length: f.size * pl.len * pose.len * lerp(0.35, 1, easeOut(f.open)), width: f.size * 0.78 * pl.wid * lerp(0.5, 1, f.open), curve: pl.curve }));
  const S = p.layer(area);
  open.forEach((f) => {
    const i = f.id;
    const off = { x: f.c.x + f.size * 0.1, y: f.c.y + f.size * 0.4 };
    poses(f).forEach((pl, j) => {
      p.dabInto(S, off, SHADOW, { rng: rng.fork(`sh-${i}-${j}`), variant: 'petal', angle: pl.angle, length: pl.length * 1.05, width: pl.width, pool: 0.1, basePool: 0.2, layers: 2, asym: 0, jitter: 0 });
    });
  });
  S.dry({ opacity: 0.14, edge: 0.1, edgeWidth: 0.25, sharpness: 0.25, centreLift: 0.05, granulation: 0.05 });
  // alternate petals in two wet layers, so each keeps a faint edge where it overlaps the next
  for (const odd of [0, 1]) {
    const W = p.layer(area);
    open.forEach((f) => {
      const i = f.id;
      poses(f).forEach((pl, j) => {
        if (j % 2 !== odd) return;
        p.dabInto(W, f.c, o.white ?? RESERVED, { rng: rng.fork(`p-${i}-${j}`), variant: 'petal', angle: pl.angle, length: pl.length, width: pl.width, curve: pl.curve, pool: 0.08, poolSide: shadowSide(pl.angle), basePool: 0.05, layers: 3, asym: 0, jitter: 0.006 });
        if (near > 0.02) p.dabInto(W, f.c, SHADE, { rng: rng.fork(`s-${i}-${j}`), variant: 'petal', angle: pl.angle, length: pl.length * 0.4, width: pl.width * 0.35, pool: 0, basePool: 0.3 * near, layers: 2, asym: 0 });
      });
    });
    W.dry({ opacity: 1, edge: lerp(0.08, 0.4, near), edgeWidth: 0.14, sharpness: 0.8, centreLift: 0, granulation: 0, flow: 0.12, flowScale: 2, darken: lerp(0.08, 0.3, near), blend: 'source-over' });
  }
  const eye = lerp(0.5, 0.78, near);
  open.forEach((f) => {
    const i = f.id;
    const k = clamp01((f.open - 0.35) / 0.5);
    if (!visible(k)) return;
    const s = f.size * easeOut(k);
    const c = { x: f.c.x, y: f.c.y - f.size * 0.05 };
    if (near > 0.02) p.dab(c, HEART, { rng: rng.fork(`heart-${i}`), variant: 'round', angle: 0, length: s * 0.42, width: s * 0.3, opacity: 0.7 * near * smooth(k), blend: 'source-over', edge: 0.1, pool: 0, basePool: 0 });
    p.dab(c, o.eye, { rng: rng.fork(`eye-${i}`), variant: 'round', angle: 0, length: s * 0.5 * eye * lerp(1, 0.55, near), width: s * 0.36 * eye * lerp(1, 0.55, near), opacity: 0.95 * smooth(k), blend: 'source-over', edge: 0.2, pool: 0.15, basePool: 0, darken: 0.12 });
    // close: a ring of stamen dots round the heart, as on plum blossom
    if (near > 0.02) {
      const n = 7;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + i;
        const r = s * 0.26 * smooth(k);
        p.dab({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * f.view.tilt }, o.eye, { rng: rng.fork(`st-${i}-${j}`), variant: 'round', angle: 0, length: s * 0.11, width: s * 0.1, opacity: 0.9 * near * smooth(k), blend: 'source-over', edge: 0.3, pool: 0, basePool: 0, darken: 0.2 });
      }
    }
  });
}
