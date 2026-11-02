import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { ovalBlade, trumpetShape } from '../lib/taniutsugi-paint';
import { shrubSuite } from '../lib/suites';
import taniutsugi, { buildTaniutsugi, poseTaniutsugi, type TaniutsugiPose } from './taniutsugi';

shrubSuite('taniutsugi', buildTaniutsugi, { habitats: ['meadow', 'back'], sizeClass: 'large' });

type Mark = { size: number; pts: number[] };

/** Every mark of a pose by id: its size and the numbers that place it. */
function marks(pose: TaniutsugiPose): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const c of pose.wands) {
    let len = 0;
    for (let i = 1; i < c.pts.length; i++) len += Math.hypot(c.pts[i]!.x - c.pts[i - 1]!.x, c.pts[i]!.y - c.pts[i - 1]!.y);
    const tip = c.pts[c.pts.length - 1]!;
    out.set(c.id, { size: Math.max(len, c.width), pts: [c.pts[0]!.x, c.pts[0]!.y, tip.x, tip.y, c.width] });
  }
  for (const l of pose.leaves) out.set(l.id, { size: l.length * l.alpha, pts: [l.at.x, l.at.y, l.at.x + Math.cos(l.angle) * l.length, l.at.y + Math.sin(l.angle) * l.length, l.width] });
  for (const t of pose.trumpets) {
    const s = trumpetShape(t);
    out.set(t.id, { size: Math.max(t.length, t.mouth) * t.alpha, pts: [t.at.x, t.at.y, s.centre.x, s.centre.y, s.radius] });
  }
  return out;
}

describe('taniutsugi', () => {
  const size = Math.max(taniutsugi.size.w, taniutsugi.size.h);

  it('grows continuously: no mark jumps, appears large or vanishes large', () => {
    for (const seed of [1, 3, 8]) {
      const plant = buildTaniutsugi(createRng(seed).fork('taniutsugi'));
      let prev = marks(poseTaniutsugi(plant, 0));
      for (let i = 1; i <= 240; i++) {
        const g = i / 240;
        const cur = marks(poseTaniutsugi(plant, g));
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
    const { w, h } = taniutsugi.size;
    const left = -w * taniutsugi.anchor.x;
    const top = -h * taniutsugi.anchor.y;
    for (let seed = 1; seed <= 16; seed++) {
      const pose = poseTaniutsugi(buildTaniutsugi(createRng(seed).fork('taniutsugi')), 1);
      const pts = [
        ...pose.wands.flatMap((c) => c.pts),
        ...pose.leaves.flatMap((l) => ovalBlade(l, createRng(l.seed), l.shade).outline),
        ...pose.trumpets.flatMap((t) => trumpetShape(t).outline),
      ];
      for (const q of pts) {
        expect(q.x, `seed ${seed}`).toBeGreaterThan(left + 3);
        expect(q.x, `seed ${seed}`).toBeLessThan(left + w - 3);
        expect(q.y, `seed ${seed}`).toBeGreaterThan(top + 3);
        expect(q.y, `seed ${seed}`).toBeLessThan(top + h);
      }
    }
  });

  it('is an open vase: tall wands from a narrow crown, spreading wider at the top', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const pose = poseTaniutsugi(buildTaniutsugi(createRng(seed).fork('taniutsugi')), 1);
      const main = pose.wands.filter((c) => c.id.startsWith('wand-') && Math.abs(c.pts[0]!.y) < 1e-6);
      expect(main.length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      const feet = main.map((c) => c.pts[0]!.x);
      const tips = main.map((c) => c.pts[c.pts.length - 1]!);
      const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
      expect(spread(feet), `seed ${seed}`).toBeLessThan(30);
      expect(spread(tips.map((q) => q.x)), `seed ${seed}`).toBeGreaterThan(spread(feet) * 3);
      expect(Math.min(...tips.map((q) => q.y)), `seed ${seed}`).toBeLessThan(-150);
    }
  });

  it('carries trumpets in twos and threes at leaf pairs, opening after the leaves', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plant = buildTaniutsugi(createRng(seed).fork('taniutsugi'));
      expect(plant.flowers.length, `seed ${seed}`).toBeGreaterThanOrEqual(16);
      for (const w of plant.wands) {
        for (const nd of w.nodes) {
          expect(nd.leaves.length).toBe(2);
          expect(nd.leaves[0]!.side).toBe(-nd.leaves[1]!.side);
          expect([0, 2, 3]).toContain(nd.flowers.length);
        }
      }
      // some trumpets turn to show the pale inside of the mouth
      expect(plant.flowers.some((f) => f.tilt > 0.8)).toBe(true);
      const at = poseTaniutsugi(plant, 0.7);
      expect(at.trumpets.every((t) => t.open < 0.2)).toBe(true);
      expect(at.leaves.length).toBeGreaterThan(80);
      expect(poseTaniutsugi(plant, 1).trumpets.every((t) => t.open > 0.99)).toBe(true);
    }
  });

  it('grows wild only in Japan’s cool mountain valleys', () => {
    const def = getSpecies('taniutsugi')!;
    expect(def.range).toEqual({ realms: ['japan'], biomes: ['montane-stream', 'temperate-forest'], climates: ['cool-temperate'] });
    expect(def.description.length).toBeLessThan(80);
  });
});
