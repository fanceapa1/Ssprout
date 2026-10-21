import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createSimplex2D, createValueNoise2D, fbm, noiseGrid } from './noise';

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
