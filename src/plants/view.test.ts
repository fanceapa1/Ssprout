import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeCanvas, installFakeOffscreenCanvas } from './test-canvas';
import { GROWTH_STEPS, plantLayout, quantiseGrowth, renderPlantView, setPlantViewSpecies } from './view';
import type { SpeciesDef } from './types';

let restore: () => void;
beforeAll(() => {
  restore = installFakeOffscreenCanvas();
});
afterAll(() => restore());

const target = (w = 200, h = 160) => new FakeCanvas(w, h);
const asCanvas = (c: FakeCanvas) => c as unknown as HTMLCanvasElement;

describe('plant view', () => {
  it('quantises growth to cacheable steps', () => {
    expect(GROWTH_STEPS).toBe(24);
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
    expect(renderPlantView(asCanvas(target()), { speciesId: 'nope', seed: 1, growth: 0.5, watering: null })).toBe(false);
  });

  it('clears and draws a known species (ground wash + plant)', () => {
    const c = target();
    expect(renderPlantView(asCanvas(c), { speciesId: 'placeholder-sprout', seed: 1, growth: 0.5, watering: null })).toBe(true);
    expect(c.ctx.count('clearRect')).toBeGreaterThanOrEqual(1);
    expect(c.ctx.count('drawImage')).toBeGreaterThanOrEqual(2);
  });

  it('adds the watering can, droplets and damp soil mid-animation', () => {
    const plain = target();
    renderPlantView(asCanvas(plain), { speciesId: 'placeholder-sprout', seed: 1, growth: 0.5, watering: null });
    const watering = target();
    renderPlantView(asCanvas(watering), { speciesId: 'placeholder-sprout', seed: 1, growth: 0.5, watering: 0.55 });
    // can + soil + a stream of droplets: many more images than the plain view
    expect(watering.ctx.count('drawImage')).toBeGreaterThan(plain.ctx.count('drawImage') + 10);
    const rotations = watering.ctx.calls.filter((k) => k.name === 'rotate').length;
    expect(rotations).toBeGreaterThan(5);
  });

  it('draws a wilting plant drooped (bent) rather than upright', () => {
    const c = target();
    renderPlantView(asCanvas(c), { speciesId: 'placeholder-sprout', seed: 2, growth: 0.5, watering: null, wilt: 0.5 });
    expect(c.ctx.count('clip')).toBeGreaterThan(1); // bend slices
  });

  it('resolves extra species (dev fixtures) through setPlantViewSpecies', () => {
    const extra = { id: 'fx-test', size: { w: 40, h: 40 }, anchor: { x: 0.5, y: 0.95 }, draw() {} } as unknown as SpeciesDef;
    expect(renderPlantView(asCanvas(target()), { speciesId: 'fx-test', seed: 1, growth: 1, watering: null })).toBe(false);
    setPlantViewSpecies((id) => (id === 'fx-test' ? extra : undefined));
    expect(renderPlantView(asCanvas(target()), { speciesId: 'fx-test', seed: 1, growth: 1, watering: null })).toBe(true);
    setPlantViewSpecies(null);
  });
});
