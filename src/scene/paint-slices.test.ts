/**
 * The cooperative scene painter (ADR 0226): splitting the paint steps into sub-steps must not
 * change the painting by a single mark, and no sub-step may do much more work than fits in the
 * ~20 ms slice the painter yields after.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GARDEN_ART, paintJob, type PaintView } from './background';
import { PaintRecorder, type RecordedCost } from './paint-record';

const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view over the near meadow, the big boulder and the left bank (ADR 0163)
const DETAIL: PaintView = { rect: { x: 300, y: 380, w: 300, h: 200 }, scale: 2.8 };
// a close view on the big tree's trunk and limbs
const TRUNK: PaintView = { rect: { x: 120, y: 120, w: 260, h: 180 }, scale: 2.8 };

interface Chunk extends RecordedCost {
  name: string;
}

/** Paint `view` on a recording canvas: the hash of every canvas call, and the work between yields. */
function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(GARDEN_ART, view, { now: () => 0 });
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

describe('scene paint slices (ADR 0226)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.detail = record(DETAIL);
    runs.trunk = record(TRUNK);
  });
  afterAll(() => {
    if (!process.env.SCENE_SLICES_REPORT) return;
    for (const [k, r] of Object.entries(runs)) {
      const top = [...r.chunks].sort((a, b) => b.calls + b.pixels / 1000 - (a.calls + a.pixels / 1000)).slice(0, 10);
      console.log(k, r.hash, r.chunks.length, top.map((c) => `${c.name} ${c.calls}c ${Math.round(c.pixels / 1000)}kpx`).join(' · '));
    }
  });

  it('paints exactly the marks it painted before the steps were split (overview and close views)', () => {
    expect(runs.overview!.hash).toBe('4df9684b');
    expect(runs.detail!.hash).toBe('09d5c8b9');
    expect(runs.trunk!.hash).toBe('937c55ba');
  });
});
