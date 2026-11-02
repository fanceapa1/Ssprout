import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { shrubSuite } from '../lib/suites';
import { serratedBlade } from '../lib/yamabuki-paint';
import yamabuki, { buildYamabuki, poseYamabuki, type YamabukiPose } from './yamabuki';

shrubSuite('yamabuki', buildYamabuki, { habitats: ['shore', 'meadow', 'back'], sizeClass: 'large' });

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: YamabukiPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const c of pose.canes) {
    let len = 0;
    for (let i = 1; i < c.pts.length; i++) len += Math.hypot(c.pts[i]!.x - c.pts[i - 1]!.x, c.pts[i]!.y - c.pts[i - 1]!.y);
    const tip = c.pts[c.pts.length - 1]!;
    out.set(c.id, { size: Math.max(len, c.width), pts: [c.pts[0]!.x, c.pts[0]!.y, tip.x, tip.y, c.width] });
  }
  for (const l of pose.leaves) out.set(l.id, { size: l.length * l.alpha, pts: [l.at.x, l.at.y, l.at.x + Math.cos(l.angle) * l.length, l.at.y + Math.sin(l.angle) * l.length, l.width] });
  for (const f of pose.flowers) {
    const r = f.bloom.rings[0]!.length * f.state.size;
    out.set(f.id, { size: r, pts: [f.bloom.x, f.bloom.y, r, f.state.open * r] });
  }
  return out;
}

describe('yamabuki', () => {
  const size = Math.max(yamabuki.size.w, yamabuki.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 3, 8]) {
      const plant = buildYamabuki(createRng(seed).fork('yamabuki'));
      let prev = marks(poseYamabuki(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseYamabuki(plant, g));
        for (const [id, m] of cur) {
          const before = prev.get(id);
          if (!before) {
            expect(m.size, `${id} appeared at g=${g}`).toBeLessThan(size * 0.012);
            continue;
          }
          const jump = Math.max(...m.pts.map((v, j) => Math.abs(v - before.pts[j]!)));
          expect(jump, `${id} jumped at g=${g}`).toBeLessThan(size * 0.03);
        }
        for (const [id, m] of prev) if (!cur.has(id)) expect(m.size, `${id} vanished at g=${g}`).toBeLessThan(size * 0.012);
        prev = cur;
      }
    }
  });

  it('stays inside its box at full growth, clear of the sides and the top', () => {
    const { w, h } = yamabuki.size;
    const left = -w * yamabuki.anchor.x;
    const top = -h * yamabuki.anchor.y;
    for (let seed = 1; seed <= 16; seed++) {
      const pose = poseYamabuki(buildYamabuki(createRng(seed).fork('yamabuki')), 1);
      const pts = [
        ...pose.canes.flatMap((c) => c.pts),
        ...pose.leaves.flatMap((l) => serratedBlade(l, createRng(l.seed), l.shade).outline),
        ...pose.flowers.flatMap((f) => {
          const r = f.bloom.rings[0]!.length * 1.15;
          return [{ x: f.bloom.x - r, y: f.bloom.y - r }, { x: f.bloom.x + r, y: f.bloom.y + r }];
        }),
      ];
      for (const q of pts) {
        expect(q.x, `seed ${seed}`).toBeGreaterThan(left + 3);
        expect(q.x, `seed ${seed}`).toBeLessThan(left + w - 3);
        expect(q.y, `seed ${seed}`).toBeGreaterThan(top + 3);
        expect(q.y, `seed ${seed}`).toBeLessThan(top + h);
      }
    }
  });

  it('carries single flowers spaced along its arches, and leaves out before they open', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plant = buildYamabuki(createRng(seed).fork('yamabuki'));
      expect(plant.flowers.length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      expect(plant.flowers.length, `seed ${seed}`).toBeLessThanOrEqual(24);
      expect(plant.canes.length).toBeGreaterThanOrEqual(8);
      for (const c of plant.canes) expect(c.shoots.length).toBeLessThanOrEqual(3);
      const at = poseYamabuki(plant, 0.7);
      expect(at.flowers.every((f) => f.state.open < 0.2)).toBe(true);
      expect(at.leaves.length).toBeGreaterThan(60);
    }
  });
});
