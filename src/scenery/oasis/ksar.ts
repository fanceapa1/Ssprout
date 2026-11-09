/**
 * The ksar's buildings as shapes in world units (O2, O9): pisé towers that taper, with rounded
 * horns and a lit right flank, the houses stepping back behind them and the ruined curtain walls
 * in front. Pure geometry (seeded where it crumbles), shared by the skyline, the rock painter and
 * daylight. docs/systems/scenery.md › Oasis.
 */
import { createRng, type Rng } from '../../core/rng';
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

/** Back to front: the houses behind (the far ones first), the towers, then the ruined curtain walls. */
export const KSAR: readonly Block[] = [
  { id: 'house-west-back', kind: 'house', x: 452, w: 30, h: 80, base: 318, side: 4 },
  { id: 'house-mid-back', kind: 'house', x: 598, w: 34, h: 104, base: 318, side: 4 },
  { id: 'house-east-back', kind: 'house', x: 708, w: 44, h: 110, base: 318, side: 4 },
  { id: 'house-west', kind: 'house', x: 440, w: 52, h: 70, base: 318, side: 5 },
  { id: 'house-mid', kind: 'house', x: 528, w: 108, h: 92, base: 318, side: 5 },
  { id: 'house-east', kind: 'house', x: 702, w: 124, h: 96, base: 318, side: 5 },
  { id: 'tower-west', kind: 'tower', x: 474, w: 62, h: 118, base: 318, side: 11 },
  { id: 'tower-mid', kind: 'tower', x: 626, w: 76, h: 150, base: 318, side: 12 },
  { id: 'tower-east', kind: 'tower', x: 818, w: 62, h: 132, base: 318, side: 11 },
  { id: 'wall-west', kind: 'curtain', x: 430, w: 52, h: 38, base: 330, side: 0 },
  { id: 'wall-mid', kind: 'curtain', x: 536, w: 92, h: 50, base: 330, side: 0 },
  { id: 'wall-east', kind: 'curtain', x: 702, w: 118, h: 44, base: 330, side: 0 },
];

/** The palms growing inside the walls: crown, trunk foot, size. */
export const KSAR_PALMS: readonly { top: Pt; base: Pt; size: number }[] = [
  { top: { x: 578, y: 206 }, base: { x: 572, y: 300 }, size: 1.05 },
  { top: { x: 784, y: 200 }, base: { x: 790, y: 300 }, size: 0.95 },
];

/** A block's taper on each side at the top: pisé walls lean in as they rise. */
export const taper = (b: Block): number => (b.kind === 'tower' ? b.w * 0.09 : b.kind === 'house' ? 1.5 : 0);
/** How far a horn rises above the parapet. */
export const HORN = 16;

/** A rounded rise from `a` to `c`, `h` high: a worn mud cap with no square corners. */
function bump(out: Pt[], a: number, c: number, base: number, h: number, lean = 0): void {
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    out.push({ x: a + (c - a) * t, y: base - h * Math.sin(Math.PI * t) ** 0.55 + lean * (t - 0.5) });
  }
}

/** The parapet line of a tower, left → right: a rounded horn at each corner, worn merlons between. */
function towerTop(b: Block, x0: number, x1: number, top: number): Pt[] {
  const rng = createRng(`ksar-top-${b.id}`);
  const w = x1 - x0;
  const hw = Math.max(10, w * 0.22);
  // the horn: a blunt pinnacle, its head worn round and flat, a low shoulder inside it
  const prof: [number, number][] = [[-0.12, -0.2], [-0.1, 0.55], [-0.07, 0.85], [0, 0.97], [0.12, 1], [0.3, 1], [0.42, 0.95], [0.48, 0.8], [0.5, 0.56], [0.75, 0.5], [1, 0.42]];
  const horn = (dir: 1 | -1, from: number): Pt[] => prof.map(([t, k]) => ({ x: from + dir * t * hw, y: top - HORN * k }));
  const out = horn(1, x0);
  out.push({ x: x0 + hw + 1, y: top - 1 });
  const n = Math.max(1, Math.round((w - 2 * hw) / 13));
  const step = (w - 2 * hw - 2) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + hw + 1 + i * step;
    // weathered unevenly: most worn round, now and then one gone down to a dip
    const h = rng.chance(0.15) ? rng.range(1.5, 3) : rng.range(6.5, 9.5);
    out.push({ x: a + step * 0.1, y: top + 0.5 });
    bump(out, a + step * 0.24, a + step * 0.8, top, h, rng.range(-1, 1));
  }
  out.push({ x: x1 - hw - 1, y: top - 1 });
  out.push(...horn(-1, x1).reverse());
  return out;
}

/** A house's or curtain wall's top: a low worn parapet, or a ruined crest slumped into saddles. */
function wallTop(b: Block, x0: number, x1: number, top: number): Pt[] {
  const rng = createRng(`ksar-${b.id}`);
  const out: Pt[] = [];
  if (b.kind === 'curtain') {
    const n = Math.max(3, Math.round((x1 - x0) / 7));
    const breach = rng.range(0.25, 0.75);
    const bw = rng.range(0.12, 0.22);
    const phase = rng.range(0, 6);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const wear = Math.max(0, 1 - Math.abs(t - breach) / bw);
      const ends = Math.max(0, 1 - Math.min(t, 1 - t) / 0.1);
      // broken, not slumped: a sharp notch now and then where a chunk has come away
      const notch = rng.chance(0.22) ? rng.range(3, 7) : 0;
      const y = top + Math.sin(t * 9 + phase) * 2.4 + wear ** 1.5 * 16 + ends * 6 + rng.range(-1.6, 1.6) + notch;
      out.push({ x: x0 + (x1 - x0) * t, y });
      if (i < n && wear === 0 && ends === 0 && !notch && rng.chance(0.25)) {
        const a = x0 + (x1 - x0) * (t + 0.2 / n);
        const h = rng.range(3, 6);
        out.push({ x: a, y: y - h }, { x: a + rng.range(2.5, 4), y: y - h - rng.range(-1, 1) });
      }
    }
    return out;
  }
  // a house: a flat roof behind a low parapet, small rounded merlons, its corners a little higher
  out.push({ x: x0 - 0.5, y: top + 1 });
  bump(out, x0, x0 + 6, top, 6);
  const n = Math.max(1, Math.round((x1 - x0 - 12) / 11));
  const step = (x1 - x0 - 12) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + 6 + i * step;
    out.push({ x: a + step * 0.1, y: top + rng.range(-0.5, 1) });
    if (!rng.chance(0.25)) bump(out, a + step * 0.3, a + step * 0.75, top, rng.range(3, 5));
  }
  bump(out, x1 - 6, x1, top, 6);
  out.push({ x: x1 + 0.5, y: top + 1 });
  return out;
}

/** The points between `a` and `c` along a side, nudged by a slow bulge and a little crumble. */
function side(a: Pt, c: Pt, rng: Rng, amp: number): Pt[] {
  const n = Math.max(2, Math.round(Math.abs(c.y - a.y) / 9));
  const phase = rng.range(0, 6);
  const out: Pt[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    out.push({ x: a.x + (c.x - a.x) * t + (Math.sin(t * 5 + phase) * 0.5 + rng.range(-0.5, 0.5)) * amp, y: a.y + (c.y - a.y) * t });
  }
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
  const line = b.kind === 'tower' ? towerTop(b, x0, x1, top) : wallTop(b, x0, x1, top);
  const foot = b.base + FOOTING;
  const rng = createRng(`ksar-side-${b.id}`);
  const amp = b.kind === 'tower' ? 1.6 : 1;
  const front = [
    ...line,
    ...side(line[line.length - 1]!, { x: b.x + b.w, y: foot }, rng, amp),
    { x: b.x + b.w, y: foot },
    { x: b.x, y: foot },
    ...side({ x: b.x, y: foot }, line[0]!, rng, amp),
  ];
  let flank: Pt[] = [];
  if (b.side > 0) {
    const s = b.side;
    const lift = s * 0.3;
    // tucked 6 under the front so no paper shows at the corner; a tower's carries a far horn
    flank = b.kind === 'tower'
      ? [
          { x: x1 - 6, y: top + 2 },
          { x: x1 + 2, y: top - 2 },
          { x: x1 + s - 4, y: top - 2 + lift },
          { x: x1 + s - 3, y: top - HORN * 0.55 + lift + 1 },
          { x: x1 + s, y: top - HORN * 0.55 + lift + 2 },
          { x: b.x + b.w + s, y: foot },
          { x: b.x + b.w - 6, y: foot },
        ]
      : [
          { x: x1 - 6, y: top + 2 },
          { x: x1 + 1, y: top },
          { x: x1 + s * 0.5, y: top + lift * 0.5 },
          { x: x1 + s - 0.5, y: top + lift },
          { x: x1 + s, y: top + lift + 0.5 },
          { x: b.x + b.w + s, y: foot },
          { x: b.x + b.w - 6, y: foot },
        ];
  }
  return { block: b, front, flank, top: line };
}

/** Every block's shapes, back to front. */
export const KSAR_SHAPES: readonly BlockShape[] = KSAR.map(blockShape);

export type OpeningKind = 'slit' | 'square' | 'arch';

/** An opening in a wall: top-left corner, `w` × `h`, its shape, and a palm-wood lintel or not. */
export interface Opening {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: OpeningKind;
  lintel: boolean;
}

/**
 * A block's openings: few and small, as on a real ksar, placed loosely (never a grid). A tower
 * has three to five slits and windows below its bands; a house one to three under its parapet.
 */
export function windows(b: Block): Opening[] {
  if (b.kind === 'curtain') return [];
  const rng = createRng(`ksar-win-${b.id}`);
  const top = b.base - b.h;
  const out: Opening[] = [];
  const tower = b.kind === 'tower';
  const count = tower ? 3 + Math.round(rng.range(0, 2)) : b.id.endsWith('-back') ? 1 : Math.min(3, Math.max(1, Math.round(b.w / 45 + rng.range(0, 1))));
  const lo = top + (tower ? 42 : 14);
  const hi = b.base - (tower ? 24 : 34);
  const t = taper(b) * 0.6;
  for (let tries = 0; out.length < count && tries < 40; tries++) {
    const kind: OpeningKind = rng.pick(tower ? (['slit', 'slit', 'square', 'arch'] as const) : (['square', 'square', 'slit', 'arch'] as const));
    const w = kind === 'slit' ? rng.range(2.2, 3.2) : kind === 'arch' ? rng.range(4.5, 6) : rng.range(3.5, 5.5);
    const h = kind === 'slit' ? rng.range(7, 11) : kind === 'arch' ? w * rng.range(1.5, 1.9) : w * rng.range(0.9, 1.3);
    const x = rng.range(b.x + t + 7, b.x + b.w - t - 9 - w);
    const y = rng.range(lo, hi - h);
    if (out.some((o) => Math.abs(o.x - x) < 9 && Math.abs(o.y - y) < 13)) continue;
    out.push({ x, y, w, h, kind, lintel: kind !== 'slit' && rng.chance(0.55) });
  }
  return out;
}
