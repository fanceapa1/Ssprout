import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PaintCache, PaintCacheStats } from '../paint/persist';
import { WORLD_H, WORLD_W } from '../render/viewport';
import { gardenScene } from '../scene/geometry';
import { SHRUBS, TREES } from '../scene/layout';
import type { Painters } from '../scenery/painters';
import { CAST_SCALE, castPrint, createCastLight, lightPlateKey, LIGHT_PLATE_KIND, lightPlatesSettled, type LightArt, type LightPainters } from './cast';
import { only, pinnedState } from './daylight';

vi.mock('./lighting', async (orig) => ({
  ...(await orig<typeof import('./lighting')>()),
  washField: () => ({}),
  gradePlate: () => new OffscreenCanvas(1, 1),
}));

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

/** A paint cache whose lookups answer only when `answer()` is called. */
function fakeCache(stored: Set<string> = new Set()) {
  const waiting: Array<() => void> = [];
  const w = Math.ceil(WORLD_W * CAST_SCALE);
  const h = Math.ceil(WORLD_H * CAST_SCALE);
  const cache: PaintCache = {
    version: 'test',
    get: (kind, key) => new Promise((done) => waiting.push(() => done(stored.has(`${kind}:${key}`) ? ({ width: w, height: h, close() {} } as unknown as ImageBitmap) : null))),
    put: () => Promise.resolve(true),
    clear: async () => {},
    settle: async () => {},
    stats: async () => ({}) as PaintCacheStats,
  };
  const answer = async () => {
    for (const fn of waiting.splice(0)) fn();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { cache, answer, w, h };
}

/** Painters that land only when `land()` is called. */
function slowPainters() {
  let value: { light: LightPainters } | null = null;
  let land = () => {};
  const loaded = new Promise<void>((r) => (land = r));
  const load = vi.fn(async () => {
    await loaded;
    return (value = { light: {} });
  });
  const painters: Painters<{ light: LightPainters }> = { get: () => value, load };
  return { painters, load, land };
}

const noon = pinnedState(only('midday'));
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('light plates wait for the lazy painters (devlog 155)', () => {
  it('a plate the cache lacks settles once its lookup answered and the painters landed', async () => {
    const f = fakeCache();
    const p = slowPainters();
    const light = createCastLight(gardenScene, { trees: TREES, shrubs: SHRUBS, painters: p.painters }, 'miss', { cache: f.cache, scenery: 'japanese-garden' });
    light.update(noon);
    let done = false;
    const wait = lightPlatesSettled().then(() => (done = true));
    await tick();
    expect(done).toBe(false);
    await f.answer();
    expect(p.load).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);
    p.land();
    await wait;
    expect(done).toBe(true);
    expect(light.has('midday')).toBe(false);
  });

  it('a plate the cache gives settles without loading the painters', async () => {
    const art: LightArt = { trees: TREES, shrubs: SHRUBS };
    const f = fakeCache();
    const key = lightPlateKey('japanese-garden', 'hit', 'midday', f.w, f.h, castPrint(gardenScene, art));
    const hit = fakeCache(new Set([`${LIGHT_PLATE_KIND}:${key}`]));
    const p = slowPainters();
    const light = createCastLight(gardenScene, { ...art, painters: p.painters }, 'hit', { cache: hit.cache, scenery: 'japanese-garden' });
    light.update(noon);
    const wait = light.settled();
    await hit.answer();
    await wait;
    await lightPlatesSettled();
    expect(light.has('midday')).toBe(true);
    expect(p.load).not.toHaveBeenCalled();
  });
});
