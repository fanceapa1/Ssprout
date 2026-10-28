/**
 * The waterfall's rock (S6): painted in parts within the cooperative painter's bounds (ADR 0226,
 * 0238), pinned by a quantised recording hash, and its boulders painted by the scenery's own sprites.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { paintJob, spriteAtlasLayout, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { rockBox } from '../../scene/sprites';
import { WATERFALL_ART } from '.';
import { ROCKS } from './geometry';
import { isWetRock, WATERFALL_ROCKS } from './sprites';

const ROCK = ['gorge', 'cliff', 'ledges', 'path'];
const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the falls' left edge, two ledges and the boulders at the foot
const DETAIL: PaintView = { rect: { x: 420, y: 420, w: 300, h: 220 }, scale: 2.8 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(WATERFALL_ART, view, { only: ROCK, now: () => 0 });
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

describe('waterfall rock painting (S6)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.detail = record(DETAIL);
  }, 120_000);

  it('paints the rock steps, back to front, and its own boulders', () => {
    expect(WATERFALL_ART.steps(WATERFALL_ART, ROCK).map((s) => s.name)).toEqual(['gorge', 'cliff', 'buttress', 'ledges', 'stones']);
    expect(WATERFALL_ART.rockSprites).toBe(WATERFALL_ROCKS);
    const layout = spriteAtlasLayout(WATERFALL_ART, 1);
    expect(layout.slots.slice(0, ROCKS.length).map((s) => s.box)).toEqual(ROCKS.map(rockBox));
  });

  it('wets the boulders in and by the water and moss the ones on the banks', () => {
    const wet = ROCKS.filter(isWetRock).map((r) => r.id);
    expect(wet).toEqual(expect.arrayContaining(['rock-foot', 'rock-foot-left', 'rock-pool-left', 'rock-outflow', 'rock-stream']));
    expect(wet).not.toContain('rock-right');
    expect(wet).not.toContain('rock-trail');
  });

  // quantised (paint-record's default rounding), so the pins hold on every platform (docs/TESTING.md)
  it('paints the same marks (recording hash pins)', () => {
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '4ae0e4d1', detail: '5b2cbe55' });
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
  });

  it('pauses inside the rock steps: each comes in many parts', () => {
    const parts = (name: string) => runs.overview!.chunks.filter((c) => c.name === name).length;
    for (const step of ['gorge', 'cliff', 'buttress', 'ledges', 'stones', 'rock-foot']) expect(parts(step), step).toBeGreaterThan(2);
  });
});
