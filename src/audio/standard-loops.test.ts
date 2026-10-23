import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { LOFI_BEAT_S, standardLoop } from './standard-loops';

describe('original Standard loops', () => {
  for (const kind of ['fire', 'cafe', 'lofi'] as const) {
    it(`${kind}: deterministic, audible, bounded, with a quiet loop boundary`, () => {
      const a = standardLoop(kind, createRng(2), 8000);
      const b = standardLoop(kind, createRng(2), 8000);
      let max = 0, square = 0, difference = 0;
      for (let i = 0; i < a.length; i++) {
        max = Math.max(max, Math.abs(a[i]!));
        square += a[i]! ** 2;
        difference += Math.abs(a[i]! - b[i]!);
      }
      expect(difference).toBe(0);
      expect(max).toBeLessThanOrEqual(0.701);
      expect(Math.sqrt(square / a.length)).toBeGreaterThan(0.02);
      expect(Math.abs(a[0]! - a[a.length - 1]!)).toBeLessThan(0.25);
      if (kind === 'lofi') expect(a.length).toBe(Math.round(16 * LOFI_BEAT_S * 8000));
    });
  }
});
