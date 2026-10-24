/**
 * The engine's long calls in parts (ADR 0238): painting a call a part at a time must give exactly
 * the pixels and canvas calls of the one-call form. The hashes below were pinned against the
 * engine before it could pause (whole-surface drying, recipes in one call).
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { PaintRecorder, type RecordedCost } from '../scene/paint-record';
import { acquireWork } from './canvas';
import { createPainter, makeCanvas, type Painter } from './index';
import { createSimplex2D, noiseGrid } from './noise';
import { paperGrain, GRAIN_SIZE } from './paper';
import { PIGMENTS } from './pigments';
import {
  DRY_DEFAULTS,
  boxBlur,
  boxBlurParts,
  drain,
  dryPixels,
  dryPixelsParts,
  edgeBlur,
  edgeBlurParts,
  resolveDry,
  type GrainLookup,
  type OpenSides,
  type PaintParts,
  type WetLayer,
} from './wet';

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
function recorded(fn: (p: Painter, rec: PaintRecorder) => void): string {
  emptyPool();
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const p = createPainter(makeCanvas(480, 320), { seed: 7 });
    p.ctx.setTransform(1.6, 0, 0, 1.6, -40, -30);
    fn(p, rec);
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

const RECIPE_PINS: Record<string, string> = {
  wash: '8effcbc3',
  glaze: '34d30ca9',
  wetInWet: '6cd10eb4',
  lift: '27b09666',
  stone: '018304b9',
  'stone (ellipse, no shadow or reserve)': '5edef03c',
  waterBody: '65a9b619',
  'a whole sequence on the painter’s own rng': '49c45bf3',
};

describe('the long recipes, pinned (ADR 0238)', () => {
  it.each(Object.keys(RECIPES))('paints %s exactly as before', (name) => {
    expect(recorded(RECIPES[name]!)).toBe(RECIPE_PINS[name]);
  });
});

/** Equal typed arrays, element for element (a short message instead of a 100k-line diff). */
function sameArray(a: ArrayLike<number>, b: ArrayLike<number>): string {
  if (a.length !== b.length) return `length ${a.length} ≠ ${b.length}`;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return `index ${i}: ${a[i]} ≠ ${b[i]}`;
  return 'same';
}

/** Drain parts, counting them. */
function countParts<T>(parts: PaintParts<T>): { value: T; parts: number } {
  let n = 0;
  for (;;) {
    const r = parts.next();
    n++;
    if (r.done) return { value: r.value, parts: n };
  }
}

describe('the drying pass in bands (ADR 0238)', () => {
  // band sizes in pixels: a row or less, a few rows, more than the buffer
  it.each(DRY_CASES.map((c) => [c.name, c] as const))('%s: every band size dries byte for byte like the whole buffer', (_name, c) => {
    const whole = dryCase(c);
    dryPixels(whole.data, c.w, c.h, whole.o, c.edgePx, whole.grain, whole.flow, c.open);
    for (const band of [1, c.w - 1, c.w * 3 + 7, 1000, c.w * c.h * 2]) {
      const k = dryCase(c);
      const { parts } = countParts(dryPixelsParts(k.data, c.w, c.h, k.o, c.edgePx, k.grain, k.flow, c.open, band));
      expect(sameArray(k.data, whole.data), `band ${band}`).toBe('same');
      // a band of at most one row: the wet edge and the pigment pass alone pause after every row
      if (band <= c.w) expect(parts).toBeGreaterThan(2 * c.h);
    }
  });

  it('the blurs in bands equal the whole-buffer blurs, open and closed sides, odd sizes', () => {
    const rng = createRng('blur');
    for (const [w, h, radius, open] of [
      [37, 23, 3, CLOSED],
      [41, 29, 5.4, OPEN],
      [9, 61, 2.5, OPEN],
      [64, 7, 1.2, CLOSED],
    ] as const) {
      const src = Float32Array.from({ length: w * h }, () => rng.next());
      const box = boxBlur(src, w, h, radius, 2, open);
      const edge = edgeBlur(src, w, h, radius, open);
      for (const band of [1, w + 3, 5 * w]) {
        expect(sameArray(drain(boxBlurParts(src, w, h, radius, 2, open, band)), box), `box ${w}×${h} band ${band}`).toBe('same');
        expect(sameArray(drain(edgeBlurParts(src, w, h, radius, open, band)), edge), `edge ${w}×${h} band ${band}`).toBe('same');
      }
    }
  });
});

describe('a wet layer dries in parts (ADR 0238)', () => {
  /** A big wet layer over the recording canvas, filled, then dried by `dry`. */
  function layerRun(dry: (L: WetLayer) => number): { hash: string; parts: number } {
    let parts = 0;
    const hash = recorded((p) => {
      const L = p.layer({ x: 0, y: 0, w: 320, h: 220 });
      for (let k = 0; k < 6; k++) L.fill(POND.map((q) => ({ x: q.x + k * 3, y: q.y + k * 2 })), PIGMENTS.sap, 0.3);
      parts = dry(L);
    });
    return { hash, parts };
  }

  it('dryParts paints exactly what dry paints, in many parts', () => {
    const one = layerRun((L) => {
      L.dry({ granules: 0.3 });
      return 1;
    });
    const parts = layerRun((L) => countParts(L.dryParts({ granules: 0.3 })).parts);
    expect(parts.hash).toBe(one.hash);
    // the layer is 480×320 work pixels: a few bands per pass, several passes
    expect(parts.parts).toBeGreaterThan(10);
  });
});

/** The parts forms of the long recipes (`p.parts`), each a pinned one-call recipe above. */
const RECIPE_PARTS: Record<string, (p: Painter) => PaintParts> = {
  wash: (p) =>
    p.parts.wash({ cx: 150, cy: 110, rx: 110, ry: 60 }, PIGMENTS.sap, {
      rng: createRng('wash'),
      blooms: 2,
      fade: { angle: 1.2, ragged: 0.6 },
      drops: [{ pigment: PIGMENTS.sage, size: 0.35 }, { pigment: PIGMENTS.gold }],
    }),
  glaze: (p) => p.parts.glaze(POND, PIGMENTS.stoneDark, { rng: createRng('glaze'), fade: -Math.PI / 2 }),
  wetInWet: (p) => p.parts.wetInWet(POND, PIGMENTS.bellflower, PIGMENTS.sap, { rng: createRng('wiw'), blooms: 1, fade: { angle: Math.PI / 2, start: 0.4 } }),
  lift: (p) => p.parts.lift({ cx: 160, cy: 120, rx: 90, ry: 8 }, { rng: createRng('lift'), amount: 0.4 }),
  stone: (p) => p.parts.stone({ x: 170, y: 190, w: 140, h: 80 }, { rng: createRng('stone'), moss: 0.5 }),
  'stone (ellipse, no shadow or reserve)': (p) =>
    p.parts.stone({ cx: 120, cy: 120, rx: 40, ry: 20 }, { rng: createRng('stone2'), groundShadow: false, reserve: false, moss: 0, ink: 0.3, patches: 0 }),
  waterBody: (p) => p.parts.waterBody(POND, { rng: createRng('water'), ripples: 3, reflection: 0.6 }),
};

describe('the long recipes in parts (ADR 0238)', () => {
  it.each(Object.keys(RECIPE_PARTS))('%s in parts paints exactly the one call, and no part is a big share of it', (name) => {
    const costs: RecordedCost[] = [];
    const hash = recorded((p, rec) => {
      const parts = RECIPE_PARTS[name]!(p);
      rec.mark();
      while (!parts.next().done) costs.push(rec.mark());
      costs.push(rec.mark());
    });
    expect(hash).toBe(RECIPE_PINS[name]);
    expect(costs.length).toBeGreaterThan(8);
    const total = costs.reduce((a, c) => a + c.calls, 0);
    const most = costs.reduce((a, c) => Math.max(a, c.calls), 0);
    expect(most / total).toBeLessThan(0.25);
    // a part reads a wet layer's pixels at most once (one drying pass at a time)
    expect(Math.max(...costs.map((c) => c.reads))).toBeLessThanOrEqual(1);
  });
});
