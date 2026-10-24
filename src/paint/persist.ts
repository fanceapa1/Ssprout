/**
 * Persistent paint cache (ADR 0227, docs/systems/paint.md › Persistence).
 *
 * Finished paintings (the landscape, sky and light plates) are deterministic: the same paint code,
 * seed, view and scale give the same pixels. This module keeps them across reloads as lossless
 * PNG Blobs in IndexedDB, so a repeat visit decodes one (~40 ms) instead of painting it (~1 s).
 *
 * - Entries are keyed `version:kind:key`. `version` is `__PAINT_VERSION__`, a build-time hash of
 *   every source that can change pixels (`paint-version.ts`), plus the browser (its rasteriser);
 *   entries of any other version are dropped when the store opens. `kind` names the painting
 *   (`scene`, `sky`, …; no `:`), `key` everything else it depends on (seed, view rect, scale…).
 * - `put` copies the canvas at once, then encodes it in idle time, one entry at a time, so it
 *   never blocks a frame. `get` decodes with no colour-space conversion and no premultiplication.
 * - Least recently used entries are evicted to stay under a byte cap (48 MB by default).
 * - Best-effort: no method throws or rejects. Without IndexedDB, when it fails, on the dev server
 *   (`__PAINT_VERSION__ === 'dev'`) or with `?nopaintcache`, the cache is the null cache: `get`
 *   gives null and `put` stores nothing. `stats()` says why (`off`) and counts errors.
 *
 * Storage goes through a `PaintStoreAdapter`: IndexedDB in the browser, a Map in unit tests.
 */
import { makeCanvas, type AnyCanvas } from './canvas';

declare global {
  /** Build-time hash of the paint sources (vite.config.ts `define`); 'dev' on the dev server and in tests. */
  const __PAINT_VERSION__: string;
}

/** The build's paint version, or 'dev' when it was not injected (dev server, Vitest). */
export const PAINT_VERSION: string = typeof __PAINT_VERSION__ === 'string' ? __PAINT_VERSION__ : 'dev';

/** Default byte cap of the store (encoded PNG bytes). */
export const DEFAULT_MAX_BYTES = 48 * 1024 * 1024;

/** IndexedDB database the app's cache lives in (visible in devtools › Application › IndexedDB). */
export const PAINT_DB_NAME = 'studysprout-paint';

/** Metadata of one stored painting. The Blob is stored beside it under the same `id`. */
export interface EntryMeta {
  /** `version:kind:key` */
  id: string;
  version: string;
  kind: string;
  key: string;
  /** Encoded size (the Blob's `size`). */
  bytes: number;
  /** Recency: a counter, larger = used more recently (no wall clock involved). */
  used: number;
}

/** Where entries live. Every method may reject; the cache swallows it. */
export interface PaintStoreAdapter {
  /** Every entry's metadata, all versions. */
  list(): Promise<EntryMeta[]>;
  read(id: string): Promise<Blob | undefined>;
  /** Store (or replace) an entry and its Blob together. */
  write(meta: EntryMeta, blob: Blob): Promise<void>;
  /** Store updated metadata (recency) without rewriting the Blob. */
  touch(meta: EntryMeta): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

/** Why a cache stores nothing. */
export type PaintCacheOff = 'dev' | 'opted-out' | 'unavailable' | 'failed';

export interface PaintCacheStats {
  enabled: boolean;
  /** Why the cache is off (null while on). */
  off: PaintCacheOff | null;
  version: string;
  /** Entries and encoded bytes of this version. */
  entries: number;
  bytes: number;
  maxBytes: number;
  hits: number;
  misses: number;
  /** Entries written. */
  puts: number;
  /** Puts not written: superseded by a later put of the same entry, or larger than the cap. */
  skipped: number;
  /** Entries evicted for the byte cap. */
  evictions: number;
  /** Entries of other versions dropped on open. */
  dropped: number;
  /** Swallowed errors (storage, encode, decode), and the last one's message. */
  errors: number;
  lastError: string | null;
}

export interface PutOptions {
  /**
   * Copy the canvas before `put` returns (default true), so the caller may paint on it again at
   * once. Pass false only for a canvas nothing will draw on again: it saves one full-size copy.
   */
  copy?: boolean;
}

export interface PaintCache {
  /** The version this cache reads and writes. */
  readonly version: string;
  /** The stored painting, decoded, or null (miss, off, or any failure). */
  get(kind: string, key: string): Promise<ImageBitmap | null>;
  /**
   * Store a finished painting. Copies it now (see `PutOptions.copy`), encodes it to PNG in idle
   * time and writes it, evicting the least recently used entries over the cap. Resolves true
   * once written, false when not stored. Never rejects.
   */
  put(kind: string, key: string, canvas: AnyCanvas, opts?: PutOptions): Promise<boolean>;
  /** Remove every entry, of every version. */
  clear(): Promise<void>;
  stats(): Promise<PaintCacheStats>;
  /** Resolves once every queued put has been written or given up (tests). */
  settle(): Promise<void>;
}

export interface PaintCacheOptions {
  /** The store, or a promise of it (a rejected one turns the cache off as `failed`). */
  adapter: PaintStoreAdapter | Promise<PaintStoreAdapter>;
  /** Defaults to `PAINT_VERSION` plus the browser (`paintCacheVersion`). */
  version?: string;
  maxBytes?: number;
  /** Encode a canvas to a lossless Blob. Default: PNG (`encodePng`). */
  encode?: (canvas: AnyCanvas) => Promise<Blob>;
  /** Decode a stored Blob. Default: `decodeExact`. */
  decode?: (blob: Blob) => Promise<ImageBitmap>;
  /** Copy a canvas synchronously. Default: `copyCanvas`. */
  copy?: (canvas: AnyCanvas) => AnyCanvas;
  /** Run `fn` when the main thread is idle. Default: `requestIdleCallback` (1 s timeout), else a macrotask. */
  idle?: (fn: () => void) => void;
}

/** The id an entry is stored under. */
export function entryId(version: string, kind: string, key: string): string {
  return `${version}:${kind}:${key}`;
}

/**
 * The cache version: the paint version plus the browser, whose rasteriser also decides pixels
 * (a browser update repaints once). A short FNV-1a hash of the user agent keeps ids short.
 */
export function paintCacheVersion(paintVersion: string = PAINT_VERSION, userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < userAgent.length; i++) {
    h ^= userAgent.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${paintVersion}-${(h >>> 0).toString(36)}`;
}

/** Why the app's cache should be off for this page, or null when it may persist. */
export function paintCacheOff(search: string, paintVersion: string = PAINT_VERSION, hasIndexedDb: boolean = typeof indexedDB !== 'undefined'): PaintCacheOff | null {
  if (paintVersion === 'dev') return 'dev';
  if (new URLSearchParams(search).has('nopaintcache')) return 'opted-out';
  if (!hasIndexedDb) return 'unavailable';
  return null;
}

/** PNG, lossless. `OffscreenCanvas.convertToBlob` / `canvas.toBlob` encode asynchronously. */
export function encodePng(canvas: AnyCanvas): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/png' });
  return new Promise((done, fail) => canvas.toBlob((b) => (b ? done(b) : fail(new Error('toBlob gave null'))), 'image/png'));
}

/** Decode exactly what was stored: no colour-space conversion, no premultiplication on decode. */
export function decodeExact(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}

/** A same-size copy of a canvas (composite `copy`, no smoothing: pixel for pixel). */
export function copyCanvas(canvas: AnyCanvas): AnyCanvas {
  const out = makeCanvas(canvas.width, canvas.height);
  const ctx = out.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.globalCompositeOperation = 'copy';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0);
  return out;
}

function idleDefault(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout: 1000 });
  else setTimeout(fn, 0);
}

function message(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/** A cache over `opts.adapter`. See the module comment. */
export function createPaintCache(opts: PaintCacheOptions): PaintCache {
  const version = opts.version ?? paintCacheVersion();
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const encode = opts.encode ?? encodePng;
  const decode = opts.decode ?? decodeExact;
  const copy = opts.copy ?? copyCanvas;
  const idle = opts.idle ?? idleDefault;

  const index = new Map<string, EntryMeta>();
  const counts = { hits: 0, misses: 0, puts: 0, skipped: 0, evictions: 0, dropped: 0, errors: 0 };
  let lastError: string | null = null;
  let off: PaintCacheOff | null = null;
  let seq = 0;
  /** The latest put per id: an earlier queued put of the same entry is skipped. */
  const latest = new Map<string, object>();
  /** Puts and clears run one at a time, in order. */
  let queue: Promise<unknown> = Promise.resolve();

  const note = (e: unknown) => {
    counts.errors++;
    lastError = message(e);
  };
  const usedBytes = () => {
    let sum = 0;
    for (const m of index.values()) sum += m.bytes;
    return sum;
  };

  /** Evict least recently used entries (never `keep`) until `extra` more bytes fit. */
  const makeRoom = async (a: PaintStoreAdapter, extra: number, keep: string | null) => {
    let total = usedBytes() - (keep ? (index.get(keep)?.bytes ?? 0) : 0);
    if (total + extra <= maxBytes) return;
    const victims: string[] = [];
    for (const m of [...index.values()].sort((x, y) => x.used - y.used)) {
      if (total + extra <= maxBytes) break;
      if (m.id === keep) continue;
      victims.push(m.id);
      total -= m.bytes;
    }
    for (const id of victims) index.delete(id);
    counts.evictions += victims.length;
    await a.remove(victims);
  };

  const opened: Promise<PaintStoreAdapter | null> = (async () => {
    try {
      const a = await opts.adapter;
      const all = await a.list();
      const stale = all.filter((m) => m.version !== version);
      for (const m of all) {
        if (m.version !== version) continue;
        index.set(m.id, m);
        seq = Math.max(seq, m.used);
      }
      if (stale.length > 0) {
        counts.dropped += stale.length;
        await a.remove(stale.map((m) => m.id)).catch(note);
      }
      await makeRoom(a, 0, null).catch(note);
      return a;
    } catch (e) {
      note(e);
      off = 'failed';
      index.clear();
      return null;
    }
  })();

  const enqueue = <T>(task: () => Promise<T>, fallback: T): Promise<T> => {
    const run = queue.then(task).catch((e: unknown) => {
      note(e);
      return fallback;
    });
    queue = run;
    return run;
  };

  return {
    version,

    async get(kind, key) {
      const a = await opened;
      if (!a) return null;
      const id = entryId(version, kind, key);
      const meta = index.get(id);
      if (!meta) {
        counts.misses++;
        return null;
      }
      try {
        const blob = await a.read(id);
        if (!blob) throw new Error(`no stored blob for ${id}`);
        const bitmap = await decode(blob);
        meta.used = ++seq;
        a.touch(meta).catch(note);
        counts.hits++;
        return bitmap;
      } catch (e) {
        note(e);
        counts.misses++;
        index.delete(id);
        a.remove([id]).catch(note);
        return null;
      }
    },

    put(kind, key, canvas, putOpts) {
      if (off) return Promise.resolve(false);
      let source: AnyCanvas;
      try {
        source = putOpts?.copy === false ? canvas : copy(canvas);
      } catch (e) {
        note(e);
        return Promise.resolve(false);
      }
      const id = entryId(version, kind, key);
      const token = {};
      latest.set(id, token);
      return enqueue(async () => {
        const a = await opened;
        if (!a) return false;
        if (latest.get(id) !== token) {
          counts.skipped++;
          return false;
        }
        await new Promise<void>((done) => idle(done));
        if (latest.get(id) !== token) {
          counts.skipped++;
          return false;
        }
        latest.delete(id);
        const blob = await encode(source);
        if (blob.size > maxBytes) {
          counts.skipped++;
          return false;
        }
        await makeRoom(a, blob.size, id);
        const meta: EntryMeta = { id, version, kind, key, bytes: blob.size, used: ++seq };
        await a.write(meta, blob);
        index.set(id, meta);
        counts.puts++;
        return true;
      }, false).finally(() => {
        if (latest.get(id) === token) latest.delete(id);
      });
    },

    clear() {
      return enqueue(async () => {
        const a = await opened;
        index.clear();
        if (a) await a.clear();
      }, undefined);
    },

    async stats() {
      await opened;
      return {
        enabled: off === null,
        off,
        version,
        entries: index.size,
        bytes: usedBytes(),
        maxBytes,
        ...counts,
        lastError,
      };
    },

    async settle() {
      await opened;
      for (let q = queue; ; q = queue) {
        await q;
        if (q === queue) return;
      }
    },
  };
}

/** A cache that stores nothing (`off` says why). */
export function createNullPaintCache(off: PaintCacheOff, version: string = paintCacheVersion()): PaintCache {
  return {
    version,
    get: async () => null,
    put: async () => false,
    clear: async () => {},
    settle: async () => {},
    stats: async () => ({
      enabled: false,
      off,
      version,
      entries: 0,
      bytes: 0,
      maxBytes: 0,
      hits: 0,
      misses: 0,
      puts: 0,
      skipped: 0,
      evictions: 0,
      dropped: 0,
      errors: 0,
      lastError: null,
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// IndexedDB adapter

const META = 'meta';
const BLOBS = 'blobs';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((done, fail) => {
    req.onsuccess = () => done(req.result);
    req.onerror = () => fail(req.error ?? new Error('IndexedDB request failed'));
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((done, fail) => {
    tx.oncomplete = () => done();
    tx.onerror = () => fail(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => fail(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/**
 * Open the paint store in IndexedDB: object store `meta` (`EntryMeta` by `id`) and `blobs`
 * (the PNG Blob under the same id), written together in one transaction. Rejects when IndexedDB
 * is missing or refuses to open (some private modes).
 */
export async function openIndexedDbAdapter(name: string = PAINT_DB_NAME): Promise<PaintStoreAdapter> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB unavailable');
  const req = indexedDB.open(name, 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
  };
  const db = await request(req);
  // another tab upgrading the schema: step aside (this tab's later calls fail and are swallowed)
  db.onversionchange = () => db.close();

  const tx = (mode: IDBTransactionMode) => db.transaction([META, BLOBS], mode);
  return {
    async list() {
      const t = tx('readonly');
      return request(t.objectStore(META).getAll() as IDBRequest<EntryMeta[]>);
    },
    async read(id) {
      const t = tx('readonly');
      const blob = await request(t.objectStore(BLOBS).get(id) as IDBRequest<Blob | undefined>);
      return blob instanceof Blob ? blob : undefined;
    },
    async write(meta, blob) {
      const t = tx('readwrite');
      t.objectStore(META).put(meta);
      t.objectStore(BLOBS).put(blob, meta.id);
      await finished(t);
    },
    async touch(meta) {
      const t = db.transaction(META, 'readwrite');
      t.objectStore(META).put(meta);
      await finished(t);
    },
    async remove(ids) {
      if (ids.length === 0) return;
      const t = tx('readwrite');
      for (const id of ids) {
        t.objectStore(META).delete(id);
        t.objectStore(BLOBS).delete(id);
      }
      await finished(t);
    },
    async clear() {
      const t = tx('readwrite');
      t.objectStore(META).clear();
      t.objectStore(BLOBS).clear();
      await finished(t);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The app's cache

let shared: PaintCache | null = null;

/**
 * The app's paint cache, created on first use: IndexedDB `studysprout-paint` at the default
 * cap, or the null cache when `paintCacheOff(location.search)` says so.
 */
export function paintCache(): PaintCache {
  if (shared) return shared;
  const search = typeof location !== 'undefined' ? location.search : '';
  const off = paintCacheOff(search);
  shared = off ? createNullPaintCache(off) : createPaintCache({ adapter: openIndexedDbAdapter() });
  return shared;
}
