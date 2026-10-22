import { describe, expect, it } from 'vitest';
import { createRimCache, drawRim, rimWidth } from './rim';

describe('rim light', () => {
  it('is about 4 % of a sprite, between 1.5 and 9 px', () => {
    expect(rimWidth(100, 200)).toBeCloseTo(4, 6);
    expect(rimWidth(10, 10)).toBe(1.5);
    expect(rimWidth(1000, 1000)).toBe(9);
  });

  it('draws with screen at the rim strength and restores the context', () => {
    const ops: Array<[string, unknown]> = [];
    const ctx = {
      globalCompositeOperation: 'source-over',
      globalAlpha: 0.8,
      drawImage(...args: unknown[]) {
        ops.push(['draw', `${this.globalCompositeOperation}@${this.globalAlpha.toFixed(2)}`]);
        void args;
      },
    };
    const mask = { width: 10, height: 10 };
    const cache = { get: () => mask as never, built: 0 };
    drawRim(ctx as unknown as CanvasRenderingContext2D, cache, mask as never, { x: 0, y: 0, w: 10, h: 10 }, { side: -1, strength: 0.5, rgb: [255, 200, 120] }, 0.5);
    expect(ops).toEqual([['draw', 'screen@0.20']]);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(0.8);
  });

  it('skips a rim too faint to see', () => {
    let drawn = false;
    const ctx = { drawImage: () => (drawn = true) };
    drawRim(ctx as never, createRimCache(), {} as never, { x: 0, y: 0, w: 1, h: 1 }, { side: 1, strength: 0.005, rgb: [255, 255, 255] });
    expect(drawn).toBe(false);
  });

  it('builds one mask per image, side and (quantised) colour', () => {
    const cache = createRimCache();
    const img = { width: 4, height: 4 } as unknown as CanvasImageSource;
    // jsdom has no canvas: masks come back null, but are still cached per key
    cache.get(img, 1, [255, 200, 120]);
    cache.get(img, 1, [250, 205, 124]);
    expect(cache.built).toBe(1);
    cache.get(img, -1, [255, 200, 120]);
    expect(cache.built).toBe(2);
  });
});
