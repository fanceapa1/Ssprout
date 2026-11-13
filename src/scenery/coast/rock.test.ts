/**
 * The coast's rock (G2): the far hill and village, the promontory, the temple and the shore's
 * rock painted in parts within the cooperative painter's bounds (ADR 0226, 0330), deterministic,
 * meeting the sky without paper, and keeping the splash rocks' tops where their slots stand.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { createPainter, makeCanvas } from '../../paint';
import { pointInPolygon } from '../../paint/geometry';
import { applyView, type PaintView } from '../../scene/background';
import { PaintRecorder, type RecordedCost } from '../../scene/paint-record';
import { COAST_ART, COAST_ELEMENTS } from '.';
import { FAR_HILL, PROMONTORY, SPLASH_ROCKS, TEMPLE_SHAPES } from './layout';
import { PROMONTORY_FORM, SHORE_RUNS, footAt, topAt } from './paint-rocks';
import { coastSteps } from './painters';
import { rough } from './rock-kit';
import { CLIFF_STONES, SHORE_BOULDER_SHAPES, SPLASH_ROCK_SHAPES } from './shapes';
import { COAST_SLOTS } from './slots';
import { columnShapes } from './temple';
import { VILLAGE_CUBES } from './shapes';

// the painters are a lazy chunk (ADR 0341)
beforeAll(() => COAST_ART.painters.load());

/** The rock painter's own steps (the promontory's pines and scrub are the vegetation's). */
const MINE = ['far-hill', 'village', 'promontory', 'temple', 'cliff-foot', 'shore-rocks'];
const OVERVIEW: PaintView = { rect: { x: 0, y: 0, w: 1600, h: 1000 }, scale: 0.6 };
// a resting close view on the temple
const DETAIL: PaintView = { rect: { x: 640, y: 270, w: 270, h: 150 }, scale: 3 };

interface Chunk extends RecordedCost {
  name: string;
}

function record(view: PaintView): { hash: string; chunks: Chunk[] } {
  const rec = new PaintRecorder();
  const uninstall = rec.install();
  try {
    const canvas = makeCanvas(view.rect.w * view.scale, view.rect.h * view.scale);
    const p = createPainter(canvas, { seed: COAST_ART.seed });
    const soft = createPainter(canvas, { seed: COAST_ART.seed, quality: 'draft' });
    const chunks: Chunk[] = [];
    rec.mark();
    for (const step of coastSteps(COAST_ART).filter((s) => MINE.includes(s.name))) {
      const painter = step.soft ? soft : p;
      applyView(painter, view);
      const marks = step.run(painter);
      while (marks && !marks.next().done) chunks.push({ name: step.name, ...rec.mark() });
      chunks.push({ name: step.name, ...rec.mark() });
    }
    return { hash: rec.hash, chunks };
  } finally {
    uninstall();
  }
}

/** Distance from q to the closed polygon's outline. */
function toOutline(q: { x: number; y: number }, poly: readonly { x: number; y: number }[]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(q.x - a.x - dx * t, q.y - a.y - dy * t));
  }
  return d;
}

describe('coast rock painting (G2)', () => {
  const runs: Record<string, ReturnType<typeof record>> = {};
  beforeAll(() => {
    runs.overview = record(OVERVIEW);
    runs.again = record(OVERVIEW);
    runs.detail = record(DETAIL);
  }, 120_000);

  it('paints the far hill, the village, the promontory, the temple and the shore’s rock as their own steps', () => {
    expect(COAST_ELEMENTS.far).toEqual(['far-hill']);
    expect(COAST_ELEMENTS.rock).toEqual(['village', 'promontory', 'temple']);
    expect(COAST_ELEMENTS.stones).toEqual(['cliff-foot', 'shore-rocks']);
    // the cliff's foot and the shore's rock go over the land's edge and the water, before the trees
    const names = coastSteps(COAST_ART).map((s) => s.name);
    expect(names.indexOf('cliff-foot')).toBeGreaterThan(names.indexOf('beds'));
    expect(names.indexOf('cliff-foot')).toBeLessThan(names.indexOf('olive'));
    expect(names.indexOf('shore-rocks')).toBeGreaterThan(names.indexOf('land'));
    expect(names.indexOf('shore-rocks')).toBeGreaterThan(names.indexOf('shore'));
    expect(names.indexOf('shore-rocks')).toBeLessThan(names.indexOf('pine'));
  });

  it('is deterministic: the same marks every time', () => {
    // quantised hashes from a fresh process, pinned as the oasis's (paint caches warm up across runs)
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '39aaf925', detail: '4ff413fa' });
    expect(runs.again!.chunks.map((c) => c.name)).toEqual(runs.overview!.chunks.map((c) => c.name));
  });

  it.each(['overview', 'detail'])('pauses inside every step: no part lays more than 60 000 calls or 400 000 pixels (%s, ADR 0330)', (view) => {
    const { chunks } = runs[view]!;
    const most = (k: 'calls' | 'pixels') => chunks.reduce((a, c) => (c[k] > a[k] ? c : a));
    expect(most('calls').calls, most('calls').name).toBeLessThanOrEqual(60_000);
    expect(most('pixels').pixels, most('pixels').name).toBeLessThanOrEqual(400_000);
    // the cliff's foot skips itself when the view does not reach it (the detail view is the temple)
    for (const step of MINE.filter((s) => view === 'overview' || s !== 'cliff-foot')) expect(chunks.filter((c) => c.name === step).length, step).toBeGreaterThan(10);
  });

  it('dries its runs of like marks as shared layers: few pixel reads per step', () => {
    const reads = (step: string) => runs.overview!.chunks.filter((c) => c.name === step).reduce((a, c) => a + c.reads, 0);
    for (const step of MINE) expect(reads(step), step).toBeLessThanOrEqual(260);
  });
});

describe('the rock meets the sky and the water', () => {
  it('keeps the hand-cut outlines within the sky’s hang', () => {
    for (const poly of [PROMONTORY, FAR_HILL]) {
      for (const q of rough(poly, createRng(3), 1.2, 4)) expect(toOutline(q, poly)).toBeLessThanOrEqual(2);
    }
  });

  it('reads the promontory’s top as the skyline and its foot as the water or the top terrace', () => {
    for (let x = 640; x <= 1610; x += 10) {
      expect(pointInPolygon({ x, y: (topAt(x) + footAt(x)) / 2 }, PROMONTORY), `${x}`).toBe(true);
      expect(footAt(x) - topAt(x), `${x}`).toBeGreaterThan(5);
    }
  });

  it('cuts the face into blocks at fissures of uneven spacing, with harder beds as ledges', () => {
    const { fissures, beds } = PROMONTORY_FORM;
    const deep = fissures.filter((f) => f.depth > 0.75);
    expect(deep.length).toBeGreaterThanOrEqual(8);
    const gaps = fissures.slice(1).map((f, i) => f.x - fissures[i]!.x);
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(2);
    expect(beds.filter((b) => b.hard).length).toBeGreaterThanOrEqual(3);
    expect(new Set(beds.slice(1).map((b, i) => Math.round(b.y - beds[i]!.y))).size).toBeGreaterThan(4);
  });

  it('covers each column’s skyline shape, a broken one up to its slanted break, so no paper shows under the sky’s line', () => {
    const cols = columnShapes();
    cols.forEach((c, i) => {
      const shape = TEMPLE_SHAPES[i]!;
      const top = Math.min(...c.outline.map((q) => q.y));
      const shapeTop = Math.min(...shape.map((q) => q.y));
      // whole shafts end under their capital, which the capital's own shape covers
      expect(top, `${c.x}`).toBeLessThanOrEqual(c.whole ? shapeTop + 9 : shapeTop + 0.5);
      if (!c.whole) for (const q of c.outline.filter((r) => r.y < c.top + 7 && Math.abs(r.x - c.x) < 6)) expect(q.y, `${q.x}`).toBeLessThanOrEqual(c.top + ((q.x - (c.x - 8)) / 16) * 6 + 0.5);
    });
  });

  it('splits the shoreline into the runs that show a face and the runs that show a lip', () => {
    expect(SHORE_RUNS.face.length).toBeGreaterThanOrEqual(2);
    expect(SHORE_RUNS.lip.length).toBeGreaterThanOrEqual(2);
    for (const run of SHORE_RUNS.face) for (let i = 1; i < run.length; i++) expect(run[i]!.x).toBeGreaterThan(run[i - 1]!.x);
  });
});

describe('the splash rocks and the shoreline’s blocks', () => {
  it('stands each splash slot on its rock’s flat top, the rock on its layout place', () => {
    for (const [i, r] of SPLASH_ROCK_SHAPES.entries()) {
      expect(r.x).toBe(SPLASH_ROCKS[i]!.x);
      expect(r.topY, `rock ${i}`).toBeLessThan(r.y - 6);
      const slot = COAST_SLOTS.find((s) => s.id.startsWith('splash') && Math.abs(s.x - r.x) < 4);
      if (!slot) continue;
      expect(pointInPolygon({ x: slot.x, y: slot.y }, r.top), slot.id).toBe(true);
      expect(pointInPolygon({ x: slot.x, y: slot.y }, r.outline), slot.id).toBe(true);
    }
    expect(SPLASH_ROCK_SHAPES.filter((r) => COAST_SLOTS.some((s) => s.id.startsWith('splash') && Math.abs(s.x - r.x) < 4)).length).toBe(3);
  });

  it('stands the whole base of each splash rock’s plant on the rock’s dry top, not on the water', () => {
    for (const s of COAST_SLOTS.filter((q) => q.habitat === 'rock')) {
      const r = SPLASH_ROCK_SHAPES.find((q) => Math.abs(q.x - s.x) < 4);
      if (!r) continue;
      // a plant's base: as wide as the stem cluster of a small plant at the slot's scale, at its foot
      const half = 8 * s.scale;
      for (const dx of [-half, 0, half]) expect(pointInPolygon({ x: s.x + dx, y: s.y }, r.top), `${s.id} ${dx.toFixed(1)}`).toBe(true);
    }
  });

  it('keeps every rock wider than tall, its top inside its outline', () => {
    for (const r of [...SPLASH_ROCK_SHAPES, ...SHORE_BOULDER_SHAPES, ...CLIFF_STONES]) {
      const xs = r.outline.map((q) => q.x);
      const ys = r.outline.map((q) => q.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
      const c = r.top.reduce((a, q) => ({ x: a.x + q.x / r.top.length, y: a.y + q.y / r.top.length }), { x: 0, y: 0 });
      expect(pointInPolygon(c, r.outline)).toBe(true);
    }
  });

  it('builds the village on the far hill, its houses stepping up the slope in rows', () => {
    const cubes = VILLAGE_CUBES.flat();
    expect(cubes.length).toBeGreaterThan(14);
    for (const c of cubes) expect(pointInPolygon({ x: c.x + c.w / 2, y: c.y + c.h - 1 }, FAR_HILL), `${c.x},${c.y}`).toBe(true);
    const rowY = VILLAGE_CUBES.map((row) => Math.min(...row.map((c) => c.y)));
    for (let i = 1; i < rowY.length; i++) expect(rowY[i]!).toBeGreaterThanOrEqual(rowY[i - 1]! - 8);
  });
});
