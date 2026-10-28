/**
 * The waterfall's vegetation and ground (S8): painted in parts within the cooperative painter's
 * bounds (ADR 0226, 0238), pinned by a quantised recording hash, and kept clear of the slots.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { paintJob, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { WATERFALL_ART } from '.';
import { WATERFALL_SLOTS } from './slots';
import { FERN_SPOTS } from './paint-veg';

const VEG = ['ridge', 'banks', 'woods', 'ferns', 'near'];
const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view (the garden's size) on the low left ledge, the cliff's foot and its bank
const DETAIL: PaintView = { rect: { x: 300, y: 470, w: 300, h: 200 }, scale: 2.8 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(WATERFALL_ART, view, { only: VEG, now: () => 0 });
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

describe('waterfall vegetation painting (S8)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.detail = record(DETAIL);
  }, 180_000);

  it('paints the land first, the vegetation on the rock next, and the foreground last', () => {
    expect(WATERFALL_ART.steps(WATERFALL_ART, VEG).map((s) => s.name)).toEqual([
      'far-ridge',
      'banks',
      'meadow',
      'grass',
      'crown-woods',
      'overhang',
      'ferns',
      'foreground',
      'margins',
    ]);
  });

  it('roots no fern on a slot', () => {
    for (const f of FERN_SPOTS) {
      for (const s of WATERFALL_SLOTS) expect(Math.hypot(f.at.x - s.x, f.at.y - s.y), s.id).toBeGreaterThan(16);
    }
  });

  // quantised (paint-record's default rounding), so the pins hold on every platform (docs/TESTING.md)
  it('paints the same marks (recording hash pins)', () => {
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: 'b9da7a69', detail: '91d5da40' });
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
  });

  it('pauses inside the vegetation steps: each comes in many parts', () => {
    const parts = (name: string) => runs.overview!.chunks.filter((c) => c.name === name).length;
    for (const step of ['far-ridge', 'banks', 'meadow', 'crown-woods', 'overhang', 'ferns', 'foreground']) expect(parts(step), step).toBeGreaterThan(5);
  });
});
