/**
 * The waterfall's rock forms: the upper gorge behind the lip, the cliff mass with its strata, the
 * buttress beside the falls and the mossy ledges. Painted on white in world units, in parts
 * (ADR 0226, 0238). docs/systems/scenery.md › Waterfall › Painting.
 */
import type { Rng } from '../../core/rng';
import {
  PIGMENTS,
  bounds,
  createSimplex2D,
  insetPolygon,
  lighten,
  mix,
  shade,
  smoothPath,
  type Painter,
  type Pigment,
} from '../../paint';
import type { Pt } from '../../render/viewport';
import type { Strokes } from '../../scene/paint-land';
import { FALLS } from './geometry';
import { CLIFF, LEDGES, type Ledge } from './layout';

/** Where the light comes from on the rock: the upper right, where the sun sets and rises. */
export const ROCK_LIGHT = -0.95;

/** The cliff's stone: a warm grey lit, a cool blue-grey in shadow. */
export const CLIFF_LIT: Pigment = lighten(mix(PIGMENTS.stone, PIGMENTS.stoneWarm, 0.55), 0.06);
export const CLIFF_SHADOW: Pigment = mix(PIGMENTS.stoneDark, PIGMENTS.bellflower, 0.18);
/** wet rock: darker, cooler, a little green */
export const WET_ROCK: Pigment = mix(shade(PIGMENTS.stoneDark, 0.3), PIGMENTS.celadonDeep, 0.18);
const RECESS: Pigment = mix(shade(PIGMENTS.stoneDark, 0.35), PIGMENTS.indigo, 0.12);
const WARM_LIGHT: Pigment = lighten(mix(PIGMENTS.stoneWarm, PIGMENTS.ochre, 0.3), 0.15);
const MOSS = {
  light: lighten(PIGMENTS.sap, 0.08),
  mid: mix(PIGMENTS.sap, PIGMENTS.sage, 0.5),
  shadow: mix(PIGMENTS.olive, PIGMENTS.sage, 0.4),
  dark: mix(PIGMENTS.olive, PIGMENTS.sumi, 0.3),
};

/** The gorge glimpse's lower edge (the rock in front of it): down to the lip and up the buttress. */
const GORGE_FLOOR: readonly Pt[] = [
  { x: 540, y: 268 },
  { x: 566, y: 296 },
  { x: 612, y: 291 },
  { x: 658, y: 296 },
  { x: 690, y: 258 },
];

/** The cliff's face with the notch cut down to the lip, so the gorge shows through it. */
export function cliffBody(): Pt[] {
  const out: Pt[] = [];
  for (const q of CLIFF) {
    if (q.x > 530 && q.x < 700 && q.y < 300) {
      if (!out.some((o) => o === GORGE_FLOOR[0])) out.push(...GORGE_FLOOR);
      continue;
    }
    out.push(q);
  }
  return out;
}

/** The buttress right of the falls, skyline to foot. */
export function buttressShape(): Pt[] {
  const top = CLIFF.filter((q, i) => q.x >= 700 && i < CLIFF.findIndex((c) => c.x === 1040));
  const foot = CLIFF.slice(CLIFF.findIndex((c) => c.x === 1040)).filter((q) => q.x >= 690);
  return [{ x: 690, y: 258 }, ...top, ...foot, { x: 690, y: 600 }, { x: 676, y: 420 }];
}

function clipTo(p: Painter, shape: readonly Pt[]): void {
  const { ctx } = p;
  ctx.save();
  ctx.beginPath();
  shape.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.clip();
}

/** The upper gorge behind the lip: a pale, misty far end between a lit left wall and a shadowed right one. */
export function* paintGorge(p: Painter, rng: Rng): Strokes {
  const far: Pt[] = [{ x: 532, y: 258 }, { x: 700, y: 250 }, { x: 684, y: 302 }, { x: 548, y: 302 }];
  yield* p.parts.wash(far, lighten(mix(CLIFF_SHADOW, PIGMENTS.bellflower, 0.25), 0.3), {
    rng,
    deform: 0.05,
    opacity: 0.32,
    edge: 0.2,
    granules: 0.3,
    fade: { angle: -Math.PI / 2, start: 0.5, amount: 0.6 },
  });
  yield;
  const left: Pt[] = [{ x: 524, y: 262 }, { x: 548, y: 266 }, { x: 574, y: 280 }, { x: 596, y: 294 }, { x: 572, y: 300 }, { x: 538, y: 292 }];
  yield* p.parts.wash(left, CLIFF_LIT, { rng, deform: 0.12, opacity: 0.5, edge: 0.5, granules: 0.4, fade: { angle: Math.PI, start: 0.5, amount: 0.5 } });
  yield;
  const right: Pt[] = [{ x: 702, y: 244 }, { x: 694, y: 262 }, { x: 672, y: 276 }, { x: 640, y: 290 }, { x: 650, y: 300 }, { x: 704, y: 298 }];
  yield* p.parts.wash(right, RECESS, { rng, deform: 0.12, opacity: 0.55, edge: 0.55, granules: 0.5 });
}

/** One crack line down the face: a few broken, tapered sumi segments. */
function crack(rng: Rng, x: number, y: number, len: number): Pt[] {
  const pts: Pt[] = [];
  let cx = x;
  const lean = rng.range(-0.25, 0.25);
  for (let t = 0; t <= len; t += len / 2) {
    pts.push({ x: cx, y: y + t });
    cx += lean * (len / 2) + rng.range(-2, 2);
  }
  return pts;
}

/** The cliff: the mass, its strata and cracks, the recess behind the falls, the lit faces and the wet streaks. */
export function* paintCliff(p: Painter, rng: Rng): Strokes {
  const body = cliffBody();
  const b = bounds(body);
  // reserve the cliff's paper so it stands opaque over whatever lies behind it
  yield* p.parts.lift(insetPolygon(body, 3), { rng, amount: 1, deform: 0.02, spread: 0.02, layers: 4, sharpness: 0.8, edge: 0 });
  yield;
  yield* p.parts.wetInWet(body, CLIFF_LIT, CLIFF_SHADOW, {
    rng,
    angle: Math.PI / 2 + 0.25,
    split: 0.42,
    softness: 0.6,
    fingers: 0.7,
    deform: 0.06,
    spread: 0.08,
    opacity: 0.36,
    edge: 0.4,
    edgeWidth: 3,
    centreLift: 0.2,
    granulation: 0.3,
    granules: 0.3,
    flow: 0.6,
    flowScale: 140,
    fade: { angle: 0.15, start: 0.82, amount: 0.85, ragged: 0.7 },
  });
  yield;

  // strata: broken blocks dipping gently left, a lit top (paper lifted) over a crisp shadow that dies downward
  const noise = createSimplex2D(rng.fork('strata'));
  clipTo(p, body);
  for (let y0 = 256; y0 < 620; y0 += rng.range(30, 58)) {
    const dip = rng.range(0.02, 0.07);
    for (let x0 = b.x + rng.range(-60, 80); x0 < b.x + b.w; ) {
      const len = rng.range(90, 300);
      if (rng.chance(0.3)) {
        x0 += len;
        continue;
      }
      const thick = rng.range(10, 30);
      const top: Pt[] = [];
      for (let x = x0; x <= x0 + len; x += 14) top.push({ x, y: y0 + (600 - x) * dip + noise(x / 70, y0 / 40) * 7 });
      const under = top.map((q) => ({ x: q.x, y: q.y + thick * (0.6 + 0.4 * noise(q.x / 40, y0)) })).reverse();
      const lit = top.map((q) => ({ x: q.x, y: q.y - rng.range(3, 6) }));
      yield* p.parts.lift([...lit, ...top.slice().reverse()], { rng, amount: 0.3, deform: 0.2, layers: 4, sharpness: 0.4 });
      yield;
      const dark = rng.chance(0.3);
      yield* p.parts.wash([...top, ...under], dark ? RECESS : mix(CLIFF_SHADOW, PIGMENTS.stoneDark, 0.4), {
        rng,
        deform: 0.12,
        spread: 0.14,
        layers: 8,
        opacity: dark ? 0.32 : 0.2,
        edge: 0.5,
        sharpness: 0.7,
        granules: 0.35,
        fade: { angle: Math.PI / 2, start: 0.15, amount: 1, ragged: 0.7 },
      });
      yield;
      x0 += len + rng.range(30, 160);
    }
  }
  // texture: a few dry-brush scumbles along the bedding
  for (let i = 0; i < 12; i++) {
    const x = rng.range(-40, 480);
    const y = rng.range(250, 600);
    const len = rng.range(50, 130);
    p.dryBrush([{ x, y }, { x: x + len * 0.5, y: y - len * 0.02 + rng.range(-3, 3) }, { x: x + len, y: y - len * 0.04 }], {
      rng,
      pigment: CLIFF_SHADOW,
      width: rng.range(6, 12),
      opacity: 0.22,
    });
    yield;
  }
  p.ctx.restore();

  // the alcove behind the falls: deep, cool and wet
  const alcove: Pt[] = [{ x: 556, y: 300 }, { x: 668, y: 300 }, { x: 684, y: 460 }, { x: 690, y: 600 }, { x: 540, y: 600 }, { x: 548, y: 460 }];
  yield* p.parts.glaze(alcove, RECESS, { rng, opacity: 0.4, deform: 0.2, spread: 0.3, fade: { angle: Math.PI / 2, start: 0.7, amount: 0.4 } });
  yield;
  // cool shade low on the left face and on the buttress's face toward the falls
  yield* p.parts.glaze({ cx: 330, cy: 590, rx: 300, ry: 60 }, CLIFF_SHADOW, { rng, opacity: 0.32, fade: { angle: -Math.PI / 2, start: 0.4, amount: 1 } });
  yield;
  // warm light on the faces turned to the sun
  for (const [cx, cy, rx, ry] of [
    [300, 300, 200, 60],
    [140, 400, 150, 50],
    [430, 470, 90, 40],
  ] as const) {
    yield* p.parts.glaze({ cx, cy, rx, ry }, WARM_LIGHT, { rng, opacity: 0.22, fade: { angle: Math.PI + 0.3, start: 0.2, amount: 0.9 } });
    yield;
  }

  // cracks: sparse vertical joints between the strata
  for (let i = 0; i < 10; i++) {
    const x = rng.range(-40, 520);
    const y = rng.range(Math.max(240, 300 - x * 0.1), 590);
    p.inkLine(crack(rng, x, y, rng.range(20, 50)), { rng, width: rng.range(0.9, 1.5), pigment: mix(PIGMENTS.sumi, CLIFF_SHADOW, 0.5), breaks: 0.4, wobble: 0.15, opacity: 0.35 });
    yield;
  }

  yield* paintWetStreaks(p, rng);
}

/** Dark wet rock beside the falls: streaks running down from the lip, and seeps under the ledges. */
function* paintWetStreaks(p: Painter, rng: Rng): Strokes {
  const [l, r] = [FALLS.outline[0]!.x, FALLS.outline[1]!.x];
  for (const [x0, x1] of [
    [l - 34, l + 6],
    [r - 6, r + 34],
  ] as const) {
    for (let i = 0; i < 5; i++) {
      const x = rng.range(x0, x1);
      const y = 296 + rng.range(0, 20);
      const len = rng.range(110, 290);
      const path = smoothPath([{ x, y }, { x: x + rng.range(-6, 6), y: y + len * 0.5 }, { x: x + rng.range(-10, 10), y: y + len }], 8);
      p.stroke(path, { rng, pigment: WET_ROCK, width: rng.range(8, 18), taper: [0.05, 0.8], wobble: 0.4, wetness: 0.95, edge: 0.25, sharpness: 0.35, opacity: rng.range(0.16, 0.28) });
      yield;
    }
  }
  // seeps: thin dark-green runs below a few ledges
  for (const ledge of LEDGES) {
    if (!rng.chance(0.6)) continue;
    const [a, b] = ledge.edge;
    const x = rng.range(a.x + 20, b.x - 20);
    const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) + 14;
    p.stroke([{ x, y }, { x: x + rng.range(-4, 4), y: y + rng.range(40, 80) }], {
      rng,
      pigment: mix(WET_ROCK, PIGMENTS.olive, 0.3),
      width: rng.range(4, 8),
      taper: [0.05, 0.8],
      wetness: 0.8,
      opacity: 0.3,
    });
    yield;
  }
}

/** The buttress: the tallest rock beside the falls, lit on its right flank and cool toward the falls. */
export function* paintButtress(p: Painter, rng: Rng): Strokes {
  const shape = buttressShape();
  yield* p.parts.wetInWet(shape, lighten(CLIFF_LIT, 0.04), RECESS, {
    rng,
    angle: Math.PI + 0.2,
    split: 0.5,
    softness: 0.45,
    fingers: 0.6,
    deform: 0.1,
    spread: 0.06,
    opacity: 0.3,
    edge: 0.55,
    edgeWidth: 3,
    centreLift: 0.2,
    granulation: 0.35,
    granules: 0.35,
    flow: 0.55,
    flowScale: 110,
    fade: { angle: 0.2, start: 0.6, amount: 0.9, ragged: 0.7 },
  });
  yield;
  // planes: a crisp fissure splitting the crest from the flank, a lit face right of it
  p.inkLine(
    [
      { x: 786, y: 222 },
      { x: 800, y: 300 },
      { x: 812, y: 380 },
      { x: 806, y: 470 },
      { x: 820, y: 560 },
    ],
    { rng, width: 1.6, pigment: mix(PIGMENTS.sumi, RECESS, 0.3), breaks: 0.35, opacity: 0.5, pressure: [1.2, 1, 0.6] },
  );
  yield;
  // columnar joints and a vertical scumble: the buttress stands, the cliff lies in beds
  for (const [x, y, len] of [
    [736, 250, 70],
    [758, 380, 90],
    [880, 300, 60],
    [930, 400, 80],
  ] as const) {
    p.inkLine(crack(rng, x, y, len), { rng, width: 1.1, pigment: mix(PIGMENTS.sumi, RECESS, 0.5), breaks: 0.6, wobble: 0.15, opacity: 0.28 });
    yield;
    p.dryBrush([{ x: x + 8, y: y + 10 }, { x: x + 10, y: y + len * 0.6 }], { rng, pigment: CLIFF_SHADOW, width: 10, opacity: 0.2 });
    yield;
  }
  const flank: Pt[] = [{ x: 812, y: 230 }, { x: 900, y: 300 }, { x: 1000, y: 380 }, { x: 1010, y: 500 }, { x: 940, y: 590 }, { x: 830, y: 560 }, { x: 812, y: 400 }];
  yield* p.parts.glaze(flank, WARM_LIGHT, { rng, opacity: 0.25, deform: 0.1, fade: { angle: Math.PI, start: 0.4, amount: 0.9 } });
  yield;
  yield* p.parts.glaze({ cx: 724, cy: 430, rx: 46, ry: 170 }, RECESS, { rng, opacity: 0.4, fade: { angle: 0, start: 0.3, amount: 1 } });
}

function ledgeY(l: Ledge, x: number): number {
  const [a, b] = l.edge;
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/** The ledges: a lit shelf, the undercut's shadow and moss cushions along the lip. */
export function* paintLedges(p: Painter, rng: Rng): Strokes {
  for (const l of LEDGES) {
    const [a, b] = l.edge;
    const s = l.scale;
    const shelf: Pt[] = [
      { x: a.x + 8, y: a.y - 12 * s },
      { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 14 * s },
      { x: b.x - 6, y: b.y - 10 * s },
      { x: b.x + 2, y: b.y + 1 },
      { x: a.x, y: a.y + 1 },
    ];
    yield* p.parts.lift(shelf, { rng, amount: 0.45, deform: 0.2, layers: 6, sharpness: 0.5 });
    yield;
    const under: Pt[] = [a, b, { x: b.x - 10, y: b.y + 34 * s }, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 48 * s }, { x: a.x + 12, y: a.y + 30 * s }];
    yield* p.parts.glaze(under, RECESS, {
      rng,
      deform: 0.2,
      spread: 0.3,
      opacity: 0.5,
      granules: 0.3,
      fade: { angle: Math.PI / 2, start: 0.1, amount: 1, ragged: 0.8 },
    });
    yield;
    const lip = [0, 0.2, 0.45, 0.7, 0.85, 1].map((t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + (t > 0 && t < 1 ? rng.range(-3, 4) : 0) }));
    p.inkLine(lip, {
      rng,
      width: 1.3,
      pigment: mix(PIGMENTS.sumi, RECESS, 0.4),
      breaks: 0.5,
      opacity: 0.4,
    });
    yield;
    // moss cushions along the lip, spilling a little over it
    const n = Math.max(3, Math.round((b.x - a.x) / 34));
    for (let i = 0; i < n; i++) {
      const x = a.x + ((i + rng.range(0.2, 0.8)) / n) * (b.x - a.x);
      const r = rng.range(14, 26) * s;
      yield* p.parts.foliageClump({ x, y: ledgeY(l, x) - r * 0.15 }, r, MOSS, {
        rng,
        light: ROCK_LIGHT,
        flatness: 0.42,
        density: 0.8,
        dabSize: 0.3,
        gaps: 0.15,
        shadow: 0.5,
        opacity: 0.72,
      });
      yield;
    }
  }
}
