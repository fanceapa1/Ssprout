/**
 * The coast's water (G3): the sea, the beach, the pools and the caique painted in parts within the
 * cooperative painter's bounds (ADR 0226, 0238), deterministic, with washes that run past the
 * edges others overlap, and with the slots on water and beach where plants still read.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bounds, pointInPolygon } from '../../paint/geometry';
import type { Pt } from '../../render/viewport';
import { paintJob, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { COAST_ART, COAST_ELEMENTS } from '.';
import { POOL_WATER, SEA_WATER } from './geometry';
import { BEACH, HORIZON, SHELF } from './layout';
import { beachBody } from './paint-water';
import { coastSteps } from './painters';
import {
  CAIQUE_BOX, CAIQUE_SHAPES, CLIFF_REFLECTION, DEPTH, FOAM_LINE, HILL_REFLECTION, SAND_WINDOWS, SEA_RECT, SEABED_ROCKS, SEAGRASS, shallowsEdge,
  shoreContour, WRACK_LINE,
} from './sea';
import { COAST_SLOTS } from './slots';

// the painters are a lazy chunk (ADR 0341)
beforeAll(() => COAST_ART.painters.load());

const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the caique and the shallows
const DETAIL: PaintView = { rect: { x: 330, y: 440, w: 240, h: 150 }, scale: 2.8 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(COAST_ART, view, { only: ['sea', 'beach'], now: () => 0 });
    const chunks: Chunk[] = [];
    rec.mark();
    for (;;) {
      const r = job.next();
      if (r.done) break;
      chunks.push({ name: r.value, ...rec.mark() });
    }
    return { hash: rec.hash, chunks };
  } finally {
    uninstall();
  }
}

const yAt = (line: readonly Pt[], x: number): number => {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    if (b.x >= x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
  }
  return line[line.length - 1]!.y;
};
const inPatch = (q: Pt, c: { x: number; y: number; rx: number; ry: number }, grow = 1) => ((q.x - c.x) / (c.rx * grow)) ** 2 + ((q.y - c.y) / (c.ry * grow)) ** 2 <= 1;

describe('coast water painting (G3)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.again = record(OVERVIEW);
    runs.detail = record(DETAIL);
  }, 120_000);

  it('paints the sea and the caique before the rock, the beach and the pools after the shore', () => {
    expect(COAST_ELEMENTS.sea).toEqual(['sea', 'caique']);
    expect(COAST_ELEMENTS.beach).toEqual(['beach', 'pools']);
    expect(coastSteps(COAST_ART, ['sea', 'beach']).map((s) => s.name)).toEqual(['sea', 'caique', 'beach', 'pools']);
    const names = Object.keys(COAST_ELEMENTS);
    expect(names.indexOf('sea')).toBeLessThan(names.indexOf('rock'));
    expect(names.indexOf('beach')).toBe(names.indexOf('shore') + 1);
  });

  // quantised (paint-record's default rounding), so the pins hold on every platform (docs/TESTING.md)
  it('is deterministic: the same marks every time (recording hash pins)', () => {
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: 'b52216ca', detail: '094dedc8' });
    expect(runs.again!.chunks.map((c) => c.name)).toEqual(runs.overview!.chunks.map((c) => c.name));
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
  });

  it('pauses inside every water step: each comes in many parts', () => {
    for (const step of ['sea', 'caique', 'beach', 'pools']) expect(runs.overview!.chunks.filter((c) => c.name === step).length, step).toBeGreaterThan(10);
  });

  it('runs the sea’s washes past every edge others overlap, and the beach’s under the shelf', () => {
    const r = SEA_RECT;
    for (const q of SEA_WATER) {
      expect(q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y - 1 && q.y <= r.y + r.h, `${q.x},${q.y}`).toBe(true);
    }
    const body = beachBody(3, 8);
    // every point of the beach below its waterline is in the sand's wash, which runs over the shelf's top edge;
    // its paper stops at the beach's back, so the shelf's edge stays
    expect(pointInPolygon({ x: 420, y: 856 }, beachBody(-6))).toBe(false);
    for (const q of BEACH.filter((q) => q.x >= 0 && q.x <= 670)) expect(pointInPolygon({ x: q.x, y: q.y + 6 }, body), `${q.x},${q.y}`).toBe(true);
    for (const q of SHELF.slice(1, 5)) expect(pointInPolygon({ x: q.x, y: q.y + 4 }, body), `${q.x},${q.y}`).toBe(true);
  });

  it('lays the depths as lines across the sea, deeper ones farther out, never looping', () => {
    const lines = [shoreContour(DEPTH.shallows, 0.3, 'shallows'), shoreContour(DEPTH.turquoise, 0.25, 'turquoise'), shoreContour(DEPTH.deep, 0.2, 'deep')];
    for (const line of lines) for (let i = 1; i < line.length; i++) expect(line[i]!.x).toBeGreaterThan(line[i - 1]!.x);
    for (let x = 0; x < 640; x += 40) {
      const [a, b, c] = lines.map((l) => yAt(l, x)) as [number, number, number];
      expect(b, `x ${x}`).toBeLessThan(a);
      expect(c, `x ${x}`).toBeLessThanOrEqual(b);
      expect(c).toBeGreaterThanOrEqual(HORIZON);
    }
    expect(shallowsEdge()).toBe(lines[0]);
  });

  it('keeps the shallows’ plants in the water, off the dark seabed, out of the deep', () => {
    for (const s of COAST_SLOTS.filter((q) => q.id.startsWith('shallows-'))) {
      expect(pointInPolygon(s, SEA_WATER), s.id).toBe(true);
      expect(s.y, s.id).toBeGreaterThan(yAt(shoreContour(DEPTH.turquoise, 0.25, 'turquoise'), s.x));
      // the patch behind and under a plant (its base and the 60 units above it) stays pale
      for (const c of [...SEAGRASS, ...SEABED_ROCKS]) for (const dy of [0, -30, -60]) expect(inPatch({ x: s.x, y: s.y + dy }, c, 1.2), `${s.id} on ${c.x},${c.y}`).toBe(false);
    }
    // the meadow's big slot and three more stand on sandy windows
    expect(COAST_SLOTS.filter((s) => s.id.startsWith('shallows-') && SAND_WINDOWS.some((c) => inPatch({ x: s.x, y: s.y - 30 }, c, 1.3))).length).toBeGreaterThanOrEqual(3);
    for (const s of COAST_SLOTS.filter((q) => q.id.startsWith('pool-'))) expect(POOL_WATER.some((w) => pointInPolygon(s, w)), s.id).toBe(true);
  });

  it('keeps the beach’s plants on dry shingle, below the waterline and its foam', () => {
    for (const s of COAST_SLOTS.filter((q) => q.habitat === 'shore')) {
      expect(pointInPolygon(s, BEACH), s.id).toBe(true);
      expect(s.y - yAt(FOAM_LINE, s.x), s.id).toBeGreaterThan(14);
    }
    for (const q of WRACK_LINE.filter((w) => w.x >= 0)) expect(pointInPolygon(q, BEACH), `${q.x},${q.y}`).toBe(true);
  });

  it('moors the caique on open water, clear of the slots, its reflections on the sea', () => {
    const b = CAIQUE_BOX;
    for (const q of [{ x: b.x, y: b.y + b.h }, { x: b.x + b.w, y: b.y + b.h }, CAIQUE_SHAPES.buoy]) expect(pointInPolygon(q, SEA_WATER), `${q.x},${q.y}`).toBe(true);
    expect(b.y).toBeGreaterThanOrEqual(HORIZON);
    // no plant (its base and 80 units above) stands over the boat itself; its reflection may run behind one
    const boat = bounds([...CAIQUE_SHAPES.hull, ...CAIQUE_SHAPES.mast, ...CAIQUE_SHAPES.yard]);
    for (const s of COAST_SLOTS) {
      const clear = s.x + 40 < boat.x || s.x - 40 > boat.x + boat.w || s.y < boat.y || s.y - 80 > boat.y + boat.h;
      expect(clear, s.id).toBe(true);
    }
    for (const q of [...CLIFF_REFLECTION, ...HILL_REFLECTION]) expect(q.y).toBeGreaterThanOrEqual(HORIZON - 4);
    expect(bounds(CLIFF_REFLECTION).y).toBeGreaterThan(HORIZON);
  });
});
