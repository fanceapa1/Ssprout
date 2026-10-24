import type { Page } from '@playwright/test';
import { expect, openDev, test } from './fixtures';

/**
 * The persistent paint cache (ADR 0227) against Chromium's real IndexedDB, PNG encoder and
 * `createImageBitmap`: a painting stored before a reload comes back pixel for pixel.
 *
 * The test paintings are built in the page from a seeded stream, so the reloaded page can build
 * the same reference again: `opaque` is a watercolour-like frame (noise, then translucent
 * multiplied washes, every pixel opaque, like the landscape), `alpha` covers every alpha value
 * (like a sprite on a transparent canvas).
 */

type Kind = 'opaque' | 'alpha';

/** Install `window.__paintTest` in the page: build a test painting, and compare a bitmap with one. */
async function installHelpers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const rng = (seed: number) => () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const build = (kind: 'opaque' | 'alpha'): OffscreenCanvas => {
      const r = rng(kind === 'opaque' ? 7 : 11);
      const w = kind === 'opaque' ? 640 : 256;
      const h = kind === 'opaque' ? 400 : 256;
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext('2d')!;
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = (r() * 256) | 0;
        img.data[i + 1] = (r() * 256) | 0;
        img.data[i + 2] = (r() * 256) | 0;
        // every alpha value 0..255, in order, then random
        img.data[i + 3] = kind === 'opaque' ? 255 : i / 4 < 256 ? i / 4 : (r() * 256) | 0;
      }
      ctx.putImageData(img, 0, 0);
      if (kind === 'opaque') {
        ctx.globalCompositeOperation = 'multiply';
        for (let k = 0; k < 40; k++) {
          ctx.globalAlpha = 0.05 + r() * 0.4;
          ctx.fillStyle = `rgb(${(r() * 255) | 0} ${(r() * 255) | 0} ${(r() * 255) | 0})`;
          ctx.beginPath();
          ctx.ellipse(r() * w, r() * h, 10 + r() * 120, 10 + r() * 80, r() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return c;
    };
    /** Pixels a bitmap draws onto a fresh canvas, against the reference's, as the app would draw it. */
    const compare = (kind: 'opaque' | 'alpha', bitmap: ImageBitmap | null) => {
      if (!bitmap) return null;
      const ref = build(kind);
      const out = new OffscreenCanvas(ref.width, ref.height);
      const octx = out.getContext('2d')!;
      octx.globalCompositeOperation = 'copy';
      octx.drawImage(bitmap, 0, 0);
      const a = ref.getContext('2d')!.getImageData(0, 0, ref.width, ref.height).data;
      const b = octx.getImageData(0, 0, ref.width, ref.height).data;
      let differ = 0;
      let maxDelta = 0;
      for (let i = 0; i < a.length; i += 4) {
        let d = 0;
        for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a[i + k]! - b[i + k]!));
        if (d > 0) differ++;
        maxDelta = Math.max(maxDelta, d);
      }
      return { size: [bitmap.width, bitmap.height], differ, maxDelta, pixels: a.length / 4 };
    };
    (window as unknown as { __paintTest: unknown }).__paintTest = { build, compare };
  });
}

type Helpers = {
  build(kind: Kind): OffscreenCanvas;
  compare(kind: Kind, bitmap: ImageBitmap | null): { size: number[]; differ: number; maxDelta: number; pixels: number } | null;
};
declare global {
  interface Window {
    __paintTest: Helpers;
  }
}

test.describe('persistent paint cache', () => {
  test('a painting stored before a reload comes back pixel for pixel', async ({ page }) => {
    await openDev(page);
    await installHelpers(page);
    const stored = await page.evaluate(async () => {
      const cache = window.sprout!.paintCache;
      // the app stores its own paintings too (the landscape, ADR 0228): count only this test's
      await cache.clear();
      const before = await cache.stats();
      const t = window.__paintTest;
      const ok = await Promise.all([cache.put('test', 'opaque', t.build('opaque')), cache.put('test', 'alpha', t.build('alpha'))]);
      const after = await cache.stats();
      return { ok, stats: after, puts: after.puts - before.puts };
    });
    expect(stored.ok).toEqual([true, true]);
    expect(stored.stats).toMatchObject({ enabled: true, off: null, entries: 2, errors: 0 });
    expect(stored.puts).toBe(2);
    expect(stored.stats.version).toMatch(/^[0-9a-f]{12}-[0-9a-z]+$/);

    await page.reload();
    await page.waitForFunction(() => window.sprout !== undefined);
    await page.evaluate(() => window.sprout!.ready());
    await installHelpers(page);
    const back = await page.evaluate(async () => {
      const cache = window.sprout!.paintCache;
      const before = await cache.stats();
      const t = window.__paintTest;
      const opaque = t.compare('opaque', await cache.get('test', 'opaque'));
      const alpha = t.compare('alpha', await cache.get('test', 'alpha'));
      const missing = await cache.get('test', 'never-stored');
      const after = await cache.stats();
      return { opaque, alpha, missing, stats: after, hits: after.hits - before.hits, misses: after.misses - before.misses };
    });
    expect(back.opaque).toEqual({ size: [640, 400], differ: 0, maxDelta: 0, pixels: 640 * 400 });
    expect(back.alpha).toEqual({ size: [256, 256], differ: 0, maxDelta: 0, pixels: 256 * 256 });
    expect(back.missing).toBeNull();
    expect({ hits: back.hits, misses: back.misses }).toEqual({ hits: 2, misses: 1 });
    expect(back.stats).toMatchObject({ errors: 0 });
    expect(back.stats.bytes).toBeGreaterThan(0);
  });

  test('?nopaintcache turns persistence off', async ({ page }) => {
    await openDev(page, 'nopaintcache');
    const r = await page.evaluate(async () => {
      const cache = window.sprout!.paintCache;
      const c = new OffscreenCanvas(8, 8);
      return { put: await cache.put('test', 'a', c), get: await cache.get('test', 'a'), stats: await cache.stats() };
    });
    expect(r).toMatchObject({ put: false, get: null, stats: { enabled: false, off: 'opted-out', entries: 0 } });
  });

  test('IndexedDB drops other versions on open and evicts the least recently used over the cap', async ({ page }) => {
    await openDev(page);
    const r = await page.evaluate(async () => {
      const s = window.sprout!.paintCache;
      await s.clear();
      const canvas = (n: number) => {
        const c = new OffscreenCanvas(64, 64);
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = `rgb(${n * 40} 90 120)`;
        ctx.fillRect(0, 0, 64, 64);
        return c;
      };
      const old = s.open({ version: 'old' });
      await old.put('test', 'a', canvas(1));
      const before = await old.stats();

      const one = before.bytes; // every test canvas encodes to about the same size
      const cache = s.open({ version: 'new', maxBytes: Math.floor(one * 2.5) });
      const opened = await cache.stats();
      await cache.put('test', 'a', canvas(2));
      await cache.put('test', 'b', canvas(3));
      await cache.get('test', 'a');
      await cache.put('test', 'c', canvas(4));
      const reopened = s.open({ version: 'new', maxBytes: Math.floor(one * 2.5) });
      return {
        before: before.entries,
        opened,
        a: (await reopened.get('test', 'a')) !== null,
        b: (await reopened.get('test', 'b')) !== null,
        c: (await reopened.get('test', 'c')) !== null,
        after: await reopened.stats(),
      };
    });
    expect(r.before).toBe(1);
    expect(r.opened).toMatchObject({ entries: 0, dropped: 1 });
    expect({ a: r.a, b: r.b, c: r.c }).toEqual({ a: true, b: false, c: true });
    expect(r.after).toMatchObject({ entries: 2, errors: 0 });
  });
});
