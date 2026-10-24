/**
 * The engine's long calls in parts (ADR 0238): painting a call a part at a time must give exactly
 * the pixels and canvas calls of the one-call form. The hashes below were pinned against the
 * engine before it could pause (whole-surface drying, recipes in one call).
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { PaintRecorder } from '../scene/paint-record';
import { acquireWork } from './canvas';
import { createPainter, makeCanvas, type Painter } from './index';
import { createSimplex2D, noiseGrid } from './noise';
import { paperGrain, GRAIN_SIZE } from './paper';
import { PIGMENTS } from './pigments';
import { DRY_DEFAULTS, dryPixels, resolveDry, type GrainLookup, type OpenSides } from './wet';

/** FNV-1a over every byte. */
function fnv(data: ArrayLike<number>): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data[i]!, 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** A varied wet layer: soft overlapping blobs of coverage, some empty paper, a few stray specks. */
function wetBuffer(w: number, h: number, seed: string): Uint8ClampedArray {
  const rng = createRng(seed);
  const d = new Uint8ClampedArray(w * h * 4);
  const blobs = Array.from({ length: 7 }, () => ({ x: rng.range(0, w), y: rng.range(0, h), r: rng.range(w * 0.08, w * 0.35), a: rng.range(0.3, 1) }));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (const b of blobs) {
        const k = 1 - Math.hypot(x - b.x, (y - b.y) * 1.4) / b.r;
        if (k > 0) a = Math.min(1, a + b.a * Math.min(1, k * 3));
      }
      if (rng.next() < 0.01) a = rng.range(0, 0.2);
      const i = (y * w + x) * 4;
      d[i] = 90 + ((x * 7) & 63);
      d[i + 1] = 120 + ((y * 5) & 63);
      d[i + 2] = 80 + ((x + y) & 31);
      d[i + 3] = a * 255;
    }
  return d;
}

/** The paper grain looked up per pixel, as a wet layer does. */
function grainFor(w: number, h: number, scale = 0.8): GrainLookup {
  const cols = new Int32Array(w);
  const rows = new Int32Array(h);
  const mask = GRAIN_SIZE - 1;
  for (let x = 0; x < w; x++) cols[x] = Math.floor(3 + x / scale) & mask;
  for (let y = 0; y < h; y++) rows[y] = (Math.floor(5 + y / scale) & mask) * GRAIN_SIZE;
  return { data: paperGrain(1).data, cols, rows };
}

const OPEN: OpenSides = { l: true, t: false, r: false, b: true };
const CLOSED: OpenSides = { l: false, t: false, r: false, b: false };

/** Drying cases: the half-resolution edge blur and the small one, open and closed sides, every option branch. */
const DRY_CASES = [
  { name: 'wash', w: 157, h: 93, edgePx: 6, open: CLOSED, o: {} },
  { name: 'open sides, wide rim', w: 211, h: 67, edgePx: 14, open: OPEN, o: { edge: 0.6, flowScale: 30 } },
  { name: 'small rim (full-resolution blur)', w: 64, h: 49, edgePx: 2.5, open: OPEN, o: { sharpness: 0.9, centreLift: 0.4 } },
  { name: 'granules, dry brush', w: 120, h: 75, edgePx: 4, open: CLOSED, o: { granules: 0.4, dry: 0.5, granulation: 0.5 } },
  { name: 'speckle, no flow', w: 99, h: 101, edgePx: 3, open: CLOSED, o: { speckle: 0.6, flow: 0 } },
  { name: 'a sliver', w: 300, h: 5, edgePx: 5, open: OPEN, o: {} },
];

function dryCase(c: (typeof DRY_CASES)[number]) {
  const data = wetBuffer(c.w, c.h, c.name);
  const o = resolveDry(c.o, DRY_DEFAULTS);
  const flow = o.flow > 0 ? noiseGrid(createSimplex2D(createRng('flow')), c.w, c.h, 4, o.flowScale, { octaves: 3, ox: 11, oy: -7 }) : null;
  return { data, o, flow, grain: grainFor(c.w, c.h) };
}

describe('the drying pass, pinned (ADR 0238)', () => {
  const PINNED: Record<string, string> = {
    wash: '215f8b49',
    'open sides, wide rim': '1204faba',
    'small rim (full-resolution blur)': 'e9ad8617',
    'granules, dry brush': '6020932b',
    'speckle, no flow': '5f286bed',
    'a sliver': '1a9a7986',
  };
  it.each(DRY_CASES.map((c) => [c.name, c] as const))('dries %s exactly as before', (name, c) => {
    const { data, o, flow, grain } = dryCase(c);
    dryPixels(data, c.w, c.h, o, c.edgePx, grain, flow, c.open);
    expect(fnv(data)).toBe(PINNED[name]);
  });
});

/** Paint with `fn` on a recording canvas: the hash of every canvas call (and of every dried pixel). */
function recorded(fn: (p: Painter) => void): string {
  emptyPool();
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const p = createPainter(makeCanvas(480, 320), { seed: 7 });
    p.ctx.setTransform(1.6, 0, 0, 1.6, -40, -30);
    fn(p);
    return rec.hash;
  } finally {
    uninstall();
  }
}

/** Take every pooled work canvas out of the pool, so a recording starts the same whatever ran before it. */
function emptyPool(): void {
  const uninstall = new PaintRecorder().install();
  try {
    for (let i = 0; i < 4; i++) acquireWork(1, 1);
  } finally {
    uninstall();
  }
}

const POND = [
  { x: 60, y: 60 },
  { x: 220, y: 48 },
  { x: 300, y: 90 },
  { x: 280, y: 170 },
  { x: 140, y: 190 },
  { x: 50, y: 140 },
];

/** Every long call, with the options that take each of its branches. */
const RECIPES: Record<string, (p: Painter) => void> = {
  wash: (p) =>
    p.wash({ cx: 150, cy: 110, rx: 110, ry: 60 }, PIGMENTS.sap, {
      rng: createRng('wash'),
      blooms: 2,
      fade: { angle: 1.2, ragged: 0.6 },
      drops: [{ pigment: PIGMENTS.sage, size: 0.35 }, { pigment: PIGMENTS.gold }],
    }),
  glaze: (p) => p.glaze(POND, PIGMENTS.stoneDark, { rng: createRng('glaze'), fade: -Math.PI / 2 }),
  wetInWet: (p) => p.wetInWet(POND, PIGMENTS.bellflower, PIGMENTS.sap, { rng: createRng('wiw'), blooms: 1, fade: { angle: Math.PI / 2, start: 0.4 } }),
  lift: (p) => p.lift({ cx: 160, cy: 120, rx: 90, ry: 8 }, { rng: createRng('lift'), amount: 0.4 }),
  stone: (p) => p.stone({ x: 170, y: 190, w: 140, h: 80 }, { rng: createRng('stone'), moss: 0.5 }),
  'stone (ellipse, no shadow or reserve)': (p) =>
    p.stone({ cx: 120, cy: 120, rx: 40, ry: 20 }, { rng: createRng('stone2'), groundShadow: false, reserve: false, moss: 0, ink: 0.3, patches: 0 }),
  waterBody: (p) => p.waterBody(POND, { rng: createRng('water'), ripples: 3, reflection: 0.6 }),
  'a whole sequence on the painter’s own rng': (p) => {
    p.wetInWet(POND, PIGMENTS.celadon, PIGMENTS.celadonMid);
    p.wash({ cx: 100, cy: 100, rx: 40, ry: 30 }, PIGMENTS.sage);
    p.stone({ x: 200, y: 200, w: 60, h: 40 });
    p.waterBody(POND, { ripples: 1 });
  },
};

describe('the long recipes, pinned (ADR 0238)', () => {
  const PINNED: Record<string, string> = {
    wash: '8effcbc3',
    glaze: '34d30ca9',
    wetInWet: '6cd10eb4',
    lift: '27b09666',
    stone: '018304b9',
    'stone (ellipse, no shadow or reserve)': '5edef03c',
    waterBody: '65a9b619',
    'a whole sequence on the painter’s own rng': '49c45bf3',
  };
  it.each(Object.keys(RECIPES))('paints %s exactly as before', (name) => {
    expect(recorded(RECIPES[name]!)).toBe(PINNED[name]);
  });
});
