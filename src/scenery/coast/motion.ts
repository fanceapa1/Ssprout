/**
 * The coast's water in motion (G6, GS1; ADRs 0282, 0374, 0362): swell crests running in over the
 * bay and breaking up the shingle, light netting the shallows, sun and moon glints, foam swelling
 * round the rocks and along the cliff's foot with each crest, a rare ring on the pools, and the
 * caique heaving on its mooring over a plate of the sea painted without it. Sprites are painted
 * once, in parts; each frame only blits them as a pure function of the animation time.
 * docs/systems/scenery.md › Coast › Motion.
 */
import type { DaylightState } from '../../ambience/daylight';
import { moonDisc, sunDisc } from '../../ambience/sky-layout';
import { createRng, type Rng } from '../../core/rng';
import { PAPER_WHITE, blob, bounds, createPainter, makeCanvas, mix, pointInPolygon, ribbon, rgba, type AnyCanvas, type Painter } from '../../paint';
import type { Pt, Rect } from '../../render/viewport';
import { applyView } from '../../scene/background';
import type { Strokes } from '../../scene/paint-land';
import type { SceneryMotion } from '../types';
import { BOAT, paintHull, paintMooringUnder, paintReflectionDark, paintReflectionLight, paintRig } from './boat';
import { POOL_WATER, SEA_WATER } from './geometry';
import { COAST_ART } from './index';
import { CAIQUE, COAST_SKY_LAYOUT, HORIZON } from './layout';
import { coastSteps } from './painters';
import { FOOT_FRONT, LIP_BOULDER_SHAPES, LIP_EDGES } from './lip-shapes';
import { SAND, SEA } from './paint-water';
import { caiquePose, CAIQUE_DEPTH, posePoint, type CaiquePose } from './pose';
import { streak } from './rock-kit';
import { CAIQUE_BOX, CAIQUE_SCALE, CAIQUE_SHAPES, DEPTH, FOAM_LINE, SEA_RECT, SEA_STRETCH, shallowsEdge, shoreContour, shoreDistance, shoreward } from './sea';
import { PINE_TRUNK, SHORE_BOULDER_SHAPES, SPLASH_ROCK_SHAPES, type RockShape } from './shapes';
import { arrival, CREST_LIFE, crestDepth, crestSpeed, delayAt, depthOf, gridDepths, latest, strength as crestStrength, SWASH_MAX, swashLimit, SWELL, SWELL_LINE, swellAt, type SwellGrid, type SwellPhase } from './swell';
import { COAST_CARRIERS } from './wildlife';

/** Random draws per mark, three per pass, so passes differ. */
const TABLE = 96;
/** Start positions per drifting mark: a mark repeats its place only after this many passes. */
const PLACES = 29;
/** Swell band pieces painted, and the ways a crest is broken into pieces (a crest takes one by its number). */
const BANDS = 6;
const LAYOUTS = 11;
/** A swell band sprite (world units at full size): its crest line `crest` down from its top. */
export const BAND = { w: 200, h: 40, crest: 24 } as const;
/** The crest's thin highlight sprites. */
const GLEAMS = 4;
const GLEAM = { w: 160, h: 5 } as const;
/** How much of the gap to the next crest a band covers (its back and trough together). */
const BAND_SPAN = 0.5;
/** Columns a crest piece is cut into where it bends round a rock or the hull. */
const SUB = 7;
/** Glints twinkling at once at most, and the glint sprites. */
const GLINTS = 128;
const SPARKS = 4;
/** The caustics' tile, pixels, and the world units one pixel covers across and down (foreshortened). */
const NET = 128;
/** How strongly a crest shows; a rock's ring's life (s). */
const CREST_ALPHA = 1;
const RING_LIFE = 4.4;
/** The shore break's beats (s): the lip forming, the run up, the pause, the slide back, the sand drying. */
const FORM = 2.6;
const RUN = 2.2;
const HOLD = 0.7;
const BACK = 3.8;
const DRY = 6.5;
/** how long the lace left at the turn takes to break up (s), and how far a crest's arrival strays per reach (s) */
const LEFT = 3.2;
const STAGGER = 0.9;
const NET_SCALE = [
  { x: 0.25, y: 0.095, vx: 0.55, vy: 0.16, a: 0.34 },
  { x: 0.31, y: 0.12, vx: -0.4, vy: 0.22, a: 0.26 },
] as const;

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
const ALL_ROCKS: readonly RockShape[] = [...SHORE_BOULDER_SHAPES, ...SPLASH_ROCK_SHAPES, ...LIP_BOULDER_SHAPES];

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

/** How far out (world units, up the picture) a breaker forms before it runs up the shingle. */
const BREAKER_OUT = 13;
/** The waterline's reaches along `FOAM_LINE`, each breathing on its own. */
const REACHES = 9;
const FOAM_BOX: Rect = (() => {
  const b = bounds(FOAM_LINE);
  return { x: b.x, y: b.y - BREAKER_OUT - 6, w: b.w, h: b.h + BREAKER_OUT + SWASH_MAX + 18 };
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

/** A mark drifting over the sea: a light catspaw or a trough. */
interface Drifter {
  kind: 'light' | 'trough';
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
  element: 'swell' | 'crest' | 'glint' | 'caustic' | 'breaker' | 'wavelet' | 'foam' | 'swirl' | 'lap' | 'pool' | 'ring' | 'boat';
  index: number;
  x: number;
  y: number;
}
type Counts = Record<Mark['element'], number>;

export interface CoastMotion extends SceneryMotion {
  readonly ready: boolean;
  /** the marks drawn at time `t` under `light` (for tests; none: a midday light) */
  marksAt(t: number, light?: DaylightState | null): Mark[];
  /** how many marks each element draws at `t` (for tests) */
  visibleAt(t: number, light?: DaylightState | null): Counts;
  /** where crest `n`'s line lies at x at time `t`, parted round what stands in the water unless `parted` is false (for tests) */
  crestAt(n: number, t: number, x: number, parted?: boolean): number;
  /** the depth each wet rock's foam and ring keep time with, then the hull's (for tests) */
  obstacleDepths(): number[];
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

const ROCK_BOXES = ALL_ROCKS.map((r) => bounds(r.outline));
const inRock = (q: Pt, pad: number) =>
  ALL_ROCKS.some((r, i) => {
    const b = ROCK_BOXES[i]!;
    return q.x > b.x - pad && q.x < b.x + b.w + pad && q.y > b.y - pad && q.y < b.y + b.h + pad && pointInPolygon(q, r.outline);
  });
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

/** The pine's trunk where it stands on the beach: the waves run behind it. */
const TRUNK_FOOT: Pt[] = (() => {
  const run = PINE_TRUNK.filter((q) => q.y > 600);
  const hw = (q: Pt) => 11 - (PINE_TRUNK[0]!.y - q.y) * 0.015;
  return [...run.map((q) => ({ x: q.x - hw(q), y: q.y })), ...run.slice().reverse().map((q) => ({ x: q.x + hw(q), y: q.y })), { x: run[0]!.x, y: run[0]!.y + 4 }];
})();

/** The pale shallows over sand, where the caustics play. */
const SHALLOWS: Pt[] = shoreward(shallowsEdge());
const SHALLOWS_BOX: Rect = (() => {
  const b = bounds(shallowsEdge());
  return { x: b.x, y: b.y, w: b.w, h: Math.max(...FOAM_LINE.map((q) => q.y)) + 4 - b.y };
})();

/** The worn lip of the ledge, where the water meets its edge (above the beach flight; GA1). */
const LIPS = LIP_EDGES.filter((run) => run.every((q) => q.y < 790)).map((run) => run.slice());
/** The cliff's foot on the sea (the front of its wave-cut shelf, GA1), in stretches that lap one after another. */
const CLIFF_REACHES: Pt[][] = (() => {
  const pts = FOOT_FRONT;
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
  for (let i = 0; i < 16; i++) addDrifter('light', [7, 12], [1, 5], [0.5, 0.8]);
  for (let i = 0; i < 8; i++) addDrifter('trough', [8, 13], [2, 6], [0.3, 0.5]);
  const breath = (lo: number, hi: number): Breath => {
    const cycle = rng.range(lo, hi);
    return { cycle, phase: rng.range(0, cycle), table: tableOf(rng) };
  };
  const poolBreaths = POOL_WATER.map(() => breath(29, 47));
  const sparkles: Breath[] = Array.from({ length: GLINTS }, () => breath(1.4, 3.6));
  // each reach's place on the swell: how far along the beach it is, and its own small lag
  const reachDelay = Array.from({ length: REACHES }, (_, i) => delayAt(along(FOAM_LINE, (i + 0.5) / REACHES).x) + rng.range(-0.25, 0.25));
  const rockDepth = WET_ROCKS.map((r) => Math.max(SWELL.breaks, depthOf({ x: r.x, y: r.y + 2 })));
  const lapAt = [...LIPS, ...CLIFF_REACHES].map((run) => {
    const mid = run[Math.floor(run.length / 2)]!;
    return { x: mid.x, y: mid.y, d: Math.max(SWELL.breaks, depthOf(mid)), lag: rng.range(-0.4, 0.4) };
  });
  const rockFoot = WET_ROCKS.map((r) => r.columns.reduce((a, c) => a + c.base, 0) / r.columns.length);
  const reachMid = Array.from({ length: REACHES }, (_, i) => along(FOAM_LINE, (i + 0.5) / REACHES));
  // a reach runs no farther than the beach's plants allow anywhere along it
  const reachLimit = Array.from({ length: REACHES }, (_, i) => {
    let lim = SWASH_MAX;
    for (let u = (i - 0.25) / REACHES; u <= (i + 1.25) / REACHES; u += 0.01) lim = Math.min(lim, swashLimit(along(FOAM_LINE, u).x));
    return lim;
  });
  const phase: SwellPhase = { n: 0, since: 0, gap: 1, lift: 0, strength: 0 };
  const staggers = tableOf(rng.fork('stagger'));

  /** each drifter's start places, more toward the horizon, few over the shallows, none on rock or the boat */
  function placeDrifters(): void {
    const r = rng.fork('places');
    for (const d of drifters) {
      for (let i = 0; i < PLACES; i++) {
        // the open bay, if no draw lands (never seen, but a place must be water)
        let q: Pt = { x: 180 + i * 3, y: 450 };
        for (let tries = 0; tries < 60; tries++) {
          const c = { x: r.range(-20, 900), y: HORIZON + 4 + 380 * r.next() ** 1.7 };
          const s = seaScale(c.y);
          const end = { x: c.x + d.life * 0.35 * s, y: c.y + d.life * 0.6 * s };
          if (!pointInPolygon(c, SEA_WATER) || !pointInPolygon(end, SEA_WATER) || inRock(c, 6) || inRock(end, 6) || nearBoat(c) || nearBoat(end)) continue;
          const depth = shoreDistance(c);
          if (depth < 40) continue;
          const keep = depth < DEPTH.shallows ? 0.3 : depth < DEPTH.turquoise ? 0.8 : 1;
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
  const bands: Sprite[] = [];
  const gleams: Sprite[] = [];
  const sparks: Sprite[] = [];
  const sunSparks: Sprite[] = [];
  const breakers: Sprite[] = [];
  const bores: Sprite[] = [];
  const lefts: Sprite[] = [];
  let net: Sprite | null = null;
  const grid: SwellGrid = { xs: new Float32Array(0), depths: new Float32Array(0), ys: new Float32Array(0), open: new Uint8Array(0) };
  /** each crest layout's pieces: first and last column, band sprite, alpha, a small rise (units) */
  const layouts: Float32Array[] = [];
  /** what crests part round (the wet rocks, then the hull), and which of them touch each column */
  const obstacles: { x: number; half: number; d: number; lag: number; heal: number }[] = [];
  const colObstacles: number[][] = [];
  let boatDepth = CAIQUE_DEPTH;
  const rings: Sprite[] = [];
  const poolRing: Sprite[] = [];
  const foam: { lace: Sprite; wet: Sprite; film: Sprite; left: Sprite }[] = [];
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
    // a glint: a small hard lifted spark (the first two), or a few together (the rest), each over the
    // wavelet's shaded side, so it reads on bright water too
    for (let i = 0; i < SPARKS; i++) {
      const r = rng.fork(`spark-${i}`);
      const { s, p } = sprite(24, 6, `spark-${i}`, 6);
      const D = p.layer({ x: 0, y: 0, w: 24, h: 6 });
      const L = p.layer({ x: 0, y: 0, w: 24, h: 6 });
      const flecks = i < 2 ? [{ x: 12, y: 2.8, len: r.range(13, 17), h: r.range(1.8, 2.4) }] : Array.from({ length: r.int(3, 5) }, () => ({ x: r.range(5, 19), y: r.range(1.8, 3.8), len: r.range(4, 8), h: r.range(1.3, 1.9) }));
      for (const f of flecks) {
        const bow = r.range(-0.25, 0.25);
        D.fill(dash(f.x + 0.4, f.y + f.h * 0.75, f.len * 0.85, f.h * 0.7, bow), mix(SEA.deepTeal, SEA.deep, 0.3), 0.6);
        L.fill(dash(f.x, f.y, f.len, f.h, bow), PAPER_WHITE, 1);
      }
      yield* D.dryParts({ opacity: 0.45, edge: 0.1, sharpness: 0.3, flow: 0.2 });
      yield* L.dryParts({ ...LIFT, opacity: 1, sharpness: 0.8, edgeWidth: 0.4, flow: 0.2 });
      sparks.push(seal(s));
      yield;
    }
    // a low sun's glint (GS2): a white core in a warm gold flare over a warm shade, so under the
    // light plate it stays the brightest and warmest thing on the water
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(`sun-spark-${i}`);
      const { s, p } = sprite(24, 7, `sun-spark-${i}`, 6);
      const box = { x: 0, y: 0, w: 24, h: 7 };
      const D = p.layer(box);
      const G = p.layer(box);
      const C = p.layer(box);
      const flecks = i === 0 ? [{ x: 12, y: 3.2, len: r.range(14, 18), h: r.range(2.2, 2.8) }] : Array.from({ length: r.int(3, 5) }, () => ({ x: r.range(5, 19), y: r.range(2.2, 4.4), len: r.range(5, 9), h: r.range(1.6, 2.2) }));
      for (const f of flecks) {
        const bow = r.range(-0.25, 0.25);
        D.fill(dash(f.x + 0.4, f.y + f.h * 0.8, f.len * 0.9, f.h * 0.8, bow), SUN_SHADE, 0.6);
        G.fill(dash(f.x, f.y, f.len * 1.05, f.h * 1.1, bow), SUN_GOLD, 0.85);
        C.fill(dash(f.x, f.y - f.h * 0.05, f.len * 0.8, f.h * 0.7, bow), PAPER_WHITE, 1);
      }
      yield* D.dryParts({ opacity: 0.5, edge: 0.1, sharpness: 0.3, flow: 0.2 });
      yield* G.dryParts({ ...LIFT, opacity: 0.95, sharpness: 0.5, edgeWidth: 0.6, flow: 0.2 });
      yield* C.dryParts({ ...LIFT, opacity: 1, sharpness: 0.8, edgeWidth: 0.3, flow: 0.1 });
      sunSparks.push(seal(s));
      yield;
    }
    // a piece of swell (GS2): a broad soft lighter back behind the crest line, a darker trough
    // ahead of it, both granulated and uneven along the length
    for (let i = 0; i < BANDS; i++) {
      const r = rng.fork(`band-${i}`);
      const { s, p } = sprite(BAND.w, BAND.h, `band-${i}`, 2);
      const box = { x: 0, y: 0, w: BAND.w, h: BAND.h };
      const D = p.layer(box);
      const L = p.layer(box);
      const bow = r.range(-1.4, 0.8);
      const c = BAND.crest;
      for (let x = r.range(6, 20); x < BAND.w - 30; ) {
        const len = Math.min(BAND.w - 4 - x, r.range(70, 130));
        const mx = x + len / 2;
        L.fill(dash(mx, c - 9.5 + r.range(-1.5, 1.5), len, r.range(14, 19), bow), mix(SEA.aqua, SEA.aquaPale, 0.45), r.range(0.5, 0.8));
        L.fill(dash(mx + r.range(-10, 10), c - 4 + r.range(-0.6, 0.6), len * r.range(0.6, 0.9), r.range(5, 7.5), bow), mix(SEA.aquaPale, PAPER_WHITE, 0.3), r.range(0.45, 0.75));
        x += len * r.range(0.55, 0.85);
      }
      for (let x = r.range(4, 24); x < BAND.w - 30; ) {
        const len = Math.min(BAND.w - 4 - x, r.range(60, 140));
        const mx = x + len / 2;
        D.fill(dash(mx, c + 5.5 + r.range(-1, 1), len, r.range(8, 11), bow), mix(SEA.deepTeal, SEA.deep, 0.35), r.range(0.4, 0.7));
        D.fill(dash(mx + r.range(-8, 8), c + 3, len * r.range(0.5, 0.85), r.range(4, 5.5), bow), mix(SEA.deep, SEA.ultra, 0.3), r.range(0.22, 0.38));
        x += len * r.range(0.55, 0.9);
      }
      yield* D.dryParts({ opacity: 0.6, edge: 0.08, edgeWidth: 3, sharpness: 0.02, centreLift: 0.05, granulation: 0.55, flow: 0.7, flowScale: 12 });
      yield* L.dryParts({ ...LIFT, opacity: 0.66, sharpness: 0.02, edgeWidth: 3, granulation: 0.45, flow: 0.7, flowScale: 14 });
      featherX(s, 0, BAND.w, 46, 2);
      bands.push(seal(s));
      yield;
    }
    // the crest's thin broken highlight, laid on some crests where they catch the light
    for (let i = 0; i < GLEAMS; i++) {
      const r = rng.fork(`gleam-${i}`);
      const { s, p } = sprite(GLEAM.w, GLEAM.h, `gleam-${i}`, 4);
      const L = p.layer({ x: 0, y: 0, w: GLEAM.w, h: GLEAM.h });
      for (let x = r.range(4, 16); x < GLEAM.w - 8; ) {
        const len = Math.min(GLEAM.w - 6 - x, r.range(4, 22));
        if (r.chance(0.8)) L.fill(dash(x + len / 2, GLEAM.h / 2 + r.range(-0.6, 0.6), len, r.range(0.9, 1.8), r.range(-0.3, 0.3)), PAPER_WHITE, 1);
        x += len + r.range(2, 14);
      }
      yield* L.dryParts({ ...LIFT, opacity: 0.95, sharpness: 0.5, edgeWidth: 0.5, flow: 0.3 });
      featherX(s, 0, GLEAM.w, 30, 4);
      gleams.push(seal(s));
      yield;
    }
    paintNet();
    yield;
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

  /** the caustics' tile: a net of thin light lines on a torus (the cells' edges), soft and uneven */
  function paintNet(): void {
    const r = rng.fork('net');
    const pts = Array.from({ length: 11 }, () => ({ x: r.next() * NET, y: r.next() * NET, w: r.range(0.7, 1.3) }));
    const canvas = makeCanvas(NET, NET);
    const c = canvas.getContext('2d') as CanvasRenderingContext2D;
    const img = c.getImageData(0, 0, NET, NET);
    const d = img.data;
    for (let y = 0; y < NET; y++) {
      for (let x = 0; x < NET; x++) {
        let f1 = Infinity;
        let f2 = Infinity;
        for (const q of pts) {
          const dx = Math.abs(x - q.x);
          const dy = Math.abs(y - q.y);
          const e = Math.hypot(Math.min(dx, NET - dx), Math.min(dy, NET - dy));
          if (e < f1) {
            f2 = f1;
            f1 = e;
          } else if (e < f2) f2 = e;
        }
        // bright along the edges, brightest where three cells meet
        const edge = Math.max(0, 1 - (f2 - f1) / 5);
        const i = (y * NET + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.round(255 * edge ** 1.6 * (0.55 + 0.45 * Math.min(1, 14 / (f1 + 4))));
      }
    }
    c.putImageData(img, 0, 0);
    net = seal({ image: canvas as CanvasImageSource, x: 0, y: 0, w: NET, h: NET });
  }

  /** the lines of equal depth a crest follows, one per part, and the ways a crest is broken */
  function* buildGrid(): Strokes {
    const depths = gridDepths();
    const first = shoreContour(depths[0]! * SEA_STRETCH, ...SWELL_LINE);
    const cols = first.length;
    grid.xs = Float32Array.from(first, (q) => q.x);
    grid.depths = Float32Array.from(depths);
    grid.ys = new Float32Array(depths.length * cols);
    grid.open = new Uint8Array(depths.length * cols);
    for (const [k, d] of depths.entries()) {
      const line = shoreContour(d * SEA_STRETCH, ...SWELL_LINE);
      for (let j = 0; j < cols; j++) {
        const q = line[j]!;
        grid.ys[k * cols + j] = q.y;
        grid.open[k * cols + j] = q.y > HORIZON + 0.5 && pointInPolygon(q, SEA_WATER) && !inRock(q, 3) ? 1 : 0;
      }
      yield;
    }
    const r = rng.fork('crest-layouts');
    // long pieces just overlapping, a few gaps; some carry a highlight on their crest
    for (let n = 0; n < LAYOUTS; n++) {
      const pieces: number[] = [];
      for (let j = r.int(-6, 4); j < cols - 4; ) {
        const len = r.int(18, 34);
        if (r.chance(0.9)) pieces.push(Math.max(0, j), Math.min(cols - 1, j + len), r.int(0, BANDS - 1), r.range(0.5, 1), r.range(-1.2, 1.2), r.chance(0.32) ? r.int(0, GLEAMS - 1) : -1);
        j += Math.round(len * r.range(0.8, 1));
      }
      layouts.push(Float32Array.from(pieces));
    }
    // each wet rock and the hull, at the depth of the line through its foot; the crests part round
    // the splash rocks and the hull (the boulders along the bastion meet them where they fade)
    const shapes = [...WET_ROCKS.map((rk, i) => ({ x: rk.x, y: rockFoot[i]!, half: rk.w / 2, parts: SPLASH_ROCK_SHAPES.includes(rk) })), { x: CAIQUE.x - 2, y: CAIQUE.y, half: 36, parts: true }];
    for (const [k, o] of shapes.entries()) {
      const d = gridDepth(o.x, o.y);
      obstacles.push({ x: o.x, half: o.half, d, lag: Math.max(0.6, Math.min(2.6, 0.35 + o.half / 14)), heal: Math.min(30, 8 + 1.2 * o.half) });
      const reach = o.half * 1.3 * 2.2;
      if (o.parts) for (let j = 0; j < cols; j++) if (Math.abs(grid.xs[j]! - o.x) < reach) (colObstacles[j] ??= []).push(k);
    }
    // the rocks' foam and rings and the hull's ring keep the time of the band that reaches them
    for (let i = 0; i < WET_ROCKS.length; i++) rockDepth[i] = obstacles[i]!.d;
    boatDepth = obstacles[obstacles.length - 1]!.d;
  }

  /** the depth of the grid's line through (x, y), at the nearest column */
  function gridDepth(x: number, y: number): number {
    const xs = grid.xs;
    let j = 0;
    for (let q = 1; q < xs.length; q++) if (Math.abs(xs[q]! - x) < Math.abs(xs[j]! - x)) j = q;
    const D = grid.depths;
    let lo = D[0]!;
    let hi = D[D.length - 1]!;
    if (lineAt(lo, j) <= y) return lo;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (lineAt(mid, j) > y) lo = mid;
      else hi = mid;
    }
    return Math.max(SWELL.breaks, (lo + hi) / 2);
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
      // the lace left at the turn as the sheet slides away: the same scallops, broken into holes
      const lr = rng.fork(`left-${i}`);
      const left = sprite(box.w, box.h, `left-${i}`, 4, box);
      const LL = left.p.layer(box);
      for (let u = lr.range(0, 0.02); u < 1; ) {
        const len = lr.range(0.006, 0.03);
        if (lr.chance(0.5)) LL.fill(streak(scallop(u), scallop(Math.min(1, u + len)), lr.range(0.6, 1.4), lr), PAPER_WHITE, 0.9);
        u += len + lr.range(0.01, 0.04);
      }
      for (let j = 0; j < 46; j++) {
        const q = scallop(lr.next());
        const rr = lr.range(0.3, 0.8);
        LL.fill(blob(q.x + lr.range(-2, 2), q.y + lr.range(-1.5, 3.5), rr * 1.4, rr, lr, { points: 6 }), PAPER_WHITE, 0.85);
      }
      yield* LL.dryParts({ ...LIFT, opacity: 0.85, sharpness: 0.7, edgeWidth: 0.5, flow: 0.4, flowScale: 12 });
      featherX(left.s, box.x, box.x + box.w, 16, 4);
      yield;
      // the bore: the broken white water the lip throws, a soft band behind its front
      const bore = sprite(box.w, box.h, `bore-${i}`, 3, box);
      const BG = bore.p.layer(box);
      const BW = bore.p.layer(box);
      BG.fill(ribbon(line, () => 3.4, () => -3.4), PAPER_WHITE, 0.7);
      for (let u = r.range(0, 0.02); u < 1; ) {
        const len = r.range(0.02, 0.08);
        const a = along(line, u);
        const c = along(line, Math.min(1, u + len));
        const dy = -r.range(0.5, 5.5);
        if (r.chance(0.85)) BW.fill(streak({ x: a.x, y: a.y + dy }, { x: c.x, y: c.y + dy + r.range(-0.6, 0.6) }, r.range(1.6, 3.2), r), PAPER_WHITE, 0.95);
        u += len * r.range(0.4, 0.9);
      }
      yield* BG.dryParts({ ...LIFT, opacity: 0.65, sharpness: 0.1, edgeWidth: 1.2, flow: 0.6, flowScale: 10 });
      yield* BW.dryParts({ ...LIFT, opacity: 0.9, sharpness: 0.5, edgeWidth: 0.6, flow: 0.4, flowScale: 12 });
      featherX(bore.s, box.x, box.x + box.w, 16, 3);
      bores.push(seal(bore.s));
      lefts.push(seal(left.s));
      yield;
      // the breaker: a broken white lip over the darker water of its face, out where it forms
      const brk = sprite(box.w, box.h, `breaker-${i}`, 3, box);
      const B = brk.p.layer(box);
      const F = brk.p.layer(box);
      for (let u = r.range(0, 0.03); u < 1; ) {
        const len = r.range(0.04, 0.13);
        const a = along(line, u);
        const c = along(line, Math.min(1, u + len));
        F.fill(streak({ x: a.x, y: a.y + 2.6 }, { x: c.x, y: c.y + 2.6 }, r.range(2.4, 3.6), r), mix(SEA.deepTeal, SEA.turquoise, 0.4), 0.4);
        if (r.chance(0.9)) B.fill(streak({ x: a.x, y: a.y + r.range(-0.5, 0.5) }, { x: c.x, y: c.y + r.range(-0.5, 0.5) }, r.range(1.8, 3), r), PAPER_WHITE, 0.95);
        u += len + r.range(0.005, 0.04);
      }
      yield* F.dryParts({ opacity: 0.55, edge: 0.1, sharpness: 0.15, granulation: 0.3, flow: 0.4 });
      yield* B.dryParts({ ...LIFT, opacity: 0.95, sharpness: 0.6, edgeWidth: 0.6, flow: 0.4, flowScale: 12 });
      featherX(brk.s, box.x, box.x + box.w, 16, 3);
      breakers.push(seal(brk.s));
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
      // the sheet of water running up: its edge on the line, reaching back up over the waterline, so
      // drawn a run's length down the shingle it covers the sand from the waterline to its edge
      const sheetBox: Rect = { x: box.x, y: b.y - SWASH_MAX - 8, w: box.w, h: b.h + SWASH_MAX + 12 };
      const film = sprite(sheetBox.w, sheetBox.h, `film-${i}`, 2.5, sheetBox);
      yield* film.p.parts.glaze(ribbon(line, () => (SWASH_MAX + 5) / 2, () => -(SWASH_MAX + 5) / 2), mix(SEA.aquaPale, PAPER_WHITE, 0.25), { rng: r, opacity: 0.42, layers: 5, deform: 0.06, spread: 0.12, edge: 0.35, sharpness: 0.55, fade: { angle: -Math.PI / 2, start: 0.25, amount: 1, ragged: 0.5 } });
      featherX(film.s, sheetBox.x, sheetBox.x + sheetBox.w, 18, 2.5);
      foam.push({ lace: seal(lace.s), wet: seal(wet.s), film: seal(film.s), left: lefts[i]! });
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
  const beachBand: Pt[] = [...FOAM_LINE.map((q) => ({ x: q.x, y: q.y - BREAKER_OUT - 5 })), ...FOAM_LINE.slice().reverse().map((q) => ({ x: q.x, y: q.y + SWASH_MAX + 6 }))];
  const CLIPS = {
    sea: [SEA_WATER] as Pt[][],
    beach: [beachBand],
    shallows: [SHALLOWS],
    dry: [rectPts(grow(union([SEA_RECT, FOAM_BOX]), 40)), ...ALL_ROCKS.map((r) => r.outline), TRUNK_FOOT],
    pools: POOL_WATER,
    hull: [rectPts({ x: HULL_RECT.x - 10, y: HULL_RECT.y - 10, w: HULL_RECT.w + 20, h: WATER_Y - HULL_RECT.y + 10 })],
  };
  const paths = { sea: pathOf(CLIPS.sea), beach: pathOf(CLIPS.beach), shallows: pathOf(CLIPS.shallows), dry: pathOf(CLIPS.dry), pools: pathOf(CLIPS.pools), hull: pathOf(CLIPS.hull) };
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
  const counts: Counts = { swell: 0, crest: 0, glint: 0, caustic: 0, breaker: 0, wavelet: 0, foam: 0, swirl: 0, lap: 0, pool: 0, ring: 0, boat: 0 };
  const blit = (ctx: CanvasRenderingContext2D, sp: Sprite, cx: number, cy: number, w: number, h: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.image, cx - w / 2, cy - h / 2, w, h);
  };
  const place = (ctx: CanvasRenderingContext2D, sp: Sprite, dx: number, dy: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.image, sp.x + dx, sp.y + dy, sp.w, sp.h);
  };
  /** the frame's world transform: a turned blit sets its own from it and puts it back */
  const base = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  /** the troughs first, multiplied in one composite, then the crests and the lights over them */
  const drawSea = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null, light: DaylightState | null) => {
    if (ctx) ctx.globalCompositeOperation = 'multiply';
    drawDrifters(ctx, t, outer, marks, true);
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    drawCrests(ctx, t, outer, marks, light);
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
      // a catspaw drifts slowly in on the breeze, slower far out
      const x = x0 + age * 0.35 * s;
      const y = y0 + age * 0.6 * s;
      const v = age / d.life;
      const alpha = d.alpha * (0.65 + 0.35 * strength) * Math.sin(Math.PI * v) ** 1.5;
      if (alpha < 0.01) continue;
      counts.swell++;
      marks?.push({ element: 'swell', index: 0, x, y });
      if (!ctx) continue;
      const set = d.kind === 'light' ? lights : troughSprites;
      const sp = set[Math.floor(pick(d.table, c, 1) * 7) % set.length]!;
      const len = (d.kind === 'trough' ? 60 + 40 * pick(d.table, c, 1) : 40 + 40 * pick(d.table, c, 1)) * s;
      const h = (len * sp.h) / sp.w * (0.6 + 0.4 * s);
      blit(ctx, sp, x, y, len, h, alpha * outer);
    }
  };

  /** y of the depth line through `d` at column `j`; `lineK` is left at the line below `d` */
  let lineK = 0;
  const lineAt = (d: number, j: number): number => {
    const D = grid.depths;
    const cols = grid.xs.length;
    let lo = 0;
    let hi = D.length - 1;
    if (d <= D[0]!) return (lineK = 0), grid.ys[j]!;
    if (d >= D[hi]!) return (lineK = hi - 1), grid.ys[hi * cols + j]!;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (D[mid]! <= d) lo = mid;
      else hi = mid;
    }
    const f = (d - D[lo]!) / (D[hi]! - D[lo]!);
    lineK = lo;
    return grid.ys[lo * cols + j]! + (grid.ys[hi * cols + j]! - grid.ys[lo * cols + j]!) * f;
  };
  /** how far behind the rest of its line a crest at depth `d` lags at column `j` (s), and how much it thins there */
  let shade = 0;
  const lagAt = (j: number, d: number): number => {
    let lag = 0;
    shade = 0;
    const list = colObstacles[j];
    if (!list) return 0;
    for (const k of list) {
      const o = obstacles[k]!;
      const u = o.d - d;
      if (u <= 0 || u > o.heal * 1.4) continue;
      const dx = (grid.xs[j]! - o.x) / (o.half * 1.3);
      const g = Math.exp(-dx * dx) * smooth(u / 3);
      lag += o.lag * g * Math.exp(-u / o.heal);
      shade = Math.max(shade, g * Math.exp(-u / (o.heal * 0.6)));
    }
    return lag;
  };
  /** where crest `n` (breaking at `T`) lies at column `j` at time `t`, held at the break past it, parted round rocks and the hull */
  let parted = true;
  const crestY = (T: number, t: number, j: number): number => {
    const tau = Math.min(0, t - T - delayAt(grid.xs[j]!));
    const lag = parted ? lagAt(j, crestDepth(tau)) : 0;
    return lineAt(crestDepth(Math.min(0, tau - lag)), j);
  };
  /** the same at a fractional column */
  const crestYf = (T: number, t: number, jf: number): number => {
    const cols = grid.xs.length;
    const j = Math.max(0, Math.min(cols - 2, Math.floor(jf)));
    const u = jf - j;
    return crestY(T, t, j) * (1 - u) + crestY(T, t, j + 1) * u;
  };
  const colX = (jf: number): number => {
    const xs = grid.xs;
    const j = Math.max(0, Math.min(xs.length - 2, Math.floor(jf)));
    return xs[j]! + (xs[j + 1]! - xs[j]!) * (jf - j);
  };
  /** the columns of j0..j1 where a rock's or the hull's wake bends a crest at depth `d`, or null */
  const wake = { a: 0, b: 0 };
  const wakeOn = (j0: number, j1: number, d: number): typeof wake | null => {
    const xs = grid.xs;
    const step = xs[1]! - xs[0]!;
    let a = Infinity;
    let b = -Infinity;
    for (let j = Math.max(0, Math.floor(j0)); j <= Math.min(xs.length - 1, Math.ceil(j1)); j++) {
      const list = colObstacles[j];
      if (!list) continue;
      for (const k of list) {
        const o = obstacles[k]!;
        const u = o.d - d;
        if (u <= 0 || u > o.heal * 1.4) continue;
        const r = o.half * 1.3 * 1.7;
        a = Math.min(a, (o.x - r - xs[0]!) / step);
        b = Math.max(b, (o.x + r - xs[0]!) / step);
      }
    }
    if (a === Infinity) return null;
    wake.a = Math.max(j0, a);
    wake.b = Math.min(j1, b);
    return wake.b > wake.a ? wake : null;
  };

  /** a part of a sprite (source x from `k0` to `k1` of its width) laid from (x0, y0) to (x1, y1), `h` thick, its middle `off` below the line */
  const span = (ctx: CanvasRenderingContext2D, sp: Sprite, k0: number, k1: number, x0: number, y0: number, x1: number, y1: number, h: number, off: number, alpha: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.01) return;
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const cs = Math.cos(angle);
    const sn = Math.sin(angle);
    const cx = (x0 + x1) / 2 - sn * off;
    const cy = (y0 + y1) / 2 + cs * off;
    const img = sp.image as CanvasImageSource & { width: number; height: number };
    const sx = k0 * img.width;
    const sw = Math.max(1, (k1 - k0) * img.width);
    const m = base;
    ctx.globalAlpha = alpha;
    ctx.setTransform(m.a * cs + m.c * sn, m.b * cs + m.d * sn, m.c * cs - m.a * sn, m.d * cs - m.b * sn, m.a * cx + m.c * cy + m.e, m.b * cx + m.d * cy + m.f);
    ctx.drawImage(img, sx, 0, sw, img.height, -len / 2 - 0.3, -h / 2, len + 0.6, h);
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  };

  /**
   * The swell's crests (GS2): broad soft bands along lines of equal depth, a lighter back behind the
   * crest and a darker trough ahead, half as wide as the gap to the next crest; a thin broken
   * highlight on some, where the light is; parted round the rocks and the hull and closing behind.
   */
  const drawCrests = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null, light: DaylightState | null) => {
    const cols = grid.xs.length;
    if (!cols) return;
    const w = light?.weights;
    // the highlight: bright by day, warm at the low suns, faint under the moon
    const gleamA = w ? w.midday * 0.8 + (w.sunrise + w.sunset) * 0.95 + w.night * 0.3 : 0.8;
    // under the night the pale backs would read as stripes: the bands go quieter
    const bodyA = w ? 1 - 0.45 * w.night : 1;
    const last = latest(t + CREST_LIFE);
    for (let n = latest(t - SWELL.peel) + 1; n <= last; n++) {
      const T = arrival(n);
      const st = crestStrength(n);
      const pieces = layouts[((n % LAYOUTS) + LAYOUTS) % LAYOUTS]!;
      for (let i = 0; i < pieces.length; i += 6) {
        const j0 = pieces[i]!;
        const j1 = pieces[i + 1]!;
        const jm = (j0 + j1) >> 1;
        const tau = t - T - delayAt(grid.xs[jm]!);
        if (tau >= 0 || tau < -CREST_LIFE) continue;
        const d = crestDepth(tau);
        const ym = lineAt(d, jm);
        if (!grid.open[lineK * cols + jm] || !grid.open[(lineK + 1) * cols + jm]) continue;
        const s = seaScale(ym);
        const xm = grid.xs[jm]!;
        // each band swells and fades along its length, slowly, as it comes in
        const along = 0.6 + 0.4 * Math.sin(xm / 150 + n * 2.1 + t * 0.045);
        const alpha = CREST_ALPHA * (0.45 + 0.55 * st) * pieces[i + 3]! * along * (0.5 + 0.5 * s) * smooth((SWELL.born - d) / 70) * smooth((d - SWELL.breaks) / 14);
        if (alpha < 0.015) continue;
        counts.crest++;
        marks?.push({ element: 'crest', index: n, x: xm, y: ym });
        if (!ctx) continue;
        const y0 = crestY(T, t, j0);
        const y1 = crestY(T, t, j1);
        // round the headland the lines climb: a band follows them a little way, then thins out
        const angle = Math.atan2(y1 - y0, grid.xs[j1]! - grid.xs[j0]!);
        const a = alpha * bodyA * smooth((0.62 - Math.abs(angle)) / 0.3) * outer;
        if (a < 0.03) continue;
        const sp = bands[pieces[i + 2]!]!;
        // the band spans half the gap to the next crest: wide by the beach, narrow far out
        const h = BAND_SPAN * crestSpeed(d) * SWELL.period * (BAND.h / (BAND.h - 6)) * (0.8 + 0.2 * st);
        const off = h * (0.5 - BAND.crest / BAND.h) + pieces[i + 4]! * s;
        const g = pieces[i + 5]!;
        const gleam = g >= 0 && st > 0.5 && gleamA > 0.05 ? gleams[g]! : null;
        const gh = GLEAM.h * (0.3 + 0.7 * s);
        const ga = a * gleamA * (0.4 + 0.6 * st) * (0.35 + 0.65 * s);
        const ext = (j1 - j0) * 0.125;
        const n0 = j0 - ext;
        const n1 = j1 + ext;
        const wk = wakeOn(n0, n1, d);
        if (!wk) {
          span(ctx, sp, 0, 1, colX(n0), y0 - (y1 - y0) * 0.125, colX(n1), y1 + (y1 - y0) * 0.125, h, off, a);
          if (gleam) span(ctx, gleam, 0, 1, grid.xs[j0]!, y0, grid.xs[j1]!, y1, gh, -0.6 * s, ga);
          continue;
        }
        // in a rock's or the hull's wake: that stretch in short spans that follow the lag, thinner in its lee
        const cuts = [n0];
        if (wk.a > n0 + 0.5) cuts.push(wk.a);
        const parts = Math.max(2, Math.ceil((wk.b - wk.a) / SUB));
        for (let q = 1; q <= parts; q++) cuts.push(wk.a + ((wk.b - wk.a) * q) / parts);
        if (wk.b < n1 - 0.5) cuts.push(n1);
        const kOf = (jf: number) => (jf - n0) / (n1 - n0);
        let px = colX(n0);
        let py = crestYf(T, t, n0);
        for (let q = 1; q < cuts.length; q++) {
          const ja = cuts[q - 1]!;
          const jf = cuts[q]!;
          const x = colX(jf);
          const y = crestYf(T, t, jf);
          lagAt(Math.max(0, Math.min(cols - 1, Math.round((ja + jf) / 2))), d);
          const lee = 1 - 0.6 * shade;
          span(ctx, sp, kOf(ja), kOf(jf), px, py, x, y, h, off, a * lee);
          const g0 = Math.max(ja, j0);
          const g1 = Math.min(jf, j1);
          if (gleam && g1 > g0 && shade < 0.15) span(ctx, gleam, (g0 - j0) / (j1 - j0), (g1 - j0) / (j1 - j0), colX(g0), crestYf(T, t, g0), colX(g1), crestYf(T, t, g1), gh, -0.6 * s, ga * lee * lee);
          px = x;
          py = y;
        }
      }
    }
  };

  /** the light on the water: a road of glints under a low sun or the moon, a few scattered at noon */
  const drawGlints = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null, light: DaylightState | null) => {
    const w = light?.weights;
    const pSun = w ? w.sunrise + w.sunset : 0;
    const moon = light ? moonDisc(light, COAST_SKY_LAYOUT) : null;
    const pMoon = moon && light ? moon.alpha * (0.45 + 0.55 * Math.sin(Math.PI * light.moonPhase)) * 0.7 : 0;
    const pNoon = (w ? w.midday : 1) * 0.3;
    if (pSun + pMoon + pNoon < 0.01) return;
    const sunX = light && pSun > 0 ? sunDisc(light, COAST_SKY_LAYOUT).x : 0;
    for (const [i, b] of sparkles.entries()) {
      const time = t + b.phase;
      const c = Math.floor(time / b.cycle);
      const age = time - c * b.cycle;
      const life = 0.5 + 0.9 * pick(b.table, c, 1);
      if (age > life) continue;
      const u = pick(b.table, c, 0);
      const kind = u < pSun ? 0 : u < pSun + pMoon ? 1 : u < pSun + pMoon + pNoon ? 2 : -1;
      if (kind < 0) continue;
      const u2 = pick(b.table, c + 11, 0);
      const u3 = pick(b.table, c + 11, 1) + pick(b.table, c + 11, 2) - 1;
      let x: number;
      let y: number;
      if (kind === 2) {
        y = HORIZON + 50 + 320 * u2 ** 0.75;
        x = -40 + (690 * (u3 + 1)) / 2;
      } else {
        y = HORIZON + 2 + 340 * u2 ** 1.8;
        const sc = seaScale(y);
        x = (kind === 0 ? sunX : moon!.x) + u3 * (kind === 0 ? 4 + 70 * sc ** 1.1 : 3 + 50 * sc);
      }
      scratch.x = x;
      scratch.y = y;
      if (!pointInPolygon(scratch, SEA_WATER) || nearBoat(scratch) || inRock(scratch, 1)) continue;
      const s = seaScale(y);
      const v = age / life;
      const alpha = Math.sin(Math.PI * v) ** 0.8 * (0.6 + 0.4 * pick(b.table, c, 2)) * (kind === 1 ? 0.85 : kind === 2 ? 0.75 : 1);
      if (alpha < 0.02) continue;
      counts.glint++;
      marks?.push({ element: 'glint', index: i, x, y });
      if (!ctx) continue;
      const one = kind === 2 || pick(b.table, c + 5, 1) < 0.4;
      const sp = kind === 0 ? sunSparks[one ? 0 : 1]! : sparks[(one ? 0 : 2) + ((c + i) % 2)]!;
      const len = (4 + (kind === 2 ? 9 : kind === 0 ? 15 : 20) * s) * (0.6 + 0.8 * pick(b.table, c + 5, 0)) * (one ? 1 : 1.6);
      blit(ctx, sp, x, y, len, ((len * sp.h) / sp.w) * (0.6 + 0.4 * s), alpha * outer);
    }
  };

  /** the light netting the sandy shallows: two tiles of lines sliding apart, slowly breathing */
  const patterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern | null>();
  const netMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const CAUSTIC_AT: Pt = { x: 300, y: 720 };
  const drawCaustics = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null, light: DaylightState | null) => {
    counts.caustic++;
    marks?.push({ element: 'caustic', index: 0, x: CAUSTIC_AT.x, y: CAUSTIC_AT.y });
    // only the sun nets the sand: full at noon, softer at the low suns, none at night
    const w = light?.weights;
    const sun = w ? w.midday + 0.55 * (w.sunrise + w.sunset) : 1;
    if (!ctx || !net || sun < 0.02 || typeof ctx.createPattern !== 'function') return;
    let pat = patterns.get(ctx);
    if (pat === undefined) {
      pat = ctx.createPattern(net.image, 'repeat');
      patterns.set(ctx, pat);
    }
    if (!pat) return;
    ctx.save();
    clip(ctx, 'shallows');
    ctx.fillStyle = pat;
    for (const [i, L] of NET_SCALE.entries()) {
      // the net slides, shears and stretches a little, never in step with the other
      const sx = L.x * (1 + 0.06 * Math.sin(t * 0.13 + i * 2));
      const sy = L.y * (1 + 0.08 * Math.sin(t * 0.17 + i * 4));
      netMatrix.a = sx;
      netMatrix.d = sy;
      netMatrix.c = 0.05 * Math.sin(t * 0.09 + i * 3) * sx;
      netMatrix.e = (t * L.vx) % (NET * sx);
      netMatrix.f = (t * L.vy) % (NET * sy);
      pat.setTransform(netMatrix);
      ctx.globalAlpha = L.a * sun * (0.7 + 0.3 * Math.sin(t * 0.29 + i * 1.9)) * outer;
      ctx.fillRect(SHALLOWS_BOX.x, SHALLOWS_BOX.y, SHALLOWS_BOX.w, SHALLOWS_BOX.h);
    }
    ctx.restore();
  };

  /** how far up a crest has brought the water at a rock or a run of the cliff: 0 drawn back, 1 full */
  const surge = (lift: number) => smooth((lift + 0.55) / 1.5);

  const drawRocks = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null) => {
    for (const [i, rock] of WET_ROCKS.entries()) {
      const sw = swellAt(rockDepth[i]!, rock.x, t, phase);
      const s = surge(sw.lift);
      counts.foam++;
      marks?.push({ element: 'foam', index: i, x: rock.x, y: rock.y });
      // the crest leaves a ring spreading round the rock's foot
      const v = sw.since / RING_LIFE;
      const ringA = v < 1 ? 0.7 * crestStrength(sw.n) * smooth(v / 0.12) * (1 - v) ** 1.6 : 0;
      if (ringA > 0.01) {
        counts.swirl++;
        marks?.push({ element: 'swirl', index: i, x: rock.x, y: rockFoot[i]! + 1 });
      }
      if (!ctx) continue;
      const sp = rockFoam[i]!;
      // it rises up the foot and swells out as the crest goes by, and falls back
      const g = 1 + 0.09 * s;
      ctx.save();
      ctx.transform(g, 0, 0, 1, rock.x * (1 - g), 2.2 * s - 1.2 * sw.lift);
      place(ctx, sp, 0, 0, (0.3 + 0.65 * s) * outer);
      ctx.restore();
      if (ringA > 0.01) {
        const width = rock.w * (1.05 + 1.2 * (1 - (1 - v) ** 1.5));
        const ring = rings[0]!;
        const rw = (ring.w * width) / 40;
        blit(ctx, ring, rock.x, rockFoot[i]! + 1 + 2 * v, rw, (ring.h * rw) / ring.w, ringA * outer);
      }
    }
    for (const [i, at] of lapAt.entries()) {
      const s = surge(swellAt(at.d, at.x, t + at.lag, phase).lift);
      const cliff = i >= LIPS.length;
      counts.lap++;
      marks?.push({ element: 'lap', index: i, x: at.x, y: at.y });
      if (ctx) place(ctx, laps[i]!, cliff ? 0 : -1.2 * s, (cliff ? 1.8 : 0.6) * s, (0.12 + 0.62 * s) * outer);
    }
  };

  /** a ring spreading from the hull as a good crest lifts it */
  const drawRings = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null) => {
    const sw = swellAt(boatDepth, CAIQUE.x, t, phase);
    if (crestStrength(sw.n) < 0.55) return;
    const v = sw.since / 7;
    if (v > 1) return;
    const width = 80 + 90 * (1 - (1 - v) ** 1.6);
    const alpha = smooth(v / 0.15) * (1 - v) ** 1.5 * 0.7;
    if (alpha < 0.01) return;
    const x = CAIQUE.x - 4;
    const y = CAIQUE.y + 1.5;
    counts.ring++;
    marks?.push({ element: 'ring', index: 0, x, y });
    if (!ctx) return;
    const sp = rings[width < 110 ? 1 : 2]!;
    const ref = width < 110 ? 80 : 150;
    const w = (sp.w * width) / ref;
    blit(ctx, sp, x, y, w, (w * sp.h) / sp.w, alpha * outer);
  };

  /** the shore break: a crest forms a white lip out on the water, runs up the shingle, pauses, slides back; the wet sand it leaves dries */
  /** when crest `n` reaches reach `i`: its place along the beach, and a small stagger of its own, so the line arrives in sections */
  const reachTime = (n: number, i: number) => arrival(n) + reachDelay[i]! + STAGGER * (staggers[(((n * REACHES + i) % staggers.length) + staggers.length) % staggers.length]! - 0.5);
  const drawFoam = (ctx: CanvasRenderingContext2D | null, t: number, outer: number, marks: Mark[] | null) => {
    for (let i = 0; i < REACHES; i++) {
      let n = latest(t - reachDelay[i]!);
      if (reachTime(n + 1, i) <= t) n++;
      else if (reachTime(n, i) > t) n--;
      const tau = t - reachTime(n, i);
      const st = crestStrength(n);
      const reach = Math.min(reachLimit[i]!, 9 + 15 * st);
      const k = tau < RUN ? 1 - (1 - tau / RUN) ** 2 : tau < RUN + HOLD ? 1 : 1 - smooth((tau - RUN - HOLD) / BACK);
      const next = t - reachTime(n + 1, i);
      const mid = reachMid[i]!;
      counts.wavelet++;
      marks?.push({ element: 'wavelet', index: i, x: mid.x, y: mid.y + reach * k });
      const forming = next > -FORM;
      const u = forming ? 1 + next / FORM : 0;
      const out = BREAKER_OUT * (1 - u) ** 1.3;
      if (forming) {
        counts.breaker++;
        marks?.push({ element: 'breaker', index: i, x: mid.x, y: mid.y - out });
      }
      const f = foam[i];
      if (!ctx || !f) continue;
      // the lip rises out on the water, whitening as it comes
      if (forming) place(ctx, breakers[i]!, 0, -out, Math.min(1, 0.45 + crestStrength(n + 1)) * smooth(u / 0.3) * (0.6 + 0.4 * u) * outer);
      const wet = (0.4 + 0.5 * st) * smooth((tau - RUN * 0.5) / (RUN * 0.6)) * (1 - smooth((tau - RUN - HOLD) / DRY));
      if (wet > 0.01) place(ctx, f.wet, 0, reach - 1, wet * outer);
      if (k > 0.02) place(ctx, f.film, 0, reach * k, 0.95 * smooth(k / 0.3) * outer);
      // it pitches into broken white water that rides the sheet's front and thins as it climbs
      const boreA = smooth((tau + 0.3) / 0.4) * (1 - smooth((tau - 0.3) / (RUN * 0.9)));
      if (boreA > 0.01) place(ctx, bores[i]!, 0, reach * k, Math.min(1, 0.55 + st) * boreA * outer);
      // the lip runs on as the sheet's leading edge and thins as it stops
      if (tau < RUN + HOLD) place(ctx, breakers[i]!, 0, reach * k, Math.min(1, 0.5 + st) * (1 - 0.4 * smooth(tau / (RUN + HOLD))) * outer);
      // the lace rides up, is left at the turn and breaks up there as the sheet slides away from it
      const lace = tau < RUN + HOLD ? 0.6 + 0.4 * Math.min(1, tau / 0.4) : 0.15 + 0.6 * k ** 1.2;
      place(ctx, f.lace, 0, reach * k, st * lace * outer);
      const leftA = tau < RUN + HOLD ? 0 : smooth((tau - RUN - HOLD) / 0.5) * (1 - smooth((tau - RUN - HOLD - 0.4) / LEFT));
      if (leftA > 0.01) place(ctx, f.left, 0, reach, (0.35 + 0.65 * st) * leftA * outer);
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

  const frame = (ctx: CanvasRenderingContext2D | null, t: number, view: Rect | null, marks: Mark[] | null, light: DaylightState | null): Counts => {
    const outer = ctx ? ctx.globalAlpha : 1;
    for (const key in counts) counts[key as Mark['element']] = 0;
    if (ctx && typeof ctx.getTransform === 'function') {
      const m = ctx.getTransform();
      base.a = m.a;
      base.b = m.b;
      base.c = m.c;
      base.d = m.d;
      base.e = m.e;
      base.f = m.f;
    }
    if (meets(view, MOTION_BOXES.sea)) {
      if (ctx) {
        ctx.save();
        clip(ctx, 'sea');
        clip(ctx, 'dry');
      }
      if (meets(view, SHALLOWS_BOX)) drawCaustics(ctx, t, outer, marks, light);
      drawSea(ctx, t, outer, marks, light);
      drawRocks(ctx, t, outer, marks);
      drawGlints(ctx, t, outer, marks, light);
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
      yield* buildGrid();
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
    draw(ctx, t, light) {
      if (!ready) return;
      const view = viewOf(ctx);
      // what perches on the boat rides it (ADR 0373)
      caiquePose(t, COAST_CARRIERS.caique!.pose);
      if (!meets(view, MOTION_BOUNDS)) return;
      frame(ctx, t, view, null, light ?? null);
    },
    marksAt(t, light) {
      const marks: Mark[] = [];
      frame(null, t, null, marks, light ?? null);
      return marks;
    },
    crestAt(n, t, x, part = true) {
      const xs = grid.xs;
      parted = part;
      const y = crestYf(arrival(n), t, Math.max(0, Math.min(xs.length - 1, (x - xs[0]!) / (xs[1]! - xs[0]!))));
      parted = true;
      return y;
    },
    obstacleDepths() {
      return obstacles.map((o) => o.d);
    },
    visibleAt(t, light) {
      return { ...frame(null, t, null, null, light ?? null) };
    },
    sprites() {
      const all: Record<string, Sprite[]> = {
        light: lights, trough: troughSprites, band: bands, spark: sparks, 'sun-spark': sunSparks, net: net ? [net] : [], ring: rings, 'pool-ring': poolRing,
        gleam: gleams, breaker: breakers, bore: bores, lace: foam.map((f) => f.lace), left: lefts, wet: foam.map((f) => f.wet), film: foam.map((f) => f.film),
        'rock-foam': rockFoam, lap: laps,
        boat: [boat.plate, boat.light, boat.dark, boat.hull, boat.buoy].filter((s): s is Sprite => !!s),
      };
      return Object.entries(all).flatMap(([kind, list]) => list.map((sp) => ({ kind, image: sp.image, w: sp.w, h: sp.h })));
    },
  };
}

const ROPE = rgba(BOAT.rope);
/** a low sun's glint: its flare and the warm shade under it */
const SUN_GOLD = '#ffd27a';
const SUN_SHADE = '#5a4a52';
