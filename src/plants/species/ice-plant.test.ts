import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { floraOf } from '../flora';
import { openness, silhouette } from '../lib/ice-plant-paint';
import { smallSuite } from '../lib/suites';
import { allSpecies, getSpecies } from '../registry';
import icePlant, { planIcePlant } from './ice-plant';

smallSuite('ice-plant');

const plan = (seed: number) => planIcePlant(createRng(seed).fork('ice-plant').fork('plan'));

describe('ice plant', () => {
  it('seeds vary the colourway: magenta, hot pink and crimson all turn up', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 60; s++) seen.add(plan(s).colourway);
    expect([...seen].sort()).toEqual(['crimson', 'hot-pink', 'magenta']);
  });

  it('is a cushion of 4–5 lobes with hundreds of flowers, each opening after its lobe is under way', () => {
    for (let s = 1; s <= 30; s++) {
      const p = plan(s);
      expect(p.lobes.length).toBeGreaterThanOrEqual(4);
      expect(p.lobes.length).toBeLessThanOrEqual(5);
      const flowers = p.lobes.flatMap((l) => l.flowers.length);
      expect(flowers.reduce((a, b) => a + b, 0), `seed ${s}`).toBeGreaterThan(220);
      for (const l of p.lobes) for (const f of l.flowers) {
        expect(f.open[0]).toBeGreaterThanOrEqual(l.window[1] - 0.14 - 1e-9);
        expect(f.open[1]).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('opens flowers smoothly: no step bigger than a few percent per 1/400 of growth', () => {
    const p = plan(4);
    for (const f of p.lobes.flatMap((l) => l.flowers).slice(0, 80)) {
      let prev = openness(0, f.open);
      for (let i = 1; i <= 400; i++) {
        const cur = openness(i / 400, f.open);
        expect(Math.abs(cur - prev)).toBeLessThan(0.05);
        prev = cur;
      }
      expect(openness(1, f.open)).toBe(1);
    }
  });

  it('stays inside its 70-unit box (anchor .5/.7) at full growth', () => {
    for (let s = 1; s <= 40; s++) {
      for (const { lobe } of plan(s).lobes) {
        for (const q of silhouette(lobe, 1)) {
          expect(Math.abs(q.x), `seed ${s}`).toBeLessThan(31);
          expect(q.y, `seed ${s}`).toBeGreaterThan(-40);
          expect(q.y, `seed ${s}`).toBeLessThan(15);
        }
      }
    }
  });

  it('is a garden plant of the Mediterranean only: no wild range, cultivated there, offered by no existing garden', () => {
    const r = icePlant.range;
    expect(r.realms).toEqual([]);
    expect(r.cultivatedIn).toEqual(['mediterranean']);
    expect(icePlant.habitats).toEqual(['meadow', 'rock', 'path']);
    const profiles = [
      { realm: 'japan', biomes: ['garden'], climate: 'warm-temperate', cultivated: true },
      { realm: 'japan', biomes: ['montane-stream', 'wet-cliff'], climate: 'cool-temperate', cultivated: false },
      { realm: 'n-africa-arabia', biomes: ['desert'], climate: 'arid', cultivated: true },
    ] as const;
    for (const pr of profiles) {
      expect(floraOf(allSpecies(), { ...pr, biomes: [...pr.biomes] }).map((s) => s.id)).not.toContain('ice-plant');
    }
    expect(floraOf(allSpecies(), { realm: 'mediterranean', biomes: ['garden', 'coast'], climate: 'warm-temperate', cultivated: true }).map((s) => s.id)).toContain('ice-plant');
    expect(getSpecies('ice-plant')).toBe(icePlant);
  });
});
