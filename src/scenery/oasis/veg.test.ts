/**
 * The oasis's vegetation (O4): the grove and the big palms painted in parts within the
 * cooperative painter's bounds (ADR 0226, 0238), deterministic, and their shapes (exported for
 * daylight) inside the world and where the slots expect them.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bounds } from '../../paint/geometry';
import { paintJob, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { OASIS_ART, OASIS_ELEMENTS } from '.';
import { BIG_PALMS, GROVE_FROM } from './layout';
import { BIG_PALM_SHAPES, GROVE_PALMS, GROVE_TREES, VEG_SHAPES } from './paint-veg';
import { OASIS_SLOTS } from './slots';
import { oasisSteps } from './painters';

// the painters are a lazy chunk (ADR 0341)
beforeAll(() => OASIS_ART.painters.load());

const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the grove and the notch palm, at 1.6×
const DETAIL: PaintView = { rect: { x: 1040, y: 240, w: 400, h: 260 }, scale: 1.6 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const job = paintJob(OASIS_ART, view, { only: ['grove', 'palms'], now: () => 0 });
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

describe('oasis vegetation painting (O4)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.detail = record(DETAIL);
    runs.again = record(OVERVIEW);
  }, 180_000);

  it('paints the grove and the big palms as their own steps', () => {
    expect(OASIS_ELEMENTS.grove).toEqual(['grove']);
    expect(OASIS_ELEMENTS.palms).toEqual(['big-palms']);
    expect(oasisSteps(OASIS_ART, ['grove', 'palms']).map((s) => s.name)).toEqual(['grove', 'big-palms']);
  });

  // quantised hashes from a fresh process's first runs (paint caches warm up, so a later run differs)
  it('is deterministic: the same marks every time (recording hash pins)', () => {
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '1b004c12', detail: 'a882bfe7' });
    expect(runs.again!.chunks.map((c) => c.name)).toEqual(runs.overview!.chunks.map((c) => c.name));
  });

  it.each(['overview', 'detail'])('no part of a step does more than one big mark’s work (%s)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(130_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
  });

  it('pauses inside both steps: each comes in many parts', () => {
    for (const step of ['grove', 'big-palms']) expect(runs.overview!.chunks.filter((c) => c.name === step).length, step).toBeGreaterThan(10);
  });

  it('plans each grove palm’s crown in a part of its own: parts with no canvas call (ADR 0330)', () => {
    const planning = runs.overview!.chunks.filter((c) => c.name === 'grove' && c.calls === 0);
    // 287 drying bands and pauses with no call, and one more after each of the 19 palms' crowns
    expect(GROVE_PALMS).toHaveLength(19);
    expect(planning).toHaveLength(287 + 19);
  });

  it('plans the big palms from the layout, their crowns round their tops and within the sheet’s sides', () => {
    expect(BIG_PALM_SHAPES).toHaveLength(BIG_PALMS.length);
    for (const [i, s] of BIG_PALM_SHAPES.entries()) {
      expect(s.trunk[0]).toEqual(BIG_PALMS[i]!.base);
      expect(s.trunk.at(-1)!.x).toBeCloseTo(BIG_PALMS[i]!.top.x, 6);
      expect(s.fronds.length).toBeGreaterThanOrEqual(20);
      const c = bounds(s.crown);
      expect(Math.abs(c.x + c.w / 2 - s.top.x), `palm ${i}`).toBeLessThan(c.w * 0.3);
      // cut by the top edge like the garden's trees, never far past the sheet's sides
      expect(c.x).toBeGreaterThan(800);
      expect(c.x + c.w).toBeLessThan(1900);
      expect(c.y + c.h).toBeLessThan(s.base.y);
    }
  });

  it('keeps the grove behind the basin, right of the notch, its trees and palms on its floor', () => {
    for (const s of GROVE_PALMS) {
      expect(s.top.x).toBeGreaterThanOrEqual(GROVE_FROM - 10);
      expect(s.base.y).toBeLessThanOrEqual(472);
      expect(s.top.y).toBeGreaterThan(200);
    }
    for (const t of GROVE_TREES) expect(t.at.y + t.r * 0.62).toBeLessThan(480);
    const g = bounds(VEG_SHAPES.grove);
    expect(g.x).toBeGreaterThanOrEqual(GROVE_FROM - 30);
    expect(g.y).toBeGreaterThan(150);
    expect(g.y + g.h).toBeLessThanOrEqual(490);
  });

  it('keeps the big palms’ trunks off the tree slot among them', () => {
    const palm = OASIS_SLOTS.find((s) => s.id === 'palm-1')!;
    for (const s of BIG_PALM_SHAPES) expect(Math.hypot(s.base.x - palm.x, s.base.y - palm.y), 'palm-1').toBeGreaterThan(20);
  });
});
