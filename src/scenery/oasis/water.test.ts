/**
 * The oasis's water (O3): the basin, the seguia and the oued painted in parts within the
 * cooperative painter's bounds (ADR 0226, 0238), deterministic, and with their shapes where the
 * slots and later tasks (daylight's basin plate, motion's falls) expect them.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bounds, pointInPolygon } from '../../paint/geometry';
import { paintJob, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { OASIS_ART, OASIS_ELEMENTS } from '.';
import { BASIN_STONE, BASIN_WATER, OUED_WATER } from './geometry';
import { BAR, copingAt, SEGUIA_FALLS, WALLS } from './layout';
import { BASIN_STEPS, OUED_BARS, ouedAt, SLUICE_GATE, WATER_BOXES, WATER_SHAPES } from './paint-water';
import { OASIS_SLOTS } from './slots';

const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the basin's far-right corner, its steps and the sluice gate
const DETAIL: PaintView = { rect: { x: 940, y: 470, w: 240, h: 200 }, scale: 2.8 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(OASIS_ART, view, { only: ['water'], now: () => 0 });
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

const inside = (outer: readonly { x: number; y: number }[], shape: readonly { x: number; y: number }[]) => shape.every((q) => pointInPolygon(q, outer));

describe('oasis water painting (O3)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.again = record(OVERVIEW);
    runs.detail = record(DETAIL);
  }, 120_000);

  it('paints the water element as its own three steps: the basin, the seguia, the oued', () => {
    expect(OASIS_ELEMENTS.water).toEqual(['basin', 'seguia', 'oued']);
    expect(OASIS_ART.steps(OASIS_ART, ['water']).map((s) => s.name)).toEqual(['basin', 'seguia', 'oued']);
  });

  // quantised (paint-record's default rounding), so the pins hold on every platform (docs/TESTING.md)
  // quantised hashes from a fresh process, as the rock's and the waterfall's (paint caches warm up across runs)
  it('is deterministic: the same marks every time (recording hash pins)', () => {
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '3575e3c2', detail: '9c0ea5f8' });
    // a second run hashes differently (warm caches) but paints in the same parts
    expect(runs.again!.chunks.map((c) => c.name)).toEqual(runs.overview!.chunks.map((c) => c.name));
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
  });

  it('pauses inside every water step: each comes in many parts', () => {
    for (const step of ['basin', 'seguia', 'oued']) expect(runs.overview!.chunks.filter((c) => c.name === step).length, step).toBeGreaterThan(10);
  });

  it('keeps the basin’s steps in the water and its gate across the coping', () => {
    for (const s of BASIN_STEPS) {
      const c = bounds(s.tread);
      expect(pointInPolygon({ x: c.x + c.w / 2, y: c.y + c.h / 2 }, BASIN_WATER)).toBe(true);
    }
    // the cut runs from the water out through the rim's outer edge
    const [inner, outer] = SLUICE_GATE.cut;
    expect(pointInPolygon(inner!, BASIN_STONE)).toBe(true);
    expect(pointInPolygon({ x: outer!.x + 4, y: outer!.y }, BASIN_STONE)).toBe(false);
    for (const post of SLUICE_GATE.posts) expect(inside(BASIN_STONE, post.slice(2))).toBe(true);
  });

  it('drops each fall from a terrace wall’s coping, within its box', () => {
    for (const [i, f] of SEGUIA_FALLS.entries()) {
      const coping = WALLS.map((w) => copingAt(w, f.top.x - 8)).find((y) => y !== null && Math.abs(y - f.top.y) < 6);
      expect(coping, `fall ${i}`).toBeDefined();
      const b = WATER_BOXES.falls[i]!;
      for (const q of WATER_SHAPES.falls[i]!) expect(q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h).toBe(true);
    }
  });

  it('keeps the oued’s sand bars in its water, the big one the layout’s bar, and off the shallows’ slots', () => {
    for (const bar of OUED_BARS) expect(inside(OUED_WATER, bar.filter((_, i) => i % 3 === 0))).toBe(true);
    expect(pointInPolygon({ x: BAR.cx, y: BAR.cy }, OUED_BARS[0]!)).toBe(true);
    for (const s of OASIS_SLOTS.filter((q) => q.id.startsWith('shallows-'))) expect(OUED_BARS.some((b) => pointInPolygon(s, b)), s.id).toBe(false);
    // the banks' mapping runs from the top of the bend to the viewer's feet
    expect(ouedAt(0, 0)).toEqual(OUED_WATER[0]);
    expect(ouedAt(1, 0).y).toBe(1020);
  });

  it('exports the boxes later tasks plate and animate', () => {
    expect(WATER_BOXES.basin).toEqual(bounds(BASIN_STONE));
    expect(WATER_BOXES.oued).toEqual(bounds(OUED_WATER));
    expect(WATER_BOXES.falls).toHaveLength(SEGUIA_FALLS.length);
    expect(WATER_SHAPES.basin).toBe(BASIN_WATER);
  });
});
