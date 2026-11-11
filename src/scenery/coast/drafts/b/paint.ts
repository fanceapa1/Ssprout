/**
 * Coast draft B, "Stepped terraces down to the shore": paint steps, back to front, on white
 * (the paper is multiplied last). Light from the upper left.
 */
import { createRng, type Rng } from '../../../../core/rng';
import { PAPER_WHITE, blob, mix, resample, rgba, ribbon, smoothPath, type Painter, type Pigment } from '../../../../paint';
import type { Pt } from '../../../../render/viewport';
import { paintMargins } from '../../../../scene/paint-land';
import { BEACH, CAIQUE, CHAPEL, COLUMNS, COLUMN_BASE, DRUM, FAR_HILL, HORIZON, LAND, OLIVE, PATH, PINE, POOLS, PROMONTORY, SHELF, SPLASH_ROCKS, STEPS_AT, VILLAGE, WALLS } from './layout';

export const C = {
  skyTop: '#9fc4e0',
  skyLow: '#f6e6cf',
  hill: '#b9a7a4',
  hillShade: '#8f8aa3',
  seaFar: '#2f6f9e',
  seaMid: '#2a9db0',
  seaNear: '#5cc6c0',
  shallows: '#a9e0d0',
  sand: '#ecd7ac',
  sandShade: '#c8a97c',
  rock: '#d9d3c4',
  rockShade: '#9d9a95',
  rockWarm: '#d6b88e',
  pine: '#5e7a4a',
  pineDark: '#3e5a3e',
  scrub: '#8a9a62',
  olive: '#93a37e',
  oliveLight: '#bcc6a8',
  oliveDark: '#5e6b52',
  trunk: '#8a7a68',
  gravel: '#e2cfa8',
  lavender: '#9a8cc0',
  magenta: '#c0388c',
  red: '#d2343e',
  marble: '#efe9dc',
  boat: '#2c6aa8',
} satisfies Record<string, Pigment>;

const poly = (pts: readonly Pt[]): Pt[] => pts.map((q) => ({ x: q.x, y: q.y }));

function belowLine(line: readonly Pt[], bottom: number): Pt[] {
  return [...poly(line), { x: line[line.length - 1]!.x, y: bottom }, { x: line[0]!.x, y: bottom }];
}

function reserve(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
  p.ctx.fillStyle = rgba(PAPER_WHITE);
  p.ctx.fill();
  p.ctx.restore();
}

function clipTo(p: Painter, shape: readonly Pt[]): void {
  p.ctx.save();
  p.ctx.beginPath();
  shape.forEach((q, i) => (i ? p.ctx.lineTo(q.x, q.y) : p.ctx.moveTo(q.x, q.y)));
  p.ctx.closePath();
  p.ctx.clip();
}

export function paintSky(p: Painter, rng: Rng): void {
  const sky: Pt[] = [{ x: -20, y: -20 }, { x: 1620, y: -20 }, { x: 1620, y: HORIZON + 10 }, { x: -20, y: HORIZON + 10 }];
  p.wetInWet(sky, C.skyTop, C.skyLow, { rng, angle: Math.PI / 2, split: 0.5, softness: 0.6, opacity: 0.3, edge: 0, granulation: 0.05, flow: 0.5, flowScale: 200 });
}

export function paintFarHill(p: Painter, rng: Rng): void {
  const hill = belowLine(smoothPath(poly(FAR_HILL), 6), HORIZON + 4);
  p.wetInWet(hill, mix(C.hill, C.rockWarm, 0.3), C.hillShade, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.5, deform: 0.04, edge: 0.25, sharpness: 0.7, granulation: 0.35 });
  for (let i = 0; i < 18; i++) {
    p.dab({ x: rng.range(20, 600), y: rng.range(340, 400) }, mix(C.scrub, C.hillShade, 0.5), { rng, variant: 'round', length: rng.range(8, 16), width: rng.range(5, 9), opacity: 0.35 });
  }
  // the village: white cubes reserved, a shade side on the right
  for (const h of VILLAGE) {
    const f: Pt[] = [{ x: h.x, y: h.y }, { x: h.x + h.w, y: h.y }, { x: h.x + h.w, y: h.y + h.h }, { x: h.x, y: h.y + h.h }];
    reserve(p, f);
    p.wash([{ x: h.x + h.w * 0.65, y: h.y }, { x: h.x + h.w, y: h.y }, { x: h.x + h.w, y: h.y + h.h }, { x: h.x + h.w * 0.65, y: h.y + h.h }], C.hillShade, { rng, opacity: 0.4, edge: 0.2, layers: 3 });
    p.stroke([{ x: h.x + 3, y: h.y + h.h * 0.5 }, { x: h.x + 6, y: h.y + h.h * 0.5 }], { rng, pigment: '#4a5468', width: 2, opacity: 0.6 });
  }
  const { x, y } = CHAPEL;
  reserve(p, [{ x: x - 14, y }, { x: x + 14, y }, { x: x + 14, y: y + 22 }, { x: x - 14, y: y + 22 }]);
  p.dab({ x, y: y - 2 }, C.boat, { rng, variant: 'round', length: 22, width: 18, opacity: 0.9 });
  p.stroke([{ x, y: y - 18 }, { x, y: y - 10 }], { rng, pigment: '#4a5468', width: 1.6, opacity: 0.7 });
}

export function paintSea(p: Painter, rng: Rng): void {
  const sea: Pt[] = [{ x: -20, y: HORIZON - 8 }, { x: 1620, y: HORIZON - 8 }, { x: 1620, y: 1020 }, { x: -20, y: 1020 }];
  p.wetInWet(sea, C.seaFar, C.seaMid, { rng, angle: Math.PI / 2, split: 0.35, softness: 0.5, opacity: 0.75, edge: 0.1, granulation: 0.2, flow: 0.5, flowScale: 220 });
  // turquoise then aquamarine shallows toward the beach
  p.glaze([{ x: -20, y: 560 }, { x: 900, y: 560 }, { x: 900, y: 900 }, { x: -20, y: 900 }], C.seaNear, { rng, opacity: 0.6, edge: 0, fade: { angle: -Math.PI / 2, start: 0.2, amount: 1, ragged: 0.6 } });
  p.glaze([{ x: -20, y: 700 }, { x: 900, y: 700 }, { x: 900, y: 880 }, { x: -20, y: 880 }], C.shallows, { rng, opacity: 0.75, edge: 0, blend: 'source-over', fade: { angle: -Math.PI / 2, start: 0.3, amount: 1, ragged: 0.7 } });
  for (let i = 0; i < 26; i++) {
    const y = rng.range(HORIZON + 20, 780);
    const x = rng.range(0, 900);
    p.lift({ cx: x, cy: y, rx: rng.range(20, 70) * (y / 600), ry: 1.4 }, { rng, amount: 0.45, layers: 3 });
  }
  // sand ripples seen through the shallows
  for (let i = 0; i < 14; i++) {
    const y = rng.range(730, 800);
    const x = rng.range(0, 700);
    p.stroke([{ x, y }, { x: x + 40, y: y - 3 }, { x: x + 80, y: y + 1 }], { rng, pigment: C.sandShade, width: 2, opacity: 0.25, wetness: 0.4 });
  }
}

export function paintPromontory(p: Painter, rng: Rng): void {
  const rock = poly(PROMONTORY);
  reserve(p, rock);
  p.wetInWet(rock, C.rock, mix(C.rockShade, C.rockWarm, 0.3), { rng, angle: Math.PI / 2 + 0.3, split: 0.6, softness: 0.6, opacity: 0.6, deform: 0.04, spread: 0.03, edge: 0.4, sharpness: 0.75, granulation: 0.5, granules: 0.2 });
  clipTo(p, rock);
  // cliff face below the pine scrub: vertical fissures and a dark sea-worn foot
  for (let i = 0; i < 26; i++) {
    const x = rng.range(700, 1600);
    const y = rng.range(400, 470);
    p.stroke([{ x, y }, { x: x + rng.range(-6, 6), y: y + rng.range(30, 80) }], { rng, pigment: C.rockShade, width: rng.range(3, 8), taper: [0.1, 0.8], opacity: 0.45, wetness: 0.5 });
  }
  p.glaze([{ x: 660, y: 470 }, { x: 1620, y: 520 }, { x: 1620, y: 570 }, { x: 660, y: 500 }], mix(C.rockShade, C.seaFar, 0.3), { rng, opacity: 0.4, edge: 0.1 });
  // pines and scrub on its back
  for (let x = 960; x < 1640; x += rng.range(30, 60)) {
    const top = 320 - (x - 960) * 0.05;
    const y = top + rng.range(0, 60) + 10;
    p.wetInWet(blob(x, y, rng.range(24, 44), rng.range(12, 20), rng, { irregularity: 0.4 }), C.scrub, C.pineDark, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.6, deform: 0.3, edge: 0.2, granulation: 0.3 });
  }
  for (const [x, y, s] of [[1020, 330, 1], [1180, 290, 1.3], [1300, 270, 1.1], [1480, 260, 1.4]] as const) {
    p.stroke([{ x, y: y + 50 * s }, { x: x + 6, y }], { rng, pigment: C.trunk, width: 4 * s, opacity: 0.7 });
    p.wetInWet(blob(x + 6, y - 6 * s, 50 * s, 18 * s, rng, { irregularity: 0.35, flatBottom: 0.6 }), C.pine, C.pineDark, { rng, angle: Math.PI / 2, split: 0.4, opacity: 0.8, deform: 0.2, edge: 0.3, granulation: 0.3 });
  }
  p.ctx.restore();
}

export function paintTemple(p: Painter, rng: Rng): void {
  // the stylobate
  p.wash([{ x: 752, y: COLUMN_BASE - 6 }, { x: 912, y: COLUMN_BASE - 6 }, { x: 918, y: COLUMN_BASE + 6 }, { x: 746, y: COLUMN_BASE + 6 }], C.rockShade, { rng, opacity: 0.6, edge: 0.3 });
  for (const c of COLUMNS) {
    const w = 16;
    const top = COLUMN_BASE - 6 - c.h;
    const col: Pt[] = [{ x: c.x - w / 2 + 1, y: top }, { x: c.x + w / 2 - 1, y: top + (c.h < 70 ? 6 : 0) }, { x: c.x + w / 2, y: COLUMN_BASE - 6 }, { x: c.x - w / 2, y: COLUMN_BASE - 6 }];
    reserve(p, col);
    p.wash(col, C.marble, { rng, opacity: 0.5, edge: 0.3, sharpness: 0.8, granulation: 0.4 });
    p.wash([{ x: c.x + 2, y: top }, { x: c.x + w / 2, y: top }, { x: c.x + w / 2, y: COLUMN_BASE - 6 }, { x: c.x + 2, y: COLUMN_BASE - 6 }], C.rockShade, { rng, opacity: 0.45, edge: 0.2, layers: 3 });
    for (let k = -1; k <= 1; k++) p.stroke([{ x: c.x + k * 4, y: top + 4 }, { x: c.x + k * 4, y: COLUMN_BASE - 8 }], { rng, pigment: C.rockShade, width: 1, opacity: 0.35 });
    if (c.h > 80) p.wash([{ x: c.x - 12, y: top - 6 }, { x: c.x + 12, y: top - 6 }, { x: c.x + 10, y: top }, { x: c.x - 10, y: top }], C.rockShade, { rng, opacity: 0.6, layers: 3 });
  }
  // a fragment of architrave on the two tall columns, and the fallen drum
  const t = COLUMN_BASE - 6 - 96 - 6;
  p.wash([{ x: 760, y: t - 12 }, { x: 826, y: t - 12 }, { x: 824, y: t }, { x: 762, y: t }], mix(C.marble, C.rockShade, 0.4), { rng, opacity: 0.7, edge: 0.3 });
  const d = blob(DRUM.x, DRUM.y - 6, 18, 10, rng, { irregularity: 0.1 });
  reserve(p, d);
  p.wash(d, mix(C.marble, C.rockShade, 0.3), { rng, opacity: 0.6, edge: 0.3 });
}

export function paintCaique(p: Painter, rng: Rng): void {
  const { x, y } = CAIQUE;
  const hull: Pt[] = [{ x: x - 46, y: y - 14 }, { x: x + 50, y: y - 16 }, { x: x + 36, y }, { x: x - 34, y }];
  reserve(p, hull);
  p.wash(hull, PAPER_WHITE, { rng, opacity: 1, blend: 'source-over', layers: 2, edge: 0 });
  p.stroke([{ x: x - 44, y: y - 10 }, { x: x + 46, y: y - 12 }], { rng, pigment: C.boat, width: 4, opacity: 0.85 });
  p.stroke([{ x: x - 36, y: y - 2 }, { x: x + 34, y: y - 2 }], { rng, pigment: C.red, width: 3, opacity: 0.7 });
  p.wash([{ x: x - 10, y: y - 30 }, { x: x + 12, y: y - 30 }, { x: x + 12, y: y - 15 }, { x: x - 10, y: y - 15 }], C.marble, { rng, opacity: 0.6, layers: 2 });
  p.stroke([{ x: x - 4, y: y - 54 }, { x: x - 4, y: y - 15 }], { rng, pigment: '#5a4a3a', width: 1.6, opacity: 0.7 });
  p.glaze(blob(x, y + 8, 60, 6, rng), C.seaFar, { rng, opacity: 0.3, edge: 0 });
}

export function paintShore(p: Painter, rng: Rng): void {
  const beach = poly(BEACH);
  reserve(p, beach);
  p.wetInWet(beach, C.sand, mix(C.sand, C.sandShade, 0.5), { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.7, deform: 0.05, edge: 0.15, granulation: 0.55, granules: 0.3 });
  for (let i = 0; i < 80; i++) {
    p.dab({ x: rng.range(0, 600), y: rng.range(820, 900) }, mix(C.rockShade, C.sandShade, rng.next()), { rng, variant: 'round', length: rng.range(4, 9), width: rng.range(3, 6), opacity: 0.5 });
  }
  // wet line and foam where the sea laps the sand
  const lap = resample(smoothPath(poly(BEACH.slice(0, 5)), 6), 10);
  p.stroke(lap.map((q) => ({ x: q.x, y: q.y + 6 })), { rng, pigment: C.sandShade, width: 8, opacity: 0.35, wetness: 0.6 });
  p.stroke(lap.map((q) => ({ x: q.x, y: q.y - 3 })), { rng, pigment: PAPER_WHITE, width: 5, opacity: 0.9, blend: 'source-over', wetness: 0.3 });
  const shelf = poly(SHELF);
  reserve(p, shelf);
  p.wetInWet(shelf, C.rock, C.rockShade, { rng, angle: Math.PI / 2, split: 0.4, opacity: 0.65, deform: 0.05, edge: 0.3, sharpness: 0.6, granulation: 0.6, granules: 0.25 });
  for (let i = 0; i < 12; i++) {
    const x = rng.range(0, 540);
    const y = rng.range(910, 1010);
    p.dryBrush([{ x, y }, { x: x + rng.range(40, 120), y: y + rng.range(-6, 6) }], { rng, pigment: C.rockShade, width: rng.range(3, 6), opacity: 0.4, dryness: 0.6 });
  }
  for (const pool of POOLS) {
    const b = blob(pool.cx, pool.cy, pool.rx, pool.ry, rng, { irregularity: 0.25 });
    p.wash(blob(pool.cx, pool.cy + 3, pool.rx + 6, pool.ry + 4, rng), C.rockShade, { rng, opacity: 0.5, edge: 0.2 });
    reserve(p, b);
    p.wetInWet(b, C.shallows, C.seaMid, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.75, edge: 0.3, sharpness: 0.8 });
    p.lift({ cx: pool.cx - pool.rx * 0.3, cy: pool.cy - pool.ry * 0.3, rx: pool.rx * 0.4, ry: 1.5 }, { rng, amount: 0.5, layers: 3 });
  }
  for (const [x, y, w] of SPLASH_ROCKS) {
    p.stone({ x, y, w, h: w * 0.55 }, { rng, pigment: C.rock, warm: 0.3, moss: 0, ink: 0.2 });
    p.stroke([{ x: x - w * 0.6, y: y + 4 }, { x: x + w * 0.6, y: y + 6 }], { rng, pigment: PAPER_WHITE, width: 4, opacity: 0.85, blend: 'source-over', wetness: 0.3 });
  }
}

export function paintLand(p: Painter, rng: Rng): void {
  const land = poly(LAND);
  reserve(p, land);
  p.wetInWet(land, mix(C.gravel, C.rockWarm, 0.3), mix(C.scrub, C.gravel, 0.5), { rng, angle: Math.PI / 2, split: 0.5, softness: 0.5, opacity: 0.6, deform: 0.04, edge: 0.15, granulation: 0.5, granules: 0.2, flow: 0.5, flowScale: 160 });
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const q = t < 0.5 ? { x: 900 - 280 * t * 2, y: 600 + 246 * t * 2 } : { x: 640 - 120 * (t - 0.5) * 2, y: 846 + 174 * (t - 0.5) * 2 };
    p.wetInWet(blob(q.x + rng.range(-10, 20), q.y, rng.range(30, 60), rng.range(14, 24), rng, { irregularity: 0.4, flatBottom: 0.5 }), C.scrub, C.pineDark, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.65, deform: 0.3, edge: 0.2, granulation: 0.3 });
  }
  // the gravel path and its steps
  const walk = smoothPath(poly(PATH), 8);
  const half = (t: number) => 18 + 40 * t;
  p.glaze(ribbon(walk, half), C.gravel, { rng, opacity: 0.7, deform: 0.15, edge: 0.05, granulation: 0.5, granules: 0.3, blend: 'source-over' });
  for (let i = 0; i < 160; i++) {
    const t = rng.next();
    const q = walk[Math.floor(t * (walk.length - 1))]!;
    p.dab({ x: q.x + rng.range(-1, 1) * half(t), y: q.y + rng.range(-6, 6) }, C.sandShade, { rng, variant: 'round', length: 3 + t * 4, width: 2 + t * 3, opacity: 0.4 });
  }
  for (const s of STEPS_AT) {
    for (let k = 0; k < 3; k++) {
      const y = s.y + k * 14;
      p.wash([{ x: s.x - 34, y }, { x: s.x + 34, y }, { x: s.x + 36, y: y + 10 }, { x: s.x - 36, y: y + 10 }], C.rock, { rng, opacity: 0.7, edge: 0.3, layers: 3 });
      p.stroke([{ x: s.x - 36, y: y + 11 }, { x: s.x + 36, y: y + 11 }], { rng, pigment: C.rockShade, width: 3, opacity: 0.6 });
    }
  }
}

function paintWall(p: Painter, edge: readonly Pt[], h: number, rng: Rng): void {
  const top = resample(smoothPath(poly(edge), 8), 12);
  const face = [...top, ...top.slice().reverse().map((q) => ({ x: q.x, y: q.y + h }))];
  reserve(p, face);
  p.wetInWet(face, C.rock, mix(C.rockShade, C.rockWarm, 0.3), { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.65, deform: 0.04, edge: 0.2, sharpness: 0.6, granulation: 0.5 });
  // dry-stone courses: irregular stones outlined in shade
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
  p.glaze(top.map((q) => ({ x: q.x, y: q.y + h })).concat(top.slice().reverse().map((q) => ({ x: q.x - 6, y: q.y + h + 12 }))), C.hillShade, { rng, opacity: 0.35, edge: 0.05, fade: { angle: Math.PI / 2, start: 0.3, amount: 1 } });
}

export function paintWalls(p: Painter, rng: Rng): void {
  for (const w of WALLS) paintWall(p, w.edge, w.h, rng.fork(`wall-${w.edge[0]!.y}`));
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

export function paintBeds(p: Painter, rng: Rng): void {
  const beds: [number, number, number, number, Pigment][] = [
    [1150, 640, 90, 26, C.magenta], [1500, 600, 110, 30, C.red], [1080, 790, 70, 24, C.red],
    [1500, 760, 120, 34, C.magenta], [1260, 980, 160, 44, C.magenta], [960, 990, 120, 36, C.red], [740, 980, 80, 30, C.magenta],
  ];
  for (const [x, y, rx, ry, pig] of beds) mat(p, x, y, rx, ry, pig, rng.fork(`mat-${x}-${y}`));
  for (const [x, y, r] of [[1260, 640, 50], [1600, 620, 40], [1290, 790, 64], [1580, 980, 80], [640, 930, 50]] as const) lavender(p, x, y, r, rng.fork(`lav-${x}`));
  // wall-crack tufts
  for (const w of WALLS) {
    for (let i = 0; i < 6; i++) {
      const q = w.edge[Math.floor(rng.range(0, w.edge.length))]!;
      p.dab({ x: q.x + rng.range(-60, 60), y: q.y + rng.range(10, w.h - 6) }, C.scrub, { rng, variant: 'round', length: rng.range(10, 18), width: rng.range(6, 10), opacity: 0.6 });
    }
  }
}

export function paintOlive(p: Painter, rng: Rng): void {
  const { base, crown } = OLIVE;
  p.glaze(blob(base.x + 20, base.y + 6, 150, 18, rng), C.hillShade, { rng, opacity: 0.35, edge: 0.05 });
  // a fat twisted trunk: several strands braided up
  for (let s = 0; s < 4; s++) {
    const off = (s - 1.5) * 16;
    const pts: Pt[] = [];
    for (let t = 0; t <= 1.001; t += 0.1) pts.push({ x: base.x + off * (1 - t * 0.5) + Math.sin(t * 5 + s) * 14, y: base.y - (base.y - crown.y - 60) * t });
    p.stroke(pts, { rng, pigment: s % 2 ? C.trunk : mix(C.trunk, C.rockShade, 0.4), width: 46 - s * 5, taper: [0, 0.3], opacity: 0.8, wetness: 0.4, dryness: 0.3, wobble: 0.3 });
  }
  p.dryBrush([{ x: base.x - 30, y: base.y - 10 }, { x: base.x - 20, y: base.y - 140 }, { x: base.x - 10, y: crown.y + 80 }], { rng, pigment: C.marble, width: 10, opacity: 0.5, dryness: 0.6, blend: 'source-over' });
  for (const a of [-2.4, -1.9, -1.2, -0.7]) {
    p.stroke([{ x: base.x, y: crown.y + 70 }, { x: base.x + Math.cos(a) * 140, y: crown.y + 70 + Math.sin(a) * 90 }], { rng, pigment: C.trunk, width: 9, taper: [0, 0.8], opacity: 0.7 });
  }
  // the crown: clumps, dark under, silver on top
  for (let i = 0; i < 16; i++) {
    const x = crown.x + rng.range(-230, 230);
    const y = crown.y + rng.range(-120, 70);
    p.wetInWet(blob(x, y, rng.range(50, 90), rng.range(30, 50), rng, { irregularity: 0.45 }), C.oliveLight, C.oliveDark, { rng, angle: Math.PI / 2, split: 0.5, opacity: 0.75, deform: 0.3, spread: 0.2, edge: 0.25, granulation: 0.3 });
  }
  for (let i = 0; i < 260; i++) {
    const x = crown.x + rng.range(-250, 250);
    const y = crown.y + rng.range(-150, 90);
    if (((x - crown.x) / 250) ** 2 + ((y - crown.y + 30) / 130) ** 2 > 1) continue;
    p.dab({ x, y }, rng.chance(0.4) ? C.oliveLight : C.olive, { rng, variant: 'blade', angle: rng.range(-1, 1) - Math.PI / 4, length: rng.range(10, 16), width: 3, opacity: 0.55 });
  }
}

export function paintPine(p: Painter, rng: Rng): void {
  const { base, top } = PINE;
  p.stone({ x: base.x, y: base.y + 10, w: 150, h: 70 }, { rng, pigment: C.rock, warm: 0.3, moss: 0.1, ink: 0.2 });
  const trunk = smoothPath([base, { x: base.x + 80, y: (base.y + top.y) / 2 + 20 }, top], 6);
  p.stroke(trunk, { rng, pigment: mix(C.trunk, '#7a4a3a', 0.4), width: 18, taper: [0, 0.4], opacity: 0.8, wetness: 0.35, wobble: 0.3 });
  p.stroke([{ x: top.x - 10, y: top.y + 40 }, { x: top.x + 120, y: top.y - 10 }], { rng, pigment: C.trunk, width: 8, taper: [0, 0.7], opacity: 0.7 });
  for (const [dx, dy, rx] of [[0, 0, 150], [120, -20, 110], [-60, 20, 100], [60, 40, 120]] as const) {
    p.wetInWet(blob(top.x + dx, top.y + dy - 20, rx, rx * 0.32, rng, { irregularity: 0.4, flatBottom: 0.6 }), C.pine, C.pineDark, { rng, angle: Math.PI / 2, split: 0.45, opacity: 0.75, deform: 0.25, edge: 0.3, granulation: 0.35 });
  }
}

export function paintMargin(p: Painter, rng: Rng): void {
  const m = paintMargins(p, rng);
  while (!m.next().done);
}

export interface DraftStep {
  name: string;
  run(p: Painter, rng: Rng): void;
}
export const STEPS: readonly DraftStep[] = [
  { name: 'sky', run: paintSky },
  { name: 'far-hill', run: paintFarHill },
  { name: 'sea', run: paintSea },
  { name: 'promontory', run: paintPromontory },
  { name: 'temple', run: paintTemple },
  { name: 'caique', run: paintCaique },
  { name: 'shore', run: paintShore },
  { name: 'land', run: paintLand },
  { name: 'walls', run: paintWalls },
  { name: 'beds', run: paintBeds },
  { name: 'olive', run: paintOlive },
  { name: 'pine', run: paintPine },
];

export function paintDraftB(p: Painter, seed: number, only?: readonly string[]): void {
  const root = createRng(seed);
  for (const s of STEPS) {
    const rng = root.fork(s.name);
    if (only && !only.includes(s.name)) continue;
    s.run(p, rng);
  }
}
