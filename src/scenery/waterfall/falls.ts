/**
 * The waterfall in motion (S9, ADR 0282): pale surges and lifted lights falling over the still
 * painting's streaks, a breathing churn of foam at the foot and a faint mist drifting off the
 * plunge. Sprites are painted once, in parts; each frame only blits them, as a pure function of
 * the animation time. docs/systems/scenery.md › Waterfall › Motion.
 */
import { createRng, type Rng } from '../../core/rng';
import { PIGMENTS, blob, createPainter, makeCanvas, mix, type AnyCanvas, type Painter } from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import type { SceneryMotion } from '../types';
import { FALLS } from './geometry';
import { WATER, sheetAt } from './paint-water';

/** Where the sheet starts falling (under the lip) and where it meets the foam. */
export const FALL_TOP = FALLS.outline[0]!.y + 4;
export const FALL_FOOT = FALLS.outline[4]!.y;
/** Falling speed in world units a second, at the lip and at the foot (it gathers speed). */
const V_LIP = 40;
const V_FOOT = 120;
const GRAVITY = (V_FOOT * V_FOOT - V_LIP * V_LIP) / (2 * (FALL_FOOT - FALL_TOP));
/** Seconds water takes from the lip to the foam. */
export const FALL_S = (V_FOOT - V_LIP) / GRAVITY;
/** What the motion can touch, world units: the sheet, the foam and the mist's reach. */
export const MOTION_BOUNDS = { x: 470, y: 280, w: 330, h: 370 };

/** Height on the sheet of water that left the lip `a` seconds ago (clamped to the sheet). */
export function dropAt(a: number): number {
  const s = a < 0 ? 0 : a > FALL_S ? FALL_S : a;
  return FALL_TOP + V_LIP * s + (GRAVITY * s * s) / 2;
}

/** Sprite resolution, pixels per world unit. */
const RES = 3;
/** Random draws per mark, three per cycle, so passes differ (a mark repeats after TABLE / 3 cycles). */
const TABLE = 96;

/** A greyed, barely blue shade: the sheet's own colour, off the cyan. */
const SURGE = mix(mix(WATER.sheet, PIGMENTS.stoneWarm, 0.3), PIGMENTS.indigo, 0.08);
const FOAM_SHADE = mix(mix(WATER.mid, PIGMENTS.stone, 0.3), PIGMENTS.indigo, 0.15);

interface Sprite {
  image: CanvasImageSource;
  /** world size */
  w: number;
  h: number;
}

type Kind = 'surge' | 'light' | 'thread';

/** One falling mark on its lane. */
interface Faller {
  kind: Kind;
  u: number;
  /** lane width, a fraction of the sheet's width */
  w: number;
  /** speed factor (the middle falls faster than the thin edges) */
  k: number;
  /** cycle length in fall seconds: fall + longest mark + a gap */
  cycle: number;
  phase: number;
  alpha: number;
  /** per cycle: sprite pick, length, lane jitter and strength (a weak draw skips the pass) */
  table: Float32Array;
}

/** A puff of the foam's boil, a churning shade in it, or a wisp of the spray. */
interface Puff {
  x: number;
  y: number;
  /** outward drift over a life (units) and rise */
  dx: number;
  rise: number;
  size: number;
  cycle: number;
  phase: number;
  alpha: number;
  table: Float32Array;
}

export interface FallsMotion extends SceneryMotion {
  readonly ready: boolean;
  /** the marks drawn at time `t` (for tests): falling marks, foam puffs, mist wisps */
  visibleAt(t: number): { fallers: number; puffs: number; wisps: number };
  /** the painted sprites by kind, world size (for the studio) */
  sprites(): { kind: string; image: CanvasImageSource; w: number; h: number }[];
}

export interface FallsOptions {
  seed?: number | string;
  /** no motion: draw nothing, the still painting stays (reduced motion) */
  still?: boolean;
}

function tableOf(rng: Rng): Float32Array {
  const t = new Float32Array(TABLE);
  for (let i = 0; i < TABLE; i++) t[i] = rng.next();
  return t;
}

/** The table entry for cycle `n` (`k` picks one of three values per cycle). */
const pick = (table: Float32Array, n: number, k = 0) => table[(((n * 3 + k) % TABLE) + TABLE) % TABLE]!;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function createFallsMotion(opts: FallsOptions = {}): FallsMotion {
  const seed = String(opts.seed ?? 11);
  const rng = createRng(`${seed}:falls-motion`);
  let ready = false;
  const sets: Record<Kind, Sprite[]> = { surge: [], light: [], thread: [] };
  const foam: Sprite[] = [];
  const shade: Sprite[] = [];
  const mist: Sprite[] = [];

  const fallers: Faller[] = [];
  const lanes = (kind: Kind, u0: number, u1: number, wMin: number, wMax: number, gap: number, alpha: [number, number], per: number) => {
    for (let u = u0 + rng.range(0, gap); u < u1; ) {
      const w = rng.range(wMin, wMax);
      const mid = 1 - Math.abs(u + w / 2 - 0.5) * 2;
      const k = 0.8 + 0.38 * mid + rng.range(-0.07, 0.07);
      const cycle = FALL_S + 2.2 + rng.range(0.6, 2.4);
      const phase = rng.range(0, cycle);
      for (let i = 0; i < per; i++) {
        fallers.push({ kind, u, w, k, cycle, phase: phase + (cycle * i) / per + rng.range(-0.5, 0.5), alpha: rng.range(...alpha), table: tableOf(rng) });
      }
      u += w * rng.range(0.6, 1.1) + rng.range(0, gap);
    }
  };
  // wide pale surges overlapping across the sheet, lifted lights between them, a few bright threads
  lanes('surge', 0.02, 0.9, 0.08, 0.15, 0.06, [0.6, 0.95], 2);
  lanes('light', 0.08, 0.86, 0.05, 0.1, 0.12, [0.55, 0.9], 2);
  for (let i = 0; i < 8; i++) {
    const cycle = FALL_S + 1.4 + rng.range(0.5, 2.5);
    fallers.push({ kind: 'thread', u: rng.range(0.12, 0.86), w: rng.range(0.012, 0.022), k: rng.range(1.05, 1.25), cycle, phase: rng.range(0, cycle), alpha: rng.range(0.6, 0.9), table: tableOf(rng) });
  }

  const { foot } = FALLS;
  // the boil: white puffs swelling and sinking along the foot, two out of phase at each place
  const puffs: Puff[] = [];
  for (let i = 0; i < 6; i++) {
    const s = (i / 5) * 2 - 1;
    const cycle = rng.range(2.6, 4);
    const phase = rng.range(0, cycle);
    for (let j = 0; j < 2; j++) {
      puffs.push({
        x: foot.x + s * 78 + rng.range(-8, 8),
        y: foot.y + 3 + Math.abs(s) * 7,
        dx: (s || rng.range(-1, 1)) * rng.range(6, 14),
        rise: rng.range(9, 18),
        size: 40 - Math.abs(s) * 14,
        cycle,
        phase: phase + (cycle * j) / 2,
        alpha: 0.55 - Math.abs(s) * 0.15,
        table: tableOf(rng),
      });
    }
  }
  // the churn: cool shades rolling in small loops in the foam, so it has body, not a white band
  const churn: Puff[] = [];
  for (let i = 0; i < 5; i++) {
    const s = (i / 4) * 2 - 1;
    churn.push({ x: foot.x + s * 70 + rng.range(-10, 10), y: foot.y + 12 + Math.abs(s) * 5, dx: rng.range(6, 12), rise: rng.range(2, 5), size: rng.range(30, 42), cycle: rng.range(3, 5), phase: rng.range(0, 6), alpha: rng.range(0.55, 0.8), table: tableOf(rng) });
  }
  // the spray: a few large, faint wisps rising slowly off the plunge, drifting right on the draught
  const wisps: Puff[] = [];
  for (let i = 0; i < 3; i++) {
    const cycle = rng.range(11, 16);
    wisps.push({
      x: foot.x + rng.range(-40, 30),
      y: foot.y - rng.range(4, 14),
      dx: rng.range(10, 60),
      rise: rng.range(50, 90),
      size: rng.range(75, 105),
      cycle,
      phase: (cycle * i) / 3 + rng.range(0, 2),
      alpha: rng.range(0.16, 0.24),
      table: tableOf(rng),
    });
  }

  const sprite = (w: number, h: number, label: string, res = RES): { s: Sprite; p: Painter } => {
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

  /** a spindle 0..w wide and 0..h tall, fullest at `fullAt` down it, a little wavy */
  const spindle = (r: Rng, w: number, h: number, fullAt: number): Pt[] => {
    const left: Pt[] = [];
    const right: Pt[] = [];
    const ph = r.range(0, 6);
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      // a long tail tapering in, a short rounded head (a pointed one reads as an icicle)
      const bulge = s < fullAt ? Math.sin((s / fullAt) * (Math.PI / 2)) : Math.sqrt(Math.max(0, 1 - ((s - fullAt) / (1 - fullAt)) ** 2));
      const half = (w / 2) * Math.max(0.04, bulge ** 0.7) * (0.85 + 0.15 * Math.sin(s * 9 + ph));
      const c = w / 2 + Math.sin(s * 4 + ph) * w * 0.06;
      const y = 2 + s * (h - 4);
      left.push({ x: c - half + r.range(-0.3, 0.3), y });
      right.push({ x: c + half + r.range(-0.3, 0.3), y });
    }
    return [...left, ...right.reverse()];
  };

  /** the falling marks: their tails (sprite tops) dissolve, their heads keep a soft watercolour edge */
  function* paintFallers(): Strokes {
    for (let i = 0; i < 6; i++) {
      const r = rng.fork(`surge-${i}`);
      const { s, p } = sprite(28, 140, `surge-${i}`);
      yield* p.parts.wash(spindle(r, 28, 140, r.range(0.55, 0.75)), i % 3 === 2 ? mix(SURGE, WATER.mid, 0.3) : SURGE, {
        rng: r,
        deform: 0.12,
        spread: 0.2,
        layers: 7,
        opacity: r.range(0.2, 0.3),
        edge: 0.3,
        sharpness: 0.3,
        centreLift: 0.25,
        flow: 0.7,
        flowScale: 30,
        fade: { angle: -Math.PI / 2, start: r.range(0.25, 0.45), amount: 1, ragged: 0.8 },
      });
      sets.surge.push(seal(s));
      yield;
    }
    for (let i = 0; i < 4; i++) {
      const r = rng.fork(`light-${i}`);
      const { s, p } = sprite(20, 140, `light-${i}`);
      yield* p.parts.lift(spindle(r, 20, 140, r.range(0.5, 0.65)), { rng: r, amount: r.range(0.55, 0.75), deform: 0.1, spread: 0.18, layers: 6, sharpness: 0.2, fade: { angle: -Math.PI / 2, start: 0.15, amount: 1, ragged: 0.7 } });
      sets.light.push(seal(s));
      yield;
    }
    for (let i = 0; i < 3; i++) {
      const r = rng.fork(`thread-${i}`);
      const { s, p } = sprite(6, 150, `thread-${i}`, 5);
      yield* p.parts.lift(spindle(r, 6, 150, 0.8), { rng: r, amount: r.range(0.75, 0.9), deform: 0.04, spread: 0.05, layers: 4, sharpness: 0.5, fade: { angle: -Math.PI / 2, start: 0.5, amount: 1 } });
      sets.thread.push(seal(s));
      yield;
    }
  }

  /** the boil's white puffs, the churn's cool shades and the spray's wisps */
  function* paintFoam(): Strokes {
    for (let i = 0; i < 3; i++) {
      const r = rng.fork(`foam-${i}`);
      const { s, p } = sprite(72, 34, `foam-${i}`);
      yield* p.parts.lift(blob(36, 18, 30, 12, r, { irregularity: 0.4, points: 14 }), { rng: r, amount: r.range(0.7, 0.85), deform: 0.35, spread: 0.35, layers: 5, sharpness: 0.05, edge: 0 });
      foam.push(seal(s));
      yield;
    }
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(`churn-${i}`);
      const { s, p } = sprite(72, 32, `churn-${i}`);
      yield* p.parts.glaze(blob(36, 16, 28, 10, r, { irregularity: 0.45, points: 14 }), FOAM_SHADE, { rng: r, opacity: 0.4, deform: 0.4, spread: 0.4, edge: 0.15, fade: { angle: -Math.PI / 2, start: 0.2, amount: 0.9 } });
      shade.push(seal(s));
      yield;
    }
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(`mist-${i}`);
      const { s, p } = sprite(120, 70, `mist-${i}`, 1.5);
      for (let k = 0; k < 4; k++) {
        yield* p.parts.lift(blob(60 + r.range(-22, 22), 37 + r.range(-6, 6), r.range(24, 36), r.range(13, 18), r, { irregularity: 0.5, points: 16 }), { rng: r, amount: 0.4, deform: 0.5, spread: 0.9, layers: 6, sharpness: 0, edge: 0 });
        yield;
      }
      mist.push(seal(s));
    }
  }

  const drawFallers = (ctx: CanvasRenderingContext2D | null, t: number, outer: number): number => {
    let n = 0;
    for (const f of fallers) {
      const time = f.k * t + f.phase;
      const c = Math.floor(time / f.cycle);
      const strength = pick(f.table, c, 2);
      if (strength < 0.15) continue;
      const a = time - c * f.cycle;
      const len = f.kind === 'thread' ? 0.9 + pick(f.table, c, 1) * 1.2 : 1 + pick(f.table, c, 1) * 1.3;
      const y0 = dropAt(a - len);
      const y1 = Math.min(dropAt(a), FALL_FOOT + 4);
      const span = y1 - y0;
      if (span < 3) continue;
      n++;
      if (!ctx) continue;
      const set = sets[f.kind];
      const sp = set[Math.floor(pick(f.table, c) * 7) % set.length]!;
      const u = f.u + (pick(f.table, c, 1) - 0.5) * 0.04;
      const top = sheetAt(u + f.w / 2, y0);
      const bot = sheetAt(u + f.w / 2, y1);
      const mid = (y0 + y1) / 2;
      const width = (sheetAt(u + f.w, mid).x - sheetAt(u, mid).x) * (0.85 + 0.3 * strength);
      // born out of the lip and swallowed by the foam by length, never cut flat
      ctx.globalAlpha = outer * f.alpha * (0.55 + 0.45 * strength) * smooth(span / 50) * (1 - smooth((y0 - (FALL_FOOT - 80)) / 70));
      ctx.save();
      ctx.transform(1, 0, (bot.x - top.x) / span, 1, top.x, y0);
      ctx.drawImage(sp.image, -width / 2, 0, width, span);
      ctx.restore();
    }
    return n;
  };

  /** puff `p` at time `t`: where, how big, how strong */
  const lifeAt = (p: Puff, t: number, wisp: boolean) => {
    const time = t + p.phase;
    const c = Math.floor(time / p.cycle);
    const u = time / p.cycle - c;
    const jx = (pick(p.table, c) - 0.5) * (wisp ? 40 : 12);
    const k = wisp ? 1 - (1 - u) * (1 - u) : u;
    const alpha = p.alpha * Math.sin(Math.PI * u) ** (wisp ? 2 : 1.3) * (0.7 + 0.3 * pick(p.table, c, 1));
    const size = p.size * (wisp ? 0.7 + 0.8 * u : 0.7 + 0.45 * u) * (0.85 + 0.3 * pick(p.table, c, 2));
    return { x: p.x + jx + p.dx * k, y: p.y - p.rise * k, size, alpha, c };
  };
  /** a churning shade: rolling round a small loop, breathing, never gone */
  const churnAt = (p: Puff, t: number) => {
    const w = (Math.PI * 2) / p.cycle;
    const a = w * t + p.phase;
    return { x: p.x + Math.cos(a) * p.dx, y: p.y + Math.sin(a) * p.rise, size: p.size * (0.9 + 0.15 * Math.sin(a * 0.7 + 1)), alpha: p.alpha * (0.65 + 0.35 * Math.sin(a * 1.3)), c: 0 };
  };

  const blit = (ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, size: number, alpha: number, k = 2) => {
    const w = size * k;
    const h = (w * sp.h) / sp.w;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.image, x - w / 2, y - h * 0.55, w, h);
  };

  const drawFoam = (ctx: CanvasRenderingContext2D | null, t: number, outer = 1): { puffs: number; wisps: number } => {
    let nPuffs = 0;
    let nWisps = 0;
    for (const p of churn) {
      const q = churnAt(p, t);
      nPuffs++;
      if (ctx) blit(ctx, shade[Math.floor(p.table[0]! * shade.length)]!, q.x, q.y, q.size, q.alpha * outer, 1.8);
    }
    for (const p of puffs) {
      const q = lifeAt(p, t, false);
      if (q.alpha < 0.01) continue;
      nPuffs++;
      if (ctx) blit(ctx, foam[Math.floor(pick(p.table, q.c, 1) * foam.length)]!, q.x, q.y, q.size, q.alpha * outer, 1.8);
    }
    for (const p of wisps) {
      const q = lifeAt(p, t, true);
      if (q.alpha < 0.01) continue;
      nWisps++;
      if (ctx) blit(ctx, mist[Math.floor(pick(p.table, q.c, 1) * mist.length)]!, q.x, q.y, q.size, q.alpha * outer, 1.2);
    }
    return { puffs: nPuffs, wisps: nWisps };
  };

  /** false when the view (from the context's transform) misses the falls entirely */
  const inView = (ctx: CanvasRenderingContext2D): boolean => {
    if (typeof ctx.getTransform !== 'function') return true;
    const m = ctx.getTransform();
    if (m.b !== 0 || m.c !== 0 || m.a <= 0 || m.d <= 0) return true;
    const x0 = -m.e / m.a;
    const y0 = -m.f / m.d;
    const x1 = x0 + ctx.canvas.width / m.a;
    const y1 = y0 + ctx.canvas.height / m.d;
    const b = MOTION_BOUNDS;
    return x1 > b.x && x0 < b.x + b.w && y1 > b.y && y0 < b.y + b.h;
  };

  return {
    get ready() {
      return ready;
    },
    *prepare(): Strokes {
      if (ready) return;
      yield* paintFallers();
      yield* paintFoam();
      ready = !opts.still;
    },
    draw(ctx, t) {
      if (!ready || !inView(ctx)) return;
      const outer = ctx.globalAlpha;
      drawFallers(ctx, t, outer);
      drawFoam(ctx, t, outer);
      ctx.globalAlpha = outer;
    },
    sprites() {
      const all = { ...sets, foam, churn: shade, mist };
      return Object.entries(all).flatMap(([kind, list]) => list.map((sp) => ({ kind, ...sp })));
    },
    visibleAt(t) {
      return { fallers: drawFallers(null, t, 1), ...drawFoam(null, t) };
    },
  };
}
