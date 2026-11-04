import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { smallSuite } from '../lib/suites';
import { planColocynth } from './colocynth';

smallSuite('colocynth');

describe('colocynth plan', () => {
  it('lies as five or more runners with two or three gourds on different runners, the first ripening fully', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planColocynth(createRng(seed).fork('plan'));
      expect(plan.runners.length, `seed ${seed}`).toBeGreaterThanOrEqual(5);
      expect(plan.gourds.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(plan.gourds.length, `seed ${seed}`).toBeLessThanOrEqual(3);
      expect(new Set(plan.gourds.map((g) => g.runner)).size).toBe(plan.gourds.length);
      expect(plan.gourds[0]!.ripe).toBe(1);
      expect(plan.gourds.slice(1).every((g) => g.ripe < 0.7)).toBe(true);
      expect(plan.flowers.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('flowers before the gourds swell, and the gourds swell before they ripen', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planColocynth(createRng(seed).fork('plan'));
      const firstRunner = Math.min(...plan.runners.map((r) => r.window[0]));
      for (const g of plan.gourds) {
        expect(g.bloom[0]).toBeGreaterThan(firstRunner);
        expect(g.bloom[0]).toBeLessThan(g.swell[0]);
        expect(g.swell[1]).toBeLessThanOrEqual(g.ripen[0] + 0.02);
      }
    }
  });
});
