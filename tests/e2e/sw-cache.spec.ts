import type { APIRequestContext, Page } from '@playwright/test';
import { canvasStats, expect, openDev, test } from './fixtures';

/**
 * The caching service worker (ADR 0230) against the production build. The app does not register
 * the worker at boot yet (P11), so each test registers `/Ssprout/sw.js` from the page and waits
 * until it controls the page. Every test gets a fresh browser context, so nothing carries over.
 */

/** The build's version and precache list, read from the served sw.js (ADR 0229). */
async function manifest(request: APIRequestContext): Promise<{ version: string; urls: string[] }> {
  const sw = await (await request.get('sw.js')).text();
  const version = sw.match(/self\.__SW_VERSION__ = "([0-9a-f]{12})";/)![1]!;
  const urls = JSON.parse(sw.match(/self\.__PRECACHE__ = (\[.*\]);/)![1]!) as string[];
  return { version, urls };
}

/** Register the worker as P11 will, and wait until it has installed, activated and claimed the page. */
async function registerAndControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/Ssprout/sw.js', { scope: '/Ssprout/' });
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((done) => navigator.serviceWorker.addEventListener('controllerchange', done, { once: true }));
  });
}

/** A font file the CSS references but the precache leaves out (another subset, or a `.woff`). */
async function uncachedFont(page: Page, urls: string[]): Promise<string> {
  const sheets = urls.filter((u) => u.endsWith('.css'));
  const text = await page.evaluate((list) => Promise.all(list.map((u) => fetch(u).then((r) => r.text()))), sheets);
  const fonts = text.join('\n').match(/\/Ssprout\/assets\/[\w-]+\.woff2?/g) ?? [];
  return fonts.find((u) => !urls.includes(u))!;
}

const cachedUrls = (page: Page, name: string) =>
  page.evaluate(async (n) => {
    const cache = await caches.open(n);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  }, name);

test.describe('caching service worker', () => {
  test('precaches the build, serves a reload from the worker and caches an asset miss', async ({ page, request }) => {
    const { version, urls } = await manifest(request);
    await openDev(page);
    await registerAndControl(page);
    expect((await cachedUrls(page, `sprout-${version}`)).sort()).toEqual([...urls].sort());

    const served = new Map<string, boolean>();
    page.on('response', (r) => served.set(new URL(r.url()).pathname, r.fromServiceWorker()));
    await page.reload();
    await page.waitForFunction(() => window.sprout !== undefined);
    await page.evaluate(() => window.sprout!.ready());
    const entry = urls.find((u) => /\/assets\/main-[\w-]+\.js$/.test(u))!;
    expect(served.get(entry), 'the entry script comes from the worker').toBe(true);
    expect(served.get('/Ssprout/'), 'the page goes through the worker (network first)').toBe(true);

    // an asset outside the precache is fetched once, then kept in this version's cache
    const font = await uncachedFont(page, urls);
    expect(await page.evaluate((u) => fetch(u).then((r) => r.status), font)).toBe(200);
    await expect.poll(() => cachedUrls(page, `sprout-${version}`)).toContain(font);
  });

  test('offline, a reload still renders the garden from the cache', async ({ page, request, context, errors }) => {
    const { urls } = await manifest(request);
    await openDev(page);
    await registerAndControl(page);
    const font = await uncachedFont(page, urls);

    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.sprout !== undefined);
    await page.evaluate(() => window.sprout!.ready());
    await page.evaluate(() => window.sprout!.freeze());
    const stats = await canvasStats(page);
    expect(stats.a).toBeGreaterThan(250);
    expect(stats.distinctColours).toBeGreaterThan(2);
    expect(errors, 'nothing failed to load offline').toEqual([]);
    // the network really is gone: an asset the worker never cached does not load (and the
    // browser logs that one expected failure)
    expect(await page.evaluate((u) => fetch(u).then(() => 'loaded', () => 'failed'), font)).toBe('failed');
    await expect.poll(() => errors).toEqual(['console: Failed to load resource: net::ERR_FAILED']);
    errors.length = 0;
    await context.setOffline(false);
  });

  test('activation deletes other versions but keeps the previous one', async ({ page, request }) => {
    const { version } = await manifest(request);
    await openDev(page);
    await page.evaluate(async () => {
      for (const name of ['sprout-000000000000', 'sprout-111111111111', 'other-app']) {
        await (await caches.open(name)).put('/Ssprout/assets/x.js', new Response('x'));
      }
      const meta = await caches.open('sprout-meta');
      await meta.put('/Ssprout/sprout-active-version', new Response(JSON.stringify({ version: '111111111111' })));
    });
    await registerAndControl(page);
    expect((await page.evaluate(() => caches.keys())).sort()).toEqual(
      ['other-app', 'sprout-111111111111', `sprout-${version}`, 'sprout-meta'].sort(),
    );
  });

  test('a notification click focuses the garden tab', async ({ page, context }) => {
    await openDev(page);
    const [worker] = await Promise.all([context.waitForEvent('serviceworker'), registerAndControl(page)]);
    // Headless Chromium shows no real notification to click: dispatch the event in the worker,
    // with `focus` recorded instead of performed (it needs a real click's user activation).
    const focused = await worker.evaluate(async () => {
      // the worker's own globals (the DOM lib types `self` as a Window)
      type Client = { url: string; focus(): Promise<unknown> };
      const scope = self as unknown as {
        registration: { scope: string };
        WindowClient: { prototype: Client };
        dispatchEvent(event: Event): boolean;
      };
      const seen: string[] = [];
      scope.WindowClient.prototype.focus = function (this: Client) {
        seen.push(new URL(this.url).pathname);
        return Promise.resolve(this);
      };
      const waits: Promise<unknown>[] = [];
      const event = new Event('notificationclick');
      Object.defineProperties(event, {
        notification: { value: { close: () => {}, data: { url: scope.registration.scope } } },
        waitUntil: { value: (p: Promise<unknown>) => waits.push(p) },
      });
      scope.dispatchEvent(event);
      await Promise.all(waits);
      return seen;
    });
    expect(focused).toEqual(['/Ssprout/']);
  });
});
