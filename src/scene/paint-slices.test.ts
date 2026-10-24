/**
 * The cooperative scene painter (ADR 0226): splitting the paint steps into sub-steps must not
 * change the painting by a single mark, and no sub-step may do much more work than fits in the
 * ~20 ms slice the painter yields after.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GARDEN_ART, paintJob, paintScene, type PaintView } from './background';
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
  }, 120_000);
  afterAll(() => {
    if (!process.env.SCENE_SLICES_REPORT) return;
    for (const [k, r] of Object.entries(runs)) {
      const top = [...[...r.chunks].sort((a, b) => b.pixels - a.pixels).slice(0, 4), ...[...r.chunks].sort((a, b) => b.calls - a.calls).slice(0, 4)];
      console.log(k, r.hash, r.chunks.length, top.map((c) => `${c.name} ${c.reads}r ${c.calls}c ${Math.round(c.pixels / 1000)}kpx`).join(' · '));
    }
  });

  // The hashes were taken from the painter before its steps were split (one uninterrupted call per
  // step). The same paintings also hash alike in Chromium, pixel for pixel (devlog 46).
  it('paints exactly the marks it painted before the steps were split (overview and close views)', () => {
    expect(runs.overview!.hash).toBe('4df9684b');
    expect(runs.detail!.hash).toBe('09d5c8b9');
    expect(runs.trunk!.hash).toBe('937c55ba');
  });

  // Work is counted, not timed, so a loaded machine cannot fail this. Before the split one part
  // was a whole step: the meadow's 1.3 M canvas calls (overview), the big tree's 5.1 Mpx of drying
  // passes (trunk view), the boulder's 1.07 Mpx (close view). After it, single painter calls were
  // the longest parts: the pond's water recipe (310 k calls) and a boulder's stone (0.82 Mpx at
  // 2.8 px per unit). Those now paint in parts too (ADR 0238), and what remains is a row of meadow
  // cells (123 k calls) and a foliage clump's four drying passes (0.68 Mpx, the big tree up close).
  // A drying pass reads and writes its layer in separate parts.
  it.each(['overview', 'detail', 'trunk'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(700_000);
  });

  // The engine's long calls pause inside too (ADR 0238): the pond's water, the reserve and every
  // boulder's stone come in many parts, and in the steps made of washes, stones and big wet layers
  // no part dries more than one layer.
  it('pauses inside the engine’s long calls: water, the pond reserve and the boulders’ stones', () => {
    const parts = (view: string, name: string) => runs[view]!.chunks.filter((c) => c.name === name).length;
    for (const step of ['water', 'pond-reserve', 'rock-left-big']) expect(parts('detail', step), step).toBeGreaterThan(20);
    const washes = ['sky', 'hills', 'banks', 'meadow', 'grass', 'pond-reserve', 'water', 'reflections', 'path', 'margins', 'stones'];
    for (const [view, r] of Object.entries(runs)) {
      const heavy = r.chunks.filter((c) => c.reads > 1 && washes.includes(c.name)).map((c) => c.name);
      expect(heavy, view).toEqual([]);
    }
  });

  it('pauses inside the heavy steps: trees, meadow, banks, pavilion, stones and boulders come in parts', () => {
    const parts = (name: string) => runs.overview!.chunks.filter((c) => c.name === name).length;
    for (const step of ['tree-left', 'meadow', 'grass', 'banks', 'pavilion', 'stones', 'reflections', 'rock-left-big']) {
      expect(parts(step), step).toBeGreaterThan(2);
    }
  });

  it('the cooperative painter hands the main thread back between the parts of a step', async () => {
    const uninstall = new PaintRecorder().install();
    try {
      // every part "takes" 25 ms, more than a 20 ms slice: the painter must yield after each one
      let t = 0;
      let yields = 0;
      const res = await paintScene(GARDEN_ART, TRUNK, {
        only: ['trees'],
        sprites: false,
        sliceMs: 20,
        now: () => (t += 25),
        yieldTo: async () => {
          yields++;
        },
      });
      const tree = res.timings.find((s) => s.name === 'tree-left')!;
      expect(tree.parts).toBeGreaterThan(10);
      expect(yields).toBe(res.timings.reduce((a, s) => a + s.parts, 0));
      expect(res.longest.ms).toBeLessThan(tree.ms);
    } finally {
      uninstall();
    }
  });
});
