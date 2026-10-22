import { describe, expect, it } from 'vitest';
import { blendWeights, only, pinnedState } from '../ambience/daylight';
import { moonDisc, sunDisc } from '../ambience/sky-layout';
import { farRidge, skyShape, SKY_RECT } from './paint-sky';
import { blendOrder, skyKey, WATER_SKY_ALPHA } from './sky-light';

describe('sky composite', () => {
  it('blends heaviest first, each layer covering its share (an exact convex mix)', () => {
    expect(blendOrder(only('night'))).toEqual([{ phase: 'night', alpha: 1 }]);
    const order = blendOrder(blendWeights('sunset', 'night', 0.25));
    expect(order.map((o) => o.phase)).toEqual(['sunset', 'night']);
    expect(order[0]!.alpha).toBe(1);
    expect(order[1]!.alpha).toBeCloseTo(0.25, 9);
  });

  it('only rebuilds when the blend or the sun and moon moved perceptibly', () => {
    const s = { ...pinnedState(only('sunset')), sunAltitude: 3.3 };
    const k = skyKey(s.weights, sunDisc(s), moonDisc(s));
    const nudged = { ...s, sunAltitude: s.sunAltitude + 0.01 };
    expect(skyKey(nudged.weights, sunDisc(nudged), moonDisc(nudged))).toBe(k);
    const moved = { ...s, sunAltitude: s.sunAltitude + 1 };
    expect(skyKey(moved.weights, sunDisc(moved), moonDisc(moved))).not.toBe(k);
    const blend = pinnedState(blendWeights('sunset', 'night', 0.1));
    expect(skyKey(blend.weights, sunDisc(blend), moonDisc(blend))).not.toBe(k);
  });

  it('covers the sky above the far ridge, reaching above the world for tall phones', () => {
    expect(SKY_RECT.y).toBeLessThan(-150);
    const ridge = farRidge();
    expect(Math.max(...ridge.map((p) => p.y))).toBeLessThan(SKY_RECT.y + SKY_RECT.h);
    expect(skyShape(0).length).toBeGreaterThan(ridge.length);
  });

  it('lays the sky on the water lightly, most at sunset and night', () => {
    expect(WATER_SKY_ALPHA.midday).toBeLessThan(WATER_SKY_ALPHA.sunset);
    for (const a of Object.values(WATER_SKY_ALPHA)) expect(a).toBeLessThan(0.5);
  });
});
