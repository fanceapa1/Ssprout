import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { smallSuite } from '../lib/suites';
import { planMizubasho } from './mizubasho';

smallSuite('mizubasho');

describe('mizubasho plan', () => {
  it('grows in the shallows and on the shore, a medium water plant that reflects', () => {
    const def = getSpecies('mizubasho')!;
    expect(def.habitats).toEqual(['water', 'shore']);
    expect(def.sizeClass).toBe('medium');
    expect(def.reflect ?? true).toBe(true);
  });

  it('raises one hood, with its leaves and the hood inside the box at full growth', () => {
    // 120×160 box, base at anchor (0.5, 0.9): 144 above, 60 to each side
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planMizubasho(createRng(seed).fork('plan'));
      expect(plan.leaves.length).toBeGreaterThanOrEqual(3);
      for (const l of plan.leaves) {
        const a2 = l.angle + l.bend;
        const reach = (Math.abs(Math.cos(l.angle)) + Math.abs(Math.cos(a2))) / 2;
        expect(Math.abs(l.base.x) + reach * l.length + l.width / 2, `seed ${seed}`).toBeLessThan(60);
        expect(((Math.abs(Math.sin(l.angle)) + Math.abs(Math.sin(a2))) / 2) * l.length + l.width / 2, `seed ${seed}`).toBeLessThan(144);
      }
      const s = plan.spathe;
      expect(s.stalk + s.length, `seed ${seed}`).toBeLessThan(100);
      expect(Math.abs(s.base.x) + s.width / 2 + s.length * Math.abs(Math.sin(s.bend + s.angle + Math.PI / 2)), `seed ${seed}`).toBeLessThan(60);
    }
  });
});
