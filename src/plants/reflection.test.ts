import { describe, expect, it } from 'vitest';
import { insidePolygon, MAX_SHORE_GAP, mirrorBox, mirrorY, shoreAxis, verticalHits, waverAt } from './reflection';

// a pond: a rectangle from y 500 to 600, x 400..800
const pond = [
  { x: 400, y: 500 },
  { x: 800, y: 500 },
  { x: 800, y: 600 },
  { x: 400, y: 600 },
];

describe('reflection maths', () => {
  it('finds where a vertical line crosses the pond edge', () => {
    expect(verticalHits(pond, 600)).toEqual([500, 600]);
    expect(verticalHits(pond, 900)).toEqual([]);
    expect(insidePolygon(pond, { x: 600, y: 550 })).toBe(true);
    expect(insidePolygon(pond, { x: 600, y: 450 })).toBe(false);
  });

  it('mirrors a plant standing in the water about its own base', () => {
    expect(shoreAxis(pond, 600, 560)).toBe(560);
  });

  it('mirrors a far-bank plant about the shoreline below it', () => {
    expect(shoreAxis(pond, 600, 480)).toBe(500);
    // too far up the bank: no reflection
    expect(shoreAxis(pond, 600, 500 - MAX_SHORE_GAP - 5)).toBeNull();
  });

  it('casts nothing for plants in front of the pond or beside it', () => {
    expect(shoreAxis(pond, 600, 650)).toBeNull();
    expect(shoreAxis(pond, 300, 480)).toBeNull();
    // beside it, but the foliage reaches over the water
    expect(shoreAxis(pond, 380, 490, 60)).toBe(500);
    expect(shoreAxis([], 600, 480)).toBeNull();
  });

  it('flips about the axis (an involution) and swaps the box top and bottom', () => {
    expect(mirrorY(480, 500)).toBe(520);
    expect(mirrorY(mirrorY(437, 512), 512)).toBe(437);
    const box = { x: 10, y: 400, w: 50, h: 80 }; // base near y = 480
    const m = mirrorBox(box, 500);
    expect(m).toEqual({ x: 10, y: 520, w: 50, h: 80 });
    // the plant's base (bottom) maps to the reflection's top
    expect(m.y).toBe(mirrorY(box.y + box.h, 500));
    expect(m.y + m.h).toBe(mirrorY(box.y, 500));
  });

  it('wavers gently, more away from the shore', () => {
    let near = 0;
    let far = 0;
    for (let t = 0; t < 20; t += 0.1) {
      near = Math.max(near, Math.abs(waverAt(t, 502, 500, 0)));
      far = Math.max(far, Math.abs(waverAt(t, 600, 500, 0)));
    }
    expect(far).toBeLessThanOrEqual(1.3 + 1e-9);
    expect(far).toBeGreaterThan(near);
  });
});
