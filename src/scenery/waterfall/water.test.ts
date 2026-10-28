/**
 * The waterfall's water (S7): painted in parts within the cooperative painter's bounds (ADR 0226,
 * 0238) and pinned by a quantised recording hash.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { paintJob, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { WATERFALL_ART } from '.';
import { sheetAt } from './paint-water';

const WATER = ['water', 'falls'];
const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the foot of the falls, the churn and the outflow
const DETAIL: PaintView = { rect: { x: 520, y: 520, w: 520, h: 260 }, scale: 2.4 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(WATERFALL_ART, view, { only: WATER, now: () => 0 });
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

describe('waterfall water painting (S7)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.detail = record(DETAIL);
  }, 120_000);

  it('paints the pool, the stream and then the falls', () => {
    expect(WATERFALL_ART.steps(WATERFALL_ART, WATER).map((s) => s.name)).toEqual(['pool', 'stream', 'falls']);
  });

  it('maps the sheet between its edges, widening as it drops', () => {
    expect(sheetAt(0, 296)).toEqual({ x: 564, y: 296 });
    expect(sheetAt(1, 606)).toEqual({ x: 688, y: 606 });
    const width = (y: number) => sheetAt(1, y).x - sheetAt(0, y).x;
    expect(width(500)).toBeGreaterThan(width(300));
    expect(width(600)).toBeGreaterThan(width(500));
  });

  // quantised (paint-record's default rounding), so the pins hold on every platform (docs/TESTING.md)
  it('paints the same marks (recording hash pins)', () => {
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '93d5e910', detail: 'd57b168f' });
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
  });

  it('pauses inside the water steps: each comes in many parts', () => {
    const parts = (name: string) => runs.overview!.chunks.filter((c) => c.name === name).length;
    for (const step of ['pool', 'stream', 'falls']) expect(parts(step), step).toBeGreaterThan(10);
  });
});
