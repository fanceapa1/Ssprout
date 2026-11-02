import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { smallSuite } from '../lib/suites';
import { pointAt, stemPoints } from '../lib/small-structure';
import { planKurinso } from './kurinso';

smallSuite('kurinso');

describe('kurinso plan', () => {
  it('stacks three to five whorls up one stem, each a full ring of flowers', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planKurinso(createRng(seed).fork('plan'));
      expect(plan.whorls.length).toBeGreaterThanOrEqual(3);
      expect(plan.whorls.length).toBeLessThanOrEqual(5);
      for (let j = 1; j < plan.whorls.length; j++) {
        const [a, b] = [plan.whorls[j - 1]!, plan.whorls[j]!];
        expect(b.at).toBeGreaterThan(a.at);
        // the rings open from the bottom up
        expect(b.bud[0]).toBeGreaterThan(a.bud[0]);
        expect(Math.min(...b.flowers.map((f) => f.open[0]))).toBeGreaterThan(Math.min(...a.flowers.map((f) => f.open[0])));
      }
      for (const w of plan.whorls) expect(w.flowers.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps the rosette and the top ring inside the box at full growth', () => {
    // 120×160 box, base at anchor (0.5, 0.94): 150 above, 9.6 below, 60 aside
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planKurinso(createRng(seed).fork('plan'));
      for (const l of plan.leaves) {
        const droop = Math.abs(l.curve) * 0.7 * Math.abs(Math.cos(l.angle)) * l.length;
        expect(Math.sin(l.angle) * l.length + droop + (l.width / 2) * Math.abs(Math.cos(l.angle)), `seed ${seed}`).toBeLessThan(9.6);
        expect(Math.abs(Math.cos(l.angle)) * l.length + l.width * 0.5, `seed ${seed}`).toBeLessThan(60);
      }
      const pts = stemPoints(plan.scape, 1, 1);
      for (const w of plan.whorls) {
        const node = pointAt(pts, w.at);
        for (const f of w.flowers) {
          expect(node.y - f.lift - f.size * 1.4, `seed ${seed}`).toBeGreaterThan(-148);
          expect(Math.abs(node.x) + f.reach + f.size * 1.4, `seed ${seed}`).toBeLessThan(58);
        }
      }
    }
  });
});
