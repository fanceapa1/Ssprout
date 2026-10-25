import { describe, expect, it } from 'vitest';
import type { AnyCanvas } from '../paint/canvas';
import type { PaintCache, PaintCacheStats } from '../paint/persist';
import { castPrint, lightPlateKey, LIGHT_PLATE_KIND } from './cast';
import type { DayPhase } from './daylight';
import { createPlateCache, fingerprint } from './plate-cache';
import { POND } from '../scene/geometry';
import { skyPlateKey, SKY_PLATE_KIND } from '../scene/sky-light';
import { SHRUBS, TREES } from '../scene/layout';

/** A paint cache over a Map whose lookups answer only when `answer()` is called (no canvas, no IndexedDB). */
function fakeCache(stored: Record<string, { width: number; height: number }> = {}) {
  const gets: string[] = [];
  const puts: Array<{ id: string; canvas: AnyCanvas; copy: boolean | undefined }> = [];
  const waiting: Array<() => void> = [];
  const cache: PaintCache = {
    version: 'test',
    get(kind, key) {
      const id = `${kind}:${key}`;
      gets.push(id);
      const found = stored[id];
      return new Promise((done) => waiting.push(() => done(found ? ({ ...found, close() {} } as unknown as ImageBitmap) : null)));
    },
    put(kind, key, canvas, opts) {
      puts.push({ id: `${kind}:${key}`, canvas, copy: opts?.copy });
      return Promise.resolve(true);
    },
    clear: async () => {},
    settle: async () => {},
    stats: async () => ({}) as PaintCacheStats,
  };
  /** answer every lookup asked so far, and let the answers run */
  const answer = async () => {
    for (const fn of waiting.splice(0)) fn();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { cache, gets, puts, answer };
}

const CANVAS = { width: 4, height: 2 } as unknown as AnyCanvas;

function plates(cache: PaintCache | null, size = { width: 4, height: 2 }) {
  const loaded = new Map<DayPhase, ImageBitmap>();
  const answers: Array<[DayPhase, boolean]> = [];
  const store = createPlateCache<DayPhase>({
    cache,
    kind: 'sky-plate',
    key: (p) => `k-${p}`,
    load(p, image) {
      if (image.width !== size.width || image.height !== size.height) return false;
      loaded.set(p, image);
      return true;
    },
    answered: (p, hit) => answers.push([p, hit]),
  });
  return { store, loaded, answers };
}

describe('daylight plates from the paint cache (ADR 0236)', () => {
  it('looks a plate up once and installs a hit; a hit is never stored again', async () => {
    const f = fakeCache({ 'sky-plate:k-midday': { width: 4, height: 2 } });
    const { store, loaded, answers } = plates(f.cache);
    expect(store.enabled).toBe(true);
    store.request('midday');
    store.request('midday');
    expect(f.gets).toEqual(['sky-plate:k-midday']);
    expect(store.pending('midday')).toBe(true);
    await f.answer();
    expect(store.pending('midday')).toBe(false);
    expect(loaded.has('midday')).toBe(true);
    expect(answers).toEqual([['midday', true]]);
    store.painted('midday', () => CANVAS);
    expect(f.puts).toEqual([]);
    expect(store.stats()).toEqual({ hits: 1, misses: 0, puts: 0 });
  });

  it('stores a plate painted after its lookup missed, without a copy', async () => {
    const f = fakeCache();
    const { store, answers } = plates(f.cache);
    store.request('night');
    await f.answer();
    expect(answers).toEqual([['night', false]]);
    store.painted('night', () => CANVAS);
    expect(f.puts).toEqual([{ id: 'sky-plate:k-night', canvas: CANVAS, copy: false }]);
    await f.answer();
    expect(store.stats()).toEqual({ hits: 0, misses: 1, puts: 1 });
  });

  it('a plate painted while its lookup is out is stored only if the lookup misses', async () => {
    const f = fakeCache({ 'sky-plate:k-sunset': { width: 4, height: 2 } });
    const { store } = plates(f.cache);
    let packed = 0;
    store.request('sunset');
    store.request('sunrise');
    store.painted('sunset', () => (packed++, CANVAS));
    store.painted('sunrise', () => (packed++, CANVAS));
    expect(f.puts).toEqual([]);
    await f.answer();
    expect(f.puts.map((p) => p.id)).toEqual(['sky-plate:k-sunrise']);
    expect(packed).toBe(1);
  });

  it('a plate painted without a lookup is looked up first, so a stored one is not encoded again', async () => {
    const f = fakeCache({ 'sky-plate:k-midday': { width: 4, height: 2 } });
    const { store } = plates(f.cache);
    store.painted('midday', () => CANVAS);
    store.painted('night', () => CANVAS);
    expect(f.gets).toEqual(['sky-plate:k-midday', 'sky-plate:k-night']);
    await f.answer();
    expect(f.puts.map((p) => p.id)).toEqual(['sky-plate:k-night']);
  });

  it('a stored image of the wrong size is a miss (and is replaced)', async () => {
    const f = fakeCache({ 'sky-plate:k-midday': { width: 8, height: 2 } });
    const { store, loaded } = plates(f.cache);
    store.request('midday');
    await f.answer();
    expect(loaded.size).toBe(0);
    expect(store.stats().misses).toBe(1);
    store.painted('midday', () => CANVAS);
    expect(f.puts).toHaveLength(1);
  });

  it('without a cache it looks nothing up and stores nothing', () => {
    const { store } = plates(null);
    expect(store.enabled).toBe(false);
    store.request('midday');
    expect(store.pending('midday')).toBe(false);
    store.painted('midday', () => {
      throw new Error('never packed');
    });
    expect(store.stats()).toEqual({ hits: 0, misses: 0, puts: 0 });
  });
});

describe('plate keys (ADR 0236)', () => {
  const sky = { w: 1120, h: 518 };
  const water = { w: 408, h: 141 };
  const rect = { x: 450, y: 442, w: 816, h: 281 };

  it('a sky plate is keyed on the seed, the phase, its sizes and the water rect', () => {
    const k = skyPlateKey(7, 'midday', sky, rect, water);
    expect(k).toBe('s7|midday|1120x518|450,442,816,281@408x141');
    expect(skyPlateKey(8, 'midday', sky, rect, water)).not.toBe(k);
    expect(skyPlateKey(7, 'night', sky, rect, water)).not.toBe(k);
    expect(skyPlateKey(7, 'midday', { w: 1121, h: 518 }, rect, water)).not.toBe(k);
    expect(skyPlateKey(7, 'midday', sky, { ...rect, x: 450.5 }, water)).not.toBe(k);
    expect(SKY_PLATE_KIND).not.toContain(':');
  });

  it('a light plate is keyed on its seed, the phase, its size and what it is painted from', () => {
    const scene = { pond: POND, waterline: 470, rocks: [], pavilion: { x: 1300, y: 300, w: 200, h: 300, lantern: { x: 1290, y: 520 } } } as never;
    const print = castPrint(scene, { trees: TREES, shrubs: SHRUBS });
    expect(print).toMatch(/^[0-9a-z]+$/);
    expect(castPrint(scene, { trees: TREES, shrubs: SHRUBS })).toBe(print);
    expect(castPrint(scene, { trees: TREES, shrubs: [] })).not.toBe(print);
    expect(castPrint({ ...(scene as object), waterline: 471 } as never, { trees: TREES, shrubs: SHRUBS })).not.toBe(print);
    const k = lightPlateKey('ambience-cast', 'sunset', 640, 400, print);
    expect(k).toBe(`ambience-cast|sunset|640x400|g${print}`);
    expect(lightPlateKey('ambience-cast', 'night', 640, 400, print)).not.toBe(k);
    expect(lightPlateKey('other-cast', 'sunset', 640, 400, print)).not.toBe(k);
    expect(LIGHT_PLATE_KIND).not.toContain(':');
  });

  it('fingerprints plain data stably', () => {
    expect(fingerprint({ a: [1, 2] })).toBe(fingerprint({ a: [1, 2] }));
    expect(fingerprint({ a: [1, 2] })).not.toBe(fingerprint({ a: [2, 1] }));
  });
});
