import { describe, expect, it } from 'vitest';
import { COAST } from '../scenery/coast';
import { loadAllCreatures } from './creatures/registry';
import { benchFrame } from './dev';
import { FaunaSim } from './sim';

await loadAllCreatures();

describe('the fauna bench', () => {
  it('draws every creature of a frame, then reads a pixel so the raster work is in the time', () => {
    const sim = new FaunaSim({ scene: COAST.geometry, seed: 3, habitat: COAST.fauna, auto: false });
    sim.spawn('gull', { count: 2 });
    sim.spawn('cat');
    for (let i = 0; i < 400; i++) sim.update(0.05, 0);
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === 'globalAlpha' ? 1 : (..._a: unknown[]) => calls.push(String(k))),
      set: () => true,
    });
    (sim.world.art as unknown as { get: (k: string, f: (r: number) => unknown) => unknown }).get = () =>
      new Proxy({}, { get: () => ({ img: {}, w: 1, h: 1, ox: 0, oy: 0 }) });
    benchFrame(sim, ctx as unknown as CanvasRenderingContext2D);
    expect(calls.filter((c) => c === 'drawImage').length).toBeGreaterThan(6);
    expect(calls[calls.length - 1]).toBe('getImageData');
    expect(calls.filter((c) => c === 'getImageData')).toHaveLength(1);
  });
});
