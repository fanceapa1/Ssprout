import type { Page } from '@playwright/test';

/**
 * Helpers for specs that read the persistent paint cache (ADRs 0227, 0228, 0236). The app stores
 * its landscape and its daylight plates there on its own, some of them in idle time after load.
 */

/** One stored painting of the app's current cache version (IndexedDB `meta`). */
export interface StoredEntry {
  kind: string;
  key: string;
  bytes: number;
}

/** Every entry of the current version, read straight from IndexedDB. */
export async function storedEntries(page: Page): Promise<StoredEntry[]> {
  return page.evaluate(async () => {
    const version = window.sprout!.paintCache.version;
    await window.sprout!.paintCache.settle();
    const db = await new Promise<IDBDatabase>((done, fail) => {
      const req = indexedDB.open('studysprout-paint');
      req.onsuccess = () => done(req.result);
      req.onerror = () => fail(req.error);
    });
    try {
      const all = await new Promise<Array<{ version: string; kind: string; key: string; bytes: number }>>((done, fail) => {
        const req = db.transaction('meta', 'readonly').objectStore('meta').getAll();
        req.onsuccess = () => done(req.result);
        req.onerror = () => fail(req.error);
      });
      return all.filter((m) => m.version === version).map(({ kind, key, bytes }) => ({ kind, key, bytes }));
    } finally {
      db.close();
    }
  });
}

/** The stored entries of these kinds. */
export async function storedOf(page: Page, ...kinds: string[]): Promise<StoredEntry[]> {
  return (await storedEntries(page)).filter((e) => kinds.includes(e.kind));
}

/**
 * Wait until the app's own cache traffic after load is over: the plates of the light in use and
 * of the coming phase (prepared in idle time) are there, and every queued put is written. A
 * test that counts entries or clears the store must not race them.
 */
export async function appPaintQuiet(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const s = window.sprout!;
    const light = s.lightPlates();
    return (s.skyStats()?.plates ?? 0) >= 2 && light.painted + light.cacheHits >= 2;
  });
  await page.evaluate(() => window.sprout!.paintCache.settle());
}
