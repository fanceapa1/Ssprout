/**
 * The oasis's water (O3): the stone basin with its steps and sluice gate, the clay-lined seguia
 * with its small falls over the terrace walls, and the shallow, braided oued over gold sand.
 * Painted on white in world units, in parts (ADR 0226, 0238). docs/systems/scenery.md › Oasis › Water.
 */
import type { Rng } from '../../core/rng';
import { PAPER_WHITE, blob, bounds, insetPolygon, lighten, mix, pathNormals, pointInPolygon, resample, rgba, ribbon, shade, smoothPath, type Painter, type Pigment } from '../../paint';
import type { Pt, Rect } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { BASIN_STONE, BASIN_WATER, OUED_WATER, SEGUIA, SLUICE_WATER, WATERLINE } from './geometry';
import { BAR, BASIN, BASIN_RIM, OUED, SEGUIA_FALLS, SEGUIA_RUNS, SLUICE, WALLS, copingAt, silhouetteAt, towardVp } from './layout';
import { EARTH } from './paint-rocks';

/** The water's palette: turquoise-teal shading to green-brown in the basin, milky in the oued. */
export const WATER = {
  light: '#9fd3c8',
  turquoise: '#5fb3ad',
  teal: '#3f8f8f',
  deep: '#2f6a68',
  // the basin's depths, where the teal goes green-brown
  murk: '#5e6a48',
  milk: '#c6e2df',
  milkMid: '#98c8ca',
  foam: '#d9eee8',
} satisfies Record<string, Pigment>;

/** The basin's dressed stone and lime-washed pisé, and the wet clay of the channels. */
export const STONE = {
  coping: '#ecd8b0',
  face: '#c99c78',
  faceShade: '#9e7a76',
  near: '#d2a983',
  joint: '#9a6a52',
  wet: '#6a5546',
  algae: '#7d8452',
  clay: '#c08a62',
  clayWet: '#8a5c46',
  sand: '#e6c88e',
  sandWet: '#b98f68',
  wood: '#7a5a42',
  woodLit: '#b48d64',
} satisfies Record<string, Pigment>;

const [FL, FR, NR, NL] = BASIN as readonly [Pt, Pt, Pt, Pt];
const [WFL, WFR, WNR, WNL] = BASIN_WATER as unknown as readonly [Pt, Pt, Pt, Pt];
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** The reflection's squeeze, and the height its rock and walls mirror about (the bluff's foot). */
const REFLECTION_SQUEEZE = 0.17;
const REFLECTION_FOOT = 470;

/** The coping's inner edge: the far and side walls show an inner face below it, the near one does not. */
const LIP: Pt[] = [lerp(FL, WFL, 0.45), lerp(FR, WFR, 0.45), lerp(NR, WNR, 0.75), lerp(NL, WNL, 0.75)];

/**
 * The coping's, near face's and water's washes, each clipped to its shape. A wash resamples its
 * outline about every 1/24 of its perimeter, which cut the corners off, so they run 36 past them.
 */
export const RIM_WASHES = (() => {
  const [s3, s4] = [BASIN_STONE[3]!, BASIN_STONE[4]!];
  const run = 36;
  return {
    stone: [{ x: FL.x - run, y: FL.y - 8 }, { x: FR.x + run, y: FR.y - 8 }, { x: NR.x + run, y: NR.y - 4 }, { x: s3.x + run, y: s3.y + 6 }, { x: s4.x - run, y: s4.y + 6 }, { x: NL.x - run, y: NL.y - 4 }],
    face: [{ x: NL.x - run, y: NL.y - 5 }, { x: NR.x + run, y: NR.y - 5 }, { x: s3.x + run, y: s3.y + 5 }, { x: s4.x - run, y: s4.y + 5 }],
    water: BASIN_WATER.map((q, i) => ({ x: q.x + (i === 0 || i === 3 ? -run : run), y: q.y + (i < 2 ? -10 : 10) })),
  };
})();

/** A point on the right wall's water edge, `t` from the far corner to the near one. */
const rightWall = (t: number): Pt => lerp(WFR, WNR, t);

/** The steps down into the water, against the right wall near its far corner: tread, riser, how deep. */
export const BASIN_STEPS: readonly { tread: Pt[]; riser: Pt[]; depth: number }[] = (() => {
  const out: { tread: Pt[]; riser: Pt[]; depth: number }[] = [];
  const rise = 4;
  for (let k = 0; k < 5; k++) {
    const a = rightWall(0.07 + k * 0.085);
    const b = rightWall(0.07 + (k + 1) * 0.085);
    const d = 34 - k * 1.5;
    const y = k * rise - 3;
    out.push({
      tread: [{ x: a.x + 3, y: a.y + y }, { x: b.x + 3, y: b.y + y }, { x: b.x - d, y: b.y + y }, { x: a.x - d, y: a.y + y }],
      riser: [{ x: b.x + 3, y: b.y + y }, { x: b.x - d, y: b.y + y }, { x: b.x - d, y: b.y + y + rise }, { x: b.x + 3, y: b.y + y + rise }],
      depth: k - 1.5,
    });
  }
  return out;
})();

/** A point on the board's outer side carried `d` down the sluice's head. */
const down = (q: Pt, d: number): Pt => {
  const [a, b] = [SLUICE[0]!, SLUICE[1]!];
  const n = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: q.x + 5 + ((b.x - a.x) / n) * d, y: q.y + ((b.y - a.y) / n) * d };
};
const FOAM_DOWN = 10;

/**
 * The sluice gate near the overflow corner: a cut through the right coping between `t0` and `t1`
 * along the wall, an upright stone post either side, and the board standing in their slots.
 */
export const SLUICE_GATE = (() => {
  const [t0, t1] = [0.78, 0.955];
  const inner = (t: number) => lerp(WFR, WNR, t);
  const outer = (t: number) => lerp(FR, NR, t);
  const mid = (t: number) => lerp(inner(t), outer(t), 0.55);
  const post = (t: number): Pt[] => {
    const c = mid(t);
    return [{ x: c.x - 4, y: c.y - 10 }, { x: c.x + 4, y: c.y - 10 }, { x: c.x + 4.5, y: c.y + 3 }, { x: c.x - 4.5, y: c.y + 3 }];
  };
  const [b0, b1] = [mid(t0 + 0.005), mid(t1 - 0.005)];
  return {
    cut: [inner(t0), outer(t0), outer(t1), inner(t1)],
    posts: [post(t0 - 0.025), post(t1 + 0.025)],
    board: [{ x: b0.x - 1.5, y: b0.y - 4 }, { x: b0.x + 2, y: b0.y - 4 }, { x: b1.x + 2, y: b1.y + 1 }, { x: b1.x - 1.5, y: b1.y + 1 }],
    /** the thin spill over the board, on its outer side */
    spill: [{ x: b0.x + 2, y: b0.y - 3 }, { x: b0.x + 5, y: b0.y - 2 }, { x: b1.x + 5, y: b1.y + 2 }, { x: b1.x + 2, y: b1.y + 1 }],
    /** where the spill's foam lies: across the sluice's head, a little downstream of the spill, clear of the posts */
    foam: [down(lerp(b0, b1, 0.05), FOAM_DOWN), down(lerp(b0, b1, 0.8), FOAM_DOWN)] as [Pt, Pt],
  };
})();

/** Where the seguia's last fall enters the basin: a notch through the left coping. */
export const BASIN_INLET = { from: { x: 514, y: 604 }, to: { x: towardVp(NL.x + BASIN_RIM.side, 602) + 10, y: 602 } };
const INLET = BASIN_INLET;

/** A fall's half-width `k` down it: the channel's water at the lip, spreading as the sheet breaks into strands. */
export const fallHalf = (k: number): number => 6.5 + 3 * k * k;

/** A small fall's sheet over a terrace wall: a little wider at its foot. */
export function fallSheet(f: (typeof SEGUIA_FALLS)[number]): Pt[] {
  const { x, y } = f.top;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const w = fallHalf(t) + Math.sin(t * 9) * 0.6;
    left.push({ x: x - w, y: y - 1 + (f.drop + 1) * t });
    right.push({ x: x + w + Math.sin(t * 7 + 1) * 0.6, y: y - 1 + (f.drop + 1) * t });
  }
  return [...left, ...right.reverse()];
}

/** The oued's two banks, resampled to the same count, upstream first: left (outer) and right. */
const BANKS = (() => {
  const left = resample(smoothPath(OUED.slice(0, 8), 6), 6);
  const right = resample(smoothPath(OUED.slice(8).reverse(), 6), 6);
  const n = 48;
  const at = (path: readonly Pt[], t: number) => path[Math.min(path.length - 1, Math.round(t * (path.length - 1)))]!;
  return Array.from({ length: n + 1 }, (_, i) => [at(left, i / n), at(right, i / n)] as const);
})();

/** A point in the oued: `s` along it (0 upstream … 1 at the viewer's feet), `u` across (0 left bank, 1 right). */
export function ouedAt(s: number, u: number): Pt {
  const f = Math.max(0, Math.min(1, s)) * (BANKS.length - 1);
  const i = Math.min(BANKS.length - 2, Math.floor(f));
  const k = f - i;
  const [l0, r0] = BANKS[i]!;
  const [l1, r1] = BANKS[i + 1]!;
  return lerp(lerp(l0, r0, u), lerp(l1, r1, u), k);
}

/** A strip of the oued between `u0(s)` and `u1(s)`, from `s0` to `s1`. */
function ouedStrip(s0: number, s1: number, u0: (s: number) => number, u1: (s: number) => number): Pt[] {
  const a: Pt[] = [];
  const b: Pt[] = [];
  for (let s = s0; s <= s1 + 1e-6; s += 0.025) {
    a.push(ouedAt(s, u0(s)));
    b.push(ouedAt(s, u1(s)));
  }
  return [...a, ...b.reverse()];
}

/** The oued's sand bars: the big one on the inside of the bend, a sliver upstream, one near the viewer. */
export const OUED_BARS: readonly Pt[][] = [
  // the layout's bar (the slots keep off it), its head blunt upstream and its tail drawn out
  Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    const k = 0.96 + 0.04 * Math.sin(a * 5) - 0.06 * Math.max(0, -Math.sin(a));
    return { x: BAR.cx + BAR.rx * k * Math.cos(a) * (1 - 0.3 * Math.max(0, Math.sin(a)) ** 2), y: BAR.cy + BAR.ry * k * Math.sin(a) * (1 + 0.12 * Math.max(0, Math.sin(a))) };
  }),
  ouedStrip(0.14, 0.3, (s) => 0.58 + 0.9 * (s - 0.22) ** 2 * 10, (s) => 0.7 - 0.9 * (s - 0.22) ** 2 * 10),
  ouedStrip(0.84, 1.02, (s) => 0.7 + 1.2 * (s - 0.94) ** 2 * 10, (s) => 0.92 - 0.5 * (s - 0.94) ** 2 * 10),
];

/** The boxes later tasks plate and animate: the basin, each fall, the oued (O5 daylight, O6 motion). */
export const WATER_BOXES: { basin: Rect; falls: Rect[]; oued: Rect; gate: Rect } = {
  basin: bounds(BASIN_STONE),
  falls: SEGUIA_FALLS.map((f) => {
    const b = bounds(fallSheet(f));
    return { x: b.x - 6, y: b.y, w: b.w + 12, h: b.h + 10 };
  }),
  oued: bounds(OUED_WATER),
  gate: bounds(SLUICE_GATE.cut),
};

/** The shapes daylight and motion read: the water inside the coping, the rim, the falls, the oued and its bars. */
export const WATER_SHAPES = {
  basin: BASIN_WATER,
  rim: BASIN_STONE,
  steps: BASIN_STEPS,
  gate: SLUICE_GATE,
  falls: SEGUIA_FALLS.map(fallSheet),
  seguia: SEGUIA,
  sluice: SLUICE_WATER,
  oued: OUED_WATER,
  bars: OUED_BARS,
} as const;

function trace(p: Painter, shapes: readonly (readonly Pt[])[], outside = false): void {
  p.ctx.beginPath();
  if (outside) p.ctx.rect(-1e4, -1e4, 2e4, 2e4);
  for (const shape of shapes) {
    shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
    p.ctx.closePath();
  }
}

/** Paper over `shape`, so nothing painted earlier shows through it. */
function fillPaper(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  trace(p, [shape]);
  p.ctx.fillStyle = rgba(PAPER_WHITE);
  p.ctx.fill();
  p.ctx.restore();
}

/** Clip what follows to `shapes` (or, `outside`, to everything but them) until `p.ctx.restore()`. */
function clipTo(p: Painter, shapes: readonly (readonly Pt[])[], outside = false): void {
  p.ctx.save();
  trace(p, shapes, outside);
  p.ctx.clip(outside ? 'evenodd' : 'nonzero');
}

/** A thin horizontal lifted line (a glint or a break in a reflection). */
function* glint(p: Painter, rng: Rng, cx: number, cy: number, w: number, amount: number): Strokes {
  yield* p.parts.lift({ cx, cy, rx: w / 2, ry: rng.range(0.7, 1.4) }, { rng, amount, deform: 0.25, spread: 0.3, layers: 4 });
}

// ── the basin ─────────────────────────────────────────────────────────────────────────────

/**
 * The basin: a lime-washed coping of dressed stone, warm on top and darker on its inner faces,
 * wet-stained at the waterline; deep turquoise water going green-brown in its depths, the red
 * bluff and the ksar reflected soft and broken; the steps, the inlet's ripples and the sluice gate.
 */
export function* paintBasin(p: Painter, rng: Rng): Strokes {
  yield* paintRim(p, rng.fork('rim'));
  yield* paintBasinWater(p, rng.fork('water'));
  yield* paintSteps(p, rng.fork('steps'));
  yield* paintGate(p, rng.fork('gate'));
}

function* paintRim(p: Painter, rng: Rng): Strokes {
  fillPaper(p, BASIN_STONE);
  // washes run past the stone and are clipped to it, so no paper is left at its corners
  clipTo(p, [BASIN_STONE]);
  // the coping: a pale lime wash, warm and granular
  yield* p.parts.wash(RIM_WASHES.stone, STONE.coping, { rng, opacity: 0.7, deform: 0.02, spread: 0.02, layers: 8, edge: 0.3, sharpness: 0.8, granulation: 0.6, granules: 0.2 });
  yield;
  // the near outer face, toward the viewer: warmer and darker, shade gathering at its foot
  yield* p.parts.wetInWet(RIM_WASHES.face, STONE.near, mix(STONE.face, EARTH.shade, 0.35), { rng, angle: Math.PI / 2, split: 0.45, opacity: 0.75, deform: 0.02, spread: 0.02, edge: 0.3, sharpness: 0.8, granulation: 0.5 });
  yield;
  // the inner faces under the coping: the far one in soft shade, the left lit by the sun, the right turned away
  p.ctx.restore();
  yield* p.parts.wash([LIP[0]!, LIP[1]!, WFR, WFL], STONE.face, { rng, opacity: 0.7, deform: 0.03, spread: 0.03, layers: 8, edge: 0.3, sharpness: 0.7, granulation: 0.5 });
  yield;
  yield* p.parts.wash([LIP[0]!, WFL, WNL, LIP[3]!], mix(STONE.face, STONE.coping, 0.45), { rng, opacity: 0.6, deform: 0.03, spread: 0.03, layers: 8, edge: 0.25, sharpness: 0.7, granulation: 0.5 });
  yield;
  yield* p.parts.wash([WFR, LIP[1]!, LIP[2]!, WNR], mix(STONE.face, STONE.faceShade, 0.45), { rng, opacity: 0.55, deform: 0.03, spread: 0.03, layers: 8, edge: 0.3, sharpness: 0.7, granulation: 0.5 });
  yield;
  // the dressed stones: joints across the coping, wider apart toward the viewer, and the courses of the near face
  // joints run square to each wall: upright across the far and near copings, level across the sides
  const jointAcross = (q0: Pt, q1: Pt, width: number) =>
    p.dryBrush([q0, q1], { rng, pigment: STONE.joint, width, opacity: rng.range(0.3, 0.5), dryness: 0.35 });
  for (const [a, b, c, w, step] of [[FL, FR, LIP[0]!, 1, [0.04, 0.065]], [NL, NR, LIP[3]!, 1.6, [0.045, 0.075]]] as const) {
    for (let t = rng.range(0.02, 0.05); t < 0.97; t += rng.range(step[0], step[1])) {
      const q = lerp(a, b, t);
      jointAcross({ x: q.x, y: q.y + 1 }, { x: q.x, y: c.y - 0.5 }, w);
    }
    yield;
  }
  for (const [outer0, outer1, inner0, inner1] of [[FL, NL, LIP[0]!, LIP[3]!], [FR, NR, LIP[1]!, LIP[2]!]] as const) {
    for (let t = rng.range(0.05, 0.1); t < 0.95; t += rng.range(0.1, 0.16)) {
      const o = lerp(outer0, outer1, t);
      const i = lerp(inner0, inner1, (o.y - inner0.y) / (inner1.y - inner0.y));
      jointAcross({ x: o.x + Math.sign(i.x - o.x), y: o.y }, { x: i.x, y: o.y }, 1.3);
    }
    yield;
  }
  const fb = BASIN_STONE[4]!;
  for (let x = NL.x + rng.range(10, 30); x < NR.x - 10; x += rng.range(30, 52)) {
    p.stroke([{ x, y: NL.y + 2 }, { x: x + rng.range(-1, 1), y: fb.y - 1 }], { rng, pigment: STONE.joint, width: 1.6, opacity: 0.4, wetness: 0.15, taper: [0.05, 0.1] });
  }
  p.dryBrush([{ x: NL.x + 4, y: NL.y + 9 }, { x: NR.x - 4, y: NR.y + 9 }], { rng, pigment: STONE.joint, width: 1.4, opacity: 0.3, dryness: 0.5 });
  yield;
  // the lit outer arris of the coping, and its shade line where it overhangs the inner face
  p.dryBrush([lerp(FL, FR, 0.01), lerp(FL, FR, 0.99)].map((q) => ({ x: q.x, y: q.y + 1.5 })), { rng, pigment: lighten(STONE.coping, 0.3), width: 2.5, opacity: 0.6, dryness: 0.4, blend: 'source-over' });
  p.dryBrush([lerp(NL, NR, 0.01), lerp(NL, NR, 0.99)].map((q) => ({ x: q.x, y: q.y + 1.5 })), { rng, pigment: lighten(STONE.coping, 0.35), width: 3, opacity: 0.65, dryness: 0.4, blend: 'source-over' });
  for (const [a, b] of [[LIP[0]!, LIP[1]!], [LIP[1]!, LIP[2]!], [LIP[3]!, LIP[0]!]] as const) {
    p.stroke([a, lerp(a, b, 0.5), b], { rng, pigment: mix(STONE.joint, EARTH.shade, 0.3), width: 1.4, opacity: 0.45, wetness: 0.2, wobble: 0.3, taper: [0.05, 0.05] });
  }
  yield;
  // the ground's cast shade along the foot of the near face
  const foot: Pt[] = [BASIN_STONE[4]!, BASIN_STONE[3]!, { x: BASIN_STONE[3]!.x + 10, y: BASIN_STONE[3]!.y + 10 }, { x: BASIN_STONE[4]!.x + 4, y: BASIN_STONE[4]!.y + 10 }];
  yield* p.parts.glaze(foot, mix(EARTH.shade, STONE.joint, 0.4), { rng, opacity: 0.35, deform: 0.2, spread: 0.2, fade: { angle: Math.PI / 2, start: 0.2, amount: 1 } });
  yield;
  // the inlet's notch through the left coping
  const notch = ribbon([INLET.from, INLET.to], () => 4.5);
  yield* p.parts.wash(notch, STONE.wet, { rng, opacity: 0.55, deform: 0.05, spread: 0.05, layers: 5, edge: 0.3, sharpness: 0.7 });
  yield;
}

function* paintBasinWater(p: Painter, rng: Rng): Strokes {
  const water = BASIN_WATER;
  const b = bounds(water);
  fillPaper(p, water);
  clipTo(p, [water]);
  // the body: turquoise under the far wall going deep teal toward the near rim, green-brown in the depths
  yield* p.parts.wetInWet(RIM_WASHES.water, WATER.turquoise, WATER.deep, { rng, angle: Math.PI / 2, split: 0.45, softness: 0.6, fingers: 0.5, opacity: 0.75, deform: 0.04, spread: 0.04, edge: 0.1, granulation: 0.3, flow: 0.5, flowScale: 90 });
  yield;
  yield* p.parts.glaze(blob(b.x + b.w * 0.5, b.y + b.h * 0.8, b.w * 0.5, b.h * 0.4, rng, { irregularity: 0.15, points: 24 }), WATER.murk, { rng, opacity: 0.3, deform: 0.2, spread: 0.5, edge: 0, sharpness: 0.02, centreLift: 0, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.5 } });
  yield;
  // the reflection, as a low eye sees it: the bluff, the ksar and the grove mirrored about their
  // feet and squeezed, so the towers' tops fall near the near rim and little sky shows between them
  const k = REFLECTION_SQUEEZE;
  const xs: number[] = [];
  for (let x = b.x - 4; x <= b.x + b.w + 4; x += 6) xs.push(x);
  const under = (y: number) => WATERLINE + (REFLECTION_FOOT - y) * k;
  const bluffLine = (x: number) => (x < 1024 ? Math.max(silhouetteAt(x), 312) : REFLECTION_FOOT);
  const bluff: Pt[] = [...xs.map((x) => ({ x, y: WATERLINE - 4 })), ...xs.slice().reverse().map((x) => ({ x: x + rng.range(-1.5, 1.5), y: under(bluffLine(x)) + 1 }))];
  // the teal lifted where the warm rock lies on the water, so the red reads rather than greys
  yield* p.parts.lift(bluff, { rng, amount: 0.8, deform: 0.1, spread: 0.18, layers: 5, edge: 0, fade: { angle: Math.PI / 2, start: 0.8, amount: 0.4, ragged: 0.9 } });
  yield;
  yield* p.parts.glaze(bluff, mix(mix(EARTH.body, EARTH.deep, 0.3), WATER.teal, 0.1), { rng, opacity: 0.75, deform: 0.14, spread: 0.3, edge: 0.03, fade: { angle: Math.PI / 2, start: 0.75, amount: 0.5, ragged: 0.9 } });
  yield;
  // level breaks across the mirrored rock, so it reads as water and not as a wall
  for (let i = 0; i < 9; i++) {
    const y = WATERLINE + 3 + rng.range(0, 1) ** 1.3 * (under(312) - WATERLINE);
    yield* glint(p, rng, rng.range(b.x + 20, b.x + b.w - 20), y, rng.range(60, 160), rng.range(0.25, 0.4));
  }
  yield;
  const towers = xs.filter((x) => x > 420 && x < 920);
  const ksar: Pt[] = [...towers.map((x) => ({ x, y: under(bluffLine(x)) - 2 })), ...towers.slice().reverse().map((x) => ({ x, y: under(Math.min(silhouetteAt(x), bluffLine(x))) }))];
  yield* p.parts.lift(ksar, { rng, amount: 0.6, deform: 0.08, spread: 0.12, layers: 4, edge: 0 });
  yield* p.parts.glaze(ksar, mix(mix(EARTH.gold, EARTH.body, 0.4), WATER.teal, 0.1), { rng, opacity: 0.62, deform: 0.1, spread: 0.25, edge: 0.03, fade: { angle: Math.PI / 2, start: 0.6, amount: 0.6, ragged: 0.9 } });
  yield;
  // the grove's palms on the right, dark olive in the water
  yield* p.parts.glaze(blob(b.x + b.w - 34, WATERLINE + 12, 64, 13, rng, { irregularity: 0.3 }), mix('#66714a', WATER.deep, 0.4), { rng, opacity: 0.4, deform: 0.3, spread: 0.3, fade: { angle: Math.PI / 2, start: 0.4, amount: 1, ragged: 0.8 } });
  yield;
  // the far wall's shade on the water just under it
  yield* p.parts.glaze([WFL, WFR, { x: WFR.x + 1, y: WFR.y + 4 }, { x: WFL.x + 2, y: WFL.y + 4 }], mix(WATER.deep, EARTH.dark, 0.4), { rng, opacity: 0.55, deform: 0.15, spread: 0.2, fade: { angle: Math.PI / 2, start: 0.2, amount: 1, ragged: 0.6 } });
  yield;
  // the reflection broken by slow horizontal lifts, longer toward the viewer
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    const y = WATERLINE + 4 + t * (b.h - 8) + rng.range(-2, 2);
    const w = rng.range(40, 130) * (0.6 + t * 0.8);
    const x = rng.range(b.x + 30, b.x + b.w - 30);
    yield* glint(p, rng, x, y, w, rng.range(0.18, 0.36));
    yield;
  }
  // a few dark ripple strokes in the reflection
  for (let i = 0; i < 12; i++) {
    const y = WATERLINE + rng.range(8, b.h - 6);
    const x = rng.range(b.x + 40, b.x + b.w - 40);
    const len = rng.range(16, 40);
    p.stroke([{ x: x - len / 2, y }, { x, y: y + rng.range(-1, 1) }, { x: x + len / 2, y }], { rng, pigment: shade(WATER.deep, 0.2), width: rng.range(0.8, 1.3), opacity: 0.28, wetness: 0.4, wobble: 0.5, taper: [0.4, 0.4] });
    yield;
  }
  // the slow rings where the seguia comes in
  for (const [dx, dy, w, n] of [[18, 0, 46, 3], [52, 6, 90, 2], [100, 10, 120, 2]] as const) {
    p.ripple({ x: INLET.to.x + dx, y: INLET.to.y + dy }, { rng, width: w, count: n, squash: 0.08, pigment: WATER.deep, opacity: 0.3, light: 0.75, lineWidth: 1 });
    yield;
  }
  yield* p.parts.lift(blob(INLET.to.x + 6, INLET.to.y + 1, 12, 2.5, rng, { irregularity: 0.3 }), { rng, amount: 0.6, deform: 0.3, spread: 0.3, layers: 4 });
  yield;
  p.ctx.restore();
  // wet stain at the waterline on the inner faces, a little algae green just above it
  for (const [a, c] of [[WFL, WFR], [WFL, WNL], [WFR, WNR]] as const) {
    const n = pathNormals([a, c])[0]!;
    const up = n.y < 0 ? 1 : -1;
    const band: Pt[] = [a, c, { x: c.x + n.x * 2.5 * up, y: c.y + n.y * 2.5 * up }, { x: a.x + n.x * 2.5 * up, y: a.y + n.y * 2.5 * up }];
    yield* p.parts.glaze(band, mix(STONE.wet, STONE.algae, 0.35), { rng, opacity: 0.45, deform: 0.2, spread: 0.2, layers: 6, edge: 0.1 });
    yield;
  }
}

function* paintSteps(p: Painter, rng: Rng): Strokes {
  // the flight's soft shade on the water to its left (the light comes from the upper right)
  const first = BASIN_STEPS[0]!;
  const last = BASIN_STEPS[BASIN_STEPS.length - 1]!;
  clipTo(p, [BASIN_WATER]);
  yield* p.parts.glaze([first.tread[3]!, last.tread[2]!, { x: last.tread[2]!.x - 8, y: last.tread[2]!.y + 6 }, { x: first.tread[3]!.x - 6, y: first.tread[3]!.y + 4 }], mix(WATER.deep, EARTH.shade, 0.4), {
    rng, opacity: 0.22, deform: 0.3, spread: 0.35, fade: { angle: Math.PI, start: 0.3, amount: 1 },
  });
  yield;
  for (const s of BASIN_STEPS) {
    const dry = s.depth < 0;
    // each submerged step is a paler shape under the water, tinted by it
    if (dry) {
      fillPaper(p, s.tread);
      yield* p.parts.wash(s.tread, STONE.coping, { rng, opacity: 0.7, deform: 0.02, spread: 0.02, layers: 6, edge: 0.3, sharpness: 0.8, granulation: 0.5 });
      yield* p.parts.wash(s.riser, mix(STONE.face, EARTH.shade, 0.25), { rng, opacity: 0.75, deform: 0.02, spread: 0.02, layers: 6, edge: 0.3, sharpness: 0.8, granulation: 0.4 });
    } else {
      const a = Math.max(0.25, 0.6 - s.depth * 0.14);
      yield* p.parts.lift(s.tread, { rng, amount: a, deform: 0.04, spread: 0.06, layers: 5, sharpness: 0.4 });
      yield* p.parts.glaze(s.tread, mix(WATER.turquoise, STONE.face, 0.35), { rng, opacity: 0.35, deform: 0.04, spread: 0.05, layers: 5 });
      yield* p.parts.glaze(s.riser, WATER.deep, { rng, opacity: 0.45 - s.depth * 0.05, deform: 0.04, spread: 0.05, layers: 5 });
    }
    yield;
    // the wet line where the water meets the step
    if (s.depth > -1 && s.depth < 0.6) p.stroke([s.tread[3]!, s.tread[2]!].map((q) => ({ x: q.x, y: q.y + 4 })), { rng, pigment: STONE.wet, width: 1.2, opacity: 0.45, wetness: 0.3, taper: [0.1, 0.1] });
  }
  p.ctx.restore();
  // the flight's lit front edges
  for (const s of BASIN_STEPS.filter((q) => q.depth < 0)) p.dryBrush([s.tread[3]!, s.tread[2]!].map((q) => ({ x: q.x, y: q.y + 0.5 })), { rng, pigment: lighten(STONE.coping, 0.3), width: 1.6, opacity: 0.6, dryness: 0.4, blend: 'source-over' });
  yield;
}

function* paintGate(p: Painter, rng: Rng): Strokes {
  const g = SLUICE_GATE;
  // the cut through the coping: the water held in it, darker for the depth of the cut
  fillPaper(p, g.cut);
  yield* p.parts.wetInWet(g.cut, WATER.turquoise, WATER.deep, { rng, angle: 0, split: 0.5, opacity: 0.7, deform: 0.03, spread: 0.03, edge: 0.3, sharpness: 0.7 });
  yield;
  // the board in its slots: weathered wood with a lit top, the water slipping over it in a thin pale sheet
  fillPaper(p, g.board);
  yield* p.parts.wash(g.board, STONE.wood, { rng, opacity: 0.85, deform: 0.01, spread: 0.01, layers: 5, edge: 0.4, sharpness: 0.9, granulation: 0.4 });
  p.stroke([g.board[0]!, lerp(g.board[0]!, g.board[3]!, 0.5), g.board[3]!].map((q) => ({ x: q.x + 0.5, y: q.y })), { rng, pigment: STONE.woodLit, width: 1.2, opacity: 0.8, wetness: 0.1, wobble: 0.1, taper: [0.05, 0.05] });
  // the spill: a glassy tongue over the board, its roll in teal, the sky caught along its top
  const [s0, s1, s2, s3] = g.spill as unknown as readonly [Pt, Pt, Pt, Pt];
  yield* p.parts.glaze(blob((s1.x + s2.x) / 2 + 3, (s1.y + s2.y) / 2 + 1, 9, 6, rng, { irregularity: 0.35 }), STONE.wet, { rng, opacity: 0.35, deform: 0.2, spread: 0.25, layers: 4 });
  const [c0, c1, c2, c3] = g.cut as unknown as readonly [Pt, Pt, Pt, Pt];
  yield* p.parts.wash([lerp(c0, c1, 0.6), c1, c2, lerp(c3, c2, 0.6)], mix(WATER.turquoise, WATER.teal, 0.4), { rng, opacity: 0.6, deform: 0.05, spread: 0.06, layers: 4, edge: 0.3, sharpness: 0.6 });
  yield* p.parts.lift(g.spill, { rng, amount: 0.9, deform: 0.06, spread: 0.08, layers: 4, edge: 0 });
  yield* p.parts.wash([s0, lerp(s0, s1, 0.55), lerp(s3, s2, 0.55), s3], mix(WATER.teal, WATER.deep, 0.2), { rng, opacity: 0.55, deform: 0.06, spread: 0.08, layers: 4, edge: 0.3, sharpness: 0.5 });
  yield* p.parts.lift(ribbon([lerp(s0, s1, 0.12), lerp(s3, s2, 0.12)], () => 0.45), { rng, amount: 0.95, deform: 0.1, spread: 0.1, layers: 3, sharpness: 0.5, edge: 0 });
  yield;
  // the posts: dressed stone uprights, lit on the right, the slot a dark line down each
  for (const post of g.posts) {
    yield* p.parts.glaze(post.map((q) => ({ x: q.x - 5, y: q.y + 5 })), mix(EARTH.shade, STONE.joint, 0.3), { rng, opacity: 0.35, deform: 0.2, spread: 0.2, layers: 5 });
    fillPaper(p, post);
    yield* p.parts.wetInWet(post, mix(STONE.face, EARTH.shade, 0.35), STONE.coping, { rng, angle: 0, split: 0.5, opacity: 0.8, deform: 0.02, spread: 0.02, edge: 0.4, sharpness: 0.85, granulation: 0.5 });
    p.stroke([post[0]!, post[1]!].map((q) => ({ x: q.x, y: q.y + 1 })), { rng, pigment: lighten(STONE.coping, 0.3), width: 1.4, opacity: 0.7, wetness: 0.1, taper: [0.05, 0.05], blend: 'source-over' });
    const c = lerp(post[0]!, post[2]!, 0.5);
    p.stroke([{ x: c.x, y: post[0]!.y + 2 }, { x: c.x, y: post[2]!.y - 1 }], { rng, pigment: STONE.wet, width: 1, opacity: 0.55, wetness: 0.1, taper: [0.1, 0.1] });
    yield;
  }
}

// ── the seguia ────────────────────────────────────────────────────────────────────────────

/** The side of a path whose normal points up the screen (the far bank, its inner face toward the viewer). */
function farSign(path: readonly Pt[]): number {
  const n = pathNormals(path);
  return n.reduce((a, q) => a + q.y, 0) < 0 ? 1 : -1;
}

/** `line` run on `d0` units before its start and `d1` past its end, so washes overrun the water's square ends. */
function extend(line: readonly Pt[], d0: number, d1: number): Pt[] {
  const on = (a: Pt, b: Pt, d: number): Pt => {
    const l = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    return { x: a.x + ((a.x - b.x) / l) * d, y: a.y + ((a.y - b.y) / l) * d };
  };
  return [on(line[0]!, line[1]!, d0), ...line, on(line[line.length - 1]!, line[line.length - 2]!, d1)];
}

/** Everything above a terrace wall's top edge, `dy` below it: where the run that spills over it may show. */
function aboveWall(wall: (typeof WALLS)[number], dy: number): Pt[] {
  const e = wall.edge;
  return [{ x: -1e4, y: -1e4 }, { x: 1e4, y: -1e4 }, { x: 1e4, y: e[e.length - 1]!.y + dy }, ...e.slice().reverse().map((q) => ({ x: q.x, y: q.y + dy })), { x: -1e4, y: e[0]!.y + dy }];
}

/** The wall each fall spills over, and how far below its top edge the lip lies. */
const FALL_WALLS = SEGUIA_FALLS.map((f) => {
  const wall = WALLS.find((w) => {
    const y = copingAt(w, f.top.x);
    return y !== null && Math.abs(y - f.top.y) < 6;
  })!;
  return { wall, dy: f.top.y - copingAt(wall, f.top.x)! };
});

/**
 * A clay-lined channel: the cut in the earth, the shaded far face with its lining stones, the
 * water with the far bank dark in it, the near bank's lit lip over the water's edge, dark wet
 * edges and a broken sky glint. `keep` clips it (a run ending at a fall stops at the wall's lip).
 */
function* paintChannel(p: Painter, rng: Rng, run: readonly Pt[], w: number, grow = 0, keep: readonly Pt[] | null = null): Strokes {
  const line = smoothPath(run.map((q) => ({ ...q })), 4);
  const long = extend(line, 5, keep ? 10 : 3);
  const half = (t: number) => w * (1 + grow * t);
  const far = farSign(line);
  if (keep) clipTo(p, [keep]);
  // damp clay along both banks, wider than the cut
  yield* p.parts.wash(ribbon(long, (t) => half(t) * 2.1), mix(STONE.clay, STONE.sand, 0.35), { rng, opacity: 0.4, deform: 0.12, spread: 0.12, layers: 6, edge: 0.08, granulation: 0.6, granules: 0.25, fade: { angle: rng.range(0, 6), start: 0.5, amount: 0.4, ragged: 0.8 } });
  yield;
  // the far bank's inner face, toward the viewer, in shade, lined with clay-set stones
  yield* p.parts.wash(ribbon(long, (t) => half(t) * 0.35, (t) => far * half(t) * 1.25), mix(STONE.clayWet, EARTH.shade, 0.3), { rng, opacity: 0.6, deform: 0.05, spread: 0.06, layers: 6, edge: 0.3, sharpness: 0.6, granulation: 0.4 });
  const nm = pathNormals(line);
  for (let i = 1; i < line.length - 1; i += Math.round(rng.range(2, 4))) {
    if (rng.chance(0.3)) continue;
    const t = i / (line.length - 1);
    const [q, n] = [line[i]!, nm[i]!];
    const at = (k: number): Pt => ({ x: q.x + n.x * far * half(t) * k, y: q.y + n.y * far * half(t) * k });
    p.stroke([at(1.02), at(1.5)], { rng, pigment: STONE.joint, width: rng.range(0.5, 0.8), opacity: rng.range(0.3, 0.45), wetness: 0.1, taper: [0.1, 0.2] });
  }
  yield;
  // the water; its wash runs on past the reserve's ends, so resampling its outline leaves no paper corners
  const water = ribbon(long, half);
  fillPaper(p, water);
  clipTo(p, [water]);
  yield* p.parts.wetInWet(ribbon(extend(long, 12, 12), (t) => half(t) + 3), WATER.light, WATER.teal, { rng, angle: Math.PI / 2, split: 0.5, softness: 0.6, opacity: 0.7, deform: 0.03, spread: 0.04, edge: 0.35, edgeWidth: 2, sharpness: 0.7, granulation: 0.2, flow: 0.5, flowScale: 30 });
  yield;
  // the far bank mirrored in the water: a dark, warm band under it, lost toward the middle
  yield* p.parts.glaze(ribbon(long, (t) => half(t) * 0.42, (t) => far * half(t) * 0.7), mix(WATER.deep, STONE.clayWet, 0.45), { rng, opacity: 0.5, deform: 0.08, spread: 0.12, layers: 4, edge: 0.1, fade: { angle: rng.range(0, 6), start: 0.6, amount: 0.4, ragged: 0.8 } });
  yield;
  p.ctx.restore();
  // the near bank's lip: a lit, broken edge of clay lying over the water's near edge
  yield* p.parts.wash(ribbon(long, (t) => half(t) * 0.12 + 0.45, (t) => -far * half(t) * 0.98), mix(STONE.coping, STONE.clay, 0.3), { rng, opacity: 0.75, deform: 0.08, spread: 0.08, layers: 4, edge: 0.3, sharpness: 0.8, granulation: 0.3 });
  yield;
  // the dark wet edges: the far one strong under its face, the near one a broken line under the lip
  for (const side of [far, -far]) {
    const edge = ribbon(line, () => 0.1, (t) => side * half(t) * (side === far ? 1 : 0.86)).slice(0, line.length);
    for (let i = 0; i < edge.length - 4; ) {
      const n = Math.round(rng.range(8, 24));
      const seg = edge.slice(i, i + n);
      if (seg.length > 2) p.stroke(seg, { rng, pigment: STONE.clayWet, width: rng.range(1.2, 2.2) * (1 + grow * (i / edge.length)), opacity: side === far ? 0.6 : 0.35, wetness: 0.3, wobble: 0.3, taper: [0.1, 0.1] });
      i += n + Math.round(rng.range(0, 4));
    }
    yield;
  }
  // a broken sky glint toward the near bank, and short flow marks
  for (let i = 2; i < line.length - 3; i += Math.round(rng.range(4, 9))) {
    const a = line[i]!;
    const c = line[Math.min(line.length - 1, i + 2)]!;
    const t = i / line.length;
    const o = -far * rng.range(0, 0.4) * half(t);
    yield* p.parts.lift(ribbon([a, c].map((q) => ({ x: q.x, y: q.y + o })), () => 0.9 + grow * t), { rng, amount: rng.range(0.35, 0.6), deform: 0.1, spread: 0.15, layers: 3, edge: 0 });
    yield;
  }
  if (keep) p.ctx.restore();
}

/** A strip of a fall's sheet from `u0` to `u1` across it (-1 left edge, 1 right) and `k0` to `k1` down it, tapering by `taper`. */
function fallStrip(f: (typeof SEGUIA_FALLS)[number], u0: number, u1: number, k0: number, k1: number, taper = 0, wave = 0): Pt[] {
  const { x, y } = f.top;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= 6; i++) {
    const k = k0 + ((k1 - k0) * i) / 6;
    const s = i / 6;
    const [m, w] = [(u0 + u1) / 2, ((u1 - u0) / 2) * (1 - taper * s * s)];
    const h = fallHalf(Math.max(0, k));
    const dx = wave * Math.sin(k * 11 + u0 * 5);
    left.push({ x: x + (m - w) * h + dx, y: y + f.drop * k });
    right.push({ x: x + (m + w) * h + dx, y: y + f.drop * k });
  }
  return [...left, ...right.reverse()];
}

/** The wet wall round a fall: a damp halo spreading down and past the foot, the dark face either side, moss and runnels. */
function* paintFallStain(p: Painter, rng: Rng, f: (typeof SEGUIA_FALLS)[number]): Strokes {
  const { x, y } = f.top;
  const at = (k: number) => y + f.drop * k;
  const halo: Pt[] = [];
  for (let i = 0; i <= 8; i++) halo.push({ x: x - fallHalf(i / 8) - 3 - 10 * (i / 8) ** 2, y: at((i / 8) * 1.15) });
  for (let i = 8; i >= 0; i--) halo.push({ x: x + fallHalf(i / 8) + 2 + 8 * (i / 8) ** 2, y: at((i / 8) * 1.15) });
  yield* p.parts.glaze(halo, mix(STONE.clayWet, EARTH.shade, 0.2), { rng, opacity: 0.5, deform: 0.15, spread: 0.25, layers: 6, fade: { angle: -Math.PI / 2, start: 0.35, amount: 0.7, ragged: 0.8 } });
  yield;
  for (const side of [-1, 1]) {
    // the face right behind the sheet's edge, soaked dark
    const band: Pt[] = [];
    for (let i = 0; i <= 6; i++) band.push({ x: x + side * (fallHalf(i / 6) - 0.5), y: at(i / 6) });
    for (let i = 6; i >= 0; i--) band.push({ x: x + side * (fallHalf(i / 6) + 1.2 + 3 * (i / 6)), y: at(0.08 + (i / 6) * 0.92) });
    yield* p.parts.glaze(band, STONE.wet, { rng, opacity: 0.32, deform: 0.2, spread: 0.3, layers: 5, fade: { angle: -Math.PI / 2, start: 0.4, amount: 0.8, ragged: 0.8 } });
    // a little moss where the spray never dries, low on the face
    yield* p.parts.glaze(blob(x + side * (fallHalf(0.75) + 3), at(0.78), 2.8, 5.5, rng, { irregularity: 0.4 }), mix(STONE.algae, WATER.light, 0.25), { rng, opacity: 0.32, deform: 0.35, spread: 0.35, layers: 4 });
    const rx = x + side * (fallHalf(0.5) + rng.range(3, 7));
    const k0 = rng.range(0.25, 0.5);
    p.stroke([{ x: rx, y: at(k0) }, { x: rx + rng.range(-0.8, 0.8), y: at(k0 + rng.range(0.25, 0.4)) }], { rng, pigment: STONE.wet, width: rng.range(0.6, 1), opacity: 0.2, wetness: 0.4, wobble: 0.5, taper: [0.4, 0.6] });
    yield;
  }
}

/**
 * A small fall over a terrace wall: the glassy tongue over the lip between two lining stones, a
 * sheet breaking into strands with the wet wall between them, a churned pool and white foam at the foot.
 */
function* paintFall(p: Painter, rng: Rng, f: (typeof SEGUIA_FALLS)[number]): Strokes {
  const { x, y } = f.top;
  const foot = y + f.drop;
  const TONGUE = 0.45;
  // the sheet reserved: whole under the lip, then strands with the wet wall glimpsed between
  yield* p.parts.lift(fallStrip(f, -1, 1, -0.02, TONGUE + 0.1, 0, 0.25), { rng, amount: 0.9, deform: 0.05, spread: 0.08, layers: 5, sharpness: 0.3, edge: 0 });
  for (let u = -1; u < 0.9; ) {
    const w = rng.range(0.22, 0.42);
    if (!rng.chance(0.12)) yield* p.parts.lift(fallStrip(f, u, Math.min(1, u + w), TONGUE - 0.05, rng.range(0.94, 1.04), 0.5, 0.3), { rng, amount: rng.range(0.78, 0.92), deform: 0.06, spread: 0.08, layers: 4, sharpness: 0.3, edge: 0 });
    u += w + rng.range(0.05, 0.14);
  }
  yield;
  // the tongue: the channel's turquoise carried over the lip, fading as it thins, deepest in the roll
  yield* p.parts.wash(fallStrip(f, -1, 1, -0.03, TONGUE + 0.08), WATER.turquoise, { rng, opacity: 0.55, deform: 0.05, spread: 0.08, layers: 5, edge: 0.3, sharpness: 0.5, fade: { angle: Math.PI / 2, start: 0.25, amount: 0.95, ragged: 0.6 } });
  const roll: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const u = (i / 8) * 2 - 1;
    roll.push({ x: x + u * fallHalf(0.05), y: y + 1.6 + 1.6 * (1 - u * u) });
  }
  for (let i = 8; i >= 0; i--) {
    const u = (i / 8) * 2 - 1;
    roll.push({ x: x + u * fallHalf(0.1), y: y + 3.6 + 2 * (1 - u * u) });
  }
  yield* p.parts.glaze(roll, mix(WATER.teal, WATER.deep, 0.3), { rng, opacity: 0.4, deform: 0.12, spread: 0.18, layers: 4, fade: { angle: Math.PI / 2, start: 0.5, amount: 0.7 } });
  // the side turned from the sun in cool shade
  yield* p.parts.glaze(fallStrip(f, -1, -0.45, 0.05, TONGUE + 0.1), WATER.teal, { rng, opacity: 0.35, deform: 0.08, spread: 0.12, layers: 4, fade: { angle: Math.PI / 2, start: 0.4, amount: 0.8 } });
  yield;
  // the sky caught on the lip, and a gleam down the tongue's lit side
  const bow = Array.from({ length: 9 }, (_, i) => {
    const u = (i / 8) * 2.1 - 1.05;
    return { x: x + u * fallHalf(0), y: y + 0.5 + 1.3 * (1 - u * u) };
  });
  yield* p.parts.lift(ribbon(bow, (t) => 0.8 * Math.sin(Math.PI * t) ** 0.5), { rng, amount: 0.95, deform: 0.1, spread: 0.1, layers: 4, sharpness: 0.5, edge: 0 });
  yield* p.parts.lift(fallStrip(f, 0.2, 0.5, 0.12, TONGUE + 0.05, 0.6), { rng, amount: 0.75, deform: 0.08, spread: 0.1, layers: 4, sharpness: 0.4, edge: 0 });
  yield;
  // the strands' streaks: thin cool lines on their shaded sides, broken, paper between
  for (let u = -0.85; u <= 0.85; u += rng.range(0.28, 0.42)) {
    if (rng.chance(0.15)) continue;
    const k0 = rng.range(0.3, 0.5);
    const k1 = rng.range(0.8, 0.97);
    const pts = [k0, (k0 + k1) / 2, k1].map((k) => ({ x: x + u * fallHalf(k) + rng.range(-0.3, 0.3), y: y + f.drop * k }));
    p.stroke(pts, { rng, pigment: rng.chance(0.4) ? WATER.teal : WATER.turquoise, width: rng.range(0.5, 0.9), opacity: rng.range(0.35, 0.55), wetness: 0.3, wobble: 0.2, taper: [0.2, 0.7] });
  }
  yield;
  // the churned pool at the foot: turquoise in a darker ring
  const reach = fallHalf(1) + 8;
  yield* p.parts.glaze({ cx: x + 1, cy: foot + 3, rx: reach, ry: 4.4 }, mix(WATER.turquoise, WATER.teal, 0.45), { rng, opacity: 0.55, deform: 0.25, spread: 0.25, layers: 5, edge: 0.4, sharpness: 0.4 });
  yield;
  // foam: white paper churned up across the foot, a few drops thrown up and out
  for (let j = 0; j <= 6; j++) {
    const t = (j / 6) * 2 - 1;
    const r = 4.6 - Math.abs(t) * 2 + rng.range(-0.5, 0.8);
    const cx = x + t * (fallHalf(1) + 2) + rng.range(-1.5, 1.5);
    const cy = foot + 1.2 + Math.abs(t) * 1.6 + rng.range(-0.6, 0.6);
    yield* p.parts.lift(blob(cx, cy, r, r * 0.55, rng, { irregularity: 0.4, points: 12 }), { rng, amount: rng.range(0.85, 1), deform: 0.25, spread: 0.3, layers: 4, sharpness: 0.1, edge: 0 });
  }
  for (let j = 0; j < 5; j++) {
    const r = rng.range(0.4, 0.7);
    yield* p.parts.lift({ cx: x + rng.range(-1, 1) * (fallHalf(1) + 6), cy: foot - rng.range(1, 7), rx: r, ry: r }, { rng, amount: 0.9, deform: 0.2, spread: 0.2, layers: 2, sharpness: 0.5, edge: 0 });
  }
  yield;
  // the spray: a soft pale haze rising a little off the foam
  yield* p.parts.lift({ cx: x, cy: foot - 4, rx: 12, ry: 5 }, { rng, amount: 0.3, deform: 0.3, spread: 0.4, layers: 4, sharpness: 0.02, edge: 0 });
  yield;
  // the coping's edge soaked either side of the lip
  for (const side of [-1, 1]) {
    const c = x + side * (fallHalf(0) + 2.5);
    p.stroke([{ x: c - 2.5, y: y + 0.6 }, { x: c + 2.5, y: y + 0.4 }], { rng, pigment: STONE.wet, width: 1, opacity: 0.45, wetness: 0.3, wobble: 0.3, taper: [0.3, 0.3] });
  }
  yield;
}

/**
 * The seguia: clay-lined runs along the terraces, a small fall over each wall, the last run
 * crossing the foreground to the bottom-left, and the sluice's channel from the gate to the oued.
 */
export function* paintSeguia(p: Painter, rng: Rng): Strokes {
  for (const [i, f] of SEGUIA_FALLS.entries()) yield* paintFallStain(p, rng.fork(`stain-${i}`), f);
  clipTo(p, [BASIN_STONE], true);
  for (const [i, run] of SEGUIA_RUNS.entries()) {
    const fw = FALL_WALLS[i];
    yield* paintChannel(p, rng.fork(`run-${i}`), run, i === 2 ? 8 * 1.6 : 7, i === 2 ? 0.25 : 0, fw ? aboveWall(fw.wall, fw.dy + 0.5) : null);
  }
  yield* paintChannel(p, rng.fork('sluice'), SLUICE, 6.5);
  p.ctx.restore();
  // the inlet: the last fall's water in a short cut to the coping, then alone through its notch into the basin
  clipTo(p, [BASIN_STONE], true);
  yield* paintChannel(p, rng.fork('inlet'), [INLET.from, lerp(INLET.from, INLET.to, 0.5), INLET.to], 3);
  p.ctx.restore();
  clipTo(p, [BASIN_WATER], true);
  const notch = ribbon(extend([INLET.from, INLET.to], 0, 2), () => 2.6);
  clipTo(p, [BASIN_STONE]);
  fillPaper(p, notch);
  yield* p.parts.wetInWet(notch, WATER.light, WATER.teal, { rng, angle: Math.PI / 2, split: 0.55, softness: 0.6, opacity: 0.65, deform: 0.03, spread: 0.04, edge: 0.35, sharpness: 0.7 });
  p.ctx.restore();
  p.ctx.restore();
  yield;
  for (const [i, f] of SEGUIA_FALLS.entries()) yield* paintFall(p, rng.fork(`fall-${i}`), f);
  // the gate's spill lands in the sluice's head, a little downstream of the board: the water paled
  // round the drop, then the foam as reserved paper (lifts left it grey over the turquoise)
  const [g1, g2] = SLUICE_GATE.foam;
  clipTo(p, SLUICE_GATE.posts, true);
  const mid = lerp(g1, g2, 0.5);
  yield* p.parts.lift(blob(mid.x + 1, mid.y + 1, 9, 6, rng, { irregularity: 0.3 }), { rng, amount: 0.45, deform: 0.25, spread: 0.3, layers: 3, sharpness: 0.1, edge: 0 });
  for (let j = 0; j < 3; j++) {
    const [a0, a1] = [lerp(g1, g2, 0.04 + j * 0.33), lerp(g1, g2, 0.28 + j * 0.33)];
    fillPaper(p, ribbon([a0, lerp(a0, a1, 0.5), a1].map((q, k) => ({ x: q.x + k * 0.6, y: q.y + rng.range(-0.3, 0.3) })), (t) => 0.9 * Math.sin(Math.PI * t) ** 0.6));
  }
  for (let j = 0; j < 5; j++) {
    const q = lerp(g1, g2, 0.1 + j * 0.2);
    const r = rng.range(1.1, 1.9);
    fillPaper(p, blob(q.x + rng.range(1, 3.5), q.y + rng.range(-0.5, 1.5), r, r * 0.6, rng, { irregularity: 0.4, points: 10 }));
  }
  p.ctx.restore();
  yield;
  // where the last run leaves the basin's near face: a spout, wet under it
  const s = SEGUIA_RUNS[2]![0]!;
  yield* p.parts.glaze(blob(s.x, s.y - 12, 14, 9, rng, { irregularity: 0.3 }), STONE.wet, { rng, opacity: 0.4, deform: 0.2, spread: 0.2, layers: 5, fade: { angle: -Math.PI / 2, start: 0.3, amount: 1 } });
  yield;
}

// ── the oued ──────────────────────────────────────────────────────────────────────────────

/**
 * The oued: a shallow, braided river over gold sand. Damp darker sand at its banks, the bed's
 * gold showing through pale milky blue-green water, deeper threads braiding round the sand bars,
 * lost-and-found edges, riffles at the bars' heads and pebbles on the bars and the banks.
 */
export function* paintOued(p: Painter, rng: Rng): Strokes {
  const water = OUED_WATER;
  // damp sand along both banks, lost into the dry sand
  for (const side of [0, 1]) {
    const bank = side === 0 ? ouedStrip(0, 1.02, () => -0.14, () => 0.04) : ouedStrip(0, 1.02, () => 0.94, () => 1.12);
    yield* p.parts.wash(bank, mix(STONE.sandWet, EARTH.shade, 0.15), { rng, opacity: 0.38, deform: 0.2, spread: 0.25, layers: 8, edge: 0.05, granulation: 0.6, granules: 0.25, fade: { angle: side === 0 ? Math.PI : 0, start: 0.35, amount: 1, ragged: 0.9 } });
    yield;
  }
  // the bed: gold sand under the water
  fillPaper(p, water);
  clipTo(p, [water]);
  yield* p.parts.wash(insetPolygon(water, -10), STONE.sand, { rng, opacity: 0.42, deform: 0.05, spread: 0.06, layers: 8, edge: 0.05, granulation: 0.6, granules: 0.25 });
  yield;
  // the milky water over it, bluer where it runs deeper along the outer bank
  yield* p.parts.wetInWet(insetPolygon(water, -10), WATER.milkMid, WATER.milk, { rng, angle: 0, split: 0.45, softness: 0.6, fingers: 0.6, opacity: 0.72, deform: 0.06, spread: 0.08, edge: 0.04, granulation: 0.3, flow: 0.6, flowScale: 80 });
  yield;
  yield* p.parts.lift(water, { rng, amount: 0.16, deform: 0.2, spread: 0.3, layers: 4, edge: 0 });
  yield;
  // the braids: deeper threads either side of the big bar, joining above and below it
  const threads: [number, number, (s: number) => number, (s: number) => number, number][] = [
    [0, 1.02, (s) => 0.03 + 0.04 * Math.sin(s * 9), (s) => 0.34 + 0.08 * Math.sin(s * 5 + 1), 0.5],
    [0.36, 1.02, (s) => 0.74 + 0.04 * Math.sin(s * 7), (s) => 0.88 + 0.03 * Math.sin(s * 6), 0.3],
    [0, 0.42, (s) => 0.4 + 0.05 * Math.sin(s * 11), (s) => 0.56, 0.26],
  ];
  for (const [s0, s1, u0, u1, a] of threads) {
    yield* p.parts.glaze(ouedStrip(s0, s1, u0, u1), mix(WATER.turquoise, WATER.milkMid, 0.4), { rng, opacity: a, deform: 0.2, spread: 0.25, layers: 10, edge: 0.04, flow: 0.6, flowScale: 50, fade: { angle: -Math.PI / 2, start: 0.6, amount: 0.4, ragged: 0.8 } });
    yield;
  }
  // the bars: dry gold sand, a damp dark rim on their water side, lost at their tails
  for (const [i, bar] of OUED_BARS.entries()) {
    yield* p.parts.lift(bar, { rng, amount: 0.6, deform: 0.1, spread: 0.15, layers: 6, sharpness: 0.15, edge: 0 });
    yield;
    yield* p.parts.wash(bar, mix(STONE.sand, EARTH.lit, 0.5), { rng, opacity: 0.5, deform: 0.2, spread: 0.15, layers: 8, edge: 0.06, sharpness: 0.2, granulation: 0.7, granules: 0.3, fade: { angle: Math.PI / 2, start: 0.55, amount: 0.8, ragged: 0.9 } });
    yield;
    const bb = bounds(bar);
    yield* p.parts.glaze(blob(bb.x + bb.w * 0.4, bb.y + bb.h * 0.58, bb.w * 0.32, bb.h * 0.3, rng, { irregularity: 0.3 }), STONE.sandWet, { rng, opacity: 0.12, deform: 0.3, spread: 0.3, layers: 6 });
    yield;
    // the riffle at its head: pale broken arcs where the water parts
    const head = { x: bb.x + bb.w * 0.5, y: bb.y + 2 };
    for (const side of [-1, 1]) {
      const pts: Pt[] = [head, { x: head.x + side * bb.w * 0.3, y: head.y + 6 }, { x: head.x + side * bb.w * 0.55, y: head.y + 16 }];
      yield* p.parts.lift([...pts, ...pts.slice().reverse().map((q) => ({ x: q.x, y: q.y + 2 }))], { rng, amount: 0.55, deform: 0.15, spread: 0.2, layers: 3, sharpness: 0.3, edge: 0 });
    }
    if (i === 0) {
      // the damp line along the big bar's upstream side, found in places
      const edge = bar.filter((q) => q.y < BAR.cy + 10 && q.x < BAR.cx + 20);
      for (let j = 0; j < edge.length - 3; j += 4) p.stroke(edge.slice(j, j + 3), { rng, pigment: STONE.sandWet, width: 1.4, opacity: 0.35, wetness: 0.4, taper: [0.3, 0.3] });
    }
    yield;
  }
  // flow lines and glints on the threads: short, nearly level marks
  for (let i = 0; i < 30; i++) {
    const s = rng.range(0.03, 1);
    const q = ouedAt(s, rng.chance(0.6) ? rng.range(0.06, 0.34) : rng.range(0.74, 0.9));
    const len = rng.range(10, 26) * (0.7 + s * 0.8);
    const pts: Pt[] = [{ x: q.x - len / 2, y: q.y - 1 }, { x: q.x, y: q.y + rng.range(-1.5, 1.5) }, { x: q.x + len / 2, y: q.y + 1 }];
    if (rng.chance(0.45)) p.stroke(pts, { rng, pigment: mix(WATER.teal, WATER.milkMid, 0.3), width: rng.range(0.8, 1.3), opacity: 0.3, wetness: 0.4, wobble: 0.6, taper: [0.4, 0.4] });
    else yield* p.parts.lift([...pts, ...pts.slice().reverse().map((v) => ({ x: v.x, y: v.y + 1.8 }))], { rng, amount: 0.55, deform: 0.1, spread: 0.2, layers: 3, sharpness: 0.4, edge: 0 });
    yield;
  }
  p.ctx.restore();
  // lost-and-found edges: crisp wet lines along stretches of each bank, nothing elsewhere
  for (const u of [0.005, 0.995]) {
    for (let s = rng.range(0, 0.1); s < 1; s += rng.range(0.12, 0.24)) {
      const len = rng.range(0.05, 0.12);
      const pts: Pt[] = [];
      for (let t = s; t <= Math.min(1.02, s + len); t += 0.02) pts.push(ouedAt(t, u));
      if (pts.length > 2) p.stroke(pts, { rng, pigment: mix(STONE.sandWet, STONE.clayWet, 0.4), width: rng.range(1.5, 2.6) * (0.7 + s * 0.6), opacity: 0.5, wetness: 0.3, wobble: 0.4, taper: [0.25, 0.25] });
    }
    yield;
  }
  yield* paintPebbles(p, rng.fork('pebbles'));
}

const PEBBLE: readonly Pigment[] = ['#c4ab90', '#ab9c8e', '#d6b994', '#a08474', '#bdb0a2', '#dcc4a0', '#b88f74'];

/** Pebbles on the bars and along the banks: a body, a cool shade under it and a lit top. */
function* paintPebbles(p: Painter, rng: Rng): Strokes {
  const spots: { s: number; u: number }[] = [];
  for (let i = 0; i < 12; i++) spots.push({ s: rng.range(0.6, 0.8), u: rng.range(0.42, 0.7) });
  for (let i = 0; i < 14; i++) spots.push({ s: rng.range(0.1, 1), u: rng.chance(0.5) ? rng.range(-0.1, -0.02) : rng.range(1.02, 1.1) });
  for (let i = 0; i < 6; i++) spots.push({ s: rng.range(0.9, 1), u: rng.range(0.7, 0.9) });
  const onLand = (q: Pt) => OUED_BARS.some((b) => pointInPolygon(q, b)) || !pointInPolygon(q, OUED_WATER);
  let n = 0;
  for (const { s, u } of spots) {
    const q = ouedAt(s, u);
    const r = rng.range(3, 6.5) * (0.6 + s * 0.6);
    if (!onLand(q)) continue;
    const pg = PEBBLE[rng.int(0, PEBBLE.length - 1)]!;
    p.wash({ cx: q.x + r * 0.2, cy: q.y + r * 0.45, rx: r * 1.15, ry: r * 0.45 }, mix(EARTH.shade, STONE.sandWet, 0.4), { rng, opacity: 0.25, layers: 3, deform: 0.2, spread: 0.2, edge: 0.05 });
    p.lift(blob(q.x, q.y, r, r * 0.66, rng, { irregularity: 0.3, points: 10 }), { rng, amount: 0.5, layers: 2, deform: 0.05, spread: 0.05 });
    p.wash(blob(q.x, q.y, r, r * 0.66, rng, { irregularity: 0.3, points: 10 }), pg, { rng, opacity: 0.4, layers: 4, deform: 0.08, spread: 0.08, edge: 0.3, sharpness: 0.5, granulation: 0.4 });
    p.lift({ cx: q.x + r * 0.2, cy: q.y - r * 0.25, rx: r * 0.5, ry: r * 0.24 }, { rng, amount: 0.5, layers: 2, deform: 0.2, spread: 0.2 });
    if (++n % 6 === 0) yield;
  }
  yield;
}
