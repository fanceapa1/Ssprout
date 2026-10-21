import { describe, expect, it } from 'vitest';
import { createRng, hashString, toSeed } from './rng';

const draws = (seed: number | string, n = 20) => {
  const r = createRng(seed);
  return Array.from({ length: n }, () => r.next());
};

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    expect(draws(42)).toEqual(draws(42));
    expect(draws('koi')).toEqual(draws('koi'));
  });

  it('differs between seeds', () => {
    expect(draws(1)).not.toEqual(draws(2));
    expect(draws('a')).not.toEqual(draws('b'));
  });

  it('produces a known sequence (guards against accidental algorithm changes)', () => {
    const r = createRng(12345);
    const first = [r.next(), r.next(), r.next()];
    expect(first).toEqual([0.6931933513842523, 0.8536368538625538, 0.06626646220684052]);
  });

  it('next() stays in [0, 1) and is roughly uniform', () => {
    const r = createRng(7);
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10_000).toBeCloseTo(0.5, 1);
  });

  it('range() and int() respect bounds; int is inclusive', () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const f = r.range(-2, 5);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(5);
      const n = r.int(1, 4);
      expect(Number.isInteger(n)).toBe(true);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('pick() returns members and throws on empty', () => {
    const r = createRng(9);
    const items = ['iris', 'peony', 'lotus'] as const;
    for (let i = 0; i < 50; i++) expect(items).toContain(r.pick(items));
    expect(() => r.pick([])).toThrow(RangeError);
  });

  it('shuffle() returns a permutation copy, deterministically', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = createRng('s').shuffle(input);
    const b = createRng('s').shuffle(input);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('gaussian() has roughly the requested mean and sd', () => {
    const r = createRng(11);
    const n = 20_000;
    const xs = Array.from({ length: n }, () => r.gaussian(10, 2));
    const mean = xs.reduce((s, x) => s + x, 0) / n;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
    expect(mean).toBeCloseTo(10, 1);
    expect(sd).toBeCloseTo(2, 1);
    expect(xs.every(Number.isFinite)).toBe(true);
  });

  it('chance() honours extremes and frequency', () => {
    const r = createRng(5);
    expect(r.chance(0)).toBe(false);
    expect(r.chance(1)).toBe(true);
    let hits = 0;
    for (let i = 0; i < 10_000; i++) if (r.chance(0.3)) hits++;
    expect(hits / 10_000).toBeCloseTo(0.3, 1);
  });

  it('fork() is deterministic, label-dependent and independent of parent position', () => {
    const p1 = createRng(100);
    const p2 = createRng(100);
    p2.next();
    p2.next(); // advancing the parent must not change the fork
    const f1 = p1.fork('petals');
    const f2 = p2.fork('petals');
    expect([f1.next(), f1.next()]).toEqual([f2.next(), f2.next()]);
    expect(p1.fork('petals').next()).not.toBe(p1.fork('leaves').next());
    expect(p1.fork('petals').next()).not.toBe(createRng(100).next());
  });
});

describe('seeding helpers', () => {
  it('hashString is stable and 32-bit unsigned', () => {
    expect(hashString('study sprout')).toBe(hashString('study sprout'));
    const h = hashString('x');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
    expect(hashString('a')).not.toBe(hashString('b'));
  });

  it('toSeed accepts numbers of any size and rejects non-finite', () => {
    expect(toSeed(1)).not.toBe(toSeed(2));
    expect(toSeed(1.5)).toBe(toSeed(1));
    expect(toSeed(1_700_000_000_000)).not.toBe(toSeed(1_700_000_000_001));
    expect(() => toSeed(Number.NaN)).toThrow(RangeError);
  });
});
