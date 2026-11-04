import { describe, expect, it } from 'vitest';
import { only, pinnedState } from '../ambience/daylight';
import { castShadow, type CastShadow } from '../ambience/sky-layout';
import { GARDEN_SKY_LAYOUT } from '../scenery/japanese-garden/sky';
import { drawPlantShadow, shadowBox } from './shadow';
import { installFakeOffscreenCanvas } from './test-canvas';

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

  it('lie to the left at both low suns where the scenery puts the sun on the right (the waterfall, ADR 0284)', () => {
    const sky = { ...GARDEN_SKY_LAYOUT, sunSide: { sunrise: 1, sunset: 1 } as const };
    for (const p of ['sunrise', 'sunset'] as const) {
      const box = shadowBox(plant, castShadow(pinnedState(only(p)), sky));
      expect(Math.cos(box.angle)).toBeLessThan(-0.9);
      expect(box.len).toBe(shadowBox(plant, shadow(p)).len);
    }
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

  it('with the sun on the other side, the drawn blot is the exact mirror (S10c)', () => {
    const restore = installFakeOffscreenCanvas();
    try {
      const sided = (v: 1 | -1) => ({ ...GARDEN_SKY_LAYOUT, sunSide: { sunrise: v, sunset: v } as const });
      for (const p of ['sunrise', 'sunset'] as const) {
        const left = castShadow(pinnedState(only(p)), sided(1));
        const right = castShadow(pinnedState(only(p)), sided(-1));
        const l = blotCorners(left);
        const r = blotCorners(right).map((q) => ({ x: 2 * plant.x - q.x, y: q.y }));
        expect(l).toHaveLength(4);
        // the same four corners, met in the other order
        const key = (q: { x: number; y: number }) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`;
        expect(l.map(key).sort()).toEqual(r.map(key).sort());
        const bl = shadowBox(plant, left);
        const br = shadowBox(plant, right);
        expect(bl.angle).toBe(Math.PI - br.angle);
        expect([bl.len, bl.thick, bl.back]).toEqual([br.len, br.thick, br.back]);
      }
    } finally {
      restore();
    }
  });

  it('draws nothing when the shadow is too faint', () => {
    const calls: string[] = [];
    const ctx = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? () => calls.push(k) : undefined) }) as unknown as CanvasRenderingContext2D;
    drawPlantShadow(ctx, plant, { dx: 0, dy: 0, alpha: 0 }, 1);
    expect(calls).toEqual([]);
  });
});

/** The world corners of the blot's rectangle as `drawPlantShadow` places it. */
function blotCorners(s: CastShadow): { x: number; y: number }[] {
  let t = { x: 0, y: 0, a: 0 };
  const out: { x: number; y: number }[] = [];
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save() {},
    restore() {},
    translate(x: number, y: number) {
      t = { ...t, x: t.x + x, y: t.y + y };
    },
    rotate(a: number) {
      t = { ...t, a: t.a + a };
    },
    drawImage(_img: unknown, x: number, y: number, w: number, h: number) {
      for (const [u, v] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] as const) {
        out.push({ x: t.x + u * Math.cos(t.a) - v * Math.sin(t.a), y: t.y + u * Math.sin(t.a) + v * Math.cos(t.a) });
      }
    },
  } as unknown as CanvasRenderingContext2D;
  drawPlantShadow(ctx, plant, s, 1);
  return out;
}
