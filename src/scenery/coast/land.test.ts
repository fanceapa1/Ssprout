/**
 * The coast's land (G4): the ground, walls and beds painted in parts within the cooperative
 * painter's bounds (ADR 0226, 0238), deterministic, the walls' faces on the layout's copings, and
 * the beds, flights and jars where the slots expect them.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bounds, pointInPolygon } from '../../paint/geometry';
import { paintJob, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { COAST_ART, COAST_ELEMENTS } from '.';
import { copingAt, LAND, PATH, STEPS, WALLS, WALL_TERRACE } from './layout';
import { coastSteps } from './painters';
import { BEDS, FLIGHTS, JARS, WALL_FACES, WALL_TOPS } from './shapes';
import { COAST_SLOTS, SLOT_TERRACE } from './slots';

// the painters are a lazy chunk (ADR 0341)
beforeAll(() => COAST_ART.painters.load());

const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the middle wall, its crack slot and the bed above it, at 1.6×
const DETAIL: PaintView = { rect: { x: 1180, y: 600, w: 400, h: 260 }, scale: 1.6 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(COAST_ART, view, { only: ['land'], now: () => 0 });
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

describe('coast land painting (G4)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.detail = record(DETAIL);
    runs.again = record(OVERVIEW);
  }, 180_000);

  it('paints the land in its own steps: ground, walls and flights, beds and jars', () => {
    expect(COAST_ELEMENTS.land).toEqual(['land', 'walls', 'beds']);
    expect(coastSteps(COAST_ART, ['land']).map((s) => s.name)).toEqual(['land', 'walls', 'beds']);
  });

  // quantised hashes from a fresh process's first runs (paint caches warm up, so a later run differs)
  it('is deterministic: the same marks every time (recording hash pins)', () => {
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '3c8e7e1b', detail: '803e7aaa' });
    expect(runs.again!.chunks.map((c) => c.name)).toEqual(runs.overview!.chunks.map((c) => c.name));
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
  });

  it('pauses inside every land step: each comes in several parts', () => {
    for (const step of ['land', 'walls', 'beds']) expect(runs.overview!.chunks.filter((c) => c.name === step).length, step).toBeGreaterThan(5);
  });

  it('hangs each wall’s face from the layout’s coping, full height but for its seaward end', () => {
    expect(WALL_FACES).toHaveLength(WALLS.length);
    for (const [i, face] of WALL_FACES.entries()) {
      const w = WALLS[i]!;
      const top = WALL_TOPS[i]!;
      expect(face.slice(0, top.length)).toEqual(top);
      for (const q of top) {
        const y = copingAt(w, q.x);
        if (y !== null) expect(Math.abs(q.y - y), `wall ${i} at ${q.x}`).toBeLessThan(2);
      }
      for (let k = 0; k < top.length; k++) {
        const drop = face[face.length - 1 - k]!.y - top[k]!.y;
        if (top[k]!.x > w.edge[0]!.x + 60) expect(drop).toBeCloseTo(w.h, 6);
        else expect(drop).toBeGreaterThan(w.h * 0.25);
      }
      expect(bounds(face).x + bounds(face).w).toBeGreaterThanOrEqual(1620);
    }
    // each wall and crack slot stands on its wall's painted coping or face
    for (const s of COAST_SLOTS.filter((q) => /^(wall|crack)-/.test(q.id))) {
      const face = WALL_FACES.find((f) => pointInPolygon({ x: s.x, y: s.y + 3 }, f));
      expect(face, s.id).toBeDefined();
    }
  });

  it('lays a bed under every terrace bed slot, on that slot’s terrace, and keeps the beds off the path', () => {
    for (const s of COAST_SLOTS.filter((q) => q.habitat === 'meadow' && q.maxSize !== 'tree')) {
      const bed = BEDS.find((b) => pointInPolygon({ x: s.x, y: s.y - 2 }, b.poly));
      expect(bed, s.id).toBeDefined();
      expect(bed!.terrace).toBe(SLOT_TERRACE.get(s.id));
      expect(WALL_TERRACE[bed!.wall]).toBe(bed!.terrace);
    }
    for (const b of BEDS) for (const q of PATH) expect(pointInPolygon(q, b.poly)).toBe(false);
  });

  it('puts a flight on each of the layout’s steps and the jars on the land, clear of every slot', () => {
    expect(FLIGHTS.map((f) => f.length)).toEqual(STEPS.map((s) => s.n));
    for (const [i, f] of FLIGHTS.entries()) expect(Math.abs(bounds(f[0]!.tread).x + bounds(f[0]!.tread).w / 2 - STEPS[i]!.x)).toBeLessThan(4);
    for (const j of JARS) {
      expect(pointInPolygon({ x: j.x, y: j.y }, LAND)).toBe(true);
      for (const s of COAST_SLOTS) expect(Math.hypot(s.x - j.x, s.y - j.y), s.id).toBeGreaterThan(j.h);
    }
  });
});
