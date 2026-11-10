/**
 * The oasis's water in motion (O6, ADR 0282): the seguia's small falls and their splashes, the
 * thin spill over the sluice gate, slow rings from the basin's inlet and glints and riffles
 * drifting down the oued. Sprites are painted once, in parts; each frame only blits them, clipped
 * to their water, as a pure function of the animation time. docs/systems/scenery.md › Oasis › Motion.
 */
import { createRng, type Rng } from '../../core/rng';
import { blob, bounds, createPainter, makeCanvas, mix, pointInPolygon, type AnyCanvas, type Painter } from '../../paint';
import type { Pt, Rect } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import type { SceneryMotion } from '../types';
import { SEGUIA, SLUICE_WATER } from './geometry';
import { SEGUIA_FALLS } from './layout';
import { BASIN_INLET, OUED_BARS, SLUICE_GATE, WATER, WATER_BOXES, WATER_SHAPES, fallHalf, ouedAt } from './paint-water';

/** Playback speed of the whole motion: the waterfall's pace (the owner's). */
const TEMPO = 1.25;
/** Random draws per mark, three per cycle, so passes differ. */
const TABLE = 96;
/** Water leaves a fall's lip and reaches its foot at these speeds (units a second). */
const V_LIP = 16;
const V_FOOT = 44;

/** Where the seguia's last fall comes through the coping into the basin: the rings' centre. */
export const INLET: Pt = { x: BASIN_INLET.to.x + 4, y: BASIN_INLET.to.y + 1 };
/** How far the inlet's rings spread (world units, across) and how long one takes (seconds). */
const RING_MAX = 150;
const RING_S = 11;

const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
const union = (rs: Rect[]): Rect => {
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  return { x: x0, y: y0, w: Math.max(...rs.map((r) => r.x + r.w)) - x0, h: Math.max(...rs.map((r) => r.y + r.h)) - y0 };
};

/** What each element can touch, world units (the motion skips any the view misses). */
export const MOTION_BOXES = {
  falls: WATER_BOXES.falls.map((b) => grow(b, 6)),
  gate: grow(union([bounds(SLUICE_GATE.cut), bounds(SLUICE_GATE.spill), bounds(SLUICE_GATE.foam)]), 8),
  rings: { x: INLET.x - 20, y: INLET.y - 20, w: RING_MAX + 40, h: 50 },
  oued: WATER_BOXES.oued,
};
export const MOTION_BOUNDS = union([...MOTION_BOXES.falls, MOTION_BOXES.gate, MOTION_BOXES.rings, MOTION_BOXES.oued]);

/** A small fall's sheet: its lip, foot and half-width at fraction `k` down it (as `fallSheet`). */
export const FALLS = SEGUIA_FALLS.map((f, i) => {
  const top = f.top.y + 1;
  const foot = f.top.y + f.drop;
  const g = (V_FOOT * V_FOOT - V_LIP * V_LIP) / (2 * (foot - top));
  return { x: f.top.x, top, foot, g, s: (V_FOOT - V_LIP) / g, sheet: WATER_SHAPES.falls[i]!, half: fallHalf };
});
type Fall = (typeof FALLS)[number];

/** Height on fall `f` of water that left its lip `a` seconds ago (clamped to the sheet). */
export function fallDropAt(f: Fall, a: number): number {
  const s = a < 0 ? 0 : a > f.s ? f.s : a;
  return f.top + V_LIP * s + (f.g * s * s) / 2;
}

/** The oued's deeper braids, as `paintOued` lays its threads: sparser glints over them. */
const BRAIDS: [number, number, (s: number) => number, (s: number) => number][] = [
  [0, 1.02, (s) => 0.03 + 0.04 * Math.sin(s * 9), (s) => 0.34 + 0.08 * Math.sin(s * 5 + 1)],
  [0.36, 1.02, (s) => 0.74 + 0.04 * Math.sin(s * 7), (s) => 0.88 + 0.03 * Math.sin(s * 6)],
  [0, 0.42, (s) => 0.4 + 0.05 * Math.sin(s * 11), () => 0.56],
];
const inBraid = (s: number, u: number) => BRAIDS.some(([s0, s1, u0, u1]) => s >= s0 && s <= s1 && u >= u0(s) && u <= u1(s));
/** Each bar's head: where the water parts and riffles. */
export const BAR_HEADS: Pt[] = OUED_BARS.map((bar) => {
  const b = bounds(bar);
  return { x: b.x + b.w * 0.5, y: b.y + 2 };
});
const inBar = (q: Pt) => OUED_BARS.some((bar) => pointInPolygon(q, bar));
/** How lively the oued is at `q`: 1 in the open shallows, more by a bar's head, less over a braid. */
function liveliness(s: number, u: number, q: Pt): number {
  let k = inBraid(s, u) ? 0.35 : 1;
  for (const h of BAR_HEADS) {
    const d = Math.hypot((q.x - h.x) / 40, (q.y - h.y) / 30);
    if (d < 1.6) k = Math.max(k, 1.6 - d * 0.4);
  }
  return k;
}
/** The oued's length down its middle, world units (its speed in `s` comes from it). */
const OUED_LENGTH = (() => {
  let n = 0;
  for (let i = 0; i < 40; i++) {
    const a = ouedAt(i / 40, 0.5);
    const b = ouedAt((i + 1) / 40, 0.5);
    n += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return n;
})();

interface Sprite {
  image: CanvasImageSource;
  w: number;
  h: number;
}
type FallKind = 'sheen' | 'shade' | 'thread';

/** A mark falling down a lane of one fall. */
interface Faller {
  fall: number;
  kind: FallKind;
  /** lane centre across the sheet (-1 left … 1 right) and width (a fraction of the sheet) */
  u: number;
  w: number;
  cycle: number;
  phase: number;
  alpha: number;
  table: Float32Array;
}
/** Something pulsing in place: a splash puff, a splash shade, a glint on the spill. */
interface Pulse {
  x: number;
  y: number;
  size: number;
  cycle: number;
  phase: number;
  alpha: number;
  table: Float32Array;
}
/** A glint or a riffle line drifting down the oued. */
interface Drifter {
  kind: 'glint' | 'riffle';
  cycle: number;
  phase: number;
  /** life in seconds of a pass (the rest of the cycle it is gone) */
  life: number;
  alpha: number;
  table: Float32Array;
}
/** A riffle standing at a bar's head, slipping a little way down its side and back. */
interface Standing {
  head: Pt;
  side: number;
  /** how far along the parting arc (0 at the head) */
  at: number;
  size: number;
  cycle: number;
  phase: number;
  alpha: number;
  table: Float32Array;
}

/** One drawn mark, for tests: which element and where its middle lies, world units. */
export interface Mark {
  element: 'fall' | 'splash' | 'gate' | 'ring' | 'oued';
  index: number;
  x: number;
  y: number;
}

export interface OasisMotion extends SceneryMotion {
  readonly ready: boolean;
  /** the marks drawn at time `t` (for tests) */
  marksAt(t: number): Mark[];
  /** how many marks each element draws at `t` (for tests) */
  visibleAt(t: number): Record<Mark['element'], number>;
  /** the painted sprites by kind, world size (for the studio) */
  sprites(): { kind: string; image: CanvasImageSource; w: number; h: number }[];
}

export interface OasisMotionOptions {
  seed?: number | string;
  /** no motion: draw nothing, the still painting stays (reduced motion) */
  still?: boolean;
}

function tableOf(rng: Rng): Float32Array {
  const t = new Float32Array(TABLE);
  for (let i = 0; i < TABLE; i++) t[i] = rng.next();
  return t;
}
const pick = (table: Float32Array, n: number, k = 0) => table[(((n * 3 + k) % TABLE) + TABLE) % TABLE]!;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The falls' turquoise a shade deeper and a little greyed: the darker surges between the lights. */
const SURGE = mix(mix(WATER.turquoise, WATER.teal, 0.3), '#8a8e88', 0.1);
const RIFFLE = mix(WATER.teal, WATER.milkMid, 0.35);

export function createOasisMotion(opts: OasisMotionOptions = {}): OasisMotion {
  const seed = String(opts.seed ?? 13);
  const rng = createRng(`${seed}:oasis-motion`);
  let ready = false;
  const fallSprites: Record<FallKind, Sprite[]> = { sheen: [], shade: [], thread: [] };
  const puffSprites: Sprite[] = [];
  const poolSprites: Sprite[] = [];
  const glassSprites: Sprite[] = [];
  const ringSprites: Sprite[] = [];
  const glintSprites: Sprite[] = [];
  const riffleSprites: Sprite[] = [];
  const partSprites: Sprite[] = [];

  // the falls: three light lanes and two shade lanes across each sheet, narrow like the painted
  // strands, two marks a lane out of phase so the sheen never stops, and four threads
  const fallers: Faller[] = [];
  for (const [i, f] of FALLS.entries()) {
    const lanes: [FallKind, number, number][] = [['sheen', -0.6, 0.32], ['shade', -0.2, 0.3], ['sheen', 0.15, 0.32], ['shade', 0.45, 0.3], ['sheen', 0.72, 0.28]];
    for (const [kind, u, w] of lanes) {
      const cycle = f.s * (kind === 'shade' ? 1.9 : 1) + rng.range(0.5, 0.9);
      const phase = rng.range(0, cycle);
      for (let j = 0; j < 2; j++) {
        fallers.push({ fall: i, kind, u: u + rng.range(-0.08, 0.08), w, cycle, phase: phase + (cycle * j) / 2 + rng.range(-0.1, 0.1), alpha: kind === 'shade' ? rng.range(0.6, 0.85) : rng.range(0.6, 0.85), table: tableOf(rng) });
      }
    }
    for (let j = 0; j < 4; j++) {
      const cycle = f.s + rng.range(0.6, 1.4);
      fallers.push({ fall: i, kind: 'thread', u: -0.75 + j * 0.5 + rng.range(-0.15, 0.15), w: 0.12, cycle, phase: rng.range(0, cycle), alpha: rng.range(0.6, 0.85), table: tableOf(rng) });
    }
  }
  // the splash at each foot: pale puffs flickering up out of the foam, a cool shade breathing either side
  const puffs: { fall: number; p: Pulse }[] = [];
  const pools: { fall: number; p: Pulse }[] = [];
  for (const [i, f] of FALLS.entries()) {
    for (let j = 0; j < 4; j++) {
      const cycle = rng.range(0.7, 1.1);
      const u = (j - 1.5) / 1.5;
      puffs.push({ fall: i, p: { x: f.x + u * (fallHalf(1) + 1) + rng.range(-1.5, 1.5), y: f.foot - 1 + Math.abs(u) * 1.5 + rng.range(-0.5, 0.5), size: rng.range(8, 11) - Math.abs(u) * 2, cycle, phase: rng.range(0, cycle), alpha: rng.range(0.5, 0.7), table: tableOf(rng) } });
    }
    for (const side of [-1, 1]) {
      const cycle = rng.range(2.2, 3.2);
      pools.push({ fall: i, p: { x: f.x + side * 11, y: f.foot + 3.5, size: rng.range(13, 16), cycle, phase: rng.range(0, cycle), alpha: rng.range(0.5, 0.7), table: tableOf(rng) } });
    }
  }
  // the spill over the gate board: glassy lights slipping outward over it, along its length
  const g = SLUICE_GATE;
  const [s0, s1, s2, s3] = g.spill as unknown as readonly [Pt, Pt, Pt, Pt];
  const glass: Pulse[] = [];
  for (let j = 0; j < 5; j++) {
    const cycle = rng.range(1.1, 1.7);
    glass.push({ x: (j + 0.5) / 5 + rng.range(-0.05, 0.05), y: 0, size: rng.range(6, 8), cycle, phase: rng.range(0, cycle), alpha: rng.range(0.5, 0.75), table: tableOf(rng) });
  }
  // the foot's flicker sits on the painted foam, downstream of the board
  const [f1, f2] = g.foam;
  const spillFoot: Pulse = { x: (f1.x + f2.x) / 2 + 1, y: (f1.y + f2.y) / 2 + 0.5, size: 7, cycle: 1.8, phase: rng.range(0, 2), alpha: 0.45, table: tableOf(rng) };
  // the inlet's rings, three on the go
  const rings = Array.from({ length: 3 }, (_, j) => ({ phase: (RING_S * j) / 3 + rng.range(-0.6, 0.6), table: tableOf(rng) }));
  // the oued: glints and riffle lines drifting down, and riffles standing at each bar's head
  const drifters: Drifter[] = [];
  for (let j = 0; j < 56; j++) {
    const kind = j % 3 === 2 ? 'riffle' : 'glint';
    const life = kind === 'glint' ? rng.range(2.2, 3.6) : rng.range(3, 4.5);
    const cycle = life + rng.range(0.3, 1.5);
    drifters.push({ kind, cycle, phase: rng.range(0, cycle), life, alpha: kind === 'glint' ? rng.range(0.7, 0.95) : rng.range(0.55, 0.8), table: tableOf(rng) });
  }
  const standing: Standing[] = [];
  for (const head of BAR_HEADS) {
    for (const side of [-1, 1]) {
      for (let j = 0; j < 2; j++) {
        const cycle = rng.range(1.6, 2.4);
        standing.push({ head, side, at: 0.2 + j * 0.4 + rng.range(-0.05, 0.05), size: 1, cycle, phase: rng.range(0, cycle), alpha: rng.range(0.5, 0.7), table: tableOf(rng) });
      }
    }
  }

  const sprite = (w: number, h: number, label: string, res: number): { s: Sprite; p: Painter } => {
    const canvas = makeCanvas(w * res, h * res);
    const p = createPainter(canvas, { seed: `${seed}:${label}` });
    p.ctx.setTransform(res, 0, 0, res, 0, 0);
    return { s: { image: canvas as CanvasImageSource, w, h }, p };
  };
  /** a painted sprite as a bitmap: blitting a canvas the painter read back would upload it every frame */
  const seal = (s: Sprite): Sprite => {
    const c = s.image as AnyCanvas;
    return 'transferToImageBitmap' in c ? { ...s, image: c.transferToImageBitmap() } : s;
  };
  /** a spindle 0..w wide and 0..h tall, fullest at `fullAt` down it, a little wavy, rounded at the head */
  const spindle = (r: Rng, w: number, h: number, fullAt: number): Pt[] => {
    const left: Pt[] = [];
    const right: Pt[] = [];
    const ph = r.range(0, 6);
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      const bulge = s < fullAt ? Math.sin((s / fullAt) * (Math.PI / 2)) : Math.sqrt(Math.max(0, 1 - ((s - fullAt) / (1 - fullAt)) ** 2));
      const half = (w / 2) * Math.max(0.05, bulge ** 0.7) * (0.85 + 0.15 * Math.sin(s * 8 + ph));
      const y = 1 + s * (h - 2);
      left.push({ x: w / 2 - half, y });
      right.push({ x: w / 2 + half, y });
    }
    return [...left, ...right.reverse()];
  };
  /** a thin level mark `w` long, a little bowed, `h` thick at its middle */
  const dash = (cx: number, cy: number, w: number, h: number, bow: number): Pt[] => {
    const top: Pt[] = [];
    const bot: Pt[] = [];
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      const x = cx - w / 2 + s * w;
      const y = cy + bow * (4 * (s - 0.5) ** 2 - 1);
      const half = (h / 2) * Math.sin(Math.PI * s) ** 0.8;
      top.push({ x, y: y - half });
      bot.push({ x, y: y + half });
    }
    return [...top, ...bot.reverse()];
  };

  function* paintFalls(): Strokes {
    for (let i = 0; i < 3; i++) {
      const r = rng.fork(`sheen-${i}`);
      const { s, p } = sprite(6, 30, `sheen-${i}`, 8);
      yield* p.parts.lift(spindle(r, 6, 30, r.range(0.6, 0.75)), { rng: r, amount: r.range(0.7, 0.85), deform: 0.1, spread: 0.15, layers: 5, sharpness: 0.25, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.6 } });
      fallSprites.sheen.push(seal(s));
      yield;
    }
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(`shade-${i}`);
      const { s, p } = sprite(6, 30, `shade-${i}`, 8);
      yield* p.parts.wash(spindle(r, 6, 30, r.range(0.75, 0.85)), SURGE, { rng: r, opacity: 0.55, deform: 0.12, spread: 0.25, layers: 6, edge: 0.03, sharpness: 0.05, fade: { angle: -Math.PI / 2, start: 0.35, amount: 1, ragged: 0.7 } });
      fallSprites.shade.push(seal(s));
      yield;
    }
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(`thread-${i}`);
      const { s, p } = sprite(2, 30, `thread-${i}`, 10);
      // a bright thread over the shades, and a teal one over the pale sheet
      const fade = { angle: -Math.PI / 2, start: 0.45, amount: 1 };
      if (i === 0) yield* p.parts.lift(spindle(r, 2, 30, 0.8), { rng: r, amount: 0.95, deform: 0.04, spread: 0.05, layers: 4, sharpness: 0.5, fade });
      else yield* p.parts.wash(spindle(r, 1.4, 30, 0.8), WATER.teal, { rng: r, opacity: 0.6, deform: 0.04, spread: 0.05, layers: 4, edge: 0.2, sharpness: 0.5, fade });
      fallSprites.thread.push(seal(s));
      yield;
    }
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(`puff-${i}`);
      const { s, p } = sprite(24, 12, `puff-${i}`, 6);
      yield* p.parts.lift(blob(12, 6, 10, 4, r, { irregularity: 0.4, points: 14 }), { rng: r, amount: r.range(0.75, 0.9), deform: 0.35, spread: 0.35, layers: 5, sharpness: 0.05, edge: 0 });
      puffSprites.push(seal(s));
      yield;
    }
    const r = rng.fork('pool');
    const { s, p } = sprite(24, 10, 'pool', 5);
    yield* p.parts.glaze(blob(12, 5, 10, 3.2, r, { irregularity: 0.35, points: 14 }), mix(WATER.turquoise, WATER.teal, 0.3), { rng: r, opacity: 0.5, deform: 0.35, spread: 0.35, edge: 0.1 });
    poolSprites.push(seal(s));
    yield;
  }

  function* paintGlassAndRings(): Strokes {
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(`glass-${i}`);
      const { s, p } = sprite(8, 5, `glass-${i}`, 10);
      yield* p.parts.glaze(dash(4, 3.1, 7, 1.1, 0.2), mix(WATER.turquoise, WATER.teal, 0.5), { rng: r, opacity: 0.6, deform: 0.1, spread: 0.2, layers: 3, edge: 0.15 });
      yield* p.parts.lift(dash(4, 1.9, 7, 1.6, 0.2), { rng: r, amount: 0.9, deform: 0.1, spread: 0.2, layers: 4, sharpness: 0.3, edge: 0 });
      glassSprites.push(seal(s));
      yield;
    }
    // a ring's front arc and its faint back, at three sizes so the line keeps its width as it spreads
    for (const [i, width] of [30, 70, 140].entries()) {
      const r = rng.fork(`ring-${i}`);
      const h = width * 0.3 + 8;
      const { s, p } = sprite(width + 8, h, `ring-${i}`, 4);
      p.ripple({ x: width / 2 + 4, y: h / 2 }, { rng: r, width, count: 1, squash: 0.09, pigment: mix(WATER.deep, WATER.teal, 0.4), opacity: 0.55, light: 0.85, lineWidth: 0.9 });
      ringSprites.push(seal(s));
      yield;
    }
  }

  function* paintOued(): Strokes {
    for (let i = 0; i < 3; i++) {
      const r = rng.fork(`glint-${i}`);
      const { s, p } = sprite(18, 7, `glint-${i}`, 6);
      // a sky glint reads on the milky water only against the small trough under it
      const bow = r.range(-0.4, 0.4);
      yield* p.parts.glaze(dash(9, 4.6, r.range(12, 15), 2.1, bow), RIFFLE, { rng: r, opacity: 0.75, deform: 0.12, spread: 0.2, layers: 3, edge: 0.2, sharpness: 0.3 });
      yield* p.parts.lift(dash(9, 2.6, r.range(13, 17), r.range(2.6, 3.2), bow), { rng: r, amount: 0.95, deform: 0.15, spread: 0.25, layers: 4, sharpness: 0.3, edge: 0 });
      glintSprites.push(seal(s));
      yield;
    }
    for (let i = 0; i < 3; i++) {
      const r = rng.fork(`riffle-${i}`);
      const { s, p } = sprite(24, 8, `riffle-${i}`, 6);
      const bow = r.range(0.4, 0.9);
      yield* p.parts.glaze(dash(12, 3.2, r.range(16, 22), 2.4, bow), RIFFLE, { rng: r, opacity: 0.85, deform: 0.1, spread: 0.15, layers: 4, edge: 0.3, sharpness: 0.4 });
      yield* p.parts.lift(dash(12, 5.2, r.range(14, 20), 2, bow), { rng: r, amount: 0.75, deform: 0.1, spread: 0.2, layers: 3, sharpness: 0.3, edge: 0 });
      riffleSprites.push(seal(s));
      yield;
    }
    // a riffle parting at a bar's head: a short arc stepping down and out (drawn flipped for the left)
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(`part-${i}`);
      const { s, p } = sprite(16, 10, `part-${i}`, 6);
      const pts: Pt[] = [];
      for (let k = 0; k <= 8; k++) pts.push({ x: 1 + k * 1.7, y: 2 + (k / 8) ** 1.6 * 5 });
      yield* p.parts.glaze([...pts, ...pts.slice().reverse().map((q) => ({ x: q.x, y: q.y + 1.2 }))].map((q) => ({ x: q.x, y: q.y + 1.4 })), RIFFLE, { rng: r, opacity: 0.55, deform: 0.12, spread: 0.2, layers: 3, edge: 0.2 });
      yield* p.parts.lift([...pts, ...pts.slice().reverse().map((q) => ({ x: q.x, y: q.y + 1.6 }))], { rng: r, amount: 0.9, deform: 0.12, spread: 0.2, layers: 4, sharpness: 0.3, edge: 0 });
      partSprites.push(seal(s));
      yield;
    }
  }

  const trace = (ctx: CanvasRenderingContext2D, shape: readonly Pt[]) => {
    shape.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number): Pt[] => Array.from({ length: 16 }, (_, i) => ({ x: cx + Math.cos((i / 16) * Math.PI * 2) * rx, y: cy + Math.sin((i / 16) * Math.PI * 2) * ry }));
  /** clip what follows to `shapes` (nonzero), or with `holes` cut out of them, until restore */
  const clip = (ctx: CanvasRenderingContext2D, shapes: readonly (readonly Pt[])[], holes: readonly (readonly Pt[])[] = []) => {
    ctx.save();
    ctx.beginPath();
    for (const s of shapes) trace(ctx, s);
    for (const s of holes) trace(ctx, s);
    ctx.clip(holes.length ? 'evenodd' : 'nonzero');
  };
  /** where each fall's splash may show: round its foot, and the channel it falls into */
  const splashShapes = FALLS.map((f, i) => [ellipse(f.x, f.foot + 2.5, 19, 6.5), i === 0 ? SEGUIA[1]! : ellipse(f.x + 10, f.foot + 1, 24, 5)]);
  const gateShapes = [g.cut, g.spill.map((q) => ({ x: q.x + (q.x > (s0.x + s3.x) / 2 ? 1.5 : -0.5), y: q.y })), SLUICE_WATER];
  const ouedClip = WATER_SHAPES.oued;

  const drawFall = (ctx: CanvasRenderingContext2D | null, i: number, t: number, outer: number, marks: Mark[] | null): number => {
    const f = FALLS[i]!;
    let n = 0;
    for (const m of fallers) {
      if (m.fall !== i) continue;
      const time = t + m.phase;
      const c = Math.floor(time / m.cycle);
      const strength = pick(m.table, c, 2);
      if (strength < 0.12) continue;
      const a = time - c * m.cycle;
      // the shades run long, so their heads are lost in the splash and the sheet never shows a drip
      const len = f.s * (m.kind === 'thread' ? 0.3 + pick(m.table, c, 1) * 0.3 : m.kind === 'shade' ? 0.85 + pick(m.table, c, 1) * 0.4 : 0.45 + pick(m.table, c, 1) * 0.4);
      const y0 = fallDropAt(f, a - len);
      const y1 = Math.min(fallDropAt(f, a), f.foot + 2);
      const span = y1 - y0;
      if (span < 1.5) continue;
      const u = m.u + (pick(m.table, c, 1) - 0.5) * 0.12;
      const k0 = (y0 - f.top) / (f.foot - f.top);
      const k1 = (y1 - f.top) / (f.foot - f.top);
      const x0 = f.x + u * f.half(k0);
      const x1 = f.x + u * f.half(k1) * 1.1;
      n++;
      marks?.push({ element: 'fall', index: i, x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
      if (!ctx) continue;
      const set = fallSprites[m.kind];
      const sp = set[Math.floor(pick(m.table, c) * 7) % set.length]!;
      const width = 2 * f.half((k0 + k1) / 2) * m.w * (0.85 + 0.3 * strength);
      // born under the lip, swallowed by the splash by length and alpha
      ctx.globalAlpha = outer * m.alpha * (0.6 + 0.4 * strength) * smooth(span / 8) * (1 - smooth((y0 - (f.foot - 14)) / 12));
      ctx.save();
      ctx.transform(1, 0, (x1 - x0) / span, 1, x0, y0);
      ctx.drawImage(sp.image, -width / 2, 0, width, span);
      ctx.restore();
    }
    return n;
  };
  /** a pulse at `t`: how strong and how big (it swells, then sinks; passes differ) */
  const pulseAt = (p: Omit<Pulse, 'x' | 'y'>, t: number) => {
    const time = t + p.phase;
    const c = Math.floor(time / p.cycle);
    const u = time / p.cycle - c;
    return { u, c, alpha: p.alpha * Math.sin(Math.PI * u) ** 1.2 * (0.7 + 0.3 * pick(p.table, c, 1)), size: p.size * (0.75 + 0.4 * u) * (0.85 + 0.3 * pick(p.table, c, 2)), jx: (pick(p.table, c) - 0.5) * 3 };
  };
  const blit = (ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, w: number, alpha: number, flip = false) => {
    const h = (w * sp.h) / sp.w;
    ctx.globalAlpha = alpha;
    if (!flip) ctx.drawImage(sp.image, x - w / 2, y - h / 2, w, h);
    else {
      ctx.save();
      ctx.transform(-1, 0, 0, 1, x, y);
      ctx.drawImage(sp.image, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  };
  const drawSplash = (ctx: CanvasRenderingContext2D | null, i: number, t: number, outer: number, marks: Mark[] | null): number => {
    let n = 0;
    for (const { fall, p } of pools) {
      if (fall !== i) continue;
      const w = (Math.PI * 2) / p.cycle;
      const breathe = 0.65 + 0.35 * Math.sin(w * t + p.phase);
      n++;
      marks?.push({ element: 'splash', index: i, x: p.x, y: p.y });
      if (ctx) blit(ctx, poolSprites[0]!, p.x + Math.sin(w * t * 0.7 + p.phase) * 1.5, p.y, p.size * (0.9 + 0.15 * breathe), p.alpha * breathe * outer);
    }
    for (const { fall, p } of puffs) {
      if (fall !== i) continue;
      const q = pulseAt(p, t);
      if (q.alpha < 0.01) continue;
      n++;
      const y = p.y - q.u * 2.5;
      marks?.push({ element: 'splash', index: i, x: p.x + q.jx, y });
      if (ctx) blit(ctx, puffSprites[Math.floor(pick(p.table, q.c, 1) * puffSprites.length)]!, p.x + q.jx, y, q.size * 1.35, q.alpha * outer);
    }
    return n;
  };
  /** a point on the spill: `v` along the board (0 its upper end), `w` across it (0 the board, 1 its lip) */
  const spillAt = (v: number, w: number): Pt => {
    const a = { x: s0.x + (s3.x - s0.x) * v, y: s0.y + (s3.y - s0.y) * v };
    const b = { x: s1.x + (s2.x - s1.x) * v, y: s1.y + (s2.y - s1.y) * v };
    return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
  };
  const drawGate = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null): number => {
    let n = 0;
    for (const p of glass) {
      const q = pulseAt(p, t);
      if (q.alpha < 0.01) continue;
      // each light slips over the board and off its lip as it fades
      const at = spillAt(p.x + q.jx * 0.01, 0.1 + q.u * 0.9);
      n++;
      marks?.push({ element: 'gate', index: 0, x: at.x, y: at.y });
      if (ctx) blit(ctx, glassSprites[Math.floor(pick(p.table, q.c, 1) * glassSprites.length)]!, at.x, at.y, p.size, q.alpha * outer);
    }
    const q = pulseAt(spillFoot, t);
    if (q.alpha >= 0.01) {
      n++;
      marks?.push({ element: 'gate', index: 0, x: spillFoot.x, y: spillFoot.y });
      if (ctx) blit(ctx, puffSprites[q.c & 1]!, spillFoot.x + q.jx * 0.5, spillFoot.y, q.size * 1.6, q.alpha * outer);
    }
    return n;
  };
  const drawRings = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null): number => {
    let n = 0;
    for (const r of rings) {
      const time = t + r.phase;
      const c = Math.floor(time / RING_S);
      const u = time / RING_S - c;
      // spreading ever slower, faint as it starts, gone as it reaches the middle of the basin
      const k = 1 - (1 - u) ** 1.8;
      const width = 14 + (RING_MAX - 14) * k * (0.85 + 0.2 * pick(r.table, c));
      const alpha = smooth(u / 0.12) * (1 - u) ** 1.4 * (0.75 + 0.25 * pick(r.table, c, 1));
      if (alpha < 0.01) continue;
      const x = INLET.x + width * 0.42;
      const y = INLET.y + width * 0.05;
      n++;
      marks?.push({ element: 'ring', index: 0, x, y });
      if (!ctx) continue;
      const i = width < 45 ? 0 : width < 100 ? 1 : 2;
      const sp = ringSprites[i]!;
      const ref = [30, 70, 140][i]!;
      blit(ctx, sp, x, y, (sp.w * width) / ref, alpha * outer);
    }
    return n;
  };
  const drawOued = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null): number => {
    let n = 0;
    for (const d of drifters) {
      const time = t + d.phase;
      const c = Math.floor(time / d.cycle);
      const age = time - c * d.cycle;
      if (age > d.life) continue;
      const s0 = pick(d.table, c) * 1.04 - 0.02;
      const u = 0.04 + pick(d.table, c, 1) * 0.92;
      const start = ouedAt(s0, u);
      const live = liveliness(s0, u, start);
      // a weak draw skips the pass, more often over the deep braids
      if (pick(d.table, c, 2) > live * 0.85) continue;
      const near = 0.7 + 0.8 * Math.max(0, s0);
      const speed = (d.kind === 'glint' ? 15 : 10) * near * (inBraid(s0, u) ? 1.25 : 1);
      const s = s0 + (speed * age) / OUED_LENGTH;
      const q = ouedAt(s, u);
      if (s > 1 || inBar(q) || !pointInPolygon(q, WATER_SHAPES.oued)) continue;
      const v = age / d.life;
      const flicker = d.kind === 'glint' ? 0.6 + 0.4 * Math.sin(age * 5.3 + d.phase * 7) : 1;
      const alpha = d.alpha * Math.sin(Math.PI * v) ** 1.5 * flicker * Math.min(1, live);
      if (alpha < 0.01) continue;
      n++;
      marks?.push({ element: 'oued', index: 0, x: q.x, y: q.y });
      if (!ctx) continue;
      const set = d.kind === 'glint' ? glintSprites : riffleSprites;
      const sp = set[Math.floor(pick(d.table, c, 1) * 5) % set.length]!;
      blit(ctx, sp, q.x, q.y, 1.35 * sp.w * near * (d.kind === 'glint' ? 0.7 + 0.3 * Math.sin(Math.PI * v) : 1), alpha * outer);
    }
    for (const r of standing) {
      const q = pulseAt(r, t);
      if (q.alpha < 0.01) continue;
      const along = r.at + q.u * 0.25;
      const x = r.head.x + r.side * (4 + along * 22);
      const y = r.head.y + 1 + along * 13 + q.u * 1.5;
      n++;
      marks?.push({ element: 'oued', index: 1, x, y });
      if (ctx) blit(ctx, partSprites[Math.floor(pick(r.table, q.c, 1) * partSprites.length)]!, x, y, 15 + along * 5, q.alpha * outer, r.side < 0);
    }
    return n;
  };

  /** the world rect the context shows, or null when its transform is not a plain scale */
  const viewOf = (ctx: CanvasRenderingContext2D): Rect | null => {
    if (typeof ctx.getTransform !== 'function') return null;
    const m = ctx.getTransform();
    if (m.b !== 0 || m.c !== 0 || m.a <= 0 || m.d <= 0) return null;
    return { x: -m.e / m.a, y: -m.f / m.d, w: ctx.canvas.width / m.a, h: ctx.canvas.height / m.d };
  };
  const meets = (v: Rect | null, b: Rect) => !v || (v.x + v.w > b.x && v.x < b.x + b.w && v.y + v.h > b.y && v.y < b.y + b.h);

  const frame = (ctx: CanvasRenderingContext2D | null, t: number, view: Rect | null, marks: Mark[] | null) => {
    const outer = ctx ? ctx.globalAlpha : 1;
    const counts = { fall: 0, splash: 0, gate: 0, ring: 0, oued: 0 };
    for (const [i, f] of FALLS.entries()) {
      if (!meets(view, MOTION_BOXES.falls[i]!)) continue;
      if (ctx) clip(ctx, [f.sheet]);
      counts.fall += drawFall(ctx, i, t, outer, marks);
      if (ctx) {
        ctx.restore();
        clip(ctx, splashShapes[i]!);
      }
      counts.splash += drawSplash(ctx, i, t, outer, marks);
      ctx?.restore();
    }
    if (meets(view, MOTION_BOXES.gate)) {
      if (ctx) clip(ctx, gateShapes);
      counts.gate += drawGate(ctx, t, outer, marks);
      ctx?.restore();
    }
    if (meets(view, MOTION_BOXES.rings)) {
      if (ctx) clip(ctx, [WATER_SHAPES.basin]);
      counts.ring += drawRings(ctx, t, outer, marks);
      ctx?.restore();
    }
    if (meets(view, MOTION_BOXES.oued)) {
      if (ctx) clip(ctx, [ouedClip], OUED_BARS);
      counts.oued += drawOued(ctx, t, outer, marks);
      ctx?.restore();
    }
    if (ctx) ctx.globalAlpha = outer;
    return counts;
  };

  return {
    get ready() {
      return ready;
    },
    *prepare(): Strokes {
      if (ready) return;
      yield* paintFalls();
      yield* paintGlassAndRings();
      yield* paintOued();
      ready = !opts.still;
    },
    draw(ctx, t) {
      if (!ready) return;
      const view = viewOf(ctx);
      if (!meets(view, MOTION_BOUNDS)) return;
      frame(ctx, t * TEMPO, view, null);
    },
    marksAt(t) {
      const marks: Mark[] = [];
      frame(null, t * TEMPO, null, marks);
      return marks;
    },
    visibleAt(t) {
      return frame(null, t * TEMPO, null, null);
    },
    sprites() {
      const all = { ...fallSprites, puff: puffSprites, pool: poolSprites, glass: glassSprites, ring: ringSprites, glint: glintSprites, riffle: riffleSprites, part: partSprites };
      return Object.entries(all).flatMap(([kind, list]) => list.map((sp) => ({ kind, ...sp })));
    },
  };
}
