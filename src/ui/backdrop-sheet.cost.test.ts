import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rng } from '../core/rng';
import { SHEET, sheetMaskSvg, sheetShadowSvg } from './backdrop-sheet';

/**
 * What a sheet costs (ADR 0223), counted in random draws: every `next()` of every stream the
 * sheet makes, forks included. The original 256 × 256 lattices drew about 3.8 million per section.
 */
let draws = 0;
vi.mock('../core/rng', async (importOriginal) => {
  const real = await importOriginal<typeof import('../core/rng')>();
  const count = (rng: Rng): Rng => {
    const next = () => (draws++, rng.next());
    return {
      ...rng,
      next,
      range: (min, max) => min + next() * (max - min),
      int: (min, max) => (draws++, rng.int(min, max)),
      fork: (label) => count(rng.fork(label)),
    };
  };
  return { ...real, createRng: (seed: number | string) => count(real.createRng(seed)) };
});

const layout = (seed: string, w: number, h: number) => {
  sheetMaskSvg(seed, w, h, SHEET.leaf);
  sheetShadowSvg(seed, w, h, SHEET.leaf);
};

describe('backdrop sheet · cost', () => {
  beforeEach(() => {
    draws = 0;
  });

  it('draws only the noise rows its edges read: under 70 000 draws for a new section', () => {
    layout('cost-a', 1046, 640);
    expect(draws).toBeGreaterThan(0);
    expect(draws).toBeLessThan(70_000);
  });

  it('builds a seed’s noise once: a resize redraws only the fibres and the rim', () => {
    layout('cost-b', 520, 430);
    draws = 0;
    layout('cost-b', 520, 470);
    layout('cost-b', 1046, 470);
    expect(draws).toBeLessThan(1_000);
  });
});
