/**
 * The oasis's rock (O2): the bluff and the ksar painted in parts within the cooperative painter's
 * bounds (ADR 0226, 0238), deterministic, and meeting the sky and each other without paper gaps.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bounds, pointInPolygon } from '../../paint/geometry';
import { createRng } from '../../core/rng';
import { paintJob, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { OASIS_ART, OASIS_ELEMENTS } from '.';
import { blockShape, KSAR, KSAR_SHAPES } from './ksar';
import { BLUFF } from './layout';
import { ROCK_SHAPES, roughOutline } from './paint-rocks';

const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the middle tower and the seat under it
const DETAIL: PaintView = { rect: { x: 580, y: 140, w: 200, h: 220 }, scale: 2.8 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(OASIS_ART, view, { only: ['rock'], now: () => 0 });
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

describe('oasis rock painting (O2)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.again = record(OVERVIEW);
    runs.detail = record(DETAIL);
  }, 120_000);

  it('paints the rock element as its own two steps, the bluff then the ksar', () => {
    expect(OASIS_ELEMENTS.rock).toEqual(['bluff', 'ksar']);
    expect(OASIS_ART.steps(OASIS_ART, ['rock']).map((s) => s.name)).toEqual(['bluff', 'ksar']);
  });

  it('is deterministic: the same marks every time, and the same crumbling for each block', () => {
    // quantised hashes from a fresh process, pinned as the waterfall's (paint caches warm up across runs)
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '25305b33', detail: '20a98a6b' });
    expect(runs.again!.chunks.map((c) => c.name)).toEqual(runs.overview!.chunks.map((c) => c.name));
    for (const b of KSAR) expect(blockShape(b)).toEqual(blockShape(b));
  });

  it('keeps its shapes exported for daylight, the ksar standing on the bluff', () => {
    expect(ROCK_SHAPES.bluff).toBe(BLUFF);
    expect(ROCK_SHAPES.ksar).toBe(KSAR_SHAPES);
    for (const s of KSAR_SHAPES) {
      const b = bounds(s.front);
      // each foot is below the bluff's top there, so the seat covers it
      expect(pointInPolygon({ x: b.x + b.w / 2, y: b.y + b.h - 1 }, BLUFF), s.block.id).toBe(true);
    }
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
  });

  it('pauses inside both steps: each comes in many parts', () => {
    for (const step of ['bluff', 'ksar']) expect(runs.overview!.chunks.filter((c) => c.name === step).length, step).toBeGreaterThan(10);
  });

  it('leaves no paper at its edges: the flanks tuck under the fronts, the hand-cut outlines stay within the sky’s hang', () => {
    for (const s of KSAR_SHAPES.filter((q) => q.flank.length)) {
      const [t, , , , , , f] = s.flank;
      // the flank's inner corners lie inside the front, so the two meet without a gap
      expect(pointInPolygon({ x: t!.x + 1, y: t!.y + 4 }, s.front), s.block.id).toBe(true);
      expect(pointInPolygon({ x: f!.x + 1, y: f!.y - 4 }, s.front), s.block.id).toBe(true);
    }
    const rough = roughOutline(BLUFF, createRng(1), 1.8);
    for (const q of rough) {
      let d = Infinity;
      for (let i = 0; i < BLUFF.length; i++) {
        const a = BLUFF[i]!;
        const b = BLUFF[(i + 1) % BLUFF.length]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        d = Math.min(d, Math.hypot(q.x - a.x - dx * t, q.y - a.y - dy * t));
      }
      expect(d).toBeLessThanOrEqual(3);
    }
  });
});
