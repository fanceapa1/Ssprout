import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createLazyValueNoise2D, createSimplex2D, createValueNoise2D, fbm, noiseGrid } from './noise';

const samples = (n: (x: number, y: number) => number) =>
  Array.from({ length: 200 }, (_, i) => n(i * 0.37 + 0.1, i * 0.19 - 3.3));

describe('simplex noise', () => {
  it('is deterministic per seed and differs between seeds', () => {
    expect(samples(createSimplex2D(createRng(4)))).toEqual(samples(createSimplex2D(createRng(4))));
    expect(samples(createSimplex2D(createRng(4)))).not.toEqual(samples(createSimplex2D(createRng(5))));
  });

  it('stays within [-1, 1] and is continuous', () => {
    const n = createSimplex2D(createRng(1));
    let max = 0;
    for (let i = 0; i < 5000; i++) {
      const x = (i % 100) * 0.13;
      const y = Math.floor(i / 100) * 0.13;
      const v = n(x, y);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      max = Math.max(max, Math.abs(n(x + 0.001, y) - v));
    }
    expect(max).toBeLessThan(0.05);
  });
});

describe('value noise', () => {
  it('tiles with its period', () => {
    const n = createValueNoise2D(createRng(2), 16);
    for (let i = 0; i < 50; i++) {
      const x = i * 0.71;
      const y = i * 0.29;
      expect(n(x + 16, y)).toBeCloseTo(n(x, y), 6);
      expect(n(x, y - 32)).toBeCloseTo(n(x, y), 6);
    }
  });
});

describe('lazy value noise (ADR 0223)', () => {
  it('is the same noise as createValueNoise2D, value for value, in any sampling order', () => {
    for (const period of [256, 16]) {
      const full = createValueNoise2D(createRng(`v${period}`), period);
      const lazy = createLazyValueNoise2D(createRng(`v${period}`), period);
      // rows read out of order, negative and past the period on both axes
      for (const y of [7.5, 0.5, 3.5, -2.25, 24.8, 300.1]) {
        for (let i = -40; i < 400; i++) expect(lazy(i * 1.37, y)).toBe(full(i * 1.37, y));
      }
    }
  });

  it('draws only the rows up to the deepest one it samples', () => {
    const rng = createRng('rows');
    let draws = 0;
    const counted = { ...rng, next: () => (draws++, rng.next()) };
    const n = createLazyValueNoise2D(counted, 256);
    expect(draws).toBe(0);
    for (let s = 0; s < 2000; s++) n(s / 3, 3.5);
    expect(draws).toBe(5 * 256); // rows 0…4
    n(10, 0.5);
    expect(draws).toBe(5 * 256);
  });
});

describe('fbm', () => {
  it('is normalised to about [-1, 1]', () => {
    const n = createSimplex2D(createRng(3));
    for (let i = 0; i < 500; i++) expect(Math.abs(fbm(n, i * 0.21, i * 0.07, { octaves: 5 }))).toBeLessThanOrEqual(1);
  });

  it('with one octave equals the base noise (offset by the octave shift)', () => {
    const n = createSimplex2D(createRng(3));
    expect(fbm(n, 1.5, 2.5, { octaves: 1 })).toBeCloseTo(n(1.5, 2.5), 10);
  });
});

describe('noiseGrid', () => {
  it('samples in [0, 1], matching grid values at grid points', () => {
    const n = createSimplex2D(createRng(9));
    const g = noiseGrid(n, 100, 60, 10, 40);
    expect(g.cols).toBeGreaterThanOrEqual(11);
    expect(g.sample(20, 30)).toBeCloseTo(g.data[3 * g.cols + 2]!, 6);
    for (let i = 0; i < 100; i++) {
      const v = g.sample(i, i * 0.6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
