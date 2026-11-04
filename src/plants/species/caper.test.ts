import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { smallSuite } from '../lib/suites';
import { pointAt, stemPoints } from '../lib/small-structure';
import { planCaper } from './caper';

smallSuite('caper');

describe('caper plan', () => {
  it('has five to seven trailing shoots, some hanging below the root, and one to three flowers on them', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planCaper(createRng(seed).fork('plan'));
      const long = plan.shoots.filter((s) => !s.short);
      expect(long.length).toBeGreaterThanOrEqual(5);
      expect(long.length).toBeLessThanOrEqual(7);
      expect(plan.flowers.every((f) => !plan.shoots[f.shoot]!.short)).toBe(true);
      expect(plan.flowers.length).toBeGreaterThanOrEqual(1);
      expect(plan.flowers.length).toBeLessThanOrEqual(3);
      const below = long.filter((s) => pointAt(stemPoints(s.stem, 1, 1), 1).y > 6).length;
      expect(below, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps every shoot inside the design box at full growth', () => {
    // the 70-unit design box with the root at (0.5, 0.42)
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planCaper(createRng(seed).fork('plan'));
      for (const s of plan.shoots) {
        for (const q of stemPoints(s.stem, 1, 1)) {
          expect(Math.abs(q.x), `seed ${seed}`).toBeLessThan(34);
          expect(q.y, `seed ${seed}`).toBeGreaterThan(-29);
          expect(q.y, `seed ${seed}`).toBeLessThan(40);
        }
      }
    }
  });
});
