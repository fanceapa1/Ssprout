/**
 * The coast's shore (GB2): painted over the beach, the pools and the shelf; its cobbles, wrack and
 * tufts on the beach and clear of the plants' feet; each pool's hand-cut water inside the old
 * smooth edge and its rim over it, so the pools keep their places.
 */
import { describe, expect, it } from 'vitest';
import { pointInPolygon } from '../../paint';
import { COAST_ART } from '.';
import { POOLS } from './layout';
import { coastSteps } from './painters';
import { BACK_TUFTS, BURIED, COBBLES, POOL_SHAPES, SEA_BALLS, backAt, foamAt } from './shore-shapes';
import { COAST_SLOTS } from './slots';

const feet = COAST_SLOTS.filter((s) => s.habitat === 'shore');
const clear = (x: number, y: number) => Math.min(...feet.map((s) => Math.hypot(x - s.x, (y - s.y) * 1.6)));
const area = (poly: readonly { x: number; y: number }[]) => Math.abs(poly.reduce((a, q, i) => { const r = poly[(i + 1) % poly.length]!; return a + q.x * r.y - r.x * q.y; }, 0)) / 2;

describe('coast shore (GB2)', () => {
  it('paints the shore over the beach, the pools and the shelf, before the trees', () => {
    const names = coastSteps(COAST_ART).map((s) => s.name);
    for (const under of ['beach', 'pools', 'shore-rocks']) expect(names.indexOf('shore'), under).toBeGreaterThan(names.indexOf(under));
    expect(names.indexOf('shore')).toBeLessThan(names.indexOf('maquis'));
  });

  it('lays the cobbles up the beach, coarser toward its back, clear of the plants’ feet', () => {
    expect(COBBLES.length).toBeGreaterThan(150);
    for (const c of COBBLES) {
      expect(c.y, `${c.x}`).toBeGreaterThan(foamAt(c.x) + 8);
      expect(c.y, `${c.x}`).toBeLessThan(backAt(c.x));
      expect(clear(c.x, c.y), `${c.x},${c.y}`).toBeGreaterThanOrEqual(16);
    }
    const low = COBBLES.filter((c) => (c.y - foamAt(c.x)) / (backAt(c.x) - foamAt(c.x)) < 0.6);
    const high = COBBLES.filter((c) => (c.y - foamAt(c.x)) / (backAt(c.x) - foamAt(c.x)) >= 0.6);
    const mean = (l: typeof COBBLES) => l.reduce((a, c) => a + c.r, 0) / l.length;
    expect(high.length).toBeGreaterThan(low.length);
    expect(mean(high)).toBeGreaterThan(mean(low));
  });

  it('keeps the buried stones, sea balls and tufts on the beach and off the plants’ feet', () => {
    for (const s of [...BURIED, ...SEA_BALLS, ...BACK_TUFTS]) {
      expect(s.y).toBeGreaterThan(foamAt(s.x));
      expect(s.y).toBeLessThanOrEqual(backAt(s.x) + 1.5);
    }
    for (const s of [...BURIED, ...SEA_BALLS]) expect(clear(s.x, s.y), `${s.x}`).toBeGreaterThan(14);
  });

  it('cuts each pool’s water inside the old smooth edge, its rim over that edge, its slot in the water', () => {
    for (const [i, q] of POOL_SHAPES.entries()) {
      const e = POOLS[i]!;
      // the shelf's ring ran from (rx - 2.2, ry - 1.6) to (rx + 1.5, ry + 1.2)
      for (const v of q.water) expect(((v.x - e.cx) / (e.rx - 2.2)) ** 2 + ((v.y - e.cy) / (e.ry - 1.6)) ** 2, `pool ${i}`).toBeLessThanOrEqual(1);
      for (const v of q.rim) expect(((v.x - e.cx) / (e.rx + 1.5)) ** 2 + ((v.y - e.cy) / (e.ry + 1.2)) ** 2, `pool ${i}`).toBeGreaterThanOrEqual(1);
      expect(area(q.water) / (Math.PI * e.rx * e.ry), `pool ${i}`).toBeGreaterThan(0.5);
      const slot = COAST_SLOTS.find((s) => s.id === `pool-${i + 1}`)!;
      expect(pointInPolygon(slot, q.water), slot.id).toBe(true);
    }
  });
});
