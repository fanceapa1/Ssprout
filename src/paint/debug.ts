import { extendDebug } from '../dev/debug';
import { createPaintCache, openIndexedDbAdapter, paintCache, type PaintCache } from './persist';

/** `sprout.paintCache`: the app's persistent paint cache (ADR 0227), for e2e tests. */
export interface PaintCacheDebug extends PaintCache {
  /**
   * Another cache on the app's IndexedDB store, with its own version and cap (tests of version
   * drops and eviction against real IndexedDB). Ignores `?nopaintcache`.
   */
  open(opts?: { version?: string; maxBytes?: number }): PaintCache;
}

declare module '../dev/debug' {
  interface SproutDebug {
    paintCache: PaintCacheDebug;
  }
}

/** Add `sprout.paintCache`. The app's cache opens on first use, not here. */
export function installPaintCacheDebug(): void {
  const api: PaintCacheDebug = {
    get version() {
      return paintCache().version;
    },
    get: (kind, key) => paintCache().get(kind, key),
    put: (kind, key, canvas, opts) => paintCache().put(kind, key, canvas, opts),
    clear: () => paintCache().clear(),
    stats: () => paintCache().stats(),
    settle: () => paintCache().settle(),
    open: (opts = {}) => createPaintCache({ adapter: openIndexedDbAdapter(), ...opts }),
  };
  extendDebug({ paintCache: api });
}
