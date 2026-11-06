/**
 * The oasis's land (O4): the far ranges and dunes, the ground, the walls and the near foreground
 * painted in parts within the cooperative painter's bounds (ADR 0226, 0238), deterministic, and
 * the walls' faces (exported for daylight) on the layout's copings and inside the world.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bounds, pointInPolygon } from '../../paint/geometry';
import { paintJob, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { OASIS_ART, OASIS_ELEMENTS } from '.';
import { BUNDS, copingAt, FOOTPATH, NEAR_PLOTS, OUED, WALLS } from './layout';
import { WALL_FACES } from './paint-land';
import { OASIS_SLOTS } from './slots';

const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the middle terrace wall, the basin's near-left corner and the near plots, at 1.6×
const DETAIL: PaintView = { rect: { x: 300, y: 520, w: 400, h: 300 }, scale: 1.6 };
const LAND_ELEMENTS = ['far', 'ground', 'walls', 'near'];

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(OASIS_ART, view, { only: LAND_ELEMENTS, now: () => 0 });
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

describe('oasis land painting (O4)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.detail = record(DETAIL);
    runs.again = record(OVERVIEW);
  }, 180_000);

  it('paints the land in its own steps, back to front', () => {
    expect(OASIS_ART.steps(OASIS_ART, LAND_ELEMENTS).map((s) => s.name)).toEqual(['ranges', 'dunes', 'ground', 'terraces', 'plots', 'footpath', 'walls', 'foreground', 'margins']);
    expect(OASIS_ELEMENTS.near).toEqual(['foreground', 'margins']);
  });

  // quantised hashes from a fresh process's first runs (paint caches warm up, so a later run differs)
  it('is deterministic: the same marks every time (recording hash pins)', () => {
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '652aaff7', detail: '45c78e2b' });
    expect(runs.again!.chunks.map((c) => c.name)).toEqual(runs.overview!.chunks.map((c) => c.name));
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
  });

  it('pauses inside every land step: each comes in several parts', () => {
    for (const step of ['ranges', 'dunes', 'ground', 'terraces', 'plots', 'footpath', 'walls', 'foreground']) {
      expect(runs.overview!.chunks.filter((c) => c.name === step).length, step).toBeGreaterThan(2);
    }
  });

  it('paints each wall’s face down from the layout’s coping, its drop as tall as the wall', () => {
    expect(WALL_FACES).toHaveLength(WALLS.length);
    for (const [i, face] of WALL_FACES.entries()) {
      const w = WALLS[i]!;
      const top = face.slice(0, face.length / 2);
      for (const q of top) {
        const y = copingAt(w, q.x);
        if (y !== null) expect(Math.abs(q.y - y), `wall ${i} at ${q.x}`).toBeLessThan(3);
      }
      for (let k = 0; k < top.length; k++) expect(face[face.length - 1 - k]!.y - top[k]!.y).toBeCloseTo(w.h, 6);
      expect(bounds(face).x).toBeGreaterThanOrEqual(-20);
    }
    // each wall slot stands on its wall's painted coping
    for (const s of OASIS_SLOTS.filter((q) => q.id.startsWith('wall-'))) {
      const face = WALL_FACES.find((f) => pointInPolygon({ x: s.x, y: s.y + 4 }, f));
      expect(face, s.id).toBeDefined();
    }
  });

  it('keeps the near ground’s shapes in the world, off the oued and the footpath', () => {
    for (const shape of [...NEAR_PLOTS, ...BUNDS]) {
      for (const q of shape) {
        expect(q.x).toBeGreaterThanOrEqual(-20);
        expect(q.x).toBeLessThanOrEqual(1620);
        expect(q.y).toBeLessThanOrEqual(1000);
        expect(pointInPolygon(q, OUED)).toBe(false);
      }
    }
    for (const q of FOOTPATH) for (const plot of NEAR_PLOTS) expect(pointInPolygon(q, plot)).toBe(false);
  });
});
