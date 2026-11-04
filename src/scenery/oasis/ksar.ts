/**
 * The ksar's buildings as shapes in world units (O2): pisé towers that taper, with horned corner
 * merlons and a lit right flank, the houses behind them and the ruined curtain walls in front.
 * Pure geometry (seeded where it crumbles), shared by the skyline, the rock painter and daylight.
 * docs/systems/scenery.md › Oasis.
 */
import { createRng } from '../../core/rng';
import type { Pt } from '../../render/viewport';

export type BlockKind = 'tower' | 'house' | 'curtain';

/** A block: front face from `x` to `x + w`, `h` tall above `base`, a lit flank `side` deep. */
export interface Block {
  id: string;
  kind: BlockKind;
  x: number;
  w: number;
  h: number;
  base: number;
  side: number;
}

/** How deep each block runs into the rock under its base, so the lip in front can seat it. */
export const FOOTING = 14;

/** Back to front: the houses behind, the towers, then the ruined curtain walls. */
export const KSAR: readonly Block[] = [
  { id: 'house-west', kind: 'house', x: 440, w: 52, h: 70, base: 318, side: 0 },
  { id: 'house-mid', kind: 'house', x: 528, w: 108, h: 92, base: 318, side: 0 },
  { id: 'house-east', kind: 'house', x: 702, w: 120, h: 96, base: 318, side: 0 },
  { id: 'tower-west', kind: 'tower', x: 474, w: 62, h: 118, base: 318, side: 16 },
  { id: 'tower-mid', kind: 'tower', x: 626, w: 76, h: 150, base: 318, side: 18 },
  { id: 'tower-east', kind: 'tower', x: 818, w: 62, h: 132, base: 318, side: 16 },
  { id: 'wall-west', kind: 'curtain', x: 430, w: 52, h: 38, base: 330, side: 0 },
  { id: 'wall-mid', kind: 'curtain', x: 536, w: 92, h: 50, base: 330, side: 0 },
  { id: 'wall-east', kind: 'curtain', x: 702, w: 118, h: 44, base: 330, side: 0 },
];

/** The palms growing inside the walls: crown, trunk foot, size. */
export const KSAR_PALMS: readonly { top: Pt; base: Pt; size: number }[] = [
  { top: { x: 592, y: 212 }, base: { x: 586, y: 300 }, size: 1.05 },
  { top: { x: 768, y: 206 }, base: { x: 776, y: 300 }, size: 0.95 },
];

/** A tower's taper on each side at the top. */
export const taper = (b: Block): number => (b.kind === 'tower' ? b.w * 0.06 : 0);
/** How far a horn rises above the parapet. */
export const HORN = 16;

/** The parapet line of a tower, left → right: a horned merlon at each corner, small steps between. */
function towerTop(x0: number, x1: number, top: number): Pt[] {
  const w = x1 - x0;
  const hw = Math.max(9, w * 0.19);
  const out: Pt[] = [
    { x: x0 - 1.5, y: top + 3 },
    { x: x0 - 2, y: top - HORN * 0.7 },
    { x: x0 + hw * 0.2, y: top - HORN },
    { x: x0 + hw * 0.55, y: top - HORN * 0.92 },
    { x: x0 + hw, y: top - HORN * 0.55 },
    { x: x0 + hw, y: top - 2 },
  ];
  // the small stepped merlons between the horns
  const n = Math.max(1, Math.round((w - 2 * hw) / 13));
  const step = (w - 2 * hw) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + hw + i * step;
    out.push({ x: a + step * 0.2, y: top - 2 }, { x: a + step * 0.3, y: top - 7 }, { x: a + step * 0.7, y: top - 7 }, { x: a + step * 0.8, y: top - 2 });
  }
  out.push(
    { x: x1 - hw, y: top - 2 },
    { x: x1 - hw, y: top - HORN * 0.55 },
    { x: x1 - hw * 0.55, y: top - HORN * 0.92 },
    { x: x1 - hw * 0.2, y: top - HORN },
    { x: x1 + 2, y: top - HORN * 0.7 },
    { x: x1 + 1.5, y: top + 3 },
  );
  return out;
}

/** A house's or curtain wall's top: square merlons, worn or fallen where it is ruined. */
function wallTop(b: Block, x0: number, x1: number, top: number): Pt[] {
  const rng = createRng(`ksar-${b.id}`);
  const ruined = b.kind === 'curtain';
  const out: Pt[] = [{ x: x0, y: top + (ruined ? rng.range(2, 8) : 0) }];
  const size = ruined ? 6 : 5;
  const n = Math.max(2, Math.round((x1 - x0) / 12));
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * step;
    // a ruined wall loses whole stretches of its top: broken, slumped, never pillowy
    const fall = ruined ? (rng.chance(0.45) ? rng.range(6, 18) : rng.range(0, 4)) : rng.chance(0.15) ? rng.range(1, 3) : 0;
    const merlon = !ruined || fall < 5;
    if (merlon) out.push({ x: a + step * 0.1, y: top - size + fall }, { x: a + step * 0.55, y: top - size + fall + rng.range(-1, 1.5) });
    out.push({ x: a + step * 0.6, y: top + fall * 0.8 }, { x: a + step, y: top + fall * 0.7 + rng.range(0, ruined ? 4 : 0.5) });
  }
  out.push({ x: x1, y: top + (ruined ? rng.range(0, 6) : 0) });
  return out;
}

export interface BlockShape {
  block: Block;
  /** the face toward the viewer, its foot `FOOTING` into the rock */
  front: Pt[];
  /** the lit right flank (empty for flat walls) */
  flank: Pt[];
  /** the parapet line of the front, left → right */
  top: Pt[];
}

/** One block's shapes. Deterministic: the same block always crumbles the same way. */
export function blockShape(b: Block): BlockShape {
  const top = b.base - b.h;
  const t = taper(b);
  const x0 = b.x + t;
  const x1 = b.x + b.w - t;
  const line = b.kind === 'tower' ? towerTop(x0, x1, top) : wallTop(b, x0, x1, top);
  const foot = b.base + FOOTING;
  const front = [...line, { x: b.x + b.w, y: foot }, { x: b.x, y: foot }];
  let flank: Pt[] = [];
  if (b.side > 0) {
    const s = b.side;
    const lift = s * 0.3;
    // the flank's own far horn, smaller with distance
    flank = [
      { x: x1 + 1.5, y: top + 3 },
      { x: x1 + 2, y: top - HORN * 0.7 },
      { x: x1 + s * 0.35, y: top - HORN * 0.85 - lift * 0.4 },
      { x: x1 + s * 0.6, y: top - 2 - lift * 0.6 },
      { x: x1 + s - 3, y: top - 2 - lift },
      { x: x1 + s - 2, y: top - HORN * 0.6 - lift },
      { x: x1 + s, y: top - HORN * 0.75 - lift },
      { x: b.x + b.w + s, y: foot - lift },
      { x: b.x + b.w, y: foot },
    ];
  }
  return { block: b, front, flank, top: line };
}

/** Every block's shapes, back to front. */
export const KSAR_SHAPES: readonly BlockShape[] = KSAR.map(blockShape);

/** The window slits of a block: top-left corners, `w` × `h` each. */
export function windows(b: Block): { x: number; y: number; w: number; h: number }[] {
  if (b.kind === 'curtain') return [];
  const rng = createRng(`ksar-win-${b.id}`);
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const top = b.base - b.h;
  const first = top + (b.kind === 'tower' ? 44 : 22);
  for (let y = first; y < b.base - 20; y += rng.range(22, 30)) {
    for (let x = b.x + 8 + rng.range(0, 6); x < b.x + b.w - 12; x += rng.range(14, 22)) {
      if (rng.chance(0.45)) continue;
      out.push({ x, y, w: rng.range(3, 4.5), h: rng.range(6, 9) });
    }
  }
  return out;
}
