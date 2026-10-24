import { describe, expect, it } from 'vitest';
import type { AnyCanvas } from './canvas';
import {
  DEFAULT_MAX_BYTES,
  PAINT_VERSION,
  createNullPaintCache,
  createPaintCache,
  entryId,
  paintCache,
  paintCacheOff,
  paintCacheVersion,
  type EntryMeta,
  type PaintCacheOptions,
  type PaintStoreAdapter,
} from './persist';

/** A Map-backed store (jsdom and node have no IndexedDB), with failures to inject. */
function memoryStore() {
  const meta = new Map<string, EntryMeta>();
  const blobs = new Map<string, Blob>();
  const fail: Partial<Record<keyof PaintStoreAdapter, Error>> = {};
  const check = (op: keyof PaintStoreAdapter) => {
    if (fail[op]) throw fail[op];
  };
  const adapter: PaintStoreAdapter = {
    async list() {
      check('list');
      return [...meta.values()].map((m) => ({ ...m }));
    },
    async read(id) {
      check('read');
      return blobs.get(id);
    },
    async write(m, blob) {
      check('write');
      meta.set(m.id, { ...m });
      blobs.set(m.id, blob);
    },
    async touch(m) {
      check('touch');
      meta.set(m.id, { ...m });
    },
    async remove(ids) {
      check('remove');
      for (const id of ids) {
        meta.delete(id);
        blobs.delete(id);
      }
    },
    async clear() {
      check('clear');
      meta.clear();
      blobs.clear();
    },
  };
  return { adapter, meta, blobs, fail };
}

/** A stand-in canvas: `bytes` is the size its fake PNG encodes to, `paint` tells copies apart. */
type FakeCanvas = { width: number; height: number; bytes: number; paint: string };
const canvas = (bytes: number, paint = 'wash'): AnyCanvas => ({ width: 10, height: 10, bytes, paint }) as unknown as AnyCanvas;

/** Fakes for encode (Blob of `bytes` bytes holding `paint`), decode (the Blob's text) and idle. */
function harness(store = memoryStore(), extra: Partial<PaintCacheOptions> = {}) {
  const encoded: string[] = [];
  const idleQueue: (() => void)[] = [];
  const cache = createPaintCache({
    adapter: store.adapter,
    version: 'v1',
    maxBytes: 300,
    encode: async (c) => {
      const f = c as unknown as FakeCanvas;
      encoded.push(f.paint);
      const body = new Uint8Array(f.bytes);
      body.set(new TextEncoder().encode(f.paint).slice(0, f.bytes));
      return new Blob([body]);
    },
    decode: async (blob) => ({ text: (await blob.text()).replace(/\0+$/, '') }) as unknown as ImageBitmap,
    copy: (c) => ({ ...(c as unknown as FakeCanvas), paint: `${(c as unknown as FakeCanvas).paint}+copy` }) as unknown as AnyCanvas,
    idle: (fn) => fn(),
    ...extra,
  });
  return { cache, store, encoded, idleQueue };
}

const text = (b: ImageBitmap | null) => (b as unknown as { text: string } | null)?.text ?? null;

describe('paint cache keys and versions', () => {
  it('stores an entry under version:kind:key', async () => {
    expect(entryId('abc123', 'scene', 'seed1/0,0,1600,1000@1.5')).toBe('abc123:scene:seed1/0,0,1600,1000@1.5');
    const { cache, store } = harness();
    expect(await cache.put('scene', 'k1', canvas(10))).toBe(true);
    expect([...store.meta.keys()]).toEqual(['v1:scene:k1']);
    expect(store.meta.get('v1:scene:k1')).toMatchObject({ version: 'v1', kind: 'scene', key: 'k1', bytes: 10 });
    expect(store.blobs.get('v1:scene:k1')!.size).toBe(10);
  });

  it('the cache version is the paint version plus the browser', () => {
    expect(paintCacheVersion('abc', 'Chrome/140')).toMatch(/^abc-[0-9a-z]+$/);
    expect(paintCacheVersion('abc', 'Chrome/140')).toBe(paintCacheVersion('abc', 'Chrome/140'));
    expect(paintCacheVersion('abc', 'Chrome/141')).not.toBe(paintCacheVersion('abc', 'Chrome/140'));
    expect(paintCacheVersion('abd', 'Chrome/140')).not.toBe(paintCacheVersion('abc', 'Chrome/140'));
  });

  it('a stored painting comes back from a new cache on the same store (a reload)', async () => {
    const store = memoryStore();
    await harness(store).cache.put('scene', 'k1', canvas(10, 'hills'));
    const { cache } = harness(store);
    expect(text(await cache.get('scene', 'k1'))).toBe('hills+copy');
    expect(await cache.get('scene', 'other')).toBeNull();
    expect(await cache.get('sky', 'k1')).toBeNull();
    expect(await cache.stats()).toMatchObject({ enabled: true, off: null, version: 'v1', entries: 1, bytes: 10, hits: 1, misses: 2 });
  });

  it('entries of another version are dropped when the store opens', async () => {
    const store = memoryStore();
    await harness(store).cache.put('scene', 'k1', canvas(10));
    await harness(store).cache.put('sky', 'dawn', canvas(20));
    const { cache } = harness(store, { version: 'v2' });
    expect(await cache.get('scene', 'k1')).toBeNull();
    expect(await cache.stats()).toMatchObject({ version: 'v2', entries: 0, bytes: 0, dropped: 2 });
    expect(store.meta.size).toBe(0);
    expect(store.blobs.size).toBe(0);
  });

  it('turns itself off on the dev server, with ?nopaintcache and without IndexedDB', () => {
    expect(paintCacheOff('?dev', 'dev', true)).toBe('dev');
    expect(paintCacheOff('?dev&nopaintcache', 'abc', true)).toBe('opted-out');
    expect(paintCacheOff('?nopaintcache=1', 'abc', true)).toBe('opted-out');
    expect(paintCacheOff('', 'abc', false)).toBe('unavailable');
    expect(paintCacheOff('?dev', 'abc', true)).toBeNull();
    // Vitest runs like the dev server: no build-time version, so the app's cache is off
    expect(PAINT_VERSION).toBe('dev');
  });
});

describe('paint cache LRU and byte cap', () => {
  it('evicts the least recently used entries to stay under the cap', async () => {
    const { cache, store } = harness(); // cap 300
    await cache.put('scene', 'a', canvas(100));
    await cache.put('scene', 'b', canvas(100));
    await cache.put('scene', 'c', canvas(100));
    expect(await cache.get('scene', 'a')).not.toBeNull(); // a is now the most recent
    await cache.put('scene', 'd', canvas(100));
    expect([...store.meta.keys()].sort()).toEqual(['v1:scene:a', 'v1:scene:c', 'v1:scene:d']);
    expect(await cache.stats()).toMatchObject({ entries: 3, bytes: 300, evictions: 1 });
    await cache.put('scene', 'e', canvas(250));
    expect([...store.meta.keys()].sort()).toEqual(['v1:scene:e']);
    expect(await cache.stats()).toMatchObject({ entries: 1, bytes: 250, evictions: 4 });
  });

  it('recency survives a reload', async () => {
    const store = memoryStore();
    const first = harness(store).cache;
    await first.put('scene', 'a', canvas(100));
    await first.put('scene', 'b', canvas(100));
    await first.put('scene', 'c', canvas(100));
    await first.get('scene', 'a');
    await first.get('scene', 'b');
    const { cache } = harness(store);
    await cache.put('scene', 'd', canvas(100));
    expect([...store.meta.keys()].sort()).toEqual(['v1:scene:a', 'v1:scene:b', 'v1:scene:d']);
  });

  it('a smaller cap evicts on open', async () => {
    const store = memoryStore();
    const first = harness(store).cache;
    for (const k of ['a', 'b', 'c']) await first.put('scene', k, canvas(100));
    const { cache } = harness(store, { maxBytes: 150 });
    expect(await cache.stats()).toMatchObject({ entries: 1, bytes: 100, evictions: 2 });
    expect([...store.meta.keys()]).toEqual(['v1:scene:c']);
  });

  it('skips a painting larger than the cap and keeps the others', async () => {
    const { cache, store } = harness();
    await cache.put('scene', 'a', canvas(100));
    expect(await cache.put('scene', 'huge', canvas(301))).toBe(false);
    expect([...store.meta.keys()]).toEqual(['v1:scene:a']);
    expect(await cache.stats()).toMatchObject({ skipped: 1, evictions: 0 });
  });

  it('replacing an entry counts its bytes once', async () => {
    const { cache } = harness();
    await cache.put('scene', 'a', canvas(200, 'old'));
    await cache.put('scene', 'a', canvas(250, 'new'));
    expect(await cache.stats()).toMatchObject({ entries: 1, bytes: 250, evictions: 0 });
    expect(text(await cache.get('scene', 'a'))).toBe('new+copy');
  });

  it('the default cap is 48 MB', async () => {
    const { cache } = harness(memoryStore(), { maxBytes: undefined });
    expect((await cache.stats()).maxBytes).toBe(DEFAULT_MAX_BYTES);
    expect(DEFAULT_MAX_BYTES).toBe(48 * 1024 * 1024);
  });
});

describe('paint cache puts stay off the hot path', () => {
  it('copies the canvas at once and encodes it only in idle time', async () => {
    const idle: (() => void)[] = [];
    const { cache, encoded } = harness(memoryStore(), { idle: (fn) => idle.push(fn) });
    const c = canvas(10, 'banks') as unknown as FakeCanvas;
    const stored = cache.put('scene', 'a', c as unknown as AnyCanvas);
    c.paint = 'repainted'; // the caller draws on its canvas again at once
    await new Promise((r) => setTimeout(r, 0));
    expect(encoded).toEqual([]);
    expect(idle).toHaveLength(1);
    idle.shift()!();
    expect(await stored).toBe(true);
    expect(encoded).toEqual(['banks+copy']);
  });

  it('copy: false hands the canvas itself to the encoder', async () => {
    const { cache, encoded } = harness();
    await cache.put('scene', 'a', canvas(10, 'pond'), { copy: false });
    expect(encoded).toEqual(['pond']);
  });

  it('encodes one put at a time, and only the latest of queued puts of one entry', async () => {
    const idle: (() => void)[] = [];
    const { cache, encoded } = harness(memoryStore(), { idle: (fn) => idle.push(fn) });
    const p1 = cache.put('scene', 'a', canvas(10, 'one'));
    const p2 = cache.put('scene', 'b', canvas(10, 'two'));
    const p3 = cache.put('scene', 'a', canvas(10, 'three'));
    const drain = async () => {
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 0));
        idle.splice(0).forEach((fn) => fn());
      }
    };
    await drain();
    expect(await Promise.all([p1, p2, p3])).toEqual([false, true, true]);
    expect(encoded).toEqual(['two+copy', 'three+copy']);
    expect(await cache.stats()).toMatchObject({ puts: 2, skipped: 1 });
  });

  it('settle waits for every queued put', async () => {
    const { cache } = harness();
    void cache.put('scene', 'a', canvas(10));
    void cache.put('scene', 'b', canvas(10));
    await cache.settle();
    expect((await cache.stats()).entries).toBe(2);
  });
});

describe('paint cache failures are swallowed', () => {
  it('a store that fails to open turns the cache off', async () => {
    const { cache } = harness(memoryStore(), { adapter: Promise.reject(new Error('private mode')) });
    expect(await cache.get('scene', 'a')).toBeNull();
    expect(await cache.put('scene', 'a', canvas(10))).toBe(false);
    await cache.clear();
    expect(await cache.stats()).toMatchObject({ enabled: false, off: 'failed', errors: 1, lastError: 'Error: private mode' });
    expect(await cache.put('scene', 'b', canvas(10))).toBe(false);
  });

  it('a store whose listing fails turns the cache off', async () => {
    const store = memoryStore();
    store.fail.list = new Error('broken');
    const { cache } = harness(store);
    expect(await cache.get('scene', 'a')).toBeNull();
    expect((await cache.stats()).off).toBe('failed');
  });

  it('a failed write (quota) stores nothing and keeps the rest working', async () => {
    const { cache, store } = harness();
    await cache.put('scene', 'a', canvas(10, 'kept'));
    store.fail.write = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    expect(await cache.put('scene', 'b', canvas(10))).toBe(false);
    delete store.fail.write;
    expect(text(await cache.get('scene', 'a'))).toBe('kept+copy');
    expect(await cache.get('scene', 'b')).toBeNull();
    expect(await cache.stats()).toMatchObject({ enabled: true, entries: 1, errors: 1, lastError: 'QuotaExceededError: quota' });
    expect(await cache.put('scene', 'c', canvas(10))).toBe(true);
  });

  it('a failed encode or copy stores nothing', async () => {
    const { cache } = harness(memoryStore(), {
      encode: async () => {
        throw new Error('encode');
      },
    });
    expect(await cache.put('scene', 'a', canvas(10))).toBe(false);
    const copyFails = harness(memoryStore(), {
      copy: () => {
        throw new Error('no 2d');
      },
    }).cache;
    expect(await copyFails.put('scene', 'a', canvas(10))).toBe(false);
    expect((await copyFails.stats()).errors).toBe(1);
  });

  it('an entry that cannot be read or decoded is a miss and is removed', async () => {
    const store = memoryStore();
    const { cache } = harness(store, {
      decode: async () => {
        throw new Error('corrupt PNG');
      },
    });
    await cache.put('scene', 'a', canvas(10));
    expect(await cache.get('scene', 'a')).toBeNull();
    await cache.settle();
    expect(store.meta.size).toBe(0);
    expect(await cache.stats()).toMatchObject({ entries: 0, misses: 1, errors: 1 });

    const other = harness(memoryStore());
    await other.cache.put('scene', 'b', canvas(10));
    other.store.fail.read = new Error('read');
    expect(await other.cache.get('scene', 'b')).toBeNull();
    expect((await other.cache.stats()).entries).toBe(0);
  });

  it('a failed recency update or removal does not fail the get or the put', async () => {
    const { cache, store } = harness();
    await cache.put('scene', 'a', canvas(200));
    store.fail.touch = new Error('touch');
    expect(await cache.get('scene', 'a')).not.toBeNull();
    store.fail.remove = new Error('remove');
    expect(await cache.put('scene', 'b', canvas(200))).toBe(false); // eviction failed: not written
    expect((await cache.stats()).errors).toBeGreaterThanOrEqual(2);
  });

  it('clear removes every entry of every version', async () => {
    const store = memoryStore();
    await harness(store).cache.put('scene', 'a', canvas(10));
    store.meta.set('v0:scene:a', { id: 'v0:scene:a', version: 'v0', kind: 'scene', key: 'a', bytes: 5, used: 1 });
    const { cache } = harness(store);
    await cache.put('sky', 'b', canvas(10));
    await cache.clear();
    expect(store.meta.size).toBe(0);
    expect(store.blobs.size).toBe(0);
    expect((await cache.stats()).entries).toBe(0);
  });

  it('the null cache stores nothing and says why', async () => {
    const cache = createNullPaintCache('opted-out', 'v1');
    expect(await cache.put('scene', 'a', canvas(10))).toBe(false);
    expect(await cache.get('scene', 'a')).toBeNull();
    await cache.clear();
    await cache.settle();
    expect(await cache.stats()).toMatchObject({ enabled: false, off: 'opted-out', version: 'v1', entries: 0 });
  });

  it("the app's cache is the null cache under Vitest (no build-time version)", async () => {
    expect(paintCache()).toBe(paintCache());
    expect(await paintCache().stats()).toMatchObject({ enabled: false, off: 'dev' });
  });
});
