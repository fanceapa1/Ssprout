import { describe, expect, it } from 'vitest';
import { only, pinnedState } from '../ambience/daylight';
import { castShadow } from '../ambience/sky-layout';
import { drawPlantShadow, shadowBox } from './shadow';

const plant = { x: 500, y: 700, w: 60, h: 120 };
const shadow = (p: Parameters<typeof only>[0]) => castShadow(pinnedState(only(p)));

describe('plant cast shadows', () => {
  it('lie long and to the left at sunrise, long and to the right at sunset', () => {
    const rise = shadowBox(plant, shadow('sunrise'));
    const set = shadowBox(plant, shadow('sunset'));
    expect(Math.cos(rise.angle)).toBeLessThan(-0.9);
    expect(Math.cos(set.angle)).toBeGreaterThan(0.9);
    expect(rise.len).toBeGreaterThan(plant.h);
    expect(set.len).toBeGreaterThan(plant.h);
  });

  it('are a short pool under the plant at midday', () => {
    const noon = shadowBox(plant, shadow('midday'));
    expect(noon.len).toBeLessThan(plant.w * 1.2);
    expect(noon.back).toBeGreaterThan(plant.w * 0.3); // centred under the plant, not beside it
  });

  it('never grow longer than 1.3× the plant, never thinner than a few units, lie almost flat', () => {
    for (const p of ['sunrise', 'midday', 'sunset', 'night'] as const) {
      const b = shadowBox(plant, shadow(p));
      expect(b.len).toBeLessThanOrEqual(plant.h * 1.3 + 1e-9);
      expect(b.thick).toBeGreaterThanOrEqual(4);
      expect(Math.abs(Math.sin(b.angle))).toBeLessThan(0.25);
    }
  });

  it('draws nothing when the shadow is too faint', () => {
    const calls: string[] = [];
    const ctx = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? () => calls.push(k) : undefined) }) as unknown as CanvasRenderingContext2D;
    drawPlantShadow(ctx, plant, { dx: 0, dy: 0, alpha: 0 }, 1);
    expect(calls).toEqual([]);
  });
});
