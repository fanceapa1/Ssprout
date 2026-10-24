import type { APIRequestContext, Page } from '@playwright/test';
import { canvasStats, expect, openDev, test } from './fixtures';

/**
 * The caching service worker (ADR 0230) against the production build. The app registers
 * `/Ssprout/sw.js` by itself once the garden has painted and the page is idle; each test waits for
 * that (`sprout.sw.ready()`) and for the worker to control the page. Service workers are blocked
 * in the other specs (playwright.config.ts); this one opts in. Every test gets a fresh browser
 * context, so nothing carries over.
 */

test.use({ serviceWorkers: 'allow' });

/** The build's version and precache list, read from the served sw.js (ADR 0229). */
async function manifest(request: APIRequestContext): Promise<{ version: string; urls: string[] }> {
  const sw = await (await request.get('sw.js')).text();
  const version = sw.match(/self\.__SW_VERSION__ = "([0-9a-f]{12})";/)![1]!;
  const urls = JSON.parse(sw.match(/self\.__PRECACHE__ = (\[.*\]);/)![1]!) as string[];
  return { version, urls };
}

/** Wait until the app has registered the worker by itself, and it has installed, activated and claimed the page. */
async function appControl(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.sprout!.sw.ready())).toEqual({ scope: expect.stringMatching(/\/Ssprout\/$/) });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((done) => navigator.serviceWorker.addEventListener('controllerchange', done, { once: true }));
  });
}

/**
 * A build file under `assets/` that the precache leaves out: the studio's own CSS or chunk, named
 * in the served studio.html (the precache never lists studio files, ADR 0229).
 */
async function uncachedAsset(page: Page, urls: string[]): Promise<string> {
  const html = await page.evaluate(() => fetch('/Ssprout/studio.html').then((r) => r.text()));
  const assets = html.match(/\/Ssprout\/assets\/[\w-]+\.(?:css|js)/g) ?? [];
  const left = assets.filter((u) => !urls.includes(u));
  expect(left, 'a studio file outside the precache').not.toEqual([]);
  return left.find((u) => u.endsWith('.css')) ?? left[0]!;
}

const cachedUrls = (page: Page, name: string) =>
  page.evaluate(async (n) => {
    const cache = await caches.open(n);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  }, name);

test.describe('caching service worker', () => {
  test('the app registers the worker by itself; it precaches the build, serves a reload and caches an asset miss', async ({ page, request }) => {
    const { version, urls } = await manifest(request);
    await openDev(page);
    await appControl(page);
    // one registration, the app's own (the notifications path shares it)
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => new URL(r.scope).pathname))).toEqual(['/Ssprout/']);
    expect((await cachedUrls(page, `sprout-${version}`)).sort()).toEqual([...urls].sort());

    const served = new Map<string, boolean>();
    page.on('response', (r) => served.set(new URL(r.url()).pathname, r.fromServiceWorker()));
    await page.reload();
    await page.waitForFunction(() => window.sprout !== undefined);
    await page.evaluate(() => window.sprout!.ready());
    expect(await page.evaluate(() => window.sprout!.sw.controlled()), 'the reloaded page is controlled').toBe(true);
    const entry = urls.find((u) => /\/assets\/main-[\w-]+\.js$/.test(u))!;
    expect(served.get(entry), 'the entry script comes from the worker').toBe(true);
    expect(served.get('/Ssprout/'), 'the page goes through the worker (network first)').toBe(true);

    // an asset outside the precache (a studio file) is fetched once, then kept in this version's cache
    const miss = await uncachedAsset(page, urls);
    expect(await page.evaluate((u) => fetch(u).then((r) => r.status), miss)).toBe(200);
    await expect.poll(() => cachedUrls(page, `sprout-${version}`)).toContain(miss);
  });

  test('offline, a reload still renders the garden from the cache', async ({ page, request, context, errors }) => {
    const { urls } = await manifest(request);
    await openDev(page);
    await appControl(page);
    const miss = await uncachedAsset(page, urls);

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
    expect(await page.evaluate((u) => fetch(u).then(() => 'loaded', () => 'failed'), miss)).toBe('failed');
    await expect.poll(() => errors).toEqual(['console: Failed to load resource: net::ERR_FAILED']);
    errors.length = 0;
    await context.setOffline(false);
  });

  test('activation deletes other versions but keeps the previous one', async ({ page, request }) => {
    const { version } = await manifest(request);
    // seed the caches from a page in scope that does not register the worker (the app would)
    await page.goto('sw.js');
    await page.evaluate(async () => {
      for (const name of ['sprout-000000000000', 'sprout-111111111111', 'other-app']) {
        await (await caches.open(name)).put('/Ssprout/assets/x.js', new Response('x'));
      }
      const meta = await caches.open('sprout-meta');
      await meta.put('/Ssprout/sprout-active-version', new Response(JSON.stringify({ version: '111111111111' })));
    });
    await openDev(page);
    await appControl(page);
    expect((await page.evaluate(() => caches.keys())).sort()).toEqual(
      ['other-app', 'sprout-111111111111', `sprout-${version}`, 'sprout-meta'].sort(),
    );
  });

  test('a notification click focuses the garden tab', async ({ page, context }) => {
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      openDev(page).then(() => appControl(page)),
    ]);
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
