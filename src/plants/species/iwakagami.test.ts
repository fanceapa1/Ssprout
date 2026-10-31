import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { smallSuite } from '../lib/suites';
import { pointAt, stemPoints } from '../lib/small-structure';
import { planIwakagami } from './iwakagami';

smallSuite('iwakagami');

describe('iwakagami plan', () => {
  it('has a tuft of four to seven round leaves and a few nodding bells', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planIwakagami(createRng(seed).fork('plan'));
      expect(plan.leaves.length).toBeGreaterThanOrEqual(4);
      expect(plan.leaves.length).toBeLessThanOrEqual(7);
      const bells = plan.scapes.flatMap((s) => s.bells);
      expect(bells.length).toBeGreaterThanOrEqual(3);
      expect(bells.length).toBeLessThanOrEqual(9);
      // every bell hangs: its mouth points below the horizontal
      for (const b of bells) expect(Math.sin(b.axis)).toBeGreaterThan(0.8);
    }
  });

  it('keeps the leaves, the scape and its bells inside the box at full growth', () => {
    // the 70-unit design box, base at anchor (0.5, 0.82): 57.4 above, 12.6 below, 35 aside
    for (let seed = 1; seed <= 60; seed++) {
      const plan = planIwakagami(createRng(seed).fork('plan'));
      for (const s of plan.scapes) {
        const pts = stemPoints(s.stem, 1, 1);
        for (const b of s.bells) {
          const from = pointAt(pts, b.at);
          const end = pointAt(stemPoints({ base: from, length: b.pedicel, angle: b.pedAngle, bends: b.bends }, 1, 1), 1);
          const r = b.length * 1.35;
          expect(end.y - 2, `seed ${seed}`).toBeGreaterThan(-55);
          expect(Math.abs(end.x) + r, `seed ${seed}`).toBeLessThan(34);
        }
      }
      for (const l of plan.leaves) {
        const reach = l.petiole + l.length * 1.1;
        expect(Math.sin(l.angle) * reach, `seed ${seed}`).toBeLessThan(12);
        expect(Math.abs(Math.cos(l.angle)) * reach + l.width * 0.5, `seed ${seed}`).toBeLessThan(34);
      }
    }
  });
});
