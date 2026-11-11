import { describe, expect, it } from 'vitest';
import { loadAllCreatures } from './registry';
import { createRng } from '../../core/rng';
import type { Pt } from '../../render/viewport';
import { gardenScene } from '../../scene/geometry';
import { oasisScene } from '../../scenery/oasis/geometry';
import { OASIS_WILDLIFE } from '../../scenery/oasis/wildlife';
import { WATERFALL_WILDLIFE } from '../../scenery/waterfall/fauna';
import { waterfallScene } from '../../scenery/waterfall/geometry';
import { clamp, closestOnPolygon, distanceToPolygon, insideWithMargin, pointInPolygon } from '../math';
import { FaunaSim } from '../sim';
import { perchesOf } from '../targets';
import { kajikaHasSeats, kajikaSeats, kajikaWaters, nearWater } from './kajika';

// the water checks as they were before they were made cheap (the reference)
function oldSegment(p: Pt, a: Pt, b: Pt): Pt {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / l2, 0, 1) : 0;
  return { x: a.x + vx * t, y: a.y + vy * t };
}
function oldClosest(p: Pt, poly: readonly Pt[]): { pt: Pt; d: number } {
  let best: Pt = poly[0] ?? p;
  let bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const q = oldSegment(p, poly[j]!, poly[i]!);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return { pt: best, d: bd };
}
const oldInside = (p: Pt, poly: readonly Pt[], margin: number) => pointInPolygon(p, poly) && (margin <= 0 || oldClosest(p, poly).d >= margin);
const oldNear = (q: Pt, waters: readonly Pt[][], reach: number) => waters.some((poly) => oldInside(q, poly, 0) || oldClosest(q, poly).d < reach);

const sims = {
  oasis: () => new FaunaSim({ scene: oasisScene, seed: 1, habitat: OASIS_WILDLIFE }),
  waterfall: () => new FaunaSim({ scene: waterfallScene, seed: 1, habitat: WATERFALL_WILDLIFE }),
  japanese: () => new FaunaSim({ scene: gardenScene, seed: 1 }),
};

/** Random points over and around the garden, plus every vertex, edge midpoint and points just off them. */
function probes(waters: readonly Pt[][], n: number, seed: number): Pt[] {
  const rng = createRng(seed);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push({ x: rng.range(-100, 1700), y: rng.range(-100, 1100) });
  for (const poly of waters) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j]!;
      const b = poly[i]!;
      out.push({ ...a }, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      for (const r of [0.5, 4, 26, 140]) out.push({ x: a.x + rng.range(-r, r), y: a.y + rng.range(-r, r) });
    }
  }
  return out;
}

// every garden's creatures (ADR 0346)
await loadAllCreatures();

describe('the frog’s water checks give the same answers as before', () => {
  for (const [name, make] of Object.entries(sims)) {
    const w = make().world;
    const waters = kajikaWaters(w);
    const pts = probes(waters, 4000, name.length);

    it(`${name}: closestOnPolygon and distanceToPolygon match the reference exactly`, () => {
      expect(waters.length).toBeGreaterThan(0);
      for (const poly of waters) {
        for (const p of pts) {
          const ref = oldClosest(p, poly);
          const got = closestOnPolygon(p, poly);
          expect(got.pt).toEqual(ref.pt);
          expect(Object.is(got.d, ref.d)).toBe(true);
          expect(Object.is(distanceToPolygon(p, poly), ref.d)).toBe(true);
        }
      }
    });

    it(`${name}: insideWithMargin and nearWater match the reference at every margin and reach`, () => {
      for (const p of pts) {
        for (const m of [0, 1, 4, 5]) for (const poly of waters) expect(insideWithMargin(p, poly, m)).toBe(oldInside(p, poly, m));
        for (const reach of [0, 26, 70, 90, 140]) expect(nearWater(p, waters, reach)).toBe(oldNear(p, waters, reach));
      }
    });

    it(`${name}: the seats come out as before`, () => {
      const v = w.view;
      const inView = (q: Pt) => q.x > v.x + 30 && q.x < v.x + v.w - 30 && q.y > v.y + 30 && q.y < v.y + v.h - 20;
      const ids = kajikaSeats(w).map((s) => s.id);
      const all = [...w.perches, ...perchesOf({ rocks: w.scene.rocks.map((r) => ({ ...r, perch: true })), path: [] })];
      const ref: string[] = [];
      for (const p of all) if (p.kind !== 'ledge' && !ref.includes(p.id) && inView(p) && oldNear({ x: p.x, y: p.depth - 1 }, waters, 26)) ref.push(p.id);
      expect(ids).toEqual(ref);
    });
  }

  it('handles degenerate polygons the same way', () => {
    const p = { x: 3, y: 4 };
    for (const poly of [[], [{ x: 1, y: 1 }], [{ x: 1, y: 1 }, { x: 1, y: 1 }], [{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: NaN, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }]]) {
      const ref = oldClosest(p, poly);
      const got = closestOnPolygon(p, poly);
      expect(got.pt).toEqual(ref.pt);
      expect(Object.is(got.d, ref.d)).toBe(true);
    }
    expect(closestOnPolygon({ x: NaN, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]).pt).toEqual({ x: 0, y: 0 });
  });
});

describe('whether the frog can live here (checked every frame)', () => {
  for (const [name, make] of Object.entries(sims)) {
    it(`${name}: matches the uncached answer as the view and the scene change`, () => {
      const sim = make();
      const w = sim.world;
      const fresh = () => kajikaWaters(w).length > 0 && kajikaSeats(w).length > 0;
      expect(kajikaHasSeats(w)).toBe(fresh());
      expect(kajikaHasSeats(w)).toBe(fresh());
      for (const view of [{ x: 0, y: 0, w: 40, h: 40 }, { x: 0, y: 0, w: 1600, h: 1000 }, { x: 600, y: 500, w: 400, h: 250 }, { x: 0, y: 0, w: 1600, h: 1000 }]) {
        sim.setView(view);
        expect(kajikaHasSeats(w)).toBe(fresh());
      }
      sim.setView({ x: 0, y: 0, w: 40, h: 40 });
      expect(kajikaHasSeats(w)).toBe(false);
      sim.setScene(waterfallScene, WATERFALL_WILDLIFE);
      sim.setView({ x: 0, y: 0, w: 1600, h: 1000 });
      expect(kajikaHasSeats(w)).toBe(true);
      sim.setScene(oasisScene, OASIS_WILDLIFE);
      expect(kajikaHasSeats(w)).toBe(fresh());
    });
  }
});
