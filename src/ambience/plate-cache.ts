/**
 * The daylight plates from the persistent paint cache (ADR 0236): the sky's (sky-light.ts) and the
 * light's (cast.ts), one plate per phase. A plate depends only on code, seed, geometry and phase,
 * so a repeat visit decodes it instead of painting it again.
 *
 * - `request(phase)` looks a plate up once. `load` installs a stored plate when it comes back,
 *   and `answered` follows every answer, hit or miss.
 * - `painted(phase, pack)` says a plate was painted here. It is stored (in idle time, ADR 0227)
 *   only once its lookup has missed, so a plate the cache holds is never encoded again.
 * - With the cache off (`?nopaintcache`, the dev server, Vitest) nothing is looked up or stored,
 *   and the plates paint exactly as before.
 */
import { makeCanvas, type AnyCanvas } from '../paint/canvas';
import { paintCache, paintCacheOff, type PaintCache } from '../paint/persist';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Answer = 'pending' | 'hit' | 'miss';

export interface PlateCache<P extends string> {
  /** false: no cache (every plate is painted, nothing is stored) */
  readonly enabled: boolean;
  /** look a plate up (once; no-op when off or already asked) */
  request(p: P): void;
  /** whether the lookup of `p` is still waiting for its answer */
  pending(p: P): boolean;
  /**
   * A plate was painted here: store `pack()` unless the cache holds it (once its lookup answers;
   * a plate never looked up is looked up first). `pack` runs only when the plate is stored.
   */
  painted(p: P, pack: () => AnyCanvas | null): void;
  stats(): { hits: number; misses: number; puts: number };
}

export interface PlateCacheOptions<P extends string> {
  cache: PaintCache | null;
  /** the cache kind (`sky-plate`, `light-plate`) */
  kind: string;
  key: (p: P) => string;
  /** a stored plate came back: install it unless one is there; false when it does not fit (size) */
  load: (p: P, image: ImageBitmap) => boolean;
  /** after every answer (and after `load`): whether the cache held the plate */
  answered?: (p: P, hit: boolean) => void;
}

/** The app's paint cache, or null when it is off for this page (then the plates paint as before). */
export function defaultPlateCache(): PaintCache | null {
  return paintCacheOff(typeof location !== 'undefined' ? location.search : '') ? null : paintCache();
}

export function createPlateCache<P extends string>(opts: PlateCacheOptions<P>): PlateCache<P> {
  const { cache, kind, key } = opts;
  const answers = new Map<P, Answer>();
  const waiting = new Map<P, () => AnyCanvas | null>();
  const counts = { hits: 0, misses: 0, puts: 0 };

  const store = (p: P, pack: () => AnyCanvas | null) => {
    let canvas: AnyCanvas | null = null;
    try {
      canvas = pack();
    } catch {
      canvas = null;
    }
    // nothing draws on a finished plate (or its packed copy) again: no copy needed
    if (canvas && cache) void cache.put(kind, key(p), canvas, { copy: false }).then((ok) => ok && counts.puts++);
  };

  const request = (p: P) => {
    if (!cache || answers.has(p)) return;
    answers.set(p, 'pending');
    void cache.get(kind, key(p)).then((image) => {
      let hit = false;
      if (image) {
        try {
          hit = opts.load(p, image);
        } catch {
          hit = false;
        }
        image.close?.();
      }
      answers.set(p, hit ? 'hit' : 'miss');
      if (hit) counts.hits++;
      else counts.misses++;
      const pack = waiting.get(p);
      waiting.delete(p);
      if (pack && !hit) store(p, pack);
      opts.answered?.(p, hit);
    });
  };

  return {
    enabled: cache !== null,
    request,
    pending: (p) => answers.get(p) === 'pending',
    painted(p, pack) {
      if (!cache) return;
      const a = answers.get(p);
      if (a === 'hit') return;
      if (a === 'miss') return store(p, pack);
      waiting.set(p, pack);
      request(p);
    },
    stats: () => ({ ...counts }),
  };
}

/**
 * A part of a decoded image as a canvas, pixel for pixel (`copy`, no smoothing). Plates are drawn
 * scaled (the detail views): only a canvas copy draws exactly like the fresh plate (ADR 0228).
 */
export function cutImage(image: CanvasImageSource, x: number, y: number, w: number, h: number): AnyCanvas {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.globalCompositeOperation = 'copy';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
  return canvas;
}

/**
 * A short, stable hash of plain data (FNV-1a over its JSON): the geometry a plate was painted
 * from, so a different scene (the studio's) never reads another scene's plate.
 */
export function fingerprint(value: unknown): string {
  const s = JSON.stringify(value) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
