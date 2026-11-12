import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { only, pinnedState } from '../ambience/daylight';
import type { PaintCache, PaintCacheStats } from '../paint/persist';
import type { Painters } from '../scenery/painters';
import type { SkyPainters } from '../scenery/types';
import { gardenScene } from './geometry';
import { GARDEN_SKY } from '../scenery/japanese-garden/art';
import { createSkyLight, SKY_PLATE_KIND } from './sky-light';

/** A canvas whose 2D context takes every call and draws nothing (Node has no canvas). */
class StubCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    const target: Record<string | symbol, unknown> = {};
    return new Proxy(target, {
      get: (t, k) => (k in t ? t[k] : k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}),
      set: (t, k, v) => ((t[k] = v), true),
    });
  }
}

const had = 'OffscreenCanvas' in globalThis;
beforeAll(() => {
  if (!had) (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = StubCanvas;
});
afterAll(() => {
  if (!had) delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
});

/** A paint cache whose lookups answer only when `answer()` is called; `hit` holds every sky plate. */
function fakeCache(hit: boolean) {
  const waiting: Array<() => void> = [];
  const cache: PaintCache = {
    version: 'test',
    get: (kind, key) =>
      new Promise((done) =>
        waiting.push(() => {
          // the atlas size from the key: the sky plate above its water plate
          const m = /\|(\d+)x(\d+)\|.*@(\d+)x(\d+)$/.exec(key);
          if (!hit || kind !== SKY_PLATE_KIND || !m) return done(null);
          const [sw, sh, ww, wh] = m.slice(1).map(Number) as [number, number, number, number];
          done({ width: Math.max(sw, ww), height: sh + wh, close() {} } as unknown as ImageBitmap);
        }),
      ),
    put: () => Promise.resolve(true),
    clear: async () => {},
    settle: async () => {},
    stats: async () => ({}) as PaintCacheStats,
  };
  const answer = async () => {
    for (const fn of waiting.splice(0)) fn();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { cache, answer };
}

/** Painters that land only when `land()` is called. */
function slowPainters() {
  let value: { sky: SkyPainters } | null = null;
  let land = () => {};
  const loaded = new Promise<void>((r) => (land = r));
  const load = vi.fn(async () => {
    await loaded;
    return (value = { sky: { paint() {}, paintWater() {} } });
  });
  const painters: Painters<{ sky: SkyPainters }> = { get: () => value, load };
  return { painters, load, land };
}

const noon = pinnedState(only('midday'));
const tick = () => new Promise((r) => setTimeout(r, 0));
const ctx = () => new StubCanvas(1, 1).getContext() as unknown as CanvasRenderingContext2D;

function sky(hit: boolean) {
  const f = fakeCache(hit);
  const p = slowPainters();
  const onPainters = vi.fn();
  const light = createSkyLight({ pond: gardenScene.pond, seed: 7, sky: { ...GARDEN_SKY, painters: p.painters }, scenery: 'japanese-garden', cache: f.cache, onPainters });
  return { f, p, light, onPainters };
}

describe('the sky waits for its plate lookup (devlog 159)', () => {
  it('a draw while its plate is looked up loads nothing; a miss loads the painters and a still frame waits for them', async () => {
    const { f, p, light } = sky(false);
    light.update(noon);
    light.drawSky(ctx());
    light.drawWater(ctx());
    light.setDetail({ x: 0, y: -200, w: 200, h: 200 }, 3);
    light.drawSky(ctx(), { x: 0, y: -200, w: 200, h: 200 });
    expect(light.stats().composes).toBe(1);
    expect(p.load).not.toHaveBeenCalled();
    let done = false;
    const wait = light.settled().then(() => (done = true));
    await f.answer();
    expect(p.load).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);
    p.land();
    await wait;
    expect(done).toBe(true);
  });

  it('a draw while its plate is looked up loads nothing; a hit redraws with the plate on the next update', async () => {
    const { f, p, light, onPainters } = sky(true);
    light.update(noon);
    light.drawSky(ctx());
    const composes = light.stats().composes;
    expect(composes).toBe(1);
    await f.answer();
    await light.settled();
    expect(light.has('midday')).toBe(true);
    expect(onPainters).toHaveBeenCalledTimes(1);
    expect(light.update(noon)).toBe(true);
    expect(light.stats().composes).toBe(composes + 1);
    await tick();
    expect(p.load).not.toHaveBeenCalled();
  });

  it('a hit before any draw composes the plate without loading the painters', async () => {
    const { f, p, light, onPainters } = sky(true);
    light.update(noon);
    await f.answer();
    light.drawSky(ctx());
    expect(light.stats().composes).toBe(1);
    expect(light.stats().cacheHits).toBe(1);
    expect(onPainters).not.toHaveBeenCalled();
    expect(p.load).not.toHaveBeenCalled();
  });
});
