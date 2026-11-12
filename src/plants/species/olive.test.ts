import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { growsIn } from '../flora';
import { trunkOutline } from '../lib/olive-paint';
import { treeSuite } from '../lib/suites';
import { treeView } from '../lib/tree-structure';
import { getScenery } from '../../scenery/registry';
import olive, { oliveArrivals, planOlive } from './olive';

treeSuite('olive', planOlive);

const plan = (seed: number) => planOlive(createRng(seed).fork('olive'));
const STEPS = 400;

describe('olive', () => {
  it('stands on one short, fat trunk that parts into three or four limbs', () => {
    for (let s = 1; s <= 12; s++) {
      const p = plan(s);
      const trunks = p.tree.branches.filter((b) => b.parent < 0);
      expect(trunks).toHaveLength(1);
      const trunk = trunks[0]!;
      expect(trunk.len, `seed ${s}`).toBeLessThan(olive.size.h * 0.32);
      expect(trunk.w0 / trunk.len, `seed ${s}`).toBeGreaterThan(0.3);
      const limbs = p.tree.branches.filter((b) => b.parent === trunk.id);
      expect(limbs.length).toBeGreaterThanOrEqual(3);
      expect(limbs.length).toBeLessThanOrEqual(4);
    }
  });

  it('is a smooth thin stem when young and fat with a flared foot when old', () => {
    const p = plan(3);
    const trunk = p.tree.branches[0]!;
    const width = (g: number) => {
      const o = trunkOutline(trunk, p.trunk, treeView(g, p.tree.base), 1, oliveArrivals(g).age);
      return { foot: o.left[0]! + o.right[0]!, waist: o.left[12]! + o.right[12]! };
    };
    expect(width(0.3).waist).toBeLessThan(width(1).waist * 0.4);
    expect(width(1).foot).toBeGreaterThan(width(1).waist * 1.3);
    expect(width(1).waist).toBeGreaterThan(olive.size.w * 0.1);
  });

  it('carries a broad, broken crown of separate clumps, inside the box', () => {
    for (let s = 1; s <= 12; s++) {
      const { clumps } = plan(s);
      expect(clumps.length, `seed ${s}`).toBeGreaterThanOrEqual(6);
      const x0 = Math.min(...clumps.map((c) => c.x - c.rx));
      const x1 = Math.max(...clumps.map((c) => c.x + c.rx));
      const y0 = Math.min(...clumps.map((c) => c.y - c.ry));
      const y1 = Math.max(...clumps.map((c) => c.y + c.ry));
      expect((x1 - x0) / (y1 - y0), `seed ${s}`).toBeGreaterThan(1.1);
      expect(x0).toBeGreaterThan(0);
      expect(x1).toBeLessThan(olive.size.w);
      expect(y0).toBeGreaterThan(0);
    }
  });

  it('has small narrow leaves in three tones, a share of them silver, every one inside the box', () => {
    for (let s = 1; s <= 6; s++) {
      const { leaves } = plan(s);
      expect(leaves.length).toBeGreaterThan(800);
      const silver = leaves.filter((l) => l.tone === 2).length / leaves.length;
      expect(silver, `seed ${s}`).toBeGreaterThan(0.1);
      expect(silver, `seed ${s}`).toBeLessThan(0.4);
      expect(leaves.some((l) => l.tone === 0)).toBe(true);
      for (const l of leaves) {
        const tipX = l.x + Math.cos(l.angle) * l.length;
        const tipY = l.y + Math.sin(l.angle) * l.length;
        for (const [x, y] of [[l.x, l.y], [tipX, tipY]] as const) {
          expect(x).toBeGreaterThan(0);
          expect(x).toBeLessThan(olive.size.w);
          expect(y).toBeGreaterThan(0);
          expect(y).toBeLessThan(olive.size.h);
        }
      }
    }
  });

  it('bears flower sprays and olives', () => {
    for (let s = 1; s <= 6; s++) {
      const p = plan(s);
      expect(p.blooms.length, `seed ${s}`).toBeGreaterThan(5);
      expect(p.fruits.length, `seed ${s}`).toBeGreaterThan(10);
    }
  });

  it('grows in order: whip leaves, the crown, flowers that pass, then olives that ripen', () => {
    const p = plan(1);
    const leaf = p.leaves[0]!;
    const bloom = p.blooms[0]!;
    const fruit = p.fruits[0]!;
    const at = oliveArrivals;
    expect(at(0.1).tips).toBeGreaterThan(0.9);
    expect(at(0.1).leaf(leaf)).toBe(0);
    expect(at(0.85).tips).toBe(0);
    expect(at(0.5).bloom(bloom)).toBe(0);
    expect(at(0.72).bloom(bloom)).toBeGreaterThan(0.9);
    expect(at(0.9).bloom(bloom)).toBe(0);
    expect(at(0.75).fruit(fruit)).toBe(0);
    expect(at(1).fruit(fruit)).toBeGreaterThan(0.99);
    expect(at(1).ripe(fruit)).toBeCloseTo(fruit.ripe, 5);
    expect(at(0.3).age).toBe(0);
    expect(at(1).age).toBe(1);
  });

  it('every mark grows in from nothing, with no jump between growth steps', () => {
    const p = plan(2);
    const marks: [string, (g: number) => number][] = [
      ['age', (g) => oliveArrivals(g).age],
      ...p.clumps.map((c) => [`clump ${c.id}`, (g: number) => oliveArrivals(g).clump(c)] as [string, (g: number) => number]),
      ...p.leaves.filter((_, i) => i % 7 === 0).map((l, i) => [`leaf ${i}`, (g: number) => oliveArrivals(g).leaf(l)] as [string, (g: number) => number]),
      ...p.fruits.map((f) => [`fruit ${f.id}`, (g: number) => oliveArrivals(g).fruit(f)] as [string, (g: number) => number]),
    ];
    for (const [name, k] of marks) {
      expect(k(0), name).toBe(0);
      expect(k(1), name).toBeGreaterThan(0.99);
      let prev = 0;
      for (let i = 1; i <= STEPS; i++) {
        const v = k(i / STEPS);
        expect(Math.abs(v - prev), name).toBeLessThan(0.05);
        prev = v;
      }
    }
  });

  it('is offered by a Mediterranean garden and the oasis, not by the Japanese garden or the waterfall', () => {
    const coast = { realm: 'mediterranean', biomes: ['garden', 'coast'], climate: 'warm-temperate', cultivated: true } as const;
    expect(growsIn('olive', olive.range, { ...coast, biomes: [...coast.biomes] })).toBe(true);
    expect(growsIn('olive', olive.range, getScenery('oasis').flora)).toBe(true);
    expect(growsIn('olive', olive.range, getScenery('japanese-garden').flora)).toBe(false);
    expect(growsIn('olive', olive.range, getScenery('waterfall').flora)).toBe(false);
  });
});
