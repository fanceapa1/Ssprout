import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { smallSuite } from '../lib/suites';
import { culmReach, planBarley } from './barley';

smallSuite('barley');

describe('barley plan', () => {
  it('is a medium meadow crop of the oasis plots, without pollinators', () => {
    const def = getSpecies('barley')!;
    expect(def.habitats).toEqual(['meadow']);
    expect(def.sizeClass).toBe('medium');
    expect(def.pollinators).toBe(false);
    expect(def.range).toEqual({ realms: [], biomes: [], climates: [], cultivatedIn: ['n-africa-arabia'] });
  });

  it('raises five to nine bearded culms, one of which stays green', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planBarley(createRng(seed).fork('plan'));
      expect(plan.culms.length).toBeGreaterThanOrEqual(5);
      expect(plan.culms.length).toBeLessThanOrEqual(9);
      expect(plan.culms.filter((c) => c.ripeMax < 0.5)).toHaveLength(1);
      for (const c of plan.culms) expect(c.ear.awnLen).toBeGreaterThan(c.ear.length * 1.2);
    }
  });

  it('keeps every culm, ear and awn tip inside the box at full growth', () => {
    // 120×160 box, base at anchor (0.5, 0.92): 147 above, 60 to each side
    for (let seed = 1; seed <= 60; seed++) {
      for (const c of planBarley(createRng(seed).fork('plan')).culms) {
        for (const q of culmReach(c)) {
          expect(Math.abs(q.x), `seed ${seed}`).toBeLessThan(56);
          expect(q.y, `seed ${seed}`).toBeGreaterThan(-142);
        }
      }
    }
  });
});
