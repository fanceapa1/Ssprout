import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { smallSuite } from '../lib/suites';
import { stemPoints } from '../lib/small-structure';
import { leafPath, planCattail } from './cattail';

smallSuite('cattail');

describe('cattail plan', () => {
  it('stands in the shallows and on the shore, a medium water plant that reflects', () => {
    const def = getSpecies('cattail')!;
    expect(def.habitats).toEqual(['water', 'shore']);
    expect(def.sizeClass).toBe('medium');
    expect(def.reflect ?? true).toBe(true);
  });

  it('raises two to four stalks, each with a gap above the cigar, and one or two broken leaves', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planCattail(createRng(seed).fork('plan'));
      expect(plan.stalks.length).toBeGreaterThanOrEqual(2);
      expect(plan.stalks.length).toBeLessThanOrEqual(4);
      for (const s of plan.stalks) {
        expect(s.gap).toBeGreaterThan(0.5);
        expect(s.male.radius).toBeLessThan(s.female.radius * 0.6);
      }
      const broken = plan.leaves.filter((l) => l.broken).length;
      expect(broken).toBeGreaterThanOrEqual(1);
      expect(broken).toBeLessThanOrEqual(2);
    }
  });

  it('keeps every leaf and stalk inside the box at full growth', () => {
    // 120×160 box, base at anchor (0.5, 0.92): 147 above, 60 to each side
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planCattail(createRng(seed).fork('plan'));
      const pts = [...plan.leaves.flatMap((l) => leafPath(l, 1, 1, 1)), ...plan.stalks.flatMap((s) => stemPoints(s.stem, 1, 1))];
      for (const q of pts) {
        expect(Math.abs(q.x), `seed ${seed}`).toBeLessThan(55);
        expect(q.y, `seed ${seed}`).toBeGreaterThan(-142);
      }
    }
  });
});
