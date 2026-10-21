import { describe, expect, it } from 'vitest';
import { recordingContext } from '../widget/test-helpers';
import { GROWTH_STEPS, plantLayout, quantiseGrowth, renderPlantView } from './view';

const fakeCanvas = () => {
  const ctx = recordingContext();
  const canvas = { width: 200, height: 160, getContext: () => ctx } as unknown as HTMLCanvasElement;
  (ctx as unknown as { canvas: unknown }).canvas = canvas;
  return { canvas, ctx };
};

describe('plant view', () => {
  it('quantises growth to cacheable steps', () => {
    expect(quantiseGrowth(0)).toBe(0);
    expect(quantiseGrowth(1)).toBe(1);
    expect(quantiseGrowth(0.5)).toBe(0.5);
    expect(quantiseGrowth(0.5 + 0.2 / GROWTH_STEPS)).toBe(0.5);
    expect(quantiseGrowth(2)).toBe(1);
    expect(quantiseGrowth(Number.NaN)).toBe(0);
  });

  it('contains the species with its base at the bottom centre', () => {
    const L = plantLayout({ size: { w: 40, h: 50 }, anchor: { x: 0.5, y: 0.95 } }, 200, 160);
    expect(L.h).toBeLessThanOrEqual(160);
    expect(L.w).toBeLessThanOrEqual(200);
    expect(L.x + 0.5 * L.w).toBeCloseTo(100, 0);
    expect(L.y + 0.95 * L.h).toBeCloseTo(160 * 0.97, 0);
  });

  it('returns false for unknown species', () => {
    const { canvas } = fakeCanvas();
    expect(renderPlantView(canvas, { speciesId: 'nope', seed: 1, growth: 0.5, watering: null })).toBe(false);
  });

  it('draws a known species, with a watering can and droplets mid-animation', () => {
    const plain = fakeCanvas();
    expect(renderPlantView(plain.canvas, { speciesId: 'placeholder-sprout', seed: 1, growth: 0.5, watering: null })).toBe(true);
    const watering = fakeCanvas();
    expect(renderPlantView(watering.canvas, { speciesId: 'placeholder-sprout', seed: 1, growth: 0.5, watering: 0.5 })).toBe(true);
    expect(watering.ctx.fills.some((f) => f.startsWith('rgba(111,150,144'))).toBe(true); // droplets
    expect(plain.ctx.fills.some((f) => f.startsWith('rgba(111,150,144'))).toBe(false);
  });
});
