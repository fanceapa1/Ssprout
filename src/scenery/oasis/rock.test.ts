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
import { blockShape, KSAR, KSAR_SHAPES, windows } from './ksar';
import { BLUFF } from './layout';
import { BLUFF_FORM, ROCK_SHAPES, roughOutline, SEAT_LINE } from './paint-rocks';

const seatBase = (x: number): number | null => {
  const over = KSAR.filter((b) => x >= b.x - 2 && x <= b.x + b.w + b.side + 2);
  return over.length ? Math.max(...over.map((b) => b.base)) : null;
};

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
    expect({ overview: runs.overview!.hash, detail: runs.detail!.hash }).toEqual({ overview: '59fcb2af', detail: '94c1b4e4' });
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

describe('the ksar finished (O9)', () => {
  it('opens its walls sparingly and loosely: a few varied openings inside each face, clear of the carved band', () => {
    for (const s of KSAR_SHAPES) {
      const b = s.block;
      const ws = windows(b);
      if (b.kind === 'curtain') {
        expect(ws, b.id).toEqual([]);
        continue;
      }
      expect(ws.length, b.id).toBeGreaterThanOrEqual(1);
      expect(ws.length, b.id).toBeLessThanOrEqual(b.kind === 'tower' ? 5 : 3);
      for (const w of ws) {
        expect(pointInPolygon({ x: w.x, y: w.y }, s.front) && pointInPolygon({ x: w.x + w.w, y: w.y + w.h }, s.front), b.id).toBe(true);
        if (b.kind === 'tower') expect(w.y, b.id).toBeGreaterThan(b.base - b.h + 40);
      }
    }
    const towers = KSAR_SHAPES.filter((s) => s.block.kind === 'tower').flatMap((s) => windows(s.block));
    expect(new Set(towers.map((w) => w.kind)).size).toBeGreaterThanOrEqual(2);
    expect(towers.some((w) => w.lintel)).toBe(true);
  });

  it('steps its houses back: each far house stands taller than the near house in front of it', () => {
    for (const far of KSAR.filter((b) => b.id.endsWith('-back'))) {
      const near = KSAR.find((b) => b.id === far.id.replace('-back', ''))!;
      expect(far.h, far.id).toBeGreaterThan(near.h);
      expect(KSAR.indexOf(far), far.id).toBeLessThan(KSAR.indexOf(near));
    }
  });

  it('rules no edge: every tower side is broken into many nudged points, and the towers taper', () => {
    for (const s of KSAR_SHAPES.filter((q) => q.block.kind === 'tower')) {
      const b = s.block;
      const left = s.front.filter((q) => q.y > b.base - b.h + 4 && q.x < b.x + b.w / 2);
      expect(left.length, b.id).toBeGreaterThan(8);
      expect(new Set(left.map((q) => Math.round((q.x - b.x) * 10))).size, b.id).toBeGreaterThan(5);
      expect(Math.min(...s.top.map((q) => q.x)) - b.x, b.id).toBeGreaterThan(b.w * 0.05);
    }
  });

  it('seats the walls in the rock: the seat line runs just above each base and rises into the walls in places', () => {
    const x0 = SEAT_LINE[0]!.x;
    const x1 = SEAT_LINE[SEAT_LINE.length - 1]!.x;
    let rises = 0;
    for (const q of SEAT_LINE) {
      const over = KSAR.filter((b) => q.x >= b.x - 2 && q.x <= b.x + b.w + b.side + 2);
      if (!over.length) continue;
      const base = Math.max(...over.map((b) => b.base));
      // the two ends carry the rock higher (O10); between them it stays low
      const end = q.x < x0 + 50 || q.x > x1 - 60;
      expect(q.y, `${q.x}`).toBeLessThanOrEqual(base);
      expect(q.y, `${q.x}`).toBeGreaterThan(base - (end ? 56 : 24));
      if (q.y < base - 10) rises++;
    }
    expect(rises).toBeGreaterThan(5);
  });
});

describe('the bluff finished (O10)', () => {
  it('carries the rock well up into the ksar at both ends', () => {
    const x0 = SEAT_LINE[0]!.x;
    const x1 = SEAT_LINE[SEAT_LINE.length - 1]!.x;
    const rise = (from: number, to: number) => Math.max(...SEAT_LINE.filter((q) => q.x >= from && q.x <= to).map((q) => (seatBase(q.x) ?? q.y) - q.y));
    expect(rise(x0, x0 + 40)).toBeGreaterThan(26);
    expect(rise(x1 - 50, x1)).toBeGreaterThan(26);
  });

  it('cuts the face into buttresses and gullies, with harder beds as ledges, all inside the bluff', () => {
    const { gullies, hard } = BLUFF_FORM;
    expect(gullies.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < gullies.length; i++) expect(gullies[i]!.x - gullies[i - 1]!.x).toBeGreaterThanOrEqual(80);
    for (const g of gullies) {
      // a funnel at the rim narrowing to a chute: wider at the top than half way down
      expect(g.right[0]!.x - g.left[0]!.x, `${g.x}`).toBeGreaterThan(g.right[5]!.x - g.left[5]!.x);
      expect(pointInPolygon({ x: g.x, y: (g.top + g.foot) / 2 }, BLUFF), `${g.x}`).toBe(true);
    }
    // the shoulder's prow stays whole
    expect(Math.max(...gullies.map((g) => g.x))).toBeLessThan(900);
    expect(hard.length).toBeGreaterThanOrEqual(3);
    expect(new Set(hard.slice(1).map((y, i) => y - hard[i]!)).size).toBeGreaterThan(1);
  });
});

describe('the bluff, second pass (O13)', () => {
  const { gullies, hard, soft } = BLUFF_FORM;
  const width = (g: (typeof gullies)[number], i: number) => g.right[i]!.x - g.left[i]!.x;

  it('cuts V gullies that taper to a point over their scree, with no chute hanging below', () => {
    for (const g of gullies) {
      expect(width(g, 5), `${g.x}`).toBeLessThan(width(g, 0) * 0.6);
      expect(width(g, 10), `${g.x}`).toBeLessThan(4);
    }
    // a few are shallow creases where two buttresses have merged, stopping short of the scree
    const creases = gullies.filter((g) => g.depth < 0.45);
    expect(creases.length).toBeGreaterThanOrEqual(1);
    for (const g of creases) expect(g.foot, `${g.x}`).toBeLessThan(Math.max(...gullies.filter((q) => q.depth >= 0.45).map((q) => q.foot)));
  });

  it('stands buttresses of uneven width between them', () => {
    const gaps = gullies.slice(1).map((g, i) => g.x - gullies[i]!.x);
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(1.4);
  });

  it('shares its beds across the whole face: many soft ones at uneven spacing, none on a hard bed', () => {
    expect(soft.length).toBeGreaterThanOrEqual(10);
    const steps = soft.slice(1).map((b, i) => Math.round(b.y - soft[i]!.y));
    expect(new Set(steps).size).toBeGreaterThan(4);
    for (const b of soft) for (const h of hard) expect(Math.abs(b.y - h)).toBeGreaterThanOrEqual(6);
  });
});
