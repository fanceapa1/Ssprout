import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { smallSuite } from '../lib/suites';
import { pointAt, stemPoints } from '../lib/small-structure';
import { planIwatabako } from './iwatabako';

smallSuite('iwatabako');

describe('iwatabako plan', () => {
  it('has one to three leaves, the first hanging down, and an umbel of stars', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planIwatabako(createRng(seed).fork('plan'));
      expect(plan.leaves.length).toBeGreaterThanOrEqual(1);
      expect(plan.leaves.length).toBeLessThanOrEqual(3);
      expect(Math.sin(plan.leaves[0]!.angle)).toBeGreaterThan(0.85);
      const stars = plan.scapes.reduce((n, s) => n + s.florets.length, 0);
      expect(stars).toBeGreaterThanOrEqual(6);
      expect(stars).toBeLessThanOrEqual(16);
    }
  });

  it('keeps the leaves, the scape and its stars inside the box at full growth', () => {
    // the 70-unit design box with the base at its centre (anchor 0.5, 0.5)
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planIwatabako(createRng(seed).fork('plan'));
      for (const s of plan.scapes) {
        const tip = pointAt(stemPoints(s.stem, 1, 1), 1);
        for (const f of s.florets) {
          const angle = tip.angle + f.offset;
          const droop = Math.cos(angle) >= 0 ? 1 : -1;
          const end = pointAt(stemPoints({ base: tip, length: f.length, angle, bends: f.bends.map((b) => b * droop) }, 1, 1), 1);
          const r = f.size * 1.3;
          expect(end.y - r, `seed ${seed}`).toBeGreaterThan(-34);
          expect(Math.abs(end.x) + r, `seed ${seed}`).toBeLessThan(34);
        }
      }
      for (const l of plan.leaves) {
        const reach = l.petiole + l.length * 1.08;
        expect(Math.sin(l.angle) * reach + l.width * 0.12 + 1, `seed ${seed}`).toBeLessThan(33);
        expect(Math.abs(Math.cos(l.angle)) * reach + l.width * 0.5 * Math.sin(l.angle), `seed ${seed}`).toBeLessThan(33);
      }
    }
  });
});
