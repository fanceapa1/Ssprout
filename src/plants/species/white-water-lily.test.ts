import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { smallSuite } from '../lib/suites';
import { toothedOutline } from '../lib/white-water-lily-paint';
import { planWhiteWaterLily } from './white-water-lily';

smallSuite('white-water-lily');

describe('white water lily plan', () => {
  it('floats in water only, a medium plant that reflects', () => {
    const def = getSpecies('white-water-lily')!;
    expect(def.habitats).toEqual(['water']);
    expect(def.sizeClass).toBe('medium');
    expect(def.reflect ?? true).toBe(true);
  });

  it('gives every pad a toothed rim and at least one flower held above the water', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planWhiteWaterLily(createRng(seed).fork('plan'));
      for (const pad of plan.pads) {
        expect(pad.teeth).toBeGreaterThanOrEqual(14);
        expect(toothedOutline(pad, 1).length).toBe(pad.teeth * 2 + 2);
      }
      const open = plan.flowers.filter((f) => !f.bud);
      expect(open.length).toBeGreaterThanOrEqual(1);
      for (const f of open) {
        expect(f.height).toBeGreaterThan(8);
        expect(f.outer.length).toBeGreaterThanOrEqual(9);
      }
    }
  });

  it('keeps pads and flowers inside the box at full growth', () => {
    // 130×96 box, base at anchor (0.5, 0.68): 65 above, 31 below, 65 to each side
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planWhiteWaterLily(createRng(seed).fork('plan'));
      for (const pad of plan.pads) {
        for (const q of toothedOutline(pad, 1)) {
          expect(Math.abs(q.x), `seed ${seed}`).toBeLessThan(63);
          expect(q.y, `seed ${seed}`).toBeLessThan(29);
          expect(q.y, `seed ${seed}`).toBeGreaterThan(-63);
        }
      }
      for (const f of plan.flowers) {
        expect(Math.abs(f.base.x) + f.size * 1.1, `seed ${seed}`).toBeLessThan(63);
        expect(f.base.y - f.height - f.size * 0.6, `seed ${seed}`).toBeGreaterThan(-63);
      }
    }
  });
});
