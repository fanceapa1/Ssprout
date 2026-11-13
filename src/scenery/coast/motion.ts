/**
 * The coast's water in motion (G6, ADRs 0282, 0374): the swell's light over the sea, wavelets up
 * the shingle, foam swelling round the rocks and along the cliff's foot, a rare ring on the pools,
 * and the caique bobbing on its mooring over a plate of the sea painted without it. Sprites are
 * painted once, in parts; each frame only blits them as a pure function of the animation time.
 * docs/systems/scenery.md › Coast › Motion.
 */
import { createRng, type Rng } from '../../core/rng';
import { PAPER_WHITE, blob, bounds, createPainter, makeCanvas, mix, pointInPolygon, ribbon, rgba, type AnyCanvas, type Painter } from '../../paint';
import { resample } from '../../paint/geometry';
import type { Pt, Rect } from '../../render/viewport';
import { applyView } from '../../scene/background';
import type { Strokes } from '../../scene/paint-land';
import type { SceneryMotion } from '../types';
import { BOAT, paintHull, paintMooringUnder, paintReflectionDark, paintReflectionLight, paintRig } from './boat';
import { POOL_WATER, SEA_WATER } from './geometry';
import { COAST_ART } from './index';
import { CAIQUE, HORIZON } from './layout';
import { coastSteps } from './painters';
import { SHORE_RUNS } from './paint-rocks';
import { SAND, SEA } from './paint-water';
import { caiquePose, posePoint, type CaiquePose } from './pose';
import { streak } from './rock-kit';
import { CAIQUE_BOX, CAIQUE_SCALE, CAIQUE_SHAPES, CLIFF_FOOT, DEPTH, FOAM_LINE, SEA_RECT, shoreDistance } from './sea';
import { SHORE_BOULDER_SHAPES, SPLASH_ROCK_SHAPES, type RockShape } from './shapes';
import { COAST_CARRIERS } from './wildlife';

/** Random draws per mark, three per pass, so passes differ. */
const TABLE = 96;
/** Start positions per drifting mark: a mark repeats its place only after this many passes. */
const PLACES = 29;

const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
const union = (rs: Rect[]): Rect => {
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  return { x: x0, y: y0, w: Math.max(...rs.map((r) => r.x + r.w)) - x0, h: Math.max(...rs.map((r) => r.y + r.h)) - y0 };
};
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** How large a mark at height `y` on the sea reads: nothing at the horizon, 1 by the beach. */
export const seaScale = (y: number): number => Math.max(0.06, Math.min(1.15, (y - HORIZON + 10) / 350));

/** The rocks standing in the water: their foam swells, and nothing else is drawn over them. */
export const WET_ROCKS: readonly RockShape[] = [...SHORE_BOULDER_SHAPES.filter((r) => !r.ground), ...SPLASH_ROCK_SHAPES];
const ALL_ROCKS: readonly RockShape[] = [...SHORE_BOULDER_SHAPES, ...SPLASH_ROCK_SHAPES];

/** The plate: the sea under the caique painted without it, opaque inside the box, feathered out. */
const FEATHER = 6;
export const PLATE_RECT: Rect = grow(CAIQUE_BOX, 2 + FEATHER);
const PLATE_SCALE = 5;
const k = CAIQUE_SCALE;
const at = (x: number, y: number): Pt => ({ x: CAIQUE.x + x * k, y: CAIQUE.y + y * k });
/** The hull, mast and rig, and what is above the water line (the hull below it is clipped). */
const HULL_RECT: Rect = (() => {
  const b = bounds([...CAIQUE_SHAPES.hull, ...CAIQUE_SHAPES.mast, ...CAIQUE_SHAPES.yard]);
  return { x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 10 };
})();
const WATER_Y = CAIQUE.y + 0.4;
/** Where the mooring line meets the water, and the buoy. */
const LINE_WATER = at(-80, 2);
const BOW = CAIQUE_SHAPES.mooring[0]!;
const BUOY = CAIQUE_SHAPES.buoy;

/** The waterline's reaches along `FOAM_LINE`, each breathing on its own. */
const REACHES = 9;
const FOAM_BOX: Rect = (() => {
  const b = bounds(FOAM_LINE);
  return { x: b.x, y: b.y - 10, w: b.w, h: b.h + 30 };
})();

/** Every element's reach, world units: the motion skips any the view misses. */
export const MOTION_BOXES = {
  sea: { x: SEA_RECT.x, y: HORIZON, w: 980, h: 420 },
  foam: FOAM_BOX,
  pools: grow(union(POOL_WATER.map((p) => bounds(p))), 4),
  boat: grow(PLATE_RECT, 2),
};
export const MOTION_BOUNDS = union(Object.values(MOTION_BOXES));

interface Sprite {
  image: CanvasImageSource;
  /** world rect it covers (sprites placed in the world) or size (free sprites) */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A mark drifting over the sea: a swell light, a trough or a glint. */
interface Drifter {
  kind: 'light' | 'trough' | 'glint';
  cycle: number;
  phase: number;
  life: number;
  alpha: number;
  table: Float32Array;
  /** start x, y per pass (PLACES of them) */
  places: Float32Array;
}
/** Something breathing in place: a wavelet, a rock's foam, a lap at the cliff, a pool's ring. */
interface Breath {
  cycle: number;
  phase: number;
  table: Float32Array;
}

/** One drawn mark, for tests: which element and where its middle lies, world units. */
export interface Mark {
  element: 'swell' | 'glint' | 'wavelet' | 'foam' | 'lap' | 'pool' | 'ring' | 'boat';
  index: number;
  x: number;
  y: number;
}
type Counts = Record<Mark['element'], number>;

export interface CoastMotion extends SceneryMotion {
  readonly ready: boolean;
  /** the marks drawn at time `t` (for tests) */
  marksAt(t: number): Mark[];
  /** how many marks each element draws at `t` (for tests) */
  visibleAt(t: number): Counts;
  /** the painted sprites by kind (for the studio) */
  sprites(): { kind: string; image: CanvasImageSource; w: number; h: number }[];
}

export interface CoastMotionOptions {
  seed?: number;
  /** no motion: draw nothing, the still painting stays (reduced motion) */
  still?: boolean;
}

function tableOf(rng: Rng): Float32Array {
  const t = new Float32Array(TABLE);
  for (let i = 0; i < TABLE; i++) t[i] = rng.next();
  return t;
}
const pick = (table: Float32Array, n: number, j = 0) => table[(((n * 3 + j) % TABLE) + TABLE) % TABLE]!;

const inRock = (q: Pt, pad: number) => ALL_ROCKS.some((r) => Math.abs(q.x - r.x) < r.w / 2 + pad && q.y > r.y - r.w * 0.6 - pad && q.y < r.y + 5 + pad && pointInPolygon(q, r.outline));
const nearBoat = (q: Pt) => Math.abs(q.x - (CAIQUE.x - 2)) < 46 && q.y > CAIQUE.y - 24 && q.y < CAIQUE.y + 4;

/** A point on a path at fraction `t` of its points. */
function along(path: readonly Pt[], t: number): Pt {
  const f = Math.max(0, Math.min(1, t)) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f));
  const u = f - i;
  return { x: path[i]!.x + (path[i + 1]!.x - path[i]!.x) * u, y: path[i]!.y + (path[i + 1]!.y - path[i]!.y) * u };
}
/** A rock's foot at x, held at its ends. */
function baseAt(r: RockShape, x: number): number {
  const c = r.columns;
  const f = Math.max(0, Math.min(c.length - 1.0001, ((x - c[0]!.x) / (c[c.length - 1]!.x - c[0]!.x)) * (c.length - 1)));
  const i = Math.floor(f);
  return c[i]!.base + ((c[i + 1] ?? c[i]!).base - c[i]!.base) * (f - i);
}

/** The lit lips of the ledge, where the water meets the edge (above the beach flight). */
const LIPS = SHORE_RUNS.lip.filter((run) => run.every((q) => q.y < 790)).map((run) => resample(run, 3));
/** The cliff's foot on the sea, in stretches that lap one after another. */
const CLIFF_REACHES: Pt[][] = (() => {
  const pts = resample(CLIFF_FOOT, 3);
  const out: Pt[][] = [];
  for (let i = 0; i < pts.length - 4; i += 14) out.push(pts.slice(i, Math.min(pts.length, i + 17)));
  return out;
})();

export function createCoastMotion(opts: CoastMotionOptions = {}): CoastMotion {
  const seed = opts.seed ?? COAST_ART.seed;
  const rng = createRng(`${seed}:coast-motion`);
  let ready = false;

  // ── what moves, drawn from the seeded rng ──────────────────────────────────────────────
  const drifters: Drifter[] = [];
  const addDrifter = (kind: Drifter['kind'], life: [number, number], gap: [number, number], alpha: [number, number]) => {
    const l = rng.range(life[0], life[1]);
    const cycle = l + rng.range(gap[0], gap[1]);
    drifters.push({ kind, cycle, phase: rng.range(0, cycle), life: l, alpha: rng.range(alpha[0], alpha[1]), table: tableOf(rng), places: new Float32Array(PLACES * 2) });
  };
  for (let i = 0; i < 80; i++) addDrifter('light', [7, 12], [1, 5], [0.6, 0.9]);
  for (let i = 0; i < 22; i++) addDrifter('trough', [8, 13], [2, 6], [0.3, 0.5]);
  for (let i = 0; i < 20; i++) addDrifter('glint', [1.2, 2.6], [1.5, 5], [0.7, 0.95]);
  const reaches: Breath[] = Array.from({ length: REACHES }, () => {
    const cycle = rng.range(7, 11.5);
    return { cycle, phase: rng.range(0, cycle), table: tableOf(rng) };
  });
  const breath = (lo: number, hi: number): Breath => {
    const cycle = rng.range(lo, hi);
    return { cycle, phase: rng.range(0, cycle), table: tableOf(rng) };
  };
  const rockBreaths = WET_ROCKS.map(() => breath(5.5, 9));
  const lapBreaths = [...LIPS, ...CLIFF_REACHES].map(() => breath(6, 10));
  const poolBreaths = POOL_WATER.map(() => breath(29, 47));
  const hullRings = [breath(16, 19), breath(23, 27)];

  /** each drifter's start places, more toward the horizon, few over the shallows, none on rock or the boat */
  function placeDrifters(): void {
    const r = rng.fork('places');
    for (const d of drifters) {
      for (let i = 0; i < PLACES; i++) {
        // the open bay, if no draw lands (never seen, but a place must be water)
        let q: Pt = { x: 180 + i * 3, y: 450 };
        for (let tries = 0; tries < 60; tries++) {
          const c = { x: r.range(-20, 900), y: HORIZON + 4 + 380 * r.next() ** (d.kind === 'glint' ? 1.2 : 1.7) };
          const s = seaScale(c.y);
          const end = { x: c.x + d.life * 0.35 * s, y: c.y + d.life * 1.1 * s };
          if (!pointInPolygon(c, SEA_WATER) || !pointInPolygon(end, SEA_WATER) || inRock(c, 6) || inRock(end, 6) || nearBoat(c) || nearBoat(end)) continue;
          const depth = shoreDistance(c);
          if (depth < 40) continue;
          const keep = depth < DEPTH.shallows ? (d.kind === 'glint' ? 0.1 : 0.3) : depth < DEPTH.turquoise ? 0.8 : 1;
          if (r.next() < keep) {
            q = c;
            break;
          }
        }
        d.places[i * 2] = q.x;
        d.places[i * 2 + 1] = q.y;
      }
    }
  }

  // ── the sprites ────────────────────────────────────────────────────────────────────────
  const lights: Sprite[] = [];
  const troughSprites: Sprite[] = [];
  const glints: Sprite[] = [];
  const rings: Sprite[] = [];
  const poolRing: Sprite[] = [];
  const foam: { lace: Sprite; wet: Sprite; film: Sprite }[] = [];
  const rockFoam: Sprite[] = [];
  const laps: Sprite[] = [];
  const boat: { plate?: Sprite; light?: Sprite; dark?: Sprite; hull?: Sprite; buoy?: Sprite } = {};

  /** a free sprite `w × h` world units, or one placed over world rect `at` */
  const sprite = (w: number, h: number, label: string, res: number, place?: Pt): { s: Sprite; p: Painter } => {
    const canvas = makeCanvas(Math.ceil(w * res), Math.ceil(h * res));
    const p = createPainter(canvas, { seed: `${seed}:${label}` });
    const ox = place?.x ?? 0;
    const oy = place?.y ?? 0;
    p.ctx.setTransform(res, 0, 0, res, -ox * res, -oy * res);
    return { s: { image: canvas as CanvasImageSource, x: ox, y: oy, w, h }, p };
  };
  /** a painted sprite as a bitmap: blitting a canvas the painter read back would upload it every frame */
  const seal = (s: Sprite): Sprite => {
    const c = s.image as AnyCanvas;
    return 'transferToImageBitmap' in c ? { ...s, image: c.transferToImageBitmap() } : s;
  };
  /** a thin level dash `w` long, a little bowed, `h` thick at its middle */
  const dash = (cx: number, cy: number, w: number, h: number, bow: number): Pt[] => {
    const top: Pt[] = [];
    const bot: Pt[] = [];
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      const x = cx - w / 2 + s * w;
      const y = cy + bow * (4 * (s - 0.5) ** 2 - 1);
      const half = (h / 2) * Math.sin(Math.PI * s) ** 0.7;
      top.push({ x, y: y - half });
      bot.push({ x, y: y + half });
    }
    return [...top, ...bot.reverse()];
  };
  /** fade a placed sprite's ends out along x (a reach's neighbours overlap it) */
  const featherX = (s: Sprite, x0: number, x1: number, d: number, res: number) => {
    const c = (s.image as AnyCanvas).getContext('2d') as CanvasRenderingContext2D;
    c.save();
    c.setTransform(res, 0, 0, res, -s.x * res, -s.y * res);
    c.globalCompositeOperation = 'destination-in';
    const g = c.createLinearGradient(x0, 0, x1, 0);
    const f = Math.min(0.45, d / (x1 - x0));
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(f, 'rgba(0,0,0,1)');
    g.addColorStop(1 - f, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(s.x, s.y, s.w, s.h);
    c.restore();
  };
  const LIFT = { edge: 0.05, sharpness: 0.6, centreLift: 0, granulation: 0, flow: 0.3, blend: 'source-over' as const };

  function* paintSea(): Strokes {
    for (let i = 0; i < 4; i++) {
      const r = rng.fork(`light-${i}`);
      const { s, p } = sprite(48, 9, `light-${i}`, 5);
      // a soft broken pale band, two or three pieces along one line, over the faint trough that lets it read
      const bow = r.range(-0.8, 0.4);
      const D = p.layer({ x: 0, y: 0, w: 48, h: 9 });
      const L = p.layer({ x: 0, y: 0, w: 48, h: 9 });
      for (let x = 2 + r.range(0, 3); x < 44; ) {
        const len = Math.min(46 - x, r.range(15, 32));
        const y = 4 + r.range(-0.8, 0.8);
        D.fill(dash(x + len / 2 + 1, y + 2.1, len * 0.8, r.range(1.4, 2), bow), mix(SEA.deepTeal, SEA.turquoise, 0.3), 0.55);
        L.fill(dash(x + len / 2, y, len, r.range(2.6, 3.6), bow + r.range(-0.4, 0.4)), PAPER_WHITE, 0.95);
        x += len + r.range(3, 9);
      }
      yield* D.dryParts({ opacity: 0.4, edge: 0.1, sharpness: 0.15, granulation: 0.2, flow: 0.4, flowScale: 8 });
      yield* L.dryParts({ ...LIFT, opacity: 0.85, sharpness: 0.15, edgeWidth: 0.8, flow: 0.5, flowScale: 8 });
      lights.push(seal(s));
      yield;
    }
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(`trough-${i}`);
      const { s, p } = sprite(56, 6, `trough-${i}`, 4);
      yield* p.parts.glaze(dash(28, 3, r.range(44, 52), 1.3, r.range(0.2, 0.6)), mix(SEA.deep, SEA.deepTeal, 0.5), { rng: r, opacity: 0.45, layers: 4, deform: 0.12, spread: 0.2, edge: 0.15, sharpness: 0.3 });
      troughSprites.push(seal(s));
      yield;
    }
    for (let i = 0; i < 3; i++) {
      const r = rng.fork(`glint-${i}`);
      const { s, p } = sprite(16, 6, `glint-${i}`, 6);
      const bow = r.range(-0.3, 0.3);
      yield* p.parts.glaze(dash(8, 3.8, r.range(10, 13), 1.4, bow), mix(SEA.deepTeal, SEA.turquoise, 0.4), { rng: r, opacity: 0.5, layers: 3, deform: 0.12, spread: 0.2, edge: 0.2 });
      yield* p.parts.lift(dash(8, 2.6, r.range(11, 14), r.range(1.6, 2.2), bow), { rng: r, amount: 0.95, deform: 0.15, spread: 0.25, layers: 4, sharpness: 0.3, edge: 0 });
      glints.push(seal(s));
      yield;
    }
    // a ring's front arc and its faint back, at three sizes so the line keeps its width as it spreads
    for (const [i, width] of [40, 80, 150].entries()) {
      const r = rng.fork(`ring-${i}`);
      const h = width * 0.16 + 8;
      const { s, p } = sprite(width + 8, h, `ring-${i}`, 4);
      p.ripple({ x: width / 2 + 4, y: h / 2 }, { rng: r, width, count: 1, squash: 0.1, pigment: mix(SEA.deep, SEA.deepTeal, 0.4), opacity: 0.5, light: 0.85, lineWidth: 0.8 });
      rings.push(seal(s));
      yield;
    }
    const r = rng.fork('pool-ring');
    const { s, p } = sprite(40, 16, 'pool-ring', 6);
    p.ripple({ x: 20, y: 8 }, { rng: r, width: 34, count: 2, squash: 0.28, pigment: mix(SEA.deepTeal, SEA.turquoise, 0.3), opacity: 0.45, light: 0.85, lineWidth: 0.6 });
    poolRing.push(seal(s));
    yield;
  }

  /** each reach of the beach's waterline: its lace, the wet band it leaves and the sheet of water */
  function* paintWaterline(): Strokes {
    const span = 1 / REACHES;
    for (let i = 0; i < REACHES; i++) {
      const r = rng.fork(`reach-${i}`);
      const t0 = Math.max(0, (i - 0.25) * span);
      const t1 = Math.min(1, (i + 1.25) * span);
      const line: Pt[] = [];
      for (let t = t0; t <= t1 + 1e-6; t += (t1 - t0) / 40) line.push(along(FOAM_LINE, t));
      const b = bounds(line);
      const box: Rect = { x: b.x - 2, y: b.y - 9, w: b.w + 4, h: b.h + 20 };
      const lace = sprite(box.w, box.h, `lace-${i}`, 4, box);
      const L = lace.p.layer(box);
      // the lace in scallops: broken white bits along the run-up's edge, a few bubbles behind
      const ph = r.range(0, Math.PI);
      const lobes = r.range(6, 9);
      const scallop = (u: number): Pt => {
        const q = along(line, u);
        return { x: q.x, y: q.y - 2.2 * Math.abs(Math.sin(u * Math.PI * lobes + ph)) ** 0.6 };
      };
      for (let u = r.range(0, 0.02); u < 1; ) {
        const len = r.range(0.01, 0.05);
        if (r.chance(0.85)) L.fill(streak(scallop(u), scallop(Math.min(1, u + len)), r.range(0.9, 1.9), r), PAPER_WHITE, 0.95);
        u += len + r.range(0.004, 0.025);
      }
      for (let j = 0; j < 30; j++) {
        const q = scallop(r.next());
        const rr = r.range(0.35, 0.9);
        L.fill(blob(q.x + r.range(-2, 2), q.y - r.range(0.5, 4), rr * 1.5, rr, r, { points: 6 }), PAPER_WHITE, 0.85);
      }
      yield* L.dryParts({ ...LIFT, opacity: 0.9, sharpness: 0.7, edgeWidth: 0.6, flow: 0.4, flowScale: 12 });
      featherX(lace.s, box.x, box.x + box.w, 16, 4);
      yield;
      // the wet band: darker sand just under the reach's top, lacy at its lower edge
      const wet = sprite(box.w, box.h, `wet-${i}`, 3, box);
      const W = wet.p.layer(box);
      for (let u = 0; u < 1; ) {
        const len = r.range(0.03, 0.09);
        const a = scallop(u);
        const c = scallop(Math.min(1, u + len));
        W.fill(streak({ x: a.x, y: a.y + r.range(1.5, 3) }, { x: c.x, y: c.y + r.range(1.5, 3) }, r.range(1.6, 3), r), SAND.wetDark, 0.45);
        u += len * r.range(0.6, 0.95);
      }
      yield* W.dryParts({ opacity: 0.45, edge: 0.1, edgeWidth: 1.5, sharpness: 0.2, centreLift: 0.1, granulation: 0.5, flow: 0.5 });
      featherX(wet.s, box.x, box.x + box.w, 18, 3);
      yield;
      // the sheet of water running up behind the lace
      const film = sprite(box.w, box.h, `film-${i}`, 3, box);
      yield* film.p.parts.glaze(ribbon(line, () => 3.2, () => -3.4), SEA.aqua, { rng: r, opacity: 0.45, layers: 5, deform: 0.1, spread: 0.2, edge: 0.05, fade: { angle: -Math.PI / 2, start: 0.35, amount: 1, ragged: 0.6 } });
      featherX(film.s, box.x, box.x + box.w, 18, 3);
      foam.push({ lace: seal(lace.s), wet: seal(wet.s), film: seal(film.s) });
      yield;
    }
  }

  /** broken foam bits along a line, offset by (ox, oy): what laps at a rock or the cliff */
  const foamBits = (L: ReturnType<Painter['layer']>, r: Rng, pts: readonly Pt[], ox: number, oy: number, thick: number) => {
    for (let i = 1; i < pts.length; ) {
      const j = Math.min(pts.length - 1, i + r.int(1, 4));
      if (r.chance(0.8)) {
        const seg = pts.slice(i - 1, j + 1).map((q) => ({ x: q.x + ox, y: q.y + oy }));
        const th = r.range(0.6, 1.2) * thick;
        L.fill([...seg, ...seg.slice().reverse().map((q, n, all) => ({ x: q.x, y: q.y + th * Math.sin((Math.PI * (n + 0.5)) / all.length) }))], PAPER_WHITE, 0.9);
      }
      i = j + 1;
    }
  };

  function* paintRockFoam(): Strokes {
    for (const [i, rock] of WET_ROCKS.entries()) {
      const r = rng.fork(`rock-foam-${i}`);
      const c = rock.columns;
      const x0 = c[0]!.x - 6;
      const x1 = c[c.length - 1]!.x + 6;
      const top = Math.min(...c.map((q) => q.base)) - 7;
      const box: Rect = { x: x0 - 2, y: top, w: x1 - x0 + 4, h: Math.max(...c.map((q) => q.base)) - top + 9 };
      const { s, p } = sprite(box.w, box.h, `rock-foam-${i}`, 4, box);
      const L = p.layer(box);
      // the ring hugs the foot and curls up behind the rock at both ends
      const hw = (x1 - x0) / 2 - 5;
      const foot = (x: number) => {
        const cx = (x0 + x1) / 2;
        const out = Math.abs(x - cx) - hw;
        return out > 0 ? baseAt(rock, cx + Math.sign(x - cx) * hw) - out * 0.5 : baseAt(rock, x);
      };
      const pts: Pt[] = [];
      for (let x = x0; x <= x1; x += 2) pts.push({ x, y: foot(x) });
      foamBits(L, r, pts, 0, 0.6, 1.4);
      foamBits(L, r, pts.slice(2, -2), 0, 3.6, 0.7);
      yield* L.dryParts({ ...LIFT, opacity: 0.9, sharpness: 0.6, edgeWidth: 0.5 });
      rockFoam.push(seal(s));
      yield;
    }
    for (const [i, run] of [...LIPS, ...CLIFF_REACHES].entries()) {
      const r = rng.fork(`lap-${i}`);
      const cliff = i >= LIPS.length;
      const b = bounds(run);
      const box: Rect = { x: b.x - 8, y: b.y - 6, w: b.w + 16, h: b.h + 12 };
      const { s, p } = sprite(box.w, box.h, `lap-${i}`, 4, box);
      const L = p.layer(box);
      foamBits(L, r, run, cliff ? 0 : -2.4, cliff ? 1.4 : -0.6, 1.3);
      foamBits(L, r, run, cliff ? 0 : -5, cliff ? 4 : -1.4, 0.6);
      yield* L.dryParts({ ...LIFT, opacity: 0.85, sharpness: 0.6, edgeWidth: 0.5 });
      if (cliff) featherX(s, box.x, box.x + box.w, 10, 4);
      laps.push(seal(s));
      yield;
    }
  }

  /** the sea under the boat without it (the painting's own sea step), then the boat in pieces */
  function* paintBoat(): Strokes {
    const R = PLATE_RECT;
    const canvas = makeCanvas(Math.ceil(R.w * PLATE_SCALE), Math.ceil(R.h * PLATE_SCALE));
    const p = createPainter(canvas, { seed, quality: 'normal' });
    p.ctx.fillStyle = '#ffffff';
    p.ctx.fillRect(0, 0, canvas.width, canvas.height);
    const view = { rect: R, scale: PLATE_SCALE };
    for (const step of coastSteps({ ...COAST_ART, seed }, ['sea'])) {
      if (step.name !== 'sea') continue;
      applyView(p, view);
      const marks = step.run(p);
      while (marks && !marks.next().done) yield;
    }
    applyView(p, view);
    const caique = createRng(seed).fork('caique');
    // the line under the water and the buoy's ring stay put
    const reflection = caique.fork('reflection');
    paintMooringUnder(p, createRng(`${seed}:mooring-under`));
    yield;
    featherPlate(canvas);
    boat.plate = seal({ image: canvas as CanvasImageSource, ...R });
    yield;
    // the reflection: its lifts drawn over the water, its colours multiplied into it
    const light = sprite(R.w, R.h, 'reflection-light', 4, R);
    yield* paintReflectionLight(light.p, reflection);
    boat.light = seal(light.s);
    const dark = sprite(R.w, R.h, 'reflection-dark', 4, R);
    dark.p.ctx.fillStyle = '#ffffff';
    dark.p.ctx.fillRect(R.x, R.y, R.w, R.h);
    yield* paintReflectionDark(dark.p, reflection);
    boat.dark = seal(dark.s);
    yield;
    // the hull, its keel run on under the water line (seen when it lifts), the rig
    const hull = sprite(HULL_RECT.w, HULL_RECT.h, 'hull', 6, HULL_RECT);
    yield* paintHull(hull.p, caique.fork('hull'));
    const kr = rng.fork('keel');
    const keel = CAIQUE_SHAPES.waterline.map((q) => ({ x: q.x, y: q.y + 0.2 }));
    const under = [...keel, ...keel.slice().reverse().map((q) => ({ x: q.x * 0.97 + CAIQUE.x * 0.03, y: q.y + 3.2 }))];
    hull.p.ctx.fillStyle = rgba(PAPER_WHITE);
    hull.p.ctx.beginPath();
    under.forEach((q, n) => (n ? hull.p.ctx.lineTo(q.x, q.y) : hull.p.ctx.moveTo(q.x, q.y)));
    hull.p.ctx.closePath();
    hull.p.ctx.fill();
    yield* hull.p.parts.wash(under, mix(BOAT.red, BOAT.water, 0.35), { rng: kr, opacity: 0.85, layers: 5, deform: 0.01, spread: 0.02, edge: 0.2, sharpness: 0.8 });
    yield* paintRig(hull.p, caique.fork('rig'));
    boat.hull = seal(hull.s);
    yield;
    const buoy = sprite(8, 7, 'buoy', 8, { x: BUOY.x - 4, y: BUOY.y - 5 });
    const br = rng.fork('buoy');
    buoy.p.ctx.fillStyle = rgba(PAPER_WHITE);
    buoy.p.ctx.beginPath();
    blob(BUOY.x, BUOY.y - 1.6, 2.6 * k, 2.1 * k, br, { points: 12 }).forEach((q, n) => (n ? buoy.p.ctx.lineTo(q.x, q.y) : buoy.p.ctx.moveTo(q.x, q.y)));
    buoy.p.ctx.fill();
    buoy.p.dab({ x: BUOY.x, y: BUOY.y }, BOAT.red, { rng: br, variant: 'round', angle: -Math.PI / 2, length: 3.6 * k, width: 4 * k, opacity: 0.85, pool: 0.3 });
    boat.buoy = seal(buoy.s);
    yield;
  }

  /** opaque over the boat's box, fading to nothing over `FEATHER` units round it */
  function featherPlate(canvas: AnyCanvas): void {
    const c = canvas.getContext('2d') as CanvasRenderingContext2D;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const img = c.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const inner = grow(CAIQUE_BOX, 2);
    for (let y = 0; y < canvas.height; y++) {
      const wy = PLATE_RECT.y + (y + 0.5) / PLATE_SCALE;
      const oy = Math.max(inner.y - wy, wy - (inner.y + inner.h), 0);
      for (let x = 0; x < canvas.width; x++) {
        const wx = PLATE_RECT.x + (x + 0.5) / PLATE_SCALE;
        const ox = Math.max(inner.x - wx, wx - (inner.x + inner.w), 0);
        const out = Math.hypot(ox, oy);
        if (out <= 0) continue;
        const i = (y * canvas.width + x) * 4 + 3;
        d[i] = Math.round(d[i]! * (1 - smooth(out / FEATHER)));
      }
    }
    c.putImageData(img, 0, 0);
  }

  // ── clips, made once ───────────────────────────────────────────────────────────────────
  const hasPath = typeof Path2D !== 'undefined';
  const pathOf = (shapes: readonly (readonly Pt[])[]): Path2D | null => {
    if (!hasPath) return null;
    const path = new Path2D();
    for (const s of shapes) {
      s.forEach((q, i) => (i ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y)));
      path.closePath();
    }
    return path;
  };
  const rectPts = (r: Rect): Pt[] => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  const beachBand: Pt[] = [...FOAM_LINE.map((q) => ({ x: q.x, y: q.y - 9 })), ...FOAM_LINE.slice().reverse().map((q) => ({ x: q.x, y: q.y + 20 }))];
  const CLIPS = {
    sea: [SEA_WATER] as Pt[][],
    beach: [beachBand],
    dry: [rectPts(grow(union([SEA_RECT, FOAM_BOX]), 40)), ...ALL_ROCKS.map((r) => r.outline)],
    pools: POOL_WATER,
    hull: [rectPts({ x: HULL_RECT.x - 10, y: HULL_RECT.y - 10, w: HULL_RECT.w + 20, h: WATER_Y - HULL_RECT.y + 10 })],
  };
  const paths = { sea: pathOf(CLIPS.sea), beach: pathOf(CLIPS.beach), dry: pathOf(CLIPS.dry), pools: pathOf(CLIPS.pools), hull: pathOf(CLIPS.hull) };
  type ClipId = keyof typeof CLIPS;
  const clip = (ctx: CanvasRenderingContext2D, id: ClipId) => {
    const rule = id === 'dry' ? 'evenodd' : 'nonzero';
    const path = paths[id];
    if (path) ctx.clip(path, rule);
    else {
      ctx.beginPath();
      for (const s of CLIPS[id]) {
        s.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
      }
      ctx.clip(rule);
    }
  };

  // ── drawing ────────────────────────────────────────────────────────────────────────────
  const pose: CaiquePose = { dx: 0, dy: 0, angle: 0 };
  const scratch: Pt = { x: 0, y: 0 };
  const counts: Counts = { swell: 0, glint: 0, wavelet: 0, foam: 0, lap: 0, pool: 0, ring: 0, boat: 0 };
  const blit = (ctx: CanvasRenderingContext2D, sp: Sprite, cx: number, cy: number, w: number, h: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.image, cx - w / 2, cy - h / 2, w, h);
  };
  const place = (ctx: CanvasRenderingContext2D, sp: Sprite, dx: number, dy: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.image, sp.x + dx, sp.y + dy, sp.w, sp.h);
  };

  /** the troughs first, multiplied in one composite, then the lights and glints over them */
  const drawSea = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null) => {
    if (ctx) ctx.globalCompositeOperation = 'multiply';
    drawDrifters(ctx, t, outer, marks, true);
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    drawDrifters(ctx, t, outer, marks, false);
  };
  const drawDrifters = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null, troughs: boolean) => {
    for (const d of drifters) {
      if ((d.kind === 'trough') !== troughs) continue;
      const time = t + d.phase;
      const c = Math.floor(time / d.cycle);
      const age = time - c * d.cycle;
      if (age > d.life) continue;
      const strength = pick(d.table, c, 2);
      if (strength < 0.15) continue;
      const slot = ((c % PLACES) + PLACES) % PLACES;
      const x0 = d.places[slot * 2]!;
      const y0 = d.places[slot * 2 + 1]!;
      const s = seaScale(y0);
      // the swell runs in toward the beach, slower far out
      const x = x0 + age * 0.35 * s;
      const y = y0 + age * (d.kind === 'glint' ? 0.3 : 1.1) * s;
      const v = age / d.life;
      const flicker = d.kind === 'glint' ? 0.55 + 0.45 * Math.sin(age * 4.7 + d.phase * 5) : 1;
      const alpha = d.alpha * (0.65 + 0.35 * strength) * Math.sin(Math.PI * v) ** 1.5 * flicker;
      if (alpha < 0.01) continue;
      if (d.kind === 'glint') counts.glint++;
      else counts.swell++;
      marks?.push({ element: d.kind === 'glint' ? 'glint' : 'swell', index: 0, x, y });
      if (!ctx) continue;
      const set = d.kind === 'light' ? lights : troughs ? troughSprites : glints;
      const sp = set[Math.floor(pick(d.table, c, 1) * 7) % set.length]!;
      const len = (d.kind === 'glint' ? 10 + 6 * strength : d.kind === 'trough' ? 60 + 40 * pick(d.table, c, 1) : 46 + 46 * pick(d.table, c, 1)) * s;
      const h = (len * sp.h) / sp.w * (0.6 + 0.4 * s);
      blit(ctx, sp, x, y, len, h, alpha * outer);
    }
  };

  /** the swell breathing in at rock `i`: 0 drawn back, 1 full */
  const swellAt = (b: Breath, t: number) => {
    const time = t + b.phase;
    const c = Math.floor(time / b.cycle);
    const u = time / b.cycle - c;
    return { u, c, k: Math.sin(Math.PI * u) ** 2 * (0.6 + 0.4 * pick(b.table, c)) };
  };

  const drawRocks = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null) => {
    for (const [i, rock] of WET_ROCKS.entries()) {
      const { k: s } = swellAt(rockBreaths[i]!, t);
      counts.foam++;
      marks?.push({ element: 'foam', index: i, x: rock.x, y: rock.y });
      if (!ctx) continue;
      const sp = rockFoam[i]!;
      // it swells out from the foot and fades as it draws back
      const g = 1 + 0.09 * s;
      ctx.save();
      ctx.transform(g, 0, 0, 1, rock.x * (1 - g), 2 * s);
      place(ctx, sp, 0, 0, (0.3 + 0.65 * s) * outer);
      ctx.restore();
    }
    for (const [i, run] of [...LIPS, ...CLIFF_REACHES].entries()) {
      const { k: s } = swellAt(lapBreaths[i]!, t);
      const cliff = i >= LIPS.length;
      const mid = run[Math.floor(run.length / 2)]!;
      counts.lap++;
      marks?.push({ element: 'lap', index: i, x: mid.x, y: mid.y });
      if (ctx) place(ctx, laps[i]!, cliff ? 0 : -1.2 * s, (cliff ? 1.6 : 0.5) * s, (0.15 + 0.55 * s) * outer);
    }
  };

  const drawRings = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null) => {
    for (const [i, b] of hullRings.entries()) {
      const { u, c } = swellAt(b, t);
      if (pick(b.table, c, 1) < 0.35) continue;
      const life = 0.55;
      if (u > life) continue;
      const v = u / life;
      const width = 80 + 90 * (1 - (1 - v) ** 1.6);
      const alpha = smooth(v / 0.15) * (1 - v) ** 1.5 * 0.7;
      if (alpha < 0.01) continue;
      const x = CAIQUE.x - 4 + (pick(b.table, c, 2) - 0.5) * 6;
      const y = CAIQUE.y + 1.5;
      counts.ring++;
      marks?.push({ element: 'ring', index: i, x, y });
      if (!ctx) continue;
      const sp = rings[width < 110 ? 1 : 2]!;
      const ref = width < 110 ? 80 : 150;
      const w = (sp.w * width) / ref;
      blit(ctx, sp, x, y, w, (w * sp.h) / sp.w, alpha * outer);
    }
  };

  const drawFoam = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null) => {
    for (const [i, b] of reaches.entries()) {
      const time = t + b.phase;
      const c = Math.floor(time / b.cycle);
      const u = time / b.cycle - c;
      const reach = (4 + 6 * pick(b.table, c)) * (0.8 + 0.2 * Math.sin(i * 1.7));
      const strength = 0.65 + 0.35 * pick(b.table, c, 1);
      // a quick run up the shingle, a slow draw back
      const up = u < 0.32;
      const k = up ? 1 - (1 - u / 0.32) ** 2 : 1 - smooth((u - 0.32) / 0.6);
      const back = up ? 0 : Math.min(1, (u - 0.32) / 0.68);
      const f = foam[i];
      const mid = along(FOAM_LINE, (i + 0.5) / REACHES);
      counts.wavelet++;
      marks?.push({ element: 'wavelet', index: i, x: mid.x, y: mid.y + reach * k });
      if (!ctx || !f) continue;
      const wet = strength * (up ? 0.6 * k * k : 0.6 * (1 - back) ** 0.8);
      if (wet > 0.01) place(ctx, f.wet, 0, reach - 1, wet * outer);
      if (k > 0.02) place(ctx, f.film, 0, reach * k * 0.7, 0.8 * k * outer);
      place(ctx, f.lace, 0, reach * k, strength * (up ? 0.45 + 0.55 * k : 0.25 + 0.75 * k ** 0.7) * outer);
    }
  };

  const drawPools = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null) => {
    for (const [i, b] of poolBreaths.entries()) {
      const time = t + b.phase;
      const c = Math.floor(time / b.cycle);
      const age = time - c * b.cycle;
      const life = 9;
      if (age > life || pick(b.table, c) < 0.45) continue;
      const v = age / life;
      const pool = POOL_WATER[i]!;
      const pb = bounds(pool);
      const x = pb.x + pb.w * (0.3 + 0.4 * pick(b.table, c, 1));
      const y = pb.y + pb.h * (0.4 + 0.25 * pick(b.table, c, 2));
      const alpha = smooth(v / 0.12) * (1 - v) ** 1.6 * 0.75;
      if (alpha < 0.01) continue;
      counts.pool++;
      marks?.push({ element: 'pool', index: i, x, y });
      if (!ctx) continue;
      const w = 6 + 30 * (1 - (1 - v) ** 2);
      const sp = poolRing[0]!;
      blit(ctx, sp, x, y, (sp.w * w) / 34, (sp.h * w) / 34, alpha * outer);
    }
  };

  /** the transform that carries the boat at rest to `pose` (mirrored: its reflection) */
  const carry = (ctx: CanvasRenderingContext2D, p: CaiquePose, mirror: boolean) => {
    const a = mirror ? -p.angle : p.angle;
    const dy = mirror ? -0.6 * p.dy : p.dy;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    ctx.transform(cs, sn, -sn, cs, CAIQUE.x + p.dx - (cs * CAIQUE.x - sn * CAIQUE.y), CAIQUE.y + dy - (sn * CAIQUE.x + cs * CAIQUE.y));
  };

  const drawBoat = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null) => {
    caiquePose(t, pose);
    counts.boat++;
    marks?.push({ element: 'boat', index: 0, x: CAIQUE.x + pose.dx, y: CAIQUE.y + pose.dy });
    if (!ctx || !boat.hull || !boat.buoy) return;
    // the mooring line from the stem to where it meets the water, sagging a little
    const bow = posePoint(BOW, pose, scratch);
    ctx.globalAlpha = 0.6 * outer;
    ctx.strokeStyle = ROPE;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(bow.x, bow.y);
    ctx.quadraticCurveTo((bow.x + LINE_WATER.x) / 2 - 1, (bow.y + LINE_WATER.y) / 2 + 3.5, LINE_WATER.x, LINE_WATER.y);
    ctx.stroke();
    ctx.save();
    clip(ctx, 'hull');
    carry(ctx, pose, false);
    place(ctx, boat.hull, 0, 0, outer);
    ctx.restore();
    place(ctx, boat.buoy, 0, 0.45 * Math.sin((Math.PI * 2 * t) / 4.3 + 0.8) + 0.2 * Math.sin((Math.PI * 2 * t) / 2.9), outer);
  };

  /** the world rect the context shows, or null when its transform is not a plain scale */
  const viewOf = (ctx: CanvasRenderingContext2D): Rect | null => {
    if (typeof ctx.getTransform !== 'function') return null;
    const m = ctx.getTransform();
    if (m.b !== 0 || m.c !== 0 || m.a <= 0 || m.d <= 0) return null;
    return { x: -m.e / m.a, y: -m.f / m.d, w: ctx.canvas.width / m.a, h: ctx.canvas.height / m.d };
  };
  const meets = (v: Rect | null, b: Rect) => !v || (v.x + v.w > b.x && v.x < b.x + b.w && v.y + v.h > b.y && v.y < b.y + b.h);

  const frame = (ctx: CanvasRenderingContext2D | null, t: number, view: Rect | null, marks: Mark[] | null): Counts => {
    const outer = ctx ? ctx.globalAlpha : 1;
    for (const key in counts) counts[key as Mark['element']] = 0;
    if (meets(view, MOTION_BOXES.sea)) {
      if (ctx) {
        ctx.save();
        clip(ctx, 'sea');
        clip(ctx, 'dry');
      }
      drawSea(ctx, t, outer, marks);
      drawRocks(ctx, t, outer, marks);
      if (meets(view, MOTION_BOXES.boat)) drawRings(ctx, t, outer, marks);
      ctx?.restore();
    }
    if (meets(view, MOTION_BOXES.foam)) {
      if (ctx) {
        ctx.save();
        clip(ctx, 'beach');
        clip(ctx, 'dry');
      }
      drawFoam(ctx, t, outer, marks);
      ctx?.restore();
    }
    if (meets(view, MOTION_BOXES.pools)) {
      if (ctx) {
        ctx.save();
        clip(ctx, 'pools');
      }
      drawPools(ctx, t, outer, marks);
      ctx?.restore();
    }
    if (meets(view, MOTION_BOXES.boat)) drawBoat(ctx, t, outer, marks);
    if (ctx) ctx.globalAlpha = outer;
    return counts;
  };

  return {
    get ready() {
      return ready;
    },
    *prepare(): Strokes {
      if (ready) return;
      placeDrifters();
      yield;
      yield* paintSea();
      yield* paintWaterline();
      yield* paintRockFoam();
      yield* paintBoat();
      ready = !opts.still;
    },
    under(ctx, t) {
      if (!ready || !boat.plate || !boat.light || !boat.dark) return;
      if (!meets(viewOf(ctx), MOTION_BOXES.boat)) return;
      const outer = ctx.globalAlpha;
      caiquePose(t, pose);
      place(ctx, boat.plate, 0, 0, outer);
      ctx.save();
      carry(ctx, pose, true);
      place(ctx, boat.light, 0, 0, outer);
      ctx.globalCompositeOperation = 'multiply';
      place(ctx, boat.dark, 0, 0, outer);
      ctx.restore();
      ctx.globalAlpha = outer;
    },
    draw(ctx, t) {
      if (!ready) return;
      const view = viewOf(ctx);
      // what perches on the boat rides it (ADR 0373)
      caiquePose(t, COAST_CARRIERS.caique!.pose);
      if (!meets(view, MOTION_BOUNDS)) return;
      frame(ctx, t, view, null);
    },
    marksAt(t) {
      const marks: Mark[] = [];
      frame(null, t, null, marks);
      return marks;
    },
    visibleAt(t) {
      return { ...frame(null, t, null, null) };
    },
    sprites() {
      const all: Record<string, Sprite[]> = {
        light: lights, trough: troughSprites, glint: glints, ring: rings, 'pool-ring': poolRing,
        lace: foam.map((f) => f.lace), wet: foam.map((f) => f.wet), film: foam.map((f) => f.film),
        'rock-foam': rockFoam, lap: laps,
        boat: [boat.plate, boat.light, boat.dark, boat.hull, boat.buoy].filter((s): s is Sprite => !!s),
      };
      return Object.entries(all).flatMap(([kind, list]) => list.map((sp) => ({ kind, image: sp.image, w: sp.w, h: sp.h })));
    },
  };
}

const ROPE = rgba(BOAT.rope);
