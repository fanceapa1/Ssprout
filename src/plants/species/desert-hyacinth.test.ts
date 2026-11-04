import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { getSpecies } from '../registry';
import { smallSuite } from '../lib/suites';
import { planDesertHyacinth, poseSpike } from './desert-hyacinth';

smallSuite('desert-hyacinth');

describe('desert hyacinth plan', () => {
  it('is a medium tier-2 plant of the sand path and the back, wild in arid lands', () => {
    const def = getSpecies('desert-hyacinth')!;
    expect(def.habitats).toEqual(['path', 'back']);
    expect(def.sizeClass).toBe('medium');
    expect(def.range).toEqual({ realms: ['n-africa-arabia', 'mediterranean'], biomes: ['desert', 'coast'], climates: ['arid'] });
  });

  it('raises one to three spikes, the first the tallest, each with many flowers', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const { spikes } = planDesertHyacinth(createRng(seed).fork('plan'));
      counts.add(spikes.length);
      expect(spikes.length).toBeGreaterThanOrEqual(1);
      expect(spikes.length).toBeLessThanOrEqual(3);
      for (const s of spikes) {
        expect(s.stem.length).toBeLessThanOrEqual(spikes[0]!.stem.length);
        expect(s.flowers.length).toBeGreaterThan(25);
      }
    }
    expect([...counts].sort()).toEqual([1, 2, 3]);
  });

  it('opens its flowers from the bottom up', () => {
    const [s] = planDesertHyacinth(createRng(4).fork('plan')).spikes;
    const mid = poseSpike(s!, (s!.open[0] + s!.open[1]) / 2);
    const low = mid.flowers.filter((f) => f.u < 0.2);
    const high = mid.flowers.filter((f) => f.u > 0.8);
    expect(Math.min(...low.map((f) => f.open))).toBeGreaterThan(Math.max(...high.map((f) => f.open)));
    expect(poseSpike(s!, 1).flowers.every((f) => f.open > 0.99)).toBe(true);
    expect(poseSpike(s!, s!.open[0]).flowers.every((f) => f.open < 0.01)).toBe(true);
  });

  it('keeps every spike inside the box at full growth', () => {
    // 120×160 box, base at anchor (0.5, 0.92): 147 above, 60 to each side
    for (let seed = 1; seed <= 60; seed++) {
      for (const s of planDesertHyacinth(createRng(seed).fork('plan')).spikes) {
        for (const q of poseSpike(s, 1).axis) {
          expect(Math.abs(q.x) + s.spikeR * 2.2, `seed ${seed}`).toBeLessThan(58);
          expect(q.y - s.spikeR, `seed ${seed}`).toBeGreaterThan(-145);
        }
      }
    }
  });
});
