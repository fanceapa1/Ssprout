import { expect, test } from '@playwright/test';

/**
 * The production build writes the precache manifest into sw.js (ADR 0229). This reads the served
 * sw.js and checks the list against what index.html and the bundle actually load. No browser page:
 * only HTTP requests to the preview server.
 */
test.describe('service worker precache manifest', () => {
  test('sw.js lists the entry, its chunks, CSS, the sprite worker and latin fonts, all served', async ({ request }) => {
    const sw = await (await request.get('sw.js')).text();
    const version = sw.match(/self\.__SW_VERSION__ = "([0-9a-f]{12})";/)?.[1];
    const list = sw.match(/self\.__PRECACHE__ = (\[.*\]);/)?.[1];
    expect(version, 'a build version, not the dev placeholder').toBeTruthy();
    const urls = JSON.parse(list!) as string[];

    const html = await (await request.get('./')).text();
    const entry = html.match(/<script type="module"[^>]*src="([^"]+)"/)?.[1];
    expect(entry).toMatch(/^\/Ssprout\/assets\/main-.+\.js$/);
    expect(urls[0]).toBe('/Ssprout/');
    expect(urls).toContain(entry);
    for (const href of html.matchAll(/<link [^>]*href="(\/Ssprout\/assets\/[^"]+)"/g)) expect(urls).toContain(href[1]);
    expect(urls.some((u) => /\/assets\/sprite-worker-[\w-]+\.js$/.test(u))).toBe(true);
    expect(urls.some((u) => /\.css$/.test(u))).toBe(true);
    expect(urls.some((u) => /-latin-500-normal-[\w-]+\.woff2$/.test(u))).toBe(true);
    expect(urls.filter((u) => /studio|\.map$|\.woff$|sw\.js$|cyrillic|vietnamese/.test(u))).toEqual([]);

    for (const url of urls) {
      expect((await request.get(url)).status(), url).toBe(200);
    }
  });
});
