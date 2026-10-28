/**
 * The waterfall's vegetation and ground (S8): the far ridge, the grassy banks and meadow, the
 * crown woods and the trees over the cliff edge, ferns and moss by the ledges, the near
 * foreground. Painted on white in world units, in parts (ADR 0226, 0238).
 * docs/systems/scenery.md › Waterfall › Painting › Vegetation.
 */
import type { Rng } from '../../core/rng';
import { PIGMENTS, blob, createSimplex2D, lighten, mix, rgba, smoothPath, type Ctx2D, type FoliagePigments, type Painter, type Pigment } from '../../paint';
import type { Pt, Rect } from '../../render/viewport';
import { paintMeadow, paintMeadowGrass, type GroundArt } from '../../scene/paint-ground';
import { atmos, type Strokes } from '../../scene/paint-land';
import { POOL, STREAM } from './geometry';
import { FAR_RIDGE, LEDGES, skylineAt } from './layout';

/** Where the meadow's texture may go: off the pool and the stream (no building here). */
export const WATERFALL_GROUND: GroundArt = { pond: POOL, path: STREAM, pavilion: { x: 1e6, y: -1e6, w: 0, h: 0 } };

/** The woods' greens: darker and bluer than the garden's trees, a little hazed by distance. */
export const WOODS: FoliagePigments = {
  light: atmos(mix(PIGMENTS.sage, PIGMENTS.olive, 0.4), 0.2),
  mid: atmos(mix(PIGMENTS.olive, PIGMENTS.indigo, 0.14), 0.15),
  shadow: atmos(mix(mix(PIGMENTS.olive, PIGMENTS.sumi, 0.45), PIGMENTS.indigo, 0.12), 0.1),
  dark: mix(PIGMENTS.sumi, PIGMENTS.indigo, 0.2),
};

const FERN_GREENS: readonly Pigment[] = [
  mix(PIGMENTS.sap, PIGMENTS.gold, 0.15),
  mix(PIGMENTS.sage, PIGMENTS.olive, 0.5),
  mix(PIGMENTS.sage, PIGMENTS.celadonMid, 0.3),
];

const MOSS = mix(PIGMENTS.sap, PIGMENTS.olive, 0.45);

/** The far ridge in cool blue-grey, a nearer ridge under it, and a far tree line on that. */
export function* paintFarRidge(p: Painter, rng: Rng): Strokes {
  yield* p.parts.wash(FAR_RIDGE, atmos(mix(PIGMENTS.bellflower, PIGMENTS.stoneDark, 0.45), 0.45), {
    rng,
    deform: 0.03,
    spread: 0.05,
    opacity: 0.42,
    edge: 0.3,
    edgeWidth: 2.5,
    sharpness: 0.6,
    centreLift: 0.1,
    granulation: 0.12,
    flow: 0.5,
    flowScale: 160,
    fade: { angle: Math.PI / 2, start: 0.2, amount: 1, ragged: 0.5 },
  });
  yield;
  const near = smoothPath(
    [
      { x: 990, y: 414 },
      { x: 1110, y: 398 },
      { x: 1250, y: 408 },
      { x: 1390, y: 394 },
      { x: 1540, y: 404 },
      { x: 1700, y: 396 },
    ],
    20,
  );
  yield* p.parts.wash([...near, { x: 1700, y: 480 }, { x: 990, y: 480 }], atmos(mix(PIGMENTS.sage, PIGMENTS.celadonDeep, 0.45), 0.6), {
    rng,
    deform: 0.04,
    spread: 0.06,
    opacity: 0.34,
    edge: 0.28,
    edgeWidth: 2,
    sharpness: 0.55,
    granulation: 0.1,
    flow: 0.5,
    flowScale: 140,
    fade: { angle: Math.PI / 2, start: 0.3, amount: 0.9, ragged: 0.5 },
  });
  yield;
  // a scalloped far tree line along the nearer ridge, broken into stands
  const noise = createSimplex2D(rng.fork('treeline'));
  const top: Pt[] = [];
  for (let x = 1000; x <= 1700; x += 6) {
    const stand = Math.max(0, noise(x / 90, 1.7) + 0.25);
    const canopy = 0.5 + 0.5 * noise(x / 22, 0.5) + 0.35 * Math.abs(noise(x / 8, 3.1));
    top.push({ x, y: 412 - stand * (4 + canopy * 14) });
  }
  yield* p.parts.wash([...top, { x: 1700, y: 432 }, { x: 1000, y: 432 }], atmos(mix(PIGMENTS.olive, PIGMENTS.celadonDeep, 0.4), 0.45), {
    rng,
    deform: 0.02,
    spread: 0.04,
    opacity: 0.32,
    edge: 0.32,
    edgeWidth: 1.5,
    sharpness: 0.65,
    flow: 0.5,
    flowScale: 40,
    fade: { angle: Math.PI / 2, start: 0.4, amount: 0.9 },
  });
}

const WARM = mix(PIGMENTS.sap, PIGMENTS.gold, 0.12);
const COOL = mix(PIGMENTS.sage, PIGMENTS.celadonMid, 0.25);

/** A bank: a lit lip on top bleeding into a cooler or warmer body, lost toward its open side. */
function bank(p: Painter, rng: Rng, shape: readonly Pt[], a: Pigment, b: Pigment, opacity: number, fadeAngle: number, blooms = 0) {
  return p.parts.wetInWet(shape, a, b, {
    rng,
    angle: Math.PI / 2,
    split: 0.38,
    softness: 0.6,
    deform: 0.05,
    spread: 0.1,
    opacity,
    edge: 0.3,
    edgeWidth: 3,
    flow: 0.55,
    flowScale: 120,
    granulation: 0.25,
    blooms,
    bloomSize: 0.08,
    fade: { angle: fadeAngle, start: 0.4, amount: 1, ragged: 0.55 },
  });
}

/** The grassy banks round the pool and the stream, far to near, then the shade where they turn to the water. */
export function* paintBanks(p: Painter, rng: Rng): Strokes {
  // the plain under the ridge and the ground behind the cliff, pale and cool
  const plain: Pt[] = [
    { x: -80, y: 452 },
    { x: 1000, y: 452 },
    { x: 1200, y: 444 },
    { x: 1420, y: 450 },
    { x: 1700, y: 444 },
    { x: 1700, y: 640 },
    { x: -80, y: 640 },
  ];
  yield* p.parts.wetInWet(plain, lighten(atmos(PIGMENTS.sageLight, 0.4), 0.05), atmos(mix(COOL, PIGMENTS.sap, 0.4), 0.3), {
    rng,
    angle: Math.PI / 2,
    split: 0.4,
    softness: 0.55,
    deform: 0.04,
    spread: 0.08,
    opacity: 0.48,
    edge: 0.25,
    edgeWidth: 2.5,
    sharpness: 0.6,
    granulation: 0.15,
    flow: 0.45,
    flowScale: 120,
    fade: { angle: Math.PI / 2, start: 0.55, amount: 0.8 },
  });
  yield;
  // the right bank, rising from the stream to the plain
  const right: Pt[] = [
    { x: 1004, y: 560 },
    { x: 1100, y: 520 },
    { x: 1260, y: 506 },
    { x: 1460, y: 512 },
    { x: 1700, y: 500 },
    { x: 1700, y: 800 },
    { x: 1260, y: 770 },
    { x: 1150, y: 742 },
    { x: 1060, y: 712 },
    { x: 1000, y: 650 },
  ];
  yield* bank(p, rng, right, PIGMENTS.sageLight, mix(COOL, PIGMENTS.sap, 0.5), 0.58, Math.PI / 2 - 0.4);
  yield;
  // the left bank at the cliff's foot, round the pool's rim
  const left: Pt[] = [
    { x: -80, y: 636 },
    { x: 200, y: 630 },
    { x: 380, y: 628 },
    { x: 452, y: 646 },
    { x: 500, y: 712 },
    { x: 600, y: 750 },
    { x: 680, y: 762 },
    { x: 600, y: 800 },
    { x: 300, y: 812 },
    { x: -80, y: 800 },
  ];
  yield* bank(p, rng, left, mix(PIGMENTS.sageLight, WARM, 0.3), mix(PIGMENTS.sap, COOL, 0.5), 0.58, Math.PI / 2 + 0.3);
  yield;
  // near mounds: warmer, either side of the trail and the stream
  const nearLeft: Pt[] = [
    { x: -80, y: 790 },
    { x: 140, y: 770 },
    { x: 340, y: 772 },
    { x: 520, y: 770 },
    { x: 610, y: 790 },
    { x: 620, y: 860 },
    { x: 580, y: 940 },
    { x: 560, y: 1080 },
    { x: -80, y: 1080 },
  ];
  yield* bank(p, rng, nearLeft, mix(PIGMENTS.sageLight, WARM, 0.5), mix(WARM, PIGMENTS.sage, 0.3), 0.56, Math.PI / 2 + 0.6, 1);
  yield;
  const middle: Pt[] = [
    { x: 740, y: 776 },
    { x: 860, y: 768 },
    { x: 960, y: 752 },
    { x: 1030, y: 790 },
    { x: 1090, y: 870 },
    { x: 1050, y: 960 },
    { x: 1030, y: 1080 },
    { x: 740, y: 1080 },
    { x: 780, y: 960 },
    { x: 760, y: 860 },
  ];
  yield* bank(p, rng, middle, mix(PIGMENTS.sageLight, WARM, 0.45), mix(WARM, COOL, 0.4), 0.54, Math.PI / 2);
  yield;
  const nearRight: Pt[] = [
    { x: 1150, y: 790 },
    { x: 1300, y: 770 },
    { x: 1480, y: 782 },
    { x: 1700, y: 790 },
    { x: 1700, y: 1080 },
    { x: 1110, y: 1080 },
    { x: 1150, y: 990 },
    { x: 1230, y: 900 },
    { x: 1220, y: 830 },
  ];
  yield* bank(p, rng, nearRight, mix(PIGMENTS.sageLight, WARM, 0.5), mix(COOL, PIGMENTS.sap, 0.4), 0.54, Math.PI / 2 - 0.6, 1);
  yield;

  // cool shade where the banks turn down to the water, and under the cliff
  const shade = mix(PIGMENTS.sage, PIGMENTS.celadonDeep, 0.35);
  const glazes: [number, number, number, number, number, number][] = [
    [240, 652, 260, 22, 0.02, 0.2],
    [480, 728, 90, 22, 0.7, 0.2],
    [700, 770, 150, 16, 0.05, 0.18],
    [960, 752, 110, 18, -0.3, 0.18],
    [1080, 820, 60, 26, 0.9, 0.16],
    [1240, 868, 50, 40, 0.3, 0.16],
    [1060, 940, 50, 40, -0.4, 0.15],
    [1040, 640, 70, 50, 0.5, 0.16],
  ];
  for (const [cx, cy, rx, ry, rotation, opacity] of glazes) {
    yield* p.parts.glaze({ cx, cy, rx, ry, rotation }, shade, { rng, opacity, deform: 0.3, spread: 0.3, fade: { angle: -Math.PI / 2, start: 0.3, ragged: 0.5 } });
    yield;
  }
  // dry-brush along the bank lips, broken and pale
  const lip = mix(PIGMENTS.sage, PIGMENTS.sap, 0.4);
  p.dryBrush([{ x: 1060, y: 524 }, { x: 1240, y: 508 }, { x: 1460, y: 514 }], { rng, pigment: atmos(lip, 0.3), width: 7, opacity: 0.35 });
  yield;
  p.dryBrush([{ x: 40, y: 778 }, { x: 260, y: 770 }, { x: 500, y: 774 }], { rng, pigment: lip, width: 12, opacity: 0.28 });
  yield;
  p.dryBrush([{ x: 1300, y: 776 }, { x: 1480, y: 786 }, { x: 1620, y: 792 }], { rng, pigment: lip, width: 12, opacity: 0.28 });
}

/** The meadow's texture (the garden's: patches with back-runs, then sparse grass), off the water. */
export function paintWaterfallMeadow(p: Painter, rng: Rng): Strokes {
  return paintMeadow(p, rng, WATERFALL_GROUND);
}

export function paintWaterfallGrass(p: Painter, rng: Rng): Strokes {
  return paintMeadowGrass(p, rng, WATERFALL_GROUND);
}

/** Crown slots: the woods stay low and open over them (slots.ts › back). */
const CROWN_SLOTS = [300, 450, 790];

/** The dark woods along the cliff top: a soft under-wash, then broken stands of clumps and a few spires. */
export function* paintCrownWoods(p: Painter, rng: Rng): Strokes {
  const runs: [number, number][] = [
    [-80, 545],
    [672, 880],
  ];
  for (const [x0, x1] of runs) {
    const top: Pt[] = [];
    for (let x = x0; x <= x1; x += 10) top.push({ x, y: skylineAt(x) - 4 });
    const under = [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + 44 }))];
    yield* p.parts.wash(under, WOODS.mid, { rng, opacity: 0.5, deform: 0.08, spread: 0.12, edge: 0.2, fade: { angle: Math.PI / 2, start: 0.3, amount: 1, ragged: 0.7 } });
    yield;
  }
  for (const [x0, x1] of runs) {
    for (let x = x0 + rng.range(0, 14); x < x1; x += rng.range(16, 28)) {
      if (rng.next() < 0.14) continue; // a gap in the stand
      const nearSlot = CROWN_SLOTS.some((s) => Math.abs(s - x) < 34);
      const k = nearSlot ? 0.6 : rng.range(0.85, 1.3);
      const r = rng.range(22, 34) * k;
      const y = skylineAt(x) + r * 0.15;
      yield* p.parts.foliageClump({ x, y }, r, WOODS, { rng, flatness: rng.range(0.6, 0.85), shadow: 0.85, opacity: 0.8, gaps: 0.3, dabSize: 0.24 });
      yield;
      // now and then a spire: a narrow stack of clumps standing above the stand
      if (!nearSlot && rng.next() < 0.28) {
        const h = rng.range(44, 70);
        for (let t = 0; t < 3; t++) {
          const yy = y - h * (0.35 + 0.3 * t);
          yield* p.parts.foliageClump({ x: x + rng.range(-3, 3), y: yy }, r * (0.62 - t * 0.14), WOODS, { rng, flatness: 1.3, shadow: 0.9, opacity: 0.78, gaps: 0.25 });
          yield;
        }
      }
    }
  }
}

/** Trees leaning out over the cliff edge: a pine left of the notch, a maple-ish one off the buttress. */
export const OVERHANG: readonly { trunk: Pt[]; crowns: [number, number, number][] }[] = [
  {
    trunk: [
      { x: 512, y: 262 },
      { x: 520, y: 240 },
      { x: 538, y: 222 },
      { x: 566, y: 210 },
    ],
    crowns: [
      [566, 204, 30],
      [534, 214, 22],
      [598, 214, 20],
    ],
  },
  {
    trunk: [
      { x: 846, y: 238 },
      { x: 866, y: 226 },
      { x: 894, y: 222 },
      { x: 920, y: 230 },
    ],
    crowns: [
      [918, 222, 28],
      [884, 212, 22],
      [946, 240, 18],
    ],
  },
];

export function* paintOverhang(p: Painter, rng: Rng): Strokes {
  const bark = mix(PIGMENTS.wood, PIGMENTS.sumi, 0.55);
  for (const tree of OVERHANG) {
    p.stroke(tree.trunk, { rng, pigment: bark, width: 9, taper: [0, 0.7], wobble: 0.3, wetness: 0.35, dryness: 0.25, opacity: 0.85 });
    yield;
    for (const [x, y, r] of tree.crowns) {
      yield* p.parts.foliageClump({ x, y }, r, WOODS, { rng, flatness: 0.55, shadow: 0.8, opacity: 0.82, gaps: 0.35, dabSize: 0.22 });
      yield;
    }
  }
}

/** A fern frond into `c`: an arching rachis with paired leaflets tapering to the tip. */
function frond(c: Ctx2D, rng: Rng, base: Pt, angle: number, len: number, bend: number, pig: Pigment): void {
  const n = 12;
  let { x, y } = base;
  const step = len / n;
  c.strokeStyle = rgba(mix(pig, PIGMENTS.sumi, 0.3), 0.6);
  c.lineWidth = Math.max(0.5, len * 0.025);
  c.beginPath();
  c.moveTo(x, y);
  const pts: { x: number; y: number; a: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const a = angle + bend * (i / n) ** 1.4;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    c.lineTo(x, y);
    pts.push({ x, y, a });
  }
  c.stroke();
  pts.forEach((q, i) => {
    const t = (i + 1) / n;
    const lf = len * 0.24 * Math.sin(Math.PI * (0.12 + 0.8 * t)) * (1 - t * 0.6);
    for (const side of [-1, 1]) {
      const la = q.a + side * rng.range(0.85, 1.15) + 0.35 * Math.sign(bend || 1) * (side > 0 ? 1 : 0.2);
      const tx = q.x + Math.cos(la) * lf;
      const ty = q.y + Math.sin(la) * lf;
      const w = lf * 0.22;
      const nx = -Math.sin(la) * w;
      const ny = Math.cos(la) * w;
      const mx = (q.x + tx) / 2;
      const my = (q.y + ty) / 2;
      c.fillStyle = rgba(pig, rng.range(0.6, 0.9));
      c.beginPath();
      c.moveTo(q.x, q.y);
      c.quadraticCurveTo(mx + nx, my + ny, tx, ty);
      c.quadraticCurveTo(mx - nx, my - ny, q.x, q.y);
      c.fill();
    }
  });
}

/** A spray of fronds fanning from one root, drooping toward `lean` (−1 left, 1 right). */
function spray(c: Ctx2D, rng: Rng, at: Pt, size: number, lean: number): void {
  const fronds = rng.int(3, 5);
  for (let f = 0; f < fronds; f++) {
    const up = -Math.PI / 2 + lean * rng.range(0.4, 1.3);
    frond(c, rng, at, up, size * rng.range(0.7, 1.1), lean * rng.range(0.9, 1.6), rng.pick(FERN_GREENS));
  }
}

/** Fern roots: past each ledge's ends, and along the cliff's foot clear of its slots and the pool. */
export const FERN_SPOTS: readonly { at: Pt; size: number; lean: number }[] = [
  ...LEDGES.flatMap((l) => [
    { at: { x: l.edge[0].x - 6, y: l.edge[0].y + 4 }, size: 58 * l.scale, lean: -1 },
    { at: { x: l.edge[1].x + 6, y: l.edge[1].y + 4 }, size: 58 * l.scale, lean: 1 },
  ]),
  { at: { x: 160, y: 640 }, size: 52, lean: -1 },
  { at: { x: 226, y: 636 }, size: 46, lean: 1 },
  { at: { x: 384, y: 634 }, size: 50, lean: 1 },
  { at: { x: 940, y: 614 }, size: 46, lean: 1 },
  { at: { x: 1034, y: 500 }, size: 40, lean: 1 },
];

/** Moss round the ledges' ends, then the fern sprays in one wet layer (they bleed where they touch). */
export function* paintFerns(p: Painter, rng: Rng): Strokes {
  for (const l of LEDGES) {
    for (const q of l.edge) {
      yield* p.parts.glaze(blob(q.x, q.y + 6, 26 * l.scale, 10 * l.scale, rng, { irregularity: 0.35 }), MOSS, { rng, opacity: 0.3, deform: 0.3, spread: 0.3, granulation: 0.4 });
      yield;
    }
  }
  const area: Rect = { x: 60, y: 250, w: 1060, h: 450 };
  const L = p.layer(area);
  let i = 0;
  for (const s of FERN_SPOTS) {
    spray(L.ctx, rng, s.at, s.size, s.lean);
    if (++i % 4 === 0) {
      L.flush();
      yield;
    }
  }
  L.flush();
  yield;
  yield* L.dryParts({ opacity: 0.8, edge: 0.32, edgeWidth: 0.8, sharpness: 0.6, centreLift: 0.05, granulation: 0.18, flow: 0.4, flowScale: 20, darken: 0.18 });
}

/** The near foreground: deeper greens in the bottom corners and a few tall grass tufts, clear of the slots. */
export function* paintForeground(p: Painter, rng: Rng): Strokes {
  const deep = mix(PIGMENTS.sage, PIGMENTS.olive, 0.35);
  for (const [cx, cy, rx, ry] of [
    [220, 990, 300, 70],
    [1420, 1000, 260, 64],
  ] as const) {
    yield* p.parts.glaze(blob(cx, cy, rx, ry, rng, { irregularity: 0.3 }), deep, { rng, opacity: 0.22, deform: 0.35, spread: 0.3, granulation: 0.3, fade: { angle: -Math.PI / 2, start: 0.2, ragged: 0.7 } });
    yield;
  }
  const tufts: Pt[] = [
    { x: 40, y: 940 },
    { x: 260, y: 976 },
    { x: 420, y: 930 },
    { x: 1000, y: 1010 },
    { x: 1300, y: 1000 },
    { x: 1560, y: 960 },
  ];
  for (const at of tufts) {
    p.grassTuft(at, { rng, height: rng.range(60, 90), blades: rng.int(9, 14), ground: false, opacity: 0.75 });
    yield;
  }
}
