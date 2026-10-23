import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { createSimplex2D } from '../paint';
import { WORLD_H, WORLD_W } from '../render/viewport';
import { MARGIN, marginField } from './paint-land';

const field = marginField(createSimplex2D(createRng(7).fork('margins').fork('margin')));

describe('paper margins (ADR 0185)', () => {
  it('lifts most at the sheet edge and nothing in the middle', () => {
    expect(field(1, 500)).toBeGreaterThan(0.7);
    expect(field(WORLD_W - 1, 520)).toBeGreaterThan(0.7);
    expect(field(800, WORLD_H - 1)).toBeGreaterThan(0.6);
    expect(field(800, 500)).toBe(0);
    expect(field(400, 600)).toBe(0);
    for (let x = 0; x <= WORLD_W; x += 37) for (let y = 0; y <= WORLD_H; y += 41) expect(field(x, y)).toBeLessThanOrEqual(MARGIN.maxLift);
  });

  it('cuts deeper at the bottom corners than along the sides', () => {
    const side = (y: number) => {
      let x = 0;
      while (x < 600 && field(x, y) > 0.05) x += 2;
      return x;
    };
    expect(side(950)).toBeGreaterThan(side(300));
  });

  it('is a continuous ramp: no step between neighbouring points exceeds the noise level (no seams)', () => {
    // a band of horizontal profiles across the left and right margins, one world unit apart
    let worst = 0;
    for (let y = 120; y < 980; y += 9) {
      for (let x = 0; x < 360; x += 1) worst = Math.max(worst, Math.abs(field(x + 1, y) - field(x, y)));
      for (let x = WORLD_W - 360; x < WORLD_W; x += 1) worst = Math.max(worst, Math.abs(field(x + 1, y) - field(x, y)));
    }
    // nine nested 20 % bands stepped by up to 0.2 per unit; the field moves by a few hundredths
    expect(worst).toBeLessThan(0.03);
  });

  it('wanders: the front is not a straight line', () => {
    const front = (y: number) => {
      let x = 0;
      while (x < 600 && field(x, y) > 0.3) x += 0.5;
      return x;
    };
    const xs = Array.from({ length: 40 }, (_, i) => front(200 + i * 15));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(12);
  });
});
