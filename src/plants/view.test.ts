import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeCanvas, installFakeOffscreenCanvas } from './test-canvas';
import { GROWTH_STEPS, growthZoom, MAX_GROWTH_ZOOM, plantLayout, quantiseGrowth, renderPlantView, setPlantViewSpecies } from './view';
import type { SpeciesDef } from './types';
import { placeholderSprout } from '../dev/placeholder-sprout';

let restore: () => void;
beforeAll(() => {
  restore = installFakeOffscreenCanvas();
  setPlantViewSpecies((id) => (id === placeholderSprout.id ? placeholderSprout : undefined));
});
afterAll(() => {
  setPlantViewSpecies(null);
  restore();
});

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

describe('growth framing (thumbnails)', () => {
  const L = { w: 100, h: 100 };
  it('enlarges a small seedling so it fills the frame, within the cap', () => {
    // a seedling: content 6 % of the box tall and 10 % wide, anchored at 0.92
    const z = growthZoom({ left: 0.45, top: 0.86, right: 0.55 }, 0.92, L, 100, 100);
    expect(z).toBe(MAX_GROWTH_ZOOM);
    const mid = growthZoom({ left: 0.3, top: 0.6, right: 0.7 }, 0.92, L, 100, 100);
    expect(mid).toBeGreaterThan(1.5);
    expect(mid).toBeLessThan(MAX_GROWTH_ZOOM);
  });

  it('leaves a grown plant at the species framing', () => {
    expect(growthZoom({ left: 0.05, top: 0.05, right: 0.95 }, 0.92, L, 100, 100)).toBe(1);
    expect(growthZoom(null, 0.92, L, 100, 100)).toBe(1);
  });

  it('zooms about the base: the plant stands on the same ground line', () => {
    const def = { size: { w: 100, h: 120 }, anchor: { x: 0.5, y: 0.9 } };
    const a = plantLayout(def, 64, 64);
    const b = plantLayout(def, 64, 64, 3);
    expect(b.baseY).toBe(a.baseY);
    expect(b.baseX).toBe(a.baseX);
    expect(b.h).toBeGreaterThan(a.h * 2.9);
  });

  it('renders with growth framing', () => {
    setPlantViewSpecies((id) => (id === placeholderSprout.id ? placeholderSprout : undefined));
    const c = target(64, 64);
    expect(renderPlantView(asCanvas(c), { speciesId: placeholderSprout.id, seed: 3, growth: 0.1, watering: null, framing: 'growth' })).toBe(true);
  });
});
