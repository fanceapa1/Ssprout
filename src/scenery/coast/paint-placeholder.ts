/**
 * The coast's placeholder painting (G1): draft B's steps (`drafts/b/paint.ts`) moved onto the final
 * layout, back to front, on white (the sky plates and the paper are multiplied over it). Lit from
 * the upper left. The real painters (rock, water, land and vegetation) replace these steps.
 */
import type { Rng } from '../../core/rng';
import { PAPER_WHITE, blob, mix, resample, ribbon, rgba, smoothPath, type Painter, type Pigment } from '../../paint';
import type { Pt } from '../../render/viewport';
import { C } from './drafts/b/paint';
import {
  BEACH, CAIQUE, HORIZON, LAND, OLIVE, PATH, PINE, POOLS, PROMONTORY,
  PROMONTORY_PINES, SHORE_SCRUB, STEPS, WALLS, WATERLINE_EDGE,
} from './layout';

const poly = (pts: readonly Pt[]): Pt[] => pts.map((q) => ({ x: q.x, y: q.y }));

function fillPath(p: Painter, shape: readonly Pt[]): void {
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
}

function reserve(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  fillPath(p, shape);
  p.ctx.fillStyle = rgba(PAPER_WHITE);
  p.ctx.fill();
  p.ctx.restore();
}

export function paintSea(p: Painter, rng: Rng): void {
  const sea: Pt[] = [{ x: -20, y: HORIZON - 4 }, { x: 1620, y: HORIZON - 4 }, { x: 1620, y: 1020 }, { x: -20, y: 1020 }];
  p.wetInWet(sea, C.seaFar, C.seaMid, { rng, angle: Math.PI / 2, split: 0.35, softness: 0.5, opacity: 0.75, edge: 0.1, granulation: 0.2, flow: 0.5, flowScale: 220 });
  // turquoise, then aquamarine shallows toward the beach and the shoreline
  p.glaze([{ x: -20, y: 560 }, { x: 860, y: 560 }, { x: 860, y: 900 }, { x: -20, y: 900 }], C.seaNear, { rng, opacity: 0.6, edge: 0, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.6 } });
  p.glaze([{ x: -20, y: 700 }, { x: 800, y: 700 }, { x: 800, y: 880 }, { x: -20, y: 880 }], C.shallows, { rng, opacity: 0.75, edge: 0, blend: 'source-over', fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.7 } });
  for (let i = 0; i < 26; i++) {
    const y = rng.range(HORIZON + 20, 780);
    p.lift({ cx: rng.range(0, 820), cy: y, rx: rng.range(20, 70) * (y / 600), ry: 1.4 }, { rng, amount: 0.45, layers: 3 });
  }
  for (let i = 0; i < 14; i++) {
    const y = rng.range(730, 800);
    const x = rng.range(0, 640);
    p.stroke([{ x, y }, { x: x + 40, y: y - 3 }, { x: x + 80, y: y + 1 }], { rng, pigment: C.sandShade, width: 2, opacity: 0.25, wetness: 0.4 });
  }
}

export function paintCaique(p: Painter, rng: Rng): void {
  const { x, y } = CAIQUE;
  const k = 0.8;
  const at = (dx: number, dy: number): Pt => ({ x: x + dx * k, y: y + dy * k });
  const hull = [at(-46, -14), at(50, -16), at(36, 0), at(-34, 0)];
  reserve(p, hull);
  p.stroke([at(-44, -10), at(46, -12)], { rng, pigment: C.boat, width: 4 * k, opacity: 0.85 });
  p.stroke([at(-36, -2), at(34, -2)], { rng, pigment: C.red, width: 3 * k, opacity: 0.7 });
  p.wash([at(-10, -30), at(12, -30), at(12, -15), at(-10, -15)], C.marble, { rng, opacity: 0.6, layers: 2 });
  p.stroke([at(-4, -54), at(-4, -15)], { rng, pigment: '#5a4a3a', width: 1.6, opacity: 0.7 });
  p.glaze(blob(x, y + 6, 50, 5, rng), C.seaFar, { rng, opacity: 0.3, edge: 0 });
}

/** The pines and scrub on the promontory (G4's): over the rock painter's cliff. */
export function paintPromontoryGreen(p: Painter, rng: Rng): void {
  const rock = poly(PROMONTORY);
  p.ctx.save();
  fillPath(p, rock);
  p.ctx.clip();
  for (let x = 900; x < 1640; x += rng.range(30, 60)) {
    const y = 360 - (x - 900) * 0.07 + rng.range(10, 60);
    p.wetInWet(blob(x, y, rng.range(24, 44), rng.range(12, 20), rng, { irregularity: 0.4 }), C.scrub, C.pineDark, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.6, deform: 0.3, edge: 0.2, granulation: 0.3 });
  }
  p.ctx.restore();
  for (const t of PROMONTORY_PINES) {
    p.stroke([{ x: t.x - 4, y: t.y + t.ry * 2.6 }, { x: t.x + 2, y: t.y }], { rng, pigment: C.trunk, width: 3 + t.rx / 20, opacity: 0.7 });
    p.wetInWet(blob(t.x, t.y, t.rx, t.ry, rng, { irregularity: 0.3, flatBottom: 0.6 }), C.pine, C.pineDark, { rng, angle: Math.PI / 2, split: 0.4, opacity: 0.8, deform: 0.15, edge: 0.3, granulation: 0.3 });
  }
}

export function paintShore(p: Painter, rng: Rng): void {
  const beach = poly(BEACH);
  reserve(p, beach);
  p.wetInWet(beach, C.sand, mix(C.sand, C.sandShade, 0.5), { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.7, deform: 0.05, edge: 0.15, granulation: 0.55, granules: 0.3 });
  for (let i = 0; i < 80; i++) {
    p.dab({ x: rng.range(0, 620), y: rng.range(820, 900) }, mix(C.rockShade, C.sandShade, rng.next()), { rng, variant: 'round', length: rng.range(4, 9), width: rng.range(3, 6), opacity: 0.5 });
  }
  const lap = resample(smoothPath(poly(WATERLINE_EDGE), 6), 10);
  p.stroke(lap.map((q) => ({ x: q.x, y: q.y + 6 })), { rng, pigment: C.sandShade, width: 8, opacity: 0.35, wetness: 0.6 });
  p.stroke(lap.map((q) => ({ x: q.x, y: q.y - 3 })), { rng, pigment: PAPER_WHITE, width: 5, opacity: 0.9, blend: 'source-over', wetness: 0.3 });
  for (const pool of POOLS) {
    const b = blob(pool.cx, pool.cy, pool.rx, pool.ry, rng, { irregularity: 0.25 });
    p.wash(blob(pool.cx, pool.cy + 3, pool.rx + 6, pool.ry + 4, rng), C.rockShade, { rng, opacity: 0.5, edge: 0.2 });
    reserve(p, b);
    p.wetInWet(b, C.shallows, C.seaMid, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.75, edge: 0.3, sharpness: 0.8 });
    p.lift({ cx: pool.cx - pool.rx * 0.3, cy: pool.cy - pool.ry * 0.3, rx: pool.rx * 0.4, ry: 1.5 }, { rng, amount: 0.5, layers: 3 });
  }
}

export function paintLand(p: Painter, rng: Rng): void {
  const land = poly(LAND);
  reserve(p, land);
  p.wetInWet(land, mix(C.gravel, C.rockWarm, 0.3), mix(C.scrub, C.gravel, 0.5), { rng, angle: Math.PI / 2, split: 0.5, softness: 0.5, opacity: 0.6, deform: 0.04, edge: 0.15, granulation: 0.5, granules: 0.2, flow: 0.5, flowScale: 160 });
  // scrub over the broken shoreline (its rock and boulders are the rock painter's `shore-rocks`)
  for (const s of SHORE_SCRUB) {
    p.wetInWet(blob(s.x, s.y, s.rx, s.ry, rng, { irregularity: 0.4, flatBottom: 0.5 }), C.scrub, C.pineDark, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.65, deform: 0.3, edge: 0.2, granulation: 0.3 });
  }
  // the gravel path, widening toward the viewer, and its stone flights
  const walk = smoothPath(poly(PATH).reverse(), 8);
  const half = (t: number) => 16 + 34 * t;
  p.glaze(ribbon(walk, half), C.gravel, { rng, opacity: 0.7, deform: 0.15, edge: 0.05, granulation: 0.5, granules: 0.3, blend: 'source-over' });
  for (let i = 0; i < 160; i++) {
    const t = rng.next();
    const q = walk[Math.floor(t * (walk.length - 1))]!;
    p.dab({ x: q.x + rng.range(-1, 1) * half(t), y: q.y + rng.range(-6, 6) }, C.sandShade, { rng, variant: 'round', length: 3 + t * 4, width: 2 + t * 3, opacity: 0.4 });
  }
}

/** The stone flights, after the walls so they cross them. */
function paintSteps(p: Painter, rng: Rng): void {
  for (const s of STEPS) {
    for (let k = 0; k < s.n; k++) {
      const y = s.y + k * 15;
      const w = 26 + k * 3;
      p.wash([{ x: s.x - w, y }, { x: s.x + w, y }, { x: s.x + w + 2, y: y + 10 }, { x: s.x - w - 2, y: y + 10 }], C.rock, { rng, opacity: 0.8, edge: 0.3, layers: 3 });
      p.stroke([{ x: s.x - w - 2, y: y + 11 }, { x: s.x + w + 2, y: y + 11 }], { rng, pigment: C.rockShade, width: 3, opacity: 0.6 });
    }
  }
}

function paintWall(p: Painter, edge: readonly Pt[], h: number, rng: Rng): void {
  const top = resample(smoothPath(poly(edge), 8), 12);
  const face = [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + h }))];
  reserve(p, face);
  p.wetInWet(face, C.rock, mix(C.rockShade, C.rockWarm, 0.3), { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.65, deform: 0.04, edge: 0.2, sharpness: 0.6, granulation: 0.5 });
  const x0 = top[0]!.x;
  const x1 = top[top.length - 1]!.x;
  for (let row = 0; row < 3; row++) {
    for (let x = x0 + rng.range(0, 20); x < x1 - 10; x += rng.range(26, 50)) {
      const t = (x - x0) / (x1 - x0);
      const y = top[Math.floor(t * (top.length - 1))]!.y + 4 + (row * h) / 3;
      const w = rng.range(20, 44);
      p.stone({ x: x + w / 2, y: y + h / 6, w, h: h / 3.4 }, { rng, pigment: mix(C.rock, C.rockWarm, rng.next() * 0.5), warm: 0.4, moss: 0.05, ink: 0.25 });
    }
  }
  p.stroke(top.map((q) => ({ x: q.x, y: q.y + 1 })), { rng, pigment: PAPER_WHITE, width: 3, opacity: 0.6, blend: 'source-over', taper: [0.02, 0.02] });
  p.glaze(top.map((q) => ({ x: q.x, y: q.y + h })).concat(top.slice().reverse().map((q) => ({ x: q.x + 6, y: q.y + h + 12 }))), C.hillShade, { rng, opacity: 0.35, edge: 0.05, fade: { angle: Math.PI / 2, start: 0.3, amount: 1 } });
}

export function paintWalls(p: Painter, rng: Rng): void {
  for (const w of WALLS) paintWall(p, w.edge, w.h, rng.fork(`wall-${w.edge[0]!.y}`));
  paintSteps(p, rng.fork('steps'));
}

function mat(p: Painter, cx: number, cy: number, rx: number, ry: number, pig: Pigment, rng: Rng): void {
  p.wetInWet(blob(cx, cy, rx, ry, rng, { irregularity: 0.3, flatBottom: 0.5 }), mix(C.scrub, C.pineDark, 0.3), C.scrub, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.6, deform: 0.2, edge: 0.2, granulation: 0.3 });
  const n = Math.round((rx * ry) / 14);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next());
    p.dab({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r - ry * 0.2 }, mix(pig, PAPER_WHITE, rng.range(0, 0.35)), { rng, variant: 'round', length: rng.range(7, 13) * (cy / 600), width: rng.range(6, 10) * (cy / 600), opacity: 0.85 });
  }
}

function lavender(p: Painter, cx: number, cy: number, r: number, rng: Rng): void {
  p.wetInWet(blob(cx, cy, r, r * 0.6, rng, { irregularity: 0.2, flatBottom: 0.6 }), mix(C.olive, C.oliveLight, 0.4), C.oliveDark, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.6, deform: 0.15, edge: 0.2 });
  for (let i = 0; i < r * 0.8; i++) {
    const x = cx + rng.range(-r, r) * 0.9;
    const y = cy - r * 0.4 + rng.range(-r * 0.2, r * 0.2);
    p.stroke([{ x, y }, { x: x + rng.range(-8, 8), y: y - rng.range(14, 30) }], { rng, pigment: C.olive, width: 1.2, opacity: 0.5 });
    p.dab({ x: x + rng.range(-8, 8), y: y - rng.range(18, 34) }, C.lavender, { rng, variant: 'blade', angle: -Math.PI / 2, length: rng.range(8, 14), width: 4, opacity: 0.7 });
  }
}

/** The terrace beds' flower mats and lavender, kept off the slots' bases so plants stand in open beds. */
export function paintBeds(p: Painter, rng: Rng): void {
  const beds: [number, number, number, number, Pigment][] = [
    [1150, 540, 50, 14, C.magenta], [1480, 540, 60, 16, C.red], [1000, 676, 46, 16, C.red], [1220, 664, 60, 18, C.magenta],
    [1500, 666, 70, 20, C.red], [910, 812, 54, 18, C.magenta], [1330, 806, 80, 22, C.red], [1130, 960, 100, 28, C.magenta], [1440, 966, 80, 26, C.red],
  ];
  for (const [x, y, rx, ry, pig] of beds) mat(p, x, y, rx, ry, pig, rng.fork(`mat-${x}-${y}`));
  for (const [x, y, r] of [[1360, 546, 34], [1370, 666, 40], [1100, 806, 44], [1060, 970, 50], [760, 940, 34]] as const) lavender(p, x, y, r, rng.fork(`lav-${x}`));
  for (const w of WALLS) {
    for (let i = 0; i < 6; i++) {
      const q = w.edge[Math.floor(rng.range(0, w.edge.length))]!;
      p.dab({ x: q.x + rng.range(-60, 60), y: q.y + rng.range(10, w.h - 6) }, C.scrub, { rng, variant: 'round', length: rng.range(10, 18), width: rng.range(6, 10), opacity: 0.6 });
    }
  }
}

export function paintOlive(p: Painter, rng: Rng): void {
  const { base, crown, rx, ry } = OLIVE;
  p.glaze(blob(base.x + 30, base.y + 8, 140, 16, rng), C.hillShade, { rng, opacity: 0.35, edge: 0.05 });
  for (let s = 0; s < 4; s++) {
    const off = (s - 1.5) * 14;
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.1) pts.push({ x: base.x + off * (1 - t * 0.5) + Math.sin(t * 5 + s) * 12, y: base.y - (base.y - crown.y - 50) * t });
    p.stroke(pts, { rng, pigment: s % 2 ? C.trunk : mix(C.trunk, C.rockShade, 0.4), width: 40 - s * 5, taper: [0, 0.3], opacity: 0.8, wetness: 0.4, dryness: 0.3, wobble: 0.3 });
  }
  for (const a of [-2.4, -1.9, -1.2, -0.7]) {
    p.stroke([{ x: base.x, y: crown.y + 60 }, { x: base.x + Math.cos(a) * 120, y: crown.y + 60 + Math.sin(a) * 80 }], { rng, pigment: C.trunk, width: 8, taper: [0, 0.8], opacity: 0.7 });
  }
  for (let i = 0; i < 14; i++) {
    const x = crown.x + rng.range(-rx + 50, rx - 50);
    const y = crown.y + rng.range(-ry + 20, ry - 50);
    p.wetInWet(blob(x, y, rng.range(46, 80), rng.range(28, 44), rng, { irregularity: 0.45 }), C.oliveLight, C.oliveDark, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.75, deform: 0.3, spread: 0.2, edge: 0.25, granulation: 0.3 });
  }
  for (let i = 0; i < 220; i++) {
    const x = crown.x + rng.range(-rx, rx);
    const y = crown.y + rng.range(-ry, ry);
    if (((x - crown.x) / rx) ** 2 + ((y - crown.y) / ry) ** 2 > 1) continue;
    p.dab({ x, y }, rng.chance(0.4) ? C.oliveLight : C.olive, { rng, variant: 'blade', angle: rng.range(-1, 1) - Math.PI / 4, length: rng.range(10, 16), width: 3, opacity: 0.55 });
  }
}

export function paintPine(p: Painter, rng: Rng): void {
  const { base, top } = PINE;
  p.stone({ x: base.x, y: base.y + 8, w: 140, h: 64 }, { rng, pigment: C.rock, warm: 0.3, moss: 0.1, ink: 0.2 });
  const trunk = smoothPath([base, { x: base.x + 76, y: (base.y + top.y) / 2 + 20 }, top], 6);
  p.stroke(trunk, { rng, pigment: mix(C.trunk, '#7a4a3a', 0.4), width: 18, taper: [0, 0.4], opacity: 0.8, wetness: 0.35, wobble: 0.3 });
  p.stroke([{ x: top.x - 10, y: top.y + 40 }, { x: top.x + 110, y: top.y - 10 }], { rng, pigment: C.trunk, width: 8, taper: [0, 0.7], opacity: 0.7 });
  for (const [dx, dy, rx] of [[0, 0, 140], [110, -20, 100], [-60, 20, 90], [60, 40, 110]] as const) {
    p.wetInWet(blob(top.x + dx, top.y + dy - 20, rx, rx * 0.32, rng, { irregularity: 0.4, flatBottom: 0.6 }), C.pine, C.pineDark, { rng, angle: Math.PI / 2, split: 0.45, opacity: 0.75, deform: 0.25, edge: 0.3, granulation: 0.35 });
  }
}
